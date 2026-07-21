// Ajoute un membre à un client GOS via email.
// Vérifie que l'appelant est global_admin OU owner/admin du client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, email, role } = await req.json();
    if (!client_id || !email || !role) {
      return new Response(JSON.stringify({ ok: false, error: "client_id, email, role required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["owner", "admin", "analyst", "viewer"].includes(role)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller identity (using anon key + user's JWT)
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ ok: false, error: "invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authorize: global_admin OR (owner|admin) on this client
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isGlobal = (roles ?? []).some((r: any) => r.role === "global_admin");
    if (!isGlobal) {
      const { data: mem } = await admin
        .from("gos_client_members")
        .select("role")
        .eq("client_id", client_id)
        .eq("user_id", callerId)
        .maybeSingle();
      const okRole = mem && (mem.role === "owner" || mem.role === "admin");
      if (!okRole) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Resolve target email -> user_id (list; small user base)
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const target = list?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (!target) {
      return new Response(JSON.stringify({ ok: false, error: "Aucun compte avec cet email. Le user doit d'abord se créer un compte." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await admin
      .from("gos_client_members")
      .upsert(
        { client_id, user_id: target.id, role },
        { onConflict: "client_id,user_id" }
      );
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, user_id: target.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
