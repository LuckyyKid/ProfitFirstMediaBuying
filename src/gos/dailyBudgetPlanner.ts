import type { CampaignBudgetUpdate } from "./budgetApplicationGuard";

export type DailyBudgetCategory = {
  id: string;
  name: string;
  kind: string;
  target_cpa: number | null;
  target_daily_budget: number | null;
};

export type DailyBudgetCampaign = {
  id: string;
  category_id: string | null;
  name: string;
  platform: string;
  current_daily_budget: number | null;
  active: boolean;
};

export type BudgetStatus = {
  status: "under_invested" | "below" | "optimal" | "above" | "over_invested" | "missing_target";
  label: string;
};

export type DailyBudgetCategoryPlan = {
  category_id: string;
  ideal_daily_budget: number | null;
  active_campaign_count: number;
  current_daily_budget_total: number;
  ideal_per_campaign_budget: number | null;
  status: BudgetStatus;
  updates_to_ideal: CampaignBudgetUpdate[];
};

export type DailyBudgetTotals = {
  current_daily_total: number;
  ideal_daily_total: number;
};

export const UNASSIGNED_BUDGET_CATEGORY_ID = "__unassigned__";

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(value: unknown): number {
  return Math.max(0, finiteNumber(value) ?? 0);
}

export function idealDailyBudget(targetCpa: number | null): number | null {
  if (targetCpa == null || targetCpa <= 0) return null;
  return Math.round((targetCpa * 50) / 7);
}

export function budgetStatus(current: number, ideal: number | null): BudgetStatus {
  if (ideal == null || ideal <= 0) return { status: "missing_target", label: "-" };
  const diff = (current - ideal) / ideal;
  if (diff < -0.3) return { status: "under_invested", label: "Under-invested" };
  if (diff < -0.1) return { status: "below", label: "Below" };
  if (diff > 0.3) return { status: "over_invested", label: "Over-invested" };
  if (diff > 0.1) return { status: "above", label: "Above" };
  return { status: "optimal", label: "Optimal" };
}

export function groupDailyBudgetCampaigns(
  categories: DailyBudgetCategory[],
  campaigns: DailyBudgetCampaign[],
): Record<string, DailyBudgetCampaign[]> {
  const groups: Record<string, DailyBudgetCampaign[]> = { [UNASSIGNED_BUDGET_CATEGORY_ID]: [] };
  categories.forEach((category) => {
    groups[category.id] = [];
  });
  campaigns.forEach((campaign) => {
    const key = campaign.category_id && groups[campaign.category_id] ? campaign.category_id : UNASSIGNED_BUDGET_CATEGORY_ID;
    groups[key].push(campaign);
  });
  return groups;
}

export function computeDailyBudgetTotals(
  categories: DailyBudgetCategory[],
  campaigns: DailyBudgetCampaign[],
): DailyBudgetTotals {
  return {
    current_daily_total: campaigns
      .filter((campaign) => campaign.active)
      .reduce((sum, campaign) => sum + nonNegative(campaign.current_daily_budget), 0),
    ideal_daily_total: categories.reduce((sum, category) => sum + (idealDailyBudget(category.target_cpa) ?? 0), 0),
  };
}

export function computeDailyBudgetCategoryPlan(
  category: DailyBudgetCategory,
  campaigns: DailyBudgetCampaign[],
): DailyBudgetCategoryPlan {
  const activeCampaigns = campaigns.filter((campaign) => campaign.active);
  const ideal = idealDailyBudget(category.target_cpa);
  const currentTotal = activeCampaigns.reduce(
    (sum, campaign) => sum + nonNegative(campaign.current_daily_budget),
    0,
  );
  const idealShare = ideal != null && activeCampaigns.length > 0
    ? Math.round(ideal / activeCampaigns.length)
    : null;

  return {
    category_id: category.id,
    ideal_daily_budget: ideal,
    active_campaign_count: activeCampaigns.length,
    current_daily_budget_total: currentTotal,
    ideal_per_campaign_budget: idealShare,
    status: budgetStatus(currentTotal, ideal),
    updates_to_ideal: idealShare == null
      ? []
      : activeCampaigns.map((campaign) => ({
          campaign_id: campaign.id,
          proposed_daily_budget: idealShare,
        })),
  };
}

export function buildCampaignBudgetUpdate(campaignId: string, proposedDailyBudget: number): CampaignBudgetUpdate {
  return {
    campaign_id: campaignId,
    proposed_daily_budget: Math.round(nonNegative(proposedDailyBudget)),
  };
}
