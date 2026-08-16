// pulse-response — micro-page publique qui reçoit le clic score (0-10) depuis
// l'email/SMS, enregistre la réponse, affiche un formulaire verbatim optionnel,
// puis poste sur Slack (#head-of-things) + commente la tâche ClickUp du client.
//
// Endpoints :
//   GET  /pulse-response?token=X            → page picker (choisir 0-10)
//   GET  /pulse-response?token=X&score=N    → enregistre le score + form verbatim
//   POST /pulse-response?token=X (form: verbatim) → enregistre le verbatim
//
// Règles Slack (posté au 1er score capturé, jamais 2 fois) :
//   0-6   → 🔴 détracteur (call récupération 24-48h)
//   7-8   → 🟡 passif (question au prochain weekly)
//   9-10  → 🟢 promoteur (demande testimonial / référence)
//   Trajectoire ≥ 2 pts en baisse (vs previous_score) → 🟠 orange (prioritaire)
//
// ClickUp : commente la tâche client_progress.clickup_task_id (Level 1). Silence
// si la colonne n'est pas remplie (log warn — Tranche 5 la remplira).
//
// verify_jwt = false (voir config.toml) — c'est un lien public dans un email/SMS.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKUP_ENDPOINT = "https://api.clickup.com/api/v2/task";
const SLACK_CHANNEL = "profile"; // → SLACK_WEBHOOK_URL = #head-of-things
const TRAJECTORY_DROP = 2;

// TDIA palette (miroir de pulseTemplates.ts)
const BG = "#020617";
const CARD = "#0B1327";
const BORDER = "#1B294A";
const TEXT = "#FFFFFF";
const BODY_COL = "#C9D4EA";
const MUTED = "#8393B4";
const ACCENT = "#2E7BFF";
const ACCENT_SOFT = "#0F1E3D";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,Helvetica,Arial,sans-serif";

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

interface ExistingResponse {
  score: number;
  verbatim: string | null;
}

// ─── Utils ──────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeLang(l: string | null | undefined): Lang {
  if (!l) return "fr";
  return l.toLowerCase().startsWith("en") ? "en" : "fr";
}

function scoreBadge(score: number): {
  emoji: string;
  label_fr: string;
  label_en: string;
  hint_fr: string;
  hint_en: string;
} {
  if (score <= 6) {
    return {
      emoji: "🔴",
      label_fr: "détracteur",
      label_en: "detractor",
      hint_fr: "Call récupération 24-48h",
      hint_en: "Recovery call within 24-48h",
    };
  }
  if (score <= 8) {
    return {
      emoji: "🟡",
      label_fr: "passif",
      label_en: "passive",
      hint_fr: "Question au prochain weekly",
      hint_en: "Bring up at next weekly",
    };
  }
  return {
    emoji: "🟢",
    label_fr: "promoteur",
    label_en: "promoter",
    hint_fr: "Demander témoignage / référence",
    hint_en: "Ask for testimonial / referral",
  };
}

function typeLabel(t: SurveyRow["type"]): string {
  if (t === "onboarding") return "Onboarding J+7";
  if (t === "monthly") return "Pulse mensuel";
  return "NPS relationnel";
}

// ─── HTML shell + fragments ─────────────────────────────────────────────────
function renderPage(opts: {
  lang: Lang;
  title: string;
  heading: string;
  inner: string;
  status?: number;
}): Response {
  const { lang, title, heading, inner, status = 200 } = opts;
  const foot = lang === "en"
    ? "Thanks for your time. — TDIA"
    : "Merci pour ton temps. — TDIA";
  const html = `<!DOCTYPE html>
<html lang="${lang}"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${BODY_COL};font-family:${SANS};-webkit-font-smoothing:antialiased;min-height:100vh;">
<div style="max-width:560px;margin:0 auto;padding:44px 20px 60px;">
  <div style="text-align:center;font-size:22px;font-weight:800;color:${TEXT};letter-spacing:-0.02em;margin-bottom:28px;">TDIA<span style="color:${ACCENT};">.</span></div>
  <div style="background:${CARD};border:1px solid ${BORDER};border-radius:24px;padding:36px 30px;background-image:linear-gradient(180deg,${ACCENT_SOFT} 0%,${CARD} 60%);">
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:${TEXT};letter-spacing:-0.02em;">${esc(heading)}</h1>
    ${inner}
  </div>
  <p style="margin:22px 0 0;text-align:center;font-size:12px;color:${MUTED};">${esc(foot)}</p>
</div>
</body></html>`;
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function scoreGridPicker(token: string, lang: Lang): string {
  const cells = Array.from({ length: 11 }, (_, n) => {
    const url = `?token=${encodeURIComponent(token)}&score=${n}`;
    return `<a href="${url}" style="display:inline-block;width:44px;height:44px;line-height:44px;margin:4px;text-align:center;background:${BG};border:1px solid ${BORDER};border-radius:50%;color:${TEXT};font-size:16px;font-weight:700;text-decoration:none;">${n}</a>`;
  }).join("");
  const q = lang === "en"
    ? "Out of 10, how would you rate?"
    : "Sur 10, tu donnes combien ?";
  const legendLeft = lang === "en" ? "0 = not at all" : "0 = pas du tout";
  const legendRight = lang === "en" ? "10 = excellent" : "10 = excellent";
  return `
    <p style="margin:0 0 20px;color:${BODY_COL};font-size:15px;line-height:1.55;">${esc(q)}</p>
    <div style="text-align:center;">${cells}</div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:11px;color:${MUTED};letter-spacing:0.08em;">
      <span>${esc(legendLeft)}</span><span>${esc(legendRight)}</span>
    </div>`;
}

function verbatimPrompt(score: number, lang: Lang): string {
  if (lang === "en") {
    if (score <= 6) return "What's the biggest thing we should fix?";
    if (score <= 8) return "What would make it a 10?";
    return "What did we get right?";
  }
  if (score <= 6) return "Quelle est la plus grosse chose qu'on devrait corriger ?";
  if (score <= 8) return "Qu'est-ce qui te ferait mettre 10 ?";
  return "Qu'est-ce qu'on a réussi selon toi ?";
}

function verbatimForm(token: string, score: number, lang: Lang, alreadyHas: boolean): string {
  const q = verbatimPrompt(score, lang);
  const captured = lang === "en"
    ? `Got it — <strong>${score}/10</strong>. Optional: one line to help us.`
    : `Reçu — <strong>${score}/10</strong>. Optionnel : une ligne pour nous aider.`;
  const cta = lang === "en" ? "Send" : "Envoyer";
  const skip = lang === "en" ? "Skip — we're good" : "Je passe — merci quand même";
  const alreadyNote = alreadyHas
    ? (lang === "en"
      ? `<p style="margin:0 0 10px;color:${MUTED};font-size:12px;">You already left a note — this one will replace it.</p>`
      : `<p style="margin:0 0 10px;color:${MUTED};font-size:12px;">Tu as déjà laissé un mot — celui-ci le remplacera.</p>`)
    : "";
  return `
    <p style="margin:0 0 8px;color:${BODY_COL};font-size:15px;">${captured}</p>
    <p style="margin:0 0 14px;color:${MUTED};font-size:13px;line-height:1.55;">${esc(q)}</p>
    ${alreadyNote}
    <form method="POST" action="?token=${encodeURIComponent(token)}" style="margin:0;">
      <textarea name="verbatim" rows="4" maxlength="1000" placeholder="${esc(q)}" style="width:100%;box-sizing:border-box;background:${BG};color:${TEXT};border:1px solid ${BORDER};border-radius:12px;padding:12px 14px;font-family:${SANS};font-size:14px;line-height:1.55;resize:vertical;"></textarea>
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
        <button type="submit" style="background:${ACCENT};color:${TEXT};border:0;border-radius:12px;padding:12px 18px;font-family:${SANS};font-size:14px;font-weight:700;cursor:pointer;">${esc(cta)}</button>
        <a href="?token=${encodeURIComponent(token)}&done=1" style="text-align:center;color:${MUTED};font-size:12px;text-decoration:none;padding:8px;">${esc(skip)}</a>
      </div>
    </form>`;
}

function thankYou(lang: Lang, score?: number): string {
  const line1 = lang === "en" ? "Thanks — we heard you." : "Merci — c'est bien reçu.";
  let line2: string;
  if (score == null) {
    line2 = lang === "en" ? "That's it — you can close this tab." : "C'est tout — tu peux fermer l'onglet.";
  } else if (score <= 6) {
    line2 = lang === "en"
      ? "One of us will reach out in the next 48h."
      : "Un de nous te rappelle dans les prochaines 48h.";
  } else if (score >= 9) {
    line2 = lang === "en"
      ? "Really appreciated — makes the work worth it."
      : "Vraiment apprécié — ça donne du sens à ce qu'on fait.";
  } else {
    line2 = lang === "en"
      ? "We'll bring this up at the next weekly."
      : "On en parle au prochain weekly.";
  }
  return `
    <p style="margin:0 0 10px;font-size:16px;color:${TEXT};font-weight:600;">${esc(line1)}</p>
    <p style="margin:0;font-size:14px;color:${BODY_COL};line-height:1.55;">${esc(line2)}</p>`;
}

function closedMsg(lang: Lang): string {
  const t = lang === "en"
    ? "The response window has closed. Reach out anytime by replying to our last email."
    : "La fenêtre de réponse est fermée. Écris-nous quand tu veux en répondant à notre dernier courriel.";
  return `<p style="margin:0;color:${BODY_COL};font-size:14px;line-height:1.55;">${esc(t)}</p>`;
}

// ─── Slack + ClickUp side-effects ───────────────────────────────────────────
async function postSlack(
  survey: SurveyRow,
  client: ClientRow,
  score: number,
): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supaUrl || !anon) {
    console.warn("[pulse-response] SUPABASE_URL / SUPABASE_ANON_KEY manquants — skip slack");
    return false;
  }
  const badge = scoreBadge(score);
  const dropped = survey.previous_score != null && (survey.previous_score - score) >= TRAJECTORY_DROP;
  const emoji = dropped ? "🟠" : badge.emoji;
  const clientDisplay = client.company_name || client.client_name || client.client_code;
  const prev = survey.previous_score != null ? ` (dernier : ${survey.previous_score})` : "";
  const label = dropped
    ? `chute de ${survey.previous_score! - score} pt`
    : badge.label_fr;
  const hint = dropped
    ? "Priorité — trajectoire en baisse, call ASAP"
    : badge.hint_fr;

  const text = `${emoji} *Pulse ${typeLabel(survey.type)}* — *${clientDisplay}* — *${score}/10*${prev} — _${label}_\n> ${hint}`;

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
      console.warn("[pulse-response] slack post failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pulse-response] slack post error", (e as Error).message);
    return false;
  }
}

async function commentClickUp(
  taskId: string,
  survey: SurveyRow,
  score: number,
): Promise<boolean> {
  const token = Deno.env.get("CLICKUP_API_TOKEN");
  if (!token) {
    console.warn("[pulse-response] CLICKUP_API_TOKEN manquant — skip comment");
    return false;
  }
  const badge = scoreBadge(score);
  const dropped = survey.previous_score != null && (survey.previous_score - score) >= TRAJECTORY_DROP;
  const emoji = dropped ? "🟠" : badge.emoji;
  const prev = survey.previous_score != null ? ` (dernier : ${survey.previous_score})` : "";
  const hint = dropped ? "Priorité — trajectoire en baisse" : badge.hint_fr;
  const body = `${emoji} Pulse ${typeLabel(survey.type)} — ${score}/10${prev} — ${badge.label_fr}\n${hint}`;

  try {
    const res = await fetch(`${CLICKUP_ENDPOINT}/${taskId}/comment`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment_text: body, notify_all: false }),
    });
    if (!res.ok) {
      console.warn("[pulse-response] clickup comment failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pulse-response] clickup comment error", (e as Error).message);
    return false;
  }
}

// ─── DB loaders ─────────────────────────────────────────────────────────────
async function loadSurvey(supabase: SupabaseClient, token: string): Promise<SurveyRow | null> {
  const { data, error } = await supabase
    .from("pulse_surveys")
    .select("id, client_code, type, expires_at, closed_at, previous_score, slack_posted_at, clickup_commented_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as SurveyRow | null) || null;
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

async function loadResponse(supabase: SupabaseClient, surveyId: string): Promise<ExistingResponse | null> {
  const { data, error } = await supabase
    .from("pulse_responses")
    .select("score, verbatim")
    .eq("survey_id", surveyId)
    .maybeSingle();
  if (error) throw error;
  return (data as ExistingResponse | null) || null;
}

// ─── Handler ────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const scoreParam = url.searchParams.get("score");
  const done = url.searchParams.get("done") === "1";

  if (!token) {
    return renderPage({
      lang: "fr",
      title: "Lien invalide",
      heading: "Lien invalide",
      inner: `<p style="margin:0;color:${BODY_COL};font-size:14px;">Ce lien est incomplet. Contacte ton account manager.</p>`,
      status: 400,
    });
  }

  let survey: SurveyRow | null = null;
  let client: ClientRow | null = null;
  try {
    survey = await loadSurvey(supabase, token);
    if (survey) client = await loadClient(supabase, survey.client_code);
  } catch (e) {
    console.error("[pulse-response] db load error", (e as Error).message);
    return renderPage({
      lang: "fr",
      title: "Erreur",
      heading: "Un petit souci",
      inner: `<p style="margin:0;color:${BODY_COL};font-size:14px;">Impossible d'ouvrir ta réponse. Réessaie ou écris-nous.</p>`,
      status: 500,
    });
  }

  const lang: Lang = normalizeLang(client?.client_language ?? null);

  if (!survey) {
    return renderPage({
      lang,
      title: lang === "en" ? "Link not found" : "Lien introuvable",
      heading: lang === "en" ? "Link not found" : "Lien introuvable",
      inner: `<p style="margin:0;color:${BODY_COL};font-size:14px;line-height:1.55;">${
        lang === "en"
          ? "This link is either wrong or expired. Reach out to your account manager."
          : "Ce lien est erroné ou expiré. Contacte ton account manager."
      }</p>`,
      status: 404,
    });
  }

  const existing = await loadResponse(supabase, survey.id);
  const timeExpired = new Date(survey.expires_at).getTime() < Date.now();
  const heading_thanks_fr = "C'est envoyé";
  const heading_thanks_en = "You're all set";
  const title_thanks_fr = "Merci";
  const title_thanks_en = "Thanks";
  const closedHeading = lang === "en" ? "Too late — but thank you" : "Trop tard — mais merci";
  const closedTitle = lang === "en" ? "Window closed" : "Fenêtre fermée";

  // ─── POST : verbatim submission ────────────────────────────────────────────
  if (req.method === "POST") {
    if (!existing) {
      // Pas encore de score → renvoi au picker
      return renderPage({
        lang,
        title: lang === "en" ? "Pick a score first" : "Choisis d'abord un score",
        heading: lang === "en" ? "One more step" : "Encore une étape",
        inner: scoreGridPicker(token, lang),
      });
    }
    let verbatim = "";
    try {
      const form = await req.formData();
      verbatim = String(form.get("verbatim") || "").trim();
    } catch {
      try {
        const j = await req.json();
        verbatim = String(j?.verbatim || "").trim();
      } catch {
        /* ignore */
      }
    }
    if (verbatim) {
      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("pulse_responses")
        .update({ verbatim: verbatim.slice(0, 1000), verbatim_at: now })
        .eq("survey_id", survey.id);
      if (upErr) console.warn("[pulse-response] verbatim update failed", upErr.message);
    }
    return renderPage({
      lang,
      title: lang === "en" ? title_thanks_en : title_thanks_fr,
      heading: lang === "en" ? heading_thanks_en : heading_thanks_fr,
      inner: thankYou(lang, existing.score),
    });
  }

  // ─── GET ───────────────────────────────────────────────────────────────────
  if (done) {
    return renderPage({
      lang,
      title: lang === "en" ? title_thanks_en : title_thanks_fr,
      heading: lang === "en" ? heading_thanks_en : heading_thanks_fr,
      inner: thankYou(lang, existing?.score),
    });
  }

  // No score in URL
  if (scoreParam == null) {
    if (existing) {
      const h = lang === "en"
        ? `Got your ${existing.score}/10`
        : `Reçu ton ${existing.score}/10`;
      return renderPage({
        lang,
        title: lang === "en" ? "Already answered" : "Déjà répondu",
        heading: h,
        inner: verbatimForm(token, existing.score, lang, !!existing.verbatim),
      });
    }
    if (timeExpired) {
      return renderPage({
        lang,
        title: closedTitle,
        heading: closedHeading,
        inner: closedMsg(lang),
        status: 410,
      });
    }
    return renderPage({
      lang,
      title: lang === "en" ? "Your feedback" : "Ton feedback",
      heading: lang === "en" ? "One question" : "Une question",
      inner: scoreGridPicker(token, lang),
    });
  }

  // Score in URL
  const scoreNum = Number(scoreParam);
  if (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > 10) {
    return renderPage({
      lang,
      title: lang === "en" ? "Invalid score" : "Score invalide",
      heading: lang === "en" ? "Pick a number 0-10" : "Choisis un chiffre 0-10",
      inner: scoreGridPicker(token, lang),
      status: 400,
    });
  }

  // Already responded → show verbatim form for the recorded score (ignore URL score)
  if (existing) {
    const h = lang === "en"
      ? `Got your ${existing.score}/10`
      : `Reçu ton ${existing.score}/10`;
    return renderPage({
      lang,
      title: lang === "en" ? "Already answered" : "Déjà répondu",
      heading: h,
      inner: verbatimForm(token, existing.score, lang, !!existing.verbatim),
    });
  }

  if (timeExpired) {
    return renderPage({
      lang,
      title: closedTitle,
      heading: closedHeading,
      inner: closedMsg(lang),
      status: 410,
    });
  }

  // First score capture
  const { error: insErr } = await supabase.from("pulse_responses").insert({
    survey_id: survey.id,
    score: scoreNum,
    source: "client_email_click",
  });
  if (insErr && !/duplicate/i.test(insErr.message || "")) {
    console.error("[pulse-response] insert failed", insErr.message);
    return renderPage({
      lang,
      title: lang === "en" ? "Error" : "Erreur",
      heading: lang === "en" ? "Couldn't save it" : "Un souci d'enregistrement",
      inner: `<p style="margin:0;color:${BODY_COL};font-size:14px;">${
        lang === "en" ? "Please try again in a moment." : "Réessaie dans un instant."
      }</p>`,
      status: 500,
    });
  }
  const firstCapture = !insErr;

  // Marque la survey comme fermée (les futures ouvertures du lien montrent le
  // form verbatim avec le score existant, pas le picker).
  await supabase
    .from("pulse_surveys")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", survey.id);

  if (firstCapture && client) {
    if (!survey.slack_posted_at) {
      const ok = await postSlack(survey, client, scoreNum);
      if (ok) {
        await supabase
          .from("pulse_surveys")
          .update({ slack_posted_at: new Date().toISOString() })
          .eq("id", survey.id);
      }
    }
    if (!survey.clickup_commented_at && client.clickup_task_id) {
      const ok = await commentClickUp(client.clickup_task_id, survey, scoreNum);
      if (ok) {
        await supabase
          .from("pulse_surveys")
          .update({ clickup_commented_at: new Date().toISOString() })
          .eq("id", survey.id);
      }
    } else if (!client.clickup_task_id) {
      console.warn(`[pulse-response] client ${client.client_code} sans clickup_task_id — skip comment (Tranche 5 remplira)`);
    }
  }

  const h = lang === "en" ? `Got your ${scoreNum}/10` : `Reçu ton ${scoreNum}/10`;
  return renderPage({
    lang,
    title: lang === "en" ? title_thanks_en : title_thanks_fr,
    heading: h,
    inner: verbatimForm(token, scoreNum, lang, false),
  });
});
