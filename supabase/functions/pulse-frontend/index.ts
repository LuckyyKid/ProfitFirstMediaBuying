// pulse-frontend — JSON API pour la page /pulse de l'app React.
// Le client entre son code client sur la page, cette function :
//   - action="lookup"        → renvoie le pulse ouvert le plus récent pour ce code
//   - action="capture"       → insère la réponse (score), post Slack, comment ClickUp
//   - action="communication" → update communication_score (onboarding only), post Slack complémentaire
//   - action="verbatim"      → update le verbatim de la réponse déjà capturée
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
  type: "onboarding" | "monthly" | "relational" | "weekly";
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
  if (t === "weekly") return "Pulse hebdo (meeting)";
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

// Lookup désambiguïsé par token — utilisé quand le client arrive avec ?t=<token>
// dans l'URL (envoyé dans le lien email/SMS). Élimine la collision quand
// plusieurs pulses sont ouverts en parallèle (ex: weekly + monthly).
// Validation client_code + token : empêche le spoof (il faut connaître les 2).
async function loadOpenSurveyByToken(
  supabase: SupabaseClient,
  clientCode: string,
  token: string,
): Promise<SurveyRow | null> {
  const { data, error } = await supabase
    .from("pulse_surveys")
    .select("id, client_code, type, expires_at, closed_at, previous_score, slack_posted_at, clickup_commented_at")
    .eq("client_code", clientCode)
    .eq("token", token)
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

async function postCommunicationSlack(survey: SurveyRow, client: ClientRow, commScore: number): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) return false;
  const badge = scoreBadge(commScore);
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const hint = commScore <= 6
    ? "Signal communication faible — revoir cadence / clarté / responsiveness"
    : commScore <= 8
    ? "Communication passable — potentiel d'ajustement"
    : "Communication perçue comme forte — capitaliser sur ce qui a marché";
  const text = `${badge.emoji} *Communication onboarding* — *${clientDisplay}* — *${commScore}/10* — _${badge.label_fr}_\n> ${hint}`;
  try {
    const res = await fetch(`${supaUrl}/functions/v1/notify-slack-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    });
    return res.ok;
  } catch {
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
  // Si `token` fourni (via ?t=<token> dans l'URL) → lookup désambiguïsé sur
  // (client_code, token). Sinon fallback : le pulse ouvert le plus récent
  // pour ce client (peut collisionner si plusieurs types en parallèle).
  if (action === "lookup") {
    try {
      const client = await loadClient(supabase, clientCode);
      if (!client) return json({ ok: false, reason: "client_not_found" }, 404);

      const token = String(body.token ?? "").trim();
      const survey = token
        ? await loadOpenSurveyByToken(supabase, clientCode, token)
        : await loadOpenSurvey(supabase, clientCode);
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
        .select(`
          score, communication_score, verbatim,
          nps_score, confidence_next_month, collab_health,
          improvement_one_thing, keep_doing, difficulties, difficulties_other,
          business_impact, next_month_priority, next_month_priority_other,
          monthly_completed_at,
          weekly_pace_score, weekly_blocker, weekly_next_priority, weekly_completed_at
        `)
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

  // ─── COMMUNICATION : update le communication_score (onboarding only) ─────
  if (action === "communication") {
    const surveyId = String(body.survey_id ?? "").trim();
    const commScore = Number(body.communication_score);
    if (!surveyId) return json({ error: "survey_id_required" }, 400);
    if (!Number.isInteger(commScore) || commScore < 0 || commScore > 10) {
      return json({ error: "communication_score_invalid" }, 400);
    }

    try {
      const survey = await loadSurveyForCapture(supabase, surveyId, clientCode);
      if (!survey) return json({ error: "survey_not_found_for_client" }, 404);
      if (survey.type !== "onboarding") {
        return json({ error: "communication_score_only_for_onboarding" }, 400);
      }

      const { error: upErr } = await supabase
        .from("pulse_responses")
        .update({ communication_score: commScore })
        .eq("survey_id", surveyId);
      if (upErr) {
        console.error("[pulse-frontend] communication update failed", upErr.message);
        return json({ error: "communication_update_failed", detail: upErr.message }, 500);
      }

      const client = await loadClient(supabase, clientCode);
      let slackPosted = false;
      if (client) {
        slackPosted = await postCommunicationSlack(survey, client, commScore);
      }
      return json({ ok: true, communication_score: commScore, slack_posted: slackPosted });
    } catch (e) {
      console.error("[pulse-frontend] communication error", (e as Error).message);
      return json({ error: "communication_failed", detail: (e as Error).message }, 500);
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

  // ─── MONTHLY_ANSWERS : batch update (partiel ok) des champs Q2-Q10 ────────
  // Utilisé par le formulaire mensuel structuré (10 questions). Appelé à
  // chaque étape pour autosave — accepte n'importe quel sous-ensemble des
  // champs. Si finalize=true (typiquement au submit de Q10), on horodate
  // monthly_completed_at et on poste un récap enrichi sur Slack.
  if (action === "monthly_answers") {
    const surveyId = String(body.survey_id ?? "").trim();
    if (!surveyId) return json({ error: "survey_id_required" }, 400);

    try {
      const survey = await loadSurveyForCapture(supabase, surveyId, clientCode);
      if (!survey) return json({ error: "survey_not_found_for_client" }, 404);
      if (survey.type !== "monthly") {
        return json({ error: "monthly_answers_only_for_monthly" }, 400);
      }

      const patch: Record<string, unknown> = {};

      const nps = body.nps_score;
      if (nps !== undefined && nps !== null) {
        const n = Number(nps);
        if (!Number.isInteger(n) || n < 0 || n > 10) return json({ error: "nps_score_invalid" }, 400);
        patch.nps_score = n;
      }

      const conf = body.confidence_next_month;
      if (conf !== undefined && conf !== null) {
        const n = Number(conf);
        if (!Number.isInteger(n) || n < 1 || n > 5) return json({ error: "confidence_invalid" }, 400);
        patch.confidence_next_month = n;
      }

      const collab = body.collab_health;
      if (collab !== undefined && collab !== null) {
        const v = String(collab);
        if (!["very_healthy", "good", "fragile", "at_risk"].includes(v)) {
          return json({ error: "collab_health_invalid" }, 400);
        }
        patch.collab_health = v;
      }

      const improvement = body.improvement_one_thing;
      if (improvement !== undefined) {
        patch.improvement_one_thing = String(improvement ?? "").trim().slice(0, 500) || null;
      }

      const keep = body.keep_doing;
      if (keep !== undefined) {
        patch.keep_doing = String(keep ?? "").trim().slice(0, 1000) || null;
      }

      const diffs = body.difficulties;
      if (diffs !== undefined) {
        if (diffs === null) {
          patch.difficulties = null;
        } else if (Array.isArray(diffs)) {
          const allowed = ["communication", "creative_quality", "creative_volume", "strategy",
                           "timelines", "reporting", "brand_understanding", "other"];
          const cleaned = diffs.map(String).filter((x) => allowed.includes(x));
          patch.difficulties = cleaned.length ? cleaned : null;
        } else {
          return json({ error: "difficulties_invalid" }, 400);
        }
      }

      const diffsOther = body.difficulties_other;
      if (diffsOther !== undefined) {
        patch.difficulties_other = String(diffsOther ?? "").trim().slice(0, 500) || null;
      }

      const impact = body.business_impact;
      if (impact !== undefined && impact !== null) {
        const n = Number(impact);
        if (!Number.isInteger(n) || n < 1 || n > 5) return json({ error: "business_impact_invalid" }, 400);
        patch.business_impact = n;
      }

      const prio = body.next_month_priority;
      if (prio !== undefined && prio !== null) {
        const v = String(prio);
        if (!["volume", "profitability", "test_angles", "creatives",
              "foundation", "stabilize", "other"].includes(v)) {
          return json({ error: "next_month_priority_invalid" }, 400);
        }
        patch.next_month_priority = v;
      }

      const prioOther = body.next_month_priority_other;
      if (prioOther !== undefined) {
        patch.next_month_priority_other = String(prioOther ?? "").trim().slice(0, 500) || null;
      }

      const verbatim = body.verbatim;
      if (verbatim !== undefined) {
        const v = String(verbatim ?? "").trim().slice(0, 2000);
        patch.verbatim = v || null;
        if (v) patch.verbatim_at = new Date().toISOString();
      }

      const finalize = body.finalize === true;
      if (finalize) patch.monthly_completed_at = new Date().toISOString();

      if (Object.keys(patch).length === 0) return json({ ok: true, skipped: "empty" });

      const { error: upErr } = await supabase
        .from("pulse_responses")
        .update(patch)
        .eq("survey_id", surveyId);
      if (upErr) {
        console.error("[pulse-frontend] monthly_answers update failed", upErr.message);
        return json({ error: "monthly_answers_update_failed", detail: upErr.message }, 500);
      }

      // Récap Slack enrichi seulement à la finalisation (une fois par survey)
      let recapPosted = false;
      if (finalize) {
        const client = await loadClient(supabase, clientCode);
        if (client) recapPosted = await postMonthlyRecapSlack(supabase, survey, client);
      }

      return json({ ok: true, finalized: finalize, recap_posted: recapPosted });
    } catch (e) {
      console.error("[pulse-frontend] monthly_answers error", (e as Error).message);
      return json({ error: "monthly_answers_failed", detail: (e as Error).message }, 500);
    }
  }

  // ─── WEEKLY_ANSWERS : batch upsert des 4 champs du weekly ────────────────
  // Contrairement au monthly, le weekly n'a PAS de capture préalable — la 1re
  // question du form (weekly_pace_score) est stockée directement ici. On upsert
  // sur survey_id (UNIQUE). Sur finalize=true, on horodate weekly_completed_at,
  // on ferme la survey et on poste un récap Slack.
  if (action === "weekly_answers") {
    const surveyId = String(body.survey_id ?? "").trim();
    if (!surveyId) return json({ error: "survey_id_required" }, 400);

    try {
      const survey = await loadSurveyForCapture(supabase, surveyId, clientCode);
      if (!survey) return json({ error: "survey_not_found_for_client" }, 404);
      if (survey.type !== "weekly") {
        return json({ error: "weekly_answers_only_for_weekly" }, 400);
      }
      if (new Date(survey.expires_at).getTime() < Date.now()) {
        return json({ error: "survey_expired" }, 410);
      }

      const patch: Record<string, unknown> = {};

      const pace = body.weekly_pace_score;
      if (pace !== undefined && pace !== null) {
        const n = Number(pace);
        if (!Number.isInteger(n) || n < 1 || n > 5) return json({ error: "weekly_pace_score_invalid" }, 400);
        patch.weekly_pace_score = n;
      }

      const verbatim = body.verbatim;
      if (verbatim !== undefined) {
        const v = String(verbatim ?? "").trim().slice(0, 1000);
        patch.verbatim = v || null;
        if (v) patch.verbatim_at = new Date().toISOString();
      }

      const blocker = body.weekly_blocker;
      if (blocker !== undefined) {
        patch.weekly_blocker = String(blocker ?? "").trim().slice(0, 2000) || null;
      }

      const nextPrio = body.weekly_next_priority;
      if (nextPrio !== undefined) {
        patch.weekly_next_priority = String(nextPrio ?? "").trim().slice(0, 500) || null;
      }

      const finalize = body.finalize === true;
      if (finalize) patch.weekly_completed_at = new Date().toISOString();

      if (Object.keys(patch).length === 0) return json({ ok: true, skipped: "empty" });

      // Upsert sur survey_id (UNIQUE). Sur premier appel c'est un INSERT, sinon UPDATE.
      const { error: upErr } = await supabase
        .from("pulse_responses")
        .upsert({
          survey_id: surveyId,
          source: "client_email_click",
          ...patch,
        }, { onConflict: "survey_id" });
      if (upErr) {
        console.error("[pulse-frontend] weekly_answers upsert failed", upErr.message);
        return json({ error: "weekly_answers_update_failed", detail: upErr.message }, 500);
      }

      // Sur finalize : ferme la survey + poste le récap Slack (une seule fois)
      let recapPosted = false;
      if (finalize) {
        await supabase
          .from("pulse_surveys")
          .update({ closed_at: new Date().toISOString() })
          .eq("id", surveyId);

        if (!survey.slack_posted_at) {
          const client = await loadClient(supabase, clientCode);
          if (client) {
            recapPosted = await postWeeklyRecapSlack(supabase, survey, client);
            if (recapPosted) {
              await supabase
                .from("pulse_surveys")
                .update({ slack_posted_at: new Date().toISOString() })
                .eq("id", surveyId);
            }
          }
        }
      }

      return json({ ok: true, finalized: finalize, recap_posted: recapPosted });
    } catch (e) {
      console.error("[pulse-frontend] weekly_answers error", (e as Error).message);
      return json({ error: "weekly_answers_failed", detail: (e as Error).message }, 500);
    }
  }

  return json({ error: "action_unknown", action }, 400);
});

// ─── Slack recap enrichi (posté une seule fois à la finalisation du mensuel) ─
const COLLAB_LABEL_FR: Record<string, string> = {
  very_healthy: "Très sain (aucune inquiétude)",
  good: "Bon (quelques ajustements)",
  fragile: "Fragile (action rapide requise)",
  at_risk: "À risque (préoccupations sérieuses)",
};
const PRIORITY_LABEL_FR: Record<string, string> = {
  volume: "Augmenter le volume",
  profitability: "Améliorer la rentabilité",
  test_angles: "Tester nouveaux angles / messages / offres",
  creatives: "Produire plus / meilleures créas",
  foundation: "Améliorer les fondations (LP, tracking, data)",
  stabilize: "Stabiliser la performance",
  other: "Autre",
};
const DIFF_LABEL_FR: Record<string, string> = {
  communication: "Communication / réactivité",
  creative_quality: "Qualité créative",
  creative_volume: "Volume de créas",
  strategy: "Stratégie",
  timelines: "Délais / exécution",
  reporting: "Reporting",
  brand_understanding: "Compréhension marque",
  other: "Autre",
};

async function postMonthlyRecapSlack(
  supabase: SupabaseClient,
  survey: SurveyRow,
  client: ClientRow,
): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) return false;

  const { data: resp } = await supabase
    .from("pulse_responses")
    .select("score, nps_score, confidence_next_month, collab_health, business_impact, next_month_priority, next_month_priority_other, difficulties, difficulties_other, improvement_one_thing, keep_doing, verbatim")
    .eq("survey_id", survey.id)
    .maybeSingle();
  if (!resp) return false;

  const r = resp as Record<string, unknown>;
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const collabRaw = (r.collab_health ?? "") as string;
  const collabLabel = COLLAB_LABEL_FR[collabRaw] ?? "—";
  const collabEmoji = collabRaw === "at_risk" ? "🚨"
                    : collabRaw === "fragile" ? "⚠️"
                    : collabRaw === "good" ? "🟡" : "🟢";

  const prioRaw = (r.next_month_priority ?? "") as string;
  const prioLabel = prioRaw === "other"
    ? `Autre — ${String(r.next_month_priority_other ?? "").trim() || "(non précisé)"}`
    : (PRIORITY_LABEL_FR[prioRaw] ?? "—");

  const diffCodes = Array.isArray(r.difficulties) ? (r.difficulties as string[]) : [];
  const diffLabels = diffCodes
    .filter((c) => c !== "other")
    .map((c) => DIFF_LABEL_FR[c] ?? c);
  if (diffCodes.includes("other") && String(r.difficulties_other ?? "").trim()) {
    diffLabels.push(`Autre — ${String(r.difficulties_other).trim()}`);
  }
  const diffLine = diffLabels.length ? diffLabels.join(", ") : "aucune signalée";

  const sat = r.score != null ? `${r.score}/10` : "—";
  const nps = r.nps_score != null ? `${r.nps_score}/10` : "—";
  const conf = r.confidence_next_month != null ? `${r.confidence_next_month}/5` : "—";
  const impact = r.business_impact != null ? `${r.business_impact}/5` : "—";

  const parts: string[] = [];
  parts.push(`${collabEmoji} *Pulse mensuel complet* — *${clientDisplay}*`);
  parts.push(`> Satisfaction ${sat} · NPS ${nps} · Confiance ${conf} · Impact business ${impact}`);
  parts.push(`> État collab : *${collabLabel}*`);
  parts.push(`> Priorité mois prochain : *${prioLabel}*`);
  parts.push(`> Difficultés : ${diffLine}`);
  const improvement = String(r.improvement_one_thing ?? "").trim();
  if (improvement) parts.push(`> _À améliorer :_ "${improvement}"`);
  const keep = String(r.keep_doing ?? "").trim();
  if (keep) parts.push(`> _À garder :_ "${keep.slice(0, 200)}${keep.length > 200 ? "…" : ""}"`);
  const verb = String(r.verbatim ?? "").trim();
  if (verb) parts.push(`> _Raison du score :_ "${verb.slice(0, 240)}${verb.length > 240 ? "…" : ""}"`);

  try {
    const res = await fetch(`${supaUrl}/functions/v1/notify-slack-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text: parts.join("\n") }),
    });
    if (!res.ok) {
      console.warn("[pulse-frontend] monthly recap slack failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pulse-frontend] monthly recap slack error", (e as Error).message);
    return false;
  }
}

// ─── Slack recap weekly (posté une seule fois à la finalisation du form 4 Q) ─
async function postWeeklyRecapSlack(
  supabase: SupabaseClient,
  survey: SurveyRow,
  client: ClientRow,
): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) return false;

  const { data: resp } = await supabase
    .from("pulse_responses")
    .select("weekly_pace_score, verbatim, weekly_blocker, weekly_next_priority")
    .eq("survey_id", survey.id)
    .maybeSingle();
  if (!resp) return false;

  const r = resp as Record<string, unknown>;
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const paceRaw = r.weekly_pace_score as number | null | undefined;
  const pace = paceRaw ?? null;
  const paceEmoji = pace == null ? "⚪️"
                  : pace <= 2 ? "🔴"
                  : pace === 3 ? "🟡"
                  : "🟢";
  const paceStr = pace == null ? "—" : `${pace}/5`;
  const blocker = String(r.weekly_blocker ?? "").trim();
  const blockerLine = blocker
    ? `> _Blocker :_ "${blocker.slice(0, 300)}${blocker.length > 300 ? "…" : ""}"`
    : "> _Blocker :_ aucun signalé";
  const reason = String(r.verbatim ?? "").trim();
  const nextPrio = String(r.weekly_next_priority ?? "").trim();

  const parts: string[] = [];
  parts.push(`${paceEmoji} *Pulse hebdo (meeting)* — *${clientDisplay}* — pace ${paceStr}`);
  if (reason) parts.push(`> _Raison :_ "${reason.slice(0, 240)}${reason.length > 240 ? "…" : ""}"`);
  parts.push(blockerLine);
  if (nextPrio) parts.push(`> _Priorité semaine prochaine :_ ${nextPrio.slice(0, 240)}${nextPrio.length > 240 ? "…" : ""}`);
  if (pace != null && pace <= 2) {
    parts.push(`> ⚠️ Pace faible — à adresser au meeting.`);
  }

  try {
    const res = await fetch(`${supaUrl}/functions/v1/notify-slack-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text: parts.join("\n") }),
    });
    if (!res.ok) {
      console.warn("[pulse-frontend] weekly recap slack failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pulse-frontend] weekly recap slack error", (e as Error).message);
    return false;
  }
}
