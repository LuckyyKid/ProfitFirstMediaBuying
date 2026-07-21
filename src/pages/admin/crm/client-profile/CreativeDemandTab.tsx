import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, upsertCrmSingle } from "@/crm/hooks";

const creativeFields: FieldDef[] = [
  { key: "total_creatives_needed", label: "Total créatifs", type: "number" },
  { key: "videos_needed", label: "Vidéos", type: "number" },
  { key: "statics_needed", label: "Statics", type: "number" },
  { key: "priority_products", label: "Produits prioritaires", type: "textarea" },
  { key: "priority_angles", label: "Angles prioritaires", type: "textarea" },
  { key: "creative_risk_level", label: "Risque créatif" },
  { key: "rationale", label: "Rationale", type: "textarea" },
  { key: "production_sources", label: "Sources production", type: "textarea" },
  { key: "due_dates", label: "Deadlines", type: "textarea" },
];

export function CreativeDemandTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_creative_demand_plans", clientId);
  return (
    <AutoForm
      title="Creative Demand Plan"
      fields={creativeFields}
      initial={row ?? {}}
      onSave={async (v) => {
        await upsertCrmSingle("crm_creative_demand_plans", clientId, row, v);
        reload();
      }}
    />
  );
}
