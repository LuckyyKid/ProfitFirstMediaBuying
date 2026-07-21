import { supabase } from "@/integrations/supabase/client";
import type {
  DailyGrowthMapCampaignDayInput,
  DailyGrowthMapDailyInput,
} from "./dailyGrowthMap";
import type {
  ProfitPlanDayPlan,
  ProfitPlanEngineOutput,
} from "./profitPlanEngine";

type QueryRow = Record<string, unknown>;

export type DailyGrowthMapClient = {
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

export type DailyGrowthMapProfitPlanRef = {
  id: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  engine_version: string;
  created_at: string | null;
  output_json: ProfitPlanEngineOutput | null;
};

export type DailyGrowthMapWorkspace = {
  client: DailyGrowthMapClient | null;
  days: DailyGrowthMapDailyInput[];
  daily_rows: DailyGrowthMapDailyInput[];
  campaign_days: DailyGrowthMapCampaignDayInput[];
  latest_profit_plan: DailyGrowthMapProfitPlanRef | null;
};

type CampaignPerformanceRow = {
  campaign_id: string;
  perf_date: string;
  spend: number | null;
  revenue: number | null;
  orders: number | null;
  leads: number | null;
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

function isRecord(value: unknown): value is QueryRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isProfitPlanOutput(value: unknown): value is ProfitPlanEngineOutput {
  return isRecord(value) && value.engine_version === "profit_plan_engine_v1" && Array.isArray(value.days);
}

function numberOrNull(value: unknown): number | null {
  const n = optionalNumber(value);
  return n === null ? null : n;
}

export function normalizeDailyGrowthMapClient(row: QueryRow): DailyGrowthMapClient {
  return {
    id: String(row.id ?? ""),
    client_code: optionalString(row.client_code) ?? "",
    company_name: optionalString(row.company_name) ?? "",
    business_type: optionalString(row.business_type) ?? "",
    current_phase: optionalString(row.current_phase) ?? "",
    risk_level: optionalString(row.risk_level) ?? "",
    industry: optionalString(row.industry),
    am_owner: optionalString(row.am_owner),
    launch_target_date: optionalString(row.launch_target_date),
  };
}

export function normalizeDailyGrowthMapDailyRow(row: QueryRow): DailyGrowthMapDailyInput {
  return {
    id: optionalString(row.id),
    client_id: optionalString(row.client_id),
    target_date: String(row.target_date ?? row.plan_date ?? ""),
    target_revenue: numberOrNull(row.target_revenue),
    target_new_customer_revenue: numberOrNull(row.target_new_customer_revenue),
    target_returning_revenue: numberOrNull(row.target_returning_revenue),
    target_ad_spend: numberOrNull(row.target_ad_spend),
    target_orders: numberOrNull(row.target_orders),
    target_new_customers: numberOrNull(row.target_new_customers),
    target_returning_orders: numberOrNull(row.target_returning_orders),
    target_leads: numberOrNull(row.target_leads),
    target_gross_profit: numberOrNull(row.target_gross_profit),
    target_contribution_margin: numberOrNull(row.target_contribution_margin),
    projection_revenue: numberOrNull(row.projection_revenue),
    projection_new_customer_revenue: numberOrNull(row.projection_new_customer_revenue),
    projection_returning_revenue: numberOrNull(row.projection_returning_revenue),
    projection_ad_spend: numberOrNull(row.projection_ad_spend),
    projection_orders: numberOrNull(row.projection_orders),
    projection_new_customers: numberOrNull(row.projection_new_customers),
    projection_returning_orders: numberOrNull(row.projection_returning_orders),
    projection_leads: numberOrNull(row.projection_leads),
    projection_gross_profit: numberOrNull(row.projection_gross_profit),
    projection_contribution_margin: numberOrNull(row.projection_contribution_margin),
    actual_revenue: numberOrNull(row.actual_revenue),
    actual_new_customer_revenue: numberOrNull(row.actual_new_customer_revenue),
    actual_returning_revenue: numberOrNull(row.actual_returning_revenue),
    actual_ad_spend: numberOrNull(row.actual_ad_spend),
    actual_orders: numberOrNull(row.actual_orders),
    actual_new_customers: numberOrNull(row.actual_new_customers),
    actual_returning_orders: numberOrNull(row.actual_returning_orders),
    actual_leads: numberOrNull(row.actual_leads),
    actual_gross_profit: numberOrNull(row.actual_gross_profit),
    actual_contribution_margin: numberOrNull(row.actual_contribution_margin),
  };
}

export function normalizeProfitPlanDayForGrowthMap(day: ProfitPlanDayPlan): DailyGrowthMapDailyInput {
  return {
    client_id: day.client_id,
    target_date: day.plan_date,
    target_revenue: day.target_revenue,
    target_new_customer_revenue: day.target_new_customer_revenue,
    target_returning_revenue: day.target_returning_revenue,
    target_ad_spend: day.target_ad_spend,
    target_orders: day.target_orders,
    target_new_customers: day.target_new_customers,
    target_returning_orders: day.target_returning_orders,
    target_gross_profit: day.target_gross_profit,
    target_contribution_margin: day.target_contribution_margin,
  };
}

function coalesceNumber(primary: number | null | undefined, fallback: number | null | undefined): number | null {
  return primary ?? fallback ?? null;
}

export function mergeGrowthMapDailyRows(
  profitPlanDays: DailyGrowthMapDailyInput[],
  dailyRows: DailyGrowthMapDailyInput[],
): DailyGrowthMapDailyInput[] {
  const byDate = new Map<string, DailyGrowthMapDailyInput>();
  for (const day of profitPlanDays) {
    byDate.set(day.target_date, { ...day });
  }

  for (const daily of dailyRows) {
    const existing = byDate.get(daily.target_date);
    byDate.set(daily.target_date, {
      ...existing,
      ...daily,
      target_revenue: coalesceNumber(daily.target_revenue, existing?.target_revenue),
      target_new_customer_revenue: coalesceNumber(daily.target_new_customer_revenue, existing?.target_new_customer_revenue),
      target_returning_revenue: coalesceNumber(daily.target_returning_revenue, existing?.target_returning_revenue),
      target_ad_spend: coalesceNumber(daily.target_ad_spend, existing?.target_ad_spend),
      target_orders: coalesceNumber(daily.target_orders, existing?.target_orders),
      target_new_customers: coalesceNumber(daily.target_new_customers, existing?.target_new_customers),
      target_returning_orders: coalesceNumber(daily.target_returning_orders, existing?.target_returning_orders),
      target_leads: coalesceNumber(daily.target_leads, existing?.target_leads),
      target_gross_profit: coalesceNumber(daily.target_gross_profit, existing?.target_gross_profit),
      target_contribution_margin: coalesceNumber(daily.target_contribution_margin, existing?.target_contribution_margin),
      projection_revenue: coalesceNumber(daily.projection_revenue, existing?.projection_revenue),
      projection_new_customer_revenue: coalesceNumber(daily.projection_new_customer_revenue, existing?.projection_new_customer_revenue),
      projection_returning_revenue: coalesceNumber(daily.projection_returning_revenue, existing?.projection_returning_revenue),
      projection_ad_spend: coalesceNumber(daily.projection_ad_spend, existing?.projection_ad_spend),
      projection_orders: coalesceNumber(daily.projection_orders, existing?.projection_orders),
      projection_new_customers: coalesceNumber(daily.projection_new_customers, existing?.projection_new_customers),
      projection_returning_orders: coalesceNumber(daily.projection_returning_orders, existing?.projection_returning_orders),
      projection_leads: coalesceNumber(daily.projection_leads, existing?.projection_leads),
      projection_gross_profit: coalesceNumber(daily.projection_gross_profit, existing?.projection_gross_profit),
      projection_contribution_margin: coalesceNumber(daily.projection_contribution_margin, existing?.projection_contribution_margin),
      actual_revenue: daily.actual_revenue ?? null,
      actual_new_customer_revenue: daily.actual_new_customer_revenue ?? null,
      actual_returning_revenue: daily.actual_returning_revenue ?? null,
      actual_ad_spend: daily.actual_ad_spend ?? null,
      actual_orders: daily.actual_orders ?? null,
      actual_new_customers: daily.actual_new_customers ?? null,
      actual_returning_orders: daily.actual_returning_orders ?? null,
      actual_leads: daily.actual_leads ?? null,
      actual_gross_profit: daily.actual_gross_profit ?? null,
      actual_contribution_margin: daily.actual_contribution_margin ?? null,
    });
  }

  return [...byDate.values()].sort((a, b) => a.target_date.localeCompare(b.target_date));
}

export function normalizeDailyGrowthMapProfitPlanRow(row: QueryRow): DailyGrowthMapProfitPlanRef {
  const output = isProfitPlanOutput(row.output_json) ? row.output_json : null;
  return {
    id: String(row.id ?? ""),
    plan_name: optionalString(row.plan_name) ?? "",
    period_start: optionalString(row.period_start) ?? "",
    period_end: optionalString(row.period_end) ?? "",
    engine_version: optionalString(row.engine_version) ?? "",
    created_at: optionalString(row.created_at),
    output_json: output,
  };
}

export function normalizeCampaignPlanDayForGrowthMap(row: QueryRow): DailyGrowthMapCampaignDayInput {
  return {
    campaign_id: optionalString(row.campaign_id),
    campaign_name: optionalString(row.campaign_name) ?? "Unassigned campaign",
    platform: optionalString(row.platform),
    channel_id: optionalString(row.channel_id),
    channel_name: optionalString(row.channel_name) ?? optionalString(row.platform) ?? "Unassigned channel",
    plan_date: optionalString(row.plan_date) ?? "",
    target_spend: numberOrNull(row.target_spend),
    platform_revenue_required: numberOrNull(row.platform_revenue_required),
    incremental_revenue_target: numberOrNull(row.incremental_revenue_target),
    platform_conversions_required: numberOrNull(row.platform_conversions_required),
    required_platform_amr: numberOrNull(row.required_platform_amr),
    required_platform_cac: numberOrNull(row.required_platform_cac),
    incremental_target_amr: numberOrNull(row.incremental_target_amr),
  };
}

export function extractCampaignPlanDays(output: ProfitPlanEngineOutput | null): DailyGrowthMapCampaignDayInput[] {
  const rows = output?.sources.campaign_daily_plan?.days ?? [];
  return rows.map((row) => normalizeCampaignPlanDayForGrowthMap(row as unknown as QueryRow));
}

export function normalizeCampaignPerformanceRow(row: QueryRow): CampaignPerformanceRow {
  return {
    campaign_id: String(row.campaign_id ?? ""),
    perf_date: optionalString(row.perf_date) ?? "",
    spend: numberOrNull(row.spend),
    revenue: numberOrNull(row.revenue),
    orders: numberOrNull(row.orders),
    leads: numberOrNull(row.leads),
  };
}

function campaignPerfKey(campaignId: string | null | undefined, date: string): string {
  return `${String(campaignId ?? "")}|${date}`;
}

export function mergeCampaignPerformanceRows(
  campaignDays: DailyGrowthMapCampaignDayInput[],
  performanceRows: CampaignPerformanceRow[],
): DailyGrowthMapCampaignDayInput[] {
  const performanceByCampaignDate = new Map(
    performanceRows.map((row) => [campaignPerfKey(row.campaign_id, row.perf_date), row]),
  );

  return campaignDays.map((day) => {
    const performance = performanceByCampaignDate.get(campaignPerfKey(day.campaign_id, day.plan_date));
    return {
      ...day,
      actual_spend: performance?.spend ?? null,
      actual_revenue: performance?.revenue ?? null,
      actual_orders: performance?.orders ?? null,
      actual_leads: performance?.leads ?? null,
    };
  });
}

export async function fetchDailyGrowthMapWorkspace(clientId: string): Promise<DailyGrowthMapWorkspace> {
  const [clientResult, dailyResult, planResult, performanceResult] = await Promise.all([
    supabase
      .from("gos_clients" as never)
      .select("*")
      .eq("id", clientId)
      .single(),
    supabase
      .from("gos_daily_pnl_targets" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("target_date", { ascending: true }),
    supabase
      .from("gos_profit_plans" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("gos_campaign_daily_perf" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("perf_date", { ascending: true })
      .limit(1000),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (dailyResult.error) throw dailyResult.error;
  if (planResult.error) throw planResult.error;
  if (performanceResult.error) throw performanceResult.error;

  const latestPlan = ((planResult.data ?? []) as QueryRow[]).map(normalizeDailyGrowthMapProfitPlanRow)[0] ?? null;
  const planDays = latestPlan?.output_json?.days.map(normalizeProfitPlanDayForGrowthMap) ?? [];
  const dailyRows = ((dailyResult.data ?? []) as QueryRow[]).map(normalizeDailyGrowthMapDailyRow);
  const campaignDays = mergeCampaignPerformanceRows(
    extractCampaignPlanDays(latestPlan?.output_json ?? null),
    ((performanceResult.data ?? []) as QueryRow[]).map(normalizeCampaignPerformanceRow),
  );

  return {
    client: clientResult.data ? normalizeDailyGrowthMapClient(clientResult.data as QueryRow) : null,
    days: mergeGrowthMapDailyRows(planDays, dailyRows),
    daily_rows: dailyRows,
    campaign_days: campaignDays,
    latest_profit_plan: latestPlan,
  };
}
