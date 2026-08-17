import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// channel routing:
//   "profile"               -> SLACK_WEBHOOK_URL                       (#head-of-things, default)
//   "tracker"               -> SLACK_WEBHOOK_URL_TRACKER               (client onboarding tracker)
//   "alerts"                -> SLACK_WEBHOOK_URL_ALERTS                (#alertes-comptes — ad anomaly S1/S2/S3)
//   "heartbeat"             -> SLACK_WEBHOOK_URL_HEARTBEAT             (#ops-heartbeat — daily ad anomaly green check)
//   "automations_alerts"    -> SLACK_WEBHOOK_URL_AUTOMATIONS_ALERTS    (#automations-alertes — workflow failures / cadence-missed)
//   "automations_heartbeat" -> SLACK_WEBHOOK_URL_AUTOMATIONS_HEARTBEAT (#automations-heartbeat — daily watchdog green check)
//   "client_nps"            -> SLACK_WEBHOOK_URL_CLIENT_NPS            (#client-nps — rappel jour du meeting si NPS hebdo non rempli)
const CHANNEL_ENV: Record<string, string> = {
  profile: "SLACK_WEBHOOK_URL",
  tracker: "SLACK_WEBHOOK_URL_TRACKER",
  alerts: "SLACK_WEBHOOK_URL_ALERTS",
  heartbeat: "SLACK_WEBHOOK_URL_HEARTBEAT",
  automations_alerts: "SLACK_WEBHOOK_URL_AUTOMATIONS_ALERTS",
  automations_heartbeat: "SLACK_WEBHOOK_URL_AUTOMATIONS_HEARTBEAT",
  client_nps: "SLACK_WEBHOOK_URL_CLIENT_NPS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { channel, text, blocks } = await req.json();
    const envKey = CHANNEL_ENV[channel as string] ?? CHANNEL_ENV.profile;
    const url = Deno.env.get(envKey);
    if (!url) throw new Error(`Slack webhook for channel "${channel}" (${envKey}) not configured`);

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
