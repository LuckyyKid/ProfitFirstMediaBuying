// Wrapper Twilio SMS partagé — extrait du pattern de follow-up-leads pour être
// réutilisable par pulse-send et pulse-cron-followup.
//
// Retourne un SmsResult au lieu de throw, pour que l'appelant décide quoi
// logger et si un échec SMS doit ou non planter tout l'envoi (l'email reste
// souvent la voie principale).

export interface SmsResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

// Twilio n'accepte que E.164 (`+15145551234`). Nos numéros Quebec/Canada sont
// souvent stockés en `514-555-1234`, `(514) 555-1234`, `1 514 555 1234`, etc.
// Défaut pays = +1 (Amérique du Nord) si pas de code pays explicite.
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export async function sendSms(phone: string, body: string): Promise<SmsResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !auth || !from) {
    return { sent: false, skipped: true, error: "Twilio secrets manquants (SID/token/from)" };
  }
  const to = toE164(phone);
  if (!to) {
    return { sent: false, skipped: false, error: `Numéro invalide (${phone}) — E.164 requis` };
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${sid}:${auth}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );
    if (!res.ok) {
      const t = await res.text();
      return { sent: false, skipped: false, error: `Twilio ${res.status}: ${t.slice(0, 240)}` };
    }
    return { sent: true, skipped: false };
  } catch (e) {
    return { sent: false, skipped: false, error: (e as Error).message };
  }
}
