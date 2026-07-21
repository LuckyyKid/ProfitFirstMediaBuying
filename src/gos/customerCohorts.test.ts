import { describe, expect, it } from "vitest";
import {
  buildCustomerCohortAnalysis,
  buildSegmentedCustomerCohorts,
  prepareCustomerCohortTransactions,
  type CustomerTransaction,
} from "./customerCohorts";

const transactions: CustomerTransaction[] = [
  { customer_id: "A", transaction_date: "2026-01-05", order_id: "1", revenue: 100, gross_profit: 50, acquisition_channel: "meta" },
  { customer_id: "A", transaction_date: "2026-02-02", order_id: "2", revenue: 80, gross_profit: 40, acquisition_channel: "meta" },
  { customer_id: "A", transaction_date: "2026-02-20", order_id: "3", revenue: 20, gross_profit: 10, acquisition_channel: "meta" },
  { customer_id: "B", transaction_date: "2026-01-15", order_id: "4", revenue: 60, gross_profit: 30, acquisition_channel: "google" },
  { customer_id: "C", transaction_date: "2026-02-01", order_id: "5", revenue: 120, gross_profit: 60, acquisition_channel: "meta" },
  { customer_id: "", transaction_date: "2026-02-01", order_id: "bad", revenue: 999 },
];

describe("customer cohort analysis", () => {
  it("prepares acquisition dates and acquisition cohorts from transaction data", () => {
    const prepared = prepareCustomerCohortTransactions(transactions, "month");
    const customerA = prepared.filter((tx) => tx.customer_id === "A");

    expect(customerA.every((tx) => tx.acquisition_date === "2026-01-05")).toBe(true);
    expect(customerA.every((tx) => tx.acquisition_cohort === "2026-01")).toBe(true);
    expect(customerA.map((tx) => tx.age_index)).toEqual([0, 1, 1]);
  });

  it("builds a C3 matrix with unique customer survival, not transaction count survival", () => {
    const analysis = buildCustomerCohortAnalysis(transactions, { cadence: "month" });

    expect(analysis.acquisition_cohorts).toEqual([
      {
        acquisition_cohort: "2026-01",
        acquisition_period_index: 2026 * 12,
        acquisition_size: 2,
        first_purchase_revenue: 160,
        first_purchase_gross_profit: 80,
      },
      {
        acquisition_cohort: "2026-02",
        acquisition_period_index: 2026 * 12 + 1,
        acquisition_size: 1,
        first_purchase_revenue: 120,
        first_purchase_gross_profit: 60,
      },
    ]);
    expect(analysis.survival_matrix["2026-01"][0]).toBe(100);
    expect(analysis.survival_matrix["2026-01"][1]).toBe(50);
    expect(analysis.metric_matrix["2026-01"][1]).toBe(1);

    const febCell = analysis.cells.find((cell) => cell.acquisition_cohort === "2026-01" && cell.age_index === 1);
    expect(febCell?.orders).toBe(2);
    expect(febCell?.customers).toBe(1);
    expect(febCell?.revenue).toBe(100);
  });

  it("supports revenue metrics and period retention diagonals", () => {
    const analysis = buildCustomerCohortAnalysis(transactions, { cadence: "month", metric: "revenue" });

    expect(analysis.metric_matrix["2026-01"][0]).toBe(160);
    expect(analysis.metric_matrix["2026-01"][1]).toBe(100);
    expect(analysis.period_retention.map((p) => p.transaction_period)).toEqual(["2026-01", "2026-02"]);
    expect(analysis.period_retention.at(-1)?.active_customers).toBe(2);
    expect(analysis.period_retention.at(-1)?.retention_rate).toBe(66.7);
  });

  it("creates sortable weekly and quarterly periods", () => {
    const weekly = prepareCustomerCohortTransactions([
      { customer_id: "A", transaction_date: "2026-01-01" },
      { customer_id: "B", transaction_date: "2026-12-31" },
    ], "week");
    const quarterly = prepareCustomerCohortTransactions([
      { customer_id: "A", transaction_date: "2026-04-01" },
      { customer_id: "B", transaction_date: "2026-07-01" },
    ], "quarter");

    expect(weekly[0].transaction_period).toMatch(/^\d{4}-W\d{2}$/);
    expect(quarterly.map((tx) => tx.transaction_period)).toEqual(["2026-Q2", "2026-Q3"]);
  });

  it("can segment cohorts by acquisition channel", () => {
    const segmented = buildSegmentedCustomerCohorts(transactions, "acquisition_channel", { cadence: "month" });

    expect(Object.keys(segmented)).toEqual(["google", "meta", "unknown"]);
    expect(segmented.meta.acquisition_cohorts.length).toBe(2);
    expect(segmented.google.acquisition_cohorts[0].acquisition_size).toBe(1);
  });
});
