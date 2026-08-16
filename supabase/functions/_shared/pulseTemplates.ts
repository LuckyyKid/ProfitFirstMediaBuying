// Client Pulse System — templates courriels + SMS.
//
// Le client reçoit un courriel/SMS qui l'invite à ouvrir la page /pulse de l'app.
// Sur cette page il doit saisir son code client (affiché en gros dans le
// courriel + rappelé dans le SMS) pour accéder au picker de score puis au
// verbatim. Les liens pointent tous vers `${appUrl}/pulse`.
//
// URL principale : ${appUrl}/pulse?code=${client_code}
// Le pré-remplissage via ?code=X est un confort — la page fonctionne aussi
// si le client colle son code manuellement.

import { esc, normalizeLang, type Lang } from "./email-design.ts";

export type PulseType = "onboarding" | "monthly" | "relational";
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
        subject: () => "Ta 1re semaine chez TDIA — ça va ?",
        headline: "Deux questions rapides.",
        question: "Sur 10, comment s'est passée ton entrée chez nous ? Et sur 10, comment tu notes notre communication ?",
        cta: "Répondre en 30 secondes",
        codeIntro: "Ton code client (à saisir sur la page) :",
        microNote: "On lit chaque réponse. Promis.",
      },
      followup: {
        subject: () => "Toujours 30 secondes 👋",
        headline: "Petit rappel.",
        question: "Sur 10, comment s'est passée ta 1re semaine ? Et sur 10, comment tu notes notre communication ?",
        cta: "Répondre maintenant",
        codeIntro: "Ton code client (à saisir sur la page) :",
        microNote: "Ton feedback compte plus que tu penses.",
      },
    },
    monthly: {
      initial: {
        subject: (name) => `${name ? name + ", " : ""}ton feedback en 20 secondes`,
        headline: "On fait le point.",
        question: "Sur 10, comment s'est passé le dernier mois avec nous ?",
        cta: "Répondre en 20 secondes",
        codeIntro: "Ton code client (à saisir sur la page) :",
        microNote: "Un score + une phrase, c'est suffisant.",
      },
      followup: {
        subject: () => "Juste 20 secondes 👋",
        headline: "Rapide rappel.",
        question: "Sur 10, comment s'est passé le dernier mois avec nous ?",
        cta: "Répondre maintenant",
        codeIntro: "Ton code client (à saisir sur la page) :",
        microNote: "Ton avis nous aide à ajuster ce qu'on fait pour toi.",
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
  },
  en: {
    onboarding: {
      initial: {
        subject: () => "Your 1st week at TDIA — how did it go?",
        headline: "Two quick questions.",
        question: "Out of 10, how was your first week with us? And out of 10, how would you rate our communication?",
        cta: "Answer in 30 seconds",
        codeIntro: "Your client code (enter it on the page):",
        microNote: "We read every reply. Promise.",
      },
      followup: {
        subject: () => "Still 30 seconds 👋",
        headline: "Quick reminder.",
        question: "Out of 10, how was your first week? And out of 10, how would you rate our communication?",
        cta: "Answer now",
        codeIntro: "Your client code (enter it on the page):",
        microNote: "Your feedback matters more than you think.",
      },
    },
    monthly: {
      initial: {
        subject: (name) => `${name ? name + ", " : ""}your feedback in 20 seconds`,
        headline: "Quick check-in.",
        question: "Out of 10, how was the last month working with us?",
        cta: "Answer in 20 seconds",
        codeIntro: "Your client code (enter it on the page):",
        microNote: "One score + one line is enough.",
      },
      followup: {
        subject: () => "Just 20 seconds 👋",
        headline: "Quick reminder.",
        question: "Out of 10, how was the last month working with us?",
        cta: "Answer now",
        codeIntro: "Your client code (enter it on the page):",
        microNote: "Your input helps us adjust.",
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
  },
};

export const PULSE_SMS_COPY: Record<Lang, Record<PulseType, Record<PulseVariant, (name: string, code: string, url: string) => string>>> = {
  fr: {
    onboarding: {
      initial: (n, code, url) => `Salut ${n || ""}, c'est TDIA. Ça fait 1 semaine — 2 questions rapides (30 sec). Code client : ${code}. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut ${n || ""}, TDIA — rappel, 30 sec pour tes 2 réponses. Code : ${code}. ${url}`,
    },
    monthly: {
      initial: (n, code, url) => `Salut ${n || ""}, TDIA. 20 sec pour ton feedback du mois. Code client : ${code}. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut ${n || ""}, TDIA — petit rappel, ton feedback en 20 sec. Code : ${code}. ${url}`,
    },
    relational: {
      initial: (n, code, url) => `Salut ${n || ""}, TDIA. 20 sec pour ton feedback NPS. Code client : ${code}. Réponds ici : ${url}`,
      followup: (n, code, url) => `Salut ${n || ""}, TDIA — rappel : Code ${code}, ${url}`,
    },
  },
  en: {
    onboarding: {
      initial: (n, code, url) => `Hi ${n || ""}, TDIA here. It's been a week — 2 quick questions (30 sec). Client code: ${code}. Answer here: ${url}`,
      followup: (n, code, url) => `Hi ${n || ""}, TDIA — reminder, 30 sec for your 2 answers. Code: ${code}. ${url}`,
    },
    monthly: {
      initial: (n, code, url) => `Hi ${n || ""}, TDIA. 20 sec for your monthly feedback. Client code: ${code}. Answer here: ${url}`,
      followup: (n, code, url) => `Hi ${n || ""}, TDIA — quick reminder, your feedback in 20 sec. Code: ${code}. ${url}`,
    },
    relational: {
      initial: (n, code, url) => `Hi ${n || ""}, TDIA. 20 sec for your NPS feedback. Client code: ${code}. Answer here: ${url}`,
      followup: (n, code, url) => `Hi ${n || ""}, TDIA — reminder: Code ${code}, ${url}`,
    },
  },
};

function firstNameFrom(params: PulseTemplateParams): string {
  const raw = (params.firstName || params.clientName || "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0];
}

function pulsePageUrl(appUrl: string, clientCode: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/pulse?code=${encodeURIComponent(clientCode)}`;
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
  const greeting = lang === "en" ? `Hi ${name || "there"},` : `Salut ${name || ""},`;
  const subject = copy.subject(name);
  const pageUrl = pulsePageUrl(params.appUrl, params.clientCode);

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
  const url = pulsePageUrl(params.appUrl, params.clientCode);
  return PULSE_SMS_COPY[lang][params.type][variant](firstNameFrom(params), params.clientCode, url);
}
