import { supabase } from "@/integrations/supabase/client";
import {
  buildCampaignBudgetUpdate,
  computeCategoryBudgetTotals,
  groupCampaignConfigByCategory,
  normalizeCampaignDraft,
  normalizeCategoryDraft,
  parseOptionalNumberInput,
  type CampaignCategory,
  type CampaignCategoryDraft,
  type CampaignConfigCampaign,
  type CampaignConfigClient,
  type CampaignDraft,
} from "./campaignConfiguration";
import { applyCampaignBudgetUpdatesWithGuard, type BudgetApplicationResult } from "./budgetApplicationController";

type QueryRow = Record<string, unknown>;

export type CampaignConfigurationData = {
  client: CampaignConfigClient | null;
  categories: CampaignCategory[];
  campaigns: CampaignConfigCampaign[];
  campaigns_by_category: Record<string, CampaignConfigCampaign[]>;
};

export type CampaignConfigMutationResult = {
  budget_application: BudgetApplicationResult | null;
};

export type CampaignCreateResult = CampaignConfigMutationResult & {
  campaign: CampaignConfigCampaign;
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

function toBoolean(value: unknown, fallback = true): boolean {
  return value == null ? fallback : value === true;
}

export function normalizeCampaignConfigClientRow(row: QueryRow | null | undefined): CampaignConfigClient | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    client_code: optionalString(row.client_code) ?? "",
    company_name: optionalString(row.company_name) ?? "",
    business_type: optionalString(row.business_type) ?? "",
    current_phase: optionalString(row.current_phase) ?? "",
    risk_level: optionalString(row.risk_level) ?? "",
    industry: optionalString(row.industry),
    am_owner: optionalString(row.am_owner),
    launch_target_date: optionalString(row.launch_target_date),
  };
}

export function normalizeCampaignCategoryRow(row: QueryRow): CampaignCategory {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    name: optionalString(row.name) ?? "",
    kind: optionalString(row.kind) ?? "prospecting",
    target_cpa: optionalNumber(row.target_cpa),
    target_daily_budget: optionalNumber(row.target_daily_budget),
    active: toBoolean(row.active),
    sort_order: Math.round(optionalNumber(row.sort_order) ?? 0),
  };
}

export function normalizeCampaignConfigCampaignRow(row: QueryRow): CampaignConfigCampaign {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    category_id: optionalString(row.category_id),
    name: optionalString(row.name) ?? "",
    platform: optionalString(row.platform) ?? "meta",
    external_id: optionalString(row.external_id),
    current_daily_budget: optionalNumber(row.current_daily_budget),
    active: toBoolean(row.active),
    notes: optionalString(row.notes),
  };
}

export function toCategoryUpdatePayload(patch: Partial<CampaignCategory>) {
  return {
    ...(patch.name != null ? { name: optionalString(patch.name) ?? "" } : {}),
    ...(patch.kind != null ? { kind: optionalString(patch.kind) ?? "prospecting" } : {}),
    ...(patch.target_cpa !== undefined ? { target_cpa: optionalNumber(patch.target_cpa) } : {}),
    ...(patch.target_daily_budget !== undefined ? { target_daily_budget: optionalNumber(patch.target_daily_budget) } : {}),
    ...(patch.active !== undefined ? { active: patch.active === true } : {}),
    ...(patch.sort_order !== undefined ? { sort_order: Math.round(optionalNumber(patch.sort_order) ?? 0) } : {}),
  };
}

export function toCampaignMetadataUpdatePayload(patch: Partial<CampaignConfigCampaign>) {
  return {
    ...(patch.name != null ? { name: optionalString(patch.name) ?? "" } : {}),
    ...(patch.platform != null ? { platform: optionalString(patch.platform) ?? "meta" } : {}),
    ...(patch.category_id !== undefined ? { category_id: optionalString(patch.category_id) } : {}),
    ...(patch.external_id !== undefined ? { external_id: optionalString(patch.external_id) } : {}),
    ...(patch.active !== undefined ? { active: patch.active === true } : {}),
    ...(patch.notes !== undefined ? { notes: optionalString(patch.notes) } : {}),
  };
}

export async function fetchCampaignConfigurationData(clientId: string): Promise<CampaignConfigurationData> {
  const [clientResult, categoriesResult, campaignsResult] = await Promise.all([
    supabase
      .from("gos_clients" as never)
      .select("*")
      .eq("id", clientId)
      .single(),
    supabase
      .from("gos_campaign_categories" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("gos_campaigns" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("name", { ascending: true }),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (categoriesResult.error) throw categoriesResult.error;
  if (campaignsResult.error) throw campaignsResult.error;

  const categories = ((categoriesResult.data ?? []) as QueryRow[]).map(normalizeCampaignCategoryRow);
  const campaigns = ((campaignsResult.data ?? []) as QueryRow[]).map(normalizeCampaignConfigCampaignRow);

  return {
    client: normalizeCampaignConfigClientRow(clientResult.data as QueryRow),
    categories,
    campaigns,
    campaigns_by_category: groupCampaignConfigByCategory(categories, campaigns),
  };
}

export async function createCampaignCategory(
  clientId: string,
  draft: CampaignCategoryDraft,
  sortOrder: number,
): Promise<CampaignCategory> {
  const payload = normalizeCategoryDraft(clientId, draft, sortOrder);
  const { data, error } = await supabase
    .from("gos_campaign_categories" as never)
    .insert(payload as never)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeCampaignCategoryRow(data as QueryRow);
}

export async function updateCampaignCategory(
  categoryId: string,
  patch: Partial<CampaignCategory>,
): Promise<void> {
  const { error } = await supabase
    .from("gos_campaign_categories" as never)
    .update(toCategoryUpdatePayload(patch) as never)
    .eq("id", categoryId);

  if (error) throw error;
}

export async function deleteCampaignCategory(categoryId: string): Promise<void> {
  const { error } = await supabase
    .from("gos_campaign_categories" as never)
    .delete()
    .eq("id", categoryId);

  if (error) throw error;
}

export async function createCampaignConfigCampaign(
  clientId: string,
  draft: CampaignDraft,
): Promise<CampaignCreateResult> {
  const payload = normalizeCampaignDraft(clientId, draft);
  const requestedBudget = parseOptionalNumberInput(payload.current_daily_budget);
  const insertPayload = {
    ...payload,
    current_daily_budget: requestedBudget != null && requestedBudget > 0 ? 0 : requestedBudget,
  };

  const { data, error } = await supabase
    .from("gos_campaigns" as never)
    .insert(insertPayload as never)
    .select("*")
    .single();

  if (error) throw error;

  const campaign = normalizeCampaignConfigCampaignRow(data as QueryRow);
  if (requestedBudget == null || requestedBudget <= 0) {
    return { campaign, budget_application: null };
  }

  const budgetApplication = await applyCampaignBudgetUpdatesWithGuard(
    clientId,
    [buildCampaignBudgetUpdate(campaign.id, requestedBudget)],
    { source: "campaign_configuration_create" },
  );

  return { campaign, budget_application: budgetApplication };
}

export async function updateCampaignConfigCampaign(
  clientId: string,
  campaign: CampaignConfigCampaign,
  patch: Partial<CampaignConfigCampaign>,
): Promise<CampaignConfigMutationResult> {
  const metadataPayload = toCampaignMetadataUpdatePayload(patch);
  if (Object.keys(metadataPayload).length > 0) {
    const { error } = await supabase
      .from("gos_campaigns" as never)
      .update(metadataPayload as never)
      .eq("id", campaign.id);

    if (error) throw error;
  }

  if (patch.current_daily_budget === undefined) {
    return { budget_application: null };
  }

  const nextBudget = parseOptionalNumberInput(patch.current_daily_budget) ?? 0;
  const currentBudget = campaign.current_daily_budget ?? 0;
  if (nextBudget === currentBudget) return { budget_application: null };

  const budgetApplication = await applyCampaignBudgetUpdatesWithGuard(
    clientId,
    [buildCampaignBudgetUpdate(campaign.id, nextBudget)],
    { source: "campaign_configuration_update" },
  );

  return { budget_application: budgetApplication };
}

export async function deleteCampaignConfigCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("gos_campaigns" as never)
    .delete()
    .eq("id", campaignId);

  if (error) throw error;
}

export { computeCategoryBudgetTotals };
