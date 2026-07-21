import { supabase } from "@/integrations/supabase/client";
import {
  buildCampaignBudgetUpdate,
  computeDailyBudgetCategoryPlan,
  groupDailyBudgetCampaigns,
  type DailyBudgetCampaign,
  type DailyBudgetCategory,
  type DailyBudgetCategoryPlan,
} from "./dailyBudgetPlanner";
import { applyCampaignBudgetUpdatesWithGuard, type BudgetApplicationResult } from "./budgetApplicationController";

type QueryRow = Record<string, unknown>;

export type DailyBudgetPlannerData = {
  categories: DailyBudgetCategory[];
  campaigns: DailyBudgetCampaign[];
  campaigns_by_category: Record<string, DailyBudgetCampaign[]>;
};

export type DailyBudgetApplicationResult = {
  result: BudgetApplicationResult;
  plan: DailyBudgetCategoryPlan | null;
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeDailyBudgetCategoryRow(row: QueryRow): DailyBudgetCategory {
  return {
    id: String(row.id ?? ""),
    name: optionalString(row.name) ?? "",
    kind: optionalString(row.kind) ?? "uncategorized",
    target_cpa: optionalNumber(row.target_cpa),
    target_daily_budget: optionalNumber(row.target_daily_budget),
  };
}

export function normalizeDailyBudgetCampaignRow(row: QueryRow): DailyBudgetCampaign {
  return {
    id: String(row.id ?? ""),
    category_id: optionalString(row.category_id),
    name: optionalString(row.name) ?? "",
    platform: optionalString(row.platform) ?? "meta",
    current_daily_budget: optionalNumber(row.current_daily_budget),
    active: row.active !== false,
  };
}

export async function fetchDailyBudgetPlannerData(clientId: string): Promise<DailyBudgetPlannerData> {
  const [categoriesResult, campaignsResult] = await Promise.all([
    supabase
      .from("gos_campaign_categories" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("gos_campaigns" as never)
      .select("*")
      .eq("client_id", clientId),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (campaignsResult.error) throw campaignsResult.error;

  const categories = ((categoriesResult.data ?? []) as QueryRow[]).map(normalizeDailyBudgetCategoryRow);
  const campaigns = ((campaignsResult.data ?? []) as QueryRow[]).map(normalizeDailyBudgetCampaignRow);

  return {
    categories,
    campaigns,
    campaigns_by_category: groupDailyBudgetCampaigns(categories, campaigns),
  };
}

export async function applyDailyCampaignBudget(
  clientId: string,
  campaignId: string,
  proposedDailyBudget: number,
): Promise<DailyBudgetApplicationResult> {
  const result = await applyCampaignBudgetUpdatesWithGuard(
    clientId,
    [buildCampaignBudgetUpdate(campaignId, proposedDailyBudget)],
    { source: "daily_budget_planner" },
  );
  return { result, plan: null };
}

export async function applyDailyCategoryIdealBudgets(
  clientId: string,
  category: DailyBudgetCategory,
  campaigns: DailyBudgetCampaign[],
): Promise<DailyBudgetApplicationResult> {
  const plan = computeDailyBudgetCategoryPlan(category, campaigns);
  if (plan.ideal_daily_budget == null) throw new Error("Target CPA required");
  if (plan.updates_to_ideal.length === 0) throw new Error("No active campaigns in this category");

  const result = await applyCampaignBudgetUpdatesWithGuard(
    clientId,
    plan.updates_to_ideal,
    { source: "daily_budget_planner_align_all" },
  );

  return { result, plan };
}
