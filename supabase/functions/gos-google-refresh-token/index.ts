// Admin-only helper: force-refresh a connection's Google access_token.
// POST { connection_id } — requires a valid Supabase user JWT.
// Never returns the refresh_token; returns { access_token, expires_at }.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFreshAccessToken, serviceClient } from "../_shared/google-oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { connection_id } = await req.json();
    if (!connection_id) return json({ error: "connection_id required" }, 400);

    const supabase = serviceClient();
    const { accessToken, expiresAt } = await getFreshAccessToken(supabase, connection_id);
    return json({ ok: true, access_token: accessToken, expires_at: expiresAt });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
