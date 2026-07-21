// Webhook called by the external (closer) project when a client is signed.
// Creates the client_progress row and notifies the #client-profile Slack channel.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const secretHeader = req.headers.get("x-webhook-secret");
    const expected = Deno.env.get("WEBHOOK_CLIENT_SIGNED_SECRET");
    if (!expected) throw new Error("WEBHOOK_CLIENT_SIGNED_SECRET not configured");
    if (secretHeader !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      client_code,
      client_id,
      client_name,
      company_name,
      email,
      phone,
      lead_source,
      deal_value,
      closing_date,
      closer_name,
      sales_supervisor,
      ad_budget,
      already_runs_ads,
      stripe_link,
      stripe_amount_expected,
    } = body ?? {};

    if (!client_code) {
      return new Response(JSON.stringify({ error: "client_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const payload = {
      client_code,
      client_id: client_id ?? null,
      client_name: client_name ?? null,
      company_name: company_name ?? null,
      brand_name: company_name ?? null,
      email: email ?? null,
      phone: phone ?? null,
      lead_source: lead_source ?? null,
      deal_value: deal_value ?? null,
      closing_date: closing_date ?? null,
      closer_name: closer_name ?? null,
      sales_supervisor: sales_supervisor ?? null,
      ad_budget: ad_budget ?? null,
      already_runs_ads: already_runs_ads ?? null,
      stripe_link: stripe_link ?? null,
      stripe_amount_expected: stripe_amount_expected ?? null,
      onboarding_sent_at: now,
      last_activity_at: now,
      current_step: 1,
      updated_at: now,
    };

    const { error } = await supabase
      .from("client_progress")
      .upsert(payload, { onConflict: "client_code" });
    if (error) throw error;

    await supabase.from("client_activity_log").insert({
      client_code,
      event_type: "client_signed",
      status: "ok",
      details: { source: "webhook", closer_name, deal_value },
    });

    // Notify Slack #client-profile
    const slackUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (slackUrl) {
      const text =
        `🎉 *Nouveau client signé*\n` +
        `• *Client:* ${client_name ?? "—"} (${client_code})\n` +
        `• *Entreprise:* ${company_name ?? "—"}\n` +
        `• *Source:* ${lead_source ?? "—"}\n` +
        `• *Deal value:* ${deal_value ?? "—"}\n` +
        `• *Budget pub:* ${ad_budget ?? "—"}\n` +
        `• *Closer:* ${closer_name ?? "—"}\n` +
        `• *Superviseur:* ${sales_supervisor ?? "—"}\n` +
        `• *Email:* ${email ?? "—"} | *Tel:* ${phone ?? "—"}\n` +
        `✅ Onboarding envoyé`;
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    }

    // Notify progress webhook (initial state)
    supabase.functions
      .invoke("notify-step-progress", { body: { client_code, force: true } })
      .catch((e) => console.error("notify-step-progress error:", e));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
