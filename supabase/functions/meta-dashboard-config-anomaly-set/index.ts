// ─────────────────────────────────────────────────────────────────────────────
// Update the anomaly-check fields on an existing meta_dashboard_config row.
// Separate from `meta-dashboard-config-upsert` (which is Lovable-managed and
// only handles google_sheet_id / tab_name / active) so we don't have to touch
// that function to add new fields.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TYPES = new Set(["ecom", "local"]);
const ALLOWED_METRICS = new Set(["purchases", "leads"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const {
      client_code,
      client_type,
      daily_budget_planned,
      conversion_metric,
      target_cpl_or_roas,
      anomaly_checks_enabled,
    } = await req.json();

    if (!client_code || typeof client_code !== "string") {
      throw new Error("client_code requis");
    }

    const patch: Record<string, unknown> = {};
    if (client_type !== undefined) {
      if (!ALLOWED_TYPES.has(client_type)) throw new Error("client_type doit être 'ecom' ou 'local'");
      patch.client_type = client_type;
    }
    if (daily_budget_planned !== undefined) {
      const n = Number(daily_budget_planned);
      if (!Number.isFinite(n) || n < 0) throw new Error("daily_budget_planned invalide");
      patch.daily_budget_planned = n;
    }
    if (conversion_metric !== undefined) {
      if (!ALLOWED_METRICS.has(conversion_metric)) throw new Error("conversion_metric doit être 'purchases' ou 'leads'");
      patch.conversion_metric = conversion_metric;
    }
    if (target_cpl_or_roas !== undefined) {
      const n = Number(target_cpl_or_roas);
      if (!Number.isFinite(n) || n < 0) throw new Error("target_cpl_or_roas invalide");
      patch.target_cpl_or_roas = n;
    }
    if (anomaly_checks_enabled !== undefined) {
      patch.anomaly_checks_enabled = !!anomaly_checks_enabled;
    }

    if (Object.keys(patch).length === 0) {
      throw new Error("Aucun champ à mettre à jour");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("meta_dashboard_config")
      .update(patch)
      .eq("client_code", client_code)
      .select("client_code, client_type, daily_budget_planned, conversion_metric, target_cpl_or_roas, anomaly_checks_enabled")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Configuration Meta Ads introuvable pour ce client. Active d'abord l'intégration.");

    return new Response(JSON.stringify({ config: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
