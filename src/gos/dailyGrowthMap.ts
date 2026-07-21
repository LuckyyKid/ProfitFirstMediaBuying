export const DAILY_GROWTH_MAP_ENGINE_VERSION = "daily_growth_map_v1" as const;

export type DailyGrowthMapScope = "mtd" | "wtd" | "last7" | "all" | "custom";
export type DailyGrowthMapMetricStatus = "GOOD" | "WATCH" | "BAD" | "MISSING";
export type DailyGrowthMapMetricDirection = "higher_is_better" | "lower_is_better" | "neutral";
export type DailyGrowthMapMetricUnit = "money" | "number" | "percent" | "ratio" | "days";
export type DailyGrowthMapLayer =
  | "profit"
  | "revenue"
  | "spend"
  | "volume"
  | "efficiency"
  | "pacing"
  | "quality"
  | "channel"
  | "campaign"
  | "coverage";

export type DailyGrowthMapDailyInput = {
  id?: string | null;
  client_id?: string | null;
  target_date: string;
  target_revenue?: number | null;
  target_new_customer_revenue?: number | null;
  target_returning_revenue?: number | null;
  target_ad_spend?: number | null;
  target_orders?: number | null;
  target_new_customers?: number | null;
  target_returning_orders?: number | null;
  target_leads?: number | null;
  target_gross_profit?: number | null;
  target_contribution_margin?: number | null;
  projection_revenue?: number | null;
  projection_new_customer_revenue?: number | null;
  projection_returning_revenue?: number | null;
  projection_ad_spend?: number | null;
  projection_orders?: number | null;
  projection_new_customers?: number | null;
  projection_returning_orders?: number | null;
  projection_leads?: number | null;
  projection_gross_profit?: number | null;
  projection_contribution_margin?: number | null;
  actual_revenue?: number | null;
  actual_new_customer_revenue?: number | null;
  actual_returning_revenue?: number | null;
  actual_ad_spend?: number | null;
  actual_orders?: number | null;
  actual_new_customers?: number | null;
  actual_returning_orders?: number | null;
  actual_leads?: number | null;
  actual_gross_profit?: number | null;
  actual_contribution_margin?: number | null;
};

export type DailyGrowthMapCampaignDayInput = {
  campaign_id?: string | null;
  campaign_name: string;
  platform?: string | null;
  channel_id?: string | null;
  channel_name: string;
  plan_date: string;
  target_spend?: number | null;
  platform_revenue_required?: number | null;
  incremental_revenue_target?: number | null;
  platform_conversions_required?: number | null;
  required_platform_amr?: number | null;
  required_platform_cac?: number | null;
  incremental_target_amr?: number | null;
  actual_spend?: number | null;
  actual_revenue?: number | null;
  actual_orders?: number | null;
  actual_leads?: number | null;
};

export type DailyGrowthMapInput = {
  client_id: string;
  days: DailyGrowthMapDailyInput[];
  campaign_days?: DailyGrowthMapCampaignDayInput[] | null;
  scope?: DailyGrowthMapScope;
  period_start?: string | null;
  period_end?: string | null;
  as_of_date?: string | null;
};

export type DailyGrowthMapMetricNode = {
  key: string;
  label: string;
  layer: DailyGrowthMapLayer;
  parent_key: string | null;
  level: number;
  sort_order: number;
  unit: DailyGrowthMapMetricUnit;
  direction: DailyGrowthMapMetricDirection;
  target: number | null;
  projection: number | null;
  actual: number | null;
  variance_vs_target_pct: number | null;
  variance_vs_projection_pct: number | null;
  status: DailyGrowthMapMetricStatus;
  status_reason: string;
  formula: string;
  source: string;
  children_count: number;
};

export type DailyGrowthMapWindow = {
  scope: DailyGrowthMapScope;
  period_start: string | null;
  period_end: string | null;
  day_count: number;
};

export type DailyGrowthMapPortfolio = {
  metric_count: number;
  base_metric_count: number;
  channel_metric_count: number;
  campaign_metric_count: number;
  actual_coverage_rate: number | null;
  missing_metric_count: number;
  bad_metric_count: number;
  watch_metric_count: number;
  root_status: DailyGrowthMapMetricStatus;
};

export type DailyGrowthMapOutput = {
  engine_version: typeof DAILY_GROWTH_MAP_ENGINE_VERSION;
  client_id: string;
  window: DailyGrowthMapWindow;
  metrics: DailyGrowthMapMetricNode[];
  portfolio: DailyGrowthMapPortfolio;
  assumptions: {
    hierarchy: string;
    contribution_formula: string;
    campaign_formula: string;
    status_formula: string;
  };
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type MetricDraft = Omit<
  DailyGrowthMapMetricNode,
  "variance_vs_target_pct" | "variance_vs_projection_pct" | "status" | "status_reason" | "children_count"
>;

type Totals = {
  targetRevenue: number | null;
  targetNewCustomerRevenue: number | null;
  targetReturningRevenue: number | null;
  targetAdSpend: number | null;
  targetOrders: number | null;
  targetNewCustomers: number | null;
  targetReturningOrders: number | null;
  targetLeads: number | null;
  targetGrossProfit: number | null;
  targetContribution: number | null;
  projectionRevenue: number | null;
  projectionNewCustomerRevenue: number | null;
  projectionReturningRevenue: number | null;
  projectionAdSpend: number | null;
  projectionOrders: number | null;
  projectionNewCustomers: number | null;
  projectionReturningOrders: number | null;
  projectionLeads: number | null;
  projectionGrossProfit: number | null;
  projectionContribution: number | null;
  actualRevenue: number | null;
  actualNewCustomerRevenue: number | null;
  actualReturningRevenue: number | null;
  actualAdSpend: number | null;
  actualOrders: number | null;
  actualNewCustomers: number | null;
  actualReturningOrders: number | null;
  actualLeads: number | null;
  actualGrossProfit: number | null;
  actualContribution: number | null;
};

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function rounded(value: number | null, dp = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(dp));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseDate(value: string | null | undefined): string | null {
  const iso = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstOfMonthIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function startOfWeekIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return addDaysIso(iso, -date.getUTCDay());
}

function minIso(values: string[]): string | null {
  return values.length ? values.reduce((min, value) => (value < min ? value : min), values[0]) : null;
}

function maxIso(values: string[]): string | null {
  return values.length ? values.reduce((max, value) => (value > max ? value : max), values[0]) : null;
}

function sumKnown<T>(rows: T[], selector: (row: T) => unknown): number | null {
  let hasValue = false;
  const total = rows.reduce((sum, row) => {
    const value = finite(selector(row));
    if (value === null) return sum;
    hasValue = true;
    return sum + value;
  }, 0);
  return hasValue ? money(total) : null;
}

function countKnown<T>(rows: T[], selector: (row: T) => unknown): number {
  return rows.reduce((count, row) => (finite(selector(row)) === null ? count : count + 1), 0);
}

function ratio(numerator: number | null, denominator: number | null, dp = 4): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return rounded(numerator / denominator, dp);
}

function difference(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  return money(left - right);
}

function remainingGap(target: number | null, actual: number | null): number | null {
  if (target === null || actual === null) return null;
  return money(Math.max(0, target - actual));
}

function projectionGap(projection: number | null, actual: number | null): number | null {
  if (projection === null || actual === null) return null;
  return money(projection - actual);
}

function variancePct(target: number | null, actual: number | null): number | null {
  if (target === null || actual === null) return null;
  if (target === 0) return actual === 0 ? 0 : null;
  return rounded(((actual - target) / Math.abs(target)) * 100, 1);
}

function statusFor(
  direction: DailyGrowthMapMetricDirection,
  target: number | null,
  actual: number | null,
): { status: DailyGrowthMapMetricStatus; reason: string } {
  if (actual === null || target === null) {
    return { status: "MISSING", reason: "Actual or target is missing." };
  }
  if (direction === "neutral") {
    return { status: "GOOD", reason: "Informational metric with actual and target available." };
  }
  if (target === 0) {
    if (actual === 0) return { status: "GOOD", reason: "Actual equals the zero target." };
    if (direction === "lower_is_better") {
      return actual <= 0
        ? { status: "GOOD", reason: "Actual is at or below the zero target." }
        : { status: "BAD", reason: "Actual is above a zero target." };
    }
    return actual >= 0
      ? { status: "GOOD", reason: "Actual is at or above the zero target." }
      : { status: "BAD", reason: "Actual is below a zero target." };
  }

  const raw = ((actual - target) / Math.abs(target)) * 100;
  const score = direction === "lower_is_better" ? -raw : raw;
  if (score >= 0) return { status: "GOOD", reason: "Actual is on or better than target." };
  if (score >= -10) return { status: "WATCH", reason: "Actual is within 10% of target." };
  return { status: "BAD", reason: "Actual is more than 10% worse than target." };
}

function resolveWindow(input: DailyGrowthMapInput): DailyGrowthMapWindow {
  const scope = input.scope ?? "mtd";
  const dailyDates = input.days.map((day) => parseDate(day.target_date)).filter((date): date is string => Boolean(date));
  const campaignDates = (input.campaign_days ?? [])
    .map((day) => parseDate(day.plan_date))
    .filter((date): date is string => Boolean(date));
  const allDates = [...dailyDates, ...campaignDates];
  const allStart = minIso(allDates);
  const allEnd = maxIso(allDates);

  if (scope === "custom") {
    const periodStart = parseDate(input.period_start) ?? allStart;
    const periodEnd = parseDate(input.period_end) ?? allEnd;
    return {
      scope,
      period_start: periodStart,
      period_end: periodEnd,
      day_count: periodStart && periodEnd ? countDays(periodStart, periodEnd) : 0,
    };
  }

  if (scope === "all") {
    return {
      scope,
      period_start: allStart,
      period_end: allEnd,
      day_count: allStart && allEnd ? countDays(allStart, allEnd) : 0,
    };
  }

  const today = parseDate(input.as_of_date) ?? new Date().toISOString().slice(0, 10);
  const end = addDaysIso(today, -1);
  const start = scope === "mtd"
    ? firstOfMonthIso(end)
    : scope === "wtd"
      ? startOfWeekIso(end)
      : addDaysIso(end, -6);

  return {
    scope,
    period_start: start,
    period_end: end,
    day_count: countDays(start, end),
  };
}

function countDays(start: string, end: string): number {
  if (end < start) return 0;
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

function inWindow(date: string, window: DailyGrowthMapWindow): boolean {
  if (!window.period_start || !window.period_end) return false;
  return date >= window.period_start && date <= window.period_end;
}

function buildTotals(days: DailyGrowthMapDailyInput[]): Totals {
  const targetRevenue = sumKnown(days, (day) => day.target_revenue);
  const targetAdSpend = sumKnown(days, (day) => day.target_ad_spend);
  const targetGrossProfit = sumKnown(days, (day) => day.target_gross_profit);
  const targetContributionExplicit = sumKnown(days, (day) => day.target_contribution_margin);
  const projectionRevenue = sumKnown(days, (day) => day.projection_revenue);
  const projectionAdSpend = sumKnown(days, (day) => day.projection_ad_spend);
  const projectionGrossProfit = sumKnown(days, (day) => day.projection_gross_profit);
  const projectionContributionExplicit = sumKnown(days, (day) => day.projection_contribution_margin);
  const actualRevenue = sumKnown(days, (day) => day.actual_revenue);
  const actualAdSpend = sumKnown(days, (day) => day.actual_ad_spend);
  const actualGrossProfit = sumKnown(days, (day) => day.actual_gross_profit);
  const actualContributionExplicit = sumKnown(days, (day) => day.actual_contribution_margin);

  return {
    targetRevenue,
    targetNewCustomerRevenue: sumKnown(days, (day) => day.target_new_customer_revenue),
    targetReturningRevenue: sumKnown(days, (day) => day.target_returning_revenue),
    targetAdSpend,
    targetOrders: sumKnown(days, (day) => day.target_orders),
    targetNewCustomers: sumKnown(days, (day) => day.target_new_customers),
    targetReturningOrders: sumKnown(days, (day) => day.target_returning_orders),
    targetLeads: sumKnown(days, (day) => day.target_leads),
    targetGrossProfit,
    targetContribution: targetContributionExplicit ?? difference(targetGrossProfit, targetAdSpend),
    projectionRevenue,
    projectionNewCustomerRevenue: sumKnown(days, (day) => day.projection_new_customer_revenue),
    projectionReturningRevenue: sumKnown(days, (day) => day.projection_returning_revenue),
    projectionAdSpend,
    projectionOrders: sumKnown(days, (day) => day.projection_orders),
    projectionNewCustomers: sumKnown(days, (day) => day.projection_new_customers),
    projectionReturningOrders: sumKnown(days, (day) => day.projection_returning_orders),
    projectionLeads: sumKnown(days, (day) => day.projection_leads),
    projectionGrossProfit,
    projectionContribution: projectionContributionExplicit ?? difference(projectionGrossProfit, projectionAdSpend),
    actualRevenue,
    actualNewCustomerRevenue: sumKnown(days, (day) => day.actual_new_customer_revenue),
    actualReturningRevenue: sumKnown(days, (day) => day.actual_returning_revenue),
    actualAdSpend,
    actualOrders: sumKnown(days, (day) => day.actual_orders),
    actualNewCustomers: sumKnown(days, (day) => day.actual_new_customers),
    actualReturningOrders: sumKnown(days, (day) => day.actual_returning_orders),
    actualLeads: sumKnown(days, (day) => day.actual_leads),
    actualGrossProfit,
    actualContribution: actualContributionExplicit ?? difference(actualGrossProfit, actualAdSpend),
  };
}

function metric(draft: MetricDraft): DailyGrowthMapMetricNode {
  const status = statusFor(draft.direction, draft.target, draft.actual);
  return {
    ...draft,
    variance_vs_target_pct: variancePct(draft.target, draft.actual),
    variance_vs_projection_pct: variancePct(draft.projection, draft.actual),
    status: status.status,
    status_reason: status.reason,
    children_count: 0,
  };
}

function baseMetrics(t: Totals, dayCount: number, actualCoverageRate: number | null): DailyGrowthMapMetricNode[] {
  const targetAov = ratio(t.targetRevenue, t.targetOrders, 2);
  const projectionAov = ratio(t.projectionRevenue, t.projectionOrders, 2);
  const actualAov = ratio(t.actualRevenue, t.actualOrders, 2);

  const drafts: MetricDraft[] = [
    {
      key: "contribution_margin",
      label: "Contribution margin",
      layer: "profit",
      parent_key: null,
      level: 0,
      sort_order: 10,
      unit: "money",
      direction: "higher_is_better",
      target: t.targetContribution,
      projection: t.projectionContribution,
      actual: t.actualContribution,
      formula: "gross_profit - ad_spend",
      source: "daily_pnl_targets.actual_gross_profit + actual_ad_spend",
    },
    {
      key: "contribution_margin_rate",
      label: "Contribution margin rate",
      layer: "profit",
      parent_key: "contribution_margin",
      level: 1,
      sort_order: 20,
      unit: "percent",
      direction: "higher_is_better",
      target: ratio(t.targetContribution, t.targetRevenue),
      projection: ratio(t.projectionContribution, t.projectionRevenue),
      actual: ratio(t.actualContribution, t.actualRevenue),
      formula: "contribution_margin / revenue",
      source: "daily_growth_map derived",
    },
    {
      key: "gross_profit",
      label: "Gross profit",
      layer: "profit",
      parent_key: "contribution_margin",
      level: 1,
      sort_order: 30,
      unit: "money",
      direction: "higher_is_better",
      target: t.targetGrossProfit,
      projection: t.projectionGrossProfit,
      actual: t.actualGrossProfit,
      formula: "revenue - cogs",
      source: "daily_pnl_targets.gross_profit",
    },
    {
      key: "gross_margin_rate",
      label: "Gross margin rate",
      layer: "quality",
      parent_key: "gross_profit",
      level: 2,
      sort_order: 40,
      unit: "percent",
      direction: "higher_is_better",
      target: ratio(t.targetGrossProfit, t.targetRevenue),
      projection: ratio(t.projectionGrossProfit, t.projectionRevenue),
      actual: ratio(t.actualGrossProfit, t.actualRevenue),
      formula: "gross_profit / revenue",
      source: "daily_growth_map derived",
    },
    {
      key: "revenue",
      label: "Revenue",
      layer: "revenue",
      parent_key: "contribution_margin",
      level: 1,
      sort_order: 50,
      unit: "money",
      direction: "higher_is_better",
      target: t.targetRevenue,
      projection: t.projectionRevenue,
      actual: t.actualRevenue,
      formula: "sum revenue",
      source: "daily_pnl_targets + profit_plan_days",
    },
    {
      key: "new_customer_revenue",
      label: "New customer revenue",
      layer: "revenue",
      parent_key: "revenue",
      level: 2,
      sort_order: 60,
      unit: "money",
      direction: "higher_is_better",
      target: t.targetNewCustomerRevenue,
      projection: t.projectionNewCustomerRevenue,
      actual: t.actualNewCustomerRevenue,
      formula: "sum new-customer revenue",
      source: "profit_plan_days target plus optional actual input",
    },
    {
      key: "returning_revenue",
      label: "Returning customer revenue",
      layer: "revenue",
      parent_key: "revenue",
      level: 2,
      sort_order: 70,
      unit: "money",
      direction: "higher_is_better",
      target: t.targetReturningRevenue,
      projection: t.projectionReturningRevenue,
      actual: t.actualReturningRevenue,
      formula: "sum returning-customer revenue",
      source: "profit_plan_days target plus optional actual input",
    },
    {
      key: "ad_spend",
      label: "Ad spend",
      layer: "spend",
      parent_key: "contribution_margin",
      level: 1,
      sort_order: 80,
      unit: "money",
      direction: "lower_is_better",
      target: t.targetAdSpend,
      projection: t.projectionAdSpend,
      actual: t.actualAdSpend,
      formula: "sum ad spend",
      source: "daily_pnl_targets",
    },
    {
      key: "ad_spend_to_revenue_rate",
      label: "Ad spend to revenue rate",
      layer: "efficiency",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 90,
      unit: "percent",
      direction: "lower_is_better",
      target: ratio(t.targetAdSpend, t.targetRevenue),
      projection: ratio(t.projectionAdSpend, t.projectionRevenue),
      actual: ratio(t.actualAdSpend, t.actualRevenue),
      formula: "ad_spend / revenue",
      source: "daily_growth_map derived",
    },
    {
      key: "amr_mer",
      label: "AMR / MER",
      layer: "efficiency",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 100,
      unit: "ratio",
      direction: "higher_is_better",
      target: ratio(t.targetRevenue, t.targetAdSpend, 2),
      projection: ratio(t.projectionRevenue, t.projectionAdSpend, 2),
      actual: ratio(t.actualRevenue, t.actualAdSpend, 2),
      formula: "revenue / ad_spend",
      source: "daily_growth_map derived",
    },
    {
      key: "orders",
      label: "Orders",
      layer: "volume",
      parent_key: "revenue",
      level: 2,
      sort_order: 110,
      unit: "number",
      direction: "higher_is_better",
      target: t.targetOrders,
      projection: t.projectionOrders,
      actual: t.actualOrders,
      formula: "sum orders",
      source: "daily_pnl_targets",
    },
    {
      key: "new_customers",
      label: "New customers",
      layer: "volume",
      parent_key: "orders",
      level: 3,
      sort_order: 120,
      unit: "number",
      direction: "higher_is_better",
      target: t.targetNewCustomers,
      projection: t.projectionNewCustomers,
      actual: t.actualNewCustomers,
      formula: "sum new customers",
      source: "profit_plan_days target plus optional actual input",
    },
    {
      key: "returning_orders",
      label: "Returning orders",
      layer: "volume",
      parent_key: "orders",
      level: 3,
      sort_order: 130,
      unit: "number",
      direction: "higher_is_better",
      target: t.targetReturningOrders,
      projection: t.projectionReturningOrders,
      actual: t.actualReturningOrders,
      formula: "sum returning orders",
      source: "profit_plan_days target plus optional actual input",
    },
    {
      key: "leads",
      label: "Leads",
      layer: "volume",
      parent_key: "revenue",
      level: 2,
      sort_order: 140,
      unit: "number",
      direction: "higher_is_better",
      target: t.targetLeads,
      projection: t.projectionLeads,
      actual: t.actualLeads,
      formula: "sum leads",
      source: "daily_pnl_targets",
    },
    {
      key: "aov",
      label: "Average order value",
      layer: "quality",
      parent_key: "revenue",
      level: 2,
      sort_order: 150,
      unit: "money",
      direction: "higher_is_better",
      target: targetAov,
      projection: projectionAov,
      actual: actualAov,
      formula: "revenue / orders",
      source: "daily_growth_map derived",
    },
    {
      key: "cpa_order",
      label: "CPA per order",
      layer: "efficiency",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 160,
      unit: "money",
      direction: "lower_is_better",
      target: ratio(t.targetAdSpend, t.targetOrders, 2),
      projection: ratio(t.projectionAdSpend, t.projectionOrders, 2),
      actual: ratio(t.actualAdSpend, t.actualOrders, 2),
      formula: "ad_spend / orders",
      source: "daily_growth_map derived",
    },
    {
      key: "blended_cac",
      label: "Blended CAC",
      layer: "efficiency",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 170,
      unit: "money",
      direction: "lower_is_better",
      target: ratio(t.targetAdSpend, t.targetNewCustomers, 2),
      projection: ratio(t.projectionAdSpend, t.projectionNewCustomers, 2),
      actual: ratio(t.actualAdSpend, t.actualNewCustomers, 2),
      formula: "ad_spend / new_customers",
      source: "daily_growth_map derived",
    },
    {
      key: "cpl",
      label: "Cost per lead",
      layer: "efficiency",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 180,
      unit: "money",
      direction: "lower_is_better",
      target: ratio(t.targetAdSpend, t.targetLeads, 2),
      projection: ratio(t.projectionAdSpend, t.projectionLeads, 2),
      actual: ratio(t.actualAdSpend, t.actualLeads, 2),
      formula: "ad_spend / leads",
      source: "daily_growth_map derived",
    },
    {
      key: "revenue_per_lead",
      label: "Revenue per lead",
      layer: "quality",
      parent_key: "leads",
      level: 3,
      sort_order: 190,
      unit: "money",
      direction: "higher_is_better",
      target: ratio(t.targetRevenue, t.targetLeads, 2),
      projection: ratio(t.projectionRevenue, t.projectionLeads, 2),
      actual: ratio(t.actualRevenue, t.actualLeads, 2),
      formula: "revenue / leads",
      source: "daily_growth_map derived",
    },
    {
      key: "lead_to_order_rate",
      label: "Lead to order rate",
      layer: "quality",
      parent_key: "leads",
      level: 3,
      sort_order: 200,
      unit: "percent",
      direction: "higher_is_better",
      target: ratio(t.targetOrders, t.targetLeads),
      projection: ratio(t.projectionOrders, t.projectionLeads),
      actual: ratio(t.actualOrders, t.actualLeads),
      formula: "orders / leads",
      source: "daily_growth_map derived",
    },
    {
      key: "new_customer_mix",
      label: "New customer mix",
      layer: "quality",
      parent_key: "orders",
      level: 3,
      sort_order: 210,
      unit: "percent",
      direction: "neutral",
      target: ratio(t.targetNewCustomers, t.targetOrders),
      projection: ratio(t.projectionNewCustomers, t.projectionOrders),
      actual: ratio(t.actualNewCustomers, t.actualOrders),
      formula: "new_customers / orders",
      source: "daily_growth_map derived",
    },
    {
      key: "returning_revenue_mix",
      label: "Returning revenue mix",
      layer: "quality",
      parent_key: "revenue",
      level: 2,
      sort_order: 220,
      unit: "percent",
      direction: "neutral",
      target: ratio(t.targetReturningRevenue, t.targetRevenue),
      projection: ratio(t.projectionReturningRevenue, t.projectionRevenue),
      actual: ratio(t.actualReturningRevenue, t.actualRevenue),
      formula: "returning_revenue / revenue",
      source: "daily_growth_map derived",
    },
    {
      key: "gross_profit_per_order",
      label: "Gross profit per order",
      layer: "quality",
      parent_key: "gross_profit",
      level: 2,
      sort_order: 230,
      unit: "money",
      direction: "higher_is_better",
      target: ratio(t.targetGrossProfit, t.targetOrders, 2),
      projection: ratio(t.projectionGrossProfit, t.projectionOrders, 2),
      actual: ratio(t.actualGrossProfit, t.actualOrders, 2),
      formula: "gross_profit / orders",
      source: "daily_growth_map derived",
    },
    {
      key: "contribution_per_order",
      label: "Contribution per order",
      layer: "quality",
      parent_key: "contribution_margin",
      level: 1,
      sort_order: 240,
      unit: "money",
      direction: "higher_is_better",
      target: ratio(t.targetContribution, t.targetOrders, 2),
      projection: ratio(t.projectionContribution, t.projectionOrders, 2),
      actual: ratio(t.actualContribution, t.actualOrders, 2),
      formula: "contribution_margin / orders",
      source: "daily_growth_map derived",
    },
    {
      key: "ad_spend_per_order",
      label: "Ad spend per order",
      layer: "efficiency",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 250,
      unit: "money",
      direction: "lower_is_better",
      target: ratio(t.targetAdSpend, t.targetOrders, 2),
      projection: ratio(t.projectionAdSpend, t.projectionOrders, 2),
      actual: ratio(t.actualAdSpend, t.actualOrders, 2),
      formula: "ad_spend / orders",
      source: "daily_growth_map derived",
    },
    {
      key: "revenue_per_day",
      label: "Revenue per day",
      layer: "pacing",
      parent_key: "revenue",
      level: 2,
      sort_order: 260,
      unit: "money",
      direction: "higher_is_better",
      target: ratio(t.targetRevenue, dayCount, 2),
      projection: ratio(t.projectionRevenue, dayCount, 2),
      actual: ratio(t.actualRevenue, dayCount, 2),
      formula: "revenue / selected days",
      source: "daily_growth_map derived",
    },
    {
      key: "spend_per_day",
      label: "Spend per day",
      layer: "pacing",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 270,
      unit: "money",
      direction: "lower_is_better",
      target: ratio(t.targetAdSpend, dayCount, 2),
      projection: ratio(t.projectionAdSpend, dayCount, 2),
      actual: ratio(t.actualAdSpend, dayCount, 2),
      formula: "ad_spend / selected days",
      source: "daily_growth_map derived",
    },
    {
      key: "orders_per_day",
      label: "Orders per day",
      layer: "pacing",
      parent_key: "orders",
      level: 3,
      sort_order: 280,
      unit: "number",
      direction: "higher_is_better",
      target: ratio(t.targetOrders, dayCount, 2),
      projection: ratio(t.projectionOrders, dayCount, 2),
      actual: ratio(t.actualOrders, dayCount, 2),
      formula: "orders / selected days",
      source: "daily_growth_map derived",
    },
    {
      key: "leads_per_day",
      label: "Leads per day",
      layer: "pacing",
      parent_key: "leads",
      level: 3,
      sort_order: 290,
      unit: "number",
      direction: "higher_is_better",
      target: ratio(t.targetLeads, dayCount, 2),
      projection: ratio(t.projectionLeads, dayCount, 2),
      actual: ratio(t.actualLeads, dayCount, 2),
      formula: "leads / selected days",
      source: "daily_growth_map derived",
    },
    {
      key: "gross_profit_per_day",
      label: "Gross profit per day",
      layer: "pacing",
      parent_key: "gross_profit",
      level: 2,
      sort_order: 300,
      unit: "money",
      direction: "higher_is_better",
      target: ratio(t.targetGrossProfit, dayCount, 2),
      projection: ratio(t.projectionGrossProfit, dayCount, 2),
      actual: ratio(t.actualGrossProfit, dayCount, 2),
      formula: "gross_profit / selected days",
      source: "daily_growth_map derived",
    },
    {
      key: "contribution_per_day",
      label: "Contribution per day",
      layer: "pacing",
      parent_key: "contribution_margin",
      level: 1,
      sort_order: 310,
      unit: "money",
      direction: "higher_is_better",
      target: ratio(t.targetContribution, dayCount, 2),
      projection: ratio(t.projectionContribution, dayCount, 2),
      actual: ratio(t.actualContribution, dayCount, 2),
      formula: "contribution_margin / selected days",
      source: "daily_growth_map derived",
    },
    {
      key: "target_revenue_gap",
      label: "Remaining revenue gap vs target",
      layer: "pacing",
      parent_key: "revenue",
      level: 2,
      sort_order: 320,
      unit: "money",
      direction: "lower_is_better",
      target: 0,
      projection: null,
      actual: remainingGap(t.targetRevenue, t.actualRevenue),
      formula: "max(0, target_revenue - actual_revenue)",
      source: "daily_growth_map derived",
    },
    {
      key: "target_spend_gap",
      label: "Remaining spend room vs target",
      layer: "pacing",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 330,
      unit: "money",
      direction: "neutral",
      target: 0,
      projection: null,
      actual: remainingGap(t.targetAdSpend, t.actualAdSpend),
      formula: "max(0, target_ad_spend - actual_ad_spend)",
      source: "daily_growth_map derived",
    },
    {
      key: "target_orders_gap",
      label: "Remaining orders gap vs target",
      layer: "pacing",
      parent_key: "orders",
      level: 3,
      sort_order: 340,
      unit: "number",
      direction: "lower_is_better",
      target: 0,
      projection: null,
      actual: remainingGap(t.targetOrders, t.actualOrders),
      formula: "max(0, target_orders - actual_orders)",
      source: "daily_growth_map derived",
    },
    {
      key: "target_leads_gap",
      label: "Remaining leads gap vs target",
      layer: "pacing",
      parent_key: "leads",
      level: 3,
      sort_order: 350,
      unit: "number",
      direction: "lower_is_better",
      target: 0,
      projection: null,
      actual: remainingGap(t.targetLeads, t.actualLeads),
      formula: "max(0, target_leads - actual_leads)",
      source: "daily_growth_map derived",
    },
    {
      key: "projected_revenue_gap",
      label: "Revenue gap vs projection",
      layer: "pacing",
      parent_key: "revenue",
      level: 2,
      sort_order: 360,
      unit: "money",
      direction: "higher_is_better",
      target: 0,
      projection: null,
      actual: projectionGap(t.actualRevenue, t.projectionRevenue),
      formula: "actual_revenue - projection_revenue",
      source: "daily_growth_map derived",
    },
    {
      key: "projected_spend_gap",
      label: "Spend gap vs projection",
      layer: "pacing",
      parent_key: "ad_spend",
      level: 2,
      sort_order: 370,
      unit: "money",
      direction: "lower_is_better",
      target: 0,
      projection: null,
      actual: projectionGap(t.actualAdSpend, t.projectionAdSpend),
      formula: "actual_ad_spend - projection_ad_spend",
      source: "daily_growth_map derived",
    },
    {
      key: "actual_coverage_rate",
      label: "Actual coverage rate",
      layer: "coverage",
      parent_key: null,
      level: 0,
      sort_order: 380,
      unit: "percent",
      direction: "higher_is_better",
      target: 1,
      projection: null,
      actual: actualCoverageRate,
      formula: "days with any actual / selected days",
      source: "daily_pnl_targets actual fields",
    },
    {
      key: "revenue_actual_coverage_days",
      label: "Revenue actual days",
      layer: "coverage",
      parent_key: "actual_coverage_rate",
      level: 1,
      sort_order: 390,
      unit: "days",
      direction: "higher_is_better",
      target: dayCount,
      projection: null,
      actual: null,
      formula: "count actual_revenue days",
      source: "daily_pnl_targets.actual_revenue",
    },
    {
      key: "spend_actual_coverage_days",
      label: "Spend actual days",
      layer: "coverage",
      parent_key: "actual_coverage_rate",
      level: 1,
      sort_order: 400,
      unit: "days",
      direction: "higher_is_better",
      target: dayCount,
      projection: null,
      actual: null,
      formula: "count actual_ad_spend days",
      source: "daily_pnl_targets.actual_ad_spend",
    },
    {
      key: "order_actual_coverage_days",
      label: "Order actual days",
      layer: "coverage",
      parent_key: "actual_coverage_rate",
      level: 1,
      sort_order: 410,
      unit: "days",
      direction: "higher_is_better",
      target: dayCount,
      projection: null,
      actual: null,
      formula: "count actual_orders days",
      source: "daily_pnl_targets.actual_orders",
    },
    {
      key: "lead_actual_coverage_days",
      label: "Lead actual days",
      layer: "coverage",
      parent_key: "actual_coverage_rate",
      level: 1,
      sort_order: 420,
      unit: "days",
      direction: "higher_is_better",
      target: dayCount,
      projection: null,
      actual: null,
      formula: "count actual_leads days",
      source: "daily_pnl_targets.actual_leads",
    },
  ];

  return drafts.map(metric);
}

function setCoverageActuals(metrics: DailyGrowthMapMetricNode[], days: DailyGrowthMapDailyInput[]): void {
  const byKey = new Map(metrics.map((item) => [item.key, item]));
  const coverage = [
    ["revenue_actual_coverage_days", countKnown(days, (day) => day.actual_revenue)],
    ["spend_actual_coverage_days", countKnown(days, (day) => day.actual_ad_spend)],
    ["order_actual_coverage_days", countKnown(days, (day) => day.actual_orders)],
    ["lead_actual_coverage_days", countKnown(days, (day) => day.actual_leads)],
  ] as const;

  for (const [key, actual] of coverage) {
    const current = byKey.get(key);
    if (!current) continue;
    const rebuilt = metric({ ...current, actual });
    Object.assign(current, rebuilt);
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function aggregateCampaignMetrics(campaignDays: DailyGrowthMapCampaignDayInput[]): DailyGrowthMapMetricNode[] {
  if (campaignDays.length === 0) return [];

  const rootTarget = sumKnown(campaignDays, (row) => row.target_spend);
  const rootActual = sumKnown(campaignDays, (row) => row.actual_spend);
  const metrics: DailyGrowthMapMetricNode[] = [
    metric({
      key: "channel_campaign_execution",
      label: "Channel and campaign execution",
      layer: "channel",
      parent_key: null,
      level: 0,
      sort_order: 500,
      unit: "money",
      direction: "lower_is_better",
      target: rootTarget,
      projection: rootTarget,
      actual: rootActual,
      formula: "sum campaign target spend and actual spend",
      source: "profit_plan.sources.campaign_daily_plan + gos_campaign_daily_perf",
    }),
  ];

  const byChannel = new Map<string, DailyGrowthMapCampaignDayInput[]>();
  for (const row of campaignDays) {
    const key = row.channel_name || row.platform || "Unassigned channel";
    byChannel.set(key, [...(byChannel.get(key) ?? []), row]);
  }

  let channelIndex = 0;
  byChannel.forEach((rows, channelName) => {
    const channelKey = `channel_${slug(channelName)}`;
    const targetSpend = sumKnown(rows, (row) => row.target_spend);
    const actualSpend = sumKnown(rows, (row) => row.actual_spend);
    const targetRevenue = sumKnown(rows, (row) => row.platform_revenue_required);
    const actualRevenue = sumKnown(rows, (row) => row.actual_revenue);
    const targetConversions = sumKnown(rows, (row) => row.platform_conversions_required);
    const actualOrders = sumKnown(rows, (row) => row.actual_orders);

    metrics.push(metric({
      key: `${channelKey}_spend`,
      label: `${channelName} spend`,
      layer: "channel",
      parent_key: "channel_campaign_execution",
      level: 1,
      sort_order: 510 + channelIndex * 100,
      unit: "money",
      direction: "lower_is_better",
      target: targetSpend,
      projection: targetSpend,
      actual: actualSpend,
      formula: "sum channel campaign target spend",
      source: "campaign_daily_plan.days",
    }));
    metrics.push(metric({
      key: `${channelKey}_platform_revenue`,
      label: `${channelName} platform revenue required`,
      layer: "channel",
      parent_key: `${channelKey}_spend`,
      level: 2,
      sort_order: 520 + channelIndex * 100,
      unit: "money",
      direction: "higher_is_better",
      target: targetRevenue,
      projection: targetRevenue,
      actual: actualRevenue,
      formula: "target_spend x required_platform_amr",
      source: "campaign_daily_plan.days",
    }));
    metrics.push(metric({
      key: `${channelKey}_conversions`,
      label: `${channelName} platform conversions required`,
      layer: "channel",
      parent_key: `${channelKey}_spend`,
      level: 2,
      sort_order: 530 + channelIndex * 100,
      unit: "number",
      direction: "higher_is_better",
      target: targetConversions,
      projection: targetConversions,
      actual: actualOrders,
      formula: "target_spend / required_platform_cac",
      source: "campaign_daily_plan.days",
    }));
    metrics.push(metric({
      key: `${channelKey}_required_amr`,
      label: `${channelName} required platform AMR`,
      layer: "channel",
      parent_key: `${channelKey}_spend`,
      level: 2,
      sort_order: 540 + channelIndex * 100,
      unit: "ratio",
      direction: "higher_is_better",
      target: ratio(targetRevenue, targetSpend, 2),
      projection: ratio(targetRevenue, targetSpend, 2),
      actual: ratio(actualRevenue, actualSpend, 2),
      formula: "platform revenue / spend",
      source: "campaign_daily_plan.days + gos_campaign_daily_perf",
    }));

    const byCampaign = new Map<string, DailyGrowthMapCampaignDayInput[]>();
    for (const row of rows) {
      const key = row.campaign_id || row.campaign_name || "Unassigned campaign";
      byCampaign.set(key, [...(byCampaign.get(key) ?? []), row]);
    }

    let campaignIndex = 0;
    byCampaign.forEach((campaignRows) => {
      const campaign = campaignRows[0];
      const campaignName = campaign.campaign_name || "Unassigned campaign";
      const campaignKey = `${channelKey}_campaign_${slug(campaign.campaign_id || campaignName)}`;
      const campaignTargetSpend = sumKnown(campaignRows, (row) => row.target_spend);
      const campaignActualSpend = sumKnown(campaignRows, (row) => row.actual_spend);
      const campaignTargetRevenue = sumKnown(campaignRows, (row) => row.platform_revenue_required);
      const campaignActualRevenue = sumKnown(campaignRows, (row) => row.actual_revenue);

      metrics.push(metric({
        key: `${campaignKey}_spend`,
        label: `${campaignName} spend`,
        layer: "campaign",
        parent_key: `${channelKey}_spend`,
        level: 2,
        sort_order: 550 + channelIndex * 100 + campaignIndex * 10,
        unit: "money",
        direction: "lower_is_better",
        target: campaignTargetSpend,
        projection: campaignTargetSpend,
        actual: campaignActualSpend,
        formula: "sum campaign target spend",
        source: "campaign_daily_plan.days",
      }));
      metrics.push(metric({
        key: `${campaignKey}_amr`,
        label: `${campaignName} AMR`,
        layer: "campaign",
        parent_key: `${campaignKey}_spend`,
        level: 3,
        sort_order: 551 + channelIndex * 100 + campaignIndex * 10,
        unit: "ratio",
        direction: "higher_is_better",
        target: ratio(campaignTargetRevenue, campaignTargetSpend, 2),
        projection: ratio(campaignTargetRevenue, campaignTargetSpend, 2),
        actual: ratio(campaignActualRevenue, campaignActualSpend, 2),
        formula: "campaign platform revenue / campaign spend",
        source: "campaign_daily_plan.days + gos_campaign_daily_perf",
      }));
      campaignIndex += 1;
    });

    channelIndex += 1;
  });

  return metrics;
}

function assignChildren(metrics: DailyGrowthMapMetricNode[]): DailyGrowthMapMetricNode[] {
  const counts = new Map<string, number>();
  metrics.forEach((metricNode) => {
    if (!metricNode.parent_key) return;
    counts.set(metricNode.parent_key, (counts.get(metricNode.parent_key) ?? 0) + 1);
  });
  return metrics
    .map((metricNode) => ({ ...metricNode, children_count: counts.get(metricNode.key) ?? 0 }))
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function buildDailyGrowthMap(input: DailyGrowthMapInput): DailyGrowthMapOutput {
  const window = resolveWindow(input);
  const days = input.days.filter((day) => {
    const date = parseDate(day.target_date);
    return date ? inWindow(date, window) : false;
  });
  const campaignDays = (input.campaign_days ?? []).filter((day) => {
    const date = parseDate(day.plan_date);
    return date ? inWindow(date, window) : false;
  });
  const totals = buildTotals(days);
  const actualDays = days.filter((day) => (
    finite(day.actual_revenue) !== null
    || finite(day.actual_ad_spend) !== null
    || finite(day.actual_orders) !== null
    || finite(day.actual_leads) !== null
    || finite(day.actual_gross_profit) !== null
  )).length;
  const actualCoverageRate = window.day_count > 0 ? rounded(actualDays / window.day_count, 4) : null;
  const metrics = baseMetrics(totals, Math.max(1, window.day_count), actualCoverageRate);
  setCoverageActuals(metrics, days);
  const allMetrics = assignChildren([...metrics, ...aggregateCampaignMetrics(campaignDays)]);
  const missingData: string[] = [];
  const risks: string[] = [];
  const conditions: string[] = [
    "Daily Growth Map is derived. Source truth remains daily P&L rows, Profit Plan rows, and campaign performance rows.",
  ];

  if (input.days.length === 0) missingData.push("daily_pnl_targets");
  if (days.length === 0) missingData.push("selected_period.daily_rows");
  if (totals.actualGrossProfit === null && totals.actualRevenue !== null) {
    missingData.push("actual_gross_profit");
    risks.push("Contribution margin cannot be fully verified without actual gross profit.");
  }
  if (totals.actualNewCustomerRevenue === null && totals.targetNewCustomerRevenue !== null) {
    missingData.push("actual_new_customer_revenue");
  }
  if (totals.actualReturningRevenue === null && totals.targetReturningRevenue !== null) {
    missingData.push("actual_returning_revenue");
  }
  if (campaignDays.length === 0) {
    missingData.push("campaign_daily_plan");
    conditions.push("Run a Profit Plan with channel allocation and campaign daily planning to populate channel and campaign nodes.");
  }
  if (actualCoverageRate !== null && actualCoverageRate < 0.5) {
    risks.push("Less than 50% of selected days have actuals.");
  }

  const missingMetricCount = allMetrics.filter((item) => item.status === "MISSING").length;
  const badMetricCount = allMetrics.filter((item) => item.status === "BAD").length;
  const watchMetricCount = allMetrics.filter((item) => item.status === "WATCH").length;
  const root = allMetrics.find((item) => item.key === "contribution_margin");
  const rootStatus = root?.status ?? (missingMetricCount > 0 ? "MISSING" : "GOOD");
  const channelMetricCount = allMetrics.filter((item) => item.layer === "channel").length;
  const campaignMetricCount = allMetrics.filter((item) => item.layer === "campaign").length;

  return {
    engine_version: DAILY_GROWTH_MAP_ENGINE_VERSION,
    client_id: input.client_id,
    window: {
      ...window,
      day_count: window.day_count,
    },
    metrics: allMetrics,
    portfolio: {
      metric_count: allMetrics.length,
      base_metric_count: metrics.length,
      channel_metric_count: channelMetricCount,
      campaign_metric_count: campaignMetricCount,
      actual_coverage_rate: actualCoverageRate,
      missing_metric_count: missingMetricCount,
      bad_metric_count: badMetricCount,
      watch_metric_count: watchMetricCount,
      root_status: rootStatus,
    },
    assumptions: {
      hierarchy: "contribution margin -> revenue/ad spend/gross profit -> volume/efficiency/pacing -> channel -> campaign",
      contribution_formula: "contribution margin uses gross profit minus ad spend; it stays missing when actual gross profit is missing.",
      campaign_formula: "campaign daily plan targets are joined to campaign daily performance actuals by campaign id and date.",
      status_formula: "higher-is-better metrics are bad below -10%; lower-is-better metrics invert the variance test.",
    },
    missing_data: unique(missingData),
    risks: unique(risks),
    conditions: unique(conditions),
    summary: `Daily Growth Map v1 - ${allMetrics.length} metrics - ${window.period_start ?? "n/a"} to ${window.period_end ?? "n/a"} - root ${rootStatus}.`,
  };
}
