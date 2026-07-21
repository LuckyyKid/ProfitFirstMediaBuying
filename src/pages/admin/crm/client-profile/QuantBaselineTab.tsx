import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, upsertCrmSingle } from "@/crm/hooks";
import { computeBaseline } from "@/crm/formulas";

const baselineFields: FieldDef[] = [
  { key: "meta_spend", label: "Meta spend", type: "number" }, { key: "meta_impressions", label: "Meta impressions", type: "number" },
  { key: "meta_reach", label: "Meta reach", type: "number" }, { key: "meta_cpm", label: "Meta CPM", type: "number" },
  { key: "meta_clicks", label: "Meta clicks", type: "number" }, { key: "meta_ctr", label: "Meta CTR", type: "number" },
  { key: "meta_cpc", label: "Meta CPC", type: "number" }, { key: "meta_purchases", label: "Meta purchases", type: "number" },
  { key: "meta_cpa", label: "Meta CPA", type: "number" }, { key: "meta_purchase_value", label: "Meta purchase value", type: "number" },
  { key: "meta_roas", label: "Meta ROAS", type: "number" }, { key: "meta_frequency", label: "Meta frequency", type: "number" },
  { key: "meta_top_ads", label: "Top ads", type: "textarea" }, { key: "meta_worst_ads", label: "Worst ads", type: "textarea" },
  { key: "shopify_revenue", label: "Shopify revenue", type: "number" }, { key: "shopify_orders", label: "Shopify orders", type: "number" },
  { key: "shopify_aov", label: "Shopify AOV", type: "number" }, { key: "shopify_total_customers", label: "Total customers", type: "number" },
  { key: "shopify_new_customers", label: "New customers", type: "number" }, { key: "shopify_returning_customers", label: "Returning", type: "number" },
  { key: "shopify_conversion_rate", label: "CVR", type: "number" }, { key: "shopify_refund_amount", label: "Refund amount", type: "number" },
  { key: "shopify_refund_rate", label: "Refund rate", type: "number" }, { key: "shopify_discount_amount", label: "Discount amount", type: "number" },
  { key: "ga4_sessions", label: "GA4 sessions", type: "number" }, { key: "ga4_users", label: "GA4 users", type: "number" },
  { key: "ga4_add_to_cart", label: "GA4 ATC", type: "number" }, { key: "ga4_begin_checkout", label: "GA4 begin checkout", type: "number" },
  { key: "ga4_purchases", label: "GA4 purchases", type: "number" }, { key: "ga4_purchase_conversion_rate", label: "GA4 CVR", type: "number" },
  { key: "ga4_add_to_cart_rate", label: "GA4 ATC rate", type: "number" }, { key: "ga4_checkout_rate", label: "GA4 checkout rate", type: "number" },
  { key: "mobile_conversion_rate", label: "Mobile CVR", type: "number" }, { key: "desktop_conversion_rate", label: "Desktop CVR", type: "number" },
  { key: "google_ads_spend", label: "Google spend", type: "number" }, { key: "google_ads_clicks", label: "Google clicks", type: "number" },
  { key: "google_ads_ctr", label: "Google CTR", type: "number" }, { key: "google_ads_cpc", label: "Google CPC", type: "number" },
  { key: "google_ads_conversions", label: "Google conv.", type: "number" }, { key: "google_ads_cpa", label: "Google CPA", type: "number" },
  { key: "google_ads_conversion_value", label: "Google conv. value", type: "number" }, { key: "google_ads_roas", label: "Google ROAS", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export function QuantBaselineTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_quantitative_baselines", clientId);
  const { row: fin } = useCrmSingle("crm_financial_inputs", clientId);
  const [output, setOutput] = useState<any>(null);

  const runAnalysis = async () => {
    if (!row) return toast.error("Enregistre d'abord la baseline");
    const calc = computeBaseline({
      shopify_revenue: row.shopify_revenue,
      shopify_orders: row.shopify_orders,
      shopify_new_customers: row.shopify_new_customers,
      meta_spend: row.meta_spend,
      google_ads_spend: row.google_ads_spend,
      gross_margin_percent: fin?.gross_margin_percent,
      average_shipping_cost: fin?.average_shipping_cost,
      average_fulfillment_cost: fin?.average_fulfillment_cost,
      refund_rate_percent: fin?.refund_rate_percent,
      target_cac: fin?.target_cac,
    });
    const health = Math.min(
      100,
      Math.max(
        0,
        50 +
          (calc.current_cac_vs_break_even < 0 ? 30 : -20) +
          (calc.blended_mer >= (fin?.target_mer ?? 0) ? 20 : -10),
      ),
    );
    const payload = {
      client_id: clientId,
      quantitative_baseline_id: row.id,
      ...calc,
      baseline_health_score: health,
      main_quantitative_problem:
        calc.current_cac_vs_target > 0
          ? "CAC au-dessus de la cible"
          : calc.blended_mer < (fin?.target_mer ?? 0)
            ? "MER sous cible"
            : "Aucun problème critique",
      quant_risk_level: health < 40 ? "High" : health < 70 ? "Medium" : "Low",
      quant_diagnosis: `MER: ${calc.blended_mer} | CAC: ${calc.blended_cac} | Break-even CAC: ${calc.estimated_break_even_cac}`,
    };
    const { data, error } = await supabase.from("crm_quant_analysis_outputs").insert(payload).select().single();
    if (error) return toast.error(error.message);
    setOutput(data);
    toast.success("Analyse générée");
  };

  return (
    <div className="space-y-4">
      <AutoForm
        title="Quantitative Baseline"
        description="Données Meta, Shopify, GA4, Google Ads (30 derniers jours)"
        fields={baselineFields}
        initial={row ?? {}}
        extra={
          <div className="mt-4">
            <Button variant="outline" onClick={runAnalysis}><Calculator className="h-4 w-4 mr-1" /> Run Quant Analysis</Button>
          </div>
        }
        onSave={async (v) => {
          await upsertCrmSingle("crm_quantitative_baselines", clientId, row, v);
          reload();
        }}
      />
      {output && (
        <Card className="p-4 border-border shadow-none">
          <h3 className="font-semibold mb-3">Quant Analysis Output</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(output)
              .filter(([k]) => !["id", "client_id", "quantitative_baseline_id", "created_at", "am_validated"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="border border-border/60 rounded p-2">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="font-medium">{String(v ?? "—")}</div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
