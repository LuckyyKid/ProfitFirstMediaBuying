import { describe, expect, it } from "vitest";
import {
  computeVariancePct,
  computeWeeklyRevenueVariance,
  splitMetricTargetIntoWeeks,
} from "./weeklyPnlTargets";

describe("weekly P&L target model", () => {
  it("splits metric targets into dated weekly rows", () => {
    const rows = splitMetricTargetIntoWeeks({
      id: "target-1",
      target_revenue: 100_000,
      target_ad_spend: 25_000,
      target_orders: 1000,
      target_leads: 250,
      target_gross_profit: 55_000,
      target_cac: 40,
      target_mer: 4,
    }, 4, "2026-07-06");

    expect(rows).toHaveLength(4);
    expect(rows[0].week_start).toBe("2026-07-06");
    expect(rows[0].week_end).toBe("2026-07-12");
    expect(rows[3].week_start).toBe("2026-07-27");
    expect(rows.every((row) => row.parent_target_id === "target-1")).toBe(true);
    expect(rows.reduce((sum, row) => sum + (row.target_revenue ?? 0), 0)).toBe(100_000);
    expect(rows.reduce((sum, row) => sum + (row.target_orders ?? 0), 0)).toBe(1000);
  });

  it("preserves totals when targets do not divide evenly", () => {
    const rows = splitMetricTargetIntoWeeks({
      id: "target-1",
      target_revenue: 100,
      target_orders: 10,
    }, 3, "2026-07-01");

    expect(rows.map((row) => row.target_revenue)).toEqual([34, 33, 33]);
    expect(rows.map((row) => row.target_orders)).toEqual([4, 3, 3]);
    expect(rows.reduce((sum, row) => sum + (row.target_revenue ?? 0), 0)).toBe(100);
    expect(rows.reduce((sum, row) => sum + (row.target_orders ?? 0), 0)).toBe(10);
  });

  it("handles missing values without hiding them as zero", () => {
    const rows = splitMetricTargetIntoWeeks({
      id: "target-1",
      target_revenue: null,
      target_ad_spend: 0,
    }, 2, "2026-07-01");

    expect(rows[0].target_revenue).toBeNull();
    expect(rows[1].target_revenue).toBeNull();
    expect(rows.map((row) => row.target_ad_spend)).toEqual([0, 0]);
  });

  it("computes variance only when target and actual are known", () => {
    expect(computeVariancePct(100, 125)).toBe(25);
    expect(computeVariancePct(100, 80)).toBe(-20);
    expect(computeVariancePct(0, 80)).toBeNull();
    expect(computeWeeklyRevenueVariance({ target_revenue: 1000, actual_revenue: 900 })).toBe(-10);
  });
});
