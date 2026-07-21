import {
  runAttributionTargetEngine,
  type AttributionTargetInput,
  type AttributionTargetOutput,
} from "./attributionTargetEngine";
import {
  runChannelAllocation,
  type ChannelAllocationChannelInput,
  type ChannelAllocationInput,
  type ChannelAllocationOutput,
} from "./channelAllocation";
import {
  runCampaignDailyPlan,
  type CampaignDailyPlanInput,
  type CampaignDailyPlanOutput,
} from "./campaignDailyPlan";
import {
  runConceptLogOperationalPlan,
  type ConceptLogEntry,
  type ConceptLogOperationalInput,
  type ConceptLogOperationalOutput,
} from "./conceptLog";
import {
  buildCustomerCohortAnalysis,
  type CustomerCohortAnalysis,
  type CustomerTransaction,
} from "./customerCohorts";
import {
  runCreativeDemand,
  type CreativeDemandInput,
  type CreativeDemandOutput,
} from "./creativeDemand";
import {
  WEIGHT_PRESETS,
  type DayWeights,
} from "./dailyTargets";
import {
  runEventDailyPlan,
  type EventDailyPlanInput,
  type EventDailyPlanOutput,
} from "./eventDailyPlan";
import {
  runProfitFirstMediaBuying,
  type ProfitFirstInput,
  type ProfitFirstOutput,
} from "./profitFirstMediaBuying";
import {
  runSpendEfficiencyFrontier,
  type SpendEfficiencyFrontierOutput,
  type SpendEfficiencyInput,
} from "./spendEfficiencyFrontier";
import {
  runThreeCohortForecast,
  type ThreeCohortForecastOutput,
} from "./threeCohortForecast";
import {
  runUnitEconomicsTargetEngine,
  type UnitEconomicsTargetInput,
  type UnitEconomicsTargetOutput,
} from "./unitEconomicsTargetEngine";

export const PROFIT_PLAN_ENGINE_VERSION = "profit_plan_engine_v1" as const;

export type ProfitPlanStatus = "DRAFT" | "APPROVED" | "ARCHIVED" | string;

export type ProfitPlanEngineInput = {
  client_id: string;
  plan_name: string;
  period_start: string;
  planned_spend: number;
  status?: ProfitPlanStatus;
  profit_first: Omit<ProfitFirstInput, "planned_spend">;
  spend_efficiency?: (Omit<SpendEfficiencyInput, "target_spend"> & {
    target_spend?: number | null;
  }) | null;
  customer_transactions?: CustomerTransaction[] | null;
  unit_economics_targets?: UnitEconomicsTargetInput | null;
  attribution_targets?: AttributionTargetInput | null;
  channel_allocation?: (Omit<ChannelAllocationInput, "planned_ad_spend" | "business_target_amr" | "business_target_roas" | "business_target_cac" | "channels"> & {
    channels?: ChannelAllocationChannelInput[] | null;
    planned_ad_spend?: number | null;
    business_target_amr?: number | null;
    business_target_roas?: number | null;
    business_target_cac?: number | null;
  }) | null;
  campaign_daily_plan?: Omit<CampaignDailyPlanInput, "days" | "channel_allocation"> | null;
  concept_log?: (Omit<ConceptLogOperationalInput, "concepts" | "planned_monthly_spend" | "period_start" | "period_end"> & {
    concepts?: ConceptLogEntry[] | null;
    planned_monthly_spend?: number | null;
    period_start?: string | null;
    period_end?: string | null;
  }) | null;
  event_daily_plan?: Omit<EventDailyPlanInput, "dates" | "day_weights"> | null;
  creative_demand?: (Omit<CreativeDemandInput, "weekly_spend"> & {
    weekly_spend?: number | null;
  }) | null;
  day_weight_preset?: keyof typeof WEIGHT_PRESETS | string | null;
  day_weights?: DayWeights | null;
};

export type ProfitPlanCohortSummary = {
  acquisition_cohort_count: number;
  latest_transaction_period: string | null;
  latest_active_customers: number;
  latest_retention_rate: number | null;
  first_purchase_revenue: number;
  first_purchase_gross_profit: number;
};

export type ProfitPlanUnitEconomics = {
  source: "unit_economics_target_engine" | "profit_first_cohort";
  aov_new: number;
  aov_repeat: number;
  gross_margin_rate: number;
  target_cac: number | null;
  target_mer: number | null;
  break_even_cac: number | null;
  break_even_mer: number | null;
  portfolio_revenue_per_order: number | null;
  portfolio_contribution_before_ads_per_order: number | null;
  portfolio_target_cac: number | null;
  portfolio_target_roas: number | null;
  portfolio_target_amr: number | null;
  ltv_new_horizon: number;
  ltv_new_net_horizon: number;
  payback_months_estimate: number | null;
};

export type ProfitPlanMonthPlan = {
  client_id: string;
  month_start: string;
  month_end: string;
  planned_revenue: number;
  planned_new_customer_revenue: number;
  planned_returning_revenue: number;
  planned_ad_spend: number;
  planned_orders: number;
  planned_new_customers: number;
  planned_returning_orders: number;
  planned_gross_profit: number;
  planned_contribution_margin: number;
  recommended_spend: number;
  recommended_amr: number | null;
  binding_constraint: string;
  target_cac: number | null;
  target_mer: number | null;
};

export type ProfitPlanDayPlan = {
  client_id: string;
  plan_date: string;
  day_of_week: number;
  day_index: number;
  pacing_weight: number;
  target_revenue: number;
  target_new_customer_revenue: number;
  target_returning_revenue: number;
  target_ad_spend: number;
  target_orders: number;
  target_new_customers: number;
  target_returning_orders: number;
  target_gross_profit: number;
  target_contribution_margin: number;
  status: "PLANNED";
};

export type ProfitPlanWeekPlan = {
  client_id: string;
  week_index: number;
  week_start: string;
  week_end: string;
  target_revenue: number;
  target_new_customer_revenue: number;
  target_returning_revenue: number;
  target_ad_spend: number;
  target_orders: number;
  target_new_customers: number;
  target_returning_orders: number;
  target_gross_profit: number;
  target_contribution_margin: number;
};

export type ProfitPlanEngineOutput = {
  engine_version: typeof PROFIT_PLAN_ENGINE_VERSION;
  client_id: string;
  plan_name: string;
  status: ProfitPlanStatus;
  period_start: string;
  period_end: string;
  month: ProfitPlanMonthPlan;
  weeks: ProfitPlanWeekPlan[];
  days: ProfitPlanDayPlan[];
  unit_economics: ProfitPlanUnitEconomics;
  cohort_summary: ProfitPlanCohortSummary;
  sources: {
    profit_first_media_buying: ProfitFirstOutput;
    spend_efficiency_frontier: SpendEfficiencyFrontierOutput | null;
    customer_cohorts: CustomerCohortAnalysis | null;
    creative_demand: CreativeDemandOutput;
    three_cohort_forecast: ThreeCohortForecastOutput | null;
    unit_economics_targets: UnitEconomicsTargetOutput | null;
    attribution_targets: AttributionTargetOutput | null;
    channel_allocation: ChannelAllocationOutput | null;
    campaign_daily_plan: CampaignDailyPlanOutput | null;
    concept_log: ConceptLogOperationalOutput | null;
    event_daily_plan: EventDailyPlanOutput | null;
  };
  assumptions: {
    recommended_spend_policy: string;
    revenue_formula: string;
    target_formula: string;
    attribution_formula: string;
    channel_allocation_formula: string;
    campaign_daily_plan_formula: string;
    concept_log_formula: string;
    daily_plan_formula: string;
    daily_weight_source: string;
    creative_week_count: number;
  };
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type FrontierResult = {
  output: SpendEfficiencyFrontierOutput | null;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type UnitTargetResult = {
  output: UnitEconomicsTargetOutput | null;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type AttributionTargetResult = {
  output: AttributionTargetOutput | null;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type ChannelAllocationResult = {
  output: ChannelAllocationOutput | null;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type CampaignDailyPlanResult = {
  output: CampaignDailyPlanOutput | null;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type ConceptLogResult = {
  output: ConceptLogOperationalOutput | null;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type EventDailyPlanResult = {
  output: EventDailyPlanOutput | null;
  weights: number[];
  source: string;
  risks: string[];
  conditions: string[];
  missing_data: string[];
};

type SplitOptions = {
  dates: string[];
  weights: number[];
};

function requiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalPositive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nonNegative(value: unknown): number {
  return Math.max(0, finite(value));
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function whole(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function rate01(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function isoDate(value: string): string {
  return requiredText(value, "period_start").slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthEndIso(startIso: string): string {
  const date = new Date(`${startIso}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
}

function buildDateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function resolveDayWeights(input: ProfitPlanEngineInput): { weights: DayWeights; source: string } {
  if (input.day_weights) return { weights: input.day_weights, source: "custom" };
  const preset = String(input.day_weight_preset ?? "ecom_b2c");
  return {
    weights: WEIGHT_PRESETS[preset] ?? WEIGHT_PRESETS.ecom_b2c,
    source: WEIGHT_PRESETS[preset] ? preset : "ecom_b2c",
  };
}

function splitWeightedMoney(total: number, options: SplitOptions): number[] {
  const target = money(total);
  const sum = options.weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const rows = options.weights.map((weight) => money(target * (weight / sum)));
  const diff = money(target - rows.reduce((acc, value) => acc + value, 0));
  if (rows.length > 0) rows[rows.length - 1] = money(rows[rows.length - 1] + diff);
  return rows;
}

function splitWeightedWhole(total: number, options: SplitOptions): number[] {
  const target = whole(total);
  const sum = options.weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const raw = options.weights.map((weight) => target * (weight / sum));
  const floors = raw.map((value) => Math.floor(value));
  const remainder = target - floors.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value), weight: options.weights[index] }))
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight);

  for (let i = 0; i < remainder && i < order.length; i++) {
    floors[order[i].index] += 1;
  }
  return floors;
}

function sumMoney(rows: ProfitPlanDayPlan[], key: keyof ProfitPlanDayPlan): number {
  return money(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0));
}

function sumWhole(rows: ProfitPlanDayPlan[], key: keyof ProfitPlanDayPlan): number {
  return whole(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0));
}

function runFrontier(input: ProfitPlanEngineInput, plannedSpend: number): FrontierResult {
  if (!input.spend_efficiency) {
    return {
      output: null,
      risks: [],
      conditions: ["Add spend efficiency history to activate spend frontier guidance."],
      missing_data: ["spend_efficiency"],
    };
  }

  try {
    const output = runSpendEfficiencyFrontier({
      ...input.spend_efficiency,
      target_spend: input.spend_efficiency.target_spend ?? plannedSpend,
    });
    const missingData = [...output.missing_data];
    if (output.contribution_margin_rate <= 0) {
      missingData.push("spend_efficiency.contribution_margin_rate");
    }
    return {
      output,
      risks: output.risks,
      conditions: output.conditions,
      missing_data: missingData,
    };
  } catch (error) {
    return {
      output: null,
      risks: [error instanceof Error ? error.message : "Spend efficiency frontier failed."],
      conditions: ["Provide at least one valid spend and new customer revenue history point."],
      missing_data: ["spend_efficiency.history"],
    };
  }
}

function runUnitTargets(input: ProfitPlanEngineInput, plannedSpend: number): UnitTargetResult {
  const offers = input.unit_economics_targets?.offers ?? [];
  if (offers.length === 0) {
    return {
      output: null,
      risks: [],
      conditions: ["Add offer/SKU unit economics to activate target CAC and ROAS planning."],
      missing_data: ["unit_economics_targets"],
    };
  }

  try {
    const output = runUnitEconomicsTargetEngine({
      ...input.unit_economics_targets,
      planned_ad_spend: input.unit_economics_targets?.planned_ad_spend ?? plannedSpend,
      offers,
    });

    return {
      output,
      risks: output.risks.map((item) => `unit_economics_targets.${item}`),
      conditions: output.conditions.map((item) => `unit_economics_targets.${item}`),
      missing_data: output.missing_data.map((item) => `unit_economics_targets.${item}`),
    };
  } catch (error) {
    return {
      output: null,
      risks: [error instanceof Error ? error.message : "Unit economics target engine failed."],
      conditions: ["Review offer/SKU economics before using unit targets in the Profit Plan."],
      missing_data: ["unit_economics_targets"],
    };
  }
}

function runAttributionTargets(
  input: ProfitPlanEngineInput,
  plannedSpend: number,
  businessTargetAmr: number | null,
  businessTargetCac: number | null,
): AttributionTargetResult {
  const channels = input.attribution_targets?.channels ?? [];
  if (channels.length === 0) {
    return {
      output: null,
      risks: [],
      conditions: ["Add attribution channel settings to translate business targets into media-platform targets."],
      missing_data: ["attribution_targets"],
    };
  }

  try {
    const output = runAttributionTargetEngine({
      ...input.attribution_targets,
      business_target_amr: input.attribution_targets?.business_target_amr
        ?? input.attribution_targets?.business_target_roas
        ?? businessTargetAmr,
      business_target_cac: input.attribution_targets?.business_target_cac ?? businessTargetCac,
      planned_ad_spend: input.attribution_targets?.planned_ad_spend ?? plannedSpend,
      channels: channels.map((channel) => ({
        ...channel,
        planned_spend: channel.planned_spend ?? plannedSpend / Math.max(1, channels.length),
      })),
    });

    return {
      output,
      risks: output.risks.map((item) => `attribution_targets.${item}`),
      conditions: output.conditions.map((item) => `attribution_targets.${item}`),
      missing_data: output.missing_data.map((item) => `attribution_targets.${item}`),
    };
  } catch (error) {
    return {
      output: null,
      risks: [error instanceof Error ? error.message : "Attribution target engine failed."],
      conditions: ["Review attribution channel settings before using platform targets in media buying."],
      missing_data: ["attribution_targets"],
    };
  }
}

function attributionChannelsToAllocationChannels(
  attributionTargets: AttributionTargetOutput | null,
): ChannelAllocationChannelInput[] {
  return attributionTargets?.channels.map((channel) => ({
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    platform: channel.platform,
    planned_spend: channel.planned_spend,
    business_target_amr: channel.business_target_amr,
    business_target_cac: channel.business_target_cac,
  })) ?? [];
}

function runChannelAllocationPlan(
  input: ProfitPlanEngineInput,
  plannedSpend: number,
  businessTargetAmr: number | null,
  businessTargetCac: number | null,
  attributionTargets: AttributionTargetOutput | null,
): ChannelAllocationResult {
  const explicitChannels = input.channel_allocation?.channels ?? [];
  const channels = explicitChannels.length > 0
    ? explicitChannels
    : attributionChannelsToAllocationChannels(attributionTargets);

  if (channels.length === 0) {
    return {
      output: null,
      risks: [],
      conditions: ["Add channel allocation inputs to split the Profit Plan into channel-level targets."],
      missing_data: ["channel_allocation"],
    };
  }

  const output = runChannelAllocation({
    ...(input.channel_allocation ?? {}),
    channels,
    planned_ad_spend: input.channel_allocation?.planned_ad_spend ?? plannedSpend,
    business_target_amr: input.channel_allocation?.business_target_amr
      ?? input.channel_allocation?.business_target_roas
      ?? businessTargetAmr,
    business_target_cac: input.channel_allocation?.business_target_cac ?? businessTargetCac,
  });

  return {
    output,
    risks: output.risks.map((item) => `channel_allocation.${item}`),
    conditions: output.conditions.map((item) => `channel_allocation.${item}`),
    missing_data: output.missing_data.map((item) => `channel_allocation.${item}`),
  };
}

function runCampaignDailyPlanning(
  input: ProfitPlanEngineInput,
  days: ProfitPlanDayPlan[],
  channelAllocation: ChannelAllocationOutput | null,
): CampaignDailyPlanResult {
  if (!channelAllocation) {
    return {
      output: null,
      risks: [],
      conditions: ["Add channel allocation before generating campaign-level daily plans."],
      missing_data: ["campaign_daily_plan.channel_allocation"],
    };
  }

  const output = runCampaignDailyPlan({
    ...(input.campaign_daily_plan ?? {}),
    days: days.map((day) => ({
      plan_date: day.plan_date,
      day_index: day.day_index,
      pacing_weight: day.pacing_weight,
      target_ad_spend: day.target_ad_spend,
    })),
    channel_allocation: channelAllocation,
    campaigns: input.campaign_daily_plan?.campaigns ?? [],
  });

  return {
    output,
    risks: output.risks.map((item) => `campaign_daily_plan.${item}`),
    conditions: output.conditions.map((item) => `campaign_daily_plan.${item}`),
    missing_data: output.missing_data.map((item) => `campaign_daily_plan.${item}`),
  };
}

function runConceptLogPlanning(
  input: ProfitPlanEngineInput,
  recommendedSpend: number,
  periodStart: string,
  periodEnd: string,
): ConceptLogResult {
  const concepts = input.concept_log?.concepts ?? [];
  if (concepts.length === 0) {
    return {
      output: null,
      risks: [],
      conditions: ["Add Concept Log entries to connect creative concepts to the Profit Plan."],
      missing_data: ["concept_log"],
    };
  }

  const output = runConceptLogOperationalPlan({
    ...(input.concept_log ?? {}),
    concepts,
    planned_monthly_spend: input.concept_log?.planned_monthly_spend ?? recommendedSpend,
    period_start: input.concept_log?.period_start ?? periodStart,
    period_end: input.concept_log?.period_end ?? periodEnd,
  });

  return {
    output,
    risks: output.risks.map((item) => `concept_log.${item}`),
    conditions: output.conditions.map((item) => `concept_log.${item}`),
    missing_data: output.missing_data.map((item) => `concept_log.${item}`),
  };
}

function runEventDailyPlanning(
  input: ProfitPlanEngineInput,
  dates: string[],
  dayWeights: DayWeights,
  dayWeightSource: string,
): EventDailyPlanResult {
  const baseWeights = dates.map((date) => dayWeights[dayOfWeek(date)] ?? 1);
  const events = input.event_daily_plan?.events ?? [];
  if (events.length === 0) {
    return {
      output: null,
      weights: baseWeights,
      source: dayWeightSource,
      risks: [],
      conditions: ["Add planned events to activate event-adjusted daily Profit Plan pacing."],
      missing_data: ["event_daily_plan"],
    };
  }

  const output = runEventDailyPlan({
    ...input.event_daily_plan,
    dates,
    day_weights: dayWeights,
    events,
  });
  const hasEventWeight = output.date_weights.some((row) => Math.abs(row.event_multiplier - 1) > 0.0001);

  return {
    output,
    weights: output.date_weights.map((row) => row.final_weight),
    source: hasEventWeight ? `${dayWeightSource}+event_daily_plan` : dayWeightSource,
    risks: output.risks.map((item) => `event_daily_plan.${item}`),
    conditions: output.conditions.map((item) => `event_daily_plan.${item}`),
    missing_data: output.missing_data.map((item) => `event_daily_plan.${item}`),
  };
}

function closestFrontierAmr(frontier: SpendEfficiencyFrontierOutput | null, spend: number): number | null {
  if (!frontier || frontier.frontier.length === 0) return null;
  const closest = frontier.frontier.reduce((best, point) => (
    Math.abs(point.spend - spend) < Math.abs(best.spend - spend) ? point : best
  ), frontier.frontier[0]);
  return closest.amr;
}

function buildCohortSummary(analysis: CustomerCohortAnalysis | null): ProfitPlanCohortSummary {
  if (!analysis) {
    return {
      acquisition_cohort_count: 0,
      latest_transaction_period: null,
      latest_active_customers: 0,
      latest_retention_rate: null,
      first_purchase_revenue: 0,
      first_purchase_gross_profit: 0,
    };
  }

  const latest = analysis.period_retention.at(-1);
  return {
    acquisition_cohort_count: analysis.acquisition_cohorts.length,
    latest_transaction_period: latest?.transaction_period ?? null,
    latest_active_customers: latest?.active_customers ?? 0,
    latest_retention_rate: latest?.retention_rate ?? null,
    first_purchase_revenue: money(analysis.acquisition_cohorts.reduce((sum, cohort) => (
      sum + cohort.first_purchase_revenue
    ), 0)),
    first_purchase_gross_profit: money(analysis.acquisition_cohorts.reduce((sum, cohort) => (
      sum + cohort.first_purchase_gross_profit
    ), 0)),
  };
}

function buildDays(
  clientId: string,
  month: ProfitPlanMonthPlan,
  dates: string[],
  weights: number[],
): ProfitPlanDayPlan[] {
  const options = { dates, weights };
  const revenue = splitWeightedMoney(month.planned_revenue, options);
  const newRevenue = splitWeightedMoney(month.planned_new_customer_revenue, options);
  const returningRevenue = splitWeightedMoney(month.planned_returning_revenue, options);
  const spend = splitWeightedMoney(month.planned_ad_spend, options);
  const grossProfit = splitWeightedMoney(month.planned_gross_profit, options);
  const contribution = splitWeightedMoney(month.planned_contribution_margin, options);
  const orders = splitWeightedWhole(month.planned_orders, options);
  const newCustomers = splitWeightedWhole(month.planned_new_customers, options);
  const returningOrders = splitWeightedWhole(month.planned_returning_orders, options);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return dates.map((date, index) => ({
    client_id: clientId,
    plan_date: date,
    day_of_week: dayOfWeek(date),
    day_index: index + 1,
    pacing_weight: Number((weights[index] / weightTotal).toFixed(4)),
    target_revenue: revenue[index],
    target_new_customer_revenue: newRevenue[index],
    target_returning_revenue: returningRevenue[index],
    target_ad_spend: spend[index],
    target_orders: orders[index],
    target_new_customers: newCustomers[index],
    target_returning_orders: returningOrders[index],
    target_gross_profit: grossProfit[index],
    target_contribution_margin: contribution[index],
    status: "PLANNED",
  }));
}

function buildWeeks(clientId: string, days: ProfitPlanDayPlan[]): ProfitPlanWeekPlan[] {
  const chunks: ProfitPlanDayPlan[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    chunks.push(days.slice(i, i + 7));
  }

  return chunks.map((chunk, index) => ({
    client_id: clientId,
    week_index: index + 1,
    week_start: chunk[0].plan_date,
    week_end: chunk[chunk.length - 1].plan_date,
    target_revenue: sumMoney(chunk, "target_revenue"),
    target_new_customer_revenue: sumMoney(chunk, "target_new_customer_revenue"),
    target_returning_revenue: sumMoney(chunk, "target_returning_revenue"),
    target_ad_spend: sumMoney(chunk, "target_ad_spend"),
    target_orders: sumWhole(chunk, "target_orders"),
    target_new_customers: sumWhole(chunk, "target_new_customers"),
    target_returning_orders: sumWhole(chunk, "target_returning_orders"),
    target_gross_profit: sumMoney(chunk, "target_gross_profit"),
    target_contribution_margin: sumMoney(chunk, "target_contribution_margin"),
  }));
}

function collectInputMissingData(input: ProfitPlanEngineInput): string[] {
  const missing: string[] = [];
  if (!optionalPositive(input.profit_first.cohort.aov_new)) missing.push("profit_first.cohort.aov_new");
  if (!optionalPositive(input.profit_first.cohort.gross_margin_pct)) missing.push("profit_first.cohort.gross_margin_pct");
  if (!optionalPositive(input.profit_first.cohort.conversion_rate)) missing.push("profit_first.cohort.conversion_rate");
  if (!optionalPositive(input.profit_first.cash.cash_available)) missing.push("profit_first.cash.cash_available");
  if (!optionalPositive(input.profit_first.funnel.monthly_sessions)) missing.push("profit_first.funnel.monthly_sessions");
  return missing;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function runProfitPlanEngine(input: ProfitPlanEngineInput): ProfitPlanEngineOutput {
  const clientId = requiredText(input.client_id, "client_id");
  const planName = requiredText(input.plan_name, "plan_name");
  const periodStart = isoDate(input.period_start);
  const periodEnd = monthEndIso(periodStart);
  const plannedSpend = nonNegative(input.planned_spend);
  const frontier = runFrontier(input, plannedSpend);
  const firstPass = runProfitFirstMediaBuying({
    ...input.profit_first,
    planned_spend: plannedSpend,
  });
  const spendCaps = [
    plannedSpend,
    firstPass.recommended_spend,
    frontier.output?.recommended_spend,
  ].filter((value): value is number => Number.isFinite(Number(value)) && Number(value) >= 0);
  const recommendedSpend = whole(Math.min(...spendCaps));
  const profitFirst = recommendedSpend === plannedSpend
    ? firstPass
    : runProfitFirstMediaBuying({
      ...input.profit_first,
      planned_spend: recommendedSpend,
    });
  const unitTargets = runUnitTargets(input, recommendedSpend);
  const dates = buildDateRange(periodStart, periodEnd);
  const { weights: dayWeights, source: dailyWeightSource } = resolveDayWeights(input);
  const eventDailyPlan = runEventDailyPlanning(input, dates, dayWeights, dailyWeightSource);
  const grossMarginRate = rate01(input.profit_first.cohort.gross_margin_pct);
  const newCustomerAmr = closestFrontierAmr(frontier.output, recommendedSpend);
  const plannedNewCustomerRevenue = money(newCustomerAmr !== null
    ? recommendedSpend * newCustomerAmr
    : profitFirst.planned_new_customers * nonNegative(input.profit_first.cohort.aov_new));
  const cohortForecast = input.customer_transactions?.length
    ? runThreeCohortForecast({
      period_start: periodStart,
      period_end: periodEnd,
      transactions: input.customer_transactions,
      planned_new_customers: whole(profitFirst.planned_new_customers),
      planned_new_customer_revenue: plannedNewCustomerRevenue,
      planned_ad_spend: recommendedSpend,
      gross_margin_rate: grossMarginRate,
    })
    : null;
  const fallbackReturningRevenue = money(
    profitFirst.planned_repeat_orders * nonNegative(input.profit_first.cohort.aov_repeat),
  );
  const plannedReturningRevenue = cohortForecast?.totals.projected_returning_revenue ?? fallbackReturningRevenue;
  const plannedRevenue = cohortForecast?.totals.projected_revenue ?? money(plannedNewCustomerRevenue + plannedReturningRevenue);
  const plannedGrossProfit = cohortForecast?.totals.projected_gross_profit ?? money(plannedRevenue * grossMarginRate);
  const plannedContribution = cohortForecast?.totals.projected_contribution_margin ?? money(profitFirst.contribution_total);
  const plannedOrders = cohortForecast?.totals.projected_orders ?? whole(profitFirst.planned_orders);
  const plannedNewCustomers = cohortForecast?.totals.projected_new_customers ?? whole(profitFirst.planned_new_customers);
  const plannedReturningOrders = cohortForecast?.totals.projected_returning_orders ?? whole(profitFirst.planned_repeat_orders);
  const targetCac = unitTargets.output?.portfolio.weighted_target_cac ?? input.profit_first.target_cac ?? null;
  const targetMer = unitTargets.output?.portfolio.weighted_target_amr ?? input.profit_first.target_mer ?? null;
  const attributionTargets = runAttributionTargets(input, recommendedSpend, targetMer, targetCac);
  const channelAllocation = runChannelAllocationPlan(
    input,
    recommendedSpend,
    targetMer,
    targetCac,
    attributionTargets.output,
  );
  const month: ProfitPlanMonthPlan = {
    client_id: clientId,
    month_start: periodStart,
    month_end: periodEnd,
    planned_revenue: plannedRevenue,
    planned_new_customer_revenue: plannedNewCustomerRevenue,
    planned_returning_revenue: plannedReturningRevenue,
    planned_ad_spend: recommendedSpend,
    planned_orders: plannedOrders,
    planned_new_customers: plannedNewCustomers,
    planned_returning_orders: plannedReturningOrders,
    planned_gross_profit: plannedGrossProfit,
    planned_contribution_margin: plannedContribution,
    recommended_spend: recommendedSpend,
    recommended_amr: newCustomerAmr,
    binding_constraint: profitFirst.binding_constraint,
    target_cac: targetCac,
    target_mer: targetMer,
  };
  const days = buildDays(clientId, month, dates, eventDailyPlan.weights);
  const campaignDailyPlan = runCampaignDailyPlanning(input, days, channelAllocation.output);
  const conceptLog = runConceptLogPlanning(input, recommendedSpend, periodStart, periodEnd);
  const weeks = buildWeeks(clientId, days);
  const cohortAnalysis = input.customer_transactions?.length
    ? buildCustomerCohortAnalysis(input.customer_transactions, { cadence: "month" })
    : null;
  const creativeDemand = runCreativeDemand({
    ...(input.creative_demand ?? {}),
    weekly_spend: input.creative_demand?.weekly_spend ?? recommendedSpend / Math.max(1, weeks.length),
  });
  const breakEvenCac = grossMarginRate > 0
    ? money(nonNegative(input.profit_first.cohort.aov_new) * grossMarginRate)
    : null;
  const breakEvenMer = grossMarginRate > 0 ? money(1 / grossMarginRate) : null;
  const unitPortfolio = unitTargets.output?.portfolio ?? null;
  const unitEconomics: ProfitPlanUnitEconomics = {
    source: unitPortfolio ? "unit_economics_target_engine" : "profit_first_cohort",
    aov_new: nonNegative(input.profit_first.cohort.aov_new),
    aov_repeat: nonNegative(input.profit_first.cohort.aov_repeat),
    gross_margin_rate: Number(grossMarginRate.toFixed(4)),
    target_cac: targetCac,
    target_mer: targetMer,
    break_even_cac: unitPortfolio?.weighted_break_even_cac ?? breakEvenCac,
    break_even_mer: unitPortfolio?.weighted_break_even_amr ?? breakEvenMer,
    portfolio_revenue_per_order: unitPortfolio?.weighted_revenue_per_order ?? null,
    portfolio_contribution_before_ads_per_order: unitPortfolio?.weighted_contribution_before_ads_per_order ?? null,
    portfolio_target_cac: unitPortfolio?.weighted_target_cac ?? null,
    portfolio_target_roas: unitPortfolio?.weighted_target_roas ?? null,
    portfolio_target_amr: unitPortfolio?.weighted_target_amr ?? null,
    ltv_new_horizon: profitFirst.ltv_new_horizon,
    ltv_new_net_horizon: profitFirst.ltv_new_net_horizon,
    payback_months_estimate: profitFirst.payback_months_estimate,
  };
  const missingData = unique([
    ...collectInputMissingData(input),
    ...frontier.missing_data,
    ...unitTargets.missing_data,
    ...attributionTargets.missing_data,
    ...channelAllocation.missing_data,
    ...campaignDailyPlan.missing_data,
    ...conceptLog.missing_data,
    ...eventDailyPlan.missing_data,
    ...(cohortForecast?.missing_data.map((item) => `three_cohort_forecast.${item}`) ?? []),
    ...creativeDemand.missing_data.map((item) => `creative_demand.${item}`),
    ...(cohortAnalysis ? [] : ["customer_transactions"]),
  ]);
  const risks = unique([
    ...frontier.risks,
    ...unitTargets.risks,
    ...attributionTargets.risks,
    ...channelAllocation.risks,
    ...campaignDailyPlan.risks,
    ...conceptLog.risks,
    ...eventDailyPlan.risks,
    ...profitFirst.risks,
    ...(cohortForecast?.risks.map((item) => `three_cohort_forecast.${item}`) ?? []),
    ...creativeDemand.risks.map((item) => `creative_demand.${item}`),
  ]);
  const conditions = unique([
    ...frontier.conditions,
    ...unitTargets.conditions,
    ...attributionTargets.conditions,
    ...channelAllocation.conditions,
    ...campaignDailyPlan.conditions,
    ...conceptLog.conditions,
    ...eventDailyPlan.conditions,
    ...profitFirst.conditions,
    ...(cohortForecast?.conditions.map((item) => `three_cohort_forecast.${item}`) ?? []),
    ...(cohortAnalysis ? [] : ["Import normalized customer transactions to activate cohort-informed retention planning."]),
  ]);
  const summary = `Profit Plan v1 - ${planName} - ${periodStart} to ${periodEnd} - spend ${recommendedSpend} - revenue ${plannedRevenue} - contribution ${plannedContribution}.`;

  return {
    engine_version: PROFIT_PLAN_ENGINE_VERSION,
    client_id: clientId,
    plan_name: planName,
    status: input.status ?? "DRAFT",
    period_start: periodStart,
    period_end: periodEnd,
    month,
    weeks,
    days,
    unit_economics: unitEconomics,
    cohort_summary: buildCohortSummary(cohortAnalysis),
    sources: {
      profit_first_media_buying: profitFirst,
      spend_efficiency_frontier: frontier.output,
      customer_cohorts: cohortAnalysis,
      creative_demand: creativeDemand,
      three_cohort_forecast: cohortForecast,
      unit_economics_targets: unitTargets.output,
      attribution_targets: attributionTargets.output,
      channel_allocation: channelAllocation.output,
      campaign_daily_plan: campaignDailyPlan.output,
      concept_log: conceptLog.output,
      event_daily_plan: eventDailyPlan.output,
    },
    assumptions: {
      recommended_spend_policy: "min(planned_spend, profit_first_recommended_spend, spend_frontier_recommended_spend_when_available)",
      revenue_formula: "new_customer_revenue=ad_spend*frontier_amr fallback planned_new_customers*aov_new; returning_revenue=three_cohort_forecast when transactions exist, otherwise pfmb_repeat_orders*aov_repeat",
      target_formula: "target_cac and target_mer come from unit_economics_targets when offers exist, otherwise profit_first input targets",
      attribution_formula: "platform targets = business targets x click-window multiplier x delayed-attribution multiplier x click-only view-through exclusion",
      channel_allocation_formula: "allocated_spend by channel; incremental_target_amr = business_target_amr * incrementality_factor; required_platform_amr = business_target_amr / incrementality_factor",
      campaign_daily_plan_formula: "campaign daily spend = channel allocated spend x campaign allocation share x Profit Plan daily pacing weight",
      concept_log_formula: "concept readiness = required operational fields complete; expected spend coverage = concept expected period spend / planned monthly spend",
      daily_plan_formula: "monthly totals are split by day-of-week weights adjusted by planned event multipliers, then normalized so monthly totals are preserved",
      daily_weight_source: eventDailyPlan.source,
      creative_week_count: weeks.length,
    },
    missing_data: missingData,
    risks,
    conditions,
    summary,
  };
}
