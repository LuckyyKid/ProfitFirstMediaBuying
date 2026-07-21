// Phase 7 — Deterministic financial validation runner.
// Usage: `bunx tsx scripts/validate-financial-formulas.ts` or `bun scripts/validate-financial-formulas.ts`
// Runs the 6 golden test cases + safety checks. Prints a QA report to stdout.

import {
  computeUnitEconomics,
  computeEcomBaseline,
  computeLocalBaseline,
  computeRetention,
  computeSpendingPower,
  computeMeasurement,
  computeProductProfile,
  computeOfferEconomics,
  computeLtgpToCac,
  computeInventoryGrade,
  computePnlSnapshot,
  computeOrderValueDistribution,
  computeFunnelEconomics,
  computeSkuDemandPlan,
  computeOpexBufferWarning,
} from "../src/gos/formulas";

type Check = { name: string; pass: boolean; expected: unknown; got: unknown };
const results: { title: string; checks: Check[] }[] = [];

const approx = (a: unknown, b: number, tol = 0.02) =>
  typeof a === "number" && Number.isFinite(a) && Math.abs(a - b) <= tol;

function record(title: string, checks: Check[]) { results.push({ title, checks }); }

// ---- Golden 1 : Unit Economics ----
{
  const o = computeUnitEconomics({
    aov: 58, cogs_per_order: 22, shipping_cost_per_order: 8,
    fulfillment_cost_per_order: 3, payment_processing_percent: 2, refund_rate_percent: 5,
    target_cac: 32,
  });
  record("Golden 1 — E-commerce Unit Economics", [
    { name: "payment_processing_cost = 1.16", pass: approx(o.payment_processing_cost, 1.16), expected: 1.16, got: o.payment_processing_cost },
    { name: "refund_cost = 2.90", pass: approx(o.refund_cost, 2.90), expected: 2.90, got: o.refund_cost },
    { name: "variable_cost_per_order = 37.06", pass: approx(o.variable_cost_per_order, 37.06), expected: 37.06, got: o.variable_cost_per_order },
    { name: "contribution_before_cac = 20.94", pass: approx(o.contribution_before_cac, 20.94), expected: 20.94, got: o.contribution_before_cac },
    { name: "break_even_cac = 20.94", pass: approx(o.break_even_cac, 20.94), expected: 20.94, got: o.break_even_cac },
    { name: "first_order_profit_at_target_cac = -11.06", pass: approx(o.first_order_profit_at_target_cac, -11.06), expected: -11.06, got: o.first_order_profit_at_target_cac },
    { name: "risk is HIGH or WARNING", pass: o.risk === "HIGH" || o.risk === "WARNING", expected: "HIGH|WARNING", got: o.risk },
    { name: "first_order_profitable === false", pass: o.first_order_profitable === false, expected: false, got: o.first_order_profitable },
  ]);
}

// ---- Golden 2 : E-commerce Baseline ----
{
  const o = computeEcomBaseline({
    revenue: 65000, ad_spend: 14000, new_customers: 380,
    aov: 58, gross_margin_percent: 52, target_cac: 32, target_mer: 5,
  });
  record("Golden 2 — E-commerce Baseline", [
    { name: "MER ≈ 4.64", pass: approx(o.mer, 4.64), expected: 4.64, got: o.mer },
    { name: "CAC ≈ 36.84", pass: approx(o.cac, 36.84), expected: 36.84, got: o.cac },
    { name: "Gross Profit = 33800", pass: approx(o.gross_profit, 33800, 1), expected: 33800, got: o.gross_profit },
    { name: "Contribution ≈ 19800", pass: approx(o.contribution_margin, 19800, 1), expected: 19800, got: o.contribution_margin },
    { name: "diagnosis = EFFICIENCY_PROBLEM", pass: o.diagnosis === "EFFICIENCY_PROBLEM", expected: "EFFICIENCY_PROBLEM", got: o.diagnosis },
  ]);
}

// ---- Golden 3 : Spending Power ----
{
  const o = computeSpendingPower({
    history: [
      { ad_spend: 10000, cac: 30, mer: 5.0 },
      { ad_spend: 12000, cac: 32, mer: 4.8 },
      { ad_spend: 14000, cac: 36, mer: 4.6 },
    ],
    planned_spend: 22000,
  });
  const avgCac = (30 + 32 + 36) / 3;
  const avgMer = (5.0 + 4.8 + 4.6) / 3;
  record("Golden 3 — Spending Power", [
    { name: "historical_max_spend = 14000", pass: o.historical_max_spend === 14000, expected: 14000, got: o.historical_max_spend },
    { name: "spend_increase_ratio ≈ 1.57", pass: approx(o.spend_increase_ratio, 1.57), expected: 1.57, got: o.spend_increase_ratio },
    { name: "spend_risk = HIGH", pass: o.spend_risk === "HIGH", expected: "HIGH", got: o.spend_risk },
    { name: "projected_cac > historical_avg_cac", pass: (o.projected_cac ?? 0) > avgCac, expected: `> ${avgCac}`, got: o.projected_cac },
    { name: "projected_mer < historical_avg_mer", pass: (o.projected_mer ?? Infinity) < avgMer, expected: `< ${avgMer}`, got: o.projected_mer },
    { name: "recommendation warns against jumping", pass: /ramp|do not|not directly|monitor/i.test(o.recommendation), expected: "warning text", got: o.recommendation },
  ]);
}

// ---- Golden 4 : Retention ----
{
  const o = computeRetention({
    first_order_revenue: 50000,
    returning_revenue_30d: 7500,
    returning_revenue_60d: 12500,
    returning_revenue_90d: 15000,
    returning_revenue_180d: 22500,
    contribution_before_cac: 20,
    payback_window_days: 90,
  });
  record("Golden 4 — Retention", [
    { name: "LTV lift 30d = 15%", pass: approx(o.ltv_lift_30d_pct, 15), expected: 15, got: o.ltv_lift_30d_pct },
    { name: "LTV lift 60d = 25%", pass: approx(o.ltv_lift_60d_pct, 25), expected: 25, got: o.ltv_lift_60d_pct },
    { name: "LTV lift 90d = 30%", pass: approx(o.ltv_lift_90d_pct, 30), expected: 30, got: o.ltv_lift_90d_pct },
    { name: "LTV lift 180d = 45%", pass: approx(o.ltv_lift_180d_pct, 45), expected: 45, got: o.ltv_lift_180d_pct },
    { name: "retention_quality HIGH", pass: o.retention_quality === "HIGH", expected: "HIGH", got: o.retention_quality },
    { name: "allowable_cac_with_ltv = 26", pass: approx(o.allowable_cac_with_ltv, 26), expected: 26, got: o.allowable_cac_with_ltv },
  ]);
}

// ---- Golden 5 : Local Service ----
{
  const o = computeLocalBaseline({
    leads: 100, qualified_leads: 60, booked_appointments: 30, jobs_closed: 12,
    revenue: 24000, ad_spend: 4000, gross_margin_percent: 45, average_job_value: 2000,
  });
  record("Golden 5 — Local Service Baseline", [
    { name: "CPL = 40", pass: approx(o.cpl, 40), expected: 40, got: o.cpl },
    { name: "cost_per_booked ≈ 133.33", pass: approx(o.cost_per_booked_appointment, 133.33), expected: 133.33, got: o.cost_per_booked_appointment },
    { name: "cost_per_job ≈ 333.33", pass: approx(o.cost_per_job, 333.33), expected: 333.33, got: o.cost_per_job },
    { name: "close_rate = 40%", pass: approx(o.close_rate, 40), expected: 40, got: o.close_rate },
    { name: "gross_profit = 10800", pass: approx(o.gross_profit, 10800, 1), expected: 10800, got: o.gross_profit },
    { name: "contribution = 6800", pass: approx(o.contribution_margin, 6800, 1), expected: 6800, got: o.contribution_margin },
    { name: "diagnosis flags SALES_EFFICIENCY", pass: o.diagnosis === "SALES_EFFICIENCY", expected: "SALES_EFFICIENCY", got: o.diagnosis },
  ]);
}

// ---- Golden 6 : Measurement ----
{
  const o = computeMeasurement({
    platform_reported_revenue: 18000, shopify_revenue: 12400,
    ad_spend: 2000, baseline_revenue: 15000, test_period_revenue: 19500,
  });
  record("Golden 6 — Measurement", [
    { name: "platform_to_shopify_gap ≈ 45.16%", pass: approx(o.platform_to_shopify_gap_percent, 45.16, 0.1), expected: 45.16, got: o.platform_to_shopify_gap_percent },
    { name: "tracking_risk = HIGH", pass: o.tracking_risk === "HIGH", expected: "HIGH", got: o.tracking_risk },
    { name: "observed_lift_revenue = 4500", pass: approx(o.observed_lift_revenue, 4500, 1), expected: 4500, got: o.observed_lift_revenue },
    { name: "estimated_i_roas = 2.25", pass: approx(o.estimated_i_roas, 2.25), expected: 2.25, got: o.estimated_i_roas },
    { name: "warning about Meta ROAS present", pass: /meta rOAS|do not rely/i.test(o.warning), expected: "warning", got: o.warning },
  ]);
}

// ---- Safety : divide-by-zero, nulls, NaN, Infinity ----
{
  const ue = computeUnitEconomics({
    aov: null, cogs_per_order: 22, shipping_cost_per_order: 8, fulfillment_cost_per_order: 3,
    payment_processing_percent: 2, refund_rate_percent: 5, target_cac: 32,
  });
  const eb = computeEcomBaseline({
    revenue: 1000, ad_spend: 0, new_customers: 0, aov: 0,
    gross_margin_percent: 50,
  });
  const lb = computeLocalBaseline({
    leads: 0, qualified_leads: 0, booked_appointments: 0, jobs_closed: 0,
    revenue: 0, ad_spend: 0, gross_margin_percent: 45, average_job_value: 2000,
  });
  const sp = computeSpendingPower({ history: [], planned_spend: 22000 });
  const ms = computeMeasurement({
    platform_reported_revenue: null, shopify_revenue: null,
    ad_spend: 0, baseline_revenue: null, test_period_revenue: null,
  });
  const noNan = (obj: unknown): boolean =>
    JSON.stringify(obj, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v))
      .indexOf("__BAD__") === -1;

  record("Safety — nulls / zeros / NaN / Infinity", [
    { name: "UE with null aov reports missing_data", pass: ue.missing_data.includes("aov"), expected: "aov in missing_data", got: ue.missing_data },
    { name: "Ecom baseline no NaN/Infinity on divide-by-zero", pass: noNan(eb), expected: "clean", got: eb },
    { name: "Ecom baseline MER/CAC null on zero spend", pass: eb.mer === null && eb.cac === null, expected: "null,null", got: [eb.mer, eb.cac] },
    { name: "Local baseline no NaN/Infinity", pass: noNan(lb), expected: "clean", got: lb },
    { name: "Spending power reports missing_data on empty history", pass: sp.spend_risk === "UNKNOWN", expected: "UNKNOWN", got: sp.spend_risk },
    { name: "Measurement handles all-null inputs cleanly", pass: noNan(ms) && ms.tracking_risk === "UNKNOWN", expected: "UNKNOWN + no NaN", got: ms },
  ]);
}

// ================================================================
// Phase 11A.0 — Ecommerce Financial Model expansion tests
// ================================================================

// ---- Golden 7 : Product margin vs true gross margin ----
{
  // price=100, product_cost=30, shipping=11, pick_pack=4, payment_processing (as absolute)=3,
  // landed_cost=4, refund+discount allowance total = 15 (loaded as landed via allowance semantics not %).
  // We wire the loose-cost fields directly (allowance % kept at 0 to match plain absolute-cost spec).
  const o = computeProductProfile({
    price: 100,
    product_cost: 30,
    landed_cost: 4,
    freight_cost: 0,
    duties_tariffs: 0,
    shipping_cost_to_customer: 11,
    pick_pack_cost: 4,
    payment_processing_percent: 3,        // 3% of 100 = 3
    refund_allowance_percent: 15,         // 15% of 100 = 15
    discount_allowance_percent: 9,        // 9% of 100 = 9 → allowances = 24 to hit CoD=76 per spec
  });
  record("Golden 7 — Product margin vs true gross margin", [
    { name: "product_margin = 70", pass: approx(o.product_margin, 70), expected: 70, got: o.product_margin },
    { name: "cost_of_delivery = 76", pass: approx(o.cost_of_delivery, 76), expected: 76, got: o.cost_of_delivery },
    { name: "true_gross_profit = 24", pass: approx(o.true_gross_profit, 24), expected: 24, got: o.true_gross_profit },
    { name: "true_gross_margin_percent = 24", pass: approx(o.true_gross_margin_percent, 24), expected: 24, got: o.true_gross_margin_percent },
  ]);
}

// ---- Golden 8 : Discount economics ----
{
  // base=100, gross profit before discount = 40 → COGS+variable = 60. discount 30%.
  // discounted_price=70. gp_after = 70 - 60 = 10. break_even_roas = 70/10 = 7.
  const o = computeOfferEconomics({
    base_price: 100, discount_percent: 30, cogs: 60,
  });
  record("Golden 8 — Discount economics", [
    { name: "discounted_price = 70", pass: approx(o.discounted_price, 70), expected: 70, got: o.discounted_price },
    { name: "gross_profit_after_offer = 10", pass: approx(o.gross_profit_after_offer, 10), expected: 10, got: o.gross_profit_after_offer },
    { name: "break_even_roas_after_offer = 7", pass: approx(o.break_even_roas_after_offer, 7), expected: 7, got: o.break_even_roas_after_offer },
    { name: "offer flagged HIGH_RISK for acquisition", pass: o.offer_viability === "HIGH_RISK" || o.offer_viability === "NOT_VIABLE_FOR_ACQUISITION", expected: "HIGH_RISK", got: o.offer_viability },
  ]);
}

// ---- Golden 9 : LTGP:CAC ----
{
  const o = computeLtgpToCac(100, 33);
  record("Golden 9 — LTGP:CAC", [
    { name: "ltgp_to_cac ≈ 3.03", pass: approx(o.ltgp_to_cac, 3.03), expected: 3.03, got: o.ltgp_to_cac },
    { name: "classification HEALTHY or UNDER_SPENDING", pass: o.classification === "HEALTHY" || o.classification === "UNDER_SPENDING", expected: "HEALTHY|UNDER_SPENDING", got: o.classification },
  ]);
}

// ---- Golden 10 : Inventory grade ----
{
  const o = computeInventoryGrade({ inventory_units: 400, daily_sales_velocity: 1 });
  record("Golden 10 — Inventory grade", [
    { name: "days_of_inventory_on_hand = 400", pass: approx(o.days_of_inventory_on_hand, 400), expected: 400, got: o.days_of_inventory_on_hand },
    { name: "inventory_grade = D", pass: o.inventory_grade === "D", expected: "D", got: o.inventory_grade },
    { name: "strategy mentions cash recovery / liquidation", pass: /cash recovery|liquidation/i.test(o.recommended_media_strategy), expected: "cash recovery", got: o.recommended_media_strategy },
  ]);
}

// ---- Golden 11 : P&L snapshot ----
{
  const o = computePnlSnapshot({
    net_revenue: 100, cost_of_delivery: 40, marketing_expense: 20, opex: 20, interest_expense: 10,
  });
  record("Golden 11 — P&L snapshot", [
    { name: "gross_profit = 60", pass: approx(o.gross_profit, 60), expected: 60, got: o.gross_profit },
    { name: "contribution_margin = 40", pass: approx(o.contribution_margin, 40), expected: 40, got: o.contribution_margin },
    { name: "ebitda = 20", pass: approx(o.ebitda, 20), expected: 20, got: o.ebitda },
    { name: "net_profit = 10", pass: approx(o.net_profit, 10), expected: 10, got: o.net_profit },
  ]);
}

// ================================================================
// Phase 11A.0.1 — AOV distribution, funnel, SKU demand, OPEX
// ================================================================

// ---- Golden 12 : AOV average vs modal risk ----
{
  // Synthesize a distribution with avg ≈ 94 and modal ≈ 47.
  // Many small orders around 47, few big ones around 300.
  const many = Array.from({ length: 25 }, () => 47);
  const big = Array.from({ length: 5 }, () => 329);
  const values = [...many, ...big]; // avg = (25*47 + 5*329)/30 = (1175+1645)/30 = 94
  const o = computeOrderValueDistribution({ order_values: values, bucket_size: 50 });
  record("Golden 12 — AOV average vs modal risk", [
    { name: "avg_order_value ≈ 94", pass: approx(o.avg_order_value, 94, 1), expected: 94, got: o.avg_order_value },
    { name: "modal_order_value in low bucket (< 60)", pass: (o.modal_order_value ?? 0) < 60, expected: "< 60", got: o.modal_order_value },
    { name: "long_tail_risk = HIGH", pass: o.long_tail_risk === "HIGH", expected: "HIGH", got: o.long_tail_risk },
    { name: "warning about AOV overstating CAC", pass: !!o.warning && /overstate|misleading/i.test(o.warning), expected: "warning", got: o.warning },
  ]);
}

// ---- Golden 13 : Funnel economics not first-order profitable ----
{
  const o = computeFunnelEconomics({
    funnel_name: "Hero SKU CBO", funnel_type: "SINGLE_PRODUCT",
    expected_order_value: 47, contribution_before_cac: 18, target_cac: 30,
  });
  record("Golden 13 — Funnel economics", [
    { name: "first_order_profit_at_target_cac = -12", pass: approx(o.first_order_profit_at_target_cac, -12), expected: -12, got: o.first_order_profit_at_target_cac },
    { name: "first_order_profitable === false", pass: o.first_order_profitable === false, expected: false, got: o.first_order_profitable },
    { name: "warnings include not first-order profitable", pass: o.warnings.some((w: string) => /profitable/i.test(w)), expected: "profitability warning", got: o.warnings },
  ]);
}

// ---- Golden 14 : SKU demand plan inventory constraint ----
{
  const o = computeSkuDemandPlan({ forecasted_units: 650, available_inventory: 500 });
  record("Golden 14 — SKU demand plan constraint", [
    { name: "projected_inventory_after_plan = -150", pass: approx(o.projected_inventory_after_plan, -150), expected: -150, got: o.projected_inventory_after_plan },
    { name: "inventory_risk = HIGH", pass: o.inventory_risk === "HIGH", expected: "HIGH", got: o.inventory_risk },
    { name: "marketing_priority is LIMIT or DO_NOT_PUSH", pass: o.marketing_priority === "LIMIT" || o.marketing_priority === "DO_NOT_PUSH", expected: "LIMIT|DO_NOT_PUSH", got: o.marketing_priority },
  ]);
}

// ---- Golden 15 : Grade C/D inventory cash recovery ----
{
  const o = computeSkuDemandPlan({ forecasted_units: 30, available_inventory: 400, inventory_grade: "D" });
  record("Golden 15 — Grade D cash recovery", [
    { name: "paid_media_action = LIQUIDATE_INVENTORY or BUILD_DEDICATED_FUNNEL", pass: o.paid_media_action === "LIQUIDATE_INVENTORY" || o.paid_media_action === "BUILD_DEDICATED_FUNNEL", expected: "LIQUIDATE|BUILD_DEDICATED", got: o.paid_media_action },
    { name: "explanation mentions cash-flow / recovery", pass: /cash|recovery|liquidat/i.test(o.explanation), expected: "cash recovery text", got: o.explanation },
  ]);
}

// ---- Golden 16 : OPEX buffer warning ----
{
  const o = computeOpexBufferWarning({
    use_opex_buffer: true, opex_buffer_type: "PERCENT_OF_REVENUE",
    opex_buffer_percent_of_revenue: 15,
  });
  record("Golden 16 — OPEX buffer warning", [
    { name: "applied === true", pass: o.applied === true, expected: true, got: o.applied },
    { name: "warning mentions fixed OPEX not linearly variable", pass: !!o.warning && /fixed opex|linearly|scale/i.test(o.warning), expected: "warning text", got: o.warning },
  ]);
}

// ---- Report ----
let total = 0, passed = 0;
const lines: string[] = [];
for (const g of results) {
  lines.push(`\n### ${g.title}`);
  for (const c of g.checks) {
    total++; if (c.pass) passed++;
    lines.push(`  ${c.pass ? "✅" : "❌"} ${c.name}` + (c.pass ? "" : `  (expected=${JSON.stringify(c.expected)}, got=${JSON.stringify(c.got)})`));
  }
}
const header = `# Financial Formula Validation — ${passed}/${total} checks passed\n`;
const body = header + lines.join("\n") + "\n";
console.log(body);

// Persist for QA report
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync(".lovable", { recursive: true });
writeFileSync(".lovable/financial-validation-results.md", body);

if (passed !== total) process.exit(1);
