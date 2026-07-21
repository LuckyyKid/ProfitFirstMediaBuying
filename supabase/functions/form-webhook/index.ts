import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FORM_FIELDS: Record<string, string> = {
  welcome: "welcome_form_submitted",
  founder_scan: "founder_scan_submitted",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const form = String(body?.form ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!FORM_FIELDS[form]) {
      return new Response(
        JSON.stringify({ error: "Invalid 'form'. Must be 'welcome' or 'founder_scan'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'email'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const field = FORM_FIELDS[form];
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find the client_progress row whose email matches (case-insensitive)
    const { data: rows, error: findErr } = await supabase
      .from("client_progress")
      .select("client_code, email")
      .ilike("email", email)
      .limit(1);

    if (findErr) {
      console.error("Lookup error:", findErr);
      return new Response(
        JSON.stringify({ error: findErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rows || rows.length === 0) {
      console.warn(`No client_progress row matched email=${email} (form=${form})`);
      return new Response(
        JSON.stringify({
          success: false,
          matched: false,
          message: "No client session matched this email. The client must enter the same email at the start of the onboarding.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientCode = rows[0].client_code;
    const { data: updated, error: updateErr } = await supabase
      .from("client_progress")
      .update({ [field]: true, updated_at: new Date().toISOString() })
      .eq("client_code", clientCode)
      .select()
      .single();

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Marked ${field}=true for client_code=${clientCode} (email=${email})`);
    return new Response(
      JSON.stringify({ success: true, matched: true, progress: updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
