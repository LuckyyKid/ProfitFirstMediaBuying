// List GA4 properties the connected Google user can access.
// POST { connection_id } -> { properties: [{ property_id, display_name, account_id, account_name }] }

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFreshAccessToken, serviceClient } from "../_shared/google-oauth.ts";

interface AdminAccount {
  name: string;          // "accounts/1234567890"
  displayName?: string;
}
interface AdminProperty {
  name: string;          // "properties/123456789"
  displayName?: string;
  parent?: string;       // "accounts/1234567890"
  timeZone?: string;
  currencyCode?: string;
}

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
    const { accessToken } = await getFreshAccessToken(supabase, connection_id);

    // 1. List accounts
    const accRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!accRes.ok) {
      return json({ error: `GA4 accounts API ${accRes.status}: ${await accRes.text()}` }, 500);
    }
    const accData = await accRes.json() as { accounts?: AdminAccount[] };
    const accounts = accData.accounts || [];
    const accountName = new Map<string, string>();
    for (const a of accounts) accountName.set(a.name, a.displayName || a.name);

    // 2. List properties across all accounts (single filter query)
    const filter = accounts.map((a) => `parent:${a.name}`).join(" OR ");
    const properties: Array<{ property_id: string; display_name: string; account_id: string; account_name: string; time_zone?: string; currency_code?: string }> = [];

    if (filter) {
      const propRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties?filter=${encodeURIComponent(filter)}&pageSize=200`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!propRes.ok) {
        return json({ error: `GA4 properties API ${propRes.status}: ${await propRes.text()}` }, 500);
      }
      const propData = await propRes.json() as { properties?: AdminProperty[] };
      for (const p of propData.properties || []) {
        const propId = p.name.replace(/^properties\//, "");
        const accId = (p.parent || "").replace(/^accounts\//, "");
        properties.push({
          property_id: propId,
          display_name: p.displayName || propId,
          account_id: accId,
          account_name: accountName.get(p.parent || "") || accId,
          time_zone: p.timeZone,
          currency_code: p.currencyCode,
        });
      }
    }

    return json({ ok: true, properties });
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
