import { describe, expect, it } from "vitest";
import { runDataAnalystFoundation, type AnalystDailyRow } from "./dataAnalystFoundation";
import type { CustomerTransaction } from "./customerCohorts";

function makeTransactions(): CustomerTransaction[] {
  const rows: CustomerTransaction[] = [];
  for (let i = 0; i < 100; i += 1) {
    const month = i < 34 ? "01" : i < 67 ? "02" : "03";
    rows.push({
      customer_id: `customer-${i}`,
      transaction_date: `2026-${month}-05`,
      order_id: `order-${i}`,
      revenue: 100,
      gross_profit: 55,
      source: "integration",
    });
  }

  rows.push(
    { customer_id: "customer-0", transaction_date: "2026-02-05", order_id: "repeat-1", revenue: 40, gross_profit: 22 },
    { customer_id: "customer-1", transaction_date: "2026-03-05", order_id: "repeat-2", revenue: 45, gross_profit: 25 },
  );

  return rows;
}

function makeDailyRows(actualRevenue = 950): AnalystDailyRow[] {
  return Array.from({ length: 7 }, (_, index) => ({
    id: `day-${index + 1}`,
    target_date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    target_revenue: 1000,
    target_ad_spend: 200,
    target_orders: 20,
    target_leads: 0,
    projection_revenue: 1000,
    projection_ad_spend: 200,
    projection_orders: 20,
    projection_leads: 0,
    actual_revenue: actualRevenue,
    actual_ad_spend: 190,
    actual_orders: 18,
    actual_leads: 0,
  }));
}

describe("data analyst foundation", () => {
  it("blocks analysis when the required datasets are empty", () => {
    const output = runDataAnalystFoundation({
      transactions: [],
      dailyTargets: [],
      projectionUpdates: [],
      nowIso: "2026-07-15T00:00:00.000Z",
    });

    expect(output.readiness).toBe("BLOCKED");
    expect(output.score).toBeLessThan(45);
    expect(output.coverage.valid_transactions).toBe(0);
    expect(output.checks.find((check) => check.id === "transactions_present")?.status).toBe("fail");
    expect(output.model_card.next_statistical_upgrade).toContain("confidence intervals and backtesting");
  });

  it("marks a client ready for advanced analysis when cohort and P&L data are complete", () => {
    const output = runDataAnalystFoundation({
      transactions: makeTransactions(),
      dailyTargets: makeDailyRows(),
      projectionUpdates: [
        { id: "update-1", scope: "daily", metric_name: "projection_revenue", created_at: "2026-07-14T12:00:00.000Z" },
      ],
      nowIso: "2026-07-15T00:00:00.000Z",
    });

    expect(output.readiness).toBe("READY_FOR_ADVANCED_ANALYSIS");
    expect(output.score).toBe(100);
    expect(output.coverage.unique_customers).toBe(100);
    expect(output.coverage.acquisition_cohorts).toBe(3);
    expect(output.coverage.cohort_age_columns).toBeGreaterThanOrEqual(3);
    expect(output.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("surfaces projection variance as an analyst signal", () => {
    const output = runDataAnalystFoundation({
      transactions: makeTransactions(),
      dailyTargets: makeDailyRows(850),
      projectionUpdates: [
        { scope: "daily", metric_name: "projection_revenue", created_at: "2026-07-14T12:00:00.000Z" },
      ],
      nowIso: "2026-07-15T00:00:00.000Z",
    });

    const revenueSignal = output.signals.find((signal) => signal.id === "revenue_vs_projection");

    expect(revenueSignal?.severity).toBe("critical");
    expect(revenueSignal?.value).toBe("-15%");
    expect(revenueSignal?.next_action).toContain("Review media spend");
  });

  it("keeps profit-aware analysis in warning state when gross profit is missing", () => {
    const transactions = makeTransactions().map(({ gross_profit, ...tx }) => tx);
    const output = runDataAnalystFoundation({
      transactions,
      dailyTargets: makeDailyRows(),
      projectionUpdates: [],
      nowIso: "2026-07-15T00:00:00.000Z",
    });

    expect(output.coverage.gross_profit_coverage_pct).toBe(0);
    expect(output.checks.find((check) => check.id === "gross_profit_coverage")?.status).toBe("fail");
    expect(output.signals.find((signal) => signal.id === "gross_profit_gap")?.severity).toBe("warning");
  });
});
