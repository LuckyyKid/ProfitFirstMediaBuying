import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const CHANNEL = "client-profile";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN missing");
    const p = await req.json();

    const text =
      `Bonjour Voici le profile du client :\n\n` +
      `client_id : ${p.client_id ?? ""}\n\n` +
      `client_code : ${p.client_code ?? ""}\n\n` +
      `source : ${p.source ?? ""}\n\n` +
      `nom de la compagnie : ${p.company_name ?? ""}\n\n` +
      `deal value : ${p.deal_value ?? ""}\n\n` +
      `closing date : ${p.closing_date ?? ""}\n\n` +
      `supervisor name : ${p.supervisor_name ?? ""}\n\n` +
      `Nom du client  : ${p.owner_name ?? ""}\n\n` +
      `Nom du business : ${p.business_name ?? ""}\n\n` +
      `email : ${p.contact_email ?? ""}\n\n` +
      `telephone  : ${p.contact_phone ?? ""}\n\n` +
      `budget ads : ${p.ad_budget ?? ""}\n\n` +
      `has_run_ads : ${p.has_run_ads ?? ""}\n\n` +
      `owner paint point : ${p.owner_pain_point ?? ""}`;

    async function post(channel: string) {
      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel, text }),
      });
      return r.json();
    }

    // 1) Try posting directly by name (works for public channels)
    let pj = await post(`#${CHANNEL}`);

    // 2) If not in channel, try to join (public channels only) and retry
    if (!pj.ok && (pj.error === "not_in_channel" || pj.error === "channel_not_found")) {
      // Look up channel id across public + private
      let channelId: string | null = null;
      let cursor = "";
      do {
        const r = await fetch(
          `https://slack.com/api/conversations.list?limit=200&types=public_channel,private_channel${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } },
        );
        const j = await r.json();
        if (!j.ok) break;
        const hit = j.channels?.find((c: any) => c.name === CHANNEL);
        if (hit) { channelId = hit.id; break; }
        cursor = j.response_metadata?.next_cursor || "";
      } while (cursor);

      if (channelId) {
        await fetch("https://slack.com/api/conversations.join", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({ channel: channelId }),
        });
        pj = await post(channelId);
      }
    }

    if (!pj.ok) throw new Error(`slack: ${pj.error} — invite the bot to #${CHANNEL}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-slack-client-profile]", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
