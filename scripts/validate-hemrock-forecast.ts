// Golden tests for Hemrock forecast replica.
// Cross-validated against the "Ecommerce Forecasting Tool by Hemrock" default
// inputs (see /mnt/user-uploads/Ecommerce_Forecasting_Tool_by_Hemrock-2.xlsx).
import { runHemrockForecast, buildRetentionCurve } from "../src/gos/hemrockForecast";

let pass = 0, fail = 0;
function assert(name: string, cond: boolean, got?: unknown, want?: unknown) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} — got=${JSON.stringify(got)} want=${JSON.stringify(want)}`); }
}
function near(a: number, b: number, tol = 0.02) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)); }

console.log("Golden 1 — Retention curve (churn 50% / cycle 3)");
{
  const rc = buildRetentionCurve(0.5, 3, 12);
  assert("t=1 → 1.0", rc[1] === 1);
  assert("t=2 → 0", rc[2] === 0);
  assert("t=4 → 0.5", near(rc[4], 0.5));
  assert("t=7 → 0.25", near(rc[7], 0.25));
  assert("t=10 → 0.125", near(rc[10], 0.125));
}

console.log("\nGolden 2 — Hemrock default scenario (48mo)");
{
  const out = runHemrockForecast({
    horizon_months: 48,
    aov_new: 50, aov_repeat: 40,
    aov_rate_start: 0.10, aov_rate_change: -0.05,
    cos_pct: 0.25, cos_pct_extra_1: 0.10, cos_pct_extra_2: 0.0,
    cos_rate_start: 0, cos_rate_change: 0,
    cac_new: 30, cac_repeat: 10,
    cac_rate_start: 0, cac_rate_change: 0,
    starting_new_customers: 550,
    growth_rate_start: 0.90, growth_rate_change: -0.15,
    conversion_rate: 0.02,
    churn_per_cycle: 0.5, repeat_cycle_months: 3,
    shipping_revenue_per_order: 0, shipping_cost_per_order: 0,
  });
  assert("engine version", out.engine_version === "hemrock_forecast_replica_v1");
  assert("48 monthly rows", out.monthly.length === 48);
  assert("4 annual rows", out.annual.length === 4);
  assert("month 1 new customers = 550", out.monthly[0].new_customers === 550);
  assert("month 1 orders_new = 550 (retention[1]=1)", near(out.monthly[0].orders_new, 550));
  assert("month 1 revenue = 550*50", near(out.monthly[0].revenue, 27500));
  // Retention curve @ cycle 3, churn 0.5 → lifetime orders = 1 + 0.5 + 0.25 + ... (bounded by 48mo → 16 cycles)
  assert("lifetime orders ≈ 2", near(out.lifetime_orders, 2, 0.05));
  assert("year 1 has orders > 0", out.annual[0].orders > 0);
  assert("LTV > 0", out.ltv_final > 0);
}

console.log("\nGolden 3 — No churn, cycle 1 → linear repeat");
{
  const out = runHemrockForecast({
    horizon_months: 12,
    aov_new: 100, aov_repeat: 100,
    aov_rate_start: 0, aov_rate_change: 0,
    cos_pct: 0, cac_new: 0, cac_repeat: 0,
    starting_new_customers: 10,
    growth_rate_start: 0, growth_rate_change: 0,
    conversion_rate: 0.01,
    churn_per_cycle: 0, repeat_cycle_months: 1,
  });
  // Cohort 1 (10 customers) each generates 1 order every month → month 12 has 12*10=120 orders
  assert("month 12 orders = 120 (10 cohorts × 12mo × 1 order)", near(out.monthly[11].orders_total, 120, 0.001));
  assert("lifetime orders = 12", near(out.lifetime_orders, 12));
}

console.log("\nGolden 4 — Zero growth, high churn → cohorts extinct fast");
{
  const out = runHemrockForecast({
    horizon_months: 12,
    aov_new: 50, aov_repeat: 50,
    aov_rate_start: 0, aov_rate_change: 0,
    cos_pct: 0.3, cac_new: 10, cac_repeat: 5,
    starting_new_customers: 100,
    growth_rate_start: 0, growth_rate_change: 0,
    conversion_rate: 0.02,
    churn_per_cycle: 1.0, repeat_cycle_months: 3, // 100% churn = 0 repeat
  });
  assert("month 4 orders = new only (100)", near(out.monthly[3].orders_total, 100));
  assert("no repeat orders ever", out.monthly.every((m) => m.orders_repeat === 0));
}

console.log(`\n${pass}/${pass + fail} golden checks passed.`);
if (fail > 0) process.exit(1);
