import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// channel: "profile" -> SLACK_WEBHOOK_URL ; "tracker" -> SLACK_WEBHOOK_URL_TRACKER
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { channel, text, blocks } = await req.json();
    const url =
      channel === "tracker"
        ? Deno.env.get("SLACK_WEBHOOK_URL_TRACKER")
        : Deno.env.get("SLACK_WEBHOOK_URL");
    if (!url) throw new Error(`Slack webhook for channel "${channel}" not configured`);

    const body: Record<string, unknown> = {};
    if (text) body.text = text;
    if (blocks) body.blocks = blocks;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Slack ${r.status}: ${await r.text()}`);
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
