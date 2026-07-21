// Wave 10A — Data Source Registry helpers
// Deterministic. No LLM. No API.

export const SOURCE_TYPES = [
  "SHOPIFY","META_ADS","GOOGLE_ADS","GA4","KLAVIYO","TIKTOK_ADS",
  "AMAZON","STRIPE","QUICKBOOKS","MANUAL_UPLOAD","GOOGLE_SHEETS","OTHER",
] as const;
export type SourceType = typeof SOURCE_TYPES[number];

export const CONNECTION_MODES = [
  "NOT_CONNECTED","MANUAL_ENTRY","MANUAL_EXPORT","CSV_UPLOAD","API_PLACEHOLDER","API_CONNECTED",
] as const;
export type ConnectionMode = typeof CONNECTION_MODES[number];

export const CONNECTION_STATUSES = [
  "NOT_STARTED","NEEDS_ACCESS","CONNECTED","ERROR","STALE","DISABLED",
] as const;
export type ConnectionStatus = typeof CONNECTION_STATUSES[number];

export const FRESHNESS_STATUSES = ["FRESH","STALE","MISSING","UNKNOWN"] as const;
export type FreshnessStatus = typeof FRESHNESS_STATUSES[number];

export type DataSource = {
  id: string;
  client_id: string;
  source_type: SourceType;
  source_name: string;
  connection_mode: ConnectionMode;
  connection_status: ConnectionStatus;
  last_sync_at: string | null;
  data_freshness_status: FreshnessStatus;
  reliability_score: number;
  feeds: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Default reliability by connection mode (0-100). */
export function reliabilityFor(mode: ConnectionMode): number {
  switch (mode) {
    case "API_CONNECTED":   return 95;
    case "API_PLACEHOLDER": return 30;
    case "MANUAL_EXPORT":   return 70;
    case "CSV_UPLOAD":      return 70;
    case "MANUAL_ENTRY":    return 55;
    case "NOT_CONNECTED":   return 0;
  }
}

/** Freshness auto-derived from last_sync_at. */
export function freshnessFromLastSync(lastSyncAt: string | null | undefined): FreshnessStatus {
  if (!lastSyncAt) return "MISSING";
  const ageDays = (Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return "FRESH";
  if (ageDays <= 30) return "STALE";
  return "MISSING";
}

/** Short description of what a source typically feeds. */
export function feedsHintFor(t: SourceType): string {
  switch (t) {
    case "SHOPIFY":       return "Revenu, commandes, AOV, nouveaux clients";
    case "META_ADS":      return "Dépense pub, ROAS Meta, créatifs";
    case "GOOGLE_ADS":    return "Dépense pub, ROAS Google, mots-clés";
    case "GA4":           return "Sessions, conversions, sources trafic";
    case "KLAVIYO":       return "Revenu email, flows, LTV";
    case "TIKTOK_ADS":    return "Dépense pub, ROAS TikTok, créatifs";
    case "AMAZON":        return "Revenu Amazon, ACoS";
    case "STRIPE":        return "Paiements, MRR, refunds";
    case "QUICKBOOKS":    return "Compta, marges, cashflow";
    case "MANUAL_UPLOAD": return "Données ponctuelles importées";
    case "GOOGLE_SHEETS": return "KPIs suivis en spreadsheet";
    case "OTHER":         return "Divers";
  }
}

/** Core e-commerce sources whose absence should degrade Data Quality. */
export const CORE_ECOM_SOURCES: SourceType[] = ["SHOPIFY", "META_ADS", "GA4"];

/** Core local-service sources whose absence should degrade Data Quality. */
export const CORE_LOCAL_SOURCES: SourceType[] = ["META_ADS", "GOOGLE_ADS"];

export type DataSourceHealth = {
  total: number;
  api: number;
  manual: number;
  stale: number;
  missing: number;
  avgReliability: number;   // 0-100, 0 if none
  missingCore: SourceType[];
};

export function computeSourceHealth(
  sources: DataSource[],
  businessType: string | null | undefined,
): DataSourceHealth {
  const total = sources.length;
  const api = sources.filter(s => s.connection_mode === "API_CONNECTED").length;
  const manual = sources.filter(s =>
    s.connection_mode === "MANUAL_ENTRY" ||
    s.connection_mode === "MANUAL_EXPORT" ||
    s.connection_mode === "CSV_UPLOAD"
  ).length;
  const stale = sources.filter(s => s.data_freshness_status === "STALE").length;
  const missing = sources.filter(s =>
    s.data_freshness_status === "MISSING" || s.connection_status === "NEEDS_ACCESS"
  ).length;

  const rels = sources
    .filter(s => s.connection_mode !== "NOT_CONNECTED")
    .map(s => s.reliability_score);
  const avgReliability = rels.length > 0
    ? Math.round(rels.reduce((a, b) => a + b, 0) / rels.length)
    : 0;

  const core = businessType === "LOCAL_SERVICE" ? CORE_LOCAL_SOURCES : CORE_ECOM_SOURCES;
  const present = new Set(
    sources.filter(s => s.connection_mode !== "NOT_CONNECTED").map(s => s.source_type)
  );
  const missingCore = core.filter(t => !present.has(t));

  return { total, api, manual, stale, missing, avgReliability, missingCore };
}
