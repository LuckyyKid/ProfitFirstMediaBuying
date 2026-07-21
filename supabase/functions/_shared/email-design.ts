// TDIA transactional emails — modern glass premium, TDIA navy/blue only.
// Single-column tables with inline styles. No flex, no media queries.

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

function shell(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
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

          <!-- Star rating -->
          <tr><td align="center" style="padding:22px 24px 0;font-family:${SANS};font-size:10px;color:${MUTED};letter-spacing:0.18em;font-weight:700;text-transform:uppercase;">
            <span style="color:${GOLD};font-size:13px;letter-spacing:0.1em;">★★★★★</span>
            &nbsp;&nbsp;4.9/5&nbsp;·&nbsp;Meta · Google · TikTok
          </td></tr>

          <!-- Inner content -->
          <tr><td style="padding:18px 40px 40px;">${inner}</td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:${BG};padding:26px 32px;border-top:1px solid ${BORDER};" align="center">
        <div style="font-family:${SANS};font-size:12px;color:${MUTED};line-height:1.7;">
          Une question ? Répondez simplement à cet email.<br>
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
}

export function renderWelcomeEmail(p0: WelcomeEmailParams): string {
  const channelLabel = p0.slackChannelName
    ? `#${esc(p0.slackChannelName)}`
    : (p0.companyName ? `#${esc(slugify(p0.companyName))}-tdia` : "votre canal Slack");

  const inner = `
    ${headline("Bienvenue dans", "l'univers TDIA")}
    ${subCopy(p0.companyName
      ? `Ravis de démarrer avec <strong style="color:${TEXT};">${esc(p0.companyName)}</strong>.<br>Voici tout ce qu'il vous faut pour lancer.`
      : `Ravis de démarrer avec vous.<br>Voici tout ce qu'il vous faut pour lancer.`)}

    ${idBadge(p0.clientCode)}

    ${ctaStack(
      { url: p0.onboardingUrl, label: "Démarrer l'onboarding" },
      p0.slackInviteUrl ? { url: p0.slackInviteUrl, label: "Rejoindre le Slack" } : undefined,
    )}

    ${sectionLabel("Ce que votre compte débloque")}

    ${featureCard("◆", "Onboarding guidé", "Un formulaire clair, étape par étape, pour cadrer votre stratégie et vos accès plateformes.")}
    ${featureCard("#", "Canal Slack dédié", `Votre équipe et la nôtre échangent en direct sur ${channelLabel}. Invitation envoyée séparément par Slack.`)}
    ${featureCard("↗", "Hub de reporting", `Vérifications, rapports et feedbacks créatifs centralisés sur <a href="https://tdiahub.lovable.app" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">tdiahub.lovable.app</a>.`)}
    ${p0.paymentUrl ? featureCard("$", "Activation du service", `Réglez l'acompte pour lancer l'accompagnement : <a href="${esc(p0.paymentUrl)}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">payer maintenant</a>.`) : ""}
    ${featureCard("✎", "Contrat DocuSign", "Envoyé séparément — ou disponible depuis votre portail d'onboarding.")}

    <div style="text-align:center;margin:28px 0 10px;font-family:${SANS};font-size:13px;color:${MUTED};">Besoin d'aide pour vous connecter ? <a href="${LOOM_TUTORIAL_URL}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Regardez ce court tutoriel</a>.</div>
    ${pillButton(p0.onboardingUrl, "Accéder à mon portail", "primary")}
  `;
  return shell("Bienvenue chez TDIA", inner);
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
}

export function renderFollowUpEmail(p0: FollowUpEmailParams): string {
  const currentName = p0.stepNames[Math.max(0, p0.currentStep - 1)] ?? "votre étape actuelle";
  const channelLabel = p0.slackChannelName
    ? `#${esc(p0.slackChannelName)}`
    : (p0.companyName ? `#${esc(slugify(p0.companyName))}-tdia` : "votre canal Slack");

  const inner = `
    ${headline("Besoin d'un", "coup de main ?")}
    ${subCopy(p0.companyName
      ? `Votre onboarding pour <strong style="color:${TEXT};">${esc(p0.companyName)}</strong> est en pause à l'étape <strong style="color:${TEXT};">${esc(currentName)}</strong>.<br><span style="color:${MUTED};">Moins de 5 minutes pour reprendre.</span>`
      : `Vous êtes en pause à l'étape <strong style="color:${TEXT};">${esc(currentName)}</strong>.<br><span style="color:${MUTED};">Moins de 5 minutes pour reprendre.</span>`)}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px;">
      <tr><td align="center" style="background:${CARD_GLASS};border:1px solid ${BORDER};border-radius:999px;padding:8px 16px;">
        <span style="display:inline-block;width:6px;height:6px;background:${ACCENT};border-radius:999px;margin-right:8px;vertical-align:middle;"></span>
        <span style="font-family:${SANS};font-size:11px;font-weight:700;color:${ACCENT_LIGHT};letter-spacing:0.14em;text-transform:uppercase;vertical-align:middle;">En pause 24h · Étape ${p0.currentStep}/${p0.stepNames.length}</span>
      </td></tr>
    </table>

    ${ctaStack({ url: p0.resumeUrl, label: "Reprendre maintenant" })}

    ${sectionLabel("On peut vous aider")}

    ${featureCard("#", "Une question ?", `Échangez avec l'équipe sur ${channelLabel}${p0.slackInviteUrl ? ` — <a href="${esc(p0.slackInviteUrl)}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">rejoindre</a>` : ""}.`)}
    ${p0.paymentUrl ? featureCard("$", "Paiement en attente", `Activez votre accompagnement : <a href="${esc(p0.paymentUrl)}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">payer maintenant</a>.`) : ""}
    ${featureCard("▶", "Difficulté à vous connecter ?", `<a href="${LOOM_TUTORIAL_URL}" style="color:${ACCENT_HOVER};text-decoration:none;font-weight:600;">Regardez ce court tutoriel</a> (2 min).`)}

    <div style="text-align:center;font-family:${SANS};font-size:12px;color:${MUTED};margin-top:22px;">
      Ou répondez simplement à cet email — on s'occupe du reste.
    </div>
  `;
  return shell("On peut vous aider — TDIA", inner);
}
