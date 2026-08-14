import { supabase } from "@/integrations/supabase/client";

export interface MetaDashboardConfig {
  client_code: string;
  google_sheet_id: string;
  tab_name: string;
  active: boolean;
  updated_at?: string;
  // Anomaly-check fields (added by check-ad-anomalies system).
  // Optional because Lovable's meta-dashboard-config-get may not return them
  // until its query is updated — the UI reads them defensively.
  client_type?: "ecom" | "local";
  daily_budget_planned?: number;
  conversion_metric?: "purchases" | "leads";
  target_cpl_or_roas?: number;
  anomaly_checks_enabled?: boolean;
}

export interface AnomalyConfigPatch {
  client_code: string;
  client_type?: "ecom" | "local";
  daily_budget_planned?: number;
  conversion_metric?: "purchases" | "leads";
  target_cpl_or_roas?: number;
  anomaly_checks_enabled?: boolean;
}

export interface MetaDashboardKpis {
  spend: number;
  purchases: number;
  purchase_value: number;
  roas: number;
  ctr: number;
  cpm: number;
  cpc?: number;
  cpa?: number;
  aov?: number;
  impressions?: number;
  clicks?: number;
  reach_approx?: number;
  frequency_approx?: number;
  add_to_cart?: number;
  checkouts_initiated?: number;
}

export interface MetaDashboardDailyPoint {
  date: string;
  spend?: number;
  purchases?: number;
  purchase_value?: number;
  impressions?: number;
  clicks?: number;
  add_to_cart?: number;
  checkouts_initiated?: number;
  [key: string]: string | number | undefined;
}

export interface MetaDashboardDataResponse {
  headers: string[];
  rows: Array<Record<string, string | number>>;
  daily?: MetaDashboardDailyPoint[];
  kpis: MetaDashboardKpis;
  last_refreshed_at: string;
  notes?: Record<string, string>;
}

export interface TestSheetSuccess {
  ok: true;
  headers: string[];
  row_count_estimate: number;
}

export interface TestSheetFailure {
  ok: false;
  error: string;
  reason: "not_shared" | "not_found" | "invalid_id" | "other";
}

export type TestSheetResult = TestSheetSuccess | TestSheetFailure;

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError: read the actual response body from error.context
    // so the user sees the real reason (missing config, unauth, function not
    // deployed, etc.) instead of the generic "non-2xx status code".
    let serverMsg: string | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const raw = await ctx.text();
        try {
          const parsed = JSON.parse(raw) as { error?: string; message?: string };
          serverMsg = parsed.error ?? parsed.message ?? raw;
        } catch {
          serverMsg = raw;
        }
      } catch {
        // ignore body read errors
      }
    }
    const inline = (data as { error?: string } | null)?.error;
    throw new Error(serverMsg || inline || error.message || "Erreur inattendue");
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export function extractSheetIdFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function getMetaDashboardConfig(clientCode: string) {
  return invoke<{ config: MetaDashboardConfig | null }>("meta-dashboard-config-get", {
    client_code: clientCode,
  });
}

export async function upsertMetaDashboardConfig(payload: {
  client_code: string;
  google_sheet_id: string;
  tab_name?: string;
  active?: boolean;
}) {
  return invoke<{ config: MetaDashboardConfig }>("meta-dashboard-config-upsert", payload);
}

export async function deleteMetaDashboardConfig(clientCode: string) {
  return invoke<{ deleted: boolean }>("meta-dashboard-config-delete", {
    client_code: clientCode,
  });
}

export async function testMetaDashboardSheet(payload: {
  google_sheet_id: string;
  tab_name?: string;
}) {
  return invoke<TestSheetResult>("meta-dashboard-test-sheet", payload);
}

export async function updateAnomalyConfig(payload: AnomalyConfigPatch) {
  return invoke<{
    config: {
      client_code: string;
      client_type: "ecom" | "local";
      daily_budget_planned: number;
      conversion_metric: "purchases" | "leads";
      target_cpl_or_roas: number;
      anomaly_checks_enabled: boolean;
    };
  }>("meta-dashboard-config-anomaly-set", payload);
}

export async function fetchMetaDashboardData(payload: {
  client_code: string;
  date_from?: string;
  date_to?: string;
}) {
  return invoke<MetaDashboardDataResponse>("meta-dashboard-data", payload);
}
