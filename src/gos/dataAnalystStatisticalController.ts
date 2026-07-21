import { supabase } from "@/integrations/supabase/client";
import { fetchCustomerTransactions, type CustomerTransactionRow } from "./customerCohortController";
import { fetchDailyPnlWorkspace, type DailyPnlTargetRow } from "./dailyPnlController";

export type DataAnalystStatisticalReadiness =
  | "BLOCKED"
  | "READY_FOR_BASIC_ANALYSIS"
  | "READY_FOR_ADVANCED_ANALYSIS"
  | string;

export type DataAnalystMmmChannelOutput = {
  channel?: string;
  spend?: number;
  observed_revenue?: number | null;
  estimated_incremental_revenue?: number;
  incremental_roas?: number | null;
  incrementality_factor?: number | null;
  share_of_spend?: number | null;
  share_of_incremental_revenue?: number | null;
  coefficient?: number | null;
  diagnostics?: string[];
};

export type DataAnalystMmmIncrementalityOutput = {
  method?: string;
  status?: "fit" | "directional" | "insufficient_data" | string;
  data_source?: string;
  revenue_source?: string;
  observations?: number;
  adstock_decay?: number;
  ridge_lambda?: number;
  channels?: DataAnalystMmmChannelOutput[];
  portfolio?: {
    total_spend?: number;
    observed_revenue?: number;
    estimated_incremental_revenue?: number;
    weighted_incrementality_factor?: number | null;
    weighted_incremental_roas?: number | null;
    r_squared?: number | null;
  };
  diagnostics?: string[];
  limitations?: string[];
};

export type DataAnalystStatisticalOutput = {
  engine_version: "data_analyst_statistical_upgrade_v1" | string;
  generated_at: string;
  client_id?: string | null;
  readiness: DataAnalystStatisticalReadiness;
  libraries?: Record<string, string>;
  model_card?: {
    purpose?: string;
    inputs?: string[];
    governance_checks?: string[];
    assumptions?: string[];
    limitations?: string[];
  };
  retention_curve?: {
    method?: string;
    status?: string;
    cohorts?: number;
    age_periods?: number;
    observed_survival_by_age?: Array<Record<string, unknown>>;
    fitted_curve?: Array<Record<string, unknown>>;
    half_life_months?: number | null;
    r_squared?: number | null;
    backtest_mape_pct?: number | null;
    diagnostics?: string[];
  };
  pnl_anomalies?: {
    method?: string;
    rows_analyzed?: number;
    anomalies?: Array<{
      date?: string;
      metric?: string;
      actual?: number;
      expected?: number;
      delta_pct?: number;
      robust_z?: number;
      severity?: "warning" | "critical" | string;
    }>;
    diagnostics?: string[];
  };
  spend_efficiency_regression?: {
    method?: string;
    status?: string;
    observations?: number;
    elasticity?: number | null;
    intercept?: number | null;
    r_squared?: number | null;
    p_value?: number | null;
    standard_error?: number | null;
    diagnostics?: string[];
    points?: Array<Record<string, unknown>>;
  };
  mmm_incrementality?: DataAnalystMmmIncrementalityOutput;
  recommendations?: string[];
};

export type DataAnalystStatisticalModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: DataAnalystStatisticalOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

export type DataAnalystSpendHistoryPoint = {
  period: string;
  spend: number;
  new_customer_revenue: number;
};

export type DataAnalystChannelDailyPoint = {
  date: string;
  channel: string;
  spend: number;
  revenue?: number | null;
  orders?: number | null;
  leads?: number | null;
};

export type DataAnalystStatisticalBatchInput = {
  client_id: string;
  generated_at: string;
  transactions: Array<{
    customer_id: string;
    transaction_date: string;
    order_id?: string | null;
    revenue?: number | null;
    gross_profit?: number | null;
    acquisition_channel?: string | null;
    product_key?: string | null;
    segment_key?: string | null;
    source?: string | null;
  }>;
  daily_pnl: Array<{
    target_date: string;
    target_revenue?: number | null;
    target_ad_spend?: number | null;
    projection_revenue?: number | null;
    projection_ad_spend?: number | null;
    actual_revenue?: number | null;
    actual_ad_spend?: number | null;
    actual_orders?: number | null;
    actual_leads?: number | null;
  }>;
  spend_history: DataAnalystSpendHistoryPoint[];
  channel_daily: DataAnalystChannelDailyPoint[];
  source_summary: {
    transaction_count: number;
    daily_pnl_count: number;
    spend_history_count: number;
    spend_history_source: "spend_efficiency_frontier_model_run" | "none";
    channel_daily_count: number;
    channel_daily_source: "gos_campaign_daily_perf" | "none";
  };
};

type DataAnalystCampaignLookup = {
  id: string;
  name: string | null;
  platform: string | null;
};

type DataAnalystCampaignPerformanceRow = {
  campaign_id: string;
  perf_date: string;
  spend: number;
  revenue: number | null;
  orders: number | null;
  leads: number | null;
};

type QueryRow = Record<string, unknown>;

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanDate(value: string | null | undefined): string {
  return String(value ?? "").slice(0, 10);
}

function normalizeSpendHistoryPoint(row: unknown): DataAnalystSpendHistoryPoint | null {
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;
  const period = optionalString(source.period);
  const spend = optionalNumber(source.spend);
  const newCustomerRevenue = optionalNumber(source.new_customer_revenue);
  if (!period || spend == null || spend <= 0 || newCustomerRevenue == null || newCustomerRevenue <= 0) return null;
  return {
    period,
    spend,
    new_customer_revenue: newCustomerRevenue,
  };
}

export function normalizeDataAnalystCampaignLookup(row: QueryRow): DataAnalystCampaignLookup {
  return {
    id: String(row.id ?? ""),
    name: optionalString(row.name),
    platform: optionalString(row.platform),
  };
}

export function normalizeDataAnalystCampaignPerformanceRow(row: QueryRow): DataAnalystCampaignPerformanceRow {
  return {
    campaign_id: String(row.campaign_id ?? ""),
    perf_date: cleanDate(optionalString(row.perf_date)),
    spend: optionalNumber(row.spend) ?? 0,
    revenue: optionalNumber(row.revenue),
    orders: optionalNumber(row.orders),
    leads: optionalNumber(row.leads),
  };
}

export function toDataAnalystChannelDailyPoints(
  campaigns: DataAnalystCampaignLookup[],
  performanceRows: DataAnalystCampaignPerformanceRow[],
): DataAnalystChannelDailyPoint[] {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  return performanceRows
    .filter((row) => row.perf_date && row.campaign_id && row.spend >= 0)
    .map((row) => {
      const campaign = campaignById.get(row.campaign_id);
      return {
        date: row.perf_date,
        channel: campaign?.platform ?? campaign?.name ?? "unknown",
        spend: row.spend,
        revenue: row.revenue,
        orders: row.orders,
        leads: row.leads,
      };
    });
}

export function toDataAnalystStatisticalBatchInput(
  clientId: string,
  transactions: CustomerTransactionRow[],
  dailyRows: DailyPnlTargetRow[],
  spendHistory: DataAnalystSpendHistoryPoint[] = [],
  generatedAt = new Date().toISOString(),
  channelDaily: DataAnalystChannelDailyPoint[] = [],
): DataAnalystStatisticalBatchInput {
  const txRows = transactions
    .filter((row) => row.customer_id && row.transaction_date)
    .map((row) => ({
      customer_id: row.customer_id,
      transaction_date: cleanDate(row.transaction_date),
      order_id: row.order_id ?? null,
      revenue: row.revenue ?? null,
      gross_profit: row.gross_profit ?? null,
      acquisition_channel: row.acquisition_channel ?? null,
      product_key: row.product_key ?? null,
      segment_key: row.segment_key ?? null,
      source: row.source ?? null,
    }));

  const pnlRows = dailyRows
    .filter((row) => row.target_date)
    .map((row) => ({
      target_date: cleanDate(row.target_date),
      target_revenue: row.target_revenue ?? null,
      target_ad_spend: row.target_ad_spend ?? null,
      projection_revenue: row.projection_revenue ?? null,
      projection_ad_spend: row.projection_ad_spend ?? null,
      actual_revenue: row.actual_revenue ?? null,
      actual_ad_spend: row.actual_ad_spend ?? null,
      actual_orders: row.actual_orders ?? null,
      actual_leads: row.actual_leads ?? null,
    }));

  const channelRows = channelDaily
    .filter((row) => row.date && row.channel && row.spend >= 0)
    .map((row) => ({
      date: cleanDate(row.date),
      channel: row.channel,
      spend: row.spend,
      revenue: row.revenue ?? null,
      orders: row.orders ?? null,
      leads: row.leads ?? null,
    }));

  return {
    client_id: clientId,
    generated_at: generatedAt,
    transactions: txRows,
    daily_pnl: pnlRows,
    spend_history: spendHistory,
    channel_daily: channelRows,
    source_summary: {
      transaction_count: txRows.length,
      daily_pnl_count: pnlRows.length,
      spend_history_count: spendHistory.length,
      spend_history_source: spendHistory.length > 0 ? "spend_efficiency_frontier_model_run" : "none",
      channel_daily_count: channelRows.length,
      channel_daily_source: channelRows.length > 0 ? "gos_campaign_daily_perf" : "none",
    },
  };
}

export function parseDataAnalystStatisticalOutput(raw: string): DataAnalystStatisticalOutput {
  const parsed = JSON.parse(raw) as Partial<DataAnalystStatisticalOutput>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Statistical output must be a JSON object.");
  }
  if (parsed.engine_version !== "data_analyst_statistical_upgrade_v1") {
    throw new Error("Invalid engine_version for data analyst statistical output.");
  }
  if (!parsed.generated_at || !parsed.readiness) {
    throw new Error("Statistical output requires generated_at and readiness.");
  }
  return parsed as DataAnalystStatisticalOutput;
}

export async function fetchLatestSpendEfficiencyHistory(
  clientId: string,
): Promise<DataAnalystSpendHistoryPoint[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("input_json")
    .eq("client_id", clientId)
    .eq("model_name", "spend_efficiency_frontier")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const inputJson = ((data as QueryRow | null)?.input_json as Record<string, unknown> | null | undefined) ?? null;
  const history = Array.isArray(inputJson?.history) ? inputJson.history : [];
  return history
    .map(normalizeSpendHistoryPoint)
    .filter((row): row is DataAnalystSpendHistoryPoint => Boolean(row));
}

export async function fetchDataAnalystChannelDaily(
  clientId: string,
): Promise<DataAnalystChannelDailyPoint[]> {
  const [campaignResult, performanceResult] = await Promise.all([
    supabase
      .from("gos_campaigns" as never)
      .select("id,name,platform")
      .eq("client_id", clientId),
    supabase
      .from("gos_campaign_daily_perf" as never)
      .select("campaign_id,perf_date,spend,orders,leads,revenue")
      .eq("client_id", clientId)
      .order("perf_date", { ascending: true })
      .limit(1000),
  ]);

  if (campaignResult.error) throw campaignResult.error;
  if (performanceResult.error) throw performanceResult.error;

  return toDataAnalystChannelDailyPoints(
    ((campaignResult.data ?? []) as QueryRow[]).map(normalizeDataAnalystCampaignLookup),
    ((performanceResult.data ?? []) as QueryRow[]).map(normalizeDataAnalystCampaignPerformanceRow),
  );
}

export async function buildDataAnalystStatisticalBatchInputForClient(
  clientId: string,
): Promise<DataAnalystStatisticalBatchInput> {
  const [transactions, workspace, spendHistory, channelDaily] = await Promise.all([
    fetchCustomerTransactions(clientId),
    fetchDailyPnlWorkspace(clientId),
    fetchLatestSpendEfficiencyHistory(clientId),
    fetchDataAnalystChannelDaily(clientId),
  ]);

  return toDataAnalystStatisticalBatchInput(
    clientId,
    transactions,
    workspace.days,
    spendHistory,
    undefined,
    channelDaily,
  );
}

export function toDataAnalystStatisticalModelRunPayload(
  clientId: string,
  output: DataAnalystStatisticalOutput,
  inputSummary: Record<string, unknown> = {},
) {
  return {
    client_id: clientId,
    model_name: "data_analyst_statistical_upgrade",
    model_version: "v1",
    input_json: jsonClone({
      ...inputSummary,
      batch_generated_at: output.generated_at,
      batch_client_id: output.client_id ?? null,
      readiness: output.readiness,
      libraries: output.libraries ?? {},
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      runtime: "python_batch",
      components: [
        "monthly_log_survival_retention_curve",
        "robust_mad_pnl_projection_anomaly_detection",
        "log_log_spend_efficiency_regression",
        "lightweight_adstock_ridge_mmm_incrementality",
        "statistical_model_card",
      ],
      libraries: output.libraries ?? {},
    },
    generated_by: "python_batch_data_analyst_statistical_upgrade",
  };
}

export function normalizeDataAnalystStatisticalModelRunRow(row: QueryRow): DataAnalystStatisticalModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as DataAnalystStatisticalOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export async function saveDataAnalystStatisticalRun(
  clientId: string,
  output: DataAnalystStatisticalOutput,
  inputSummary: Record<string, unknown> = {},
): Promise<DataAnalystStatisticalModelRunRow> {
  const payload = toDataAnalystStatisticalModelRunPayload(clientId, output, inputSummary);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeDataAnalystStatisticalModelRunRow(data as QueryRow);
}

export async function fetchDataAnalystStatisticalRuns(
  clientId: string,
): Promise<DataAnalystStatisticalModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "data_analyst_statistical_upgrade")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeDataAnalystStatisticalModelRunRow);
}
