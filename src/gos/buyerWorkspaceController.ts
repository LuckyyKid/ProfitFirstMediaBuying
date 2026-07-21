import { supabase } from "@/integrations/supabase/client";
import {
  buildBuyerDecisionPayload,
  decisionRequiresBudgetApplication,
  seedPerformanceByCampaign,
  type BuyerDecisionBuildInput,
  type BuyerDecisionPayload,
  type BuyerWorkspaceCampaign,
  type BuyerWorkspaceCategory,
  type BuyerWorkspaceDecision,
  type BuyerWorkspacePerformance,
} from "./buyerWorkspace";
import { applyCampaignBudgetUpdatesWithGuard, type BudgetApplicationResult } from "./budgetApplicationController";

type QueryRow = Record<string, unknown>;

export type BuyerWorkspaceData = {
  categories: BuyerWorkspaceCategory[];
  campaigns: BuyerWorkspaceCampaign[];
  performances: BuyerWorkspacePerformance[];
  decisions: BuyerWorkspaceDecision[];
  performance_by_campaign: Record<string, BuyerWorkspacePerformance>;
};

export type BuyerDecisionLogResult = {
  logged: boolean;
  payload: BuyerDecisionPayload;
  budget_application: BudgetApplicationResult | null;
  decision: BuyerWorkspaceDecision | null;
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

function nonNegative(value: unknown): number {
  return Math.max(0, optionalNumber(value) ?? 0);
}

export function normalizeBuyerCategoryRow(row: QueryRow): BuyerWorkspaceCategory {
  return {
    id: String(row.id ?? ""),
    name: optionalString(row.name) ?? "",
    kind: optionalString(row.kind) ?? "uncategorized",
    target_cpa: optionalNumber(row.target_cpa),
    target_daily_budget: optionalNumber(row.target_daily_budget),
  };
}

export function normalizeBuyerCampaignRow(row: QueryRow): BuyerWorkspaceCampaign {
  return {
    id: String(row.id ?? ""),
    category_id: optionalString(row.category_id),
    name: optionalString(row.name) ?? "",
    platform: optionalString(row.platform) ?? "meta",
    current_daily_budget: optionalNumber(row.current_daily_budget),
    active: row.active !== false,
  };
}

export function normalizeBuyerPerformanceRow(row: QueryRow): BuyerWorkspacePerformance {
  const id = optionalString(row.id);
  return {
    ...(id ? { id } : {}),
    campaign_id: String(row.campaign_id ?? ""),
    perf_date: optionalString(row.perf_date) ?? "",
    spend: nonNegative(row.spend),
    orders: Math.round(nonNegative(row.orders)),
    leads: Math.round(nonNegative(row.leads)),
    revenue: nonNegative(row.revenue),
    notes: optionalString(row.notes),
  };
}

export function normalizeBuyerDecisionRow(row: QueryRow): BuyerWorkspaceDecision {
  return {
    id: String(row.id ?? ""),
    campaign_id: String(row.campaign_id ?? ""),
    decision_date: optionalString(row.decision_date) ?? "",
    decision_type: optionalString(row.decision_type) ?? "",
    previous_budget: optionalNumber(row.previous_budget),
    new_budget: optionalNumber(row.new_budget),
    reasoning: optionalString(row.reasoning),
    expected_impact: optionalString(row.expected_impact),
    actual_cpa: optionalNumber(row.actual_cpa),
    target_cpa: optionalNumber(row.target_cpa),
    created_at: optionalString(row.created_at) ?? "",
  };
}

export function toBuyerPerformanceUpsertPayload(
  clientId: string,
  perfDate: string,
  campaignId: string,
  performance: BuyerWorkspacePerformance,
) {
  return {
    client_id: clientId,
    campaign_id: campaignId,
    perf_date: perfDate,
    spend: nonNegative(performance.spend),
    orders: Math.round(nonNegative(performance.orders)),
    leads: Math.round(nonNegative(performance.leads)),
    revenue: nonNegative(performance.revenue),
    notes: optionalString(performance.notes),
  };
}

export function toBuyerDecisionInsertPayload(clientId: string, payload: BuyerDecisionPayload) {
  return {
    client_id: clientId,
    campaign_id: payload.campaign_id,
    decision_date: payload.decision_date,
    decision_type: payload.decision_type,
    previous_budget: payload.previous_budget,
    new_budget: payload.new_budget,
    reasoning: payload.reasoning,
    expected_impact: payload.expected_impact,
    actual_cpa: payload.actual_cpa,
    target_cpa: payload.target_cpa,
  };
}

export async function fetchBuyerWorkspaceData(clientId: string, perfDate: string): Promise<BuyerWorkspaceData> {
  const [categoriesResult, campaignsResult, performancesResult, decisionsResult] = await Promise.all([
    supabase
      .from("gos_campaign_categories" as never)
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("gos_campaigns" as never)
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true),
    supabase
      .from("gos_campaign_daily_perf" as never)
      .select("*")
      .eq("client_id", clientId)
      .eq("perf_date", perfDate),
    supabase
      .from("gos_buyer_decisions" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (campaignsResult.error) throw campaignsResult.error;
  if (performancesResult.error) throw performancesResult.error;
  if (decisionsResult.error) throw decisionsResult.error;

  const categories = ((categoriesResult.data ?? []) as QueryRow[]).map(normalizeBuyerCategoryRow);
  const campaigns = ((campaignsResult.data ?? []) as QueryRow[]).map(normalizeBuyerCampaignRow);
  const performances = ((performancesResult.data ?? []) as QueryRow[]).map(normalizeBuyerPerformanceRow);
  const decisions = ((decisionsResult.data ?? []) as QueryRow[]).map(normalizeBuyerDecisionRow);

  return {
    categories,
    campaigns,
    performances,
    decisions,
    performance_by_campaign: seedPerformanceByCampaign(campaigns, performances, perfDate),
  };
}

export async function saveBuyerCampaignPerformance(
  clientId: string,
  perfDate: string,
  campaignId: string,
  performance: BuyerWorkspacePerformance,
): Promise<void> {
  const payload = toBuyerPerformanceUpsertPayload(clientId, perfDate, campaignId, performance);
  const { error } = await supabase
    .from("gos_campaign_daily_perf" as never)
    .upsert(payload as never, { onConflict: "campaign_id,perf_date" });

  if (error) throw error;
}

export async function logBuyerDecisionWithBudgetGuard(
  clientId: string,
  input: BuyerDecisionBuildInput,
): Promise<BuyerDecisionLogResult> {
  const payload = buildBuyerDecisionPayload(input);
  let budgetApplication: BudgetApplicationResult | null = null;

  if (decisionRequiresBudgetApplication(payload)) {
    budgetApplication = await applyCampaignBudgetUpdatesWithGuard(
      clientId,
      [{ campaign_id: payload.campaign_id, proposed_daily_budget: payload.new_budget ?? 0 }],
      { source: "buyer_workspace" },
    );
    if (!budgetApplication.applied) {
      return { logged: false, payload, budget_application: budgetApplication, decision: null };
    }
  }

  const { data, error } = await supabase
    .from("gos_buyer_decisions" as never)
    .insert(toBuyerDecisionInsertPayload(clientId, payload) as never)
    .select("*")
    .single();

  if (error) throw error;

  return {
    logged: true,
    payload,
    budget_application: budgetApplication,
    decision: normalizeBuyerDecisionRow(data as QueryRow),
  };
}
