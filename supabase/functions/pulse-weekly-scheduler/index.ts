// pulse-weekly-scheduler — orchestre le cycle de vie du pulse hebdo (NPS
// weekly déclenché par un meeting) :
//
//   1. À T-48h avant scheduled_at → envoi initial (email + SMS)
//        → crée pulse_surveys (type='weekly')
//        → set client_meetings.initial_sent_at + pulse_survey_id
//   2. Toutes les 24h après le dernier envoi, tant que le meeting n'a pas eu
//      lieu ET que le client n'a pas répondu → suivi (email + SMS)
//        → set client_meetings.last_followup_at, followup_count++
//   3. Le jour du meeting (hours_until <= 0) → si non-répondu, ping Slack
//      #client-nps pour rappeler à l'équipe de faire faire le NPS pendant
//      le meeting → set slack_reminded_at (fin du cycle).
//
// Meeting créé avec < 48h de préavis : la logique tombe naturellement dans
// le cas #1 dès le premier tick du scheduler.
//
// Cadence pg_cron : toutes les 15 min. Idempotent — safe si le cron double-tick.
//
// Ping automation-ping (workflow_id 'client_pulse_weekly').

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";
import { sendSms } from "../_shared/twilio.ts";
import { pingAutomation } from "../_shared/automationPing.ts";
import { renderPulseEmail, renderPulseSMS, type PulseVariant } from "../_shared/pulseTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";
const WORKFLOW_ID = "client_pulse_weekly";
const SLACK_CHANNEL = "client_nps"; // → #client-nps via notify-slack-channel

const INITIAL_LEAD_HOURS = 48;   // envoi initial à T-48h max
const FOLLOWUP_INTERVAL_HOURS = 24;
const LOOKBACK_HOURS = 4;        // meetings passés récents (fenêtre ping Slack J-0)

interface MeetingRow {
  id: string;
  client_code: string;
  scheduled_at: string;
  pulse_survey_id: string | null;
  initial_sent_at: string | null;
  last_followup_at: string | null;
  followup_count: number;
  slack_reminded_at: string | null;
}

interface ClientRow {
  client_code: string;
  email: string | null;
  phone: string | null;
  client_name: string | null;
  company_name: string | null;
  client_language: string | null;
}

interface SurveyRow {
  id: string;
  closed_at: string | null;
  followup_count: number;
  token: string;
}

type ActionKind =
  | "initial_sent"
  | "followup_sent"
  | "slack_reminded"
  | "response_found"
  | "skipped"
  | "error";

interface MeetingOutcome {
  meeting_id: string;
  client_code: string;
  action: ActionKind;
  detail?: string;
}

function appUrl(): string {
  const explicit = Deno.env.get("PULSE_APP_URL");
  if (!explicit) {
    throw new Error("PULSE_APP_URL secret is not set (should be the Vercel frontend URL)");
  }
  return explicit.replace(/\/+$/, "");
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 3_600_000;
}

async function loadPendingMeetings(supabase: SupabaseClient): Promise<MeetingRow[]> {
  const nowMs = Date.now();
  const lowerBound = new Date(nowMs - LOOKBACK_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("client_meetings")
    .select("id, client_code, scheduled_at, pulse_survey_id, initial_sent_at, last_followup_at, followup_count, slack_reminded_at")
    .gte("scheduled_at", lowerBound)
    .is("slack_reminded_at", null)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(`load meetings: ${error.message}`);
  return (data ?? []) as MeetingRow[];
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

async function loadSurvey(supabase: SupabaseClient, surveyId: string): Promise<SurveyRow | null> {
  const { data, error } = await supabase
    .from("pulse_surveys")
    .select("id, closed_at, followup_count, token")
    .eq("id", surveyId)
    .maybeSingle();
  if (error) throw new Error(`load survey ${surveyId}: ${error.message}`);
  return (data as SurveyRow | null) || null;
}

async function sendPulseChannels(
  client: ClientRow,
  variant: PulseVariant,
  token: string,
  resendApiKey: string,
): Promise<{ emailOk: boolean; smsOk: boolean; sentChannels: string[]; error?: string }> {
  const sentChannels: string[] = [];
  let emailOk = false;
  let smsOk = false;
  let error: string | undefined;

  const rendered = renderPulseEmail({
    type: "weekly",
    variant,
    firstName: client.client_name,
    clientName: client.client_name,
    companyName: client.company_name,
    clientCode: client.client_code,
    appUrl: appUrl(),
    language: client.client_language,
    token,
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
      emailOk = true;
      sentChannels.push("email");
    } catch (e) {
      error = `email: ${(e as Error).message}`;
    }
  }

  if (client.phone) {
    const smsBody = renderPulseSMS({
      type: "weekly",
      variant,
      firstName: client.client_name,
      clientName: client.client_name,
      clientCode: client.client_code,
      appUrl: appUrl(),
      language: client.client_language,
      token,
    });
    const sms = await sendSms(client.phone, smsBody);
    if (sms.sent) {
      smsOk = true;
      sentChannels.push("sms");
    } else if (!sms.skipped) {
      error = [error, `sms: ${sms.error}`].filter(Boolean).join(" | ");
    }
  }

  return { emailOk, smsOk, sentChannels, error };
}

async function sendInitial(
  supabase: SupabaseClient,
  meeting: MeetingRow,
  client: ClientRow,
  resendApiKey: string,
): Promise<{ ok: boolean; detail: string }> {
  if (!client.email && !client.phone) {
    return { ok: false, detail: "no email and no phone" };
  }

  const token = generateToken();
  const now = new Date();
  const meetingAt = new Date(meeting.scheduled_at);
  // Expiration = 6h après le meeting (au-delà, plus de sens de répondre).
  const expiresAt = new Date(meetingAt.getTime() + 6 * 3_600_000);

  const insertRes = await supabase
    .from("pulse_surveys")
    .insert({
      client_code: client.client_code,
      type: "weekly",
      token,
      sent_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      sent_channels: [],
      manual: false,
      created_by: `meeting_scheduler:${meeting.id}`,
      previous_score: null,
      previous_survey_id: null,
    })
    .select("id")
    .single();

  if (insertRes.error || !insertRes.data) {
    return { ok: false, detail: `insert survey: ${insertRes.error?.message ?? "no data"}` };
  }
  const surveyId = insertRes.data.id as string;

  const send = await sendPulseChannels(client, "initial", token, resendApiKey);

  if (send.sentChannels.length > 0) {
    await supabase
      .from("pulse_surveys")
      .update({ sent_channels: send.sentChannels })
      .eq("id", surveyId);
  }

  const anyOk = send.emailOk || send.smsOk;
  const { error: upErr } = await supabase
    .from("client_meetings")
    .update({
      pulse_survey_id: surveyId,
      initial_sent_at: anyOk ? now.toISOString() : null,
    })
    .eq("id", meeting.id);
  if (upErr) return { ok: false, detail: `meeting update: ${upErr.message}` };

  if (!anyOk) return { ok: false, detail: send.error || "no channel succeeded" };
  return { ok: true, detail: send.sentChannels.join(",") };
}

async function sendFollowup(
  supabase: SupabaseClient,
  meeting: MeetingRow,
  client: ClientRow,
  surveyToken: string,
  resendApiKey: string,
): Promise<{ ok: boolean; detail: string }> {
  const send = await sendPulseChannels(client, "followup", surveyToken, resendApiKey);
  const anyOk = send.emailOk || send.smsOk;
  if (!anyOk) return { ok: false, detail: send.error || "no channel available" };

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("client_meetings")
    .update({
      last_followup_at: now,
      followup_count: meeting.followup_count + 1,
    })
    .eq("id", meeting.id);
  if (upErr) return { ok: false, detail: `meeting update: ${upErr.message}` };

  // Mirror on the survey row for the admin pulse view.
  if (meeting.pulse_survey_id) {
    await supabase
      .from("pulse_surveys")
      .update({
        followup_sent_at: now,
        followup_count: meeting.followup_count + 1,
      })
      .eq("id", meeting.pulse_survey_id);
  }

  return { ok: true, detail: send.sentChannels.join(",") };
}

async function remindSlack(
  supabase: SupabaseClient,
  meeting: MeetingRow,
  client: ClientRow | null,
): Promise<{ ok: boolean; detail: string }> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) {
    return { ok: false, detail: "SUPABASE_URL / ANON_KEY manquants" };
  }

  const clientDisplay = client?.company_name || client?.client_name || meeting.client_code;
  const meetingAt = new Date(meeting.scheduled_at);
  const dateFr = meetingAt.toLocaleString("fr-CA", {
    timeZone: "America/Toronto",
    dateStyle: "full",
    timeStyle: "short",
  });
  const relance = meeting.followup_count > 0
    ? `${meeting.followup_count} relance${meeting.followup_count > 1 ? "s" : ""} envoyée${meeting.followup_count > 1 ? "s" : ""}`
    : (meeting.initial_sent_at ? "aucune relance (envoi initial seulement)" : "aucun envoi (client introuvable ou sans canal)");

  const text = `🟡 *NPS hebdo non rempli* — *${clientDisplay}* (${meeting.client_code})\n> Meeting prévu : ${dateFr}\n> ${relance}\n> Action : faire remplir le NPS hebdo pendant le meeting.`;

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
    .from("client_meetings")
    .update({ slack_reminded_at: now })
    .eq("id", meeting.id);
  if (upErr) return { ok: false, detail: `meeting update: ${upErr.message}` };

  return { ok: true, detail: "slack posted, cycle closed" };
}

async function markCycleDone(supabase: SupabaseClient, meetingId: string): Promise<void> {
  // Marque la fin du cycle sans envoi Slack (répondu ou hors périmètre).
  await supabase
    .from("client_meetings")
    .update({ slack_reminded_at: new Date().toISOString() })
    .eq("id", meetingId);
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

    const meetings = await loadPendingMeetings(supabase);
    const outcomes: MeetingOutcome[] = [];
    let attempted = 0;
    let succeeded = 0;
    const now = new Date();

    for (const m of meetings) {
      const hoursUntil = hoursBetween(new Date(m.scheduled_at), now);
      const client = await loadClient(supabase, m.client_code);

      // ── Statut réponse (si survey créée) ────────────────────────────────
      let survey: SurveyRow | null = null;
      if (m.pulse_survey_id) {
        survey = await loadSurvey(supabase, m.pulse_survey_id);
      }
      // Survey `closed_at` != null = finalisée par le client OU close par ailleurs
      // → dans les 2 cas on n'a plus rien à envoyer/relancer.
      const responded = !!survey?.closed_at;

      // ── Cas 3 : jour du meeting (ou passé de peu) ───────────────────────
      // Prioritaire même si client introuvable : on veut au moins prévenir
      // l'équipe de faire le NPS en réunion.
      if (hoursUntil <= 0) {
        if (responded) {
          await markCycleDone(supabase, m.id);
          outcomes.push({ meeting_id: m.id, client_code: m.client_code, action: "response_found" });
          continue;
        }
        attempted += 1;
        const r = await remindSlack(supabase, m, client);
        if (r.ok) succeeded += 1;
        outcomes.push({
          meeting_id: m.id,
          client_code: m.client_code,
          action: r.ok ? "slack_reminded" : "error",
          detail: r.detail,
        });
        continue;
      }

      // Sans client on ne peut ni envoyer ni suivre — on attend J-0h qui
      // postera quand même sur Slack avec juste le client_code brut.
      if (!client) {
        outcomes.push({
          meeting_id: m.id,
          client_code: m.client_code,
          action: "skipped",
          detail: "client introuvable dans client_progress — attente ping Slack J-0",
        });
        continue;
      }

      // ── Cas 1 : envoi initial (T-48h ou moins) ──────────────────────────
      if (!m.initial_sent_at) {
        if (hoursUntil > INITIAL_LEAD_HOURS) {
          outcomes.push({
            meeting_id: m.id,
            client_code: m.client_code,
            action: "skipped",
            detail: `T-${hoursUntil.toFixed(1)}h > ${INITIAL_LEAD_HOURS}h (initial pas encore dû)`,
          });
          continue;
        }
        // Client sans email ni téléphone → on ne peut rien envoyer. On laisse
        // filer jusqu'au ping Slack du jour du meeting (rappel humain).
        if (!client.email && !client.phone) {
          outcomes.push({
            meeting_id: m.id,
            client_code: m.client_code,
            action: "skipped",
            detail: "aucun canal client — attente ping Slack J-0",
          });
          continue;
        }
        attempted += 1;
        const r = await sendInitial(supabase, m, client, RESEND_API_KEY);
        if (r.ok) succeeded += 1;
        outcomes.push({
          meeting_id: m.id,
          client_code: m.client_code,
          action: r.ok ? "initial_sent" : "error",
          detail: r.detail,
        });
        continue;
      }

      // ── Cas 2 : suivi toutes les 24h tant que non-répondu ───────────────
      if (responded) {
        outcomes.push({
          meeting_id: m.id,
          client_code: m.client_code,
          action: "skipped",
          detail: "déjà répondu — attente jour du meeting",
        });
        continue;
      }
      const lastSendIso = m.last_followup_at || m.initial_sent_at;
      const hoursSinceLast = hoursBetween(now, new Date(lastSendIso));
      if (hoursSinceLast < FOLLOWUP_INTERVAL_HOURS) {
        outcomes.push({
          meeting_id: m.id,
          client_code: m.client_code,
          action: "skipped",
          detail: `dernier envoi il y a ${hoursSinceLast.toFixed(1)}h (< ${FOLLOWUP_INTERVAL_HOURS}h)`,
        });
        continue;
      }
      // Safety : le followup nécessite le token de la survey (URL désambiguïsée).
      // Si la survey a disparu ou perdu son token, on skip plutôt que d'envoyer
      // un lien sans token qui risquerait de résoudre sur un autre pulse ouvert.
      if (!survey?.token) {
        outcomes.push({
          meeting_id: m.id,
          client_code: m.client_code,
          action: "skipped",
          detail: "survey introuvable ou sans token — followup annulé",
        });
        continue;
      }
      attempted += 1;
      const r = await sendFollowup(supabase, m, client, survey.token, RESEND_API_KEY);
      if (r.ok) succeeded += 1;
      outcomes.push({
        meeting_id: m.id,
        client_code: m.client_code,
        action: r.ok ? "followup_sent" : "error",
        detail: r.detail,
      });
    }

    const failed = attempted - succeeded;
    const status = attempted > 0 && succeeded === 0 ? "failure" : "success";
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status,
      items_count: succeeded,
      error_message: status === "failure"
        ? `pulse-weekly-scheduler: ${failed}/${attempted} actions échouées`
        : null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        meetings_in_scope: meetings.length,
        attempted,
        succeeded,
        failed,
        outcomes,
        duration_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message || "unknown error";
    console.error("[pulse-weekly-scheduler] fatal", msg);
    await pingAutomation({
      workflow_id: WORKFLOW_ID,
      status: "failure",
      error_message: `pulse-weekly-scheduler fatal: ${msg}`,
    });
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
