import type { ComponentType, CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, DollarSign, Sparkles, Users } from "lucide-react";

import { SectionHeader } from "@/gos/ui";

// PlanningPrediction is intentionally read-only.
// The previous editable tabs were deprecated because they duplicated direct
// Supabase reads/writes that are now owned by the dedicated source-of-truth
// workflows:
// - EventEffect: gos_event_effects plus model_runs through eventEffectController.
// - Retention: gos_retention_snapshots, gos_customer_activity_snapshots,
//   gos_customer_transactions, plus model_runs through retention/cohort controllers.
// - SpendingPower: gos_spending_power_snapshots, gos_financial_inputs,
//   gos_basket_economics, frontier/PFMB model_runs through spendingPowerController.
// This page remains as the planning hub so the sidebar has one planning entry
// while each underlying function keeps one authoritative implementation.

type PlanningCard = {
  title: string;
  route: string;
  eyebrow: string;
  description: string;
  tableSummary: string;
  icon: ComponentType<{ size?: number; style?: CSSProperties }>;
};

const cards: PlanningCard[] = [
  {
    title: "Effet d'evenement",
    route: "event-effect",
    eyebrow: "Calendrier marketing",
    description: "Modelise l'impact attendu ou mesure d'un lancement, promo, saisonnalite ou moment commercial.",
    tableSummary: "Source: gos_event_effects. Audit: model_runs.",
    icon: Sparkles,
  },
  {
    title: "Retention",
    route: "retention",
    eyebrow: "Cohortes et repeat revenue",
    description: "Construit les cohortes transactionnelles et les signaux LTV qui alimentent le forecast.",
    tableSummary: "Sources: gos_retention_snapshots, gos_customer_activity_snapshots, gos_customer_transactions.",
    icon: Users,
  },
  {
    title: "Pouvoir de depense",
    route: "spending-power",
    eyebrow: "Budget safe-to-spend",
    description: "Calcule le spend recommande avec cash, marge, funnel, stock, LTV, frontier et Profit-First Media Buying.",
    tableSummary: "Sources: gos_spending_power_snapshots, gos_financial_inputs, gos_basket_economics. Audit: model_runs.",
    icon: DollarSign,
  },
];

export default function PlanningPrediction() {
  const { clientId } = useParams();
  const base = clientId ? `/admin/gos/clients/${clientId}` : "/admin/gos/clients";

  return (
    <>
      <SectionHeader
        title="Planification & prevision"
        subtitle="Hub lecture seule. Les calculs et mutations vivent dans les trois workflows sources de verite."
        guide={{
          purpose: "Choisir le moteur de planification a ouvrir sans dupliquer les calculs ni les mutations.",
          dataSource: "Lecture seule; les donnees sont gerees par EventEffect, Retention et SpendingPower.",
          usedBy: "Account manager, profit engineer, media buyer.",
          requiredInputs: [
            "Evenements marketing planifies ou historiques",
            "Transactions et snapshots cohortes",
            "Historique spend, cash, marge, panier et contraintes de capacite",
          ],
          nextStep: "Ouvrir le workflow source de verite correspondant au planning a verifier.",
        }}
      />
      <section className="gos-grid-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.route} className="gos-card" style={{ padding: 18, display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--tdia-blue)",
                    background: "hsl(220 45% 14%)",
                    border: "1px solid hsl(220 45% 12%)",
                  }}
                >
                  <Icon size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                    {card.eyebrow}
                  </div>
                  <h3 style={{ margin: "2px 0 0", color: "var(--tdia-text)", fontSize: 17 }}>{card.title}</h3>
                </div>
              </div>

              <p style={{ margin: 0, color: "var(--tdia-muted)", fontSize: 13, lineHeight: 1.55 }}>
                {card.description}
              </p>

              <div style={{ fontSize: 12, color: "hsl(0 0% 40%)", borderTop: "1px solid hsl(220 45% 25%)", paddingTop: 12 }}>
                {card.tableSummary}
              </div>

              <Link className="gos-btn-primary" to={`${base}/${card.route}`} style={{ textDecoration: "none", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <CalendarClock size={14} />
                Ouvrir
              </Link>
            </article>
          );
        })}
      </section>
    </>
  );
}
