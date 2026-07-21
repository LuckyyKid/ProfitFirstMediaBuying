import { describe, expect, it } from "vitest";
import {
  buildCumulativeRevenueSparkline,
  buildSparkPath,
  computeDailyPnlSummary,
} from "./dailyPnlSummary";

describe("daily P&L summary", () => {
  it("computes pacing and projected revenue from available actuals", () => {
    const summary = computeDailyPnlSummary([
      { target_revenue: 100, actual_revenue: 120 },
      { target_revenue: 100, actual_revenue: 80 },
      { target_revenue: 100, actual_revenue: null },
      { target_revenue: 100, actual_revenue: null },
    ]);

    expect(summary.targetRevenue).toBe(400);
    expect(summary.actualRevenue).toBe(200);
    expect(summary.daysWithActual).toBe(2);
    expect(summary.paceDeltaPct).toBe(-50);
    expect(summary.projectedRevenue).toBe(400);
  });

  it("builds cumulative revenue points and a path", () => {
    const points = buildCumulativeRevenueSparkline([
      { target_revenue: 100, actual_revenue: null },
      { target_revenue: 100, actual_revenue: 120 },
      { target_revenue: 100, actual_revenue: 90 },
    ]);

    expect(points).toEqual([
      { x: 0, v: 100 },
      { x: 50, v: 220 },
      { x: 100, v: 310 },
    ]);
    expect(buildSparkPath(points)).toContain("M0");
    expect(buildSparkPath(points)).toContain("L100");
  });
});
