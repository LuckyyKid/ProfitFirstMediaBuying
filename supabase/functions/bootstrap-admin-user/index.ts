// One-shot: crée le compte Supabase Auth global_admin pour TDIA.
// Protégé par ADMIN_PASSWORD (le mot de passe legacy).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function genPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "x") + "!Aa1";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, guard_password } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const guard = Deno.env.get("ADMIN_PASSWORD");
    if (!guard || guard_password !== guard) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up existing user by email
    const { data: existing } = await admin.auth.admin.listUsers();
    let user = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
    let tempPassword: string | null = null;
    let created = false;

    if (!user) {
      tempPassword = genPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (error) throw error;
      user = data.user;
      created = true;
    } else {
      // Rotate password so the user has a fresh temp credential
      tempPassword = genPassword();
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password: tempPassword,
        email_confirm: true,
      });
      if (error) throw error;
    }

    if (!user) throw new Error("user provisioning failed");

    // Grant global_admin (idempotent via unique constraint)
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "global_admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    // Seed owner membership on every existing gos_clients row
    const { data: clients } = await admin.from("gos_clients").select("id");
    if (clients && clients.length > 0) {
      const rows = clients.map((c: any) => ({ client_id: c.id, user_id: user!.id, role: "owner" as const }));
      await admin.from("gos_client_members").upsert(rows, { onConflict: "client_id,user_id" });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        created,
        user_id: user.id,
        email: user.email,
        temp_password: tempPassword,
        message: created
          ? "Compte créé. Utilise ce mot de passe pour ton premier login puis change-le."
          : "Compte existant — mot de passe réinitialisé. Utilise ce nouveau mot de passe.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
