import { describe, expect, it } from "vitest";
import { estimatePlannedEventEffect, runEventEffectV2 } from "./eventEffectV2";

describe("eventEffectV2", () => {
  it("detects a positive interrupted-time-series lift", () => {
    const out = runEventEffectV2({
      metric: "revenue",
      pre_series: [100, 101, 99, 100, 102, 98, 100],
      post_series: [132, 130, 131, 133],
      use_linear_trend: false,
    });

    expect(out.method).toBe("ITS");
    expect(out.causal_lift_abs).toBeGreaterThan(25);
    expect(out.causal_lift_pct).toBeGreaterThan(25);
    expect(out.significant).toBe(true);
    expect(out.recommendation).toContain("positif");
  });

  it("uses difference-in-differences when control series are present", () => {
    const out = runEventEffectV2({
      metric: "revenue",
      pre_series: [100, 102, 98, 100],
      post_series: [140, 142, 138, 140],
      control_pre_series: [80, 82, 78, 80],
      control_post_series: [90, 92, 88, 90],
    });

    expect(out.method).toBe("DID");
    expect(out.counterfactual_mean).toBe(110);
    expect(out.causal_lift_abs).toBe(30);
    expect(out.causal_lift_pct).toBeCloseTo(27.27, 2);
  });

  it("uses pre-event trend for the counterfactual when requested", () => {
    const trended = runEventEffectV2({
      metric: "orders",
      pre_series: [100, 110, 120, 130],
      post_series: [155, 160],
      use_linear_trend: true,
    });
    const flat = runEventEffectV2({
      metric: "orders",
      pre_series: [100, 110, 120, 130],
      post_series: [155, 160],
      use_linear_trend: false,
    });

    expect(trended.trend_slope).toBe(10);
    expect(trended.counterfactual_mean).toBeGreaterThan(flat.counterfactual_mean);
    expect(trended.causal_lift_abs).toBeLessThan(flat.causal_lift_abs);
  });

  it("reports missing data when windows are too short", () => {
    const out = runEventEffectV2({
      metric: "revenue",
      pre_series: [100],
      post_series: [120],
    });

    expect(out.significant).toBe(false);
    expect(out.missing_data.length).toBeGreaterThan(0);
    expect(out.recommendation).toContain("insuffisantes");
  });

  it("estimates planned event lift from ecommerce baseline and event type", () => {
    const out = estimatePlannedEventEffect({
      baseline_revenue_30d: 30000,
      event_type: "PROMO",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
    });

    expect(out.duration_days).toBe(3);
    expect(out.expected_lift_pct).toBe(18);
    expect(out.expected_revenue_delta).toBe(540);
    expect(out.confidence).toBe("MEDIUM");
  });
});
