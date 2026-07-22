// scripts/bench-engines.ts
//
// Times every user-triggered pure engine in src/gos with representative
// happy-path inputs (copied from the vitest suites). We warm up 200 calls
// then time N iterations, reporting min / p50 / p95 / max in µs and the
// derived ops/sec.
//
// Run: `npm run bench:engines`

import { performance } from "node:perf_hooks";

import { projectGrowthScenario } from "../src/gos/forecastProjection";
import { runForecastBayesianV2 } from "../src/gos/forecastBayesianV2";
import { runAttributionTargetEngine } from "../src/gos/attributionTargetEngine";
import { runChannelAllocation } from "../src/gos/channelAllocation";
import { runCreativeDemand } from "../src/gos/creativeDemand";
import { runUnitEconomicsTargetEngine } from "../src/gos/unitEconomicsTargetEngine";
import { runThreeCohortForecast } from "../src/gos/threeCohortForecast";
import { runEventEffectV2 } from "../src/gos/eventEffectV2";
import { buildDailyGrowthMap } from "../src/gos/dailyGrowthMap";
import { buildCustomerCohortAnalysis } from "../src/gos/customerCohorts";
import { computePredictiveLtvCac } from "../src/gos/ltvCac";
import {
  idealDailyBudget,
  budgetStatus,
  groupDailyBudgetCampaigns,
  computeDailyBudgetTotals,
  type DailyBudgetCampaign,
  type DailyBudgetCategory,
} from "../src/gos/dailyBudgetPlanner";

// -- small helper ------------------------------------------------------------

type Bench = { name: string; fn: () => unknown };

function time(fn: () => unknown, iterations: number): number[] {
  const samples = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples[i] = performance.now() - t0;
  }
  return samples;
}

function fmtUs(ms: number): string {
  const us = ms * 1000;
  if (us < 1) return us.toFixed(2) + " µs";
  if (us < 1000) return us.toFixed(1) + " µs";
  return (us / 1000).toFixed(2) + " ms";
}

function fmtOps(msPerCall: number): string {
  if (msPerCall <= 0) return "∞";
  const ops = 1000 / msPerCall;
  return ops >= 1000 ? (ops / 1000).toFixed(1) + "k/s" : ops.toFixed(0) + "/s";
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    min: sorted[0],
    p50: p(0.5),
    p95: p(0.95),
    max: sorted[sorted.length - 1],
  };
}

function run(benches: Bench[], iterations = 5000, warmup = 200) {
  const nameWidth = Math.max(...benches.map((b) => b.name.length));
  console.log(
    "engine".padEnd(nameWidth) +
      "  " + "median".padStart(10) +
      "  " + "p95".padStart(10) +
      "  " + "max".padStart(10) +
      "  " + "ops/sec".padStart(10),
  );
  console.log("-".repeat(nameWidth + 46));
  for (const b of benches) {
    // Warmup — lets V8 tier up to optimized code.
    for (let i = 0; i < warmup; i++) b.fn();
    const samples = time(b.fn, iterations);
    const s = stats(samples);
    console.log(
      b.name.padEnd(nameWidth) +
        "  " + fmtUs(s.p50).padStart(10) +
        "  " + fmtUs(s.p95).padStart(10) +
        "  " + fmtUs(s.max).padStart(10) +
        "  " + fmtOps(s.p50).padStart(10),
    );
  }
}

// -- Representative inputs (from src/gos/*.test.ts) --------------------------

const forecastEcomInput = {
  client: { business_type: "ECOMMERCE" },
  financialInputs: { aov: 60, gross_margin_percent: 50, target_cac: 30 },
  quantitativeBaseline: { ad_spend_30d: 12000, orders_30d: 1000, new_customers_30d: 300 },
  scenario: "BASE",
  horizonDays: 30,
};

const forecastLocalInput = {
  client: { business_type: "LOCAL_SERVICE" },
  financialInputs: { avg_job_value: 500, aov: 100, gross_margin_percent: 40, target_cpl: 50 },
  quantitativeBaseline: { ad_spend_30d: 1000, leads_30d: 20, jobs_closed_30d: 10 },
  scenario: "BASE",
  horizonDays: 30,
};

const bayesianInput = {
  metric: "revenue" as const,
  prior_mean: 100_000,
  prior_confidence: 0.75,
  observations: [98_000, 101_000, 103_000, 99_500, 102_500, 100_800, 101_200],
};

const attributionInput = {
  business_target_amr: 3,
  business_target_cac: 40,
  no_view_through: true,
  channels: [
    {
      channel_name: "Meta",
      platform: "meta" as const,
      reporting_window: "28_DAY_CLICK" as const,
      planned_spend: 1_000,
      delayed_attribution_multiplier: 0.9,
      includes_view_through: true,
      view_through_revenue_share: 0.2,
    },
  ],
};

const channelInput = {
  planned_ad_spend: 5_000,
  business_target_amr: 2.2,
  business_target_cac: 50,
  channels: [
    { channel_name: "Meta",   platform: "meta"   as const, allocation_weight: 3, incrementality_factor: 0.7 },
    { channel_name: "Google", platform: "google" as const, allocation_weight: 2, incrementality_factor: 0.9 },
  ],
};

const creativeInput = {
  weekly_spend: 20_000,
  avg_cpm: 10,
  fatigue_threshold_impressions: 200_000,
};

const unitEconInput = {
  offers: [
    {
      offer_name: "Core", sku: "CORE",
      price: 100, cogs_per_order: 35, shipping_cost_per_order: 8,
      fulfillment_cost_per_order: 4, payment_fee_rate: 0.03, refund_rate: 0.05,
      desired_contribution_per_order: 10, expected_orders: 20,
    },
  ],
};

const threeCohortInput = {
  period_start: "2026-07-01",
  period_end: "2026-07-31",
  planned_new_customers: 50,
  planned_new_customer_revenue: 6_000,
  planned_ad_spend: 2_500,
  gross_margin_rate: 60,
  transactions: [
    { customer_id: "recent-a", transaction_date: "2026-05-01", order_id: "r1", revenue: 120, gross_profit: 72 },
    { customer_id: "recent-a", transaction_date: "2026-06-15", order_id: "r2", revenue: 90,  gross_profit: 54 },
    { customer_id: "recent-b", transaction_date: "2026-02-10", order_id: "r3", revenue: 80,  gross_profit: 48 },
    { customer_id: "old-active", transaction_date: "2025-06-01", order_id: "o1", revenue: 100, gross_profit: 60 },
    { customer_id: "old-active", transaction_date: "2026-06-10", order_id: "o2", revenue: 200, gross_profit: 100 },
    { customer_id: "lapsed", transaction_date: "2024-01-10", order_id: "l1", revenue: 100, gross_profit: 50 },
    { customer_id: "lapsed", transaction_date: "2024-06-10", order_id: "l2", revenue: 70,  gross_profit: 35 },
  ],
} as Parameters<typeof runThreeCohortForecast>[0];

const eventEffectItsInput = {
  metric: "revenue" as const,
  pre_series: [100, 102, 98, 100, 101, 99, 100],
  post_series: [135, 138, 140, 142, 139, 141, 143],
};

const eventEffectDidInput = {
  metric: "revenue" as const,
  pre_series: [100, 102, 98, 100],
  post_series: [140, 142, 138, 140],
  control_pre_series: [80, 82, 78, 80],
  control_post_series: [90, 92, 88, 90],
};

function dgmDay(partial: Record<string, unknown> = {}) {
  return {
    target_date: "2026-07-01",
    target_revenue: 1_000, target_ad_spend: 300, target_orders: 10, target_new_customers: 7,
    target_returning_orders: 3, target_leads: 40, target_gross_profit: 600, target_contribution_margin: 300,
    projection_revenue: 950, projection_ad_spend: 290, projection_orders: 9, projection_leads: 38,
    projection_gross_profit: 570, projection_contribution_margin: 280,
    actual_revenue: 900, actual_new_customer_revenue: 600, actual_returning_revenue: 300,
    actual_ad_spend: 250, actual_orders: 9, actual_new_customers: 6, actual_returning_orders: 3,
    actual_leads: 35, actual_gross_profit: 540, actual_contribution_margin: 290,
    ...partial,
  } as Parameters<typeof buildDailyGrowthMap>[0]["days"][number];
}
const dailyGrowthMapInput = {
  client_id: "client-1",
  scope: "mtd" as const,
  as_of_date: "2026-07-04",
  days: [
    dgmDay({ target_date: "2026-07-01" }),
    dgmDay({ target_date: "2026-07-02" }),
    dgmDay({ target_date: "2026-07-03" }),
    dgmDay({ target_date: "2026-07-04" }),
  ],
};

const cohortTx = [
  { customer_id: "A", transaction_date: "2026-01-05", order_id: "1", revenue: 100, gross_profit: 50, acquisition_channel: "meta" },
  { customer_id: "A", transaction_date: "2026-02-02", order_id: "2", revenue: 80,  gross_profit: 40, acquisition_channel: "meta" },
  { customer_id: "A", transaction_date: "2026-02-20", order_id: "3", revenue: 20,  gross_profit: 10, acquisition_channel: "meta" },
  { customer_id: "B", transaction_date: "2026-01-15", order_id: "4", revenue: 60,  gross_profit: 30, acquisition_channel: "google" },
  { customer_id: "C", transaction_date: "2026-02-01", order_id: "5", revenue: 120, gross_profit: 60, acquisition_channel: "meta" },
];

const ltvInput = {
  horizon_months: 12, new_customers: 100, ad_spend: 2000, avg_order_value: 100,
  gross_margin_pct: 50, repeat_rate_pct: 25, purchase_frequency: 1, churn_rate_pct: 10,
};

const dailyBudgetCats: DailyBudgetCategory[] = [
  { id: "cat-1", name: "Prospecting", kind: "prospecting", target_cpa: 70, target_daily_budget: null },
  { id: "cat-2", name: "Retargeting", kind: "retargeting", target_cpa: null, target_daily_budget: null },
];
const dailyBudgetCamps: DailyBudgetCampaign[] = [
  { id: "camp-1", category_id: "cat-1", name: "Meta 1", platform: "meta",   current_daily_budget: 120, active: true },
  { id: "camp-2", category_id: "cat-1", name: "Meta 2", platform: "meta",   current_daily_budget: 80,  active: true },
  { id: "camp-3", category_id: "cat-2", name: "Google", platform: "google", current_daily_budget: 50,  active: false },
  { id: "camp-4", category_id: null,    name: "Un",     platform: "meta",   current_daily_budget: 30,  active: true },
];

// -- Bench list --------------------------------------------------------------

const benches: Bench[] = [
  { name: "projectGrowthScenario (ecom)",  fn: () => projectGrowthScenario(forecastEcomInput) },
  { name: "projectGrowthScenario (local)", fn: () => projectGrowthScenario(forecastLocalInput) },
  { name: "runForecastBayesianV2",         fn: () => runForecastBayesianV2(bayesianInput) },
  { name: "runAttributionTargetEngine",    fn: () => runAttributionTargetEngine(attributionInput) },
  { name: "runChannelAllocation",          fn: () => runChannelAllocation(channelInput) },
  { name: "runCreativeDemand",             fn: () => runCreativeDemand(creativeInput) },
  { name: "runUnitEconomicsTargetEngine",  fn: () => runUnitEconomicsTargetEngine(unitEconInput) },
  { name: "runThreeCohortForecast",        fn: () => runThreeCohortForecast(threeCohortInput) },
  { name: "runEventEffectV2 (ITS)",        fn: () => runEventEffectV2(eventEffectItsInput) },
  { name: "runEventEffectV2 (DID)",        fn: () => runEventEffectV2(eventEffectDidInput) },
  { name: "buildDailyGrowthMap",           fn: () => buildDailyGrowthMap(dailyGrowthMapInput) },
  { name: "buildCustomerCohortAnalysis",   fn: () => buildCustomerCohortAnalysis(cohortTx, { cadence: "month" }) },
  { name: "computePredictiveLtvCac",       fn: () => computePredictiveLtvCac(ltvInput) },
  { name: "dailyBudget: idealDailyBudget", fn: () => idealDailyBudget(70) },
  { name: "dailyBudget: budgetStatus",     fn: () => budgetStatus(85, 100) },
  { name: "dailyBudget: group + totals",   fn: () => {
    groupDailyBudgetCampaigns(dailyBudgetCats, dailyBudgetCamps);
    computeDailyBudgetTotals(dailyBudgetCats, dailyBudgetCamps);
  } },
];

console.log(`\nNode ${process.version} · ${process.platform}/${process.arch} · ${new Date().toISOString()}\n`);
run(benches, 5000, 200);
console.log("\nnote: p50/p95/max are per-call after 200 warmup iterations; ops/sec derived from p50\n");
