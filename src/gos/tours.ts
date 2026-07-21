import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export type TourStep = {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
  };
};

/** Route pattern → tour steps. `:clientId` is a placeholder we don't match on. */
export const TOURS: Record<string, TourStep[]> = {
  // Growth Model Setup — foundation
  "growth-model-setup": [
    {
      popover: {
        title: "Growth Model Setup",
        description:
          "Point de départ pour chaque client. Tu remplis 5 blocs. Tant qu'ils ne sont pas READY, aucun engine n'est fiable.",
      },
    },
    {
      element: "[data-tour='setup-blocks']",
      popover: {
        title: "Les 5 blocs à remplir",
        description:
          "A. Business Context · B. Financial Inputs · C. Products/Services · D. Inventory/Capacity · E. Quantitative Baseline. Clique sur chaque carte pour l'ouvrir.",
      },
    },
    {
      element: "[data-tour='setup-status']",
      popover: {
        title: "Statut de chaque bloc",
        description:
          "MISSING_INPUTS = manque des champs obligatoires. READY = tout est bon. Passe chaque bloc en READY avant de lancer un forecast.",
      },
    },
  ],

  // Forecast — projections
  "forecast": [
    {
      popover: {
        title: "Forecast",
        description:
          "Génère 3 scénarios (BASE / UPSIDE / DOWNSIDE) déterministes basés sur la baseline et l'unit economics.",
      },
    },
    {
      element: "[data-tour='forecast-datamode']",
      popover: {
        title: "Mode de données",
        description:
          "La confiance est plafonnée selon le mode. DEMO_DATA = 40% max. API_CONNECTED = 100%. Ne présente jamais un forecast DEMO comme une garantie client.",
      },
    },
    {
      element: "[data-tour='forecast-horizon']",
      popover: {
        title: "Horizon",
        description: "Choisis 7 / 30 / 90 / 180 jours. 30 jours est le défaut pour le cycle mensuel.",
      },
    },
    {
      element: "[data-tour='forecast-run']",
      popover: {
        title: "Générer les scénarios",
        description:
          "Un clic = 3 lignes insérées dans gos_forecasts avec formule + snapshot d'inputs. Traçable dans model_runs.",
      },
    },
    {
      element: "[data-tour='forecast-scenarios']",
      popover: {
        title: "Lire les cartes",
        description:
          "BASE = attendu · UPSIDE (+20%) = plafond réaliste · DOWNSIDE (-20%) = plancher. Communique toujours la fourchette, jamais le seul BASE.",
      },
    },
  ],

  // Live Optimization
  "live-optimization": [
    {
      popover: {
        title: "Live Optimization",
        description:
          "Ta revue hebdo. Compare l'actual vs targets et classe automatiquement le type de problème.",
      },
    },
    {
      element: "[data-tour='liveopt-new']",
      popover: {
        title: "Créer une review",
        description:
          "Saisis les actuals de la semaine. Le système classifie : VOLUME · EFFICIENCY · TRACKING · CONSTRAINT · MIXED · ON_PACE et propose la next action.",
      },
    },
    {
      element: "[data-tour='liveopt-list']",
      popover: {
        title: "Historique des reviews",
        description:
          "Chaque review garde ses métriques, son verdict et son problem type. Utilisé par Client Intelligence.",
      },
    },
  ],

  // Manual Data Checklist
  "manual-checklist": [
    {
      popover: {
        title: "Checklist Data Manuelle",
        description:
          "Sans accès API, déclare comment tu as obtenu les données du client. Ça pilote le plafond de confiance et les warnings sur les forecasts.",
      },
    },
    {
      element: "[data-tour='checklist-mode']",
      popover: {
        title: "Data Mode",
        description:
          "DEMO_DATA = fiction · HIST = proxy anonymisé · MANUAL = export client · API = flux live. Choisis en toute honnêteté.",
      },
    },
    {
      element: "[data-tour='checklist-dqs']",
      popover: {
        title: "Data Quality Score",
        description:
          "70% complétude + 15% source + 15% récence. Sous 50 = ne rien montrer au client. 75+ = safe pour communication interne.",
      },
    },
    {
      element: "[data-tour='checklist-fields']",
      popover: {
        title: "Champs minimum",
        description:
          "Les champs MISSING bloquent une meilleure prédiction. Va les remplir dans Growth Model Setup puis reviens ici pour valider.",
      },
    },
  ],
};

/** Returns the tour key that matches the current pathname, or null. */
export function tourKeyForPath(pathname: string): string | null {
  for (const key of Object.keys(TOURS)) {
    if (pathname.endsWith("/" + key)) return key;
  }
  return null;
}

export function startTour(key: string) {
  const steps = TOURS[key];
  if (!steps) return;
  const d = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: "Suivant →",
    prevBtnText: "← Précédent",
    doneBtnText: "Terminer",
    progressText: "{{current}} / {{total}}",
    steps,
  });
  d.drive();
}
