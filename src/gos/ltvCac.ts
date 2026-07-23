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

// ---------------------------------------------------------------------------
// Recurring-revenue layer (SaaS + Agence)
// ---------------------------------------------------------------------------
//
// LTV math changes shape for recurring models. Instead of AOV × repeat rate ×
// horizon, we take ARPA × gross margin ÷ monthly churn (i.e. the geometric
// series limit that assumes constant churn). Onboarding cost per logo is
// baked into CAC because it's real acquisition cost even though it lives on
// the delivery side of the ledger.
//
// One shared implementation covers both SaaS ("Average Revenue Per Account")
// and agencies ("average monthly retainer"). Semantics are identical from
// the math's perspective — only the labels differ.

export type RecurringLtvCacInput = {
  arpa: number | null;                // SaaS ARPA or Agence monthly retainer
  gross_margin_pct: number | null;    // recurring gross margin (SaaS ~80%, Agence 40–60%)
  churn_monthly_pct: number | null;   // % of paying customers lost per month
  ad_spend: number | null;
  new_customers: number | null;       // new paying logos in the period
  onboarding_cost?: number | null;    // one-off delivery cost per new logo (optional)
  horizon_months?: number | null;     // cap the geometric series here (default 36)
};

export type RecurringLtvCacOutput = {
  cac: number | null;                         // (ad_spend + onboarding*n) / n
  average_customer_lifetime_months: number | null; // 1 / churn
  monthly_contribution: number | null;        // arpa * margin
  predicted_ltv: number | null;               // capped by horizon
  ltv_cac_ratio: number | null;
  payback_months: number | null;              // cac / monthly_contribution
  confidence_score: number;
  warnings: string[];
  missing_data: string[];
};

export function computeRecurringLtvCac(input: RecurringLtvCacInput): RecurringLtvCacOutput {
  const missing_data: string[] = [];
  const warnings: string[] = [];

  const arpa = positive(input.arpa);
  const marginRate = rate(input.gross_margin_pct, 0);
  const churnRate = rate(input.churn_monthly_pct, 0);
  const adSpend = toNumber(input.ad_spend) ?? 0;
  const newCustomers = positive(input.new_customers);
  const onboardingCost = toNumber(input.onboarding_cost) ?? 0;
  const horizonMonths = Math.max(1, Math.round(positive(input.horizon_months) ?? 36));

  if (!arpa) missing_data.push("arpa");
  if (marginRate.lte(0)) missing_data.push("gross_margin_pct");
  if (churnRate.lte(0)) missing_data.push("churn_monthly_pct");
  if (!newCustomers) missing_data.push("new_customers");

  const monthlyContribution = arpa ? new Decimal(arpa).times(marginRate) : null;

  // Lifetime = 1/churn, capped at horizon. If churn is 0, lifetime is unbounded — use horizon.
  const lifetimeMonths: Decimal | null = churnRate.gt(0)
    ? Decimal.min(new Decimal(1).div(churnRate), horizonMonths)
    : new Decimal(horizonMonths);

  const predictedLtv = monthlyContribution && lifetimeMonths
    ? monthlyContribution.times(lifetimeMonths)
    : null;

  const totalAcqSpend = new Decimal(adSpend).plus(new Decimal(onboardingCost).times(newCustomers ?? 0));
  const cac = newCustomers && totalAcqSpend.gt(0)
    ? totalAcqSpend.div(newCustomers)
    : null;

  const ltvCacRatio = predictedLtv && cac ? safeRatio(predictedLtv, cac, 2) : null;
  const payback = cac && monthlyContribution && monthlyContribution.gt(0)
    ? safeRatio(cac, monthlyContribution, 1)
    : null;

  if (churnRate.gte(0.5)) warnings.push("Monthly churn ≥ 50% — LTV formula becomes unreliable.");
  if (marginRate.lt(0.3)) warnings.push("Gross margin < 30% — unusual for a recurring model, double-check the input.");

  const confidence = Math.max(0, Math.min(100,
    (arpa ? 25 : 0) +
    (churnRate.gt(0) && churnRate.lt(0.3) ? 25 : 5) +
    (marginRate.gt(0) ? 20 : 0) +
    (newCustomers ? Math.min(30, newCustomers * 3) : 0)
  ));

  return {
    cac: cac ? round(cac, 2) : null,
    average_customer_lifetime_months: lifetimeMonths ? round(lifetimeMonths, 1) : null,
    monthly_contribution: monthlyContribution ? round(monthlyContribution, 2) : null,
    predicted_ltv: predictedLtv ? round(predictedLtv, 2) : null,
    ltv_cac_ratio: ltvCacRatio,
    payback_months: payback,
    confidence_score: round(confidence, 1),
    warnings,
    missing_data,
  };
}

// Small helper for a 3-month MRR waterfall used by the Lot C mini-forecast.
// Given a starting MRR, expected net-new MRR per month (new − churn +
// expansion), returns the projected MRR at each month plus a simple total.
export type MrrWaterfallInput = {
  starting_mrr: number;
  net_new_mrr_monthly: number;
  months: number;
};
export type MrrWaterfallOutput = {
  timeline: Array<{ month: number; mrr: number }>;
  ending_mrr: number;
  cumulative_delta: number;
};

export function computeMrrWaterfall({ starting_mrr, net_new_mrr_monthly, months }: MrrWaterfallInput): MrrWaterfallOutput {
  const timeline: Array<{ month: number; mrr: number }> = [];
  let mrr = new Decimal(starting_mrr);
  for (let i = 1; i <= Math.max(1, Math.round(months)); i++) {
    mrr = mrr.plus(net_new_mrr_monthly);
    timeline.push({ month: i, mrr: round(mrr, 2) });
  }
  const ending = timeline[timeline.length - 1]?.mrr ?? starting_mrr;
  return {
    timeline,
    ending_mrr: ending,
    cumulative_delta: round(new Decimal(ending).minus(starting_mrr), 2),
  };
}
