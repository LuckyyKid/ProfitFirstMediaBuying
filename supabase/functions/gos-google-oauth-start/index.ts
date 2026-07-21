// GA4 (Google) OAuth start.
// GET /gos-google-oauth-start?client_id=<uuid>&provider=ga4&redirect=<return_url>
// Redirects the admin to Google's consent screen.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { signState } from "../_shared/google-oauth.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") || "";
const GA4_SCOPES = "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_ADS_SCOPES = "https://www.googleapis.com/auth/adwords";
const DEFAULT_SCOPES = Deno.env.get("GOOGLE_SCOPES") || GA4_SCOPES;

const PROVIDER_SCOPES: Record<string, string> = {
  ga4: GA4_SCOPES,
  google_ads: GOOGLE_ADS_SCOPES,
};

const ALLOWED_PROVIDERS = new Set(["ga4", "google_ads"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!CLIENT_ID || !REDIRECT_URI) {
      return json({ error: "GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URI not configured" }, 500);
    }
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    const provider = (url.searchParams.get("provider") || "ga4").toLowerCase();
    const returnTo = url.searchParams.get("redirect") || "";

    if (!clientId) return json({ error: "client_id required" }, 400);
    if (!ALLOWED_PROVIDERS.has(provider)) {
      return json({ error: `provider ${provider} not enabled` }, 400);
    }

    const state = await signState({
      client_id: clientId,
      provider,
      return_to: returnTo,
      nonce: crypto.randomUUID(),
      exp: Date.now() + 10 * 60_000,
    });

    const scopes = PROVIDER_SCOPES[provider] || DEFAULT_SCOPES;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent"); // force refresh_token every time
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    // Server-side log without secrets (redact client_id + state)
    const safe = new URL(authUrl.toString());
    safe.searchParams.set("client_id", "[REDACTED]");
    safe.searchParams.set("state", "[REDACTED]");
    console.log("[gos-google-oauth-start] provider=", provider, "redirect_uri=", REDIRECT_URI, "scope=", scopes, "auth_url=", safe.toString());

    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return json({ install_url: authUrl.toString() });
    }
    return Response.redirect(authUrl.toString(), 302);
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
