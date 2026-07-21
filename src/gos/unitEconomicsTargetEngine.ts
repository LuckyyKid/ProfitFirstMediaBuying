import Decimal from "decimal.js";

export const UNIT_ECONOMICS_TARGET_ENGINE_VERSION = "unit_economics_target_engine_v1" as const;

export type UnitEconomicsOfferInput = {
  offer_id?: string | null;
  offer_name?: string | null;
  sku?: string | null;
  aov?: number | null;
  price?: number | null;
  cogs_per_order?: number | null;
  gross_margin_rate?: number | null;
  gross_margin_percent?: number | null;
  shipping_cost_per_order?: number | null;
  fulfillment_cost_per_order?: number | null;
  payment_fee_rate?: number | null;
  payment_processing_percent?: number | null;
  refund_rate?: number | null;
  refund_rate_percent?: number | null;
  variable_cost_per_order?: number | null;
  variable_cost_rate?: number | null;
  desired_contribution_per_order?: number | null;
  desired_contribution_margin_rate?: number | null;
  expected_orders?: number | null;
  expected_revenue_mix?: number | null;
};

export type UnitEconomicsTargetInput = {
  offers: UnitEconomicsOfferInput[];
  planned_ad_spend?: number | null;
  default_gross_margin_rate?: number | null;
  default_gross_margin_percent?: number | null;
  default_shipping_cost_per_order?: number | null;
  default_fulfillment_cost_per_order?: number | null;
  default_payment_fee_rate?: number | null;
  default_payment_processing_percent?: number | null;
  default_refund_rate?: number | null;
  default_refund_rate_percent?: number | null;
  default_variable_cost_per_order?: number | null;
  default_variable_cost_rate?: number | null;
  default_desired_contribution_per_order?: number | null;
  default_desired_contribution_margin_rate?: number | null;
};

export type UnitEconomicsOfferTarget = {
  offer_id: string | null;
  offer_name: string;
  sku: string | null;
  portfolio_weight: number;
  revenue_per_order: number;
  cogs_per_order: number;
  gross_margin_rate: number;
  gross_profit_per_order: number;
  shipping_cost_per_order: number;
  fulfillment_cost_per_order: number;
  payment_fee_rate: number;
  payment_fee_per_order: number;
  refund_rate: number;
  refund_reserve_per_order: number;
  variable_cost_per_order: number;
  variable_cost_rate: number;
  variable_cost_from_rate_per_order: number;
  contribution_before_ads_per_order: number;
  contribution_before_ads_rate: number;
  desired_contribution_per_order: number;
  desired_contribution_rate: number;
  break_even_cac: number;
  target_cac: number;
  break_even_roas: number | null;
  target_roas: number | null;
  break_even_amr: number | null;
  target_amr: number | null;
  expected_orders: number | null;
  expected_revenue: number | null;
  expected_ad_spend_capacity: number | null;
  expected_contribution_after_ads: number | null;
  missing_data: string[];
  risks: string[];
};

export type UnitEconomicsPortfolioTarget = {
  offer_count: number;
  modeled_offer_count: number;
  weight_source: "expected_orders" | "expected_revenue_mix" | "equal_offer_weight";
  planned_ad_spend: number;
  weighted_revenue_per_order: number;
  weighted_gross_margin_rate: number;
  weighted_contribution_before_ads_per_order: number;
  weighted_contribution_before_ads_rate: number;
  weighted_desired_contribution_per_order: number;
  weighted_break_even_cac: number | null;
  weighted_target_cac: number | null;
  weighted_break_even_roas: number | null;
  weighted_target_roas: number | null;
  weighted_break_even_amr: number | null;
  weighted_target_amr: number | null;
  planned_orders_at_target_cac: number | null;
  planned_revenue_at_target_cac: number | null;
  planned_contribution_after_ads_at_target_cac: number | null;
  expected_orders: number | null;
  expected_revenue: number | null;
  expected_ad_spend_capacity: number | null;
  expected_contribution_after_ads: number | null;
};

export type UnitEconomicsTargetOutput = {
  engine_version: typeof UNIT_ECONOMICS_TARGET_ENGINE_VERSION;
  offers: UnitEconomicsOfferTarget[];
  portfolio: UnitEconomicsPortfolioTarget;
  confidence_score: number;
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type InternalOfferTarget = {
  target: UnitEconomicsOfferTarget;
  order_weight_basis: number | null;
  revenue_mix_weight_basis: number | null;
};

const ROUNDING = Decimal.ROUND_HALF_UP;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(values: unknown[]): number | null {
  for (const value of values) {
    const n = toNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function nonNegativeFrom(values: unknown[], fallback = 0): number {
  const n = firstNumber(values);
  return n !== null && n >= 0 ? n : fallback;
}

function positiveFrom(values: unknown[]): number | null {
  const n = firstNumber(values);
  return n !== null && n > 0 ? n : null;
}

function optionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rateFrom(values: unknown[]): number | null {
  const n = firstNumber(values);
  if (n === null || n < 0) return null;
  return clamp(n > 1 ? n / 100 : n, 0, 1);
}

function round(value: Decimal.Value, dp = 2): number {
  return new Decimal(value).toDecimalPlaces(dp, ROUNDING).toNumber();
}

function ratio(numerator: number, denominator: number, dp = 2): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return round(new Decimal(numerator).div(denominator), dp);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function hasOwnNumber(value: unknown): boolean {
  return toNumber(value) !== null;
}

function resolveDesiredContribution(
  offer: UnitEconomicsOfferInput,
  input: UnitEconomicsTargetInput,
  revenuePerOrder: number,
): { amount: number; rate: number; hasTarget: boolean } {
  const direct = firstNumber([
    offer.desired_contribution_per_order,
    input.default_desired_contribution_per_order,
  ]);
  if (direct !== null && direct >= 0) {
    return {
      amount: round(direct),
      rate: revenuePerOrder > 0 ? round(direct / revenuePerOrder, 4) : 0,
      hasTarget: true,
    };
  }

  const rate = rateFrom([
    offer.desired_contribution_margin_rate,
    input.default_desired_contribution_margin_rate,
  ]);
  if (rate !== null) {
    return {
      amount: round(revenuePerOrder * rate),
      rate: round(rate, 4),
      hasTarget: true,
    };
  }

  return { amount: 0, rate: 0, hasTarget: false };
}

function buildOfferTarget(
  offer: UnitEconomicsOfferInput,
  input: UnitEconomicsTargetInput,
  index: number,
): InternalOfferTarget {
  const prefix = `offers[${index}]`;
  const missingData: string[] = [];
  const risks: string[] = [];
  const offerName = optionalText(offer.offer_name) ?? `Offer ${index + 1}`;
  const revenuePerOrder = positiveFrom([offer.aov, offer.price]) ?? 0;

  if (!optionalText(offer.offer_name)) missingData.push(`${prefix}.offer_name`);
  if (revenuePerOrder <= 0) missingData.push(`${prefix}.aov_or_price`);

  const directCogs = toNumber(offer.cogs_per_order);
  const marginRate = rateFrom([
    offer.gross_margin_rate,
    offer.gross_margin_percent,
    input.default_gross_margin_rate,
    input.default_gross_margin_percent,
  ]);
  let cogsPerOrder: number;
  let grossMarginRate: number;

  if (directCogs !== null && directCogs >= 0) {
    cogsPerOrder = directCogs;
    grossMarginRate = revenuePerOrder > 0 ? (revenuePerOrder - directCogs) / revenuePerOrder : 0;
  } else if (marginRate !== null && revenuePerOrder > 0) {
    cogsPerOrder = revenuePerOrder * (1 - marginRate);
    grossMarginRate = marginRate;
  } else {
    cogsPerOrder = revenuePerOrder;
    grossMarginRate = 0;
    missingData.push(`${prefix}.cogs_per_order_or_gross_margin_rate`);
    risks.push(`${offerName}: missing COGS or gross margin, contribution is set conservatively.`);
  }

  const hasShipping = hasOwnNumber(offer.shipping_cost_per_order)
    || hasOwnNumber(input.default_shipping_cost_per_order);
  const hasFulfillment = hasOwnNumber(offer.fulfillment_cost_per_order)
    || hasOwnNumber(input.default_fulfillment_cost_per_order);
  const hasPaymentFee = hasOwnNumber(offer.payment_fee_rate)
    || hasOwnNumber(offer.payment_processing_percent)
    || hasOwnNumber(input.default_payment_fee_rate)
    || hasOwnNumber(input.default_payment_processing_percent);
  const hasRefundRate = hasOwnNumber(offer.refund_rate)
    || hasOwnNumber(offer.refund_rate_percent)
    || hasOwnNumber(input.default_refund_rate)
    || hasOwnNumber(input.default_refund_rate_percent);

  if (!hasShipping) missingData.push(`${prefix}.shipping_cost_per_order`);
  if (!hasFulfillment) missingData.push(`${prefix}.fulfillment_cost_per_order`);
  if (!hasPaymentFee) missingData.push(`${prefix}.payment_fee_rate`);
  if (!hasRefundRate) missingData.push(`${prefix}.refund_rate`);

  const shippingCost = nonNegativeFrom([
    offer.shipping_cost_per_order,
    input.default_shipping_cost_per_order,
  ]);
  const fulfillmentCost = nonNegativeFrom([
    offer.fulfillment_cost_per_order,
    input.default_fulfillment_cost_per_order,
  ]);
  const paymentFeeRate = rateFrom([
    offer.payment_fee_rate,
    offer.payment_processing_percent,
    input.default_payment_fee_rate,
    input.default_payment_processing_percent,
  ]) ?? 0;
  const refundRate = rateFrom([
    offer.refund_rate,
    offer.refund_rate_percent,
    input.default_refund_rate,
    input.default_refund_rate_percent,
  ]) ?? 0;
  const variableCostPerOrder = nonNegativeFrom([
    offer.variable_cost_per_order,
    input.default_variable_cost_per_order,
  ]);
  const variableCostRate = rateFrom([
    offer.variable_cost_rate,
    input.default_variable_cost_rate,
  ]) ?? 0;
  const paymentFeePerOrder = revenuePerOrder * paymentFeeRate;
  const refundReservePerOrder = revenuePerOrder * refundRate;
  const variableCostFromRate = revenuePerOrder * variableCostRate;
  const grossProfitPerOrder = revenuePerOrder - cogsPerOrder;
  const contributionBeforeAds = revenuePerOrder
    - cogsPerOrder
    - shippingCost
    - fulfillmentCost
    - paymentFeePerOrder
    - refundReservePerOrder
    - variableCostPerOrder
    - variableCostFromRate;
  const desired = resolveDesiredContribution(offer, input, revenuePerOrder);
  const breakEvenCac = Math.max(0, contributionBeforeAds);
  const targetCac = Math.max(0, contributionBeforeAds - desired.amount);
  const expectedOrders = positiveFrom([offer.expected_orders]);
  const expectedRevenue = expectedOrders !== null ? revenuePerOrder * expectedOrders : null;
  const expectedAdSpendCapacity = expectedOrders !== null ? targetCac * expectedOrders : null;
  const expectedContributionAfterAds = expectedOrders !== null
    ? (contributionBeforeAds - targetCac) * expectedOrders
    : null;

  if (!desired.hasTarget) {
    risks.push(`${offerName}: desired contribution target is missing, target CAC equals break-even CAC.`);
  }
  if (grossMarginRate <= 0) risks.push(`${offerName}: gross margin is zero or negative.`);
  if (contributionBeforeAds <= 0) risks.push(`${offerName}: contribution before ads is not positive.`);
  if (targetCac <= 0) risks.push(`${offerName}: target CAC is zero after required contribution.`);

  return {
    target: {
      offer_id: optionalText(offer.offer_id),
      offer_name: offerName,
      sku: optionalText(offer.sku),
      portfolio_weight: 0,
      revenue_per_order: round(revenuePerOrder),
      cogs_per_order: round(cogsPerOrder),
      gross_margin_rate: round(grossMarginRate, 4),
      gross_profit_per_order: round(grossProfitPerOrder),
      shipping_cost_per_order: round(shippingCost),
      fulfillment_cost_per_order: round(fulfillmentCost),
      payment_fee_rate: round(paymentFeeRate, 4),
      payment_fee_per_order: round(paymentFeePerOrder),
      refund_rate: round(refundRate, 4),
      refund_reserve_per_order: round(refundReservePerOrder),
      variable_cost_per_order: round(variableCostPerOrder),
      variable_cost_rate: round(variableCostRate, 4),
      variable_cost_from_rate_per_order: round(variableCostFromRate),
      contribution_before_ads_per_order: round(contributionBeforeAds),
      contribution_before_ads_rate: revenuePerOrder > 0 ? round(contributionBeforeAds / revenuePerOrder, 4) : 0,
      desired_contribution_per_order: round(desired.amount),
      desired_contribution_rate: round(desired.rate, 4),
      break_even_cac: round(breakEvenCac),
      target_cac: round(targetCac),
      break_even_roas: ratio(revenuePerOrder, breakEvenCac),
      target_roas: ratio(revenuePerOrder, targetCac),
      break_even_amr: ratio(revenuePerOrder, breakEvenCac),
      target_amr: ratio(revenuePerOrder, targetCac),
      expected_orders: expectedOrders !== null ? round(expectedOrders, 2) : null,
      expected_revenue: expectedRevenue !== null ? round(expectedRevenue) : null,
      expected_ad_spend_capacity: expectedAdSpendCapacity !== null ? round(expectedAdSpendCapacity) : null,
      expected_contribution_after_ads: expectedContributionAfterAds !== null ? round(expectedContributionAfterAds) : null,
      missing_data: unique(missingData),
      risks: unique(risks),
    },
    order_weight_basis: expectedOrders,
    revenue_mix_weight_basis: positiveFrom([offer.expected_revenue_mix]),
  };
}

function resolveWeights(offers: InternalOfferTarget[]): {
  source: UnitEconomicsPortfolioTarget["weight_source"];
  weights: number[];
} {
  const orderTotal = offers.reduce((sum, offer) => sum + (offer.order_weight_basis ?? 0), 0);
  if (orderTotal > 0) {
    return {
      source: "expected_orders",
      weights: offers.map((offer) => (offer.order_weight_basis ?? 0) / orderTotal),
    };
  }

  const mixTotal = offers.reduce((sum, offer) => sum + (offer.revenue_mix_weight_basis ?? 0), 0);
  if (mixTotal > 0) {
    return {
      source: "expected_revenue_mix",
      weights: offers.map((offer) => (offer.revenue_mix_weight_basis ?? 0) / mixTotal),
    };
  }

  const equalWeight = offers.length > 0 ? 1 / offers.length : 0;
  return {
    source: "equal_offer_weight",
    weights: offers.map(() => equalWeight),
  };
}

function weightedSum(
  offers: UnitEconomicsOfferTarget[],
  weights: number[],
  selector: (offer: UnitEconomicsOfferTarget) => number,
): number {
  return offers.reduce((sum, offer, index) => sum + selector(offer) * (weights[index] ?? 0), 0);
}

function sumNullable(
  offers: UnitEconomicsOfferTarget[],
  selector: (offer: UnitEconomicsOfferTarget) => number | null,
): number | null {
  const values = offers.map(selector);
  if (values.every((value) => value === null)) return null;
  return round(values.reduce((sum, value) => sum + (value ?? 0), 0));
}

function buildEmptyOutput(plannedAdSpend: number): UnitEconomicsTargetOutput {
  return {
    engine_version: UNIT_ECONOMICS_TARGET_ENGINE_VERSION,
    offers: [],
    portfolio: {
      offer_count: 0,
      modeled_offer_count: 0,
      weight_source: "equal_offer_weight",
      planned_ad_spend: round(plannedAdSpend),
      weighted_revenue_per_order: 0,
      weighted_gross_margin_rate: 0,
      weighted_contribution_before_ads_per_order: 0,
      weighted_contribution_before_ads_rate: 0,
      weighted_desired_contribution_per_order: 0,
      weighted_break_even_cac: null,
      weighted_target_cac: null,
      weighted_break_even_roas: null,
      weighted_target_roas: null,
      weighted_break_even_amr: null,
      weighted_target_amr: null,
      planned_orders_at_target_cac: null,
      planned_revenue_at_target_cac: null,
      planned_contribution_after_ads_at_target_cac: null,
      expected_orders: null,
      expected_revenue: null,
      expected_ad_spend_capacity: null,
      expected_contribution_after_ads: null,
    },
    confidence_score: 0,
    missing_data: ["offers"],
    risks: [],
    conditions: ["Add at least one offer or SKU unit-economics profile."],
    summary: "Unit Economics Target v1 - no offers provided.",
  };
}

export function runUnitEconomicsTargetEngine(input: UnitEconomicsTargetInput): UnitEconomicsTargetOutput {
  const plannedAdSpend = nonNegativeFrom([input.planned_ad_spend]);
  const rawOffers = Array.isArray(input.offers) ? input.offers : [];
  if (rawOffers.length === 0) return buildEmptyOutput(plannedAdSpend);

  const internalOffers = rawOffers.map((offer, index) => buildOfferTarget(offer, input, index));
  const { source: weightSource, weights } = resolveWeights(internalOffers);
  const offers = internalOffers.map((offer, index) => ({
    ...offer.target,
    portfolio_weight: round(weights[index] ?? 0, 4),
  }));
  const missingData = unique(offers.flatMap((offer) => offer.missing_data));
  const risks = unique(offers.flatMap((offer) => offer.risks));
  const conditions: string[] = [];

  const weightedRevenue = weightedSum(offers, weights, (offer) => offer.revenue_per_order);
  const weightedGrossMargin = weightedRevenue > 0
    ? weightedSum(offers, weights, (offer) => offer.gross_profit_per_order) / weightedRevenue
    : 0;
  const weightedContribution = weightedSum(offers, weights, (offer) => offer.contribution_before_ads_per_order);
  const weightedDesiredContribution = weightedSum(offers, weights, (offer) => offer.desired_contribution_per_order);
  const weightedBreakEvenCacRaw = weightedSum(offers, weights, (offer) => offer.break_even_cac);
  const weightedTargetCacRaw = weightedSum(offers, weights, (offer) => offer.target_cac);
  const weightedBreakEvenCac = weightedBreakEvenCacRaw > 0 ? round(weightedBreakEvenCacRaw) : null;
  const weightedTargetCac = weightedTargetCacRaw > 0 ? round(weightedTargetCacRaw) : null;
  const plannedOrdersAtTargetCac = plannedAdSpend > 0 && weightedTargetCacRaw > 0
    ? plannedAdSpend / weightedTargetCacRaw
    : null;
  const plannedRevenueAtTargetCac = plannedOrdersAtTargetCac !== null
    ? plannedOrdersAtTargetCac * weightedRevenue
    : null;
  const plannedContributionAfterAds = plannedOrdersAtTargetCac !== null
    ? plannedOrdersAtTargetCac * Math.max(0, weightedContribution - weightedTargetCacRaw)
    : null;
  const expectedOrders = sumNullable(offers, (offer) => offer.expected_orders);
  const expectedRevenue = sumNullable(offers, (offer) => offer.expected_revenue);
  const expectedAdSpendCapacity = sumNullable(offers, (offer) => offer.expected_ad_spend_capacity);
  const expectedContributionAfterAds = sumNullable(offers, (offer) => offer.expected_contribution_after_ads);

  if (weightedTargetCac === null) {
    conditions.push("Complete offer costs and contribution targets before using this output as the CAC target.");
  }
  if (plannedAdSpend > 0 && plannedOrdersAtTargetCac === null) {
    conditions.push("Planned spend could not be translated into target orders because target CAC is unavailable.");
  }
  if (risks.some((risk) => risk.includes("desired contribution target is missing"))) {
    conditions.push("Set desired contribution per order or margin so target CAC is not only break-even.");
  }

  const confidence = round(clamp(92 - missingData.length * 5 - risks.length * 4, 0, 100), 0);
  const summary = `Unit Economics Target v1 - ${offers.length} offers - target CAC ${weightedTargetCac ?? "n/a"} - target AMR ${ratio(weightedRevenue, weightedTargetCacRaw) ?? "n/a"} - confidence ${confidence}/100.`;

  return {
    engine_version: UNIT_ECONOMICS_TARGET_ENGINE_VERSION,
    offers,
    portfolio: {
      offer_count: rawOffers.length,
      modeled_offer_count: offers.filter((offer) => offer.revenue_per_order > 0).length,
      weight_source: weightSource,
      planned_ad_spend: round(plannedAdSpend),
      weighted_revenue_per_order: round(weightedRevenue),
      weighted_gross_margin_rate: round(weightedGrossMargin, 4),
      weighted_contribution_before_ads_per_order: round(weightedContribution),
      weighted_contribution_before_ads_rate: weightedRevenue > 0 ? round(weightedContribution / weightedRevenue, 4) : 0,
      weighted_desired_contribution_per_order: round(weightedDesiredContribution),
      weighted_break_even_cac: weightedBreakEvenCac,
      weighted_target_cac: weightedTargetCac,
      weighted_break_even_roas: ratio(weightedRevenue, weightedBreakEvenCacRaw),
      weighted_target_roas: ratio(weightedRevenue, weightedTargetCacRaw),
      weighted_break_even_amr: ratio(weightedRevenue, weightedBreakEvenCacRaw),
      weighted_target_amr: ratio(weightedRevenue, weightedTargetCacRaw),
      planned_orders_at_target_cac: plannedOrdersAtTargetCac !== null ? round(plannedOrdersAtTargetCac, 2) : null,
      planned_revenue_at_target_cac: plannedRevenueAtTargetCac !== null ? round(plannedRevenueAtTargetCac) : null,
      planned_contribution_after_ads_at_target_cac: plannedContributionAfterAds !== null ? round(plannedContributionAfterAds) : null,
      expected_orders: expectedOrders,
      expected_revenue: expectedRevenue,
      expected_ad_spend_capacity: expectedAdSpendCapacity,
      expected_contribution_after_ads: expectedContributionAfterAds,
    },
    confidence_score: confidence,
    missing_data: missingData,
    risks,
    conditions: unique(conditions),
    summary,
  };
}
