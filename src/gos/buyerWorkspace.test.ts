import { describe, expect, it } from "vitest";
import {
  buildBuyerDecisionPayload,
  computeBuyerCampaignMetrics,
  computeBuyerCategorySummary,
  decisionRequiresBudgetApplication,
  groupCampaignsByCategory,
  seedPerformanceByCampaign,
  type BuyerWorkspaceCampaign,
  type BuyerWorkspaceCategory,
} from "./buyerWorkspace";

const categories: BuyerWorkspaceCategory[] = [
  { id: "cat-1", name: "Prospecting", kind: "prospecting", target_cpa: 50, target_daily_budget: 200 },
];

const campaigns: BuyerWorkspaceCampaign[] = [
  { id: "camp-1", category_id: "cat-1", name: "Meta Prospecting", platform: "meta", current_daily_budget: 100, active: true },
  { id: "camp-2", category_id: null, name: "Google Brand", platform: "google", current_daily_budget: 50, active: true },
];

describe("buyer workspace model", () => {
  it("seeds missing campaign performance rows", () => {
    const seeded = seedPerformanceByCampaign(campaigns, [
      { campaign_id: "camp-1", perf_date: "2026-07-14", spend: 120, orders: 3, leads: 0, revenue: 360, notes: null },
    ], "2026-07-14");

    expect(seeded["camp-1"].spend).toBe(120);
    expect(seeded["camp-2"]).toMatchObject({
      campaign_id: "camp-2",
      perf_date: "2026-07-14",
      spend: 0,
      orders: 0,
      revenue: 0,
    });
  });

  it("groups campaigns by category and keeps orphan campaigns separate", () => {
    const grouped = groupCampaignsByCategory(categories, campaigns);

    expect(grouped["cat-1"].map((campaign) => campaign.id)).toEqual(["camp-1"]);
    expect(grouped.__orphan__.map((campaign) => campaign.id)).toEqual(["camp-2"]);
  });

  it("computes campaign CPA, ROAS, AOV, and target band", () => {
    const metrics = computeBuyerCampaignMetrics({
      campaign_id: "camp-1",
      perf_date: "2026-07-14",
      spend: 120,
      orders: 3,
      leads: 6,
      revenue: 360,
      notes: null,
    }, 50);

    expect(metrics.cpa).toBe(40);
    expect(metrics.cpl).toBe(20);
    expect(metrics.roas).toBe(3);
    expect(metrics.aov).toBe(120);
    expect(metrics.cpa_band).toBe("good");
  });

  it("computes category summary from campaign performance", () => {
    const performance = seedPerformanceByCampaign(campaigns, [
      { campaign_id: "camp-1", perf_date: "2026-07-14", spend: 120, orders: 3, leads: 6, revenue: 360, notes: null },
    ], "2026-07-14");
    const summary = computeBuyerCategorySummary(categories[0], [campaigns[0]], performance);

    expect(summary.total_spend).toBe(120);
    expect(summary.total_orders).toBe(3);
    expect(summary.cpa).toBe(40);
    expect(summary.roas).toBe(3);
    expect(summary.cpa_band).toBe("good");
  });

  it("builds buyer decision payloads from draft, campaign, category, and performance", () => {
    const payload = buildBuyerDecisionPayload({
      campaign: campaigns[0],
      category: categories[0],
      performance: { campaign_id: "camp-1", perf_date: "2026-07-14", spend: 120, orders: 3, leads: 0, revenue: 360, notes: null },
      decision_date: "2026-07-15",
      draft: { type: "scale", newBudget: "120", reasoning: "CPA below target", expected: "Scale controlled" },
    });

    expect(payload).toMatchObject({
      campaign_id: "camp-1",
      decision_type: "scale",
      previous_budget: 100,
      new_budget: 120,
      actual_cpa: 40,
      target_cpa: 50,
    });
    expect(decisionRequiresBudgetApplication(payload)).toBe(true);
  });

  it("does not require budget application when the budget is unchanged", () => {
    const payload = buildBuyerDecisionPayload({
      campaign: campaigns[0],
      category: categories[0],
      performance: { campaign_id: "camp-1", perf_date: "2026-07-14", spend: 120, orders: 3, leads: 0, revenue: 360, notes: null },
      decision_date: "2026-07-15",
      draft: { type: "hold", newBudget: "100", reasoning: "", expected: "" },
    });

    expect(decisionRequiresBudgetApplication(payload)).toBe(false);
  });
});
