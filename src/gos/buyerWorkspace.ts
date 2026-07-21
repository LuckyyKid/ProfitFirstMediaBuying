export type BuyerWorkspaceCategory = {
  id: string;
  name: string;
  kind: string;
  target_cpa: number | null;
  target_daily_budget: number | null;
};

export type BuyerWorkspaceCampaign = {
  id: string;
  category_id: string | null;
  name: string;
  platform: string;
  current_daily_budget: number | null;
  active: boolean;
};

export type BuyerWorkspacePerformance = {
  id?: string;
  campaign_id: string;
  perf_date: string;
  spend: number;
  orders: number;
  leads: number;
  revenue: number;
  notes: string | null;
};

export type BuyerWorkspaceDecision = {
  id: string;
  campaign_id: string;
  decision_date: string;
  decision_type: string;
  previous_budget: number | null;
  new_budget: number | null;
  reasoning: string | null;
  expected_impact: string | null;
  actual_cpa: number | null;
  target_cpa: number | null;
  created_at: string;
};

export type BuyerDecisionDraft = {
  type: string;
  newBudget: string;
  reasoning: string;
  expected: string;
};

export type BuyerCampaignMetrics = {
  spend: number;
  orders: number;
  leads: number;
  revenue: number;
  cpa: number | null;
  cpl: number | null;
  roas: number | null;
  aov: number | null;
  cpa_band: "good" | "warn" | "bad" | "missing";
};

export type BuyerCategorySummary = {
  category_id: string;
  campaign_count: number;
  total_spend: number;
  total_orders: number;
  total_leads: number;
  total_revenue: number;
  cpa: number | null;
  cpl: number | null;
  roas: number | null;
  cpa_band: "good" | "warn" | "bad" | "missing";
};

export type BuyerDecisionPayload = {
  campaign_id: string;
  decision_date: string;
  decision_type: string;
  previous_budget: number | null;
  new_budget: number | null;
  reasoning: string | null;
  expected_impact: string | null;
  actual_cpa: number | null;
  target_cpa: number | null;
};

export type BuyerDecisionBuildInput = {
  campaign: BuyerWorkspaceCampaign | null | undefined;
  category: BuyerWorkspaceCategory | null | undefined;
  performance: BuyerWorkspacePerformance | null | undefined;
  draft: BuyerDecisionDraft | null | undefined;
  decision_date: string;
};

export const ORPHAN_CATEGORY_ID = "__orphan__";

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finite(value, fallback));
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function yesterdayISO(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function emptyPerformance(campaignId: string, perfDate: string): BuyerWorkspacePerformance {
  return {
    campaign_id: campaignId,
    perf_date: perfDate,
    spend: 0,
    orders: 0,
    leads: 0,
    revenue: 0,
    notes: null,
  };
}

export function seedPerformanceByCampaign(
  campaigns: BuyerWorkspaceCampaign[],
  rows: BuyerWorkspacePerformance[],
  perfDate: string,
): Record<string, BuyerWorkspacePerformance> {
  const map: Record<string, BuyerWorkspacePerformance> = {};
  rows.forEach((row) => {
    map[row.campaign_id] = {
      ...row,
      spend: nonNegative(row.spend),
      orders: Math.round(nonNegative(row.orders)),
      leads: Math.round(nonNegative(row.leads)),
      revenue: nonNegative(row.revenue),
      notes: row.notes ?? null,
    };
  });
  campaigns.forEach((campaign) => {
    if (!map[campaign.id]) map[campaign.id] = emptyPerformance(campaign.id, perfDate);
  });
  return map;
}

export function groupCampaignsByCategory(
  categories: BuyerWorkspaceCategory[],
  campaigns: BuyerWorkspaceCampaign[],
): Record<string, BuyerWorkspaceCampaign[]> {
  const groups: Record<string, BuyerWorkspaceCampaign[]> = { [ORPHAN_CATEGORY_ID]: [] };
  categories.forEach((category) => {
    groups[category.id] = [];
  });
  campaigns.forEach((campaign) => {
    const key = campaign.category_id && groups[campaign.category_id] ? campaign.category_id : ORPHAN_CATEGORY_ID;
    groups[key].push(campaign);
  });
  return groups;
}

export function classifyAgainstTarget(
  actual: number | null,
  target: number | null,
  inverted = false,
): BuyerCampaignMetrics["cpa_band"] {
  if (actual == null || target == null || target <= 0) return "missing";
  const diff = (actual - target) / target;
  const good = inverted ? diff <= -0.1 : diff >= 0.1;
  const bad = inverted ? diff >= 0.1 : diff <= -0.1;
  if (good) return "good";
  if (bad) return "bad";
  return "warn";
}

export function computeBuyerCampaignMetrics(
  performance: BuyerWorkspacePerformance | null | undefined,
  targetCpa: number | null,
): BuyerCampaignMetrics {
  const spend = money(nonNegative(performance?.spend));
  const orders = Math.round(nonNegative(performance?.orders));
  const leads = Math.round(nonNegative(performance?.leads));
  const revenue = money(nonNegative(performance?.revenue));
  const cpa = orders > 0 ? money(spend / orders) : null;
  const cpl = leads > 0 ? money(spend / leads) : null;
  const roas = spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : null;
  const aov = orders > 0 ? money(revenue / orders) : null;

  return {
    spend,
    orders,
    leads,
    revenue,
    cpa,
    cpl,
    roas,
    aov,
    cpa_band: classifyAgainstTarget(cpa, targetCpa, true),
  };
}

export function computeBuyerCategorySummary(
  category: BuyerWorkspaceCategory,
  campaigns: BuyerWorkspaceCampaign[],
  performanceByCampaign: Record<string, BuyerWorkspacePerformance>,
): BuyerCategorySummary {
  const totals = campaigns.reduce(
    (acc, campaign) => {
      const performance = performanceByCampaign[campaign.id] ?? emptyPerformance(campaign.id, todayISO());
      acc.spend += nonNegative(performance.spend);
      acc.orders += nonNegative(performance.orders);
      acc.leads += nonNegative(performance.leads);
      acc.revenue += nonNegative(performance.revenue);
      return acc;
    },
    { spend: 0, orders: 0, leads: 0, revenue: 0 },
  );
  const spend = money(totals.spend);
  const orders = Math.round(totals.orders);
  const leads = Math.round(totals.leads);
  const revenue = money(totals.revenue);
  const cpa = orders > 0 ? money(spend / orders) : null;
  const cpl = leads > 0 ? money(spend / leads) : null;
  const roas = spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : null;

  return {
    category_id: category.id,
    campaign_count: campaigns.length,
    total_spend: spend,
    total_orders: orders,
    total_leads: leads,
    total_revenue: revenue,
    cpa,
    cpl,
    roas,
    cpa_band: classifyAgainstTarget(cpa, category.target_cpa, true),
  };
}

export function buildBuyerDecisionPayload(input: BuyerDecisionBuildInput): BuyerDecisionPayload {
  const draft = input.draft;
  const campaign = input.campaign;
  if (!campaign) throw new Error("Campaign is required to log a buyer decision.");
  if (!draft?.type) throw new Error("Decision type is required.");

  const performance = input.performance ?? emptyPerformance(campaign.id, input.decision_date);
  const metrics = computeBuyerCampaignMetrics(performance, input.category?.target_cpa ?? null);
  const newBudget = draft.newBudget.trim() === "" ? null : nonNegative(draft.newBudget);

  return {
    campaign_id: campaign.id,
    decision_date: input.decision_date,
    decision_type: draft.type,
    previous_budget: campaign.current_daily_budget ?? null,
    new_budget: newBudget,
    reasoning: draft.reasoning.trim() || null,
    expected_impact: draft.expected.trim() || null,
    actual_cpa: metrics.cpa,
    target_cpa: input.category?.target_cpa ?? null,
  };
}

export function decisionRequiresBudgetApplication(payload: BuyerDecisionPayload): boolean {
  return payload.new_budget != null && payload.previous_budget !== payload.new_budget;
}
