// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATION PING — ingestion endpoint for TDIA agency workflows.
// ─────────────────────────────────────────────────────────────────────────────
// Every automation POSTs here on success AND on failure. Auth is a shared
// secret in the X-Automation-Token header (env: AUTOMATION_PING_TOKEN).
//
// Body: { workflow_id, status: "success"|"failure", error_message?, items_count?, run_url? }
//
// Behavior:
//   - Success ping  → append to automation_run_log, done.
//   - Failure ping  → append to run_log, then:
//       1. Storm check: ≥5 distinct failed workflows in last 10min → single
//          aggregate alert (S1 "PANNE MULTIPLE"), individual alert suppressed.
//       2. Otherwise dedup: if this workflow already alerted in last 1h,
//          increment repeat_count in the existing error_log row (no new Slack).
//       3. Otherwise fire the Slack alert + insert error_log row.
//   - Unregistered workflow (ID not in automation_registry) → S2 alert
//       "workflow non documenté" (still deduped 1h).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-automation-token",
};

const STORM_THRESHOLD = 5;         // distinct failed workflows
const STORM_WINDOW_MIN = 10;
const DEDUP_WINDOW_MIN = 60;

type Severity = "S1" | "S2" | "S3";

interface RegistryRow {
  workflow_id: string;
  name: string;
  criticality: Severity;
  active: boolean;
}

const supa = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// Constant-time-ish equality on the shared token.
function tokenOk(header: string | null): boolean {
  const expected = Deno.env.get("AUTOMATION_PING_TOKEN") ?? "";
  if (!header || !expected || header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

// Map error text → first-response playbook line for the Slack message.
function firstMove(errMsg: string | null): string {
  const s = (errMsg ?? "").toLowerCase();
  if (/credential|auth|token|401|403|unauthorized|invalid_grant/.test(s))
    return "reconnecter l'intégration (credentials expirés)";
  if (/timeout|econnreset|network|503|504|502|dns/.test(s))
    return "vérifier le service tiers (panne ou lenteur)";
  if (/quota|rate.?limit|429|too.?many/.test(s))
    return "attendre la fenêtre ou augmenter la limite";
  return "ouvrir le lien d'exécution pour diagnostiquer";
}

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

async function fireIndividualAlert(
  db: ReturnType<typeof supa>,
  reg: RegistryRow | null,
  workflow_id: string,
  error_message: string | null,
  items_count: number | null,
  run_url: string | null,
) {
  const severity: Severity = reg?.criticality ?? "S2";
  const name = reg?.name ?? workflow_id;

  // Last success for context.
  const { data: lastSuccess } = await db
    .from("automation_run_log")
    .select("received_at")
    .eq("workflow_id", workflow_id)
    .eq("status", "success")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const undocumentedNote = reg ? "" : "\n:warning: Workflow *non documenté* — ajoute-le au registre.";
  const mention = severity === "S1" ? "<!channel> " : "";
  const errShort = (error_message ?? "(pas de message)").slice(0, 300);
  const itemsLine = items_count != null ? ` · Items concernés : ${items_count}` : "";
  const lastSuccessLine = lastSuccess?.received_at
    ? new Date(lastSuccess.received_at).toISOString()
    : "jamais";
  const runLine = run_url ? `\nLien exécution : ${run_url}` : "";

  const text =
    `${mention}:warning: [${severity}] ÉCHEC — *${name}*\n` +
    `Erreur : ${errShort}${itemsLine}\n` +
    `Dernier succès : ${lastSuccessLine}${runLine}\n` +
    `Premier geste : ${firstMove(error_message)}${undocumentedNote}`;

  const slack = await postSlack("automations_alerts", text);

  await db.from("automation_error_log").insert({
    workflow_id,
    severity,
    error: errShort,
    details: {
      source: "ping",
      undocumented: !reg,
      run_url,
      items_count,
      repeat_count: 1,
    },
    slack_sent: slack.ok,
    slack_error: slack.ok ? null : slack.error,
  });
}

async function fireStormAlert(db: ReturnType<typeof supa>, workflowIds: string[]) {
  const text =
    `<!channel> :thunder_cloud_and_rain: *PANNE MULTIPLE* — ${workflowIds.length} workflows en échec dans les ${STORM_WINDOW_MIN} dernières minutes.\n` +
    `Workflows : ${workflowIds.map((w) => `\`${w}\``).join(", ")}\n` +
    `Premier geste : vérifie une cause commune (auth, réseau, service externe) avant d'ouvrir chaque log.`;
  const slack = await postSlack("automations_alerts", text);
  await db.from("automation_error_log").insert({
    workflow_id: null,
    severity: "S1",
    error: `storm: ${workflowIds.length} workflows`,
    details: { source: "storm", workflow_ids: workflowIds, window_minutes: STORM_WINDOW_MIN },
    slack_sent: slack.ok,
    slack_error: slack.ok ? null : slack.error,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!tokenOk(req.headers.get("x-automation-token"))) {
    return new Response(JSON.stringify({ error: "invalid or missing X-Automation-Token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    workflow_id?: string;
    status?: string;
    error_message?: string;
    items_count?: number;
    run_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const workflow_id = (body.workflow_id ?? "").trim();
  const status = body.status;
  if (!workflow_id || (status !== "success" && status !== "failure")) {
    return new Response(
      JSON.stringify({ error: "workflow_id and status ('success'|'failure') are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const db = supa();

  // Always append to run_log first — cheap and always useful.
  const { error: runErr } = await db.from("automation_run_log").insert({
    workflow_id,
    status,
    error_message: body.error_message ?? null,
    items_count: typeof body.items_count === "number" ? body.items_count : null,
    run_url: body.run_url ?? null,
  });
  if (runErr) {
    return new Response(JSON.stringify({ error: `run_log insert failed: ${runErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (status === "success") {
    return new Response(JSON.stringify({ ok: true, logged: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── FAILURE PATH ──

  const { data: reg } = await db
    .from("automation_registry")
    .select("workflow_id, name, criticality, active")
    .eq("workflow_id", workflow_id)
    .maybeSingle();

  // 1) Storm detection — distinct failed workflows in the last STORM_WINDOW_MIN.
  const stormSince = new Date(Date.now() - STORM_WINDOW_MIN * 60_000).toISOString();
  const { data: stormRows } = await db
    .from("automation_run_log")
    .select("workflow_id")
    .eq("status", "failure")
    .gte("received_at", stormSince);
  const distinctFailed = Array.from(new Set((stormRows ?? []).map((r) => r.workflow_id)));

  if (distinctFailed.length >= STORM_THRESHOLD) {
    // Only fire one storm alert per STORM_WINDOW_MIN.
    const { data: recentStorm } = await db
      .from("automation_error_log")
      .select("id")
      .eq("severity", "S1")
      .eq("details->>source", "storm")
      .gte("created_at", stormSince)
      .limit(1);
    if (!recentStorm || recentStorm.length === 0) {
      await fireStormAlert(db, distinctFailed);
    }
    return new Response(
      JSON.stringify({ ok: true, logged: "failure", suppressed: "storm", storm_count: distinctFailed.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2) Individual dedup — last alert for this workflow in the last hour.
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString();
  const { data: recentAlert } = await db
    .from("automation_error_log")
    .select("id, details")
    .eq("workflow_id", workflow_id)
    .gte("created_at", dedupSince)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentAlert) {
    const prev = (recentAlert.details ?? {}) as Record<string, unknown>;
    const nextCount = (typeof prev.repeat_count === "number" ? prev.repeat_count : 1) + 1;
    await db
      .from("automation_error_log")
      .update({
        details: { ...prev, repeat_count: nextCount, last_error: body.error_message ?? null },
      })
      .eq("id", recentAlert.id);
    return new Response(
      JSON.stringify({ ok: true, logged: "failure", suppressed: "dedup", repeat_count: nextCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 3) Fresh alert.
  await fireIndividualAlert(
    db,
    reg ?? null,
    workflow_id,
    body.error_message ?? null,
    typeof body.items_count === "number" ? body.items_count : null,
    body.run_url ?? null,
  );

  return new Response(
    JSON.stringify({ ok: true, logged: "failure", alerted: true, severity: reg?.criticality ?? "S2" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
