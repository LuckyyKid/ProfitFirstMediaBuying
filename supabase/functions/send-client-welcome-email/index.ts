// Sends the onboarding welcome email to the client right after a deal is closed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderWelcomeEmail } from "../_shared/email-design.ts";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONBOARDING_BASE = "https://tdiaonboarding.lovable.app";
const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const { to, client_code, company_name, contact_name, slack_invite_url, slack_channel_name, payment_url } = await req.json();
    if (!to || !client_code) throw new Error("`to` and `client_code` required");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fallback: pull payment / slack info from DB if not provided by the caller
    let finalPaymentUrl: string | null = payment_url ?? null;
    let finalSlackInvite: string | null = slack_invite_url ?? null;
    let finalSlackChannel: string | null = slack_channel_name ?? null;
    if (!finalPaymentUrl || !finalSlackInvite) {
      try {
        const { data: deal } = await sb
          .from("closed_deals")
          .select("stripe_payment_url")
          .eq("client_code", client_code)
          .maybeSingle();
        if (!finalPaymentUrl && (deal as any)?.stripe_payment_url) {
          finalPaymentUrl = (deal as any).stripe_payment_url as string;
        }
        const { data: cp } = await sb
          .from("client_progress")
          .select("slack_invite_url")
          .eq("client_code", client_code)
          .maybeSingle();
        if (!finalSlackInvite && (cp as any)?.slack_invite_url) {
          finalSlackInvite = (cp as any).slack_invite_url as string;
        }
      } catch (e) {
        console.warn("[welcome] DB fallback lookup failed:", (e as Error).message);
      }
    }

    const onboardingUrl = `${ONBOARDING_BASE}/?client=${encodeURIComponent(client_code)}`;
    const subject = "Bienvenue chez TDIA — demarrez votre onboarding";

    const html = renderWelcomeEmail({
      contactName: contact_name,
      companyName: company_name,
      clientCode: client_code,
      onboardingUrl,
      slackInviteUrl: finalSlackInvite,
      slackChannelName: finalSlackChannel,
      paymentUrl: finalPaymentUrl,
    });

    const sendResult = await sendResendEmail({ apiKey: RESEND_API_KEY, from: FROM, to, subject, html });


    try {
      await sb
        .from("client_progress")
        .update({ welcome_sent_at: new Date().toISOString() })
        .eq("client_code", client_code);
    } catch (e) {
      console.warn("[welcome] failed to mark welcome_sent_at", (e as Error).message);
    }

    return new Response(JSON.stringify({ ok: true, id: sendResult.id, redirected: sendResult.redirected, redirectedTo: sendResult.redirectedTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
