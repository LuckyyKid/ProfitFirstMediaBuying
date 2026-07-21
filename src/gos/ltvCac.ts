import Decimal from "decimal.js";

export type PredictiveLtvCacInput = {
  horizon_months?: number | null;
  new_customers?: number | null;
  ad_spend?: number | null;
  avg_order_value?: number | null;
  gross_margin_pct?: number | null;
  repeat_rate_pct?: number | null;
  purchase_frequency?: number | null;
  churn_rate_pct?: number | null;
  model_notes?: string | null;
};

export type PredictiveLtvCacOutput = {
  cac: number | null;
  predicted_ltv: number | null;
  ltv_cac_ratio: number | null;
  payback_months: number | null;
  contribution_margin: number | null;
  confidence_score: number;
  model_notes: string | null;
  warnings: string[];
  missing_data: string[];
};

const ROUNDING = Decimal.ROUND_HALF_UP;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n > 0 ? n : null;
}

function rate(value: unknown, fallback = 0): Decimal {
  const n = toNumber(value);
  if (n === null || n < 0) return new Decimal(fallback);
  return n > 1 ? new Decimal(n).div(100) : new Decimal(n);
}

function round(value: Decimal.Value, dp = 2): number {
  return new Decimal(value).toDecimalPlaces(dp, ROUNDING).toNumber();
}

function safeRatio(numerator: Decimal, denominator: Decimal, dp = 2): number | null {
  if (denominator.lte(0)) return null;
  return round(numerator.div(denominator), dp);
}

export function computePredictiveLtvCac(input: PredictiveLtvCacInput): PredictiveLtvCacOutput {
  const missing_data: string[] = [];
  const warnings: string[] = [];

  const newCustomers = positive(input.new_customers);
  const adSpend = positive(input.ad_spend);
  const aov = positive(input.avg_order_value);
  const grossMarginRate = rate(input.gross_margin_pct, 0);
  const repeatRate = rate(input.repeat_rate_pct, 0);
  const purchaseFrequency = new Decimal(positive(input.purchase_frequency) ?? 0);
  const churnRate = rate(input.churn_rate_pct, 0);
  const horizonMonths = Math.max(1, Math.round(positive(input.horizon_months) ?? 12));

  if (!newCustomers) missing_data.push("new_customers");
  if (!adSpend) missing_data.push("ad_spend");
  if (!aov) missing_data.push("avg_order_value");
  if (grossMarginRate.lte(0)) missing_data.push("gross_margin_pct");

  const cac = newCustomers && adSpend ? new Decimal(adSpend).div(newCustomers) : null;
  const grossContributionPerOrder = aov ? new Decimal(aov).times(grossMarginRate) : null;

  let predictedLtv: Decimal | null = null;
  let monthlyContribution: Decimal | null = null;
  let contributionMargin: Decimal | null = null;

  if (grossContributionPerOrder) {
    const effectiveMonths = churnRate.gt(0)
      ? Decimal.min(new Decimal(1).div(churnRate), horizonMonths)
      : new Decimal(horizonMonths);
    const repeatOrders = purchaseFrequency.times(repeatRate).times(effectiveMonths);
    predictedLtv = grossContributionPerOrder.times(new Decimal(1).plus(repeatOrders));
    monthlyContribution = predictedLtv.div(horizonMonths);
    contributionMargin = cac ? predictedLtv.minus(cac) : null;
  }

  if (repeatRate.lte(0)) warnings.push("repeat_rate_pct is 0 or missing; LTV uses first-order contribution only.");
  if (purchaseFrequency.lte(0)) warnings.push("purchase_frequency is 0 or missing; repeat contribution is ignored.");

  const ltvCacRatio = predictedLtv && cac ? safeRatio(predictedLtv, cac, 2) : null;
  const payback = cac && monthlyContribution && monthlyContribution.gt(0) ? safeRatio(cac, monthlyContribution, 1) : null;

  const confidence = Math.max(0, Math.min(100,
    (newCustomers ? Math.min(40, (newCustomers / 100) * 40) : 0) +
    (churnRate.gt(0) && churnRate.lt(0.5) ? 20 : 8) +
    (aov ? 15 : 0) +
    (grossMarginRate.gt(0) ? 15 : 0) +
    (repeatRate.gt(0) ? 10 : 0)
  ));

  const generatedNotes = [
    input.model_notes?.trim(),
    warnings.length ? `Warnings: ${warnings.join(" | ")}` : null,
    missing_data.length ? `Missing data: ${missing_data.join(" | ")}` : null,
  ].filter(Boolean).join("\n") || null;

  return {
    cac: cac ? round(cac, 2) : null,
    predicted_ltv: predictedLtv ? round(predictedLtv, 2) : null,
    ltv_cac_ratio: ltvCacRatio,
    payback_months: payback,
    contribution_margin: contributionMargin ? round(contributionMargin, 2) : null,
    confidence_score: round(confidence, 1),
    model_notes: generatedNotes,
    warnings,
    missing_data,
  };
}
