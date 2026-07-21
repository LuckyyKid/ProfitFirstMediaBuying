import { describe, expect, it } from "vitest";
import { runCampaignDailyPlan } from "./campaignDailyPlan";
import { runChannelAllocation } from "./channelAllocation";

function channelAllocation() {
  return runChannelAllocation({
    planned_ad_spend: 1_000,
    business_target_amr: 2,
    business_target_cac: 50,
    channels: [
      {
        channel_name: "Meta",
        platform: "meta",
        planned_spend: 600,
        incrementality_factor: 0.75,
      },
      {
        channel_name: "Google",
        platform: "google",
        planned_spend: 400,
        incrementality_factor: 1,
      },
    ],
  });
}

const days = [
  { plan_date: "2026-07-01", day_index: 1, pacing_weight: 0.5, target_ad_spend: 500 },
  { plan_date: "2026-07-02", day_index: 2, pacing_weight: 0.5, target_ad_spend: 500 },
];

describe("campaign daily plan", () => {
  it("splits channel allocation into campaign daily targets", () => {
    const output = runCampaignDailyPlan({
      days,
      channel_allocation: channelAllocation(),
      campaigns: [
        {
          campaign_id: "meta-1",
          campaign_name: "Meta Prospecting",
          platform: "meta",
          allocation_weight: 2,
        },
        {
          campaign_id: "meta-2",
          campaign_name: "Meta Retargeting",
          platform: "meta",
          allocation_weight: 1,
        },
        {
          campaign_id: "google-1",
          campaign_name: "Google Search",
          platform: "google",
          current_daily_budget: 100,
        },
      ],
    });

    const metaProspecting = output.campaigns.find((campaign) => campaign.campaign_id === "meta-1");
    const metaProspectingDay = output.days.find((row) => (
      row.campaign_id === "meta-1" && row.plan_date === "2026-07-01"
    ));

    expect(output.engine_version).toBe("campaign_daily_plan_v1");
    expect(output.portfolio.allocated_campaign_spend).toBe(1_000);
    expect(output.portfolio.row_count).toBe(6);
    expect(metaProspecting?.monthly_target_spend).toBe(400);
    expect(metaProspecting?.required_platform_amr).toBe(2.67);
    expect(metaProspecting?.incremental_target_amr).toBe(1.5);
    expect(metaProspectingDay?.target_spend).toBe(200);
    expect(metaProspectingDay?.platform_revenue_required).toBe(534);
    expect(metaProspectingDay?.incremental_revenue_target).toBe(300);
    expect(output.channels.find((channel) => channel.channel_name === "Meta")?.planned_spend).toBe(600);
  });

  it("uses only active campaigns unless inactive campaigns are explicitly included", () => {
    const output = runCampaignDailyPlan({
      days,
      channel_allocation: channelAllocation(),
      campaigns: [
        {
          campaign_id: "meta-active",
          campaign_name: "Meta Active",
          platform: "meta",
          current_daily_budget: 50,
          active: true,
        },
        {
          campaign_id: "meta-inactive",
          campaign_name: "Meta Inactive",
          platform: "meta",
          current_daily_budget: 500,
          active: false,
        },
        {
          campaign_id: "google-active",
          campaign_name: "Google Active",
          platform: "google",
          current_daily_budget: 50,
          active: true,
        },
      ],
    });

    expect(output.campaigns.find((campaign) => campaign.campaign_id === "meta-active")?.monthly_target_spend).toBe(600);
    expect(output.campaigns.some((campaign) => campaign.campaign_id === "meta-inactive")).toBe(false);
    expect(output.portfolio.allocated_campaign_spend).toBe(1_000);
  });

  it("creates an auditable placeholder when a channel has no matched campaigns", () => {
    const output = runCampaignDailyPlan({
      days,
      channel_allocation: channelAllocation(),
      campaigns: [
        {
          campaign_id: "meta-1",
          campaign_name: "Meta Prospecting",
          platform: "meta",
          allocation_weight: 1,
        },
      ],
    });

    const googlePlaceholder = output.campaigns.find((campaign) => campaign.channel_name === "Google");

    expect(googlePlaceholder?.allocation_method).toBe("unassigned_channel_placeholder");
    expect(googlePlaceholder?.monthly_target_spend).toBe(400);
    expect(output.missing_data).toContain("channels[1].campaigns");
    expect(output.conditions.join(" ")).toContain("no active campaigns matched");
    expect(output.portfolio.allocated_campaign_spend).toBe(1_000);
  });
});
