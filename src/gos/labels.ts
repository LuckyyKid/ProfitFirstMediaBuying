// src/gos/labels.ts
//
// Terminology dictionary per business type. The GOS UI is polymorphic —
// what an e-commerce brand calls a "commande" a SaaS calls "abonnement"
// and an agency calls "mandat". Instead of scattering `businessType ===`
// checks through every page, pages ask this module for the label they
// need for the current client. Falls back to ECOMMERCE terminology when
// a key is missing so early adoption doesn't crash for exotic types.

import type { BusinessType } from "./ui";

export type LabelKey =
  // Money
  | "revenue"
  | "revenue_period"       // "chiffre d'affaires", "MRR"…
  | "unit_price"           // AOV / ARPA / retainer moyen / prix moyen
  | "spend"                // "dépense pub" — universal
  // Customer & unit
  | "customer"             // client, abonné, souscripteur
  | "customer_plural"
  | "unit_sold"            // commande, souscription, mandat, RDV
  | "unit_sold_plural"
  // Funnel
  | "acquisition_target"   // ce qu'on essaie de générer (achat, trial, lead)
  | "conversion_event"     // "achat", "signup", "prise de RDV", "signature"
  // Recurrence & retention
  | "recurring_revenue"    // MRR, revenus récurrents, retainer mensuel
  | "churn"                // churn client, non-renouvellement
  | "retention_metric"     // taux de rétention, taux de rachat
  // Capacity (services / agences)
  | "capacity"             // slots dispo, heures/semaine
  | "delivery_unit";       // séance, heure facturable, projet

type LabelSet = Record<LabelKey, string>;

const ECOM: LabelSet = {
  revenue:            "Chiffre d'affaires",
  revenue_period:     "CA de la période",
  unit_price:         "Panier moyen (AOV)",
  spend:              "Dépense publicitaire",
  customer:           "Client",
  customer_plural:    "Clients",
  unit_sold:          "Commande",
  unit_sold_plural:   "Commandes",
  acquisition_target: "Achat",
  conversion_event:   "Achat",
  recurring_revenue:  "Revenu récurrent",
  churn:              "Churn client",
  retention_metric:   "Taux de rachat",
  capacity:           "Stock disponible",
  delivery_unit:      "Commande expédiée",
};

const LOCAL_SERVICE: LabelSet = {
  revenue:            "Chiffre d'affaires",
  revenue_period:     "CA de la période",
  unit_price:         "Prix moyen prestation",
  spend:              "Dépense publicitaire",
  customer:           "Client",
  customer_plural:    "Clients",
  unit_sold:          "Rendez-vous",
  unit_sold_plural:   "Rendez-vous",
  acquisition_target: "Prise de rendez-vous",
  conversion_event:   "Prise de rendez-vous",
  recurring_revenue:  "Récurrence clients",
  churn:              "Non-fidélisation",
  retention_metric:   "Taux de retour",
  capacity:           "Capacité hebdo (RDV)",
  delivery_unit:      "Prestation",
};

const SAAS: LabelSet = {
  revenue:            "Revenus SaaS",
  revenue_period:     "MRR",
  unit_price:         "ARPA",
  spend:              "Dépense publicitaire",
  customer:           "Abonné",
  customer_plural:    "Abonnés",
  unit_sold:          "Abonnement",
  unit_sold_plural:   "Abonnements",
  acquisition_target: "Signup payant",
  conversion_event:   "Conversion trial → paid",
  recurring_revenue:  "MRR",
  churn:              "Churn mensuel",
  retention_metric:   "Net revenue retention",
  capacity:           "Sièges dispo",
  delivery_unit:      "Licence active",
};

const AGENCE: LabelSet = {
  revenue:            "Revenus agence",
  revenue_period:     "MRR retainers",
  unit_price:         "Retainer moyen",
  spend:              "Dépense publicitaire",
  customer:           "Client",
  customer_plural:    "Clients",
  unit_sold:          "Mandat",
  unit_sold_plural:   "Mandats",
  acquisition_target: "Signature mandat",
  conversion_event:   "Discovery call → signature",
  recurring_revenue:  "MRR retainers",
  churn:              "Résiliation mandat",
  retention_metric:   "Rétention mandats",
  capacity:           "Heures livrées / sem",
  delivery_unit:      "Heure facturée",
};

const HYBRID: LabelSet = { ...ECOM, unit_sold: "Vente", unit_sold_plural: "Ventes" };
const OTHER: LabelSet = ECOM;

const DICT: Record<BusinessType, LabelSet> = {
  ECOMMERCE:     ECOM,
  LOCAL_SERVICE: LOCAL_SERVICE,
  SAAS:          SAAS,
  AGENCE:        AGENCE,
  HYBRID:        HYBRID,
  OTHER:         OTHER,
};

export function labelFor(businessType: string | null | undefined, key: LabelKey): string {
  const bt = (businessType as BusinessType) ?? "ECOMMERCE";
  const set = DICT[bt] ?? ECOM;
  return set[key] ?? ECOM[key];
}

// Convenience: bulk-fetch a label set for a business type (useful when a
// page needs many labels at once).
export function labelsFor(businessType: string | null | undefined): LabelSet {
  const bt = (businessType as BusinessType) ?? "ECOMMERCE";
  return DICT[bt] ?? ECOM;
}

// Business type "family" — used by the diagnostic to decide which axes
// apply. A HYBRID business gets both e-commerce and service axes.
export type BusinessFamily = "ecom" | "service" | "recurring";

export function familiesFor(businessType: string | null | undefined): BusinessFamily[] {
  switch (businessType) {
    case "ECOMMERCE":     return ["ecom"];
    case "LOCAL_SERVICE": return ["service"];
    case "SAAS":          return ["recurring"];
    case "AGENCE":        return ["recurring", "service"];
    case "HYBRID":        return ["ecom", "service"];
    default:              return ["ecom"];
  }
}
