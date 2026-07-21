import { supabase } from "@/integrations/supabase/client";
import { v1Threshold } from "./spendingPowerV2";
import { normalizeRetentionFinancialInputRow, type RetentionFinancialInput } from "./retentionController";
import { normalizeSpendingPowerSnapshotRow, type SpendingPowerSnapshot } from "./spendingPowerController";

type QueryRow = Record<string, unknown>;

export type PlanningPredictionData = {
  client: Record<string, unknown> | null;
  events: QueryRow[];
  retention: QueryRow[];
  spending: SpendingPowerSnapshot[];
  financial_input: RetentionFinancialInput | null;
};

export type PlanningEventDraft = {
  event_name: string;
  event_type?: string | null;
  expected_lift_pct?: unknown;
  start_date?: string | null;
  end_date?: string | null;
};

export type PlanningRetentionDraft = {
  period_label: string;
  new_customers?: unknown;
  returning_customers?: unknown;
  ltv_90d?: unknown;
  avg_orders_per_customer?: unknown;
};

export type PlanningSpendingDraft = {
  period_label: string;
  cash_available?: unknown;
  monthly_burn?: unknown;
  gross_margin_pct?: unknown;
  target_roas?: unknown;
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

export function toPlanningEventPayload(draft: PlanningEventDraft) {
  return {
    event_name: requiredString(draft.event_name, "Nom requis"),
    event_type: optionalString(draft.event_type) ?? "PROMO",
    start_date: optionalString(draft.start_date),
    end_date: optionalString(draft.end_date),
    expected_lift_pct: optionalNumber(draft.expected_lift_pct),
  };
}

export function toPlanningRetentionPayload(draft: PlanningRetentionDraft) {
  const newCustomers = optionalNumber(draft.new_customers) ?? 0;
  const returningCustomers = optionalNumber(draft.returning_customers) ?? 0;
  const repeatRate = newCustomers + returningCustomers > 0
    ? (returningCustomers / (newCustomers + returningCustomers)) * 100
    : null;

  return {
    period_label: requiredString(draft.period_label, "Periode requise"),
    new_customers: newCustomers || null,
    returning_customers: returningCustomers || null,
    repeat_rate_pct: repeatRate,
    ltv_90d: optionalNumber(draft.ltv_90d),
    avg_orders_per_customer: optionalNumber(draft.avg_orders_per_customer),
  };
}

export function computePlanningSpendingPreview(draft: PlanningSpendingDraft, financialInput: RetentionFinancialInput | null) {
  const cash = optionalNumber(draft.cash_available) ?? 0;
  const burn = optionalNumber(draft.monthly_burn) ?? 0;
  const grossMargin = optionalNumber(draft.gross_margin_pct) ?? financialInput?.gross_margin_percent ?? 0;
  const targetRoas = optionalNumber(draft.target_roas) ?? financialInput?.target_mer ?? 2.5;
  return v1Threshold(cash, burn, grossMargin, targetRoas);
}

export function toPlanningSpendingPayload(draft: PlanningSpendingDraft, financialInput: RetentionFinancialInput | null) {
  const output = computePlanningSpendingPreview(draft, financialInput);
  return {
    payload: {
      period_label: requiredString(draft.period_label, "Periode requise"),
      cash_available: optionalNumber(draft.cash_available),
      monthly_burn: optionalNumber(draft.monthly_burn),
      gross_margin_pct: optionalNumber(draft.gross_margin_pct) ?? financialInput?.gross_margin_percent ?? null,
      target_roas: optionalNumber(draft.target_roas) ?? financialInput?.target_mer ?? null,
      runway_months: output.runway_months,
      recommended_monthly_ad_spend: output.recommended_monthly_ad_spend,
      max_monthly_ad_spend: output.max_monthly_ad_spend,
      model_type: "V1_THRESHOLD",
      assumptions: { source: "planning_prediction_v1_threshold", engine: "v1Threshold", safety_months: 3 },
    },
    output,
  };
}

export function toPlanningSpendingModelRunPayload(clientId: string, payload: Record<string, unknown>, output: ReturnType<typeof v1Threshold>) {
  return {
    client_id: clientId,
    model_name: "spending_power_engine_v1",
    model_version: "1.0",
    input_json: {
      cash_available: payload.cash_available ?? null,
      monthly_burn: payload.monthly_burn ?? null,
      gross_margin_pct: payload.gross_margin_pct ?? null,
      target_roas: payload.target_roas ?? null,
    },
    output_json: output,
    formula_used: { engine: "v1Threshold", source: "PlanningPrediction.SpendingTab" },
    generated_by: "planning_prediction_spending_tab",
  };
}

export async function fetchPlanningPredictionData(clientId: string): Promise<PlanningPredictionData> {
  const [clientResult, eventsResult, retentionResult, spendingResult, financialResult] = await Promise.all([
    supabase.from("gos_clients" as never).select("*").eq("id", clientId).single(),
    supabase.from("gos_event_effects" as never).select("*").eq("client_id", clientId).order("start_date", { ascending: false }),
    supabase.from("gos_retention_snapshots" as never).select("*").eq("client_id", clientId).order("period_end", { ascending: false }),
    supabase.from("gos_spending_power_snapshots" as never).select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("gos_financial_inputs" as never).select("*").eq("client_id", clientId).maybeSingle(),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (retentionResult.error) throw retentionResult.error;
  if (spendingResult.error) throw spendingResult.error;
  if (financialResult.error) throw financialResult.error;

  return {
    client: (clientResult.data as Record<string, unknown> | null) ?? null,
    events: ((eventsResult.data ?? []) as QueryRow[]),
    retention: ((retentionResult.data ?? []) as QueryRow[]),
    spending: ((spendingResult.data ?? []) as QueryRow[]).map(normalizeSpendingPowerSnapshotRow),
    financial_input: normalizeRetentionFinancialInputRow(financialResult.data as QueryRow | null),
  };
}

export async function deletePlanningEvent(id: string) {
  const { error } = await supabase.from("gos_event_effects" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function savePlanningEvent(clientId: string, draft: PlanningEventDraft, editingId: string | null) {
  const payload = toPlanningEventPayload(draft);
  const result = editingId
    ? await supabase.from("gos_event_effects" as never).update(payload as never).eq("id", editingId)
    : await supabase.from("gos_event_effects" as never).insert({ ...payload, client_id: clientId, status: "PLANNED" } as never);
  if (result.error) throw result.error;
}

export async function deletePlanningRetentionSnapshot(id: string) {
  const { error } = await supabase.from("gos_retention_snapshots" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function savePlanningRetentionSnapshot(clientId: string, draft: PlanningRetentionDraft, editingId: string | null) {
  const payload = toPlanningRetentionPayload(draft);
  const result = editingId
    ? await supabase.from("gos_retention_snapshots" as never).update(payload as never).eq("id", editingId)
    : await supabase.from("gos_retention_snapshots" as never).insert({ ...payload, client_id: clientId } as never);
  if (result.error) throw result.error;
}

export async function deletePlanningSpendingSnapshot(id: string) {
  const { error } = await supabase.from("gos_spending_power_snapshots" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function savePlanningSpendingSnapshot(
  clientId: string,
  draft: PlanningSpendingDraft,
  financialInput: RetentionFinancialInput | null,
  editingId: string | null,
) {
  const { payload, output } = toPlanningSpendingPayload(draft, financialInput);
  const result = editingId
    ? await supabase.from("gos_spending_power_snapshots" as never).update(payload as never).eq("id", editingId)
    : await supabase.from("gos_spending_power_snapshots" as never).insert({ ...payload, client_id: clientId } as never);
  if (result.error) throw result.error;

  const { error: runError } = await supabase
    .from("model_runs" as never)
    .insert(toPlanningSpendingModelRunPayload(clientId, payload, output) as never);
  if (runError) throw runError;
}
