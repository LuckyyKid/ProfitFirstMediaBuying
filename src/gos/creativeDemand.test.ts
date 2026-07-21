import { describe, expect, it } from "vitest";
import { runCreativeDemand } from "./creativeDemand";

describe("creative demand", () => {
  it("calculates weekly creative demand from spend, CPM, and fatigue threshold", () => {
    const out = runCreativeDemand({
      weekly_spend: 25_000,
      avg_cpm: 12.5,
      fatigue_threshold_impressions: 200_000,
    });

    expect(out.engine_version).toBe("creative_demand_v1");
    expect(out.impressions_per_week).toBe(2_000_000);
    expect(out.creatives_per_week_needed).toBe(10);
    expect(out.static_creatives_needed).toBe(5);
    expect(out.video_creatives_needed).toBe(4);
    expect(out.ugc_creatives_needed).toBe(1);
    expect(out.fatigue_load_pct).toBe(100);
    expect(out.confidence).toBe(0.6);
  });

  it("applies the minimum creative floor for low-volume weeks", () => {
    const out = runCreativeDemand({
      weekly_spend: 1_000,
      avg_cpm: 10,
      fatigue_threshold_impressions: 200_000,
    });

    expect(out.impressions_per_week).toBe(100_000);
    expect(out.creatives_per_week_needed).toBe(3);
    expect(out.risks).toContain("MINIMUM_CREATIVE_FLOOR_APPLIED");
  });

  it("reports missing data without returning NaN or Infinity", () => {
    const out = runCreativeDemand({
      weekly_spend: 10_000,
      avg_cpm: 0,
      fatigue_threshold_impressions: 0,
    });

    expect(out.impressions_per_week).toBe(0);
    expect(out.creatives_per_week_needed).toBe(3);
    expect(out.static_creatives_needed + out.video_creatives_needed + out.ugc_creatives_needed).toBe(3);
    expect(out.confidence).toBe(0.35);
    expect(out.missing_data).toEqual(["avg_cpm", "fatigue_threshold_impressions"]);
  });

  it("normalizes custom mix values", () => {
    const out = runCreativeDemand({
      weekly_spend: 10_000,
      avg_cpm: 10,
      fatigue_threshold_impressions: 100_000,
      mix: { static: 2, video: 1, ugc: 1 },
    });

    expect(out.breakdown.mix).toEqual({ static: 0.5, video: 0.25, ugc: 0.25 });
    expect(out.static_creatives_needed + out.video_creatives_needed + out.ugc_creatives_needed).toBe(out.creatives_per_week_needed);
  });
});
