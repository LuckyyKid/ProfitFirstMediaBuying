// src/gos/navConfig.ts
//
// Single source of truth for the GOS sidebar: which pages exist, which group
// they belong to, when an AM actually needs them (phase), and the help
// content shown in the existing HelpDrawer when clicked.
//
// This replaces the inline `buildNav()` in GosLayout.tsx. Two problems it
// fixes directly:
//
// 1. Deduplication — "Configuration du modele" used to have 5 separate nav
//    entries that all routed to the same <GrowthModelSetup /> page
//    (business-context, financial-inputs, products, inventory,
//    quantitative-baseline). Collapsed to one entry here.
//
// 2. Empty help system — help.tsx already ships a HelpDrawer/HelpButton/
//    HelpContent system, but zero pages call useRegisterHelp(), so the drawer
//    is always empty. Rather than touching 50 page files, every nav item
//    here carries its own HelpContent, dispatched from the sidebar itself
//    (see Sidebar.tsx) — one wiring point instead of fifty.

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, UserPlus, Briefcase, Settings2, Activity, Target,
  LineChart, Boxes, Warehouse, BarChart3, CalendarClock, Wand2, Map, Zap,
  RefreshCw, GraduationCap, Rocket, Brain, FileText, Sparkles, DollarSign,
  Database, Flag, Sigma, ClipboardCheck, ShieldCheck,
} from "lucide-react";
import type { HelpContent } from "./help";

/** Which moment in the client lifecycle this page is actually needed for.
 *  "new"    -> setup phase, done once per client
 *  "active" -> daily/weekly/monthly management once the plan is live
 *  "both"   -> used in either phase (audit tools, dashboards)
 */
export type NavPhase = "new" | "active" | "both";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  needsClient?: boolean;
  phase: NavPhase;
  help: HelpContent;
};

export type NavGroup = {
  group: string;
  items: NavItem[];
};

export function buildNav(clientId: string | null): NavGroup[] {
  const cid = clientId ?? "__none__";

  return [
    {
      group: "PORTFOLIO",
      items: [
        {
          to: "/admin/gos", label: "Tableau de bord", icon: LayoutDashboard, end: true, phase: "both",
          help: {
            title: "Tableau de bord",
            purpose: "Vue globale de tous les clients actifs dans le systeme.",
            usedBy: "Premier reflexe chaque matin, tous les jours, peu importe la phase du client.",
          },
        },
        {
          to: "/admin/gos/portfolio", label: "Portefeuille executif", icon: BarChart3, phase: "both",
          help: {
            title: "Portefeuille executif",
            purpose: "Priorisation business entre clients : revenu, spend, ROAS, MER, CAC, nombre de tests en cours.",
            usedBy: "Pour decider quel client regarder en premier quand le temps est limite.",
          },
        },
        {
          to: "/admin/gos/clients", label: "Clients", icon: Users, phase: "new",
          help: {
            title: "Clients",
            purpose: "Liste des clients actifs et des clients a activer dans le systeme Profit-First.",
            usedBy: "Etape 1 pour tout nouveau client.",
          },
        },
        {
          to: "/admin/gos/clients/new", label: "Nouveau client", icon: UserPlus, phase: "new",
          help: {
            title: "Nouveau client",
            purpose: "Cree la fiche client qui sert de racine a toutes les autres pages.",
            usedBy: "Une seule fois par client, avant tout le reste.",
          },
        },
      ],
    },
    {
      group: "SETUP CLIENT",
      items: [
        {
          to: `/admin/gos/clients/${cid}/workspace`, label: "Espace client", icon: Briefcase, needsClient: true, phase: "new",
          help: {
            title: "Espace client",
            purpose: "Hub de navigation pour ce client : confirme que tu es bien dans le bon dossier avant d'agir.",
            usedBy: "Point de passage a chaque nouvelle session de travail sur ce client.",
          },
        },
        {
          // Collapses the former business-context / financial-inputs / products /
          // inventory / quantitative-baseline nav entries into one.
          to: `/admin/gos/clients/${cid}/growth-model-setup`, label: "Configuration du modele", icon: Settings2, needsClient: true, phase: "new",
          help: {
            title: "Configuration du modele",
            purpose: "6 blocs a remplir : contexte business, donnees financieres, produits, stock/capacite, baseline quantitative, economie du panier.",
            dataSource: "gos_clients, gos_financial_inputs, gos_products, gos_inventory_snapshots.",
            usedBy: "Fondation obligatoire. Tant que ces blocs ne sont pas READY, aucun autre moteur (forecast, diagnostic, risk management) n'est fiable.",
            requiredInputs: ["Contexte business", "Donnees financieres", "Produits / services", "Stock ou capacite", "Baseline quantitative", "Economie du panier"],
            nextStep: "Objectifs business, puis Diagnostic de croissance.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/business-objectives`, label: "Objectifs business", icon: Flag, needsClient: true, phase: "new",
          help: {
            title: "Objectifs business",
            purpose: "Objectif du client : rentabilite, croissance, sortie, timeline.",
            usedBy: "Determine quel scenario de forecast viser plus tard (voir Previsions).",
          },
        },
        {
          to: "/admin/gos/data-sources", label: "Integrations", icon: Database, phase: "new",
          help: {
            title: "Integrations",
            purpose: "Connexions de donnees actives (Shopify, GA4...) et leur fiabilite.",
            usedBy: "A verifier avant de faire confiance a un forecast.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/manual-checklist`, label: "Checklist donnees manuelles", icon: ClipboardCheck, needsClient: true, phase: "new",
          help: {
            title: "Checklist donnees manuelles",
            purpose: "Dry run sans acces API : declare la source des donnees et complete la checklist minimale.",
            usedBy: "Quand un client n'a pas encore d'API branchee.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/intelligence`, label: "Intelligence client", icon: Brain, needsClient: true, phase: "both",
          help: {
            title: "Intelligence client",
            purpose: "Synthese deterministe de la sante du compte : score, momentum, forces, alertes, recommandations.",
            usedBy: "Consultation ponctuelle, utile en onboarding et en revue strategique -- pas une etape obligatoire.",
          },
        },
      ],
    },
    {
      group: "PLAN PROFIT",
      items: [
        {
          to: `/admin/gos/clients/${cid}/growth-diagnosis`, label: "Diagnostic de croissance", icon: Activity, needsClient: true, phase: "new",
          help: {
            title: "Diagnostic de croissance",
            purpose: "Classification deterministe du probleme de croissance principal (CAC, conversion, volume...) avec severite et niveau de confiance.",
            usedBy: "Juste apres Configuration du modele, avant tout le reste du plan.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/event-effect`, label: "Effet d'evenement", icon: Sparkles, needsClient: true, phase: "new",
          help: {
            title: "Effet d'evenement",
            purpose: "Modelise l'impact attendu d'un evenement (Black Friday, saisonnier, lancement) sur revenus et depenses.",
            usedBy: "Input du forecast -- pas une destination en soi.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/retention`, label: "Retention", icon: Users, needsClient: true, phase: "new",
          help: {
            title: "Retention",
            purpose: "Cohortes mensuelles, quick ratio, backtest -- moteur retentionCohort.ts. Alimente le forecast (revenu recurrent).",
            usedBy: "Input du forecast. A ne pas confondre avec Segments & Actions Client (LTV/CRM), qui est un outil different.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/spending-power`, label: "Pouvoir de depense", icon: DollarSign, needsClient: true, phase: "new",
          help: {
            title: "Pouvoir de depense",
            purpose: "Calcule combien on peut depenser au maximum sans casser la marge, le cash, le stock ou la capacite.",
            usedBy: "Input du risk management -- alimente le Budget Change Gate plus tard.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/forecast`, label: "Previsions", icon: CalendarClock, needsClient: true, phase: "new",
          help: {
            title: "Previsions",
            purpose: "3 scenarios : regulier, upside, downside -- revenu, spend, leads, CAC, MER.",
            usedBy: "Le forecast global du client, apres les 3 moteurs d'input ci-dessus.",
            nextStep: "Objectifs de metriques pour figer le scenario retenu.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/metric-targets`, label: "Objectifs de metriques", icon: Target, needsClient: true, phase: "new",
          help: {
            title: "Objectifs de metriques",
            purpose: "Cibles de performance par periode -- creees manuellement ou derivees d'un forecast.",
            usedBy: "La cible officielle qu'on suit ensuite au quotidien dans Buyer Workspace et Walkdown.",
          },
        },
        {
          to: `/admin/gos/clients/${cid}/weekly-pnl`, label: "P&L hebdomadaire", icon: CalendarClock, needsClient: true, phase: "new",
          help: { title: "P&L hebdomadaire", purpose: "Decoupe le forecast sur 4 semaines.", usedBy: "Granularite semaine, avant P&L journalier." },
        },
        {
          to: `/admin/gos/clients/${cid}/daily-pnl`, label: "P&L journalier", icon: CalendarClock, needsClient: true, phase: "new",
          help: { title: "P&L journalier", purpose: "Decoupe chaque semaine jour par jour.", usedBy: "Ce qu'on compare a la realite chaque matin une fois le client actif." },
        },
        {
          to: `/admin/gos/clients/${cid}/creative-demand`, label: "Besoin en creatifs", icon: Wand2, needsClient: true, phase: "new",
          help: { title: "Besoin en creatifs", purpose: "Estime le volume de nouveaux creatifs requis par semaine pour soutenir le spend prevu sans fatigue publicitaire.", usedBy: "Avant de lancer les campagnes." },
        },
        {
          to: `/admin/gos/clients/${cid}/sku-demand-plan`, label: "Plan de demande SKU", icon: Boxes, needsClient: true, phase: "new",
          help: { title: "Plan de demande SKU", purpose: "Aligne forecast, stockage et achat media au niveau SKU.", usedBy: "Evite de pousser un SKU dont le stock ne couvre pas la demande." },
        },
      ],
    },
    {
      group: "CREATIVE & OFFERS",
      items: [
        {
          to: `/admin/gos/clients/${cid}/concept-log`, label: "Concept Log", icon: Sparkles, needsClient: true, phase: "active",
          help: { title: "Concept Log", purpose: "Registre des concepts publicitaires : live, winner, loser, a tester, a tuer.", usedBy: "Quand le diagnostic pointe un probleme de fatigue creative ou de volume de tests." },
        },
        {
          to: `/admin/gos/clients/${cid}/offer-lab`, label: "Offer Lab", icon: DollarSign, needsClient: true, phase: "active",
          help: { title: "Offer Lab", purpose: "Bibliotheque d'offres testees : conversion, AOV, marge, verdict.", usedBy: "Quand le diagnostic pointe un probleme de conversion ou d'AOV." },
        },
        {
          to: `/admin/gos/clients/${cid}/angle-audience-matrix`, label: "Angle x Audience Matrix", icon: Map, needsClient: true, phase: "active",
          help: { title: "Angle x Audience Matrix", purpose: "Genere des combinaisons angle/audience pour trouver de nouveaux concepts.", usedBy: "Pour alimenter le Concept Log en nouvelles idees." },
        },
        {
          to: `/admin/gos/clients/${cid}/creative-brief`, label: "Ultimate Brief", icon: Wand2, needsClient: true, phase: "active",
          help: { title: "Ultimate Brief", purpose: "Transforme une decision strategique en brief creatif exploitable.", usedBy: "Reference partagee avec l'equipe creative." },
        },
        {
          to: `/admin/gos/clients/${cid}/testing-roadmap`, label: "Testing Roadmap", icon: Rocket, needsClient: true, phase: "active",
          help: { title: "Testing Roadmap", purpose: "Backlog priorise des tests creatifs et d'offres a venir.", usedBy: "Planification continue, revue en Wayfinder Wednesday." },
        },
      ],
    },
    {
      group: "EXECUTION",
      items: [
        {
          to: `/admin/gos/clients/${cid}/campaign-categories`, label: "Categories de campagnes", icon: FileText, needsClient: true, phase: "active",
          help: { title: "Categories de campagnes", purpose: "Regroupe les campagnes par intention (prospecting, retargeting, retention...) et fixe un CPA cible.", usedBy: "Fondation du Buyer Workspace -- a faire une fois, revisite au besoin." },
        },
        {
          to: `/admin/gos/clients/${cid}/buyer-workspace`, label: "Buyer Workspace", icon: Briefcase, needsClient: true, phase: "active",
          help: { title: "Buyer Workspace", purpose: "Revue quotidienne des campagnes : scale, hold, reduire, pause.", usedBy: "Coeur de la routine quotidienne d'un media buyer." },
        },
        {
          to: `/admin/gos/clients/${cid}/daily-budget-planner`, label: "Daily Budget Planner", icon: DollarSign, needsClient: true, phase: "active",
          help: { title: "Daily Budget Planner", purpose: "Calcule les budgets ideaux par campagne pour la journee.", usedBy: "Si un budget doit etre ajuste aujourd'hui." },
        },
        {
          to: `/admin/gos/clients/${cid}/media-buying-automation`, label: "Media Buying Automation", icon: Zap, needsClient: true, phase: "active",
          help: { title: "Media Buying Automation", purpose: "Suggestions scale/cut basees sur des regles, avec cooldown anti-spam et model_runs auditables.", usedBy: "A consulter chaque jour avant de decider dans Buyer Workspace." },
        },
        {
          to: `/admin/gos/clients/${cid}/budget-change-gate`, label: "Budget Change Gate", icon: ShieldCheck, needsClient: true, phase: "active",
          help: { title: "Budget Change Gate", purpose: "Bloque ou conditionne un changement de budget si cash, marge, stock ou donnees ne le permettent pas.", usedBy: "Avant toute augmentation de budget significative (routing d'approbation selon le %)." },
        },
        {
          to: `/admin/gos/clients/${cid}/live-optimization`, label: "Optimisation live", icon: Zap, needsClient: true, phase: "active",
          help: { title: "Optimisation live", purpose: "Table operationnelle des revues : journal des decisions prises.", usedBy: "Pour retracer ce qui a ete decide et pourquoi." },
        },
        {
          to: `/admin/gos/clients/${cid}/growth-execution-map`, label: "Carte d'execution", icon: Map, needsClient: true, phase: "active",
          help: { title: "Carte d'execution", purpose: "Plan d'actions concretes par periode, priorise et rattache aux cibles et diagnostics.", usedBy: "Vue d'ensemble des actions en cours, au besoin." },
        },
        {
          to: `/admin/gos/clients/${cid}/map-notes`, label: "Map Notes (daily)", icon: FileText, needsClient: true, phase: "active",
          help: { title: "Map Notes", purpose: "Notes quoi / pourquoi / action-maintenant pour chaque changement fait aujourd'hui.", usedBy: "Fin de chaque journee, pour chaque compte actif." },
        },
        {
          to: `/admin/gos/clients/${cid}/daily-digest`, label: "Daily Digest 7h", icon: FileText, needsClient: true, phase: "active",
          help: { title: "Daily Digest", purpose: "Resume quotidien envoye automatiquement : MTD vs cible/projection, hier vs cible, notes du jour.", usedBy: "Ce que le client recoit chaque matin -- pas une page de travail." },
        },
      ],
    },
    {
      group: "REVIEW",
      items: [
        {
          to: `/admin/gos/clients/${cid}/wayfinder-wednesday`, label: "Wayfinder Wednesday", icon: CalendarClock, needsClient: true, phase: "active",
          help: { title: "Wayfinder Wednesday", purpose: "Rituel hebdo media + creatif : qu'est-ce qu'on garde, scale, coupe ou teste.", usedBy: "Chaque mercredi." },
        },
        {
          to: `/admin/gos/clients/${cid}/measurement`, label: "Mesure", icon: BarChart3, needsClient: true, phase: "active",
          help: { title: "Mesure", purpose: "Realite vs cibles + tests structures d'incrementalite. Variance et niveau d'alerte calcules automatiquement.", usedBy: "Chaque semaine, pour verifier si les resultats sont reels ou juste attribues par la plateforme." },
        },
        {
          to: `/admin/gos/clients/${cid}/weekly-executive-report`, label: "Weekly Executive Report", icon: FileText, needsClient: true, phase: "active",
          help: { title: "Weekly Executive Report", purpose: "Version client/executive de ce qui s'est passe cette semaine.", usedBy: "Envoi hebdomadaire au client." },
        },
        {
          to: `/admin/gos/clients/${cid}/forecast-updates`, label: "Mises a jour previsions", icon: RefreshCw, needsClient: true, phase: "active",
          help: { title: "Mises a jour previsions", purpose: "Met a jour le forecast suite a la realite mesuree, un evenement ou un apprentissage de test.", usedBy: "Quand l'ecart au plan devient significatif." },
        },
        {
          to: `/admin/gos/clients/${cid}/learning-loop`, label: "Boucle d'apprentissage", icon: GraduationCap, needsClient: true, phase: "active",
          help: { title: "Boucle d'apprentissage", purpose: "Archive des apprentissages : winners, losers, raisons, hypotheses.", usedBy: "Fin de cycle mensuel, avant Planification prochain cycle." },
        },
        {
          to: `/admin/gos/clients/${cid}/next-cycle-planning`, label: "Planification prochain cycle", icon: Rocket, needsClient: true, phase: "active",
          help: { title: "Planification prochain cycle", purpose: "Objectifs, hypotheses, budget et risques du mois suivant, ancres aux apprentissages actuels.", usedBy: "Fin de cycle mensuel." },
        },
      ],
    },
    {
      group: "AVANCE",
      items: [
        {
          to: `/admin/gos/clients/${cid}/data-analyst`, label: "Data Analyst", icon: Brain, needsClient: true, phase: "both",
          help: { title: "Data Analyst Foundation", purpose: "Verifie si les donnees sont assez propres pour faire confiance aux modeles.", usedBy: "Audit ponctuel, pas un usage quotidien." },
        },
        {
          to: `/admin/gos/clients/${cid}/data-analyst/statistical`, label: "Statistical Analyst", icon: Sigma, needsClient: true, phase: "both",
          help: { title: "Statistical Analyst", purpose: "Sorties Python : retention, anomalies, diagnostics de spend, contexte MMM.", usedBy: "Audit ponctuel." },
        },
        {
          to: `/admin/gos/clients/${cid}/data-analyst/execution`, label: "Analyst Execution", icon: ClipboardCheck, needsClient: true, phase: "both",
          help: { title: "Analyst Execution", purpose: "Transforme une analyse statistique en plan d'action controle.", usedBy: "Audit ponctuel." },
        },
        {
          to: "/admin/gos/ecommerce-financial-model", label: "Modele financier e-commerce", icon: DollarSign, phase: "both",
          help: { title: "Modele financier e-commerce", purpose: "Modele financier detaille, reserve aux clients e-commerce.", usedBy: "Analyse approfondie ponctuelle." },
        },
        {
          to: `/admin/gos/clients/${cid}/financial-consolidated`, label: "Finance consolidee", icon: DollarSign, needsClient: true, phase: "both",
          help: { title: "Finance consolidee", purpose: "Vue finance globale avancee.", usedBy: "Revue de direction." },
        },
        {
          to: `/admin/gos/clients/${cid}/ai-automations`, label: "Agents IA & automations", icon: Brain, needsClient: true, phase: "both",
          help: { title: "Agents IA & automations", purpose: "Lance et surveille des automatisations IA pour ce client : briefs, resumes, preparations de meetings.", usedBy: "Consultation ponctuelle." },
        },
      ],
    },
  ];
}

/** Renamed from "Retention & LTV Workspace" to avoid the naming collision
 *  with "Retention" above -- same data, clearer label. Kept separate here
 *  since it is a distinct tool (CRM/lifecycle segmentation, not a forecast
 *  input) living on its own route, not part of buildNav's main groups. */
export const RETENTION_LTV_WORKSPACE_ITEM = {
  labelOld: "Retention & LTV Workspace",
  labelNew: "Segments & Actions Client",
  reason:
    "predictLtv() + gos_retention_cohorts/gos_lifecycle_segments -- outil de segmentation " +
    "marketing (VIP, actions par segment), ne nourrit PAS le forecast. A garder distinct de " +
    "la page Retention (moteur retentionCohort.ts) qui, elle, alimente le forecast.",
};
