import { describe, expect, it } from "vitest";
import { runAttributionTargetEngine } from "./attributionTargetEngine";

describe("attribution target engine", () => {
  it("translates business targets into click-only platform targets with delayed attribution", () => {
    const output = runAttributionTargetEngine({
      business_target_amr: 3,
      business_target_cac: 40,
      no_view_through: true,
      channels: [
        {
          channel_name: "Meta",
          platform: "meta",
          reporting_window: "28_DAY_CLICK",
          planned_spend: 1_000,
          delayed_attribution_multiplier: 0.9,
          includes_view_through: true,
          view_through_revenue_share: 0.2,
        },
      ],
    });

    expect(output.engine_version).toBe("attribution_target_engine_v1");
    expect(output.channels[0].click_window_multiplier).toBe(1);
    expect(output.channels[0].view_through_exclusion_multiplier).toBe(0.8);
    expect(output.channels[0].total_attribution_multiplier).toBe(0.72);
    expect(output.channels[0].platform_target_amr).toBe(2.16);
    expect(output.channels[0].platform_target_cac).toBe(55.56);
    expect(output.channels[0].business_revenue_target).toBe(3_000);
    expect(output.channels[0].platform_revenue_target).toBe(2_160);
    expect(output.channels[0].business_new_customer_target).toBe(25);
    expect(output.channels[0].platform_conversion_target).toBe(18);
  });

  it("uses configured 7-day click ratios for short-window media buying targets", () => {
    const output = runAttributionTargetEngine({
      business_target_roas: 3,
      business_target_cac: 40,
      channels: [
        {
          channel_name: "Google",
          reporting_window: "7_DAY_CLICK",
          planned_spend: 500,
          click_7d_to_28d_ratio: 0.75,
          delayed_attribution_multiplier: 0.8,
        },
      ],
    });

    expect(output.channels[0].total_attribution_multiplier).toBe(0.6);
    expect(output.channels[0].platform_target_roas).toBe(1.8);
    expect(output.channels[0].platform_target_cac).toBe(66.67);
    expect(output.channels[0].platform_revenue_target).toBe(900);
  });

  it("weights portfolio targets by planned spend", () => {
    const output = runAttributionTargetEngine({
      business_target_amr: 3,
      business_target_cac: 50,
      default_delayed_attribution_multiplier: 1,
      channels: [
        {
          channel_name: "Meta",
          reporting_window: "7_DAY_CLICK",
          planned_spend: 1_000,
          click_7d_to_28d_ratio: 0.8,
        },
        {
          channel_name: "Google",
          reporting_window: "28_DAY_CLICK",
          planned_spend: 3_000,
        },
      ],
    });

    expect(output.portfolio.weight_source).toBe("planned_spend");
    expect(output.portfolio.weighted_total_attribution_multiplier).toBe(0.95);
    expect(output.portfolio.weighted_platform_target_amr).toBe(2.85);
    expect(output.portfolio.weighted_platform_target_cac).toBe(53.13);
    expect(output.portfolio.business_revenue_target).toBe(12_000);
    expect(output.portfolio.platform_revenue_target).toBe(11_400);
  });

  it("surfaces missing targets without producing invalid platform numbers", () => {
    const output = runAttributionTargetEngine({
      channels: [
        {
          channel_name: "Incomplete",
          reporting_window: "7_DAY_CLICK",
        },
      ],
    });

    expect(output.missing_data).toContain("channels[0].planned_spend");
    expect(output.missing_data).toContain("channels[0].business_target_amr_or_roas");
    expect(output.missing_data).toContain("channels[0].business_target_cac");
    expect(output.missing_data).toContain("channels[0].click_7d_to_28d_ratio");
    expect(output.channels[0].platform_target_amr).toBeNull();
    expect(output.channels[0].platform_target_cac).toBeNull();
    expect(Number.isFinite(output.confidence_score)).toBe(true);
  });
});
