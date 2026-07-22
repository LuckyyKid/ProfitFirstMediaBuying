// src/gos/pageLibrary.ts
//
// Design system rule #10 — the ~50 GOS pages must be reachable via free access
// (sidebar Bibliothèque + ⌘K palette). This catalog classifies every route by
// phase and computes the concrete href given the currently-selected client.

export type PhaseKey =
  | "setup"
  | "plan"
  | "creative"
  | "daily"
  | "review"
  | "data";

// Client lifecycle phase. Different axis from the workflow phase above:
// "new" = onboarding/plan-30-days, "active" = live campaigns, "both" = either.
export type LifecyclePhase = "new" | "active" | "both";

export type PageEntry = {
  key: string;
  label: string;
  phase: PhaseKey;
  needsClient: boolean;
  // Given a clientId (or null), return the concrete route. Null = not routable now.
  buildHref: (clientId: string | null) => string | null;
  // For search: extra tokens that shouldn't appear in the label but should match.
  aliases?: string[];
  // Client lifecycle relevance — optional per entry; falls back to a sensible
  // default derived from the workflow phase (see lifecyclePhaseOf).
  lifecyclePhase?: LifecyclePhase;
};

// Default mapping workflow phase → lifecycle phase. Override per entry when
// the default is wrong (e.g. a review-phase page that's also useful during
// onboarding).
const PHASE_DEFAULT: Record<PhaseKey, LifecyclePhase> = {
  setup:    "new",
  plan:     "new",
  creative: "both",
  daily:    "active",
  review:   "active",
  data:     "both",
};

export function lifecyclePhaseOf(entry: PageEntry): LifecyclePhase {
  return entry.lifecyclePhase ?? PHASE_DEFAULT[entry.phase];
}

export type PhaseMeta = {
  key: PhaseKey;
  label: string;
  hint: string;
};

export const PHASES: PhaseMeta[] = [
  { key: "setup",    label: "Setup client",             hint: "config initiale, membres, catégories" },
  { key: "plan",     label: "Plan 30 jours",            hint: "diagnostic, forecast, targets" },
  { key: "creative", label: "Créatif",                  hint: "concepts, briefs, tests" },
  { key: "daily",    label: "Exécution quotidienne",    hint: "budgets, walkdown, checklists" },
  { key: "review",   label: "Review & apprentissage",   hint: "hebdo, exec report, learnings" },
  { key: "data",     label: "Données & réglages",       hint: "sources, automations, settings" },
];

const clientRoute = (clientId: string | null, tail: string) =>
  clientId ? `/admin/gos/clients/${clientId}/${tail}` : null;

const globalRoute = (tail: string) => `/admin/gos/${tail}`;

export const PAGE_LIBRARY: PageEntry[] = [
  // --- Setup client -------------------------------------------------------
  { key: "growth-model-setup",   label: "Growth model setup",     phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "growth-model-setup") },
  { key: "business-context",     label: "Business context",       phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "business-context") },
  { key: "financial-inputs",     label: "Financial inputs",       phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "financial-inputs") },
  { key: "products",             label: "Produits",               phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "products") },
  { key: "inventory",            label: "Inventaire",             phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "inventory") },
  { key: "quantitative-baseline",label: "Quantitative baseline",  phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "quantitative-baseline") },
  { key: "business-objectives",  label: "Business objectives",    phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "business-objectives") },
  { key: "campaign-categories",  label: "Catégories de campagnes", phase: "setup", needsClient: true,
    buildHref: (c) => clientRoute(c, "campaign-categories") },
  { key: "members",              label: "Membres du compte",      phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "members") },
  { key: "intelligence",         label: "Client intelligence",    phase: "setup",  needsClient: true,
    buildHref: (c) => clientRoute(c, "intelligence") },
  { key: "ecommerce-financial-model-client", label: "Modèle financier ecommerce", phase: "setup", needsClient: true,
    buildHref: (c) => clientRoute(c, "ecommerce-financial-model") },

  // --- Plan 30 jours ------------------------------------------------------
  { key: "growth-diagnosis",     label: "Diagnostic de croissance", phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "growth-diagnosis") },
  { key: "planning-prediction",  label: "Planning & prédiction",   phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "planning-prediction") },
  { key: "forecast",             label: "Forecast",                phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "forecast") },
  { key: "metric-targets",       label: "Cibles métriques",        phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "metric-targets") },
  { key: "spending-power",       label: "Spending power",          phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "spending-power") },
  { key: "event-effect",         label: "Event effect",            phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "event-effect") },
  { key: "retention",            label: "Retention",               phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "retention") },
  { key: "retention-ltv",        label: "Retention & LTV",         phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "retention-ltv") },
  { key: "sku-demand-plan-client", label: "SKU demand plan",       phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "sku-demand-plan") },
  { key: "growth-execution-map", label: "Growth execution map",    phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "growth-execution-map") },
  { key: "next-cycle-planning",  label: "Next cycle planning",     phase: "plan", needsClient: true,
    buildHref: (c) => clientRoute(c, "next-cycle-planning") },

  // --- Créatif ------------------------------------------------------------
  { key: "creative-demand",      label: "Creative demand",         phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "creative-demand") },
  { key: "concept-log",          label: "Concept log",             phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "concept-log") },
  { key: "creative-brief",       label: "Creative brief",          phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "creative-brief") },
  { key: "wayfinder-wednesday",  label: "Wayfinder Wednesday",     phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "wayfinder-wednesday") },
  { key: "testing-roadmap",      label: "Creative testing roadmap", phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "testing-roadmap") },
  { key: "offer-lab",            label: "Offer lab",               phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "offer-lab") },
  { key: "angle-audience-matrix", label: "Angle × Audience matrix", phase: "creative", needsClient: true,
    buildHref: (c) => clientRoute(c, "angle-audience-matrix") },

  // --- Exécution quotidienne ---------------------------------------------
  { key: "walkdown",             label: "Walkdown",                phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "walkdown") },
  { key: "buyer-workspace",      label: "Buyer workspace",         phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "buyer-workspace") },
  { key: "daily-budget-planner", label: "Daily budget planner",    phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "daily-budget-planner") },
  { key: "budget-change-gate",   label: "Budget change gate",      phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "budget-change-gate"),
    aliases: ["gate", "guard"] },
  { key: "daily-pnl",            label: "Daily P&L",               phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "daily-pnl") },
  { key: "daily-digest",         label: "Daily digest",            phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "daily-digest") },
  { key: "map-notes",            label: "Notes de journée",        phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "map-notes"),
    aliases: ["map", "notes"] },
  { key: "live-optimization",    label: "Live optimization",       phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "live-optimization") },
  { key: "manual-checklist",     label: "Checklist manuelle",      phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "manual-checklist") },
  { key: "media-buying-automation", label: "Media buying automation", phase: "daily", needsClient: true,
    buildHref: (c) => clientRoute(c, "media-buying-automation") },

  // --- Review & apprentissage --------------------------------------------
  { key: "weekly-pnl",           label: "Weekly P&L",              phase: "review", needsClient: true,
    buildHref: (c) => clientRoute(c, "weekly-pnl") },
  { key: "weekly-executive-report", label: "Weekly executive report", phase: "review", needsClient: true,
    buildHref: (c) => clientRoute(c, "weekly-executive-report") },
  { key: "financial-consolidated", label: "Financial consolidated", phase: "review", needsClient: true,
    buildHref: (c) => clientRoute(c, "financial-consolidated") },
  { key: "measurement",          label: "Measurement",             phase: "review", needsClient: true,
    buildHref: (c) => clientRoute(c, "measurement") },
  { key: "forecast-updates",     label: "Forecast updates",        phase: "review", needsClient: true,
    buildHref: (c) => clientRoute(c, "forecast-updates") },
  { key: "learning-loop",        label: "Learning loop",           phase: "review", needsClient: true,
    buildHref: (c) => clientRoute(c, "learning-loop") },

  // --- Données & réglages ------------------------------------------------
  { key: "data-analyst-foundation", label: "Data analyst — foundation", phase: "data", needsClient: true,
    buildHref: (c) => clientRoute(c, "data-analyst") },
  { key: "data-analyst-statistical", label: "Data analyst — statistical", phase: "data", needsClient: true,
    buildHref: (c) => clientRoute(c, "data-analyst/statistical") },
  { key: "data-analyst-execution", label: "Data analyst — execution", phase: "data", needsClient: true,
    buildHref: (c) => clientRoute(c, "data-analyst/execution") },
  { key: "profit-first-workspace", label: "Profit First workspace", phase: "data", needsClient: true,
    buildHref: (c) => clientRoute(c, "profit-first-workspace") },
  { key: "ai-automations",       label: "AI automations",          phase: "data", needsClient: true,
    buildHref: (c) => clientRoute(c, "ai-automations") },
  { key: "data-sources",         label: "Data sources",            phase: "data", needsClient: false,
    buildHref: () => globalRoute("data-sources") },
  { key: "ecommerce-financial-model-global", label: "Modèle financier ecommerce (global)", phase: "data", needsClient: false,
    buildHref: () => globalRoute("ecommerce-financial-model") },
  { key: "sku-demand-plan-global", label: "SKU demand plan (global)", phase: "data", needsClient: false,
    buildHref: () => globalRoute("sku-demand-plan") },
  { key: "settings",             label: "Settings",                phase: "data", needsClient: false,
    buildHref: () => globalRoute("settings") },
];

export function groupPagesByPhase(entries: PageEntry[] = PAGE_LIBRARY): Record<PhaseKey, PageEntry[]> {
  const out: Record<PhaseKey, PageEntry[]> = {
    setup: [], plan: [], creative: [], daily: [], review: [], data: [],
  };
  for (const entry of entries) out[entry.phase].push(entry);
  return out;
}

export function searchPages(query: string, entries: PageEntry[] = PAGE_LIBRARY): PageEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) => {
    const hay = [entry.label, entry.key, ...(entry.aliases ?? [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export function findPageByPath(pathname: string, clientId: string | null): PageEntry | null {
  for (const entry of PAGE_LIBRARY) {
    const href = entry.buildHref(clientId);
    if (href && (pathname === href || pathname.startsWith(href + "/"))) return entry;
  }
  return null;
}
