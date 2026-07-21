// Google OAuth callback. Google redirects here with ?code=&state=.
// Verifies state, exchanges code -> tokens, upserts gos_integration_connections
// with status="pending_property" (property selection happens in-app).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifyState, exchangeCodeForTokens, serviceClient } from "../_shared/google-oauth.ts";
import { storeConnectionSecret } from "../_shared/vault.ts";

const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") || "";

function htmlResponse(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:60px auto;padding:24px;color:#e2e8f0;background:#0f172a;border-radius:12px}
    h1{font-size:20px;margin:0 0 12px;color:#fff}p{color:#94a3b8;line-height:1.5}code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px}</style></head>
    <body><h1>${title}</h1>${body}</body></html>`;
  return new Response(html, { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Try to recover returnTo from state to bounce errors back to the UI
  let returnToFromState = "";
  if (state) {
    try {
      const payload = await verifyState(state);
      if (payload && typeof payload.return_to === "string") returnToFromState = payload.return_to;
    } catch { /* ignore */ }
  }

  const bounceError = (code: string, detail?: string): Response => {
    if (returnToFromState && /^https?:\/\//.test(returnToFromState)) {
      const back = new URL(returnToFromState);
      back.searchParams.set("ga4_error", code);
      if (detail) back.searchParams.set("ga4_error_detail", detail.slice(0, 200));
      return Response.redirect(back.toString(), 302);
    }
    return htmlResponse("Autorisation Google échouée", `<p>Code : <code>${code}</code></p>${detail ? `<pre>${detail}</pre>` : ""}`, 400);
  };

  if (oauthError) {
    console.warn("[gos-google-oauth-callback] Google returned error=", oauthError);
    return bounceError(oauthError);
  }
  if (!code || !state) {
    return bounceError("missing_params");
  }

  const payload = await verifyState(state);
  if (!payload || typeof payload.client_id !== "string" || typeof payload.provider !== "string") {
    return htmlResponse("State invalide", "<p>Le paramètre state est invalide ou expiré. Recommence depuis TDIA GOS.</p>", 401);
  }
  const clientId = payload.client_id as string;
  const provider = payload.provider as string;
  const returnTo = (payload.return_to as string) || "";

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, REDIRECT_URI);
  } catch (e) {
    return htmlResponse("Échange de token échoué", `<pre>${e instanceof Error ? e.message : String(e)}</pre>`, 500);
  }

  if (!tokens.refresh_token) {
    return htmlResponse(
      "Refresh token manquant",
      "<p>Google n'a pas retourné de refresh_token (déjà autorisé sans re-consent). Va sur <a href='https://myaccount.google.com/permissions' style='color:#60a5fa'>myaccount.google.com/permissions</a>, révoque l'accès à cette app, puis recommence.</p>",
      500,
    );
  }

  const supabase = serviceClient();
  const nowIso = new Date().toISOString();
  const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;

  const { data: existing } = await supabase
    .from("gos_integration_connections")
    .select("id, config, vault_secret_id")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .maybeSingle();

  const prevConfig = (existing?.config || {}) as Record<string, unknown>;
  const record = {
    client_id: clientId,
    provider,
    display_name: provider === "ga4" ? "Google Analytics 4" : provider === "google_ads" ? "Google Ads" : provider,
    status: provider === "ga4" ? (prevConfig.property_id ? "connected" : "pending_property") : "connected",
    config: {
      ...prevConfig,
      connected_via: "oauth",
      scopes: tokens.scope,
    },
    notes: `OAuth ${nowIso}`,
  };

  let connectionId: string;
  let currentVaultId: string | null = null;
  if (existing?.id) {
    await supabase.from("gos_integration_connections").update(record).eq("id", existing.id);
    connectionId = existing.id as string;
    currentVaultId = (existing.vault_secret_id as string | null) ?? null;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("gos_integration_connections")
      .insert([record])
      .select("id")
      .single();
    if (insErr || !ins) {
      return htmlResponse("Erreur enregistrement", `<pre>${insErr?.message ?? "unknown"}</pre>`, 500);
    }
    connectionId = ins.id as string;
  }

  await storeConnectionSecret(supabase, connectionId, currentVaultId, {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expires_at: expiresAt,
    token_type: tokens.token_type ?? "Bearer",
  });

  if (returnTo && /^https?:\/\//.test(returnTo)) {
    const back = new URL(returnTo);
    back.searchParams.set(`${provider}_connected`, "1");
    back.searchParams.set("connection_id", connectionId);
    return Response.redirect(back.toString(), 302);
  }

  return htmlResponse(
    "Google connecté ✓",
    "<p>Retourne dans TDIA GOS pour choisir la propriété GA4.</p>",
  );
});
