// TDIA GOS — Deterministic financial formula library.
// Phase 7: Every function is pure, safe against nulls / zeros, and mirrors the
// formulas documented in `.lovable/financial-formula-registry.md`.
//
// Rules:
//  - Never divide by zero (return null instead).
//  - Never propagate NaN or Infinity (clamp / return null).
//  - Always return `missing_data` when a required input is missing.
//  - All percentages are expressed 0-100 unless suffixed `_ratio` (0-1).

export type Num = number | null | undefined;

const isNum = (x: Num): x is number => typeof x === "number" && Number.isFinite(x);
export const safe = (x: Num): number | null => (isNum(x) ? x : null);
export const safeDiv = (n: Num, d: Num): number | null =>
  isNum(n) && isNum(d) && d !== 0 ? n / d : null;
export const round2 = (n: number | null): number | null =>
  n == null ? null : Math.round(n * 100) / 100;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------------- Unit Economics ----------------

export interface UnitEconomicsInput {
  aov: Num;
  cogs_per_order: Num;
  shipping_cost_per_order: Num;
  fulfillment_cost_per_order: Num;
  payment_processing_percent: Num; // 0-100
  refund_rate_percent: Num; // 0-100
  cac?: Num;
  target_cac?: Num;
}

export interface UnitEconomicsOutput {
  payment_processing_cost: number | null;
  refund_cost: number | null;
  variable_cost_per_order: number | null;
  contribution_before_cac: number | null;
  break_even_cac: number | null;
  first_order_profit: number | null;
  first_order_profit_at_target_cac: number | null;
  first_order_profitable: boolean | null;
  risk: "OK" | "WARNING" | "HIGH" | "UNKNOWN";
  missing_data: string[];
  summary: string;
}

export function computeUnitEconomics(i: UnitEconomicsInput): UnitEconomicsOutput {
  const missing: string[] = [];
  const need = (k: keyof UnitEconomicsInput) => { if (!isNum(i[k] as Num)) missing.push(k); };
  ["aov","cogs_per_order","shipping_cost_per_order","fulfillment_cost_per_order",
   "payment_processing_percent","refund_rate_percent"].forEach((k)=>need(k as any));

  const aov = safe(i.aov);
  const pp = aov != null && isNum(i.payment_processing_percent)
    ? round2(aov * (i.payment_processing_percent / 100)) : null;
  const rf = aov != null && isNum(i.refund_rate_percent)
    ? round2(aov * (i.refund_rate_percent / 100)) : null;

  const parts = [i.cogs_per_order, i.shipping_cost_per_order, i.fulfillment_cost_per_order, pp, rf];
  const variable = parts.every(isNum) ? round2(parts.reduce<number>((a,b)=>a+(b as number),0)) : null;
  const contribution = aov != null && variable != null ? round2(aov - variable) : null;
  const breakEven = contribution;
  const firstOrderProfit = contribution != null && isNum(i.cac) ? round2(contribution - i.cac) : null;
  const firstOrderProfitAtTarget = contribution != null && isNum(i.target_cac)
    ? round2(contribution - i.target_cac) : null;

  let profitable: boolean | null = null;
  let risk: UnitEconomicsOutput["risk"] = "UNKNOWN";
  if (firstOrderProfitAtTarget != null) {
    profitable = firstOrderProfitAtTarget >= 0;
    if (firstOrderProfitAtTarget >= 0) risk = "OK";
    else if (contribution != null && Math.abs(firstOrderProfitAtTarget) > contribution * 0.25) risk = "HIGH";
    else risk = "WARNING";
  }

  const summary = missing.length
    ? `Unit economics incomplete: missing ${missing.join(", ")}.`
    : profitable === false
      ? `Target CAC (${i.target_cac}) is NOT first-order profitable. Contribution before CAC = ${contribution}. Only justified if LTV/payback covers the gap.`
      : `Contribution before CAC = ${contribution}. Break-even CAC = ${breakEven}.`;

  return {
    payment_processing_cost: pp,
    refund_cost: rf,
    variable_cost_per_order: variable,
    contribution_before_cac: contribution,
    break_even_cac: breakEven,
    first_order_profit: firstOrderProfit,
    first_order_profit_at_target_cac: firstOrderProfitAtTarget,
    first_order_profitable: profitable,
    risk,
    missing_data: missing,
    summary,
  };
}

// ---------------- E-commerce baseline ----------------

export interface EcomBaselineInput {
  revenue: Num;
  ad_spend: Num;
  new_customers: Num;
  aov: Num;
  gross_margin_percent: Num; // 0-100
  additional_variable_costs?: Num;
  target_cac?: Num;
  target_mer?: Num;
  platform_revenue?: Num;
}

export function computeEcomBaseline(i: EcomBaselineInput) {
  const mer = safeDiv(i.revenue, i.ad_spend);
  const cac = safeDiv(i.ad_spend, i.new_customers);
  const roas = safeDiv(i.platform_revenue, i.ad_spend);
  const orders = safeDiv(i.revenue, i.aov);
  const grossProfit = isNum(i.revenue) && isNum(i.gross_margin_percent)
    ? round2(i.revenue * (i.gross_margin_percent / 100)) : null;
  const extra = isNum(i.additional_variable_costs) ? i.additional_variable_costs : 0;
  const contribution = grossProfit != null && isNum(i.ad_spend)
    ? round2(grossProfit - i.ad_spend - extra) : null;
  const contributionPct = safeDiv(contribution, i.revenue);

  const cacVsTarget = cac != null && isNum(i.target_cac)
    ? (cac > i.target_cac ? "ABOVE_TARGET" : "AT_OR_BELOW_TARGET") : "UNKNOWN";
  const merVsTarget = mer != null && isNum(i.target_mer)
    ? (mer < i.target_mer ? "BELOW_TARGET" : "AT_OR_ABOVE_TARGET") : "UNKNOWN";

  let diagnosis = "UNKNOWN";
  if (cacVsTarget === "ABOVE_TARGET" && merVsTarget === "BELOW_TARGET") diagnosis = "EFFICIENCY_PROBLEM";
  else if (merVsTarget === "AT_OR_ABOVE_TARGET" && cacVsTarget === "AT_OR_BELOW_TARGET") diagnosis = "HEALTHY";

  return {
    mer: round2(mer),
    cac: round2(cac),
    roas: round2(roas),
    orders: orders != null ? Math.round(orders) : null,
    gross_profit: grossProfit,
    contribution_margin: contribution,
    contribution_margin_percent: contributionPct != null ? round2(contributionPct * 100) : null,
    cac_vs_target: cacVsTarget,
    mer_vs_target: merVsTarget,
    diagnosis,
    summary: `MER=${round2(mer)}, CAC=${round2(cac)}, Contribution=${contribution}. Diagnosis=${diagnosis}.`,
  };
}

// ---------------- Local service baseline ----------------

export interface LocalBaselineInput {
  leads: Num;
  qualified_leads: Num;
  booked_appointments: Num;
  jobs_closed: Num;
  revenue: Num;
  ad_spend: Num;
  gross_margin_percent: Num;
  average_job_value: Num;
}

export function computeLocalBaseline(i: LocalBaselineInput) {
  const cpl = safeDiv(i.ad_spend, i.leads);
  const cpBooked = safeDiv(i.ad_spend, i.booked_appointments);
  const cpJob = safeDiv(i.ad_spend, i.jobs_closed);
  const closeRate = safeDiv(i.jobs_closed, i.booked_appointments);
  const bookedRate = safeDiv(i.booked_appointments, i.qualified_leads);
  const grossProfit = isNum(i.revenue) && isNum(i.gross_margin_percent)
    ? round2(i.revenue * (i.gross_margin_percent / 100)) : null;
  const contribution = grossProfit != null && isNum(i.ad_spend)
    ? round2(grossProfit - i.ad_spend) : null;

  let diagnosis = "UNKNOWN";
  if (closeRate != null && closeRate < 0.5 && cpl != null) diagnosis = "SALES_EFFICIENCY";

  return {
    cpl: round2(cpl),
    cost_per_booked_appointment: round2(cpBooked),
    cost_per_job: round2(cpJob),
    close_rate: closeRate != null ? round2(closeRate * 100) : null,
    booked_rate: bookedRate != null ? round2(bookedRate * 100) : null,
    gross_profit: grossProfit,
    contribution_margin: contribution,
    diagnosis,
    summary: `CPL=${round2(cpl)}, cost/job=${round2(cpJob)}, close_rate=${closeRate != null ? (closeRate*100).toFixed(1)+"%":"n/a"}.`,
  };
}

// ---------------- Retention ----------------

export interface RetentionInput {
  first_order_revenue: Num;
  returning_revenue_30d: Num;
  returning_revenue_60d: Num;
  returning_revenue_90d: Num;
  returning_revenue_180d: Num;
  contribution_before_cac?: Num;
  payback_window_days?: Num;
}

export function computeRetention(i: RetentionInput) {
  const lift = (r: Num) => {
    const v = safeDiv(r, i.first_order_revenue);
    return v != null ? round2(v * 100) : null;
  };
  const l30 = lift(i.returning_revenue_30d);
  const l60 = lift(i.returning_revenue_60d);
  const l90 = lift(i.returning_revenue_90d);
  const l180 = lift(i.returning_revenue_180d);

  const inWindow = (days: Num) => {
    if (!isNum(days)) return l90; // default 90d payback
    if (days <= 30) return l30;
    if (days <= 60) return l60;
    if (days <= 90) return l90;
    return l180;
  };
  const ltvContribInWindow = inWindow(i.payback_window_days);
  const allowableCacLift = ltvContribInWindow != null && isNum(i.contribution_before_cac)
    ? round2(i.contribution_before_cac * (1 + ltvContribInWindow / 100)) : null;

  const quality = l90 == null ? "UNKNOWN"
    : l90 >= 30 ? "HIGH"
    : l90 >= 15 ? "MEDIUM" : "LOW";

  return {
    ltv_lift_30d_pct: l30,
    ltv_lift_60d_pct: l60,
    ltv_lift_90d_pct: l90,
    ltv_lift_180d_pct: l180,
    retention_quality: quality,
    allowable_cac_with_ltv: allowableCacLift,
    summary: `Retention quality ${quality} (LTV lift 90d = ${l90}%). CAC can flex up to ${allowableCacLift ?? "n/a"} within payback window.`,
  };
}

// ---------------- Spending Power ----------------

export interface SpendingPowerInput {
  history: Array<{ ad_spend: number; cac?: number; mer?: number }>;
  planned_spend: Num;
}

export function computeSpendingPower(i: SpendingPowerInput) {
  const h = i.history.filter((x) => isNum(x.ad_spend));
  if (h.length === 0 || !isNum(i.planned_spend)) {
    return {
      historical_avg_cac: null, historical_avg_mer: null, historical_max_spend: null,
      spend_increase_ratio: null, spend_risk: "UNKNOWN" as const,
      projected_cac: null, projected_mer: null,
      recommendation: "Insufficient history or missing planned_spend.",
      missing_data: ["history", "planned_spend"].filter((k) => k === "history" ? h.length === 0 : !isNum(i.planned_spend)),
      summary: "Insufficient data for spending power projection.",
    };
  }
  const cacs = h.map((x) => x.cac).filter(isNum) as number[];
  const mers = h.map((x) => x.mer).filter(isNum) as number[];
  const avg = (a: number[]) => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
  const avgCac = avg(cacs);
  const avgMer = avg(mers);
  const maxSpend = Math.max(...h.map((x) => x.ad_spend));
  const ratio = round2(i.planned_spend / maxSpend)!;

  let risk: "LOW" | "MEDIUM" | "HIGH";
  if (i.planned_spend <= maxSpend * 1.10) risk = "LOW";
  else if (i.planned_spend <= maxSpend * 1.30) risk = "MEDIUM";
  else risk = "HIGH";

  // Deterministic degradation:
  //   LOW: +0% / -0%   MEDIUM: +15% CAC / -10% MER   HIGH: +35% CAC / -20% MER
  const cacBump = risk === "LOW" ? 0 : risk === "MEDIUM" ? 0.15 : 0.35;
  const merDrop = risk === "LOW" ? 0 : risk === "MEDIUM" ? 0.10 : 0.20;
  const projectedCac = avgCac != null ? round2(avgCac * (1 + cacBump)) : null;
  const projectedMer = avgMer != null ? round2(avgMer * (1 - merDrop)) : null;

  const recommendation = risk === "HIGH"
    ? `Planned spend ${i.planned_spend} is ${(ratio*100).toFixed(0)}% of historical max (${maxSpend}). Do NOT jump directly. Ramp in 15-25% increments and validate CAC before each step.`
    : risk === "MEDIUM"
      ? `Planned spend within stretch zone. Monitor CAC weekly; expect ~15% CAC degradation.`
      : `Planned spend within safe range of historical performance.`;

  return {
    historical_avg_cac: round2(avgCac),
    historical_avg_mer: round2(avgMer),
    historical_max_spend: maxSpend,
    spend_increase_ratio: ratio,
    spend_risk: risk,
    projected_cac: projectedCac,
    projected_mer: projectedMer,
    recommendation,
    missing_data: [],
    summary: `Spend risk ${risk} (planned ${i.planned_spend} vs max ${maxSpend}). Projected CAC ${projectedCac}, MER ${projectedMer}.`,
  };
}

// ---------------- Measurement ----------------

export interface MeasurementInput {
  platform_reported_revenue: Num;
  shopify_revenue: Num;
  ad_spend: Num;
  baseline_revenue: Num;
  test_period_revenue: Num;
}

export function computeMeasurement(i: MeasurementInput) {
  const gapAbs = isNum(i.platform_reported_revenue) && isNum(i.shopify_revenue) && i.shopify_revenue !== 0
    ? (i.platform_reported_revenue - i.shopify_revenue) / i.shopify_revenue
    : null;
  const gapPct = gapAbs != null ? round2(gapAbs * 100) : null;
  const observedLift = isNum(i.test_period_revenue) && isNum(i.baseline_revenue)
    ? round2(i.test_period_revenue - i.baseline_revenue) : null;
  const iRoas = safeDiv(observedLift, i.ad_spend);

  let risk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  if (gapAbs != null) {
    const g = Math.abs(gapAbs);
    risk = g > 0.30 ? "HIGH" : g >= 0.15 ? "MEDIUM" : "LOW";
  }
  const warning = risk === "HIGH"
    ? "Platform reporting deviates >30% from Shopify. Do NOT rely on Meta ROAS for scaling decisions."
    : risk === "MEDIUM" ? "Platform reporting deviates 15-30% from Shopify. Cross-check before scaling."
    : risk === "LOW" ? "Platform reporting aligned with Shopify." : "Insufficient data.";

  return {
    platform_to_shopify_gap_percent: gapPct,
    observed_lift_revenue: observedLift,
    estimated_i_roas: round2(iRoas),
    tracking_risk: risk,
    warning,
    summary: `Platform gap ${gapPct}% (${risk}). Observed lift ${observedLift}, incremental ROAS ${round2(iRoas)}.`,
  };
}

// ================================================================
// Phase 11A.0 — Expanded E-commerce Financial Model
// ================================================================

// ---------------- Gross-to-Net Revenue ----------------

export interface GrossToNetInput {
  gross_revenue: Num;
  discounts: Num;
  refunds: Num;
  chargebacks: Num;
  shipping_collected: Num;
  taxes_collected: Num;
  taxes_included_in_price?: boolean; // if true, subtract taxes; else 0
}

export function computeGrossToNet(i: GrossToNetInput) {
  const missing: string[] = [];
  if (!isNum(i.gross_revenue)) missing.push("gross_revenue");
  const gr = safe(i.gross_revenue) ?? 0;
  const disc = safe(i.discounts) ?? 0;
  const ref = safe(i.refunds) ?? 0;
  const cbk = safe(i.chargebacks) ?? 0;
  const ship = safe(i.shipping_collected) ?? 0;
  const tax = safe(i.taxes_collected) ?? 0;
  const taxDeduct = i.taxes_included_in_price ? tax : 0;
  const net = isNum(i.gross_revenue) ? round2(gr - disc - ref - cbk + ship - taxDeduct) : null;
  const gap = net != null && gr !== 0 ? round2(((gr - net) / gr) * 100) : null;
  return {
    net_revenue: net,
    gross_to_net_gap_percent: gap,
    missing_data: missing,
    summary: net == null
      ? "Gross-to-net incomplete: missing gross_revenue."
      : `Net revenue = ${net} (gap ${gap}% vs gross).`,
  };
}

// ---------------- Product Cost of Delivery & True Gross Margin ----------------

export interface ProductProfileInput {
  price: Num;
  product_cost: Num;
  landed_cost?: Num;
  freight_cost?: Num;
  duties_tariffs?: Num;
  shipping_cost_to_customer?: Num;
  pick_pack_cost?: Num;
  payment_processing_percent?: Num; // 0-100
  refund_allowance_percent?: Num;   // 0-100 (of price)
  discount_allowance_percent?: Num; // 0-100 (of price)
  target_cac?: Num;
}

export function computeProductProfile(i: ProductProfileInput) {
  const missing: string[] = [];
  if (!isNum(i.price)) missing.push("price");
  if (!isNum(i.product_cost)) missing.push("product_cost");
  const price = safe(i.price);
  const pc = safe(i.product_cost);

  const landed = safe(i.landed_cost) ?? 0;
  const freight = safe(i.freight_cost) ?? 0;
  const duties = safe(i.duties_tariffs) ?? 0;
  const shipping = safe(i.shipping_cost_to_customer) ?? 0;
  const pickpack = safe(i.pick_pack_cost) ?? 0;
  const ppPct = safe(i.payment_processing_percent) ?? 0;
  const refPct = safe(i.refund_allowance_percent) ?? 0;
  const discPct = safe(i.discount_allowance_percent) ?? 0;

  const pp = price != null ? round2(price * (ppPct / 100))! : 0;
  const refAlw = price != null ? round2(price * (refPct / 100))! : 0;
  const discAlw = price != null ? round2(price * (discPct / 100))! : 0;

  const cost_of_delivery = pc == null || price == null ? null
    : round2(pc + landed + freight + duties + shipping + pickpack + pp + refAlw + discAlw);

  const product_margin = price != null && pc != null ? round2(price - pc) : null;
  const product_margin_percent = safeDiv(product_margin, price);
  const true_gross_profit = price != null && cost_of_delivery != null ? round2(price - cost_of_delivery) : null;
  const true_gross_margin_percent = safeDiv(true_gross_profit, price);
  const contribution_before_cac = true_gross_profit;
  const break_even_cac = true_gross_profit;
  const break_even_roas = true_gross_margin_percent != null && true_gross_margin_percent > 0
    ? round2(1 / true_gross_margin_percent) : null;
  const first_order_profit_at_target_cac = contribution_before_cac != null && isNum(i.target_cac)
    ? round2(contribution_before_cac - i.target_cac) : null;

  return {
    cost_of_delivery,
    product_margin,
    product_margin_percent: product_margin_percent != null ? round2(product_margin_percent * 100) : null,
    true_gross_profit,
    true_gross_margin_percent: true_gross_margin_percent != null ? round2(true_gross_margin_percent * 100) : null,
    contribution_before_cac,
    break_even_cac,
    break_even_roas,
    first_order_profit_at_target_cac,
    missing_data: missing,
    summary: missing.length
      ? `Product profile incomplete: missing ${missing.join(", ")}.`
      : `True gross margin ${true_gross_margin_percent != null ? round2(true_gross_margin_percent * 100) : "?"}%, break-even CAC ${break_even_cac}.`,
  };
}

// ---------------- Basket Economics ----------------

export interface BasketEconomicsInput {
  avg_order_value: Num;
  basket_cogs: Num;
  basket_shipping_cost?: Num;
  basket_fulfillment_cost?: Num;
  basket_payment_processing_cost?: Num;
  basket_refund_allowance?: Num;
  basket_discount_allowance?: Num;
  target_cac?: Num;
}

export function computeBasketEconomics(i: BasketEconomicsInput) {
  const missing: string[] = [];
  if (!isNum(i.avg_order_value)) missing.push("avg_order_value");
  if (!isNum(i.basket_cogs)) missing.push("basket_cogs");
  const aov = safe(i.avg_order_value);
  const cogs = safe(i.basket_cogs);
  const parts = [cogs, i.basket_shipping_cost, i.basket_fulfillment_cost,
    i.basket_payment_processing_cost, i.basket_refund_allowance, i.basket_discount_allowance]
    .map(v => safe(v as Num) ?? 0);
  const variable = cogs == null ? null : round2(parts.reduce((a, b) => a + b, 0));
  const gp = aov != null && variable != null ? round2(aov - variable) : null;
  const gm = safeDiv(gp, aov);
  const breakEven = gp;
  const firstOrder = gp != null && isNum(i.target_cac) ? round2(gp - i.target_cac) : null;

  return {
    basket_gross_profit: gp,
    basket_gross_margin_percent: gm != null ? round2(gm * 100) : null,
    break_even_cac: breakEven,
    first_order_profit_at_target_cac: firstOrder,
    missing_data: missing,
    summary: missing.length
      ? `Basket economics incomplete: missing ${missing.join(", ")}.`
      : `Basket GP ${gp} (${gm != null ? round2(gm * 100) : "?"}% margin). Break-even CAC ${breakEven}.`,
  };
}

// ---------------- Offer / Discount Economics ----------------

export interface OfferEconomicsInput {
  base_price: Num;
  discount_percent: Num; // 0-100
  cogs: Num;
  shipping_cost?: Num;
  fulfillment_cost?: Num;
  gift_cost?: Num;
  payment_processing_percent?: Num; // 0-100 of discounted price
  refund_allowance_percent?: Num;
  discount_allowance_percent?: Num;
}

export function computeOfferEconomics(i: OfferEconomicsInput) {
  const missing: string[] = [];
  if (!isNum(i.base_price)) missing.push("base_price");
  if (!isNum(i.discount_percent)) missing.push("discount_percent");
  if (!isNum(i.cogs)) missing.push("cogs");

  const bp = safe(i.base_price);
  const dp = safe(i.discount_percent);
  const cogs = safe(i.cogs);
  const discounted_price = bp != null && dp != null ? round2(bp * (1 - dp / 100)) : null;

  const ship = safe(i.shipping_cost) ?? 0;
  const fulf = safe(i.fulfillment_cost) ?? 0;
  const gift = safe(i.gift_cost) ?? 0;
  const pp = discounted_price != null && isNum(i.payment_processing_percent)
    ? round2(discounted_price * (i.payment_processing_percent / 100))! : 0;
  const refAlw = discounted_price != null && isNum(i.refund_allowance_percent)
    ? round2(discounted_price * (i.refund_allowance_percent / 100))! : 0;
  const discAlw = discounted_price != null && isNum(i.discount_allowance_percent)
    ? round2(discounted_price * (i.discount_allowance_percent / 100))! : 0;

  const variable = cogs == null ? null : round2(cogs + ship + fulf + gift + pp + refAlw + discAlw);
  const gp_after = discounted_price != null && variable != null ? round2(discounted_price - variable) : null;
  const gm_after = safeDiv(gp_after, discounted_price);
  const break_even_cac_after = gp_after;
  const break_even_roas_after = gm_after != null && gm_after > 0
    ? round2(1 / gm_after) : null;

  let viability: "HEALTHY" | "TIGHT" | "HIGH_RISK" | "NOT_VIABLE_FOR_ACQUISITION" | "UNKNOWN" = "UNKNOWN";
  if (gp_after != null && gm_after != null) {
    if (gp_after <= 0 || gm_after <= 0) viability = "NOT_VIABLE_FOR_ACQUISITION";
    else if (break_even_roas_after != null && break_even_roas_after >= 6) viability = "HIGH_RISK";
    else if (break_even_roas_after != null && break_even_roas_after >= 3) viability = "TIGHT";
    else viability = "HEALTHY";
  }

  const recommendation = viability === "NOT_VIABLE_FOR_ACQUISITION"
    ? "Offer loses money per order. Use only for retention / winback, never for cold acquisition."
    : viability === "HIGH_RISK"
      ? `Break-even ROAS ${break_even_roas_after} is unrealistic for cold traffic. Restrict to warm/retargeting.`
      : viability === "TIGHT"
        ? `Break-even ROAS ${break_even_roas_after} is achievable but leaves no margin for error. Cap spend.`
        : viability === "HEALTHY"
          ? `Offer is viable for acquisition (break-even ROAS ${break_even_roas_after}).`
          : "Insufficient data to score offer viability.";

  return {
    discounted_price,
    gross_profit_after_offer: gp_after,
    gross_margin_after_offer_percent: gm_after != null ? round2(gm_after * 100) : null,
    break_even_cac_after_offer: break_even_cac_after,
    break_even_roas_after_offer: break_even_roas_after,
    offer_viability: viability,
    recommendation,
    missing_data: missing,
    summary: `Discounted ${discounted_price}, GP after ${gp_after}, viability ${viability}.`,
  };
}

// ---------------- LTGP:CAC ----------------

export function computeLtgpToCac(lifetime_gross_profit_within_window: Num, cac: Num) {
  const ratio = safeDiv(lifetime_gross_profit_within_window, cac);
  let classification: "LOSING_MONEY" | "WEAK" | "HEALTHY" | "UNDER_SPENDING" | "UNKNOWN" = "UNKNOWN";
  if (ratio != null) {
    if (ratio < 1) classification = "LOSING_MONEY";
    else if (ratio < 2) classification = "WEAK";
    else if (ratio <= 3) classification = "HEALTHY";
    else classification = "UNDER_SPENDING";
  }
  return {
    ltgp_to_cac: round2(ratio),
    classification,
    summary: ratio == null ? "LTGP:CAC unavailable (missing CAC or LTGP)."
      : `LTGP:CAC = ${round2(ratio)} (${classification}).`,
  };
}

// ---------------- Inventory Grade ----------------

export interface InventoryGradeInput {
  inventory_units: Num;
  daily_sales_velocity: Num;
  unit_cost?: Num;
  unit_price?: Num;
}

export function computeInventoryGrade(i: InventoryGradeInput) {
  const missing: string[] = [];
  if (!isNum(i.inventory_units)) missing.push("inventory_units");
  if (!isNum(i.daily_sales_velocity)) missing.push("daily_sales_velocity");
  const days = safeDiv(i.inventory_units, i.daily_sales_velocity);
  let grade: "A" | "B" | "C" | "D" | "UNKNOWN" = "UNKNOWN";
  let strategy = "Insufficient data.";
  if (days != null) {
    if (days < 30) { grade = "A"; strategy = "Fast mover — push, protect margin."; }
    else if (days < 90) { grade = "B"; strategy = "Steady demand generation."; }
    else if (days < 180) { grade = "C"; strategy = "Volume test; monitor CAC vs margin."; }
    else { grade = "D"; strategy = "Dead stock — cash recovery / liquidation campaign, do not scale full-price acquisition."; }
  }
  const cash_locked = isNum(i.inventory_units) && isNum(i.unit_cost) ? round2(i.inventory_units * i.unit_cost) : null;
  const value_retail = isNum(i.inventory_units) && isNum(i.unit_price) ? round2(i.inventory_units * i.unit_price) : null;
  return {
    days_of_inventory_on_hand: days != null ? round2(days) : null,
    inventory_grade: grade,
    cash_locked_in_inventory: cash_locked,
    inventory_value_at_retail: value_retail,
    recommended_media_strategy: strategy,
    missing_data: missing,
    summary: `Days on hand ${days != null ? round2(days) : "?"} → grade ${grade}.`,
  };
}

// ---------------- P&L Snapshot ----------------

export interface PnlSnapshotInput {
  gross_revenue?: Num;
  net_revenue: Num;
  cost_of_delivery: Num;
  marketing_expense: Num;
  opex: Num;
  interest_expense?: Num;
}

export function computePnlSnapshot(i: PnlSnapshotInput) {
  const missing: string[] = [];
  (["net_revenue","cost_of_delivery","marketing_expense","opex"] as const).forEach((k) => {
    if (!isNum(i[k] as Num)) missing.push(k);
  });
  const nr = safe(i.net_revenue);
  const cod = safe(i.cost_of_delivery);
  const mkt = safe(i.marketing_expense);
  const op = safe(i.opex);
  const int_exp = safe(i.interest_expense) ?? 0;

  const gross_profit = nr != null && cod != null ? round2(nr - cod) : null;
  const gross_margin_percent = safeDiv(gross_profit, nr);
  const contribution_margin = gross_profit != null && mkt != null ? round2(gross_profit - mkt) : null;
  const contribution_margin_percent = safeDiv(contribution_margin, nr);
  const mer = safeDiv(nr, mkt);
  const ebitda = contribution_margin != null && op != null ? round2(contribution_margin - op) : null;
  const net_profit = ebitda != null ? round2(ebitda - int_exp) : null;
  const net_profit_percent = safeDiv(net_profit, nr);

  return {
    gross_profit,
    gross_margin_percent: gross_margin_percent != null ? round2(gross_margin_percent * 100) : null,
    marketing_efficiency_ratio: round2(mer),
    contribution_margin,
    contribution_margin_percent: contribution_margin_percent != null ? round2(contribution_margin_percent * 100) : null,
    ebitda,
    net_profit,
    net_profit_percent: net_profit_percent != null ? round2(net_profit_percent * 100) : null,
    missing_data: missing,
    summary: missing.length
      ? `P&L incomplete: missing ${missing.join(", ")}.`
      : `GP ${gross_profit}, CM ${contribution_margin}, EBITDA ${ebitda}, Net ${net_profit}.`,
  };
}

// ================================================================
// Phase 11A.0.1 — Order-value distribution / Funnel / SKU / OPEX
// ================================================================

// ---------------- Order Value Distribution ----------------

export interface OrderBucket { min: number; max: number; order_count: number; revenue?: number; order_percent?: number; }
export interface OrderValueDistributionInput {
  order_values?: number[]; // raw values (optional if buckets provided)
  buckets?: OrderBucket[]; // optional pre-bucketed
  bucket_size?: number;    // used when computing buckets from raw values
  target_cac?: Num;
  contribution_ratio_at_modal?: Num; // 0-1: gross margin at modal; if provided, used for cac_target_risk
}

export function computeOrderValueDistribution(i: OrderValueDistributionInput) {
  const raw = (i.order_values ?? []).filter((v) => typeof v === "number" && Number.isFinite(v));
  const bs = i.bucket_size && i.bucket_size > 0 ? i.bucket_size : 50;
  let buckets: OrderBucket[] = i.buckets ?? [];
  let avg: number | null = null;
  let median: number | null = null;
  let minV: number | null = null;
  let maxV: number | null = null;

  if (raw.length) {
    const sorted = [...raw].sort((a, b) => a - b);
    avg = round2(sorted.reduce((s, x) => s + x, 0) / sorted.length);
    const mid = Math.floor(sorted.length / 2);
    median = sorted.length % 2 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2);
    minV = sorted[0];
    maxV = sorted[sorted.length - 1];
    if (!i.buckets) {
      const map = new Map<number, OrderBucket>();
      for (const v of sorted) {
        const key = Math.floor(v / bs);
        const min = key * bs;
        const max = min + bs - 0.01;
        const b = map.get(key) ?? { min, max, order_count: 0, revenue: 0 };
        b.order_count += 1;
        b.revenue = round2((b.revenue ?? 0) + v)!;
        map.set(key, b);
      }
      buckets = [...map.values()].sort((a, b) => a.min - b.min);
    }
  } else if (buckets.length) {
    const totalOrders = buckets.reduce((s, b) => s + (b.order_count || 0), 0);
    const totalRevenue = buckets.reduce((s, b) => s + (b.revenue ?? ((b.min + b.max) / 2) * b.order_count), 0);
    avg = totalOrders > 0 ? round2(totalRevenue / totalOrders) : null;
    minV = buckets[0].min;
    maxV = buckets[buckets.length - 1].max;
    // approximate median via cumulative count
    let cum = 0; const half = totalOrders / 2;
    for (const b of buckets) { cum += b.order_count; if (cum >= half) { median = round2((b.min + b.max) / 2); break; } }
  }

  const totalOrders = buckets.reduce((s, b) => s + (b.order_count || 0), 0);
  const bucketsWithPct: OrderBucket[] = buckets.map((b) => ({
    ...b,
    order_percent: totalOrders > 0 ? round2((b.order_count / totalOrders) * 100)! / 100 : 0,
  }));
  const modalBucket = bucketsWithPct.reduce<OrderBucket | null>((best, b) =>
    !best || b.order_count > best.order_count ? b : best, null);
  const modal = modalBucket ? round2((modalBucket.min + modalBucket.max) / 2) : null;

  let long_tail_risk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  if (avg != null && modal != null && modal > 0) {
    const ratio = avg / modal;
    long_tail_risk = ratio > 1.30 ? "HIGH" : ratio > 1.15 ? "MEDIUM" : "LOW";
  }

  let cac_target_risk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  if (isNum(i.target_cac) && modal != null && isNum(i.contribution_ratio_at_modal)) {
    const modalContribution = modal * (i.contribution_ratio_at_modal as number);
    if (modalContribution < i.target_cac) cac_target_risk = "HIGH";
    else if (modalContribution < i.target_cac * 1.2) cac_target_risk = "MEDIUM";
    else cac_target_risk = "LOW";
  } else if (long_tail_risk === "HIGH" && isNum(i.target_cac) && modal != null && i.target_cac > modal * 0.5) {
    cac_target_risk = "HIGH";
  }

  const summary = avg == null
    ? "Order value distribution unavailable (no data)."
    : long_tail_risk === "HIGH"
      ? `AOV average (${avg}) may be misleading — modal order is ${modal}. CAC target should be checked against modal order economics.`
      : `AOV ${avg}, median ${median}, modal ${modal}. Long-tail risk ${long_tail_risk}.`;

  return {
    avg_order_value: avg,
    median_order_value: median,
    modal_order_value: modal,
    min_order_value: minV,
    max_order_value: maxV,
    bucket_size: bs,
    buckets: bucketsWithPct,
    top_bucket_min: modalBucket?.min ?? null,
    top_bucket_max: modalBucket?.max ?? null,
    top_bucket_order_count: modalBucket?.order_count ?? null,
    top_bucket_order_percent: modalBucket && totalOrders > 0
      ? round2((modalBucket.order_count / totalOrders) * 100) : null,
    long_tail_risk,
    cac_target_risk,
    summary,
    warning: long_tail_risk === "HIGH"
      ? "AOV average may overstate CAC target. Judge CAC against modal order, not average."
      : null,
  };
}

// ---------------- Funnel Economics ----------------

export interface FunnelEconomicsInput {
  funnel_name?: string;
  funnel_type?: "SINGLE_PRODUCT" | "BUNDLE" | "HERO_PRODUCT" | "CATEGORY_PAGE" | "LANDING_PAGE" | "PROMO" | "INVENTORY_CLEARANCE" | "RETENTION_ONLY" | "TEST";
  expected_order_type?: string;
  expected_order_value: Num;
  contribution_before_cac: Num; // per order
  target_cac: Num;
  modal_order_value?: Num;
}

export function computeFunnelEconomics(i: FunnelEconomicsInput) {
  const missing: string[] = [];
  if (!isNum(i.expected_order_value)) missing.push("expected_order_value");
  if (!isNum(i.contribution_before_cac)) missing.push("contribution_before_cac");
  if (!isNum(i.target_cac)) missing.push("target_cac");

  const break_even_cac = safe(i.contribution_before_cac);
  const first_order_profit_at_target_cac = break_even_cac != null && isNum(i.target_cac)
    ? round2(break_even_cac - i.target_cac) : null;
  const first_order_profitable = first_order_profit_at_target_cac != null
    ? first_order_profit_at_target_cac >= 0 : null;

  let product_mix_confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
  if (i.funnel_type === "CATEGORY_PAGE") product_mix_confidence = "LOW";
  else if (i.funnel_type === "LANDING_PAGE" || i.funnel_type === "PROMO") product_mix_confidence = "MEDIUM";

  const warnings: string[] = [];
  if (first_order_profitable === false) warnings.push("Not first-order profitable at target CAC.");
  if (i.funnel_type === "RETENTION_ONLY") warnings.push("Retention-only funnel — do not use for cold-acquisition CAC targets.");
  if (product_mix_confidence !== "HIGH") warnings.push(`Product mix confidence ${product_mix_confidence} for funnel_type=${i.funnel_type}.`);

  const recommendation = missing.length
    ? "Complete inputs to score funnel."
    : first_order_profitable === false
      ? `Reduce target CAC below ${break_even_cac}, raise AOV, or restrict funnel to warm/retention traffic.`
      : "Funnel is first-order profitable at target CAC.";

  return {
    break_even_cac,
    first_order_profit_at_target_cac,
    first_order_profitable,
    product_mix_confidence,
    warnings,
    recommendation,
    missing_data: missing,
    summary: `Funnel ${i.funnel_name ?? "(unnamed)"}: expected ${i.expected_order_value}, contribution ${i.contribution_before_cac}, target CAC ${i.target_cac}, first-order profit ${first_order_profit_at_target_cac}.`,
  };
}

// ---------------- SKU Demand Plan ----------------

export interface SkuDemandPlanInput {
  forecasted_units: Num;
  available_inventory: Num;
  safety_stock?: Num;                                   // default 0
  inventory_grade?: "A" | "B" | "C" | "D" | null;
  gross_margin_percent?: Num;                           // 0-100 (for scale vs limit tie-breaker)
}

export function computeSkuDemandPlan(i: SkuDemandPlanInput) {
  const missing: string[] = [];
  if (!isNum(i.forecasted_units)) missing.push("forecasted_units");
  if (!isNum(i.available_inventory)) missing.push("available_inventory");

  const projected = isNum(i.forecasted_units) && isNum(i.available_inventory)
    ? round2(i.available_inventory - i.forecasted_units) : null;
  const safety = safe(i.safety_stock) ?? 0;

  let inventory_risk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  if (projected != null) {
    if (projected < 0) inventory_risk = "HIGH";
    else if (projected < safety) inventory_risk = "HIGH";
    else if (isNum(i.forecasted_units) && projected < i.forecasted_units * 0.1) inventory_risk = "MEDIUM";
    else inventory_risk = "LOW";
  }

  let marketing_priority: "SCALE" | "MAINTAIN" | "LIMIT" | "DO_NOT_PUSH" | "CLEARANCE" | "TEST" = "MAINTAIN";
  let paid_media_action: "INCREASE_SPEND" | "MAINTAIN_SPEND" | "REDUCE_SPEND" | "PAUSE" | "REDIRECT_TO_ALTERNATIVE_SKU" | "BUILD_DEDICATED_FUNNEL" | "LIQUIDATE_INVENTORY" = "MAINTAIN_SPEND";

  if (i.inventory_grade === "D") {
    marketing_priority = "CLEARANCE";
    paid_media_action = "LIQUIDATE_INVENTORY";
  } else if (i.inventory_grade === "C") {
    marketing_priority = "CLEARANCE";
    paid_media_action = "BUILD_DEDICATED_FUNNEL";
  } else if (inventory_risk === "HIGH") {
    marketing_priority = projected != null && projected < 0 ? "DO_NOT_PUSH" : "LIMIT";
    paid_media_action = projected != null && projected < 0 ? "REDIRECT_TO_ALTERNATIVE_SKU" : "REDUCE_SPEND";
  } else if (inventory_risk === "MEDIUM") {
    marketing_priority = "LIMIT";
    paid_media_action = "REDUCE_SPEND";
  } else if (i.inventory_grade === "A" && isNum(i.gross_margin_percent) && (i.gross_margin_percent as number) >= 40) {
    marketing_priority = "SCALE";
    paid_media_action = "INCREASE_SPEND";
  } else if (i.inventory_grade === "B") {
    marketing_priority = "MAINTAIN";
    paid_media_action = "MAINTAIN_SPEND";
  }

  const explanation = i.inventory_grade === "D" || i.inventory_grade === "C"
    ? "This may be a cash-flow play, not a profit-maximization play."
    : marketing_priority === "DO_NOT_PUSH"
      ? "Projected inventory would go negative — do not scale acquisition on this SKU."
      : marketing_priority === "LIMIT"
        ? "Inventory margin is thin vs forecast — cap spend to protect stock."
        : marketing_priority === "SCALE"
          ? "High-margin SKU with safe stock — scale."
          : "Steady demand generation.";

  return {
    projected_inventory_after_plan: projected,
    inventory_risk,
    marketing_priority,
    paid_media_action,
    explanation,
    missing_data: missing,
    summary: `Projected inventory ${projected}, risk ${inventory_risk} → ${marketing_priority} / ${paid_media_action}.`,
  };
}

// ---------------- OPEX Buffer Warning ----------------

export interface OpexBufferInput {
  use_opex_buffer: boolean;
  opex_buffer_type: "NONE" | "PERCENT_OF_REVENUE" | "PER_ORDER" | "FIXED_MONTHLY";
  opex_buffer_percent_of_revenue?: Num;
  opex_buffer_per_order?: Num;
  opex_fixed_monthly?: Num;
  conservative_bootstrap_mode?: boolean;
}

export function computeOpexBufferWarning(i: OpexBufferInput) {
  if (!i.use_opex_buffer || i.opex_buffer_type === "NONE") {
    return {
      applied: false,
      warning: null as string | null,
      note: "OPEX is treated as truly fixed and excluded from per-order CAC math.",
    };
  }
  const warning = "Fixed OPEX does not scale linearly with revenue. Treat the OPEX buffer as a conservative guardrail, not a true variable cost.";
  const bootstrap_note = i.conservative_bootstrap_mode
    ? "Conservative bootstrap mode active — buffer applied inside CAC safety math."
    : "Bootstrap mode off — buffer surfaced as warning only, not deducted from break-even CAC.";
  return {
    applied: true,
    warning,
    note: bootstrap_note,
    type: i.opex_buffer_type,
  };
}


