// Posts (and pins) a welcome message in the client's private Slack channel
// with the TDIA Hub link and the Google Drive folder link.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SLACK = "https://slack.com/api";
const TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const HUB_URL = "https://tdiahub.lovable.app/";

async function slack(method: string, body: Record<string, unknown>) {
  const r = await fetch(`${SLACK}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!TOKEN) throw new Error("SLACK_BOT_TOKEN missing");
    const { channelId, contactName, driveFolderUrl } = await req.json();
    if (!channelId) throw new Error("channelId required");

    const hello = contactName ? `Bonjour ${contactName}` : "Bonjour";

    const text =
      `:wave: ${hello}, bienvenue chez *TDIA* !\n\n` +
      `Voici votre espace dédié. Toute la collaboration avec l'équipe se passe ici.\n\n` +
      `:tada: *TDIA Hub — votre plateforme centrale*\n` +
      `${HUB_URL}\n` +
      `C'est ici que vous retrouverez *tous les livrables créatifs* (visuels, vidéos, ads) ` +
      `et que vous pourrez *valider ou demander des ajustements* directement depuis une seule interface. ` +
      `Une vidéo de démonstration est disponible sur la plateforme pour vous guider.\n\n` +
      (driveFolderUrl
        ? `:file_folder: *Google Drive du projet*\n${driveFolderUrl}\n` +
          `Espace de partage pour vos fichiers bruts (logos, assets, briefs, etc.).\n\n`
        : "") +
      `_Ce message est épinglé pour que vous y ayez toujours accès._ :pushpin:`;

    // Ensure bot is in the channel (private channels need explicit invite; ignore errors)
    try {
      await slack("conversations.join", { channel: channelId });
    } catch (_) { /* private channel — bot was invited during setup */ }

    const post = await slack("chat.postMessage", {
      channel: channelId,
      text,
      unfurl_links: true,
    });
    if (!post.ok) throw new Error(`postMessage: ${post.error}`);

    const pin = await slack("pins.add", { channel: channelId, timestamp: post.ts });
    if (!pin.ok && pin.error !== "already_pinned") {
      console.warn("[slack] pin failed:", pin.error);
    }

    return new Response(JSON.stringify({ ok: true, ts: post.ts, pinned: pin.ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[post-client-slack-welcome]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
