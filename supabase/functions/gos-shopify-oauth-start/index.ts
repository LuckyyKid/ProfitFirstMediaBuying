// Phase 11B — Shopify OAuth : start
// Redirects the admin to Shopify's install/authorize page.
// GET /gos-shopify-oauth-start?client_id=<uuid>&shop=<xxx.myshopify.com>[&redirect=<app-return-url>]
// State is an HMAC-signed JSON payload — no DB table needed for CSRF.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_KEY = Deno.env.get("SHOPIFY_APP_API_KEY")!;
const API_SECRET = Deno.env.get("SHOPIFY_APP_API_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SCOPES = "read_orders,read_products,read_customers,read_inventory,read_price_rules,read_discounts,read_reports";

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

function isValidShop(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    const shopRaw = (url.searchParams.get("shop") || "").trim().toLowerCase();
    const returnTo = url.searchParams.get("redirect") || "";

    const shop = shopRaw.endsWith(".myshopify.com") ? shopRaw : `${shopRaw}.myshopify.com`;

    if (!clientId || !isValidShop(shop)) {
      return new Response(JSON.stringify({ error: "client_id and valid shop (xxx.myshopify.com) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nonce = crypto.randomUUID();
    const state = await signState({ client_id: clientId, shop, nonce, return_to: returnTo, exp: Date.now() + 10 * 60_000 });

    const redirectUri = `${SUPABASE_URL}/functions/v1/gos-shopify-oauth-callback`;
    const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    installUrl.searchParams.set("client_id", API_KEY);
    installUrl.searchParams.set("scope", SCOPES);
    installUrl.searchParams.set("redirect_uri", redirectUri);
    installUrl.searchParams.set("state", state);
    installUrl.searchParams.set("grant_options[]", "per-user"); // online access token; remove for offline

    // If called from browser, redirect. If called via fetch, return URL as JSON.
    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return new Response(JSON.stringify({ install_url: installUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return Response.redirect(installUrl.toString(), 302);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
