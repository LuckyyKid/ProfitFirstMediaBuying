// pulse-send — envoi d'un pulse (onboarding, monthly, relational) par email
// Resend + SMS Twilio. Insère une ligne pulse_surveys, capture la trajectoire
// (previous_score du dernier pulse répondu du client), pointe l'URL email/SMS
// vers pulse-response avec un token unique.
//
// Modes :
//   - Cron : POST body { trigger: "cron", type: "onboarding" | "monthly" }
//     ou aucun body (interprété comme cron sans type ⇒ 400).
//   - Manuel : POST body { client_code, type, manual: true, created_by? }
//     → envoi immédiat, bypasse le anti-dedup, force sur un seul client.
//
// Le mode 'relational' n'est pas envoyé par email : il est saisi manuellement
// via pulse-nps-log (Tranche 7). pulse-send refuse ce type.
//
// Anti-dedup en mode cron :
//   - onboarding : skip si un pulse 'onboarding' existe déjà dans les 30 j
//   - monthly    : skip si un pulse 'monthly'   existe déjà dans les 20 j
// Le mode manuel bypasse ces gardes.
//
// Ping automation-ping (workflow_id 'client_pulse') à la fin : success si au
// moins un envoi a réussi ou aucun candidat, failure sinon.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";
import { sendSms } from "../_shared/twilio.ts";
import { pingAutomation } from "../_shared/automationPing.ts";
import { renderPulseEmail, renderPulseSMS, type PulseType } from "../_shared/pulseTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";
const WORKFLOW_ID = "client_pulse";
const EXPIRES_DAYS = 7;
const DEDUP_DAYS: Record<PulseType, number> = {
  onboarding: 30,
  monthly: 20,
  relational: 0,
  weekly: 0,
};

// Fenêtre de détection pour le cron onboarding : ± 12h autour de J-7 pour
// tolérer les retards du cron horaire et éviter de rater un client.
const ONBOARDING_WINDOW_HOURS = 12;

// Timezone de référence pour "dernier jour ouvrable du mois" — Montréal /
// Toronto (heures d'ouverture agence).
const BIZDAY_TZ = "America/Toronto";

// Retourne true si `date` est le dernier jour ouvrable (lun-ven) du mois dans
// la timezone BIZDAY_TZ. Utilisé pour gater le cron monthly qui tourne tous
// les jours mais ne doit envoyer qu'une fois par mois.
function isLastBusinessDayOfMonth(date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BIZDAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (k: string) => parts.find(p => p.type === k)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wd = get("weekday"); // "Mon" | ... | "Sun"

  if (wd === "Sat" || wd === "Sun") return false;

  // Trouve le dernier jour ouvrable du mois courant dans BIZDAY_TZ.
  // On part du dernier jour calendaire et on recule tant que c'est weekend.
  const lastCalendarDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m=1-12 → dernier jour du mois m
  for (let day = lastCalendarDay; day >= 1; day--) {
    const testWd = new Intl.DateTimeFormat("en-CA", {
      timeZone: BIZDAY_TZ,
      weekday: "short",
    }).format(new Date(Date.UTC(y, m - 1, day, 12))); // midi UTC pour éviter les décalages
    if (testWd !== "Sat" && testWd !== "Sun") {
      return day === d;
    }
  }
  return false;
}

interface ClientRow {
  client_code: string;
  email: string | null;
  phone: string | null;
  client_name: string | null;
  company_name: string | null;
  completed_at: string | null;
  archived_at: string | null;
  client_language: string | null;
}

interface SendOutcome {
  client_code: string;
  survey_id?: string;
  email_sent: boolean;
  sms_sent: boolean;
  skipped_reason?: string;
  error?: string;
}

function appUrl(): string {
  const explicit = Deno.env.get("PULSE_APP_URL");
  if (!explicit) {
    throw new Error("PULSE_APP_URL secret is not set (should be the Vercel frontend URL, e.g. https://your-app.vercel.app)");
  }
  return explicit.replace(/\/+$/, "");
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

async function selectCronCandidates(
  supabase: ReturnType<typeof createClient>,
  type: PulseType,
): Promise<ClientRow[]> {
  if (type === "relational") return [];

  let query = supabase
    .from("client_progress")
    .select("client_code, email, phone, client_name, company_name, completed_at, archived_at, client_language")
    .not("completed_at", "is", null)
    .is("archived_at", null);

  if (type === "onboarding") {
    const now = Date.now();
    const target = 7 * 24 * 3600 * 1000;
    const from = new Date(now - target - ONBOARDING_WINDOW_HOURS * 3600 * 1000).toISOString();
    const to = new Date(now - target + ONBOARDING_WINDOW_HOURS * 3600 * 1000).toISOString();
    query = query.gte("completed_at", from).lte("completed_at", to);
  }

  const { data, error } = await query;
  if (error) throw new Error(`select clients: ${error.message}`);
  return (data ?? []) as ClientRow[];
}

async function hasRecentPulse(
  supabase: ReturnType<typeof createClient>,
  clientCode: string,
  type: PulseType,
): Promise<boolean> {
  const days = DEDUP_DAYS[type];
  if (!days) return false;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase
    .from("pulse_surveys")
    .select("id", { count: "exact", head: true })
    .eq("client_code", clientCode)
    .eq("type", type)
    .gte("sent_at", since);
  if (error) throw new Error(`dedup check: ${error.message}`);
  return (count ?? 0) > 0;
}

async function fetchTrajectory(
  supabase: ReturnType<typeof createClient>,
  clientCode: string,
): Promise<{ previous_score: number | null; previous_survey_id: string | null }> {
  const { data, error } = await supabase
    .from("pulse_responses")
    .select("score, survey_id, responded_at, pulse_surveys!inner(client_code)")
    .eq("pulse_surveys.client_code", clientCode)
    .order("responded_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`trajectory: ${error.message}`);
  const row = (data ?? [])[0] as { score: number; survey_id: string } | undefined;
  return {
    previous_score: row?.score ?? null,
    previous_survey_id: row?.survey_id ?? null,
  };
}

async function sendOnePulse(
  supabase: ReturnType<typeof createClient>,
  client: ClientRow,
  type: PulseType,
  opts: { manual: boolean; createdBy: string; resendApiKey: string },
): Promise<SendOutcome> {
  const outcome: SendOutcome = {
    client_code: client.client_code,
    email_sent: false,
    sms_sent: false,
  };

  if (!client.email && !client.phone) {
    outcome.skipped_reason = "no email and no phone";
    return outcome;
  }

  const trajectory = await fetchTrajectory(supabase, client.client_code);
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRES_DAYS * 24 * 3600 * 1000);

  const insertRes = await supabase
    .from("pulse_surveys")
    .insert({
      client_code: client.client_code,
      type,
      token,
      sent_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      sent_channels: [],
      manual: opts.manual,
      created_by: opts.createdBy,
      previous_score: trajectory.previous_score,
      previous_survey_id: trajectory.previous_survey_id,
    })
    .select("id")
    .single();

  if (insertRes.error || !insertRes.data) {
    outcome.error = `insert survey: ${insertRes.error?.message ?? "no data"}`;
    return outcome;
  }
  outcome.survey_id = insertRes.data.id as string;

  const rendered = renderPulseEmail({
    type,
    variant: "initial",
    firstName: client.client_name,
    clientName: client.client_name,
    companyName: client.company_name,
    clientCode: client.client_code,
    appUrl: appUrl(),
    language: client.client_language,
    token,
  });

  const sentChannels: string[] = [];

  if (client.email) {
    try {
      await sendResendEmail({
        apiKey: opts.resendApiKey,
        from: FROM,
        to: client.email,
        subject: rendered.subject,
        html: rendered.html,
      });
      outcome.email_sent = true;
      sentChannels.push("email");
    } catch (e) {
      outcome.error = `email: ${(e as Error).message}`;
    }
  }

  if (client.phone) {
    const smsBody = renderPulseSMS({
      type,
      variant: "initial",
      firstName: client.client_name,
      clientName: client.client_name,
      clientCode: client.client_code,
      appUrl: appUrl(),
      language: client.client_language,
      token,
    });
    const sms = await sendSms(client.phone, smsBody);
    if (sms.sent) {
      outcome.sms_sent = true;
      sentChannels.push("sms");
    } else if (!sms.skipped) {
      outcome.error = [outcome.error, `sms: ${sms.error}`].filter(Boolean).join(" | ");
    }
  }

  if (sentChannels.length > 0) {
    await supabase
      .from("pulse_surveys")
      .update({ sent_channels: sentChannels })
      .eq("id", outcome.survey_id);
  }

  return outcome;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* no body */ }
    }

    const rawType = String(body.type ?? "");
    if (!["onboarding", "monthly", "relational", "weekly"].includes(rawType)) {
      return new Response(
        JSON.stringify({ error: "type must be 'onboarding' | 'monthly' | 'relational' | 'weekly'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const type = rawType as PulseType;

    if (type === "relational") {
      return new Response(
        JSON.stringify({ error: "relational pulses use /pulse-nps-log, not /pulse-send" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const manual = body.manual === true;
    const createdBy = typeof body.created_by === "string" && body.created_by.trim()
      ? body.created_by.trim()
      : (manual ? "admin_manual" : "cron");

    // weekly = déclenché uniquement par le webhook meeting-scheduled (ou admin
    // manuel). Pas de cron : pas de trigger générique côté cron loop.
    if (type === "weekly" && !manual) {
      return new Response(
        JSON.stringify({ error: "weekly pulses require manual=true (triggered by meeting-scheduled webhook)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Gate: monthly cron ne s'exécute que le dernier jour ouvrable du mois.
    // Le cron pg_cron tourne quotidiennement pour tolérer un incident de cron,
    // mais on skippe les autres jours (retour success, items_count=0).
    if (type === "monthly" && !manual && !isLastBusinessDayOfMonth()) {
      await pingAutomation({
        workflow_id: WORKFLOW_ID,
        status: "success",
        items_count: 0,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          type,
          manual: false,
          skipped_reason: "not last business day of month",
          candidates: 0,
          sent: 0,
          duration_ms: Date.now() - started,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let candidates: ClientRow[] = [];
    if (manual) {
      const clientCode = String(body.client_code ?? "").trim();
      if (!clientCode) {
        return new Response(
          JSON.stringify({ error: "manual mode requires client_code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data, error } = await supabase
        .from("client_progress")
        .select("client_code, email, phone, client_name, company_name, completed_at, archived_at, client_language")
        .eq("client_code", clientCode)
        .maybeSingle();
      if (error) throw new Error(`fetch client: ${error.message}`);
      if (!data) {
        return new Response(
          JSON.stringify({ error: `client_code not found: ${clientCode}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      candidates = [data as ClientRow];
    } else {
      candidates = await selectCronCandidates(supabase, type);
    }

    const outcomes: SendOutcome[] = [];
    for (const client of candidates) {
      if (!manual && await hasRecentPulse(supabase, client.client_code, type)) {
        outcomes.push({
          client_code: client.client_code,
          email_sent: false,
          sms_sent: false,
          skipped_reason: `dedup: pulse ${type} sent within ${DEDUP_DAYS[type]}d`,
        });
        continue;
      }
      const outcome = await sendOnePulse(supabase, client, type, {
        manual,
        createdBy,
        resendApiKey: RESEND_API_KEY,
      });
      outcomes.push(outcome);
    }

    const sent = outcomes.filter(o => o.email_sent || o.sms_sent).length;
    const skipped = outcomes.filter(o => o.skipped_reason).length;
    const errored = outcomes.filter(o => o.error).length;

    const status = errored > 0 && sent === 0 && candidates.length > 0 ? "failure" : "success";
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status,
      items_count: sent,
      error_message: status === "failure"
        ? `pulse-send ${type}: ${errored} error(s), 0 sent`
        : null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        type,
        manual,
        candidates: candidates.length,
        sent,
        skipped,
        errored,
        elapsed_ms: Date.now() - started,
        outcomes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message || "unknown error";
    console.error("[pulse-send] failed", msg);
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status: "failure",
      error_message: `pulse-send fatal: ${msg}`,
    });
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
