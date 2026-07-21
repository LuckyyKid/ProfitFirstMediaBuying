import { supabase } from "@/integrations/supabase/client";
import { runRetentionCohortV2, type ActivityRow, type RetentionCohortResult } from "./retentionCohort";
import {
  fetchCustomerTransactions,
  type CustomerTransactionRow,
} from "./customerCohortController";

type QueryRow = Record<string, unknown>;

export type RetentionSelectedClient = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  industry?: string | null;
  am_owner?: string | null;
  launch_target_date?: string | null;
};

export type RetentionFinancialInput = {
  aov?: number | null;
  target_mer?: number | null;
  gross_margin_percent?: number | null;
};

export type RetentionSnapshot = {
  id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  new_customers: number | null;
  returning_customers: number | null;
  repeat_rate_pct: number | null;
  ltv_30d: number | null;
  ltv_60d: number | null;
  ltv_90d: number | null;
  ltv_365d: number | null;
  avg_orders_per_customer: number | null;
};

export type CustomerActivitySnapshot = ActivityRow & {
  id: string;
  client_id?: string | null;
  retention_quality?: string | null;
  backtest_error_percent?: number | null;
};

export type RetentionPageData = {
  client: RetentionSelectedClient | null;
  financial_input: RetentionFinancialInput | null;
  snapshots: RetentionSnapshot[];
  activity: CustomerActivitySnapshot[];
  transactions: CustomerTransactionRow[];
};

export type RetentionSnapshotDraft = {
  period_label: string;
  period_start?: string | null;
  period_end?: string | null;
  new_customers?: unknown;
  returning_customers?: unknown;
  avg_orders_per_customer?: unknown;
  ltv_90d?: unknown;
};

export type ActivitySnapshotDraft = {
  snapshot_month: string;
  new_customers?: unknown;
  reactivated_customers?: unknown;
  active_customers?: unknown;
  lapsed_customers?: unknown;
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function requiredString(value: unknown, message: string): string {
  const text = optionalString(value);
  if (!text) throw new Error(message);
  return text;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeRetentionClientRow(row: QueryRow): RetentionSelectedClient {
  return {
    id: String(row.id ?? ""),
    client_code: optionalString(row.client_code) ?? "",
    company_name: optionalString(row.company_name) ?? optionalString(row.name) ?? "",
    business_type: optionalString(row.business_type) ?? "",
    current_phase: optionalString(row.current_phase) ?? "",
    risk_level: optionalString(row.risk_level) ?? "",
    industry: optionalString(row.industry),
    am_owner: optionalString(row.am_owner),
    launch_target_date: optionalString(row.launch_target_date),
  };
}

export function normalizeRetentionFinancialInputRow(row: QueryRow | null | undefined): RetentionFinancialInput | null {
  if (!row) return null;
  return {
    aov: optionalNumber(row.aov),
    target_mer: optionalNumber(row.target_mer),
    gross_margin_percent: optionalNumber(row.gross_margin_percent),
  };
}

export function normalizeRetentionSnapshotRow(row: QueryRow): RetentionSnapshot {
  return {
    id: String(row.id ?? ""),
    period_label: optionalString(row.period_label) ?? "",
    period_start: optionalString(row.period_start),
    period_end: optionalString(row.period_end),
    new_customers: optionalNumber(row.new_customers),
    returning_customers: optionalNumber(row.returning_customers),
    repeat_rate_pct: optionalNumber(row.repeat_rate_pct),
    ltv_30d: optionalNumber(row.ltv_30d),
    ltv_60d: optionalNumber(row.ltv_60d),
    ltv_90d: optionalNumber(row.ltv_90d),
    ltv_365d: optionalNumber(row.ltv_365d),
    avg_orders_per_customer: optionalNumber(row.avg_orders_per_customer),
  };
}

export function normalizeCustomerActivitySnapshotRow(row: QueryRow): CustomerActivitySnapshot {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    snapshot_month: optionalString(row.snapshot_month) ?? "",
    new_customers: optionalNumber(row.new_customers) ?? 0,
    reactivated_customers: optionalNumber(row.reactivated_customers) ?? 0,
    active_customers: optionalNumber(row.active_customers) ?? 0,
    lapsed_customers: optionalNumber(row.lapsed_customers) ?? 0,
    net_active_customer_change: optionalNumber(row.net_active_customer_change),
    quick_ratio: optionalNumber(row.quick_ratio),
    retention_quality: optionalString(row.retention_quality),
    backtest_error_percent: optionalNumber(row.backtest_error_percent),
  };
}

export function projectRetentionLtv(aov: number, avgOrdersPerCustomer: number, repeatRatePct: number) {
  const base = aov * Math.max(1, avgOrdersPerCustomer);
  const rr = repeatRatePct / 100;
  return {
    ltv_30d: Math.round(base),
    ltv_60d: Math.round(base * (1 + rr * 0.3)),
    ltv_90d: Math.round(base * (1 + rr * 0.55)),
    ltv_365d: Math.round(base * (1 + rr * 1.6)),
  };
}

export function toRetentionSnapshotPayload(
  clientId: string,
  draft: RetentionSnapshotDraft,
  financialInput: RetentionFinancialInput | null,
) {
  const periodLabel = requiredString(draft.period_label, "Label periode requis");
  const newCustomers = optionalNumber(draft.new_customers) ?? 0;
  const returningCustomers = optionalNumber(draft.returning_customers) ?? 0;
  const totalCustomers = newCustomers + returningCustomers;
  const repeatRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
  const avgOrders = optionalNumber(draft.avg_orders_per_customer) ?? 1;
  const explicitLtv90 = optionalNumber(draft.ltv_90d);
  const projected = projectRetentionLtv(financialInput?.aov ?? 0, avgOrders, repeatRate);

  return {
    client_id: clientId,
    period_label: periodLabel,
    period_start: optionalString(draft.period_start),
    period_end: optionalString(draft.period_end),
    new_customers: newCustomers,
    returning_customers: returningCustomers,
    repeat_rate_pct: Number(repeatRate.toFixed(2)),
    avg_orders_per_customer: avgOrders,
    ...projected,
    ltv_90d: explicitLtv90 ?? projected.ltv_90d,
    cohort_data: {
      formula: explicitLtv90 === null ? "ltv = aov * avg_orders * (1 + repeat_rate * factor)" : "manual_ltv_90d_with_projected_supporting_ltv",
      aov: financialInput?.aov ?? 0,
    },
  };
}

export function toActivitySnapshotPayload(clientId: string, draft: ActivitySnapshotDraft) {
  const snapshotMonth = requiredString(draft.snapshot_month, "Mois requis");
  const newCustomers = optionalNumber(draft.new_customers) ?? 0;
  const reactivatedCustomers = optionalNumber(draft.reactivated_customers) ?? 0;
  const activeCustomers = optionalNumber(draft.active_customers) ?? 0;
  const lapsedCustomers = optionalNumber(draft.lapsed_customers) ?? 0;
  const net = newCustomers + reactivatedCustomers + activeCustomers - lapsedCustomers;
  const quickRatio = newCustomers + reactivatedCustomers + activeCustomers === 0 && lapsedCustomers === 0
    ? 0
    : (newCustomers + reactivatedCustomers + activeCustomers) / Math.max(lapsedCustomers, 1);

  return {
    client_id: clientId,
    snapshot_month: snapshotMonth,
    new_customers: newCustomers,
    reactivated_customers: reactivatedCustomers,
    active_customers: activeCustomers,
    lapsed_customers: lapsedCustomers,
    net_active_customer_change: net,
    quick_ratio: Number(quickRatio.toFixed(2)),
  };
}

export function toRetentionCohortModelRunPayload(
  clientId: string,
  activity: CustomerActivitySnapshot[],
  output: RetentionCohortResult,
) {
  return {
    client_id: clientId,
    model_name: "retention_cohort_engine_v2",
    model_version: "1.0",
    input_json: { activity: jsonClone(activity) },
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: { engine: "quick_ratio + net_active_change + leave-one-out backtest" },
    generated_by: "gos_retention",
  };
}

export async function fetchRetentionPageData(clientId: string): Promise<RetentionPageData> {
  const [clientResult, financialResult, snapshotResult, activityResult, transactions] = await Promise.all([
    supabase.from("gos_clients" as never).select("*").eq("id", clientId).single(),
    supabase.from("gos_financial_inputs" as never).select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("gos_retention_snapshots" as never).select("*").eq("client_id", clientId).order("period_start", { ascending: false }),
    supabase.from("gos_customer_activity_snapshots" as never).select("*").eq("client_id", clientId).order("snapshot_month", { ascending: true }),
    fetchCustomerTransactions(clientId),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (financialResult.error) throw financialResult.error;
  if (snapshotResult.error) throw snapshotResult.error;
  if (activityResult.error) throw activityResult.error;

  return {
    client: clientResult.data ? normalizeRetentionClientRow(clientResult.data as QueryRow) : null,
    financial_input: normalizeRetentionFinancialInputRow(financialResult.data as QueryRow | null),
    snapshots: ((snapshotResult.data ?? []) as QueryRow[]).map(normalizeRetentionSnapshotRow),
    activity: ((activityResult.data ?? []) as QueryRow[]).map(normalizeCustomerActivitySnapshotRow),
    transactions,
  };
}

export async function createRetentionSnapshot(
  clientId: string,
  draft: RetentionSnapshotDraft,
  financialInput: RetentionFinancialInput | null,
) {
  const payload = toRetentionSnapshotPayload(clientId, draft, financialInput);
  const { error } = await supabase.from("gos_retention_snapshots" as never).insert(payload as never);
  if (error) throw error;
  return payload;
}

export async function updateRetentionSnapshot(
  id: string,
  draft: RetentionSnapshotDraft,
  financialInput: RetentionFinancialInput | null,
) {
  const payload = toRetentionSnapshotPayload("__unused__", draft, financialInput);
  const { client_id: _clientId, ...patch } = payload;
  const { error } = await supabase.from("gos_retention_snapshots" as never).update(patch as never).eq("id", id);
  if (error) throw error;
  return patch;
}

export async function deleteRetentionSnapshot(id: string) {
  const { error } = await supabase.from("gos_retention_snapshots" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function createActivitySnapshot(clientId: string, draft: ActivitySnapshotDraft) {
  const payload = toActivitySnapshotPayload(clientId, draft);
  const { error } = await supabase.from("gos_customer_activity_snapshots" as never).insert(payload as never);
  if (error) throw error;
  return payload;
}

export async function deleteActivitySnapshot(id: string) {
  const { error } = await supabase.from("gos_customer_activity_snapshots" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function runAndSaveRetentionCohortEngine(
  clientId: string,
  activity: CustomerActivitySnapshot[],
  output: RetentionCohortResult,
) {
  if (activity.length === 0) throw new Error("Ajoute au moins un mois d'activite");
  const latest = activity[activity.length - 1];
  const { error } = await supabase
    .from("gos_customer_activity_snapshots" as never)
    .update({
      retention_quality: output.quality,
      backtest_error_percent: output.backtest_error_percent,
    } as never)
    .eq("id", latest.id);
  if (error) throw error;

  const { error: runError } = await supabase
    .from("model_runs" as never)
    .insert(toRetentionCohortModelRunPayload(clientId, activity, output) as never);
  if (runError) throw runError;
}
