// Reset the portal access for a client: deletes the auth.users row whose
// email matches the client's registered email. The client's dossier
// (clients / client_progress / deals / etc.) is left untouched — only the
// login credentials are wiped, so the client can re-signup with the same
// client_code and re-verify OTP.
//
// Guarded by global_admin OR (owner|admin) membership on the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { ok: false, error: "unauthenticated" });

    const { client_code } = await req.json();
    if (!client_code) return json(400, { ok: false, error: "client_code required" });

    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData.user) return json(401, { ok: false, error: "invalid session" });
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authorize: global_admin OR (owner|admin) on this client
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isGlobal = (roles ?? []).some((r: { role: string }) => r.role === "global_admin");
    if (!isGlobal) {
      const { data: client } = await admin
        .from("client_progress")
        .select("client_id")
        .eq("client_code", client_code)
        .maybeSingle();
      if (!client?.client_id) return json(404, { ok: false, error: "client not found" });
      const { data: mem } = await admin
        .from("gos_client_members")
        .select("role")
        .eq("client_id", client.client_id)
        .eq("user_id", callerId)
        .maybeSingle();
      const okRole = mem && (mem.role === "owner" || mem.role === "admin");
      if (!okRole) return json(403, { ok: false, error: "forbidden" });
    }

    // Resolve the client's registered email. The dossier lives in
    // client_progress (main table) with a fallback to closed_deals.owner_email
    // if the local email is blank.
    const { data: clientRow, error: clientErr } = await admin
      .from("client_progress")
      .select("email, client_name")
      .eq("client_code", client_code)
      .maybeSingle();
    if (clientErr) throw clientErr;

    let email: string | null = clientRow?.email ?? null;
    if (!email) {
      const { data: dealRow } = await admin
        .from("closed_deals")
        .select("owner_email")
        .eq("client_code", client_code)
        .maybeSingle();
      email = dealRow?.owner_email ?? null;
    }
    if (!email)
      return json(404, { ok: false, error: "Aucun email enregistré sur ce dossier client." });

    const targetEmail = String(email).toLowerCase();

    // Find the auth user for that email
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const target = list?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
    if (!target) {
      return json(200, {
        ok: true,
        deleted: false,
        message: "Aucun compte auth trouvé pour cet email — rien à réinitialiser.",
      });
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(target.id);
    if (delErr) throw delErr;

    return json(200, {
      ok: true,
      deleted: true,
      email,
      user_id: target.id,
    });
  } catch (e) {
    return json(500, { ok: false, error: (e as Error).message });
  }
});
