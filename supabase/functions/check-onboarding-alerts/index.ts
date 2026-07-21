// Scheduled (pg_cron) — checks for stalled / blocked clients and posts Slack alerts.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STEP_NAMES = [
  "Bienvenue",
  "Accès plateformes",
  "Formulaire",
  "Founder Scan",
  "Paiement",
  "Contrat",
  "Appel démarrage",
  "Terminé",
];

async function slack(text: string) {
  const url = Deno.env.get("SLACK_WEBHOOK_URL_TRACKER");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: clients, error } = await supabase.from("client_progress").select("*");
    if (error) throw error;
    const now = Date.now();
    let alertsSent = 0;

    for (const c of clients ?? []) {
      const sentAt = c.onboarding_sent_at ? new Date(c.onboarding_sent_at).getTime() : null;
      const lastAct = c.last_activity_at ? new Date(c.last_activity_at).getTime() : sentAt;
      const notStarted = !c.welcome_completed_at;

      // 24h not started
      if (notStarted && sentAt && now - sentAt > 24 * 3600 * 1000 && !c.alert_24h_sent) {
        await slack(
          `⚠️ *Onboarding non commencé > 24h*\n• ${c.client_name ?? "—"} (${c.client_code})\n• Entreprise: ${c.company_name ?? "—"}\n• Action: relance SMS/email`
        );
        await supabase
          .from("client_progress")
          .update({ alert_24h_sent: true })
          .eq("client_code", c.client_code);
        await supabase.from("client_activity_log").insert({
          client_code: c.client_code,
          event_type: "alert_24h_sent",
          status: "ok",
        });
        alertsSent++;
      }

      // 48h not started
      if (notStarted && sentAt && now - sentAt > 48 * 3600 * 1000 && !c.alert_48h_sent) {
        await slack(
          `🚨 *Onboarding non commencé > 48h — HIGH RISK*\n• ${c.client_name ?? "—"} (${c.client_code})\n• Entreprise: ${c.company_name ?? "—"}\n• Action: appel manuel account manager`
        );
        await supabase
          .from("client_progress")
          .update({ alert_48h_sent: true })
          .eq("client_code", c.client_code);
        await supabase.from("client_activity_log").insert({
          client_code: c.client_code,
          event_type: "alert_48h_sent",
          status: "ok",
        });
        alertsSent++;
      }

      // Stuck on same step > 24h (and not completed)
      if (
        !c.completed_at &&
        lastAct &&
        now - lastAct > 24 * 3600 * 1000 &&
        (!c.stuck_alert_at || now - new Date(c.stuck_alert_at).getTime() > 24 * 3600 * 1000)
      ) {
        const stepIdx = (c.current_step ?? 1) - 1;
        const stepName = STEP_NAMES[stepIdx] ?? "—";
        await slack(
          `🛑 *Client bloqué > 24h*\n• ${c.client_name ?? "—"} (${c.client_code})\n• Étape bloquée: ${stepName}\n• Dernière activité: ${c.last_activity_at}`
        );
        await supabase
          .from("client_progress")
          .update({ stuck_alert_at: new Date().toISOString() })
          .eq("client_code", c.client_code);
        await supabase.from("client_activity_log").insert({
          client_code: c.client_code,
          event_type: "stuck_alert_sent",
          status: "ok",
          details: { step: stepName },
        });
        alertsSent++;
      }
    }

    return new Response(JSON.stringify({ success: true, alertsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
