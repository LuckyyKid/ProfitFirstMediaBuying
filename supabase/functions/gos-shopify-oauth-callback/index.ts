// Phase 11B — Shopify OAuth : callback
// Shopify calls this after merchant approves. Verifies HMAC + state, exchanges code -> access_token,
// stores credentials in gos_integration_connections (upsert by client_id + provider='shopify').

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { storeConnectionSecret } from "../_shared/vault.ts";

const API_KEY = Deno.env.get("SHOPIFY_APP_API_KEY")!;
const API_SECRET = Deno.env.get("SHOPIFY_APP_API_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (b64url(expected) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Shopify HMAC: sort params (excl. hmac & signature), form-encode, HMAC-SHA256 with API_SECRET, hex compare.
async function verifyShopifyHmac(url: URL): Promise<boolean> {
  const providedHmac = url.searchParams.get("hmac");
  if (!providedHmac) return false;
  const pairs: string[] = [];
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "hmac" || k === "signature") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const msg = pairs.join("&");
  const computed = await hmacSha256Hex(API_SECRET, msg);
  // constant-time-ish compare
  if (computed.length !== providedHmac.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ providedHmac.charCodeAt(i);
  return diff === 0;
}

function htmlResponse(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:60px auto;padding:24px;color:#2b2318;background:#faf7f2;border-radius:12px}
    h1{font-size:20px;margin:0 0 12px}p{color:#6b5d47;line-height:1.5}code{background:#efe9df;padding:2px 6px;border-radius:4px;font-size:12px}</style></head>
    <body><h1>${title}</h1>${body}</body></html>`;
  return new Response(html, { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");

  console.log("[shopify-callback] 🔵 hit", { shop, hasCode: !!code, hasState: !!state, url: url.toString() });

  if (!code || !shop || !state) {
    console.error("[shopify-callback] ❌ missing params", { code: !!code, shop, state: !!state });
    return htmlResponse("Paramètres manquants", "<p>La requête Shopify est incomplète (code / shop / state).</p>", 400);
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    console.error("[shopify-callback] ❌ invalid shop domain", shop);
    return htmlResponse("Shop invalide", `<p><code>${shop}</code> n'est pas un domaine Shopify valide.</p>`, 400);
  }


  // 1. Verify Shopify's HMAC on the callback query string
  const hmacOk = await verifyShopifyHmac(url);
  console.log("[shopify-callback] HMAC check:", hmacOk);
  if (!hmacOk) {
    console.error("[shopify-callback] ❌ HMAC invalide");
    return htmlResponse("HMAC invalide", "<p>La signature Shopify n'a pas pu être vérifiée. Requête rejetée.</p>", 401);
  }

  // 2. Verify our own signed state (CSRF + client_id)
  const stateData = await verifyState(state);
  console.log("[shopify-callback] state decoded:", stateData);
  if (!stateData || typeof stateData.client_id !== "string" || stateData.shop !== shop) {
    console.error("[shopify-callback] ❌ state invalide", { stateData, shop });
    return htmlResponse("State invalide", "<p>Le paramètre state est invalide ou expiré. Recommence la connexion depuis TDIA GOS.</p>", 401);
  }

  const clientId = stateData.client_id as string;
  const returnTo = (stateData.return_to as string) || "";
  console.log("[shopify-callback] clientId:", clientId, "returnTo:", returnTo);

  // 3. Exchange authorization code for access token
  console.log("[shopify-callback] 🔄 exchanging code for token...");
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error("[shopify-callback] ❌ token exchange failed", tokenRes.status, t);
    return htmlResponse("Échange de token échoué", `<p>Shopify a répondu <code>${tokenRes.status}</code>.</p><pre>${t}</pre>`, 500);
  }

  const tokenJson = await tokenRes.json();
  const accessToken: string | undefined = tokenJson.access_token;
  const scope: string | undefined = tokenJson.scope;
  console.log("[shopify-callback] ✅ token received, scope:", scope, "tokenLen:", accessToken?.length);

  if (!accessToken) {
    console.error("[shopify-callback] ❌ no access_token in response", tokenJson);
    return htmlResponse("Access token manquant", "<p>Shopify n'a pas retourné d'access token.</p>", 500);
  }

  // 4. Upsert into gos_integration_connections (service role bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  const { data: existing, error: selErr } = await supabase
    .from("gos_integration_connections")
    .select("id, vault_secret_id")
    .eq("client_id", clientId)
    .eq("provider", "shopify")
    .maybeSingle();
  console.log("[shopify-callback] existing row:", existing, "selErr:", selErr?.message);

  const record = {
    client_id: clientId,
    provider: "shopify",
    display_name: "Shopify",
    status: "connected",
    config: { shop_domain: shop, scopes: scope, connected_via: "oauth" },
    notes: `OAuth installé le ${nowIso}`,
  };

  let connectionId: string;
  let currentVaultId: string | null = null;
  if (existing?.id) {
    const { error: updErr } = await supabase.from("gos_integration_connections").update(record).eq("id", existing.id);
    console.log("[shopify-callback] UPDATE existing", existing.id, "err:", updErr?.message);
    if (updErr) return htmlResponse("Erreur enregistrement", `<pre>${updErr.message}</pre>`, 500);
    connectionId = existing.id as string;
    currentVaultId = (existing.vault_secret_id as string | null) ?? null;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("gos_integration_connections")
      .insert([record])
      .select("id")
      .single();
    console.log("[shopify-callback] INSERT new", ins?.id, "err:", insErr?.message);
    if (insErr || !ins) return htmlResponse("Erreur enregistrement", `<pre>${insErr?.message ?? "unknown"}</pre>`, 500);
    connectionId = ins.id as string;
  }

  try {
    await storeConnectionSecret(supabase, connectionId, currentVaultId, { admin_access_token: accessToken });
    console.log("[shopify-callback] ✅ vault secret stored for connection", connectionId);
  } catch (e) {
    console.error("[shopify-callback] ❌ vault store failed:", e);
    return htmlResponse("Vault error", `<pre>${(e as Error).message}</pre>`, 500);
  }


  // 5. Redirect back to app (if we have a safe return URL) or show success page
  if (returnTo && /^https?:\/\//.test(returnTo)) {
    const back = new URL(returnTo);
    back.searchParams.set("shopify_connected", "1");
    back.searchParams.set("shop", shop);
    console.log("[shopify-callback] ✅ redirecting back to app:", back.toString());
    return Response.redirect(back.toString(), 302);
  }
  console.log("[shopify-callback] ✅ done, no returnTo — showing success HTML");


  return htmlResponse(
    "Shopify connecté ✓",
    `<p>La boutique <code>${shop}</code> est maintenant connectée à TDIA GOS.</p>
     <p>Tu peux fermer cet onglet et retourner dans l'app.</p>`,
  );
});
