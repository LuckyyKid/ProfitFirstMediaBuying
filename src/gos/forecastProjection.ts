import Decimal from "decimal.js";

export const SCENARIO_FACTORS = {
  BASE: 1,
  UPSIDE: 1.2,
  DOWNSIDE: 0.8,
} as const;

export type ForecastScenario = keyof typeof SCENARIO_FACTORS;

type AnyRecord = Record<string, unknown> | null | undefined;

export type ForecastProjectionInput = {
  client: AnyRecord;
  financialInputs: AnyRecord;
  quantitativeBaseline: AnyRecord;
  scenario: ForecastScenario | string;
  horizonDays: number;
};

export type ForecastProjection = {
  projected_revenue: number;
  projected_orders: number | null;
  projected_leads: number | null;
  projected_ad_spend: number;
  projected_cac: number | null;
  projected_mer: number | null;
  projected_roas: number | null;
  projected_gross_profit: number;
  assumptions: {
    scenario_factor: number;
    formula: string;
    warnings: string[];
    missing_data: string[];
    gross_margin_rate: number;
    contribution_margin_after_ads: number;
    [key: string]: unknown;
  };
};

const ROUNDING = Decimal.ROUND_HALF_UP;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function read(source: AnyRecord, key: string): number | null {
  if (!source || typeof source !== "object") return null;
  return toNumber(source[key]);
}

function positive(source: AnyRecord, key: string): number | null {
  const value = read(source, key);
  return value !== null && value > 0 ? value : null;
}

function positiveFirst(source: AnyRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = positive(source, key);
    if (value !== null) return value;
  }
  return null;
}

function rateFromPercent(value: number | null, fallback = 0): Decimal {
  if (value === null || value < 0) return new Decimal(fallback);
  return value > 1 ? new Decimal(value).div(100) : new Decimal(value);
}

function round(value: Decimal.Value, dp = 0): number {
  return new Decimal(value).toDecimalPlaces(dp, ROUNDING).toNumber();
}

function safeRatio(numerator: Decimal, denominator: Decimal, dp = 2): number | null {
  if (denominator.lte(0)) return null;
  return round(numerator.div(denominator), dp);
}

function spendForHorizon(qb: AnyRecord, horizonDays: number, scenario: string): Decimal {
  const factor = SCENARIO_FACTORS[scenario as ForecastScenario] ?? 1;
  const dailySpend = new Decimal(positive(qb, "ad_spend_30d") ?? 0).div(30);
  return dailySpend.times(Math.max(1, Math.round(horizonDays))).times(factor);
}

function platformRoas(qb: AnyRecord): number | null {
  const spend = positive(qb, "ad_spend_30d");
  const platformRevenue = positiveFirst(qb, ["platform_revenue_30d", "attributed_revenue_30d"]);
  if (!spend || !platformRevenue) return null;
  return round(new Decimal(platformRevenue).div(spend), 2);
}

export function projectGrowthScenario(input: ForecastProjectionInput): ForecastProjection {
  const businessType = String(input.client?.business_type ?? "");
  const scenario = String(input.scenario || "BASE");
  return businessType === "LOCAL_SERVICE"
    ? projectLocalService(input, scenario)
    : projectEcommerce(input, scenario);
}

function projectLocalService(input: ForecastProjectionInput, scenario: string): ForecastProjection {
  const fi = input.financialInputs;
  const qb = input.quantitativeBaseline;
  const warnings: string[] = [];
  const missing_data: string[] = [];
  const spend = spendForHorizon(qb, input.horizonDays, scenario);
  const factor = SCENARIO_FACTORS[scenario as ForecastScenario] ?? 1;

  const baselineSpend = positive(qb, "ad_spend_30d");
  const baselineLeads = positive(qb, "leads_30d");
  const baselineCpl = baselineSpend && baselineLeads ? new Decimal(baselineSpend).div(baselineLeads) : null;
  const targetCpl = positive(fi, "target_cpl");
  const cpl = baselineCpl ?? (targetCpl ? new Decimal(targetCpl) : null);
  if (!cpl) missing_data.push("leads_30d/ad_spend_30d or target_cpl");

  const leads = cpl && cpl.gt(0) ? spend.div(cpl).toDecimalPlaces(0, ROUNDING) : new Decimal(0);
  const jobsClosed = positive(qb, "jobs_closed_30d");
  const baselineCloseRate = jobsClosed && baselineLeads ? new Decimal(jobsClosed).div(baselineLeads) : null;
  const closeRate = baselineCloseRate ?? rateFromPercent(read(fi, "target_close_rate"), 0.2);

  const jobs = leads.times(closeRate).toDecimalPlaces(0, ROUNDING);
  const avgJobValue = positive(fi, "avg_job_value") ?? positive(fi, "aov") ?? 0;
  if (!positive(fi, "avg_job_value")) warnings.push("avg_job_value missing; fallback to aov or 0.");

  const revenue = jobs.times(avgJobValue);
  const grossMarginRate = rateFromPercent(read(fi, "gross_margin_percent"), 0);
  if (grossMarginRate.lte(0)) missing_data.push("gross_margin_percent");
  const grossProfit = revenue.times(grossMarginRate);
  const contributionMargin = grossProfit.minus(spend);

  return {
    projected_revenue: round(revenue, 0),
    projected_leads: round(leads, 0),
    projected_orders: round(jobs, 0),
    projected_ad_spend: round(spend, 0),
    projected_cac: safeRatio(spend, jobs, 2),
    projected_mer: safeRatio(revenue, spend, 2),
    projected_roas: platformRoas(qb),
    projected_gross_profit: round(grossProfit, 0),
    assumptions: {
      scenario_factor: factor,
      cpl: cpl ? round(cpl, 2) : null,
      close_rate: round(closeRate, 4),
      avg_job_value: avgJobValue,
      gross_margin_rate: round(grossMarginRate, 4),
      contribution_margin_after_ads: round(contributionMargin, 0),
      formula: "leads=spend/cpl; jobs=leads*close_rate; revenue=jobs*avg_job_value; gross_profit=revenue*gross_margin",
      warnings,
      missing_data,
    },
  };
}

function projectEcommerce(input: ForecastProjectionInput, scenario: string): ForecastProjection {
  const fi = input.financialInputs;
  const qb = input.quantitativeBaseline;
  const warnings: string[] = [];
  const missing_data: string[] = [];
  const spend = spendForHorizon(qb, input.horizonDays, scenario);
  const factor = SCENARIO_FACTORS[scenario as ForecastScenario] ?? 1;

  const baselineSpend = positive(qb, "ad_spend_30d");
  const baselineOrders = positive(qb, "orders_30d");
  const baselineNewCustomers = positiveFirst(qb, ["new_customers_30d", "first_time_customers_30d"]);
  const baselineRevenue = positiveFirst(qb, ["revenue_30d", "net_revenue_30d"]);

  const historicalCostPerOrder = baselineSpend && baselineOrders ? new Decimal(baselineSpend).div(baselineOrders) : null;
  const targetCac = positive(fi, "target_cac");
  const costPerProjectedOrder = historicalCostPerOrder ?? (targetCac ? new Decimal(targetCac) : null);
  if (!historicalCostPerOrder) warnings.push("orders_30d/ad_spend_30d missing; target_cac used as cost-per-order fallback.");
  if (!costPerProjectedOrder) missing_data.push("orders_30d/ad_spend_30d or target_cac");

  const historicalCac = baselineSpend && baselineNewCustomers ? new Decimal(baselineSpend).div(baselineNewCustomers) : null;
  const cac = historicalCac ?? (targetCac ? new Decimal(targetCac) : null);
  if (!historicalCac) warnings.push("new_customers_30d missing; projected_cac falls back to target_cac when available.");
  if (!cac) missing_data.push("new_customers_30d/ad_spend_30d or target_cac");

  const orders = costPerProjectedOrder && costPerProjectedOrder.gt(0)
    ? spend.div(costPerProjectedOrder).toDecimalPlaces(0, ROUNDING)
    : new Decimal(0);
  const projectedNewCustomers = cac && cac.gt(0) ? spend.div(cac).toDecimalPlaces(0, ROUNDING) : null;
  const aov = positive(fi, "aov") ?? (baselineRevenue && baselineOrders ? new Decimal(baselineRevenue).div(baselineOrders).toNumber() : 0);
  if (!positive(fi, "aov") && !(baselineRevenue && baselineOrders)) missing_data.push("aov or revenue_30d/orders_30d");

  const revenue = orders.times(aov);
  const grossMarginRate = rateFromPercent(read(fi, "gross_margin_percent"), 0);
  if (grossMarginRate.lte(0)) missing_data.push("gross_margin_percent");
  const grossProfit = revenue.times(grossMarginRate);
  const contributionMargin = grossProfit.minus(spend);

  return {
    projected_revenue: round(revenue, 0),
    projected_orders: round(orders, 0),
    projected_leads: null,
    projected_ad_spend: round(spend, 0),
    projected_cac: cac ? round(cac, 2) : null,
    projected_mer: safeRatio(revenue, spend, 2),
    projected_roas: platformRoas(qb),
    projected_gross_profit: round(grossProfit, 0),
    assumptions: {
      scenario_factor: factor,
      historical_cost_per_order: historicalCostPerOrder ? round(historicalCostPerOrder, 2) : null,
      cac: cac ? round(cac, 2) : null,
      projected_new_customers: projectedNewCustomers ? round(projectedNewCustomers, 0) : null,
      aov,
      gross_margin_rate: round(grossMarginRate, 4),
      contribution_margin_after_ads: round(contributionMargin, 0),
      formula: "orders=spend/cost_per_order; revenue=orders*aov; gross_profit=revenue*gross_margin; cac=spend/new_customers",
      warnings,
      missing_data,
    },
  };
}
