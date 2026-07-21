import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, upsertCrmSingle } from "@/crm/hooks";

const metricFields: FieldDef[] = [
  { key: "period", label: "Période" }, { key: "north_star_metric", label: "North Star Metric" },
  { key: "revenue_target", label: "Revenue target", type: "number" },
  { key: "ad_spend_target", label: "Ad spend target", type: "number" },
  { key: "mer_target", label: "MER target", type: "number" },
  { key: "cac_target", label: "CAC target", type: "number" },
  { key: "contribution_margin_proxy_target", label: "Contrib margin proxy", type: "number" },
  { key: "new_customers_target", label: "New customers", type: "number" },
  { key: "returning_revenue_target", label: "Returning revenue", type: "number" },
  { key: "meta_spend_target", label: "Meta spend", type: "number" },
  { key: "meta_cac_target", label: "Meta CAC", type: "number" },
  { key: "meta_roas_target", label: "Meta ROAS", type: "number" },
  { key: "google_spend_target", label: "Google spend", type: "number" },
  { key: "google_roas_target", label: "Google ROAS", type: "number" },
  { key: "email_revenue_target", label: "Email revenue", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export function MetricTargetsTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_metric_targets", clientId);
  return (
    <AutoForm
      title="Metric Targets"
      fields={metricFields}
      initial={row ?? {}}
      onSave={async (v) => {
        await upsertCrmSingle("crm_metric_targets", clientId, row, v);
        reload();
      }}
    />
  );
}
