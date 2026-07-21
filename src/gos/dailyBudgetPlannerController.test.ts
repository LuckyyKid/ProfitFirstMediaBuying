import { describe, expect, it, vi } from "vitest";
import {
  normalizeDailyBudgetCampaignRow,
  normalizeDailyBudgetCategoryRow,
} from "./dailyBudgetPlannerController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("daily budget planner controller", () => {
  it("normalizes campaign category rows", () => {
    expect(normalizeDailyBudgetCategoryRow({
      id: "cat-1",
      name: " Prospecting ",
      kind: "",
      target_cpa: "70",
      target_daily_budget: "",
    })).toEqual({
      id: "cat-1",
      name: "Prospecting",
      kind: "uncategorized",
      target_cpa: 70,
      target_daily_budget: null,
    });
  });

  it("normalizes campaign rows", () => {
    expect(normalizeDailyBudgetCampaignRow({
      id: "camp-1",
      category_id: "",
      name: " Meta ",
      platform: null,
      current_daily_budget: "120.5",
      active: false,
    })).toEqual({
      id: "camp-1",
      category_id: null,
      name: "Meta",
      platform: "meta",
      current_daily_budget: 120.5,
      active: false,
    });
  });
});
