// Shared helpers for Google OAuth (GA4 / Google Ads).
// Credentials are stored in Supabase Vault via helpers in ./vault.ts.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { readConnectionSecret, storeConnectionSecret } from "./vault.ts";

const CLIENT_ID = () => Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = () => Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const secret = CLIENT_SECRET();
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET missing");
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(CLIENT_SECRET());
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

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return await res.json() as GoogleTokenResponse;
}

export async function refreshWithToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return await res.json() as GoogleTokenResponse;
}

/** Loads the connection, reads creds from Vault, refreshes if <60s remaining, persists back to Vault. */
export async function getFreshAccessToken(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<{ accessToken: string; connection: Record<string, unknown>; expiresAt: number }> {
  const { data: conn, error } = await supabase
    .from("gos_integration_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !conn) throw new Error("connection not found");

  const creds = (await readConnectionSecret(supabase, conn.vault_secret_id)) || {};
  const refreshToken = String(creds.refresh_token || "");
  if (!refreshToken) throw new Error("missing refresh_token — reconnect required");

  const accessToken = String(creds.access_token || "");
  const expiresAt = Number(creds.access_token_expires_at || 0);
  const now = Date.now();

  if (accessToken && expiresAt - 60_000 > now) {
    return { accessToken, connection: conn, expiresAt };
  }

  const refreshed = await refreshWithToken(refreshToken);
  const newExpiresAt = now + (refreshed.expires_in ?? 3600) * 1000;
  const newCreds = {
    ...creds,
    access_token: refreshed.access_token,
    access_token_expires_at: newExpiresAt,
    token_type: refreshed.token_type ?? creds.token_type ?? "Bearer",
    refresh_token: refreshed.refresh_token ?? refreshToken,
  };
  await storeConnectionSecret(supabase, connectionId, conn.vault_secret_id, newCreds);

  return { accessToken: refreshed.access_token, connection: conn, expiresAt: newExpiresAt };
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
