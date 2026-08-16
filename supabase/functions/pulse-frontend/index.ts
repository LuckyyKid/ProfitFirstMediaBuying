// pulse-frontend — JSON API pour la page /pulse de l'app React.
// Le client entre son code client sur la page, cette function :
//   - action="lookup" → renvoie le pulse ouvert le plus récent pour ce code
//   - action="capture" → insère la réponse (score), post Slack, comment ClickUp
//   - action="verbatim" → update le verbatim de la réponse déjà capturée
//
// verify_jwt = false (voir config.toml). Auth par code client + survey_id qui
// doit matcher (empêche le spoof : il faut connaître son code ET récupérer un
// survey_id valide via lookup).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLICKUP_ENDPOINT = "https://api.clickup.com/api/v2/task";
const SLACK_CHANNEL = "profile"; // = #head-of-things
const TRAJECTORY_DROP = 2;

type Lang = "fr" | "en";

interface SurveyRow {
  id: string;
  client_code: string;
  type: "onboarding" | "monthly" | "relational";
  expires_at: string;
  closed_at: string | null;
  previous_score: number | null;
  slack_posted_at: string | null;
  clickup_commented_at: string | null;
}

interface ClientRow {
  client_code: string;
  client_name: string | null;
  company_name: string | null;
  client_language: string | null;
  clickup_task_id: string | null;
}

function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

function scoreBadge(score: number) {
  if (score <= 6) return { emoji: "🔴", label_fr: "détracteur", hint_fr: "Call récupération 24-48h" };
  if (score <= 8) return { emoji: "🟡", label_fr: "passif", hint_fr: "Question au prochain weekly" };
  return { emoji: "🟢", label_fr: "promoteur", hint_fr: "Demander témoignage / référence" };
}

function typeLabel(t: SurveyRow["type"]): string {
  if (t === "onboarding") return "Onboarding J+7";
  if (t === "monthly") return "Pulse mensuel";
  return "NPS relationnel";
}

async function loadClient(supabase: SupabaseClient, code: string): Promise<ClientRow | null> {
  const { data, error } = await supabase
    .from("client_progress")
    .select("client_code, client_name, company_name, client_language, clickup_task_id")
    .eq("client_code", code)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientRow | null) || null;
}

async function loadOpenSurvey(supabase: SupabaseClient, clientCode: string): Promise<SurveyRow | null> {
  // Pulse ouvert = closed_at IS NULL ET expires_at > now. On prend le plus
  // récent (celui envoyé en dernier).
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("pulse_surveys")
    .select("id, client_code, type, expires_at, closed_at, previous_score, slack_posted_at, clickup_commented_at")
    .eq("client_code", clientCode)
    .is("closed_at", null)
    .gt("expires_at", nowIso)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as SurveyRow | null) || null;
}

async function loadSurveyForCapture(
  supabase: SupabaseClient,
  surveyId: string,
  clientCode: string,
): Promise<SurveyRow | null> {
  const { data, error } = await supabase
    .from("pulse_surveys")
    .select("id, client_code, type, expires_at, closed_at, previous_score, slack_posted_at, clickup_commented_at")
    .eq("id", surveyId)
    .eq("client_code", clientCode)
    .maybeSingle();
  if (error) throw error;
  return (data as SurveyRow | null) || null;
}

async function postSlack(survey: SurveyRow, client: ClientRow, score: number): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) {
    console.warn("[pulse-frontend] SUPABASE_URL / SUPABASE_ANON_KEY manquants — skip slack");
    return false;
  }
  const badge = scoreBadge(score);
  const dropped = survey.previous_score != null && (survey.previous_score - score) >= TRAJECTORY_DROP;
  const emoji = dropped ? "🟠" : badge.emoji;
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const prev = survey.previous_score != null ? ` (dernier : ${survey.previous_score})` : "";
  const label = dropped ? `chute de ${survey.previous_score! - score} pt` : badge.label_fr;
  const hint = dropped ? "Priorité — trajectoire en baisse, call ASAP" : badge.hint_fr;
  const text = `${emoji} *Pulse ${typeLabel(survey.type)}* — *${clientDisplay}* — *${score}/10*${prev} — _${label}_\n> ${hint}`;

  try {
    const res = await fetch(`${supaUrl}/functions/v1/notify-slack-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    });
    if (!res.ok) {
      console.warn("[pulse-frontend] slack post failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pulse-frontend] slack post error", (e as Error).message);
    return false;
  }
}

async function commentClickUp(taskId: string, survey: SurveyRow, score: number): Promise<boolean> {
  const token = Deno.env.get("CLICKUP_API_TOKEN");
  if (!token) return false;
  const badge = scoreBadge(score);
  const dropped = survey.previous_score != null && (survey.previous_score - score) >= TRAJECTORY_DROP;
  const emoji = dropped ? "🟠" : badge.emoji;
  const prev = survey.previous_score != null ? ` (dernier : ${survey.previous_score})` : "";
  const hint = dropped ? "Priorité — trajectoire en baisse" : badge.hint_fr;
  const body = `${emoji} Pulse ${typeLabel(survey.type)} — ${score}/10${prev} — ${badge.label_fr}\n${hint}`;
  try {
    const res = await fetch(`${CLICKUP_ENDPOINT}/${taskId}/comment`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: body, notify_all: false }),
    });
    if (!res.ok) {
      console.warn("[pulse-frontend] clickup comment failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pulse-frontend] clickup comment error", (e as Error).message);
    return false;
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body allowed */ }

  const action = String(body.action ?? "").trim();
  const clientCode = normalizeCode(String(body.client_code ?? ""));

  if (!clientCode) return json({ error: "client_code_required" }, 400);

  // ─── LOOKUP : renvoie le pulse ouvert pour ce code client ─────────────────
  if (action === "lookup") {
    try {
      const client = await loadClient(supabase, clientCode);
      if (!client) return json({ ok: false, reason: "client_not_found" }, 404);

      const survey = await loadOpenSurvey(supabase, clientCode);
      if (!survey) {
        return json({
          ok: true,
          client: {
            client_code: client.client_code,
            display_name: client.company_name || client.client_name,
            language: client.client_language,
          },
          survey: null,
        });
      }

      // Existante réponse ? (permet de renvoyer directement le score au form verbatim)
      const { data: existing } = await supabase
        .from("pulse_responses")
        .select("score, verbatim")
        .eq("survey_id", survey.id)
        .maybeSingle();

      return json({
        ok: true,
        client: {
          client_code: client.client_code,
          display_name: client.company_name || client.client_name,
          language: client.client_language,
        },
        survey: {
          id: survey.id,
          type: survey.type,
          expires_at: survey.expires_at,
          previous_score: survey.previous_score,
        },
        response: existing ?? null,
      });
    } catch (e) {
      console.error("[pulse-frontend] lookup error", (e as Error).message);
      return json({ error: "lookup_failed", detail: (e as Error).message }, 500);
    }
  }

  // ─── CAPTURE : insère le score puis Slack + ClickUp ───────────────────────
  if (action === "capture") {
    const surveyId = String(body.survey_id ?? "").trim();
    const score = Number(body.score);
    if (!surveyId) return json({ error: "survey_id_required" }, 400);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return json({ error: "score_invalid" }, 400);
    }

    try {
      const survey = await loadSurveyForCapture(supabase, surveyId, clientCode);
      if (!survey) return json({ error: "survey_not_found_for_client" }, 404);
      if (new Date(survey.expires_at).getTime() < Date.now()) {
        return json({ error: "survey_expired" }, 410);
      }
      const client = await loadClient(supabase, clientCode);
      if (!client) return json({ error: "client_not_found" }, 404);

      const { error: insErr } = await supabase.from("pulse_responses").insert({
        survey_id: surveyId,
        score,
        source: "client_email_click",
      });
      const firstCapture = !insErr;
      if (insErr && !/duplicate/i.test(insErr.message || "")) {
        console.error("[pulse-frontend] insert response failed", insErr.message);
        return json({ error: "insert_failed", detail: insErr.message }, 500);
      }

      await supabase
        .from("pulse_surveys")
        .update({ closed_at: new Date().toISOString() })
        .eq("id", surveyId);

      let slackPosted = false;
      let clickupCommented = false;
      if (firstCapture) {
        if (!survey.slack_posted_at) {
          slackPosted = await postSlack(survey, client, score);
          if (slackPosted) {
            await supabase
              .from("pulse_surveys")
              .update({ slack_posted_at: new Date().toISOString() })
              .eq("id", surveyId);
          }
        }
        if (!survey.clickup_commented_at && client.clickup_task_id) {
          clickupCommented = await commentClickUp(client.clickup_task_id, survey, score);
          if (clickupCommented) {
            await supabase
              .from("pulse_surveys")
              .update({ clickup_commented_at: new Date().toISOString() })
              .eq("id", surveyId);
          }
        }
      }

      return json({
        ok: true,
        score,
        first_capture: firstCapture,
        slack_posted: slackPosted,
        clickup_commented: clickupCommented,
        clickup_task_missing: !client.clickup_task_id,
      });
    } catch (e) {
      console.error("[pulse-frontend] capture error", (e as Error).message);
      return json({ error: "capture_failed", detail: (e as Error).message }, 500);
    }
  }

  // ─── VERBATIM : update le champ verbatim de la réponse ────────────────────
  if (action === "verbatim") {
    const surveyId = String(body.survey_id ?? "").trim();
    const verbatim = String(body.verbatim ?? "").trim().slice(0, 1000);
    if (!surveyId) return json({ error: "survey_id_required" }, 400);
    if (!verbatim) return json({ ok: true, skipped: "empty" });

    try {
      const survey = await loadSurveyForCapture(supabase, surveyId, clientCode);
      if (!survey) return json({ error: "survey_not_found_for_client" }, 404);

      const { error: upErr } = await supabase
        .from("pulse_responses")
        .update({ verbatim, verbatim_at: new Date().toISOString() })
        .eq("survey_id", surveyId);
      if (upErr) {
        console.error("[pulse-frontend] verbatim update failed", upErr.message);
        return json({ error: "verbatim_update_failed", detail: upErr.message }, 500);
      }
      return json({ ok: true });
    } catch (e) {
      console.error("[pulse-frontend] verbatim error", (e as Error).message);
      return json({ error: "verbatim_failed", detail: (e as Error).message }, 500);
    }
  }

  return json({ error: "action_unknown", action }, 400);
});
