import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, upsertCrmSingle } from "@/crm/hooks";

const financialFields: FieldDef[] = [
  { key: "gross_margin_percent", label: "Marge brute (%)", type: "number" },
  { key: "average_cogs", label: "COGS moyen", type: "number" },
  { key: "average_shipping_cost", label: "Shipping moyen", type: "number" },
  { key: "average_fulfillment_cost", label: "Fulfillment moyen", type: "number" },
  { key: "refund_rate_percent", label: "Refund rate (%)", type: "number" },
  { key: "target_cac", label: "CAC cible", type: "number" },
  { key: "target_mer", label: "MER cible", type: "number" },
  { key: "target_roas", label: "ROAS cible", type: "number" },
  { key: "payback_window", label: "Payback window" },
  { key: "top_product_margin_notes", label: "Notes marges", type: "textarea" },
  { key: "stock_risk", label: "Risque stock", type: "textarea" },
  { key: "claims_allowed", label: "Claims autorisés", type: "textarea" },
  { key: "claims_forbidden", label: "Claims interdits", type: "textarea" },
  { key: "legal_risk_notes", label: "Risque légal", type: "textarea" },
];

export function FinancialTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_financial_inputs", clientId);
  return (
    <AutoForm
      title="Financial Inputs"
      description="Marges, coûts et cibles"
      fields={financialFields}
      initial={row ?? {}}
      onSave={async (v) => {
        await upsertCrmSingle("crm_financial_inputs", clientId, row, v);
        reload();
      }}
    />
  );
}
