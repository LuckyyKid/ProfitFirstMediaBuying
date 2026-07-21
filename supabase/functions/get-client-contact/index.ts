// Returns the Slack channel + email associated with a client.
// Used by agents to send Slack invitations and emails to the client.
//
// Auth: requires `Authorization: Bearer <TDIA_API_TOKEN>` header.
//
// GET/POST  /functions/v1/get-client-contact
//   ?client=<client_code OR client_id>
//   or JSON body: { "client": "..." }  /  { "client_code": "..." }  /  { "client_id": "..." }
//
// Response:
// {
//   client_id, client_code, company_name, email,
//   slack: { channel_id, channel_name, user_id, invite_url }
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // --- Auth ---
  const expected = Deno.env.get("TDIA_API_TOKEN");
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!expected || token !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  // --- Parse client ref ---
  let ref: string | null = null;
  const url = new URL(req.url);
  ref =
    url.searchParams.get("client") ||
    url.searchParams.get("client_code") ||
    url.searchParams.get("client_id");

  if (!ref && (req.method === "POST" || req.method === "PUT")) {
    try {
      const body = await req.json();
      ref = body?.client ?? body?.client_code ?? body?.client_id ?? null;
    } catch (_) { /* ignore */ }
  }

  if (!ref || typeof ref !== "string") {
    return json({ error: "Missing `client` (client_code or client_id)" }, 400);
  }
  ref = ref.trim();

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cols =
    "client_id, client_code, company_name, email, slack_channel_id, slack_channel_name, slack_user_id, slack_invite_url";

  const query = sb.from("client_progress").select(cols);
  const { data, error } = UUID_RE.test(ref)
    ? await query.eq("client_id", ref).maybeSingle()
    : await query.eq("client_code", ref).maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Client not found" }, 404);

  const row = data as any;
  return json({
    client_id: row.client_id,
    client_code: row.client_code,
    company_name: row.company_name,
    email: row.email,
    slack: {
      channel_id: row.slack_channel_id,
      channel_name: row.slack_channel_name,
      user_id: row.slack_user_id,
      invite_url: row.slack_invite_url,
    },
  });
});
