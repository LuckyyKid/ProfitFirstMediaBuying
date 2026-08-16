// pulse-nps-log — logue un NPS relationnel saisi manuellement par l'AM après
// un call stratégique / renewal. Crée en une seule opération :
//   1) une pulse_surveys type='relational' déjà fermée (expires_at=now,
//      closed_at=now, sent_channels=[], manual=true)
//   2) une pulse_responses avec le score + verbatim (source='nps_relational_manual')
//
// Puis applique les mêmes side-effects que pulse-response :
//   - Post Slack #head-of-things (règles couleur + trajectoire)
//   - Comment ClickUp sur client_progress.clickup_task_id (si présent)
//
// Body POST :
//   { client_code: string, score: 0-10, verbatim?: string, created_by?: string }
//
// Retour :
//   { ok, survey_id, response_id, slack_posted, clickup_commented }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKUP_ENDPOINT = "https://api.clickup.com/api/v2/task";
const SLACK_CHANNEL = "profile"; // #head-of-things
const TRAJECTORY_DROP = 2;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function scoreBadge(score: number): { emoji: string; label_fr: string; hint_fr: string } {
  if (score <= 6) return { emoji: "🔴", label_fr: "détracteur", hint_fr: "Call récupération 24-48h" };
  if (score <= 8) return { emoji: "🟡", label_fr: "passif", hint_fr: "Question au prochain weekly" };
  return { emoji: "🟢", label_fr: "promoteur", hint_fr: "Demander témoignage / référence" };
}

async function fetchTrajectory(
  sb: SupabaseClient,
  clientCode: string,
): Promise<{ previous_score: number | null; previous_survey_id: string | null }> {
  const { data, error } = await sb
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

async function postSlack(
  sb: SupabaseClient,
  client: { client_code: string; client_name: string | null; company_name: string | null },
  score: number,
  previous_score: number | null,
  verbatim: string | null,
): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) return false;

  const badge = scoreBadge(score);
  const dropped = previous_score != null && (previous_score - score) >= TRAJECTORY_DROP;
  const emoji = dropped ? "🟠" : badge.emoji;
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const prev = previous_score != null ? ` (dernier : ${previous_score})` : "";
  const label = dropped ? `chute de ${previous_score! - score} pt` : badge.label_fr;
  const hint = dropped ? "Priorité — trajectoire en baisse, call ASAP" : badge.hint_fr;
  const verbatimLine = verbatim && verbatim.trim() ? `\n> _"${verbatim.trim().slice(0, 240)}"_` : "";

  const text = `${emoji} *NPS relationnel (call)* — *${clientDisplay}* — *${score}/10*${prev} — _${label}_\n> ${hint}${verbatimLine}`;

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
    console.warn("[pulse-nps-log] slack error", (e as Error).message);
    return false;
  }
}

async function commentClickUp(
  taskId: string,
  score: number,
  previous_score: number | null,
  verbatim: string | null,
): Promise<boolean> {
  const token = Deno.env.get("CLICKUP_API_TOKEN");
  if (!token) return false;
  const badge = scoreBadge(score);
  const dropped = previous_score != null && (previous_score - score) >= TRAJECTORY_DROP;
  const emoji = dropped ? "🟠" : badge.emoji;
  const prev = previous_score != null ? ` (dernier : ${previous_score})` : "";
  const hint = dropped ? "Priorité — trajectoire en baisse" : badge.hint_fr;
  const verbatimLine = verbatim && verbatim.trim() ? `\nVerbatim : "${verbatim.trim().slice(0, 500)}"` : "";
  const body = `${emoji} NPS relationnel — ${score}/10${prev} — ${badge.label_fr}\n${hint}${verbatimLine}`;

  try {
    const res = await fetch(`${CLICKUP_ENDPOINT}/${taskId}/comment`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: body, notify_all: false }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[pulse-nps-log] clickup error", (e as Error).message);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const clientCode = String(body?.client_code ?? "").trim();
    const scoreRaw = body?.score;
    const verbatim = typeof body?.verbatim === "string" ? body.verbatim.trim() : null;
    const createdBy = typeof body?.created_by === "string" && body.created_by.trim()
      ? body.created_by.trim()
      : "admin_manual";

    if (!clientCode) {
      return new Response(JSON.stringify({ error: "client_code required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const score = Number(scoreRaw);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return new Response(JSON.stringify({ error: "score must be integer 0-10" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load client (need clickup_task_id + names)
    const { data: client, error: cliErr } = await sb
      .from("client_progress")
      .select("client_code, client_name, company_name, clickup_task_id")
      .eq("client_code", clientCode)
      .maybeSingle();
    if (cliErr) throw new Error(`client fetch: ${cliErr.message}`);
    if (!client) {
      return new Response(JSON.stringify({ error: `client_code not found: ${clientCode}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trajectory = await fetchTrajectory(sb, clientCode);
    const now = new Date().toISOString();

    // 1) INSERT survey (already closed)
    const { data: survey, error: sErr } = await sb
      .from("pulse_surveys")
      .insert({
        client_code: clientCode,
        type: "relational",
        token: generateToken(),
        sent_at: now,
        expires_at: now,
        closed_at: now,
        sent_channels: [],
        manual: true,
        created_by: createdBy,
        previous_score: trajectory.previous_score,
        previous_survey_id: trajectory.previous_survey_id,
      })
      .select("id")
      .single();
    if (sErr || !survey) throw new Error(`insert survey: ${sErr?.message ?? "no data"}`);
    const surveyId = survey.id as string;

    // 2) INSERT response
    const { data: response, error: rErr } = await sb
      .from("pulse_responses")
      .insert({
        survey_id: surveyId,
        score,
        verbatim: verbatim ? verbatim.slice(0, 1000) : null,
        verbatim_at: verbatim ? now : null,
        source: "nps_relational_manual",
      })
      .select("id")
      .single();
    if (rErr || !response) throw new Error(`insert response: ${rErr?.message ?? "no data"}`);

    // 3) Slack + ClickUp (avec guards)
    const slackOk = await postSlack(sb, client, score, trajectory.previous_score, verbatim);
    if (slackOk) {
      await sb.from("pulse_surveys").update({ slack_posted_at: now }).eq("id", surveyId);
    }
    let clickupOk = false;
    if (client.clickup_task_id) {
      clickupOk = await commentClickUp(client.clickup_task_id, score, trajectory.previous_score, verbatim);
      if (clickupOk) {
        await sb.from("pulse_surveys").update({ clickup_commented_at: now }).eq("id", surveyId);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        survey_id: surveyId,
        response_id: response.id,
        slack_posted: slackOk,
        clickup_commented: clickupOk,
        clickup_task_missing: !client.clickup_task_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[pulse-nps-log] error", (e as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
