import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, upsertCrmSingle } from "@/crm/hooks";

const businessContextFields: FieldDef[] = [
  { key: "mission", label: "Mission", type: "textarea" },
  { key: "one_year_vision", label: "Vision 1 an", type: "textarea" },
  { key: "ten_year_vision", label: "Vision 10 ans", type: "textarea" },
  { key: "goal_lock", label: "Goal Lock", type: "textarea" },
  { key: "success_3_months", label: "Succès à 3 mois", type: "textarea" },
  { key: "primary_kpi", label: "KPI principal" },
  { key: "monthly_revenue", label: "Revenu mensuel", type: "number" },
  { key: "annual_revenue", label: "Revenu annuel", type: "number" },
  { key: "weekly_ad_budget", label: "Budget pub / semaine", type: "number" },
  { key: "monthly_ad_budget", label: "Budget pub / mois", type: "number" },
  { key: "target_country", label: "Pays cible" },
  { key: "target_customer", label: "Client cible", type: "textarea" },
  { key: "products_to_push", label: "Produits à pousser", type: "textarea" },
  { key: "products_to_avoid", label: "Produits à éviter", type: "textarea" },
  { key: "best_selling_product", label: "Best seller" },
  { key: "main_value_proposition", label: "Proposition de valeur", type: "textarea" },
  { key: "top_competitors", label: "Compétiteurs", type: "textarea" },
  { key: "known_objections", label: "Objections connues", type: "textarea" },
  { key: "founder_profile", label: "Profil fondateur", type: "textarea" },
  { key: "founder_strengths", label: "Forces fondateur", type: "textarea" },
  { key: "founder_weaknesses", label: "Faiblesses fondateur", type: "textarea" },
  { key: "communication_preference", label: "Comm. préférée" },
  { key: "feedback_availability", label: "Feedback / dispo" },
  { key: "decision_makers", label: "Décideurs" },
  { key: "approval_risk", label: "Risque d'approbation" },
  { key: "strategic_guardrails", label: "Garde-fous stratégiques", type: "textarea" },
];

export function BusinessContextTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_business_context", clientId);
  return (
    <AutoForm
      title="Business Context"
      description="Contexte business — mission, vision, contraintes, fondateur"
      fields={businessContextFields}
      initial={row ?? {}}
      onSave={async (v) => {
        await upsertCrmSingle("crm_business_context", clientId, row, v);
        reload();
      }}
    />
  );
}
