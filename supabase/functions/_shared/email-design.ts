// TDIA transactional emails — modern glass premium, TDIA navy/blue only.
// Single-column tables with inline styles. No flex, no media queries.

export type Lang = "fr" | "en";
export function normalizeLang(l?: string | null): Lang {
  return l === "en" ? "en" : "fr";
}

export const LOOM_TUTORIAL_URL =
  "https://www.loom.com/share/b7d9dfcb39a348a8b18b2d41a129598a";

export function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 21);
}

// Slack's `conversations.inviteShared` returns a `slack-connect-invite://TEAM/TOKEN…`
// URI that only opens the desktop app — not clickable in email clients / browsers.
// The web equivalent Slack itself sends by email is `https://join.slack.com/share/<payload>`,
// so we rebuild that from the URI payload. Returns null when neither an https URL
// nor a recognizable Slack Connect URI is available (caller should fall back to
// "check your Slack invitation email" copy).
export function toWebInviteUrl(u?: string | null): string | null {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (s.startsWith("https://")) return s;
  const prefix = "slack-connect-invite://";
  if (s.startsWith(prefix)) {
    const rest = s.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    const payload = rest.slice(slash + 1).replace(/^\/+/, "").trim();
    if (!payload) return null;
    return `https://join.slack.com/share/${payload}`;
  }
  return null;
}

// TDIA palette — Navy Trust (no purple/violet)
const BG = "#020617";              // page background — near black navy
const CARD = "#0B1327";            // card body
const CARD_SOFT = "#0F1B33";       // secondary card
const CARD_GLASS = "#111E3A";      // feature card (glass)
const BORDER = "#1B294A";          // subtle border
const BORDER_SOFT = "#152340";     // softer border
const TEXT = "#FFFFFF";            // headings
const BODY = "#C9D4EA";            // body copy
const MUTED = "#8393B4";           // meta
const DIM = "#556485";             // tertiary
const ACCENT = "#2E7BFF";          // primary TDIA blue
const ACCENT_HOVER = "#4A8DFF";
const ACCENT_LIGHT = "#7FB0FF";
const ACCENT_SOFT = "#0F1E3D";     // blue tinted bg
const GOLD = "#F4C862";            // star rating

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono','Menlo','Consolas','Courier New',monospace";

function shell(title: string, inner: string, lang: Lang = "fr"): string {
  const footerCopy = lang === "en"
    ? `A question? Just reply to this email.`
    : `Une question ? Répondez simplement à cet email.`;
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark light; supported-color-schemes: dark light; }
  body, table, td, div, p, a, span { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${SANS};-webkit-font-smoothing:antialiased;color:${BODY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${CARD};border:1px solid ${BORDER};border-radius:28px;overflow:hidden;">

      <!-- Soft blue glow band (fake radial via gradient) -->
      <tr><td style="background:linear-gradient(180deg,${ACCENT_SOFT} 0%,${CARD} 100%);padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

          <!-- Logo -->
          <tr><td align="center" style="padding:40px 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">TDIA<span style="color:${ACCENT};">.</span></td>
            </tr></table>
          </td></tr>

          <!-- Platforms -->
          <tr><td align="center" style="padding:22px 24px 0;font-family:${SANS};font-size:10px;color:${MUTED};letter-spacing:0.18em;font-weight:700;text-transform:uppercase;">
            Meta · Google · TikTok
          </td></tr>

          <!-- Inner content -->
          <tr><td style="padding:18px 40px 40px;">${inner}</td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:${BG};padding:26px 32px;border-top:1px solid ${BORDER};" align="center">
        <div style="font-family:${SANS};font-size:12px;color:${MUTED};line-height:1.7;">
          ${footerCopy}<br>
          <a href="https://www.tdiaagency.com" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">tdiaagency.com</a>
        </div>
        <div style="margin-top:14px;font-family:${SANS};font-size:10px;color:${DIM};letter-spacing:0.18em;font-weight:700;">© TDIA AGENCY</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function headline(pre: string, accent: string): string {
  return `<div style="text-align:center;margin:12px 0 20px;">
    <div style="font-family:${SANS};font-size:34px;line-height:1.12;color:${TEXT};font-weight:800;letter-spacing:-0.02em;">${esc(pre)}</div>
    <div style="font-family:${SANS};font-size:34px;line-height:1.12;color:${ACCENT_LIGHT};font-weight:800;letter-spacing:-0.02em;margin-top:2px;">${esc(accent)}</div>
  </div>`;
}

function subCopy(html: string): string {
  return `<p style="margin:0 0 22px;text-align:center;font-family:${SANS};font-size:15px;line-height:1.6;color:${BODY};">${html}</p>`;
}

function pillButton(url: string, label: string, variant: "primary" | "secondary" = "primary"): string {
  if (variant === "primary") {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;">
      <tr><td align="center" style="background:${ACCENT};border-radius:16px;box-shadow:0 8px 24px rgba(46,123,255,0.35);">
        <a href="${esc(url)}" style="display:inline-block;padding:16px 34px;font-family:${SANS};font-size:14px;font-weight:700;text-decoration:none;color:#FFFFFF;letter-spacing:-0.01em;">${esc(label)}</a>
      </td></tr></table>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;">
    <tr><td align="center" style="background:${CARD_GLASS};border:1px solid ${BORDER};border-radius:16px;">
      <a href="${esc(url)}" style="display:inline-block;padding:16px 34px;font-family:${SANS};font-size:14px;font-weight:700;text-decoration:none;color:${TEXT};letter-spacing:-0.01em;">${esc(label)}</a>
    </td></tr></table>`;
}

function ctaStack(primary: {url: string; label: string}, secondary?: {url: string; label: string}): string {
  return `<div style="margin:6px 0 30px;">
    ${pillButton(primary.url, primary.label, "primary")}
    ${secondary ? pillButton(secondary.url, secondary.label, "secondary") : ""}
  </div>`;
}

function featureCard(icon: string, title: string, body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
    <tr><td style="background:${CARD_GLASS};border:1px solid ${BORDER_SOFT};border-radius:20px;padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top" width="44" style="padding-right:14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="40" height="40" align="center" valign="middle" style="background:${ACCENT_SOFT};border:1px solid ${BORDER};border-radius:12px;font-family:${SANS};font-size:18px;font-weight:800;color:${ACCENT_LIGHT};line-height:40px;">${icon}</td>
          </tr></table>
        </td>
        <td valign="top">
          <div style="font-family:${SANS};font-size:15px;font-weight:700;color:${TEXT};margin-bottom:4px;letter-spacing:-0.01em;">${esc(title)}</div>
          <div style="font-family:${SANS};font-size:13px;line-height:1.6;color:${BODY};">${body}</div>
        </td>
      </tr></table>
    </td></tr>
  </table>`;
}

function idBadge(clientCode: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
    <tr><td align="center" style="background:${CARD_GLASS};border:1px solid ${BORDER};border-radius:999px;padding:8px 16px;">
      <span style="display:inline-block;width:6px;height:6px;background:${ACCENT};border-radius:999px;margin-right:8px;vertical-align:middle;"></span>
      <span style="font-family:${MONO};font-size:11px;font-weight:700;color:${BODY};letter-spacing:0.08em;vertical-align:middle;">CLIENT_ID · ${esc(clientCode)}</span>
    </td></tr>
  </table>`;
}

function sectionLabel(label: string): string {
  return `<div style="text-align:left;margin:18px 0 14px;font-family:${SANS};font-size:11px;font-weight:700;color:${MUTED};letter-spacing:0.22em;text-transform:uppercase;">${esc(label)}</div>`;
}

// ─── Welcome email ──────────────────────────────────────────────────────────
export interface WelcomeEmailParams {
  contactName?: string | null;
  companyName?: string | null;
  clientCode: string;
  onboardingUrl: string;
  slackInviteUrl?: string | null;
  slackChannelName?: string | null;
  paymentUrl?: string | null;
  language?: Lang;
}

export function welcomeEmailSubject(lang: Lang = "fr"): string {
  return lang === "en"
    ? "Welcome to TDIA — start your onboarding"
    : "Bienvenue chez TDIA — demarrez votre onboarding";
}

export function renderWelcomeEmail(p0: WelcomeEmailParams): string {
  const lang = normalizeLang(p0.language);
  const slackHref = toWebInviteUrl(p0.slackInviteUrl);
  const fallbackChannel = lang === "en" ? "your Slack channel" : "votre canal Slack";
  const channelLabel = p0.slackChannelName
    ? `#${esc(p0.slackChannelName)}`
    : (p0.companyName ? `#${esc(slugify(p0.companyName))}-tdia` : fallbackChannel);

  const t = lang === "en"
    ? {
        title: "Welcome to TDIA",
        headlinePre: "Welcome to",
        headlineAccent: "the TDIA universe",
        subWith: (co: string) => `Excited to get started with <strong style="color:${TEXT};">${co}</strong>.<br>Here's everything you need to launch.`,
        subNoCo: `Excited to get started with you.<br>Here's everything you need to launch.`,
        ctaStart: "Start onboarding",
        ctaSlack: "Join Slack channel",
        sectionUnlocks: "What your account unlocks",
        featOnboardTitle: "Guided onboarding",
        featOnboardBody: "A clear, step-by-step form to frame your strategy and platform access.",
        featSlackTitle: "Dedicated Slack channel",
        slackWithLink: (ch: string, href: string) => `Your team and ours chat live on ${ch}. <a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Join the Slack channel</a> — you'll also receive a direct invite from Slack by email.`,
        slackNoLink: (ch: string) => `Your team and ours chat live on ${ch}. Slack just sent you the invite by email — check your inbox (and spam).`,
        featHubTitle: "Reporting hub",
        featHubBody: `Reviews, reports and creative feedback centralized on <a href="https://tdiahub.lovable.app" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">tdiahub.lovable.app</a>.`,
        featPayTitle: "Service activation",
        featPayBody: (url: string) => `Settle the deposit to kick things off: <a href="${url}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">pay now</a>.`,
        featContractTitle: "DocuSign contract",
        featContractBody: "Sent separately — or available from your onboarding portal.",
        helpCopy: (href: string) => `Need help logging in? <a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Watch this short tutorial</a>.`,
        ctaPortal: "Access my portal",
      }
    : {
        title: "Bienvenue chez TDIA",
        headlinePre: "Bienvenue dans",
        headlineAccent: "l'univers TDIA",
        subWith: (co: string) => `Ravis de démarrer avec <strong style="color:${TEXT};">${co}</strong>.<br>Voici tout ce qu'il vous faut pour lancer.`,
        subNoCo: `Ravis de démarrer avec vous.<br>Voici tout ce qu'il vous faut pour lancer.`,
        ctaStart: "Démarrer l'onboarding",
        ctaSlack: "Rejoindre le canal Slack",
        sectionUnlocks: "Ce que votre compte débloque",
        featOnboardTitle: "Onboarding guidé",
        featOnboardBody: "Un formulaire clair, étape par étape, pour cadrer votre stratégie et vos accès plateformes.",
        featSlackTitle: "Canal Slack dédié",
        slackWithLink: (ch: string, href: string) => `Votre équipe et la nôtre échangent en direct sur ${ch}. <a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Rejoindre le canal Slack</a> — vous recevrez aussi une invitation directe de Slack par email.`,
        slackNoLink: (ch: string) => `Votre équipe et la nôtre échangent en direct sur ${ch}. Slack vient de vous envoyer l'invitation par email — vérifiez votre boîte de réception (et vos spams).`,
        featHubTitle: "Hub de reporting",
        featHubBody: `Vérifications, rapports et feedbacks créatifs centralisés sur <a href="https://tdiahub.lovable.app" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">tdiahub.lovable.app</a>.`,
        featPayTitle: "Activation du service",
        featPayBody: (url: string) => `Réglez l'acompte pour lancer l'accompagnement : <a href="${url}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">payer maintenant</a>.`,
        featContractTitle: "Contrat DocuSign",
        featContractBody: "Envoyé séparément — ou disponible depuis votre portail d'onboarding.",
        helpCopy: (href: string) => `Besoin d'aide pour vous connecter ? <a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Regardez ce court tutoriel</a>.`,
        ctaPortal: "Accéder à mon portail",
      };

  const slackCardBody = slackHref ? t.slackWithLink(channelLabel, esc(slackHref)) : t.slackNoLink(channelLabel);

  const inner = `
    ${headline(t.headlinePre, t.headlineAccent)}
    ${subCopy(p0.companyName ? t.subWith(esc(p0.companyName)) : t.subNoCo)}

    ${idBadge(p0.clientCode)}

    ${ctaStack(
      { url: p0.onboardingUrl, label: t.ctaStart },
      slackHref ? { url: slackHref, label: t.ctaSlack } : undefined,
    )}

    ${sectionLabel(t.sectionUnlocks)}

    ${featureCard("◆", t.featOnboardTitle, t.featOnboardBody)}
    ${featureCard("#", t.featSlackTitle, slackCardBody)}
    ${featureCard("↗", t.featHubTitle, t.featHubBody)}
    ${p0.paymentUrl ? featureCard("$", t.featPayTitle, t.featPayBody(esc(p0.paymentUrl))) : ""}
    ${featureCard("✎", t.featContractTitle, t.featContractBody)}

    <div style="text-align:center;margin:28px 0 10px;font-family:${SANS};font-size:13px;color:${MUTED};">${t.helpCopy(LOOM_TUTORIAL_URL)}</div>
    ${pillButton(p0.onboardingUrl, t.ctaPortal, "primary")}
  `;
  return shell(t.title, inner, lang);
}

// ─── Follow-up email ────────────────────────────────────────────────────────
export interface FollowUpEmailParams {
  contactName?: string | null;
  companyName?: string | null;
  currentStep: number;
  stepNames: string[];
  resumeUrl: string;
  slackInviteUrl?: string | null;
  slackChannelName?: string | null;
  paymentUrl?: string | null;
  language?: Lang;
}

export const STEP_NAMES_EN = [
  "Welcome",
  "Platform access",
  "Form",
  "Founder Scan",
  "Payment",
  "Contract",
  "Kickoff call",
];

export function followUpEmailSubject(lang: Lang = "fr"): string {
  return lang === "en"
    ? "Need a hand finishing your TDIA onboarding?"
    : "On peut vous aider à finaliser votre onboarding TDIA ?";
}

export function renderFollowUpEmail(p0: FollowUpEmailParams): string {
  const lang = normalizeLang(p0.language);
  const stepNames = lang === "en" && p0.stepNames === undefined ? STEP_NAMES_EN : p0.stepNames;
  const fallbackStep = lang === "en" ? "your current step" : "votre étape actuelle";
  const currentName = stepNames[Math.max(0, p0.currentStep - 1)] ?? fallbackStep;
  const slackHref = toWebInviteUrl(p0.slackInviteUrl);
  const fallbackChannel = lang === "en" ? "your Slack channel" : "votre canal Slack";
  const channelLabel = p0.slackChannelName
    ? `#${esc(p0.slackChannelName)}`
    : (p0.companyName ? `#${esc(slugify(p0.companyName))}-tdia` : fallbackChannel);

  const t = lang === "en"
    ? {
        title: "We can help — TDIA",
        headlinePre: "Need a",
        headlineAccent: "hand?",
        subWith: (co: string, step: string) => `Your onboarding for <strong style="color:${TEXT};">${co}</strong> is paused at the <strong style="color:${TEXT};">${step}</strong> step.<br><span style="color:${MUTED};">Under 5 minutes to resume.</span>`,
        subNoCo: (step: string) => `You're paused at the <strong style="color:${TEXT};">${step}</strong> step.<br><span style="color:${MUTED};">Under 5 minutes to resume.</span>`,
        badge: `Paused 24h · Step ${p0.currentStep}/${stepNames.length}`,
        ctaResume: "Resume now",
        section: "We can help",
        featQuestion: "A question?",
        featQuestionBody: (ch: string, slackFrag: string) => `Reach the team on ${ch}${slackFrag}.`,
        slackFragWithLink: (href: string) => ` — <a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">join the Slack channel</a>`,
        slackFragNoLink: ` — the Slack invite is in your inbox`,
        featPayTitle: "Payment pending",
        featPayBody: (url: string) => `Activate your engagement: <a href="${url}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">pay now</a>.`,
        featTutorTitle: "Trouble logging in?",
        featTutorBody: (href: string) => `<a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Watch this short tutorial</a> (2 min).`,
        replyLine: "Or just reply to this email — we take care of the rest.",
      }
    : {
        title: "On peut vous aider — TDIA",
        headlinePre: "Besoin d'un",
        headlineAccent: "coup de main ?",
        subWith: (co: string, step: string) => `Votre onboarding pour <strong style="color:${TEXT};">${co}</strong> est en pause à l'étape <strong style="color:${TEXT};">${step}</strong>.<br><span style="color:${MUTED};">Moins de 5 minutes pour reprendre.</span>`,
        subNoCo: (step: string) => `Vous êtes en pause à l'étape <strong style="color:${TEXT};">${step}</strong>.<br><span style="color:${MUTED};">Moins de 5 minutes pour reprendre.</span>`,
        badge: `En pause 24h · Étape ${p0.currentStep}/${stepNames.length}`,
        ctaResume: "Reprendre maintenant",
        section: "On peut vous aider",
        featQuestion: "Une question ?",
        featQuestionBody: (ch: string, slackFrag: string) => `Échangez avec l'équipe sur ${ch}${slackFrag}.`,
        slackFragWithLink: (href: string) => ` — <a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">rejoindre le canal Slack</a>`,
        slackFragNoLink: ` — l'invitation Slack est dans votre boîte email`,
        featPayTitle: "Paiement en attente",
        featPayBody: (url: string) => `Activez votre accompagnement : <a href="${url}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">payer maintenant</a>.`,
        featTutorTitle: "Difficulté à vous connecter ?",
        featTutorBody: (href: string) => `<a href="${href}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Regardez ce court tutoriel</a> (2 min).`,
        replyLine: "Ou répondez simplement à cet email — on s'occupe du reste.",
      };

  const slackFrag = slackHref ? t.slackFragWithLink(esc(slackHref)) : t.slackFragNoLink;

  const inner = `
    ${headline(t.headlinePre, t.headlineAccent)}
    ${subCopy(p0.companyName ? t.subWith(esc(p0.companyName), esc(currentName)) : t.subNoCo(esc(currentName)))}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px;">
      <tr><td align="center" style="background:${CARD_GLASS};border:1px solid ${BORDER};border-radius:999px;padding:8px 16px;">
        <span style="display:inline-block;width:6px;height:6px;background:${ACCENT};border-radius:999px;margin-right:8px;vertical-align:middle;"></span>
        <span style="font-family:${SANS};font-size:11px;font-weight:700;color:${ACCENT_LIGHT};letter-spacing:0.14em;text-transform:uppercase;vertical-align:middle;">${esc(t.badge)}</span>
      </td></tr>
    </table>

    ${ctaStack({ url: p0.resumeUrl, label: t.ctaResume })}

    ${sectionLabel(t.section)}

    ${featureCard("#", t.featQuestion, t.featQuestionBody(channelLabel, slackFrag))}
    ${p0.paymentUrl ? featureCard("$", t.featPayTitle, t.featPayBody(esc(p0.paymentUrl))) : ""}
    ${featureCard("▶", t.featTutorTitle, t.featTutorBody(LOOM_TUTORIAL_URL))}

    <div style="text-align:center;font-family:${SANS};font-size:12px;color:${MUTED};margin-top:22px;">
      ${esc(t.replyLine)}
    </div>
  `;
  return shell(t.title, inner, lang);
}

// ─── Seasonal emails ────────────────────────────────────────────────────────

export function firstNameOf(fullName?: string | null, lang: Lang = "fr"): string {
  const n = (fullName ?? "").trim().split(/\s+/)[0];
  return n || (lang === "en" ? "hi" : "bonjour");
}

function signature(lang: Lang = "fr"): string {
  const closing = lang === "en" ? "Talk soon,<br>" : "À très vite,<br>";
  const team = lang === "en" ? "The TDIA team" : "L'équipe TDIA";
  return `<div style="margin-top:26px;font-family:${SANS};font-size:14px;line-height:1.6;color:${BODY};">
    ${closing}
    <span style="color:${TEXT};font-weight:700;">${team}</span>
  </div>`;
}

function letterShell(paragraphs: string[], cta?: {url: string; label: string}, lang: Lang = "fr"): string {
  return paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.7;color:${BODY};">${p}</p>`)
    .join("")
    + (cta ? `<div style="margin:22px 0 8px;">${pillButton(cta.url, cta.label, "primary")}</div>` : "")
    + signature(lang);
}

// ── Yearly 1:1 check-in (sent ~1 month before New Year) ────────────────
export interface YearlyCheckinEmailParams {
  contactName?: string | null;
  companyName?: string | null;
  currentYear: number;
  nextYear: number;
  calendlyUrl: string;
  language?: Lang;
}

export function yearlyCheckinSubject(contactName: string | null | undefined, currentYear: number, lang: Lang = "fr"): string {
  const first = firstNameOf(contactName, lang);
  return lang === "en"
    ? `${first}, 30 min before ${currentYear} wraps up?`
    : `${first}, on prend 30 min avant que ${currentYear} se termine ?`;
}

export function renderYearlyCheckinEmail(p0: YearlyCheckinEmailParams): string {
  const lang = normalizeLang(p0.language);
  const first = esc(firstNameOf(p0.contactName, lang));
  const company = p0.companyName
    ? (lang === "en"
        ? ` at <strong style="color:${TEXT};">${esc(p0.companyName)}</strong>`
        : ` chez <strong style="color:${TEXT};">${esc(p0.companyName)}</strong>`)
    : "";

  const paragraphs = lang === "en"
    ? [
        `Hard to believe we're already a month out from the new year. Before things get hectic, we'd really like to take a moment with you.`,
        `The idea is simple: a 30-minute 1:1 call to look back on ${p0.currentYear} and, more importantly, to understand where you want to take ${company ? "the business" : "your project"} in <strong style="color:${TEXT};">${p0.nextYear}</strong>. Your plans, your ambitions, what needs to change, what we can prepare together in advance.`,
        `We always walk out of these calls with a much clearer view of how we can be most useful next year${company} — and honestly, it's one of our favorite moments of the year.`,
        `Pick the slot that works best for you, we'll adapt:`,
      ]
    : [
        `Difficile de croire qu'on est déjà à un mois du nouvel an. Avant que la fin d'année ne devienne folle, on aimerait vraiment prendre un moment avec vous.`,
        `L'idée est simple : un appel de 30 minutes, en 1:1, pour faire le point sur ${p0.currentYear} et surtout pour comprendre où vous voulez emmener ${company ? "l'entreprise" : "votre projet"} en <strong style="color:${TEXT};">${p0.nextYear}</strong>. Vos plans, vos ambitions, ce qui doit changer, ce qu'on peut préparer ensemble en amont.`,
        `On ressort systématiquement de ces appels avec une vision beaucoup plus claire de comment on peut vous être utile l'année suivante${company} — et honnêtement, c'est un des moments qu'on préfère dans l'année.`,
        `Choisissez le créneau qui vous arrange le plus, on s'adapte :`,
      ];

  const headlineAccent = lang === "en"
    ? `${p0.currentYear} is winding down`
    : `${p0.currentYear} touche à sa fin`;
  const cta = { url: p0.calendlyUrl, label: lang === "en" ? "Book my 30 min call" : "Réserver mon appel 30 min" };
  const footerLine = lang === "en"
    ? `Nothing works in the proposed slots? Reply to this email and we'll find something else.`
    : `Rien ne colle dans les créneaux proposés ? Répondez à cet email et on trouve autre chose.`;

  const inner = `
    ${headline(`${first},`, headlineAccent)}
    ${letterShell(paragraphs, cta, lang)}

    <div style="text-align:center;font-family:${SANS};font-size:12px;color:${MUTED};margin-top:18px;">
      ${footerLine}
    </div>
  `;
  return shell(yearlyCheckinSubject(p0.contactName, p0.currentYear, lang), inner, lang);
}

// ── Christmas (Dec 24) — pure warmth, no CTA ───────────────────────────
export interface ChristmasEmailParams {
  contactName?: string | null;
  companyName?: string | null;
  currentYear: number;
  language?: Lang;
}

export function christmasSubject(lang: Lang = "fr"): string {
  return lang === "en"
    ? "Merry Christmas from all of us at TDIA"
    : "Joyeux Noël de la part de toute l'équipe TDIA";
}

export function renderChristmasEmail(p0: ChristmasEmailParams): string {
  const lang = normalizeLang(p0.language);
  const first = esc(firstNameOf(p0.contactName, lang));
  const withCompany = p0.companyName
    ? (lang === "en"
        ? `Working with <strong style="color:${TEXT};">${esc(p0.companyName)}</strong> this year has been a real privilege for us.`
        : `Travailler avec <strong style="color:${TEXT};">${esc(p0.companyName)}</strong> cette année a été une vraie chance pour nous.`)
    : (lang === "en"
        ? `Having you by our side this year has been a real privilege for us.`
        : `Vous avoir à nos côtés cette année a été une vraie chance pour nous.`);

  const paragraphs = lang === "en"
    ? [
        `Today, we're putting the campaigns, reports and dashboards aside. We just wanted to take 30 seconds to wish you and your loved ones a wonderful Christmas.`,
        withCompany + ` Every conversation, every project, every win (and every little challenge too 😉) has mattered.`,
        `Enjoy these moments with family — they go by too fast. We'll see you on the other side of the holidays with plenty of energy.`,
      ]
    : [
        `Aujourd'hui, on met les campagnes, les rapports et les tableaux de bord de côté. On voulait juste prendre 30 secondes pour vous souhaiter, à vous et à vos proches, un très beau Noël.`,
        withCompany + ` Chaque échange, chaque projet, chaque victoire (et chaque petit défi, aussi 😉) a compté.`,
        `Profitez bien de ces moments en famille — ils passent trop vite. On se retrouve avec plein d'énergie de l'autre côté des fêtes.`,
      ];

  const headlinePre = lang === "en" ? "Merry Christmas," : "Joyeux Noël,";

  const inner = `
    ${headline(headlinePre, `${first}`)}
    ${letterShell(paragraphs, undefined, lang)}
  `;
  return shell(christmasSubject(lang), inner, lang);
}

// ── New Year (Dec 31) — well-wishes for the year ahead ────────────────
export interface NewYearEmailParams {
  contactName?: string | null;
  companyName?: string | null;
  currentYear: number;
  nextYear: number;
  language?: Lang;
}

export function newYearSubject(nextYear: number, lang: Lang = "fr"): string {
  return lang === "en"
    ? `May ${nextYear} live up to your ambitions`
    : `Que ${nextYear} soit à la hauteur de vos ambitions`;
}

export function renderNewYearEmail(p0: NewYearEmailParams): string {
  const lang = normalizeLang(p0.language);
  const first = esc(firstNameOf(p0.contactName, lang));
  const target = p0.companyName
    ? (lang === "en"
        ? `for <strong style="color:${TEXT};">${esc(p0.companyName)}</strong>`
        : `pour <strong style="color:${TEXT};">${esc(p0.companyName)}</strong>`)
    : (lang === "en" ? `for you` : `pour vous`);

  const paragraphs = lang === "en"
    ? [
        `And there it is — ${p0.currentYear} is bowing out. We're taking the chance to send you our very best wishes — health first, then all the rest: success, peace of mind, and above all projects that inspire you.`,
        `May ${p0.nextYear} live up to your ambitions ${target}. On our side, we're ready to put all our energy into making this year your best one yet.`,
        `Thank you for your trust. Talk very soon.`,
      ]
    : [
        `Voilà, ${p0.currentYear} tire sa révérence. On en profite pour vous envoyer nos meilleurs vœux — de santé d'abord, puis tout le reste : réussite, sérénité, et surtout des projets qui vous passionnent.`,
        `Qu'${p0.nextYear} soit à la hauteur de vos ambitions ${target}. De notre côté, on est prêts à mettre toute notre énergie pour que cette nouvelle année soit votre meilleure jusqu'à présent.`,
        `Merci pour votre confiance. On se retrouve très vite.`,
      ];

  const headlinePre = lang === "en" ? "Happy new year," : "Bonne année,";

  const inner = `
    ${headline(headlinePre, `${first}`)}
    ${letterShell(paragraphs, undefined, lang)}
  `;
  return shell(newYearSubject(p0.nextYear, lang), inner, lang);
}
