// TDIA CRM — Core deterministic formulas.

export type BaselineInput = {
  shopify_revenue?: number | null;
  shopify_orders?: number | null;
  shopify_new_customers?: number | null;
  meta_spend?: number | null;
  google_ads_spend?: number | null;
  gross_margin_percent?: number | null;
  average_shipping_cost?: number | null;
  average_fulfillment_cost?: number | null;
  refund_rate_percent?: number | null;
  target_cac?: number | null;
};

const n = (v: number | null | undefined) => (typeof v === "number" && !isNaN(v) ? v : 0);

export function computeBaseline(i: BaselineInput) {
  const revenue = n(i.shopify_revenue);
  const orders = n(i.shopify_orders);
  const newCustomers = n(i.shopify_new_customers);
  const totalSpend = n(i.meta_spend) + n(i.google_ads_spend);
  const aov = orders > 0 ? revenue / orders : 0;
  const grossMargin = (n(i.gross_margin_percent) || 0) / 100;
  const grossProfitPerOrder = aov * grossMargin;
  const refundRate = (n(i.refund_rate_percent) || 0) / 100;
  const refundAllowance = aov * refundRate;
  const shipping = n(i.average_shipping_cost);
  const fulfillment = n(i.average_fulfillment_cost);
  const breakEvenCac = grossProfitPerOrder - shipping - fulfillment - refundAllowance;
  const currentCac = newCustomers > 0 ? totalSpend / newCustomers : 0;
  const mer = totalSpend > 0 ? revenue / totalSpend : 0;
  const cacVsTarget = currentCac - n(i.target_cac);
  const cacVsBreakEven = currentCac - breakEvenCac;

  return {
    revenue_30d: revenue,
    total_ad_spend_30d: totalSpend,
    blended_mer: round(mer, 2),
    blended_cac: round(currentCac, 2),
    estimated_break_even_cac: round(breakEvenCac, 2),
    current_cac_vs_target: round(cacVsTarget, 2),
    current_cac_vs_break_even: round(cacVsBreakEven, 2),
    gross_profit_per_order: round(grossProfitPerOrder, 2),
    aov: round(aov, 2),
  };
}

function round(v: number, d = 2) {
  if (!isFinite(v)) return 0;
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

// ---------- Decision Scoring ----------
export type DecisionInput = {
  business_impact?: number;
  goal_alignment?: number;
  evidence_strength?: number;
  confidence_score?: number;
  ease_of_execution?: number;
  urgency?: number;
  risk?: number;
  dependency_level?: number;
};

export function computeDecision(d: DecisionInput) {
  const bi = n(d.business_impact);
  const ga = n(d.goal_alignment);
  const es = n(d.evidence_strength);
  const cf = n(d.confidence_score);
  const ee = n(d.ease_of_execution);
  const ur = n(d.urgency);
  const ri = n(d.risk);
  const de = n(d.dependency_level);
  const score = bi * 25 + ga * 20 + es * 20 + cf * 15 + ur * 10 + ee * 10 - ri * 15 - de * 10;

  let priority: string = "Low";
  if (score >= 350) priority = "P0";
  else if (score >= 275) priority = "P1";
  else if (score >= 200) priority = "P2";

  // overrides
  let override_note = "";
  if (ri === 5) { priority = "Needs Review"; override_note = "Risk maxed"; }
  if (de === 5) { priority = "Blocked"; override_note = "Dependency maxed"; }
  if (es <= 2 && cf <= 2) { priority = "Research Needed"; override_note = "Weak evidence & confidence"; }
  if (ga <= 2 && priority === "P0") { priority = "P1"; override_note = "Goal alignment too low for P0"; }

  return { decision_score: score, priority, override_note };
}

// ---------- Forecast ----------
export type ForecastHypo = {
  expected_lift_min?: number | null;
  expected_lift_base?: number | null;
  expected_lift_max?: number | null;
};

export function computeForecast(hs: ForecastHypo[], overlap: "heavy" | "normal" | "complementary" = "normal") {
  const discount = overlap === "heavy" ? 0.5 : overlap === "complementary" ? 0.85 : 0.7;
  const low = hs.reduce((s, h) => s + n(h.expected_lift_min), 0) * discount;
  const base = hs.reduce((s, h) => s + n(h.expected_lift_base), 0) * discount;
  const high = hs.reduce((s, h) => s + n(h.expected_lift_max), 0) * discount;
  return { expected_lift_low: round(low), expected_lift_base: round(base), expected_lift_high: round(high), discount };
}

export type ConfidenceInput = {
  data_quality?: number;
  evidence_strength?: number;
  goal_alignment?: number;
  execution_readiness?: number;
  tracking_confidence?: number;
  historical_similarity?: number;
  risk_penalty?: number;
  dependency_penalty?: number;
};

export function computeConfidence(c: ConfidenceInput) {
  const score =
    n(c.data_quality) + n(c.evidence_strength) + n(c.goal_alignment) +
    n(c.execution_readiness) + n(c.tracking_confidence) + n(c.historical_similarity) -
    n(c.risk_penalty) - n(c.dependency_penalty);
  const clamped = Math.max(0, Math.min(100, score));
  let label = "Low";
  if (clamped >= 85) label = "Very High";
  else if (clamped >= 70) label = "High";
  else if (clamped >= 50) label = "Medium";
  return { confidence_score: clamped, confidence_label: label };
}

// ---------- Live Optimization classification ----------
export function classifyLiveProblem(r: {
  spend_target?: number | null; spend_actual?: number | null;
  cac_target?: number | null; cac_actual?: number | null;
  mer_target?: number | null; mer_actual?: number | null;
  tracking_ok?: boolean;
  constraint?: boolean;
}) {
  if (r.constraint) return "Constraint Problem";
  if (r.tracking_ok === false) return "Tracking Problem";
  const spendLow = n(r.spend_actual) < n(r.spend_target) * 0.9;
  const cacHigh = n(r.cac_actual) > n(r.cac_target) * 1.1;
  const merLow = n(r.mer_actual) < n(r.mer_target) * 0.9;
  if (spendLow && !cacHigh && !merLow) return "Volume Problem";
  if (!spendLow && (cacHigh || merLow)) return "Efficiency Problem";
  if (spendLow && (cacHigh || merLow)) return "Mixed Problem";
  return "On Track";
}
