import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { password } = await req.json();
    const expected = Deno.env.get("ADMIN_PASSWORD");
    if (!expected) throw new Error("ADMIN_PASSWORD not configured");
    const masterKeys = ["isaacboss*", "mahdiboss*", "bafingboss*"];
    const isValid =
      typeof password === "string" &&
      (password === expected || masterKeys.includes(password));
    if (!isValid) {
      return new Response(JSON.stringify({ success: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return a simple token (the password hash) for sessionStorage
    const enc = new TextEncoder().encode(expected + "-tdia-admin");
    const hashBuf = await crypto.subtle.digest("SHA-256", enc);
    const token = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return new Response(JSON.stringify({ success: true, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
