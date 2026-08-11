// Follow-up automatique des leads du pipeline commercial.
//
// Comportement :
//   - Cron (aucun body) : scanne les leads dont next_followup_at <= now,
//     status hors won/lost, responded_at null, et followup_count < 6.
//   - Manuel : POST { lead_code, manual: true } — force la relance sur
//     un seul lead (bypass du planning, respecte tout de même les gardes
//     responded / cap 6).
//
// Après chaque envoi (email OU sms) : incrémente followup_count, met
// last_followup_at = now, et planifie next_followup_at = now + 24h tant
// que le count reste < 6. Au 6ᵉ envoi, next_followup_at est laissé nul
// pour arrêter la séquence.
//
// Copies : 6 variantes différentes indexées par followup_count (l'index 0
// est utilisé pour la 1ʳᵉ relance, l'index 5 pour la 6ᵉ et dernière).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";
const MAX_FOLLOWUPS = 6;
const NEXT_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface Lead {
  lead_code: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  next_followup_at: string | null;
  followup_count: number;
  responded_at: string | null;
  owner_id: string | null;
}

interface SmsResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

// Twilio n'accepte qu'E.164 (`+15145551234`). Nos leads Quebec/Canada sont
// souvent stockés en `514-555-1234`, `(514) 555-1234`, `1 514 555 1234`, etc.
// Défaut pays = +1 (Amérique du Nord) si pas de code pays explicite.
function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Déjà +… : on garde le + et les chiffres uniquement.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;              // 5145551234
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`; // 15145551234
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

async function sendSms(phone: string, body: string): Promise<SmsResult> {
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

function greeting(lead: Lead): string {
  return lead.first_name ? `Bonjour ${lead.first_name},` : "Bonjour,";
}

// index = followup_count avant envoi (0 = première relance, 5 = sixième).
const EMAIL_COPY: Array<{ subject: string; body: (l: Lead) => string }> = [
  {
    subject: "On donne suite ?",
    body: (l) => `
<p>${greeting(l)}</p>
<p>Je reviens rapidement vers vous suite à notre échange${l.company ? ` avec ${l.company}` : ""}.
   Êtes-vous toujours intéressé(e) à avancer ? Un simple oui/non m'aide à caler la suite.</p>
<p>Belle journée,<br/>L'équipe TDIA</p>`,
  },
  {
    subject: "Petit rappel — on avance ?",
    body: (l) => `
<p>${greeting(l)}</p>
<p>Je me permets un petit rappel : j'ai bloqué un créneau pour vous cette semaine
   au cas où vous vouliez qu'on regarde la proposition ensemble.</p>
<p>Faites-moi signe si ça vous convient ou proposez un autre moment.</p>
<p>Belle journée,<br/>L'équipe TDIA</p>`,
  },
  {
    subject: "Toujours le bon moment pour vous ?",
    body: (l) => `
<p>${greeting(l)}</p>
<p>On n'a pas eu de retour depuis quelques jours — pas de souci, je préfère
   demander plutôt que d'insister à l'aveugle. Est-ce toujours le bon moment
   pour ce projet, ou faut-il qu'on repousse ?</p>
<p>Belle journée,<br/>L'équipe TDIA</p>`,
  },
  {
    subject: "Une dernière relance utile ?",
    body: (l) => `
<p>${greeting(l)}</p>
<p>Souvent les projets se décident en une réponse rapide, alors je retente ma chance.
   Si le sujet n'est plus prioritaire, dites-le-moi franchement — je stoppe les relances
   et je reste dispo si ça bouge plus tard.</p>
<p>Belle journée,<br/>L'équipe TDIA</p>`,
  },
  {
    subject: "On garde le contact ?",
    body: (l) => `
<p>${greeting(l)}</p>
<p>Je ne vais pas vous encombrer plus longtemps. Un mot rapide de votre part
   suffit : on avance, on reporte, ou on ferme le dossier ?</p>
<p>Belle journée,<br/>L'équipe TDIA</p>`,
  },
  {
    subject: "Dernier email — je ne vous relance plus",
    body: (l) => `
<p>${greeting(l)}</p>
<p>C'est ma dernière relance sur ce dossier : sans nouvelles, je considère
   que le timing n'est pas bon et je passe à autre chose. La porte reste
   ouverte — écrivez-moi quand vous voulez.</p>
<p>Belle journée,<br/>L'équipe TDIA</p>`,
  },
];

// Copies SMS pro : vouvoiement, sans emoji, CTA `TDIA` (rappel humain) et
// opt-out `STOP` (conformité Twilio/CRTC). Chaque message est calibré
// < 160 car. GSM-7 pour rester en un seul segment — évite donc les accents
// ê/ô/î/û/â/ï qui forceraient l'encodage UCS-2 (70 car./segment).
const SMS_COPY: Array<(l: Lead) => string> = [
  (l) =>
    `Bonjour${l.first_name ? " " + l.first_name : ""}, ici L'équipe TDIA. Merci pour votre demande — souhaitez-vous qu'on vous rappelle pour en discuter ? Répondez TDIA, STOP pour ne plus recevoir.`,
  (l) =>
    `Bonjour${l.first_name ? " " + l.first_name : ""}, souhaitez-vous toujours qu'on vous rappelle au sujet de votre projet publicitaire ? Répondez TDIA, STOP pour ne plus recevoir.`,
  (l) =>
    `Bonjour${l.first_name ? " " + l.first_name : ""}, est-ce toujours le bon moment pour discuter de vos campagnes publicitaires ? Répondez TDIA pour un rappel, STOP pour ne plus recevoir.`,
  (l) =>
    `Bonjour${l.first_name ? " " + l.first_name : ""}, nous ne voulons pas vous déranger — souhaitez-vous encore qu'on vous contacte ? Répondez TDIA, STOP pour ne plus recevoir.`,
  (l) =>
    `Bonjour${l.first_name ? " " + l.first_name : ""}, un simple mot nous aiderait à savoir si vous souhaitez avancer. Répondez TDIA pour un rappel, STOP pour ne plus recevoir.`,
  (l) =>
    `Bonjour${l.first_name ? " " + l.first_name : ""}, dernier message de notre part. Répondez TDIA si vous voulez qu'on vous rappelle, sinon STOP pour ne plus recevoir.`,
];

function renderEmail(lead: Lead): { subject: string; html: string } {
  const idx = Math.min(Math.max(lead.followup_count ?? 0, 0), MAX_FOLLOWUPS - 1);
  const copy = EMAIL_COPY[idx];
  const html = `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6;max-width:560px">
  ${copy.body(lead).trim()}
  <p style="color:#888;font-size:11px;margin-top:32px">
    Réf. lead : ${lead.lead_code} · Relance ${idx + 1}/${MAX_FOLLOWUPS}
  </p>
</div>`.trim();
  return { subject: copy.subject, html };
}

function renderSms(lead: Lead): string {
  const idx = Math.min(Math.max(lead.followup_count ?? 0, 0), MAX_FOLLOWUPS - 1);
  return SMS_COPY[idx](lead);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let forceLeadCode: string | null = null;
    let forceChannel: "email" | "sms" | "both" = "both";
    let manual = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.lead_code && typeof body.lead_code === "string") {
          forceLeadCode = body.lead_code;
        }
        if (body?.channel === "email" || body?.channel === "sms") {
          forceChannel = body.channel;
        }
        if (body?.manual === true) manual = true;
      } catch {
        /* no body */
      }
    }

    const nowIso = new Date().toISOString();
    const nextIso = new Date(Date.now() + NEXT_INTERVAL_MS).toISOString();

    let query = supabase
      .from("sales_leads")
      .select(
        "lead_code, first_name, last_name, company, email, phone, status, next_followup_at, followup_count, responded_at, owner_id",
      );
    if (forceLeadCode) {
      query = query.eq("lead_code", forceLeadCode);
    } else {
      query = query
        .not("status", "in", "(won,lost)")
        .is("responded_at", null)
        .lt("followup_count", MAX_FOLLOWUPS)
        .not("next_followup_at", "is", null)
        .lte("next_followup_at", nowIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    let emailSent = 0;
    let smsSent = 0;
    let smsSkipped = 0;
    let stopped = 0;
    const results: Array<{
      lead_code: string;
      emailSent: boolean;
      smsSent: boolean;
      smsSkipped: boolean;
      count?: number;
      nextAt?: string | null;
      error?: string;
    }> = [];

    for (const raw of data ?? []) {
      const lead = raw as Lead;

      // Un envoi manuel (bouton admin) doit toujours partir : on ne bloque
      // que si le lead est fermé (won/lost). Les gates responded_at / cap 6
      // restent en place pour le cron uniquement.
      const shouldSkip = manual
        ? lead.status === "won" || lead.status === "lost"
        : lead.responded_at ||
          lead.followup_count >= MAX_FOLLOWUPS ||
          lead.status === "won" ||
          lead.status === "lost";
      if (shouldSkip) {
        results.push({
          lead_code: lead.lead_code,
          emailSent: false,
          smsSent: false,
          smsSkipped: false,
          error: manual
            ? "skipped (lead fermé — won/lost)"
            : "skipped (responded, capped, or closed)",
        });
        continue;
      }

      let didEmail = false;
      let smsRes: SmsResult = { sent: false, skipped: true };
      let leadError: string | undefined;
      const wantEmail = forceChannel === "email" || forceChannel === "both";
      const wantSms = forceChannel === "sms" || forceChannel === "both";

      if (wantEmail && lead.email) {
        try {
          const { subject, html } = renderEmail(lead);
          await sendResendEmail({
            apiKey: RESEND_API_KEY,
            from: FROM,
            to: lead.email,
            subject,
            html,
          });
          didEmail = true;
          emailSent++;
        } catch (e) {
          leadError = `email: ${(e as Error).message}`;
        }
      }

      if (wantSms && lead.phone) {
        smsRes = await sendSms(lead.phone, renderSms(lead));
        if (smsRes.sent) smsSent++;
        else if (smsRes.skipped) smsSkipped++;
        if (smsRes.error) leadError = (leadError ? leadError + " · " : "") + `sms: ${smsRes.error}`;
      }

      if (didEmail || smsRes.sent) {
        const newCount = (lead.followup_count ?? 0) + 1;
        const nextAt = newCount >= MAX_FOLLOWUPS ? null : nextIso;
        if (nextAt === null) stopped++;
        await supabase
          .from("sales_leads")
          .update({
            last_followup_at: nowIso,
            followup_count: newCount,
            next_followup_at: nextAt,
          })
          .eq("lead_code", lead.lead_code);
        results.push({
          lead_code: lead.lead_code,
          emailSent: didEmail,
          smsSent: smsRes.sent,
          smsSkipped: smsRes.skipped,
          count: newCount,
          nextAt,
          error: leadError,
        });
      } else {
        results.push({
          lead_code: lead.lead_code,
          emailSent: false,
          smsSent: false,
          smsSkipped: smsRes.skipped,
          error: leadError,
        });
      }
    }

    const payload = forceLeadCode
      ? {
          ok: true,
          ...(results[0] ?? { emailSent: false, smsSent: false, smsSkipped: false }),
        }
      : {
          ok: true,
          scanned: data?.length ?? 0,
          emailSent,
          smsSent,
          smsSkipped,
          stopped,
          results,
        };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
