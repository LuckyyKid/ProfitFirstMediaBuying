// Follow-up des leads dans le pipeline commercial.
//
// Deux modes :
//   1. Cron (aucun body) → scanne tous les leads avec next_followup_at <= now
//      dont le statut n'est ni "won" ni "lost", envoie email + tente SMS,
//      met à jour last_followup_at et incrémente followup_count.
//   2. Manuel (POST { lead_code, manual: true }) → force la relance sur un seul lead.
//
// Le canal SMS est un stub (voir sendSms plus bas) : dès qu'un provider Twilio
// est branché, il enverra vraiment sans changement côté appelant.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";

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
  owner_id: string | null;
}

interface SmsResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

async function sendSms(_phone: string, _body: string): Promise<SmsResult> {
  // TODO: brancher Twilio ici.
  //   const sid  = Deno.env.get("TWILIO_ACCOUNT_SID");
  //   const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  //   const from = Deno.env.get("TWILIO_FROM_NUMBER");
  //   if (!sid || !auth || !from) return { sent: false, skipped: true };
  //   const res = await fetch(
  //     `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
  //     {
  //       method: "POST",
  //       headers: {
  //         Authorization: "Basic " + btoa(`${sid}:${auth}`),
  //         "Content-Type": "application/x-www-form-urlencoded",
  //       },
  //       body: new URLSearchParams({ To: _phone, From: from, Body: _body }),
  //     },
  //   );
  //   if (!res.ok) return { sent: false, skipped: false, error: `Twilio ${res.status}` };
  //   return { sent: true, skipped: false };
  return { sent: false, skipped: true };
}

function greeting(lead: Lead): string {
  return lead.first_name ? `Bonjour ${lead.first_name},` : "Bonjour,";
}

function renderEmail(lead: Lead): string {
  const g = greeting(lead);
  const company = lead.company ? ` chez ${lead.company}` : "";
  return `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6;max-width:560px">
  <p>${g}</p>
  <p>Je reviens rapidement vers vous suite à notre discussion${company}.
     J'aimerais savoir si vous êtes toujours intéressé(e) à avancer sur le sujet et
     si oui, quel serait le meilleur moment pour un échange cette semaine.</p>
  <p>Vous pouvez répondre directement à cet email — je m'occupe de la suite.</p>
  <p style="margin-top:24px">Belle journée,<br/>L'équipe TDIA</p>
  <p style="color:#888;font-size:11px;margin-top:32px">Réf. lead : ${lead.lead_code}</p>
</div>`.trim();
}

function renderSms(lead: Lead): string {
  const name = lead.first_name ? `${lead.first_name}, ` : "";
  return `${name}c'est TDIA — on donne suite à notre échange ? Répondez à ce SMS ou à l'email envoyé, on s'occupe du reste.`;
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
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.lead_code && typeof body.lead_code === "string") {
          forceLeadCode = body.lead_code;
        }
      } catch {
        /* no body */
      }
    }

    const nowIso = new Date().toISOString();

    let query = supabase
      .from("sales_leads")
      .select(
        "lead_code, first_name, last_name, company, email, phone, status, next_followup_at, followup_count, owner_id",
      );
    if (forceLeadCode) {
      query = query.eq("lead_code", forceLeadCode);
    } else {
      query = query
        .not("status", "in", "(won,lost)")
        .not("next_followup_at", "is", null)
        .lte("next_followup_at", nowIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    let emailSent = 0;
    let smsSent = 0;
    let smsSkipped = 0;
    const results: Array<{
      lead_code: string;
      emailSent: boolean;
      smsSent: boolean;
      smsSkipped: boolean;
      error?: string;
    }> = [];

    for (const raw of data ?? []) {
      const lead = raw as Lead;
      let didEmail = false;
      let smsRes: SmsResult = { sent: false, skipped: true };
      let leadError: string | undefined;

      if (lead.email) {
        try {
          await sendResendEmail({
            apiKey: RESEND_API_KEY,
            from: FROM,
            to: lead.email,
            subject: "On donne suite ?",
            html: renderEmail(lead),
          });
          didEmail = true;
          emailSent++;
        } catch (e) {
          leadError = `email: ${(e as Error).message}`;
        }
      }

      if (lead.phone) {
        smsRes = await sendSms(lead.phone, renderSms(lead));
        if (smsRes.sent) smsSent++;
        else if (smsRes.skipped) smsSkipped++;
        if (smsRes.error) leadError = (leadError ? leadError + " · " : "") + `sms: ${smsRes.error}`;
      }

      if (didEmail || smsRes.sent) {
        await supabase
          .from("sales_leads")
          .update({
            last_followup_at: nowIso,
            followup_count: (lead.followup_count ?? 0) + 1,
          })
          .eq("lead_code", lead.lead_code);
      }

      results.push({
        lead_code: lead.lead_code,
        emailSent: didEmail,
        smsSent: smsRes.sent,
        smsSkipped: smsRes.skipped,
        error: leadError,
      });
    }

    const payload = forceLeadCode
      ? {
          ok: true,
          ...(results[0] ?? { emailSent: false, smsSent: false, smsSkipped: false }),
        }
      : { ok: true, scanned: data?.length ?? 0, emailSent, smsSent, smsSkipped, results };

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
