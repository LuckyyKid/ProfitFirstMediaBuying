// Data Mode + Data Quality helpers (Phase 9A — No-Access Dry Run)
// Deterministic. No LLM. No API calls.

export const DATA_MODES = [
  "DEMO_DATA",
  "ANONYMIZED_HISTORICAL",
  "MANUAL_CLIENT_EXPORT",
  "API_CONNECTED",
] as const;
export type DataMode = typeof DATA_MODES[number];

export type DataModeMeta = {
  label: string;
  short: string;
  color: string;
  bg: string;
  usage: string;
  clientFacing: boolean;
  confidenceCap: number; // hard cap on any confidence % that can be shown
};

export const DATA_MODE_META: Record<DataMode, DataModeMeta> = {
  DEMO_DATA: {
    label: "Demo Data",
    short: "DEMO",
    color: "#a8730a",
    bg: "#fff4d9",
    usage: "For workflow validation only. Do NOT communicate outputs to a real client.",
    clientFacing: false,
    confidenceCap: 40,
  },
  ANONYMIZED_HISTORICAL: {
    label: "Historical Proxy",
    short: "HIST PROXY",
    color: "#5b3a8a",
    bg: "#ece0ff",
    usage: "Anonymized historical data. Use for calibration only — not client-facing prediction.",
    clientFacing: false,
    confidenceCap: 60,
  },
  MANUAL_CLIENT_EXPORT: {
    label: "Manual Export",
    short: "MANUAL",
    color: "#0b5cad",
    bg: "#e0edff",
    usage: "Manually entered data from a client export. Usable internally. Forecast remains conditional.",
    clientFacing: false,
    confidenceCap: 75,
  },
  API_CONNECTED: {
    label: "API Connected",
    short: "API",
    color: "#0f8a44",
    bg: "#e3f7ec",
    usage: "Live API-sourced data. Full confidence allowed if completeness is high.",
    clientFacing: true,
    confidenceCap: 100,
  },
};

export function forecastWarning(mode: DataMode | null | undefined): string | null {
  const m = (mode ?? "DEMO_DATA") as DataMode;
  if (m === "API_CONNECTED") return null;
  return "This forecast is based on manually entered or proxy data. Use for internal planning, not as a client guarantee.";
}

/** Cap a raw confidence value (0-100) to the ceiling allowed by the data mode. */
export function capConfidence(raw: number | null | undefined, mode: DataMode | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const val = raw <= 1 ? raw * 100 : raw;
  const cap = DATA_MODE_META[(mode ?? "DEMO_DATA") as DataMode].confidenceCap;
  return Math.min(Math.round(val), cap);
}

// --- Manual Data Checklist requirements per business type ---

export type ChecklistField = { key: string; label: string; required: boolean };

export const ECOM_CHECKLIST: ChecklistField[] = [
  { key: "revenue_30d",         label: "Revenue 30d",           required: true },
  { key: "ad_spend_30d",        label: "Ad Spend 30d",          required: true },
  { key: "orders_30d",          label: "Orders 30d",            required: true },
  { key: "aov",                 label: "AOV",                   required: true },
  { key: "cac_or_new_customers",label: "CAC or New Customers",  required: true },
  { key: "mer_or_roas",         label: "MER or ROAS",           required: true },
  { key: "gross_margin_percent",label: "Gross Margin %",        required: true },
  { key: "target_cac",          label: "Target CAC",            required: true },
  { key: "product_to_push",     label: "Product to push",       required: true },
  { key: "product_to_avoid",    label: "Product to avoid",      required: true },
  { key: "inventory_risk",      label: "Inventory risk",        required: true },
  { key: "creative_signals",    label: "Creative signals",      required: false },
];

export const LOCAL_CHECKLIST: ChecklistField[] = [
  { key: "leads_30d",           label: "Leads 30d",                    required: true },
  { key: "qualified_leads_30d", label: "Qualified leads 30d",          required: true },
  { key: "booked_appts_30d",    label: "Booked appointments 30d",      required: true },
  { key: "jobs_closed_30d",     label: "Jobs closed 30d",              required: true },
  { key: "revenue_30d",         label: "Revenue 30d",                  required: true },
  { key: "ad_spend_30d",        label: "Ad spend 30d",                 required: true },
  { key: "avg_job_value",       label: "Average job value",            required: true },
  { key: "gross_margin_percent",label: "Gross margin %",               required: true },
  { key: "close_rate",          label: "Close rate",                   required: true },
  { key: "capacity_per_week",   label: "Capacity per week",            required: true },
  { key: "response_time",       label: "Response time",                required: false },
];

export function checklistFor(businessType: string | null | undefined): ChecklistField[] {
  if (businessType === "LOCAL_SERVICE") return LOCAL_CHECKLIST;
  return ECOM_CHECKLIST;
}

/**
 * Compute Data Quality Score (0-100).
 * Base (v1):
 * - 70% completeness of required checklist fields
 * - 15% source reliability (API > MANUAL > HIST > DEMO)
 * - 15% recency (based on quantitative baseline updated_at)
 *
 * Wave 10A adjustment (optional, only if `sources` provided):
 * - Reweighted to 55% completeness / 10% mode / 10% recency / 15% source registry / 10% freshness
 * - Missing core sources (Shopify/Meta/GA4 for ecom; Meta/Google for local) subtracts up to 20 pts.
 * - Stale sources subtract up to 10 pts.
 */
export function computeDataQualityScore(args: {
  businessType: string | null | undefined;
  mode: DataMode;
  filled: Record<string, unknown>;
  baselineUpdatedAt?: string | null;
  sources?: {
    total: number;
    api: number;
    manual: number;
    stale: number;
    missing: number;
    avgReliability: number;
    missingCore: string[];
  } | null;
}): {
  score: number;
  completeness: number;
  source: number;
  recency: number;
  missing: string[];
  sourceHealth?: number;
  freshnessPenalty?: number;
  missingCorePenalty?: number;
} {
  const list = checklistFor(args.businessType).filter((f) => f.required);
  const filledCount = list.filter((f) => {
    const v = args.filled[f.key];
    return v !== undefined && v !== null && v !== "" && !(typeof v === "number" && !Number.isFinite(v));
  }).length;
  const completeness = list.length > 0 ? (filledCount / list.length) : 0;

  const sourceMap: Record<DataMode, number> = {
    DEMO_DATA: 0.2,
    ANONYMIZED_HISTORICAL: 0.5,
    MANUAL_CLIENT_EXPORT: 0.8,
    API_CONNECTED: 1.0,
  };
  const source = sourceMap[args.mode];

  let recency = 0;
  if (args.baselineUpdatedAt) {
    const ageDays = (Date.now() - new Date(args.baselineUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) recency = 1;
    else if (ageDays <= 30) recency = 0.75;
    else if (ageDays <= 60) recency = 0.5;
    else if (ageDays <= 90) recency = 0.25;
    else recency = 0.1;
  }

  const missing = list.filter((f) => {
    const v = args.filled[f.key];
    return v === undefined || v === null || v === "";
  }).map((f) => f.label);

  // v1 legacy scoring when no sources info is supplied.
  if (!args.sources) {
    const raw = completeness * 0.7 + source * 0.15 + recency * 0.15;
    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
    return {
      score,
      completeness: Math.round(completeness * 100),
      source: Math.round(source * 100),
      recency: Math.round(recency * 100),
      missing,
    };
  }

  // v2 — factor the source registry (Wave 10A).
  const sourceHealth = args.sources.total > 0
    ? Math.min(1, args.sources.avgReliability / 100)
    : 0;
  const freshnessPenalty = args.sources.total > 0
    ? Math.min(1, args.sources.stale / Math.max(1, args.sources.total))
    : 0;
  const missingCorePenalty = Math.min(1, args.sources.missingCore.length / 3);

  const raw =
    completeness * 0.55 +
    source * 0.10 +
    recency * 0.10 +
    sourceHealth * 0.15 +
    (1 - freshnessPenalty) * 0.10;

  // Missing core sources subtract up to 20 points on top.
  const penalty = missingCorePenalty * 0.20;
  const adjusted = Math.max(0, raw - penalty);
  const score = Math.max(0, Math.min(100, Math.round(adjusted * 100)));

  return {
    score,
    completeness: Math.round(completeness * 100),
    source: Math.round(source * 100),
    recency: Math.round(recency * 100),
    missing,
    sourceHealth: Math.round(sourceHealth * 100),
    freshnessPenalty: Math.round(freshnessPenalty * 100),
    missingCorePenalty: Math.round(missingCorePenalty * 100),
  };
}

