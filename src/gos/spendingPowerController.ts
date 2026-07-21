import { supabase } from "@/integrations/supabase/client";
import { runProfitFirstMediaBuying, type ProfitFirstInput, type ProfitFirstOutput } from "./profitFirstMediaBuying";
import {
  runSpendEfficiencyFrontier,
  type SpendEfficiencyFrontierOutput,
  type SpendEfficiencyInput,
  type SpendEfficiencyObjective,
} from "./spendEfficiencyFrontier";
import { saveSpendEfficiencyFrontierRun } from "./spendEfficiencyFrontierController";
import {
  runSpendingPowerV2,
  v1Threshold,
  type HistoryPoint,
  type SpendingPowerV2Input,
  type SpendingPowerV2Output,
} from "./spendingPowerV2";

type QueryRow = Record<string, unknown>;

export type SpendHistoryPoint = HistoryPoint & { new_customer_revenue?: number | null };

export type SpendingPowerClient = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  industry: string | null;
  am_owner: string | null;
  launch_target_date: string | null;
};

export type SpendingPowerFinancialInput = {
  id: string;
  client_id: string;
  gross_margin_percent: number | null;
  target_cac: number | null;
  target_mer: number | null;
  target_roas: number | null;
};

export type SpendingPowerBasketEconomics = {
  id: string;
  client_id: string;
  aov_new: number | null;
  aov_repeat: number | null;
  avg_order_value: number | null;
  cac_new: number | null;
  cac_repeat: number | null;
  conversion_rate: number | null;
  repeat_cycle_months: number | null;
  churn_per_cycle: number | null;
  basket_gross_margin_percent: number | null;
  inventory_days: number | null;
  payout_delay_days: number | null;
};

export type SpendingPowerSnapshot = {
  id: string;
  client_id: string;
  created_at: string | null;
  updated_at: string | null;
  period_label: string | null;
  cash_available: number | null;
  monthly_burn: number | null;
  gross_margin_pct: number | null;
  target_roas: number | null;
  runway_months: number | null;
  max_monthly_ad_spend: number | null;
  recommended_monthly_ad_spend: number | null;
  model_type: string | null;
  sample_size: number | null;
  regression_slope_cac: number | null;
  regression_intercept_cac: number | null;
  r_squared_cac: number | null;
  regression_slope_mer: number | null;
  regression_intercept_mer: number | null;
  r_squared_mer: number | null;
  backtest_error_percent: number | null;
  recommended_model_confidence: number | null;
  fallback_reason: string | null;
  planned_spend: number | null;
  projected_cac_low: number | null;
  projected_cac_base: number | null;
  projected_cac_high: number | null;
  projected_mer_low: number | null;
  projected_mer_base: number | null;
  projected_mer_high: number | null;
  recommended_spend_low: number | null;
  recommended_spend_base: number | null;
  recommended_spend_high: number | null;
  spend_risk: "LOW" | "MEDIUM" | "HIGH" | string | null;
  efficiency_risk: "LOW" | "MEDIUM" | "HIGH" | string | null;
  risks: string[];
  conditions: string[];
  spending_history: SpendHistoryPoint[];
  summary: string | null;
  assumptions: Record<string, unknown> | null;
  notes: string | null;
};

export type SpendingPowerData = {
  client: SpendingPowerClient | null;
  financial_input: SpendingPowerFinancialInput | null;
  snapshots: SpendingPowerSnapshot[];
  basket: SpendingPowerBasketEconomics | null;
  hydrated_history: SpendHistoryPoint[];
};

export type SpendingPowerV1SnapshotDraft = {
  period_label: string;
  cash_available: unknown;
  monthly_burn: unknown;
  target_roas: unknown;
};

export type SpendHistoryPointDraft = {
  spend: unknown;
  cac: unknown;
  mer: unknown;
  new_customer_revenue: unknown;
};

export type SpendEfficiencyFrontierContext = {
  history: SpendHistoryPoint[];
  objective: SpendEfficiencyObjective;
  financialInput: SpendingPowerFinancialInput | null;
  basket: SpendingPowerBasketEconomics | null;
  ltvMultiplier: unknown;
  plannedSpend: unknown;
  minFirstOrderContribution: unknown;
};

export type ProfitFirstMediaBuyingContext = {
  plannedSpend: unknown;
  monthlySessions: unknown;
  history: SpendHistoryPoint[];
  basket: SpendingPowerBasketEconomics | null;
  financialInput: SpendingPowerFinancialInput | null;
  latestSnapshot: SpendingPowerSnapshot | null;
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function requiredString(value: unknown, message: string): string {
  const text = optionalString(value);
  if (!text) throw new Error(message);
  return text;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function requiredPositiveNumber(value: unknown, message: string): number {
  const n = optionalNumber(value);
  if (n === null || n <= 0) throw new Error(message);
  return n;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export function normalizeSpendHistory(value: unknown): SpendHistoryPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = (item ?? {}) as QueryRow;
      const spend = optionalNumber(row.spend);
      if (spend === null || spend <= 0) return null;
      return {
        spend,
        cac: optionalNumber(row.cac),
        mer: optionalNumber(row.mer),
        new_customer_revenue: optionalNumber(row.new_customer_revenue),
      };
    })
    .filter((item): item is SpendHistoryPoint => Boolean(item));
}

export function toSpendHistoryPoint(draft: SpendHistoryPointDraft): SpendHistoryPoint {
  return {
    spend: requiredPositiveNumber(draft.spend, "Spend requis (>0)"),
    cac: optionalNumber(draft.cac),
    mer: optionalNumber(draft.mer),
    new_customer_revenue: optionalNumber(draft.new_customer_revenue),
  };
}

export function normalizeSpendingPowerClientRow(row: QueryRow): SpendingPowerClient {
  return {
    id: String(row.id ?? ""),
    client_code: optionalString(row.client_code) ?? "",
    company_name: optionalString(row.company_name) ?? "",
    business_type: optionalString(row.business_type) ?? "ECOMMERCE",
    current_phase: optionalString(row.current_phase) ?? "onboarding",
    risk_level: optionalString(row.risk_level) ?? "normal",
    industry: optionalString(row.industry),
    am_owner: optionalString(row.am_owner),
    launch_target_date: optionalString(row.launch_target_date),
  };
}

export function normalizeSpendingPowerFinancialInputRow(row: QueryRow | null | undefined): SpendingPowerFinancialInput | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    gross_margin_percent: optionalNumber(row.gross_margin_percent),
    target_cac: optionalNumber(row.target_cac),
    target_mer: optionalNumber(row.target_mer),
    target_roas: optionalNumber(row.target_roas),
  };
}

export function normalizeSpendingPowerBasketRow(row: QueryRow | null | undefined): SpendingPowerBasketEconomics | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    aov_new: optionalNumber(row.aov_new),
    aov_repeat: optionalNumber(row.aov_repeat),
    avg_order_value: optionalNumber(row.avg_order_value),
    cac_new: optionalNumber(row.cac_new),
    cac_repeat: optionalNumber(row.cac_repeat),
    conversion_rate: optionalNumber(row.conversion_rate),
    repeat_cycle_months: optionalNumber(row.repeat_cycle_months),
    churn_per_cycle: optionalNumber(row.churn_per_cycle),
    basket_gross_margin_percent: optionalNumber(row.basket_gross_margin_percent),
    inventory_days: optionalNumber(row.inventory_days),
    payout_delay_days: optionalNumber(row.payout_delay_days),
  };
}

export function normalizeSpendingPowerSnapshotRow(row: QueryRow): SpendingPowerSnapshot {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
    period_label: optionalString(row.period_label),
    cash_available: optionalNumber(row.cash_available),
    monthly_burn: optionalNumber(row.monthly_burn),
    gross_margin_pct: optionalNumber(row.gross_margin_pct),
    target_roas: optionalNumber(row.target_roas),
    runway_months: optionalNumber(row.runway_months),
    max_monthly_ad_spend: optionalNumber(row.max_monthly_ad_spend),
    recommended_monthly_ad_spend: optionalNumber(row.recommended_monthly_ad_spend),
    model_type: optionalString(row.model_type),
    sample_size: optionalNumber(row.sample_size),
    regression_slope_cac: optionalNumber(row.regression_slope_cac),
    regression_intercept_cac: optionalNumber(row.regression_intercept_cac),
    r_squared_cac: optionalNumber(row.r_squared_cac),
    regression_slope_mer: optionalNumber(row.regression_slope_mer),
    regression_intercept_mer: optionalNumber(row.regression_intercept_mer),
    r_squared_mer: optionalNumber(row.r_squared_mer),
    backtest_error_percent: optionalNumber(row.backtest_error_percent),
    recommended_model_confidence: optionalNumber(row.recommended_model_confidence),
    fallback_reason: optionalString(row.fallback_reason),
    planned_spend: optionalNumber(row.planned_spend),
    projected_cac_low: optionalNumber(row.projected_cac_low),
    projected_cac_base: optionalNumber(row.projected_cac_base),
    projected_cac_high: optionalNumber(row.projected_cac_high),
    projected_mer_low: optionalNumber(row.projected_mer_low),
    projected_mer_base: optionalNumber(row.projected_mer_base),
    projected_mer_high: optionalNumber(row.projected_mer_high),
    recommended_spend_low: optionalNumber(row.recommended_spend_low),
    recommended_spend_base: optionalNumber(row.recommended_spend_base),
    recommended_spend_high: optionalNumber(row.recommended_spend_high),
    spend_risk: optionalString(row.spend_risk),
    efficiency_risk: optionalString(row.efficiency_risk),
    risks: stringArray(row.risks),
    conditions: stringArray(row.conditions),
    spending_history: normalizeSpendHistory(row.spending_history),
    summary: optionalString(row.summary),
    assumptions: (row.assumptions as Record<string, unknown> | null | undefined) ?? null,
    notes: optionalString(row.notes),
  };
}

export function toSpendingPowerV1SnapshotPayload(
  clientId: string,
  draft: SpendingPowerV1SnapshotDraft,
  financialInput: SpendingPowerFinancialInput | null,
) {
  const periodLabel = requiredString(draft.period_label, "Label periode requis");
  const cash = optionalNumber(draft.cash_available) ?? 0;
  const burn = optionalNumber(draft.monthly_burn) ?? 0;
  const margin = financialInput?.gross_margin_percent ?? 0;
  const roas = optionalNumber(draft.target_roas) ?? financialInput?.target_mer ?? 2.5;
  const threshold = v1Threshold(cash, burn, margin, roas);

  return {
    client_id: clientId,
    period_label: periodLabel,
    cash_available: cash,
    monthly_burn: burn,
    gross_margin_pct: margin,
    target_roas: roas,
    ...threshold,
    model_type: "V1_THRESHOLD",
    assumptions: { safety_months: 3, buffer_factor: 0.7 },
  };
}

export function buildSpendingPowerV2Input(
  history: SpendHistoryPoint[],
  plannedSpend: unknown,
  financialInput: SpendingPowerFinancialInput | null,
  latestSnapshot: SpendingPowerSnapshot | null,
): SpendingPowerV2Input {
  const planned = requiredPositiveNumber(plannedSpend, "Planned spend requis");
  if (history.length === 0) throw new Error("Ajoute au moins une ligne d'historique");

  return {
    history,
    planned_spend: planned,
    target_cac: financialInput?.target_cac ?? null,
    target_mer: financialInput?.target_mer ?? null,
    cash_available: latestSnapshot?.cash_available ?? 0,
    monthly_burn: latestSnapshot?.monthly_burn ?? 0,
    gross_margin_pct: financialInput?.gross_margin_percent ?? 0,
  };
}

export function toSpendingPowerV2SnapshotPayload(
  clientId: string,
  input: SpendingPowerV2Input,
  output: SpendingPowerV2Output,
) {
  return {
    client_id: clientId,
    period_label: `V2 - ${new Date().toISOString().slice(0, 10)} @ ${input.planned_spend}$`,
    cash_available: input.cash_available ?? 0,
    monthly_burn: input.monthly_burn ?? 0,
    gross_margin_pct: input.gross_margin_pct ?? null,
    target_roas: input.target_mer ?? null,
    max_monthly_ad_spend: output.max_monthly_ad_spend,
    recommended_monthly_ad_spend: output.recommended_monthly_ad_spend,
    runway_months: output.runway_months,
    model_type: output.model_type,
    sample_size: output.sample_size,
    regression_slope_cac: output.fit_cac?.slope ?? null,
    regression_intercept_cac: output.fit_cac?.intercept ?? null,
    r_squared_cac: output.fit_cac?.r_squared ?? null,
    regression_slope_mer: output.fit_mer?.slope ?? null,
    regression_intercept_mer: output.fit_mer?.intercept ?? null,
    r_squared_mer: output.fit_mer?.r_squared ?? null,
    backtest_error_percent: output.backtest_error_percent,
    recommended_model_confidence: output.recommended_model_confidence,
    fallback_reason: output.fallback_reason,
    planned_spend: output.planned_spend,
    projected_cac_low: output.projected_cac.low,
    projected_cac_base: output.projected_cac.base,
    projected_cac_high: output.projected_cac.high,
    projected_mer_low: output.projected_mer.low,
    projected_mer_base: output.projected_mer.base,
    projected_mer_high: output.projected_mer.high,
    recommended_spend_low: output.recommended_spend.low,
    recommended_spend_base: output.recommended_spend.base,
    recommended_spend_high: output.recommended_spend.high,
    spend_risk: output.spend_risk,
    efficiency_risk: output.efficiency_risk,
    risks: jsonClone(output.risks),
    conditions: jsonClone(output.conditions),
    spending_history: jsonClone(input.history),
    summary: output.summary,
    assumptions: { engine: "spending_power_engine_v2", planned_spend: input.planned_spend },
  };
}

export function toSpendingPowerV2ModelRunPayload(
  clientId: string,
  input: SpendingPowerV2Input,
  output: SpendingPowerV2Output,
) {
  return {
    client_id: clientId,
    model_name: "spending_power_engine_v2",
    model_version: "1.0",
    input_json: jsonClone(input) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: { engine: "OLS + threshold fallback", backtest: "leave-one-out" },
    generated_by: "gos_spending_power",
  };
}

export function buildSpendEfficiencyFrontierInput(context: SpendEfficiencyFrontierContext): SpendEfficiencyInput {
  const frontierHistory = context.history
    .filter((point) => (point.spend ?? 0) > 0 && (point.new_customer_revenue ?? 0) > 0)
    .map((point, index) => ({
      period: `P${index + 1}`,
      spend: Number(point.spend),
      new_customer_revenue: Number(point.new_customer_revenue),
    }));

  if (frontierHistory.length === 0) {
    throw new Error("Ajoute au moins une ligne avec spend + new customer revenue");
  }

  return {
    history: frontierHistory,
    objective: context.objective,
    gross_margin_rate: context.financialInput?.gross_margin_percent ?? context.basket?.basket_gross_margin_percent ?? null,
    ltv_revenue_multiplier: optionalNumber(context.ltvMultiplier) ?? 1,
    target_spend: optionalNumber(context.plannedSpend),
    min_first_order_contribution: optionalNumber(context.minFirstOrderContribution) ?? 0,
  };
}

export function buildProfitFirstMediaBuyingInput(context: ProfitFirstMediaBuyingContext): ProfitFirstInput {
  const planned = requiredPositiveNumber(context.plannedSpend, "Planned spend requis (haut de la carte v2)");
  if (!context.basket) {
    throw new Error("Aucun basket economics - remplis aov_new/repeat, cac_new/repeat, conversion_rate...");
  }
  const sessions = requiredPositiveNumber(context.monthlySessions, "Renseigne les sessions mensuelles attendues");

  return {
    planned_spend: planned,
    history: context.history,
    cohort: {
      aov_new: context.basket.aov_new ?? context.basket.avg_order_value ?? 0,
      aov_repeat: context.basket.aov_repeat ?? context.basket.avg_order_value ?? 0,
      cac_new: context.basket.cac_new ?? context.financialInput?.target_cac ?? 0,
      cac_repeat: context.basket.cac_repeat ?? 0,
      conversion_rate: context.basket.conversion_rate ?? 0.02,
      repeat_cycle_months: context.basket.repeat_cycle_months ?? 3,
      churn_per_cycle: context.basket.churn_per_cycle ?? 0.4,
      gross_margin_pct: context.financialInput?.gross_margin_percent ?? 0,
    },
    cash: {
      cash_available: context.latestSnapshot?.cash_available ?? 0,
      monthly_burn: context.latestSnapshot?.monthly_burn ?? 0,
      inventory_days: context.basket.inventory_days ?? 0,
      payout_delay_days: context.basket.payout_delay_days ?? 3,
    },
    funnel: { monthly_sessions: sessions },
    target_cac: context.financialInput?.target_cac ?? null,
    target_mer: context.financialInput?.target_mer ?? null,
  };
}

export function toProfitFirstMediaBuyingModelRunPayload(
  clientId: string,
  input: ProfitFirstInput,
  output: ProfitFirstOutput,
  basketId: string | null,
) {
  return {
    client_id: clientId,
    model_name: "profit_first_media_buying",
    model_version: "1.0",
    input_json: jsonClone({
      planned_spend: input.planned_spend,
      monthly_sessions: input.funnel.monthly_sessions,
      basket_id: basketId,
      target_cac: input.target_cac ?? null,
      target_mer: input.target_mer ?? null,
      history_sample_size: input.history.length,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: "PFMB v1",
      components: ["spendEfficiencyFrontier", "spendingPowerV2", "cohort_ltv", "cash_cycle", "funnel_capacity"],
    },
    generated_by: "gos_profit_first_media_buying",
  };
}

export async function fetchSpendingPowerData(clientId: string): Promise<SpendingPowerData> {
  const [clientResult, financialResult, snapshotsResult, basketResult] = await Promise.all([
    supabase.from("gos_clients" as never).select("*").eq("id", clientId).single(),
    supabase.from("gos_financial_inputs" as never).select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("gos_spending_power_snapshots" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("gos_basket_economics" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (financialResult.error) throw financialResult.error;
  if (snapshotsResult.error) throw snapshotsResult.error;
  if (basketResult.error) throw basketResult.error;

  const snapshots = ((snapshotsResult.data ?? []) as QueryRow[]).map(normalizeSpendingPowerSnapshotRow);
  const lastWithHistory = snapshots.find((snapshot) => snapshot.spending_history.length > 0);

  return {
    client: clientResult.data ? normalizeSpendingPowerClientRow(clientResult.data as QueryRow) : null,
    financial_input: normalizeSpendingPowerFinancialInputRow(financialResult.data as QueryRow | null),
    snapshots,
    basket: normalizeSpendingPowerBasketRow(basketResult.data as QueryRow | null),
    hydrated_history: lastWithHistory?.spending_history ?? [],
  };
}

async function insertSpendingPowerSnapshot(payload: Record<string, unknown>) {
  const { error } = await supabase.from("gos_spending_power_snapshots" as never).insert(payload as never);
  if (error) throw error;
}

async function insertModelRun(payload: Record<string, unknown>) {
  const { error } = await supabase.from("model_runs" as never).insert(payload as never);
  if (error) throw error;
}

export async function createSpendingPowerV1Snapshot(
  clientId: string,
  draft: SpendingPowerV1SnapshotDraft,
  financialInput: SpendingPowerFinancialInput | null,
) {
  const payload = toSpendingPowerV1SnapshotPayload(clientId, draft, financialInput);
  await insertSpendingPowerSnapshot(payload);
  return payload;
}

export async function runAndSaveSpendingPowerV2Snapshot(
  clientId: string,
  history: SpendHistoryPoint[],
  plannedSpend: unknown,
  financialInput: SpendingPowerFinancialInput | null,
  latestSnapshot: SpendingPowerSnapshot | null,
): Promise<SpendingPowerV2Output> {
  const input = buildSpendingPowerV2Input(history, plannedSpend, financialInput, latestSnapshot);
  const output = runSpendingPowerV2(input);

  await insertSpendingPowerSnapshot(toSpendingPowerV2SnapshotPayload(clientId, input, output));
  await insertModelRun(toSpendingPowerV2ModelRunPayload(clientId, input, output));

  return output;
}

export async function runAndSaveSpendEfficiencyFrontierForSpendingPower(
  clientId: string,
  context: SpendEfficiencyFrontierContext,
): Promise<SpendEfficiencyFrontierOutput> {
  const input = buildSpendEfficiencyFrontierInput(context);
  const output = runSpendEfficiencyFrontier(input);
  await saveSpendEfficiencyFrontierRun(clientId, input, output);
  return output;
}

export async function runAndSaveProfitFirstMediaBuyingForSpendingPower(
  clientId: string,
  context: ProfitFirstMediaBuyingContext,
): Promise<ProfitFirstOutput> {
  const input = buildProfitFirstMediaBuyingInput(context);
  const output = runProfitFirstMediaBuying(input);
  await insertModelRun(toProfitFirstMediaBuyingModelRunPayload(clientId, input, output, context.basket?.id ?? null));
  return output;
}
