import { describe, expect, it } from "vitest";
import { runChannelAllocation } from "./channelAllocation";

describe("channel allocation", () => {
  it("allocates spend by channel weights and translates incrementality into channel targets", () => {
    const output = runChannelAllocation({
      planned_ad_spend: 5_000,
      business_target_amr: 2.2,
      business_target_cac: 50,
      channels: [
        {
          channel_name: "Meta",
          platform: "meta",
          allocation_weight: 3,
          incrementality_factor: 0.7,
        },
        {
          channel_name: "Google",
          platform: "google",
          allocation_weight: 2,
          incrementality_factor: 0.9,
        },
      ],
    });

    expect(output.engine_version).toBe("channel_allocation_v1");
    expect(output.portfolio.allocation_method).toBe("allocation_weight");
    expect(output.portfolio.allocated_spend).toBe(5_000);
    expect(output.portfolio.weighted_incrementality_factor).toBe(0.78);
    expect(output.portfolio.weighted_incremental_target_amr).toBe(1.72);
    expect(output.portfolio.weighted_required_platform_amr).toBe(2.86);
    expect(output.portfolio.weighted_required_platform_cac).toBe(39);
    expect(output.portfolio.incremental_revenue_target).toBe(8_580);

    expect(output.channels[0].allocated_spend).toBe(3_000);
    expect(output.channels[0].incremental_target_amr).toBe(1.54);
    expect(output.channels[0].required_platform_amr).toBe(3.14);
    expect(output.channels[0].required_platform_cac).toBe(35);
    expect(output.channels[1].allocated_spend).toBe(2_000);
  });

  it("uses expected incremental efficiency when no explicit allocation weights exist", () => {
    const output = runChannelAllocation({
      planned_ad_spend: 1_000,
      business_target_amr: 2,
      business_target_cac: 40,
      channels: [
        {
          channel_name: "Prospecting",
          expected_amr: 4,
          incrementality_factor: 0.5,
        },
        {
          channel_name: "Retention",
          expected_amr: 1,
          incrementality_factor: 1,
        },
      ],
    });

    expect(output.portfolio.allocation_method).toBe("incremental_efficiency");
    expect(output.channels[0].allocation_basis).toBe(2);
    expect(output.channels[1].allocation_basis).toBe(1);
    expect(output.channels[0].allocated_spend).toBe(666.67);
    expect(output.channels[1].allocated_spend).toBe(333.33);
    expect(output.portfolio.allocated_spend).toBe(1_000);
  });

  it("surfaces missing incrementality instead of hiding the assumption", () => {
    const output = runChannelAllocation({
      planned_ad_spend: 1_000,
      business_target_amr: 2,
      business_target_cac: 40,
      channels: [
        {
          channel_name: "Unmeasured channel",
          allocation_weight: 1,
        },
      ],
    });

    expect(output.channels[0].incrementality_factor).toBe(1);
    expect(output.missing_data).toContain("channels[0].incrementality_factor");
    expect(output.conditions.join(" ")).toContain("incrementality defaults to 1.0");
  });
});
