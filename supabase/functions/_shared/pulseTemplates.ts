// Client Pulse System — templates courriels + SMS.
//
// Le client reçoit un courriel/SMS qui l'invite à ouvrir la page /pulse de l'app.
// Sur cette page il doit saisir son code client (affiché en gros dans le
// courriel + rappelé dans le SMS) pour accéder au picker de score puis au
// verbatim. Les liens pointent tous vers `${appUrl}/pulse`.
//
// URL principale : ${appUrl}/pulse?code=${client_code}&t=${token}
// - `code` : pré-remplissage du code client (confort — la page marche aussi
//   si le client le colle manuellement).
// - `t`   : token du pulse_surveys — sert à désambiguïser quand plusieurs
//   pulses sont ouverts en parallèle pour le même client (ex: weekly + monthly).
//   Sans token, le lookup tombe sur le pulse le plus récent = collision possible.

import { esc, normalizeLang, type Lang } from "./email-design.ts";

export type PulseType = "onboarding" | "monthly" | "relational" | "weekly";
export type PulseVariant = "initial" | "followup";

export interface PulseTemplateParams {
  type: PulseType;
  variant?: PulseVariant;      // défaut = "initial"
  firstName?: string | null;
  clientName?: string | null;  // fallback si pas de prénom
  companyName?: string | null;
  clientCode: string;          // affiché en gros dans l'email + rappelé en SMS
  appUrl: string;              // base de l'app frontend (ex: https://tdiaonboarding.lovable.app)
  language?: string | null;
  token?: string | null;       // token de survey — ajouté en query (?t=) pour désambiguïser si plusieurs pulses ouverts
}

// TDIA palette (miroir de email-design.ts pour cohérence visuelle).
const BG = "#020617";
const CARD = "#0B1327";
const CARD_GLASS = "#111E3A";
const BORDER = "#1B294A";
const TEXT = "#FFFFFF";
const BODY = "#C9D4EA";
const MUTED = "#8393B4";
const DIM = "#556485";
const ACCENT = "#2E7BFF";
const ACCENT_HOVER = "#4A8DFF";
const ACCENT_SOFT = "#0F1E3D";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,Helvetica,Arial,sans-serif";

// ─── Copies éditables — modifier ici pour changer le ton ───────────────────
export const PULSE_COPY: Record<Lang, Record<PulseType, Record<PulseVariant, {
  subject: (name: string) => string;
  headline: string;
  question: string;
  cta: string;
  codeIntro: string;
  microNote: string;
}>>> = {
  fr: {
    onboarding: {
      initial: {
        subject: () => "Ta 1re semaine chez TDIA — comment ça s'est passé ?",
        headline: "Ta 1re semaine est faite.",
        question: "Sur 10, comment ça s'est passé ?",
        cta: "Répondre en 10 secondes",
        codeIntro: "Ton ID client (déjà pré-rempli dans le lien) :",
        microNote: "10 secondes, promis.",
      },
      followup: {
        subject: () => "Petit rappel — 10 secondes",
        headline: "Petit rappel.",
        question: "On aimerait avoir ton retour, ça ne prend que 10 secondes.",
        cta: "Répondre maintenant",
        codeIntro: "Ton ID client (déjà pré-rempli dans le lien) :",
        microNote: "10 secondes, c'est tout.",
      },
    },
    monthly: {
      initial: {
        subject: (name) => `${name ? name + ", " : ""}ton feedback du mois — 10 secondes`,
        headline: "Le mois avec nous.",
        question: "Sur 10, comment s'est passé le dernier mois avec nous ?",
        cta: "Répondre en 10 secondes",
        codeIntro: "Ton ID client (déjà pré-rempli dans le lien) :",
        microNote: "10 secondes, promis.",
      },
      followup: {
        subject: () => "Petit rappel — 10 secondes",
        headline: "Petit rappel.",
        question: "On aimerait avoir ton retour, ça ne prend que 10 secondes.",
        cta: "Répondre maintenant",
        codeIntro: "Ton ID client (déjà pré-rempli dans le lien) :",
        microNote: "10 secondes, c'est tout.",
      },
    },
    // relational : jamais envoyé par email (logué manuellement par l'AM).
    // Copies conservées pour cohérence si on veut un jour l'automatiser.
    relational: {
      initial: {
        subject: () => "Merci pour l'échange",
        headline: "Une question.",
        question: "Sur 10, à quel point recommanderais-tu TDIA à un pair ?",
        cta: "Répondre en 20 secondes",
        codeIntro: "Ton code client :",
        microNote: "Ça prend 20 secondes.",
      },
      followup: {
        subject: () => "Juste 20 secondes",
        headline: "Petit rappel.",
        question: "Sur 10, à quel point recommanderais-tu TDIA ?",
        cta: "Répondre maintenant",
        codeIntro: "Ton code client :",
        microNote: "Ton avis compte.",
      },
    },
    // weekly : déclenché à la création d'un meeting (webhook externe). Court
    // formulaire de 4 questions — se concentre sur la semaine qui vient de passer.
    weekly: {
      initial: {
        subject: (name) => `${name ? name + ", " : ""}ton point rapide de la semaine — 30 secondes`,
        headline: "Ta semaine avec nous.",
        question: "Comment ça a avancé cette semaine ? On veut ton ressenti avant notre prochain meeting.",
        cta: "Répondre en 30 secondes",
        codeIntro: "Ton ID client (déjà pré-rempli dans le lien) :",
        microNote: "4 questions, 30 secondes.",
      },
      followup: {
        subject: () => "Petit rappel — 30 secondes avant le meeting",
        headline: "Petit rappel.",
        question: "On aimerait avoir ton point de la semaine avant qu'on se voie — 30 secondes.",
        cta: "Répondre maintenant",
        codeIntro: "Ton ID client (déjà pré-rempli dans le lien) :",
        microNote: "30 secondes, c'est tout.",
      },
    },
  },
  en: {
    onboarding: {
      initial: {
        subject: () => "Your 1st week at TDIA — how did it go?",
        headline: "Your 1st week is done.",
        question: "Out of 10, how did it go?",
        cta: "Answer in 10 seconds",
        codeIntro: "Your client ID (already pre-filled in the link):",
        microNote: "10 seconds, promise.",
      },
      followup: {
        subject: () => "Quick reminder — 10 seconds",
        headline: "Quick reminder.",
        question: "We'd love your feedback — it only takes 10 seconds.",
        cta: "Answer now",
        codeIntro: "Your client ID (already pre-filled in the link):",
        microNote: "10 seconds, that's it.",
      },
    },
    monthly: {
      initial: {
        subject: (name) => `${name ? name + ", " : ""}your monthly feedback — 10 seconds`,
        headline: "This past month with us.",
        question: "Out of 10, how was this past month with us?",
        cta: "Answer in 10 seconds",
        codeIntro: "Your client ID (already pre-filled in the link):",
        microNote: "10 seconds, promise.",
      },
      followup: {
        subject: () => "Quick reminder — 10 seconds",
        headline: "Quick reminder.",
        question: "We'd love your feedback — it only takes 10 seconds.",
        cta: "Answer now",
        codeIntro: "Your client ID (already pre-filled in the link):",
        microNote: "10 seconds, that's it.",
      },
    },
    relational: {
      initial: {
        subject: () => "Thanks for the call",
        headline: "One question.",
        question: "Out of 10, how likely are you to recommend TDIA to a peer?",
        cta: "Answer in 20 seconds",
        codeIntro: "Your client code:",
        microNote: "20 seconds.",
      },
      followup: {
        subject: () => "Just 20 seconds",
        headline: "Quick reminder.",
        question: "Out of 10, how likely are you to recommend TDIA?",
        cta: "Answer now",
        codeIntro: "Your client code:",
        microNote: "Your input matters.",
      },
    },
    weekly: {
      initial: {
        subject: (name) => `${name ? name + ", " : ""}your quick weekly check-in — 30 seconds`,
        headline: "Your week with us.",
        question: "How did things move this week? We want your read before our next meeting.",
        cta: "Answer in 30 seconds",
        codeIntro: "Your client ID (already pre-filled in the link):",
        microNote: "4 questions, 30 seconds.",
      },
      followup: {
        subject: () => "Quick reminder — 30 seconds before the meeting",
        headline: "Quick reminder.",
        question: "We'd love your weekly read before we meet — takes 30 seconds.",
        cta: "Answer now",
        codeIntro: "Your client ID (already pre-filled in the link):",
        microNote: "30 seconds, that's it.",
      },
    },
  },
};

export const PULSE_SMS_COPY: Record<Lang, Record<PulseType, Record<PulseVariant, (name: string, code: string, url: string) => string>>> = {
  fr: {
    onboarding: {
      initial: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. Tu viens de terminer ta 1re semaine avec nous — sur 10, comment ça s'est passé ? Ça prend 10 secondes. Ton ID client (${code}) est déjà pré-rempli dans le lien. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. Petit rappel — on aimerait avoir ton retour, ça ne prend que 10 secondes. Ton ID client : ${code} (déjà pré-rempli dans le lien). Réponds ici : ${url}`,
    },
    monthly: {
      initial: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. Sur 10, comment s'est passé le dernier mois avec nous ? Ça prend 10 secondes. Ton ID client (${code}) est déjà pré-rempli dans le lien. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. Petit rappel — on aimerait avoir ton retour, ça ne prend que 10 secondes. Ton ID client : ${code} (déjà pré-rempli dans le lien). Réponds ici : ${url}`,
    },
    relational: {
      initial: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. 20 secondes pour ton feedback NPS. Ton ID client : ${code}. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA — petit rappel. Ton ID client : ${code}. ${url}`,
    },
    weekly: {
      initial: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. Ton point rapide de la semaine avant notre prochain meeting — 4 questions, 30 secondes. Ton ID client (${code}) est déjà pré-rempli dans le lien. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut${n ? " " + n : ""}, c'est l'équipe TDIA. Petit rappel — 30 secondes pour ton point de la semaine avant qu'on se voie. Ton ID client : ${code} (déjà pré-rempli). Réponds ici : ${url}`,
    },
  },
  en: {
    onboarding: {
      initial: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. You've completed your first week with us — out of 10, how did it go? It takes 10 seconds. Your client ID (${code}) is already pre-filled in the link. Just tap here: ${url}`,
      followup: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. Quick reminder — we'd love your feedback, it only takes 10 seconds. Your client ID: ${code} (already pre-filled in the link). Just tap here: ${url}`,
    },
    monthly: {
      initial: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. Out of 10, how was this past month with us? It takes 10 seconds. Your client ID (${code}) is already pre-filled in the link. Just tap here: ${url}`,
      followup: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. Quick reminder — we'd love your feedback, it only takes 10 seconds. Your client ID: ${code} (already pre-filled in the link). Just tap here: ${url}`,
    },
    relational: {
      initial: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. 20 seconds for your NPS feedback. Your client ID: ${code}. Answer here: ${url}`,
      followup: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team — quick reminder. Your client ID: ${code}. ${url}`,
    },
    weekly: {
      initial: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. Quick weekly check-in before our next meeting — 4 questions, 30 seconds. Your client ID (${code}) is already pre-filled in the link. Just tap here: ${url}`,
      followup: (n, code, url) => `Hi${n ? " " + n : ""}, it's the TDIA team. Quick reminder — 30 seconds for your weekly read before we meet. Your client ID: ${code} (already pre-filled). Just tap here: ${url}`,
    },
  },
};

function firstNameFrom(params: PulseTemplateParams): string {
  const raw = (params.firstName || params.clientName || "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0];
}

function pulsePageUrl(appUrl: string, clientCode: string, token?: string | null): string {
  const base = appUrl.replace(/\/+$/, "");
  const codeParam = `code=${encodeURIComponent(clientCode)}`;
  const tokenParam = token ? `&t=${encodeURIComponent(token)}` : "";
  return `${base}/pulse?${codeParam}${tokenParam}`;
}

export interface RenderedPulseEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderPulseEmail(params: PulseTemplateParams): RenderedPulseEmail {
  const lang: Lang = normalizeLang(params.language);
  const variant: PulseVariant = params.variant || "initial";
  const copy = PULSE_COPY[lang][params.type][variant];
  const name = firstNameFrom(params);
  const greeting = lang === "en"
    ? `Hi ${name || "there"},`
    : `Salut${name ? " " + name : ""},`;
  const subject = copy.subject(name);
  const pageUrl = pulsePageUrl(params.appUrl, params.clientCode, params.token);

  const inner = `
    <div style="font-family:${SANS};font-size:15px;line-height:1.6;color:${BODY};margin:0 0 6px;">${esc(greeting)}</div>
    <h1 style="font-family:${SANS};font-size:26px;line-height:1.2;color:${TEXT};font-weight:800;letter-spacing:-0.02em;margin:14px 0 6px;">${esc(copy.headline)}</h1>
    <p style="font-family:${SANS};font-size:15px;line-height:1.55;color:${BODY};margin:0 0 22px;">${esc(copy.question)}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:20px auto 22px;">
      <tr><td style="border-radius:12px;background:${ACCENT};">
        <a href="${esc(pageUrl)}" style="display:inline-block;padding:16px 30px;font-family:${SANS};font-size:16px;font-weight:700;color:${TEXT};text-decoration:none;letter-spacing:-0.01em;">${esc(copy.cta)} →</a>
      </td></tr>
    </table>

    <div style="background:${CARD_GLASS};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;margin:6px 0 6px;text-align:center;">
      <div style="font-family:${SANS};font-size:11px;color:${MUTED};letter-spacing:0.14em;font-weight:700;text-transform:uppercase;margin:0 0 6px;">${esc(copy.codeIntro)}</div>
      <div style="font-family:${SANS};font-size:28px;color:${TEXT};font-weight:800;letter-spacing:0.08em;">${esc(params.clientCode)}</div>
    </div>

    <p style="font-family:${SANS};font-size:12px;line-height:1.55;color:${MUTED};margin:22px 0 0;text-align:center;">${esc(copy.microNote)}</p>
  `;

  const footerLine = lang === "en"
    ? "A question? Just reply to this email."
    : "Une question ? Réponds simplement à ce courriel.";

  const html = `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${SANS};-webkit-font-smoothing:antialiased;color:${BODY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${CARD};border:1px solid ${BORDER};border-radius:28px;overflow:hidden;">
      <tr><td style="background:linear-gradient(180deg,${ACCENT_SOFT} 0%,${CARD} 100%);padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:40px 24px 0;">
            <div style="font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">TDIA<span style="color:${ACCENT};">.</span></div>
          </td></tr>
          <tr><td style="padding:18px 40px 40px;">${inner}</td></tr>
        </table>
      </td></tr>
      <tr><td style="background:${BG};padding:22px 32px;border-top:1px solid ${BORDER};" align="center">
        <div style="font-family:${SANS};font-size:12px;color:${MUTED};line-height:1.7;">
          ${footerLine}<br>
          <a href="https://www.tdiaagency.com" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">tdiaagency.com</a>
        </div>
        <div style="margin-top:10px;font-family:${SANS};font-size:10px;color:${DIM};letter-spacing:0.18em;font-weight:700;">© TDIA AGENCY</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = `${greeting}

${copy.headline}
${copy.question}

${copy.cta} : ${pageUrl}

${copy.codeIntro} ${params.clientCode}

${copy.microNote}
— TDIA`;

  return { subject, html, text };
}

export function renderPulseSMS(params: PulseTemplateParams): string {
  const lang: Lang = normalizeLang(params.language);
  const variant: PulseVariant = params.variant || "initial";
  const url = pulsePageUrl(params.appUrl, params.clientCode, params.token);
  return PULSE_SMS_COPY[lang][params.type][variant](firstNameFrom(params), params.clientCode, url);
}
