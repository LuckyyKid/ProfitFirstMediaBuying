import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_code, event_type, status, details, error } = await req.json();
    if (!client_code || !event_type) {
      return new Response(JSON.stringify({ error: "client_code and event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error: insErr } = await supabase.from("client_activity_log").insert({
      client_code,
      event_type,
      status: status ?? null,
      details: details ?? null,
      error: error ?? null,
    });
    if (insErr) throw insErr;

    // Update last_activity_at
    await supabase
      .from("client_progress")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("client_code", client_code);

    // Fire progress webhook for events that may change step state
    const PROGRESS_EVENTS = new Set([
      "manual_step_completion",
      "video_watched",
      "video_completed",
      "platform_video_watched",
      "platforms_completed",
      "welcome_completed",
      "contract_signed",
      "kickoff_scheduled",
      "kickoff_completed",
    ]);
    if (PROGRESS_EVENTS.has(event_type)) {
      supabase.functions
        .invoke("notify-step-progress", { body: { client_code } })
        .catch((e) => console.error("notify-step-progress error:", e));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
