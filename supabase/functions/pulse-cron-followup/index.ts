// pulse-cron-followup — cron horaire qui gère les non-réponses :
//
//   J+1 (24h-48h après sent_at) : relance email + SMS avec variant='followup'
//     → set followup_sent_at + incremente followup_count
//   J+2 (> 48h après sent_at)    : escalade Slack #head-of-things
//     → set escalated_at + closed_at (survey close, plus de relance)
//
// Ne concerne que les surveys type IN ('onboarding','monthly') qui sont
// closed_at IS NULL AND expires_at > now AND response absente.
//
// Ping automation-ping (workflow_id 'client_pulse') à la fin : success par
// défaut (même si aucun candidat), failure si toutes les relances tentées
// ont échoué.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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
const SLACK_CHANNEL = "profile"; // #head-of-things

const FOLLOWUP_AFTER_HOURS = 24;
const ESCALATE_AFTER_HOURS = 48;

interface OpenSurveyRow {
  id: string;
  client_code: string;
  type: PulseType;
  token: string;
  sent_at: string;
  expires_at: string;
  followup_sent_at: string | null;
  followup_count: number;
  escalated_at: string | null;
  closed_at: string | null;
}

interface ClientRow {
  client_code: string;
  email: string | null;
  phone: string | null;
  client_name: string | null;
  company_name: string | null;
  client_language: string | null;
}

interface FollowupOutcome {
  survey_id: string;
  client_code: string;
  action: "followup_sent" | "escalated" | "response_found" | "skipped" | "error";
  detail?: string;
}

function appUrl(): string {
  const explicit = Deno.env.get("PULSE_APP_URL");
  if (!explicit) {
    throw new Error("PULSE_APP_URL secret is not set (should be the Vercel frontend URL, e.g. https://your-app.vercel.app)");
  }
  return explicit.replace(/\/+$/, "");
}

function typeLabel(t: PulseType): string {
  if (t === "onboarding") return "Onboarding J+7";
  if (t === "monthly") return "Pulse mensuel";
  return "NPS relationnel";
}

async function loadOpenSurveys(supabase: SupabaseClient): Promise<OpenSurveyRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("pulse_surveys")
    .select("id, client_code, type, token, sent_at, expires_at, followup_sent_at, followup_count, escalated_at, closed_at")
    .is("closed_at", null)
    .gt("expires_at", nowIso)
    .in("type", ["onboarding", "monthly"]);
  if (error) throw new Error(`load open surveys: ${error.message}`);
  return (data ?? []) as OpenSurveyRow[];
}

async function hasResponse(supabase: SupabaseClient, surveyId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("pulse_responses")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);
  if (error) throw new Error(`response check: ${error.message}`);
  return (count ?? 0) > 0;
}

async function loadClient(supabase: SupabaseClient, code: string): Promise<ClientRow | null> {
  const { data, error } = await supabase
    .from("client_progress")
    .select("client_code, email, phone, client_name, company_name, client_language")
    .eq("client_code", code)
    .maybeSingle();
  if (error) throw new Error(`load client ${code}: ${error.message}`);
  return (data as ClientRow | null) || null;
}

async function sendFollowup(
  supabase: SupabaseClient,
  survey: OpenSurveyRow,
  client: ClientRow,
  resendApiKey: string,
): Promise<{ ok: boolean; detail: string }> {
  const parts: string[] = [];
  let anyOk = false;

  const rendered = renderPulseEmail({
    type: survey.type,
    variant: "followup",
    firstName: client.client_name,
    clientName: client.client_name,
    companyName: client.company_name,
    clientCode: client.client_code,
    appUrl: appUrl(),
    language: client.client_language,
  });

  if (client.email) {
    try {
      await sendResendEmail({
        apiKey: resendApiKey,
        from: FROM,
        to: client.email,
        subject: rendered.subject,
        html: rendered.html,
      });
      anyOk = true;
      parts.push("email");
    } catch (e) {
      parts.push(`email_err:${(e as Error).message.slice(0, 60)}`);
    }
  }

  if (client.phone) {
    const smsBody = renderPulseSMS({
      type: survey.type,
      variant: "followup",
      firstName: client.client_name,
      clientName: client.client_name,
      clientCode: client.client_code,
      appUrl: appUrl(),
      language: client.client_language,
    });
    const sms = await sendSms(client.phone, smsBody);
    if (sms.sent) {
      anyOk = true;
      parts.push("sms");
    } else if (!sms.skipped) {
      parts.push(`sms_err:${(sms.error || "").slice(0, 60)}`);
    }
  }

  if (anyOk) {
    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("pulse_surveys")
      .update({
        followup_sent_at: now,
        followup_count: survey.followup_count + 1,
      })
      .eq("id", survey.id);
    if (upErr) return { ok: false, detail: `update: ${upErr.message}` };
  }

  return { ok: anyOk, detail: parts.join(",") || "no channel available" };
}

async function escalateSlack(
  supabase: SupabaseClient,
  survey: OpenSurveyRow,
  client: ClientRow,
): Promise<{ ok: boolean; detail: string }> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) {
    return { ok: false, detail: "SUPABASE_URL / ANON_KEY manquants" };
  }
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const sentDate = new Date(survey.sent_at).toLocaleDateString("fr-CA");
  const relance = survey.followup_sent_at
    ? `1 relance envoyée le ${new Date(survey.followup_sent_at).toLocaleDateString("fr-CA")}`
    : "0 relance (échec relance)";

  const text = `🟠 *Non-réponse pulse ${typeLabel(survey.type)}* — *${clientDisplay}* — 48h sans réponse\n> Envoyé le ${sentDate} · ${relance}\n> Action : call ou mention au prochain weekly. Fenêtre fermée.`;

  try {
    const res = await fetch(`${supaUrl}/functions/v1/notify-slack-channel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    });
    if (!res.ok) {
      return { ok: false, detail: `slack ${res.status}: ${(await res.text()).slice(0, 120)}` };
    }
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("pulse_surveys")
    .update({ escalated_at: now, closed_at: now })
    .eq("id", survey.id);
  if (upErr) return { ok: false, detail: `update: ${upErr.message}` };

  return { ok: true, detail: "slack posted, survey closed" };
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

    const surveys = await loadOpenSurveys(supabase);
    const outcomes: FollowupOutcome[] = [];
    let attempted = 0;
    let succeeded = 0;

    for (const s of surveys) {
      const ageHours = (Date.now() - new Date(s.sent_at).getTime()) / 3600_000;

      // 1) Si une réponse est arrivée entretemps, on ferme la survey.
      if (await hasResponse(supabase, s.id)) {
        await supabase
          .from("pulse_surveys")
          .update({ closed_at: new Date().toISOString() })
          .eq("id", s.id);
        outcomes.push({ survey_id: s.id, client_code: s.client_code, action: "response_found" });
        continue;
      }

      const client = await loadClient(supabase, s.client_code);
      if (!client) {
        outcomes.push({ survey_id: s.id, client_code: s.client_code, action: "error", detail: "client not found" });
        continue;
      }

      // 2) Escalade Slack après 48h (peu importe si la relance a eu lieu ou non).
      if (ageHours >= ESCALATE_AFTER_HOURS) {
        attempted += 1;
        const r = await escalateSlack(supabase, s, client);
        if (r.ok) succeeded += 1;
        outcomes.push({
          survey_id: s.id,
          client_code: s.client_code,
          action: r.ok ? "escalated" : "error",
          detail: r.detail,
        });
        continue;
      }

      // 3) Relance email + SMS entre 24h et 48h, une fois seulement.
      if (ageHours >= FOLLOWUP_AFTER_HOURS && !s.followup_sent_at) {
        attempted += 1;
        const r = await sendFollowup(supabase, s, client, RESEND_API_KEY);
        if (r.ok) succeeded += 1;
        outcomes.push({
          survey_id: s.id,
          client_code: s.client_code,
          action: r.ok ? "followup_sent" : "error",
          detail: r.detail,
        });
        continue;
      }

      outcomes.push({
        survey_id: s.id,
        client_code: s.client_code,
        action: "skipped",
        detail: `age ${ageHours.toFixed(1)}h — trop tôt`,
      });
    }

    const failed = attempted - succeeded;
    const status = attempted > 0 && succeeded === 0 ? "failure" : "success";
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status,
      items_count: succeeded,
      error_message: status === "failure"
        ? `pulse-cron-followup: ${failed}/${attempted} actions échouées`
        : null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        open_surveys: surveys.length,
        attempted,
        succeeded,
        failed,
        outcomes,
        duration_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[pulse-cron-followup] fatal", (e as Error).message);
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status: "failure",
      error_message: `pulse-cron-followup fatal: ${(e as Error).message}`,
    });
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
