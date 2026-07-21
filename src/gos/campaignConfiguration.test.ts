import { describe, expect, it } from "vitest";
import {
  buildCampaignBudgetUpdate,
  computeCategoryBudgetTotals,
  groupCampaignConfigByCategory,
  normalizeCampaignDraft,
  normalizeCategoryDraft,
  parseOptionalNumberInput,
  UNASSIGNED_CAMPAIGN_CATEGORY_ID,
  type CampaignCategory,
  type CampaignConfigCampaign,
} from "./campaignConfiguration";

const category: CampaignCategory = {
  id: "cat-1",
  client_id: "client-1",
  name: "Prospecting",
  kind: "prospecting",
  target_cpa: 50,
  target_daily_budget: 300,
  active: true,
  sort_order: 1,
};

const campaigns: CampaignConfigCampaign[] = [
  {
    id: "camp-1",
    client_id: "client-1",
    category_id: "cat-1",
    name: "Meta 1",
    platform: "meta",
    external_id: null,
    current_daily_budget: 100,
    active: true,
    notes: null,
  },
  {
    id: "camp-2",
    client_id: "client-1",
    category_id: "cat-1",
    name: "Meta 2",
    platform: "meta",
    external_id: null,
    current_daily_budget: 80,
    active: false,
    notes: null,
  },
  {
    id: "camp-3",
    client_id: "client-1",
    category_id: null,
    name: "Unassigned",
    platform: "google",
    external_id: null,
    current_daily_budget: 50,
    active: true,
    notes: null,
  },
];

describe("campaign configuration model", () => {
  it("parses optional numeric input without hiding missing values as zero", () => {
    expect(parseOptionalNumberInput("")).toBeNull();
    expect(parseOptionalNumberInput(null)).toBeNull();
    expect(parseOptionalNumberInput("12.5")).toBe(12.5);
    expect(parseOptionalNumberInput("bad")).toBeNull();
  });

  it("normalizes category and campaign drafts", () => {
    expect(normalizeCategoryDraft("client-1", {
      name: " Prospecting ",
      kind: "prospecting",
      target_cpa: "50",
      target_daily_budget: "",
    }, 3)).toEqual({
      client_id: "client-1",
      name: "Prospecting",
      kind: "prospecting",
      target_cpa: 50,
      target_daily_budget: null,
      sort_order: 3,
    });

    expect(normalizeCampaignDraft("client-1", {
      name: " Meta ",
      platform: "",
      category_id: "",
      current_daily_budget: "120",
      external_id: " ext-1 ",
    })).toEqual({
      client_id: "client-1",
      name: "Meta",
      platform: "meta",
      category_id: null,
      current_daily_budget: 120,
      external_id: "ext-1",
    });
  });

  it("groups campaigns by category and keeps unassigned campaigns separate", () => {
    const grouped = groupCampaignConfigByCategory([category], campaigns);

    expect(grouped["cat-1"].map((campaign) => campaign.id)).toEqual(["camp-1", "camp-2"]);
    expect(grouped[UNASSIGNED_CAMPAIGN_CATEGORY_ID].map((campaign) => campaign.id)).toEqual(["camp-3"]);
  });

  it("computes active category budget totals and target percentage", () => {
    const totals = computeCategoryBudgetTotals(category, campaigns.filter((campaign) => campaign.category_id === "cat-1"));

    expect(totals).toMatchObject({
      category_id: "cat-1",
      active_campaign_count: 1,
      daily_budget_total: 100,
      target_daily_budget: 300,
      status: "under",
    });
    expect(totals.budget_target_pct).toBeCloseTo(33.333, 2);
  });

  it("builds guarded budget update payloads", () => {
    expect(buildCampaignBudgetUpdate("camp-1", 99.6)).toEqual({
      campaign_id: "camp-1",
      proposed_daily_budget: 100,
    });
    expect(buildCampaignBudgetUpdate("camp-1", -10)).toEqual({
      campaign_id: "camp-1",
      proposed_daily_budget: 0,
    });
  });
});
