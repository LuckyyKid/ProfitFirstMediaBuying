import { describe, expect, it } from "vitest";
import { runThreeCohortForecast, type ThreeCohortForecastInput } from "./threeCohortForecast";

const baseInput: ThreeCohortForecastInput = {
  period_start: "2026-07-01",
  period_end: "2026-07-31",
  planned_new_customers: 50,
  planned_new_customer_revenue: 6_000,
  planned_ad_spend: 2_500,
  gross_margin_rate: 60,
  transactions: [
    { customer_id: "recent-a", transaction_date: "2026-05-01", order_id: "r1", revenue: 120, gross_profit: 72 },
    { customer_id: "recent-a", transaction_date: "2026-06-15", order_id: "r2", revenue: 90, gross_profit: 54 },
    { customer_id: "recent-b", transaction_date: "2026-02-10", order_id: "r3", revenue: 80, gross_profit: 48 },
    { customer_id: "old-active", transaction_date: "2025-06-01", order_id: "o1", revenue: 100, gross_profit: 60 },
    { customer_id: "old-active", transaction_date: "2026-06-10", order_id: "o2", revenue: 200, gross_profit: 100 },
    { customer_id: "lapsed", transaction_date: "2024-01-10", order_id: "l1", revenue: 100, gross_profit: 50 },
    { customer_id: "lapsed", transaction_date: "2024-06-10", order_id: "l2", revenue: 70, gross_profit: 35 },
    { customer_id: "future", transaction_date: "2026-07-10", order_id: "f1", revenue: 999, gross_profit: 500 },
  ],
};

describe("three cohort forecast", () => {
  it("separates new, recently acquired 180d, active non-recent, and lapsed customers", () => {
    const output = runThreeCohortForecast(baseInput);

    expect(output.engine_version).toBe("three_cohort_forecast_v1");
    expect(output.horizon_days).toBe(31);
    expect(output.cohorts.new_customers.projected_revenue).toBe(6_000);
    expect(output.cohorts.new_customers.projected_gross_profit).toBe(3_600);
    expect(output.cohorts.new_customers.contribution_after_ads).toBe(1_100);

    expect(output.cohorts.recently_acquired_180d.customer_count).toBe(2);
    expect(output.cohorts.recently_acquired_180d.trailing_returning_revenue).toBe(90);
    expect(output.cohorts.recently_acquired_180d.projected_revenue).toBe(31);

    expect(output.cohorts.active_non_recent.customer_count).toBe(1);
    expect(output.cohorts.active_non_recent.trailing_returning_revenue).toBe(200);
    expect(output.cohorts.active_non_recent.projected_revenue).toBe(68.89);

    expect(output.totals.projected_returning_revenue).toBe(99.89);
    expect(output.totals.projected_revenue).toBe(6099.89);
    expect(output.diagnostics.lapsed_customers).toBe(1);
    expect(output.diagnostics.ignored_future_transactions).toBe(1);
    expect(output.conditions.join(" ")).toContain("ignored");
  });

  it("keeps returning forecast at zero and surfaces missing data without transactions", () => {
    const output = runThreeCohortForecast({
      ...baseInput,
      transactions: [],
    });

    expect(output.totals.projected_new_customer_revenue).toBe(6_000);
    expect(output.totals.projected_returning_revenue).toBe(0);
    expect(output.missing_data).toContain("transactions");
    expect(output.conditions.join(" ")).toContain("normalized customer transactions");
  });

  it("uses gross margin fallback when returning gross profit is missing", () => {
    const output = runThreeCohortForecast({
      ...baseInput,
      transactions: [
        { customer_id: "recent-a", transaction_date: "2026-05-01", order_id: "r1", revenue: 120 },
        { customer_id: "recent-a", transaction_date: "2026-06-15", order_id: "r2", revenue: 90 },
      ],
      gross_margin_rate: 50,
    });

    expect(output.cohorts.recently_acquired_180d.projected_revenue).toBe(31);
    expect(output.cohorts.recently_acquired_180d.projected_gross_profit).toBe(15.5);
    expect(output.missing_data).not.toContain("recently_acquired_180d.gross_profit or gross_margin_rate");
  });

  it("flags gross profit when neither gross profit nor gross margin is available", () => {
    const output = runThreeCohortForecast({
      ...baseInput,
      transactions: [
        { customer_id: "recent-a", transaction_date: "2026-05-01", order_id: "r1", revenue: 120 },
        { customer_id: "recent-a", transaction_date: "2026-06-15", order_id: "r2", revenue: 90 },
      ],
      gross_margin_rate: 0,
    });

    expect(output.missing_data).toContain("gross_margin_rate");
    expect(output.missing_data).toContain("recently_acquired_180d.gross_profit or gross_margin_rate");
    expect(output.cohorts.recently_acquired_180d.projected_gross_profit).toBe(0);
  });
});
