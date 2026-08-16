// pulse-recap-monthly — récap mensuel des pulses postés sur Slack (#head-of-things).
//
// Trigger : cron le 1er jour ouvrable du mois suivant (skip si pas LBD+1).
// Alternative : appelé manuellement via POST { manual: true, month?: "YYYY-MM" }.
//
// Portefeuille trop petit pour un NPS agrégé (< 30 réponses/mois typiquement),
// donc on poste une TABLE ligne-par-ligne : Client | Type | Score | Note.
//
// Message Slack format markdown-friendly :
//   📊 *Récap Pulse — Mois YYYY-MM*
//   {n} réponses reçues sur {m} envois ({rate}% taux)
//   ```
//   Client              Type       Score  Note
//   ACME Corp           mensuel    9      "..."
//   ...
//   ```
//   Détracteurs : X · Passifs : Y · Promoteurs : Z · Chutes ≥2pt : W
//
// Ping automation-ping (workflow_id 'client_pulse') à la fin.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pingAutomation } from "../_shared/automationPing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKFLOW_ID = "client_pulse";
const SLACK_CHANNEL = "profile"; // #head-of-things
const TRAJECTORY_DROP = 2;

interface SurveyResponseRow {
  survey_id: string;
  client_code: string;
  type: string;
  score: number;
  verbatim: string | null;
  responded_at: string;
  previous_score: number | null;
  company_name: string | null;
  client_name: string | null;
}

function typeShort(t: string): string {
  if (t === "onboarding") return "onboard.";
  if (t === "monthly") return "mensuel";
  return "NPS rel.";
}

function padRight(s: string, n: number): string {
  const truncated = s.length > n ? s.slice(0, n - 1) + "…" : s;
  return truncated + " ".repeat(Math.max(0, n - truncated.length));
}

// Retourne YYYY-MM du mois précédent (ex: '2026-08' si on est en septembre)
function previousMonthKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Retourne les bornes ISO [from, to) pour un mois YYYY-MM
function monthBounds(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  return { from, to };
}

async function loadResponsesForMonth(sb: SupabaseClient, monthKey: string): Promise<SurveyResponseRow[]> {
  const { from, to } = monthBounds(monthKey);
  const { data, error } = await sb
    .from("pulse_responses")
    .select(`
      survey_id,
      score,
      verbatim,
      responded_at,
      pulse_surveys!inner(client_code, type, previous_score)
    `)
    .gte("responded_at", from)
    .lt("responded_at", to)
    .order("responded_at", { ascending: true });
  if (error) throw new Error(`load responses: ${error.message}`);

  // Récupère les noms des clients en 2e requête pour éviter un embed multi-niveaux
  const codes = Array.from(new Set(
    (data ?? []).map((r: any) => r.pulse_surveys?.client_code).filter(Boolean),
  ));
  const clientsByCode = new Map<string, { client_name: string | null; company_name: string | null }>();
  if (codes.length > 0) {
    const { data: clients, error: cErr } = await sb
      .from("client_progress")
      .select("client_code, client_name, company_name")
      .in("client_code", codes);
    if (cErr) throw new Error(`load client names: ${cErr.message}`);
    for (const c of clients ?? []) {
      clientsByCode.set(c.client_code, { client_name: c.client_name, company_name: c.company_name });
    }
  }

  return (data ?? []).map((r: any) => {
    const ps = r.pulse_surveys;
    const cli = clientsByCode.get(ps?.client_code) || { client_name: null, company_name: null };
    return {
      survey_id: r.survey_id,
      client_code: ps?.client_code,
      type: ps?.type,
      score: r.score,
      verbatim: r.verbatim,
      responded_at: r.responded_at,
      previous_score: ps?.previous_score ?? null,
      company_name: cli.company_name,
      client_name: cli.client_name,
    } as SurveyResponseRow;
  });
}

async function countSurveysSent(sb: SupabaseClient, monthKey: string): Promise<number> {
  const { from, to } = monthBounds(monthKey);
  const { count, error } = await sb
    .from("pulse_surveys")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", from)
    .lt("sent_at", to)
    .in("type", ["onboarding", "monthly", "relational"]);
  if (error) throw new Error(`count sent: ${error.message}`);
  return count ?? 0;
}

function buildTable(rows: SurveyResponseRow[]): string {
  if (rows.length === 0) return "_Aucune réponse ce mois-ci._";
  const header = padRight("Client", 20) + " " + padRight("Type", 9) + " " + padRight("Score", 6) + " Note";
  const sep = "-".repeat(header.length);
  const lines = rows.map(r => {
    const name = r.company_name || r.client_name || r.client_code;
    const scoreStr = String(r.score).padStart(2) + "/10";
    const dropped = r.previous_score != null && (r.previous_score - r.score) >= TRAJECTORY_DROP;
    const scoreWithFlag = dropped ? scoreStr + "*" : scoreStr;
    const note = (r.verbatim ?? "").replace(/\s+/g, " ").slice(0, 60);
    return padRight(name, 20) + " " + padRight(typeShort(r.type), 9) + " " + padRight(scoreWithFlag, 6) + " " + note;
  });
  return "```\n" + [header, sep, ...lines].join("\n") + "\n```";
}

async function postSlack(text: string): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) return false;
  try {
    const res = await fetch(`${supaUrl}/functions/v1/notify-slack-channel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[pulse-recap-monthly] slack error", (e as Error).message);
    return false;
  }
}

// Retourne true si aujourd'hui est le 1er jour ouvrable du mois (Toronto TZ).
function isFirstBusinessDayOfMonth(date = new Date()): boolean {
  const tz = "America/Toronto";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(date);
  const get = (k: string) => parts.find(p => p.type === k)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wd = get("weekday");
  if (wd === "Sat" || wd === "Sun") return false;
  for (let day = 1; day <= 7; day++) {
    const testWd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, weekday: "short",
    }).format(new Date(Date.UTC(y, m - 1, day, 12)));
    if (testWd !== "Sat" && testWd !== "Sun") return day === d;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};
    const manual = body?.manual === true;
    const overrideMonth = typeof body?.month === "string" && /^\d{4}-\d{2}$/.test(body.month)
      ? body.month
      : null;

    // Gate cron : ne s'exécute que le 1er jour ouvrable du mois (Toronto TZ)
    if (!manual && !isFirstBusinessDayOfMonth()) {
      await pingAutomation({ workflow_id: WORKFLOW_ID, status: "success", items_count: 0 });
      return new Response(
        JSON.stringify({ ok: true, skipped_reason: "not first business day of month" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const monthKey = overrideMonth ?? previousMonthKey();
    const rows = await loadResponsesForMonth(sb, monthKey);
    const sent = await countSurveysSent(sb, monthKey);

    const detractors = rows.filter(r => r.score <= 6).length;
    const passives = rows.filter(r => r.score >= 7 && r.score <= 8).length;
    const promoters = rows.filter(r => r.score >= 9).length;
    const drops = rows.filter(r => r.previous_score != null && (r.previous_score - r.score) >= TRAJECTORY_DROP).length;
    const rate = sent > 0 ? Math.round((rows.length / sent) * 100) : 0;

    const table = buildTable(rows);
    const text = [
      `📊 *Récap Pulse — ${monthKey}*`,
      `${rows.length} réponses reçues sur ${sent} envois (${rate}% taux)`,
      "",
      table,
      "",
      `🔴 Détracteurs : ${detractors} · 🟡 Passifs : ${passives} · 🟢 Promoteurs : ${promoters} · 🟠 Chutes ≥2pt : ${drops}`,
    ].join("\n");

    const posted = await postSlack(text);
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status: posted ? "success" : "failure",
      items_count: rows.length,
      error_message: posted ? null : "recap slack post failed",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        month: monthKey,
        responses: rows.length,
        surveys_sent: sent,
        response_rate_pct: rate,
        detractors, passives, promoters, drops,
        slack_posted: posted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[pulse-recap-monthly] error", (e as Error).message);
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status: "failure",
      error_message: `pulse-recap-monthly fatal: ${(e as Error).message}`,
    });
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
