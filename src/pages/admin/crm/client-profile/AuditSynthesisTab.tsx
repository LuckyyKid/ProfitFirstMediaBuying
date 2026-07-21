import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, upsertCrmSingle } from "@/crm/hooks";

const auditFields: FieldDef[] = [
  { key: "goal_lock", label: "Goal Lock", type: "textarea" },
  { key: "strategic_context", label: "Strategic Context", type: "textarea" },
  { key: "primary_problem_category", label: "Catégorie problème principal" },
  { key: "primary_problem", label: "Problème principal", type: "textarea" },
  { key: "secondary_problems", label: "Problèmes secondaires", type: "textarea" },
  { key: "quant_evidence", label: "Preuves quant", type: "textarea" },
  { key: "market_evidence", label: "Preuves marché", type: "textarea" },
  { key: "experimental_evidence", label: "Preuves expérimentales", type: "textarea" },
  { key: "cro_offer_evidence", label: "Preuves CRO/offre", type: "textarea" },
  { key: "business_context_evidence", label: "Preuves contexte", type: "textarea" },
  { key: "key_uncertainties", label: "Incertitudes clés", type: "textarea" },
  { key: "priority_levers", label: "Leviers prioritaires", type: "textarea" },
  { key: "rejected_or_delayed_levers", label: "Leviers rejetés/reportés", type: "textarea" },
  { key: "strategic_diagnosis", label: "Diagnostic stratégique", type: "textarea" },
  { key: "confidence_level", label: "Niveau de confiance" },
  { key: "next_step", label: "Next step", type: "textarea" },
  { key: "am_approved", label: "AM approuvé", type: "checkbox" },
];

export function AuditSynthesisTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_audit_syntheses", clientId);
  return (
    <AutoForm
      title="Audit Synthesis"
      description="Synthèse stratégique + diagnostic"
      fields={auditFields}
      initial={row ?? {}}
      onSave={async (v) => {
        await upsertCrmSingle("crm_audit_syntheses", clientId, row, v);
        reload();
      }}
    />
  );
}
