// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATION WATCHDOG — catches workflows that STOPPED pinging.
// ─────────────────────────────────────────────────────────────────────────────
// A dead cron / disabled scenario emits no failure ping — it just goes silent.
// This job runs daily; for each active registry entry it verifies that the
// last success ping is within expected_cadence_hours. Missed cadence → alert.
// Second consecutive miss → severity +1 (S3→S2, S2→S1).
//
// Also flags workflows that PING but are ABSENT from the registry (undocumented).
// Always posts a heartbeat + optionally pings healthchecks.io (dead-man's-switch
// for the watchdog itself).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

type Severity = "S1" | "S2" | "S3";

const bump = (s: Severity): Severity => (s === "S3" ? "S2" : s === "S2" ? "S1" : "S1");

interface RegistryRow {
  workflow_id: string;
  name: string;
  criticality: Severity;
  expected_cadence_hours: number;
  active: boolean;
  how_to_pause: string | null;
}

const supa = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

async function postSlack(channel: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-slack-channel`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function hitHealthchecks() {
  const url = Deno.env.get("HEALTHCHECKS_WATCHDOG_URL");
  if (!url) return;
  try {
    await fetch(url, { method: "GET" });
  } catch {
    // healthchecks failure is by design self-signaling — don't crash the watchdog.
  }
}

function formatHours(h: number): string {
  if (h < 24) return `${h.toFixed(1)} h`;
  const d = Math.floor(h / 24);
  const rem = Math.round(h - d * 24);
  return rem === 0 ? `${d} j` : `${d} j ${rem} h`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date();
  const db = supa();

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = !!body?.dry_run;

    // 1) Load active registry.
    const { data: registry, error: regErr } = await db
      .from("automation_registry")
      .select("workflow_id, name, criticality, expected_cadence_hours, active, how_to_pause")
      .eq("active", true);
    if (regErr) throw new Error(`registry read failed: ${regErr.message}`);

    const activeRegistry: RegistryRow[] = (registry ?? []) as RegistryRow[];

    // 2) For each active workflow, compute time since last success.
    const overdue: Array<{
      row: RegistryRow;
      hoursSince: number | null;    // null = never seen
      severity: Severity;
      escalated: boolean;
    }> = [];

    for (const row of activeRegistry) {
      const { data: last } = await db
        .from("automation_run_log")
        .select("received_at")
        .eq("workflow_id", row.workflow_id)
        .eq("status", "success")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const hoursSince = last?.received_at
        ? (Date.now() - new Date(last.received_at).getTime()) / 3_600_000
        : null;

      const isOverdue = hoursSince === null || hoursSince > row.expected_cadence_hours;
      if (!isOverdue) continue;

      // Escalation: was this workflow flagged overdue by yesterday's watchdog run?
      const dayAgoLo = new Date(Date.now() - 30 * 3_600_000).toISOString();
      const dayAgoHi = new Date(Date.now() - 20 * 3_600_000).toISOString();
      const { data: prior } = await db
        .from("automation_error_log")
        .select("id")
        .eq("workflow_id", row.workflow_id)
        .eq("details->>source", "watchdog")
        .gte("created_at", dayAgoLo)
        .lte("created_at", dayAgoHi)
        .limit(1);

      const escalated = !!(prior && prior.length > 0);
      overdue.push({
        row,
        hoursSince,
        severity: escalated ? bump(row.criticality) : row.criticality,
        escalated,
      });
    }

    // 3) Detect undocumented workflows — pinged in last 24h but absent from registry.
    const dayAgoIso = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data: recentPings } = await db
      .from("automation_run_log")
      .select("workflow_id")
      .gte("received_at", dayAgoIso);
    const known = new Set(activeRegistry.map((r) => r.workflow_id));
    // include inactive-registered too, only flag truly-unknown IDs
    const { data: allRegistered } = await db
      .from("automation_registry")
      .select("workflow_id");
    for (const r of allRegistered ?? []) known.add(r.workflow_id);

    const undocumented = Array.from(
      new Set((recentPings ?? []).map((p) => p.workflow_id).filter((id) => !known.has(id))),
    );

    // 4) Post individual overdue alerts (dedup: skip if already logged in last 22h).
    const twentyTwoAgo = new Date(Date.now() - 22 * 3_600_000).toISOString();
    let alertsFired = 0;
    for (const o of overdue) {
      const { data: already } = await db
        .from("automation_error_log")
        .select("id")
        .eq("workflow_id", o.row.workflow_id)
        .eq("details->>source", "watchdog")
        .gte("created_at", twentyTwoAgo)
        .limit(1);
      if (already && already.length > 0) continue;

      const mention = o.severity === "S1" ? "<!channel> " : "";
      const durationText = o.hoursSince === null ? "jamais roulé" : `depuis ${formatHours(o.hoursSince)}`;
      const escalationNote = o.escalated ? `\n:arrow_double_up: Escalade automatique — 2e cadence manquée consécutive.` : "";
      const pauseNote = o.row.how_to_pause ? `\nPour pauser proprement : ${o.row.how_to_pause}` : "";
      const text =
        `${mention}:hourglass_flowing_sand: [${o.severity}] CADENCE MANQUÉE — *${o.row.name}*\n` +
        `Pas de ping success ${durationText} (cadence attendue : ${o.row.expected_cadence_hours} h).\n` +
        `Cause probable : cron mort, scénario désactivé, ou ping oublié dans le code.${escalationNote}${pauseNote}`;

      const slack = dryRun ? { ok: true } : await postSlack("automations_alerts", text);
      if (!dryRun) {
        await db.from("automation_error_log").insert({
          workflow_id: o.row.workflow_id,
          severity: o.severity,
          error: `cadence missed (${durationText})`,
          details: {
            source: "watchdog",
            hours_since_success: o.hoursSince,
            expected_cadence_hours: o.row.expected_cadence_hours,
            escalated: o.escalated,
          },
          slack_sent: slack.ok,
          slack_error: slack.ok ? null : slack.error,
        });
      }
      alertsFired++;
    }

    // 5) Undocumented workflow alerts (dedup: once per 22h per workflow_id).
    for (const wid of undocumented) {
      const { data: already } = await db
        .from("automation_error_log")
        .select("id")
        .eq("workflow_id", wid)
        .eq("details->>source", "watchdog_undocumented")
        .gte("created_at", twentyTwoAgo)
        .limit(1);
      if (already && already.length > 0) continue;

      const text =
        `:page_with_curl: [S2] WORKFLOW NON DOCUMENTÉ — \`${wid}\`\n` +
        `Ce workflow envoie des pings mais n'est PAS dans \`automation_registry\`.\n` +
        `Premier geste : ajoute-le au registre (name, criticality, expected_cadence_hours, owner, how_to_pause).`;
      const slack = dryRun ? { ok: true } : await postSlack("automations_alerts", text);
      if (!dryRun) {
        await db.from("automation_error_log").insert({
          workflow_id: wid,
          severity: "S2",
          error: "workflow non documenté",
          details: { source: "watchdog_undocumented" },
          slack_sent: slack.ok,
          slack_error: slack.ok ? null : slack.error,
        });
      }
      alertsFired++;
    }

    // 6) Heartbeat — always posted (unless dry_run).
    const dateStr = startedAt.toISOString().slice(0, 10);
    const heartbeatText =
      `:white_check_mark: Error monitoring ${dateStr} — ` +
      `${activeRegistry.length} automations surveillées, ` +
      `${alertsFired} alertes émises, ${overdue.length} en retard.`;
    if (!dryRun) {
      await postSlack("automations_heartbeat", heartbeatText);
    }

    // 7) Healthchecks (dead-man's-switch for the watchdog itself).
    if (!dryRun) await hitHealthchecks();

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        active_count: activeRegistry.length,
        overdue_count: overdue.length,
        undocumented_count: undocumented.length,
        alerts_fired: alertsFired,
        overdue: overdue.map((o) => ({
          workflow_id: o.row.workflow_id,
          hours_since_success: o.hoursSince,
          severity: o.severity,
          escalated: o.escalated,
        })),
        undocumented,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    // Global failure → single loud alert compensates for missing heartbeat.
    const msg = (e as Error).message;
    await postSlack(
      "automations_alerts",
      `<!channel> :rotating_light: *WATCHDOG ERROR MONITORING EN ÉCHEC* — ${msg}\n` +
        `Le heartbeat quotidien ne partira pas. Vérifie les logs de la function \`automation-watchdog\`.`,
    ).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
