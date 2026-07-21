import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  buildCampaignBudgetUpdate,
  computeDailyBudgetCategoryPlan,
  computeDailyBudgetTotals,
  groupDailyBudgetCampaigns,
  idealDailyBudget,
  UNASSIGNED_BUDGET_CATEGORY_ID,
  type DailyBudgetCampaign,
  type DailyBudgetCategory,
} from "./dailyBudgetPlanner";

const categories: DailyBudgetCategory[] = [
  { id: "cat-1", name: "Prospecting", kind: "prospecting", target_cpa: 70, target_daily_budget: null },
  { id: "cat-2", name: "Retargeting", kind: "retargeting", target_cpa: null, target_daily_budget: null },
];

const campaigns: DailyBudgetCampaign[] = [
  { id: "camp-1", category_id: "cat-1", name: "Meta 1", platform: "meta", current_daily_budget: 120, active: true },
  { id: "camp-2", category_id: "cat-1", name: "Meta 2", platform: "meta", current_daily_budget: 80, active: true },
  { id: "camp-3", category_id: "cat-2", name: "Google", platform: "google", current_daily_budget: 50, active: false },
  { id: "camp-4", category_id: null, name: "Unassigned", platform: "meta", current_daily_budget: 30, active: true },
];

describe("daily budget planner model", () => {
  it("calculates ideal daily budget from the CPA x 50 / 7 rule", () => {
    expect(idealDailyBudget(70)).toBe(500);
    expect(idealDailyBudget(0)).toBeNull();
    expect(idealDailyBudget(null)).toBeNull();
  });

  it("classifies current budget against ideal budget bands", () => {
    expect(budgetStatus(60, 100).status).toBe("under_invested");
    expect(budgetStatus(85, 100).status).toBe("below");
    expect(budgetStatus(100, 100).status).toBe("optimal");
    expect(budgetStatus(115, 100).status).toBe("above");
    expect(budgetStatus(140, 100).status).toBe("over_invested");
    expect(budgetStatus(100, null).status).toBe("missing_target");
  });

  it("groups campaigns by category and isolates unassigned campaigns", () => {
    const grouped = groupDailyBudgetCampaigns(categories, campaigns);

    expect(grouped["cat-1"].map((campaign) => campaign.id)).toEqual(["camp-1", "camp-2"]);
    expect(grouped[UNASSIGNED_BUDGET_CATEGORY_ID].map((campaign) => campaign.id)).toEqual(["camp-4"]);
  });

  it("computes active current total and category ideal total", () => {
    expect(computeDailyBudgetTotals(categories, campaigns)).toEqual({
      current_daily_total: 230,
      ideal_daily_total: 500,
    });
  });

  it("builds a category alignment plan from active campaigns only", () => {
    const plan = computeDailyBudgetCategoryPlan(categories[0], campaigns.filter((campaign) => campaign.category_id === "cat-1"));

    expect(plan).toMatchObject({
      category_id: "cat-1",
      ideal_daily_budget: 500,
      active_campaign_count: 2,
      current_daily_budget_total: 200,
      ideal_per_campaign_budget: 250,
    });
    expect(plan.updates_to_ideal).toEqual([
      { campaign_id: "camp-1", proposed_daily_budget: 250 },
      { campaign_id: "camp-2", proposed_daily_budget: 250 },
    ]);
  });

  it("normalizes single campaign budget update payloads", () => {
    expect(buildCampaignBudgetUpdate("camp-1", 123.6)).toEqual({
      campaign_id: "camp-1",
      proposed_daily_budget: 124,
    });
    expect(buildCampaignBudgetUpdate("camp-1", -20)).toEqual({
      campaign_id: "camp-1",
      proposed_daily_budget: 0,
    });
  });
});
