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

async function sendSms(phone: string, body: string): Promise<SmsResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !auth || !from) return { sent: false, skipped: true };
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${sid}:${auth}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: from, Body: body }),
      },
    );
    if (!res.ok) {
      const t = await res.text();
      return { sent: false, skipped: false, error: `Twilio ${res.status}: ${t.slice(0, 160)}` };
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

const SMS_COPY: Array<(l: Lead) => string> = [
  (l) => `${l.first_name ? l.first_name + ", " : ""}c'est TDIA — on donne suite à notre échange ? Un simple oui/non m'aide 🙂`,
  (l) => `${l.first_name ? l.first_name + ", " : ""}petit rappel TDIA : dispo cette semaine pour caler un créneau si tu veux avancer.`,
  (l) => `${l.first_name ? l.first_name + ", " : ""}on n'a pas eu de retour — est-ce toujours le bon moment pour ce projet ?`,
  (l) => `${l.first_name ? l.first_name + ", " : ""}dis-moi franchement si on stoppe ou si on avance, je te laisse tranquille sinon.`,
  (l) => `${l.first_name ? l.first_name + ", " : ""}un mot rapide : on avance, on reporte, ou on ferme ?`,
  (l) => `${l.first_name ? l.first_name + ", " : ""}dernière relance de ma part — porte ouverte, écris-moi quand tu veux. TDIA`,
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
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.lead_code && typeof body.lead_code === "string") {
          forceLeadCode = body.lead_code;
        }
        if (body?.channel === "email" || body?.channel === "sms") {
          forceChannel = body.channel;
        }
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

      if (lead.responded_at || lead.followup_count >= MAX_FOLLOWUPS ||
          lead.status === "won" || lead.status === "lost") {
        results.push({
          lead_code: lead.lead_code,
          emailSent: false,
          smsSent: false,
          smsSkipped: false,
          error: "skipped (responded, capped, or closed)",
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
