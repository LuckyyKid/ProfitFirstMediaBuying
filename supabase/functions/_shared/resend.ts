// Wrapper autour de l'API Resend qui gère le mode "sandbox" (compte sans
// domaine vérifié). En sandbox, Resend renvoie 403 dès qu'on essaie d'envoyer
// vers une adresse autre que celle du compte. On capture cette erreur et on
// renvoie l'email vers RESEND_SANDBOX_TO (par défaut mikola.business@gmail.com)
// avec un préfixe [TEST → vrai_destinataire] dans le sujet.
//
// Dès qu'un domaine est vérifié + EMAIL_FROM mis à jour, ce fallback ne se
// déclenchera plus et les emails partiront vers les vrais clients.

const RESEND_URL = "https://api.resend.com/emails";

export interface SendArgs {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface SendResult {
  id?: string;
  redirected?: boolean;
  redirectedTo?: string;
  originalTo?: string;
}

const SANDBOX_FALLBACK_TO =
  Deno.env.get("RESEND_SANDBOX_TO") || "mikola.business@gmail.com";

async function postResend(apiKey: string, payload: Record<string, unknown>) {
  const r = await fetch(RESEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, body };
}

export async function sendResendEmail(args: SendArgs): Promise<SendResult> {
  const first = await postResend(args.apiKey, {
    from: args.from,
    to: [args.to],
    subject: args.subject,
    html: args.html,
  });
  if (first.ok) return { id: (first.body as { id?: string })?.id };

  const msg = JSON.stringify(first.body);
  const isSandbox =
    first.status === 403 &&
    /verify a domain|testing emails to your own/i.test(msg);

  if (isSandbox && args.to.toLowerCase() !== SANDBOX_FALLBACK_TO.toLowerCase()) {
    const fallback = await postResend(args.apiKey, {
      from: args.from,
      to: [SANDBOX_FALLBACK_TO],
      subject: `[TEST → ${args.to}] ${args.subject}`,
      html: `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px 14px;border-radius:8px;margin:0 0 16px;font-family:Arial;font-size:13px;color:#7c2d12">⚠️ <strong>Mode sandbox Resend</strong> — destinataire réel : <strong>${args.to}</strong>. Vérifiez un domaine sur resend.com/domains pour envoyer aux vrais clients.</div>${args.html}`,
    });
    if (!fallback.ok) {
      throw new Error(`Resend sandbox-fallback ${fallback.status}: ${JSON.stringify(fallback.body)}`);
    }
    return {
      id: (fallback.body as { id?: string })?.id,
      redirected: true,
      redirectedTo: SANDBOX_FALLBACK_TO,
      originalTo: args.to,
    };
  }

  throw new Error(`Resend ${first.status}: ${msg}`);
}
