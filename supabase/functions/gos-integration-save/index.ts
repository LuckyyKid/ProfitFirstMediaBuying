// Phase 1B — Save integration credentials from the UI.
// The frontend never writes credentials directly. It calls this function with
// { client_id, provider, display_name, config, credentials } and we:
//   1. Verify the caller is authenticated
//   2. Verify the caller is global_admin OR has admin/owner role on the client
//   3. Upsert gos_integration_connections row
//   4. Store credentials in Supabase Vault

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { storeConnectionSecret } from "../_shared/vault.ts";

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
    const userId = userData.user.id;

    const body = await req.json();
    const clientId = String(body?.client_id || "");
    const provider = String(body?.provider || "");
    const displayName = String(body?.display_name || provider);
    const config = (body?.config ?? {}) as Record<string, unknown>;
    const credentials = (body?.credentials ?? {}) as Record<string, unknown>;

    if (!clientId || !provider) return json({ error: "client_id and provider required" }, 400);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authorization: global_admin OR admin/owner membership on this client
    const { data: isAdminData } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "global_admin")
      .maybeSingle();
    const isGlobalAdmin = !!isAdminData;

    if (!isGlobalAdmin) {
      const { data: mem } = await svc
        .from("gos_client_members")
        .select("role")
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .maybeSingle();
      const role = mem?.role as string | undefined;
      if (!role || (role !== "admin" && role !== "owner")) {
        return json({ error: "forbidden" }, 403);
      }
    }

    // Upsert connection
    const { data: existing } = await svc
      .from("gos_integration_connections")
      .select("id, vault_secret_id")
      .eq("client_id", clientId)
      .eq("provider", provider)
      .maybeSingle();

    const record = {
      client_id: clientId,
      provider,
      display_name: displayName,
      status: "connected",
      config,
    };

    let connectionId: string;
    let currentVaultId: string | null = null;
    if (existing?.id) {
      const { error } = await svc.from("gos_integration_connections").update(record).eq("id", existing.id);
      if (error) return json({ error: error.message }, 500);
      connectionId = existing.id as string;
      currentVaultId = (existing.vault_secret_id as string | null) ?? null;
    } else {
      const { data: ins, error } = await svc
        .from("gos_integration_connections")
        .insert([record])
        .select("id")
        .single();
      if (error || !ins) return json({ error: error?.message || "insert failed" }, 500);
      connectionId = ins.id as string;
    }

    if (Object.keys(credentials).length > 0) {
      await storeConnectionSecret(svc, connectionId, currentVaultId, credentials);
    }

    return json({ ok: true, connection_id: connectionId });
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
