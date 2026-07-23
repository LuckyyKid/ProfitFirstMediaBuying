// Posts a yearly reminder in Slack #head-of-things telling the team to buy
// Christmas gifts for each active client. Triggered by pg_cron on Dec 1.
//
// Manual invocation: POST {} (idempotency guaranteed by seasonal_slack_sends).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = Deno.env.get("SLACK_BOT_TOKEN");
    if (!token) throw new Error("Missing SLACK_BOT_TOKEN");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const year = new Date().getUTCFullYear();

    // Idempotency: only post once per year.
    const { data: prior } = await sb
      .from("seasonal_slack_sends")
      .select("id")
      .eq("type", "christmas_gifts_reminder")
      .eq("year", year)
      .maybeSingle();
    if (prior) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_posted_this_year", year }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: clients, error } = await sb
      .from("client_progress")
      .select("client_code, client_name, company_name, email")
      .is("archived_at", null)
      .order("company_name", { ascending: true });
    if (error) throw error;

    const list = (clients ?? [])
      .filter((c) => c.client_name || c.company_name)
      .map((c) => {
        const name = c.client_name || "—";
        const company = c.company_name ? ` (${c.company_name})` : "";
        const email = c.email ? ` — ${c.email}` : "";
        return `• ${name}${company}${email}`;
      })
      .join("\n");

    const text = [
      `🎁 *Rappel cadeaux de Noël — commandez cette semaine*`,
      ``,
      `Il reste ~3 semaines avant Noël. Voici les ${clients?.length ?? 0} clients actifs à qui envoyer un cadeau :`,
      ``,
      list || "_aucun client actif_",
      ``,
      `Budget / idées : à discuter en réunion. Adresses de livraison à confirmer auprès de chaque client.`,
      `🔗 https://tdiaonboarding.lovable.app/admin/followups`,
    ].join("\n");

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: "head-of-things", text, mrkdwn: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(`Slack post failed: ${data?.error || res.status}`);
    }

    await sb.from("seasonal_slack_sends").insert({
      type: "christmas_gifts_reminder",
      year,
      channel: "head-of-things",
      client_count: clients?.length ?? 0,
    });

    return new Response(JSON.stringify({ ok: true, year, client_count: clients?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
