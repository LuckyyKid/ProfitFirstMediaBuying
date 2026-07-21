import type { CampaignBudgetUpdate } from "./budgetApplicationGuard";

export type CampaignConfigClient = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  industry?: string | null;
  am_owner?: string | null;
  launch_target_date?: string | null;
};

export type CampaignCategory = {
  id: string;
  client_id: string;
  name: string;
  kind: string;
  target_cpa: number | null;
  target_daily_budget: number | null;
  active: boolean;
  sort_order: number;
};

export type CampaignConfigCampaign = {
  id: string;
  client_id: string;
  category_id: string | null;
  name: string;
  platform: string;
  external_id: string | null;
  current_daily_budget: number | null;
  active: boolean;
  notes: string | null;
};

export type CampaignCategoryDraft = {
  name: string;
  kind: string;
  target_cpa: string;
  target_daily_budget: string;
};

export type CampaignDraft = {
  name: string;
  platform: string;
  category_id: string;
  current_daily_budget: string;
  external_id: string;
};

export type CategoryBudgetTotals = {
  category_id: string;
  active_campaign_count: number;
  daily_budget_total: number;
  target_daily_budget: number | null;
  budget_target_pct: number | null;
  status: "missing_target" | "under" | "in_band" | "over";
};

export const KIND_OPTIONS = ["prospecting", "retargeting", "brand", "other"] as const;
export const PLATFORM_OPTIONS = ["meta", "google", "tiktok", "other"] as const;
export const UNASSIGNED_CAMPAIGN_CATEGORY_ID = "__unassigned__";

export const EMPTY_CATEGORY_DRAFT: CampaignCategoryDraft = {
  name: "",
  kind: "prospecting",
  target_cpa: "",
  target_daily_budget: "",
};

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  name: "",
  platform: "meta",
  category_id: "",
  current_daily_budget: "",
  external_id: "",
};

export function parseOptionalNumberInput(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(value: unknown): number {
  return Math.max(0, parseOptionalNumberInput(value) ?? 0);
}

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function normalizeCategoryDraft(
  clientId: string,
  draft: CampaignCategoryDraft,
  sortOrder: number,
) {
  const name = optionalString(draft.name);
  if (!name) throw new Error("Category name is required.");

  return {
    client_id: clientId,
    name,
    kind: optionalString(draft.kind) ?? "prospecting",
    target_cpa: parseOptionalNumberInput(draft.target_cpa),
    target_daily_budget: parseOptionalNumberInput(draft.target_daily_budget),
    sort_order: Math.max(0, Math.round(nonNegative(sortOrder))),
  };
}

export function normalizeCampaignDraft(clientId: string, draft: CampaignDraft) {
  const name = optionalString(draft.name);
  if (!name) throw new Error("Campaign name is required.");

  return {
    client_id: clientId,
    name,
    platform: optionalString(draft.platform) ?? "meta",
    category_id: optionalString(draft.category_id),
    current_daily_budget: parseOptionalNumberInput(draft.current_daily_budget),
    external_id: optionalString(draft.external_id),
  };
}

export function groupCampaignConfigByCategory(
  categories: CampaignCategory[],
  campaigns: CampaignConfigCampaign[],
): Record<string, CampaignConfigCampaign[]> {
  const groups: Record<string, CampaignConfigCampaign[]> = { [UNASSIGNED_CAMPAIGN_CATEGORY_ID]: [] };
  categories.forEach((category) => {
    groups[category.id] = [];
  });
  campaigns.forEach((campaign) => {
    const key = campaign.category_id && groups[campaign.category_id] ? campaign.category_id : UNASSIGNED_CAMPAIGN_CATEGORY_ID;
    groups[key].push(campaign);
  });
  return groups;
}

export function computeCategoryBudgetTotals(
  category: CampaignCategory,
  campaigns: CampaignConfigCampaign[],
): CategoryBudgetTotals {
  const activeCampaigns = campaigns.filter((campaign) => campaign.active);
  const dailyBudgetTotal = activeCampaigns.reduce(
    (sum, campaign) => sum + nonNegative(campaign.current_daily_budget),
    0,
  );
  const target = category.target_daily_budget != null && category.target_daily_budget > 0
    ? category.target_daily_budget
    : null;
  const pct = target != null ? (dailyBudgetTotal / target) * 100 : null;
  const status = pct == null
    ? "missing_target"
    : pct < 90
      ? "under"
      : pct > 110
        ? "over"
        : "in_band";

  return {
    category_id: category.id,
    active_campaign_count: activeCampaigns.length,
    daily_budget_total: dailyBudgetTotal,
    target_daily_budget: target,
    budget_target_pct: pct,
    status,
  };
}

export function buildCampaignBudgetUpdate(campaignId: string, proposedDailyBudget: number | null): CampaignBudgetUpdate {
  return {
    campaign_id: campaignId,
    proposed_daily_budget: Math.round(nonNegative(proposedDailyBudget)),
  };
}
