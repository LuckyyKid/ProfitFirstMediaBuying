import { supabase } from "@/integrations/supabase/client";
import {
  computeConceptDerivedMetrics,
  computeConceptStats,
  type ConceptLogEntry,
} from "./conceptLog";

export {
  computeConceptDerivedMetrics,
  computeConceptStats,
  evaluateConceptOperationalReadiness,
  runConceptLogOperationalPlan,
} from "./conceptLog";
export type {
  ConceptDerivedMetrics,
  ConceptLogEntry,
  ConceptLogOperationalInput,
  ConceptLogOperationalOutput,
  ConceptOperationalReadiness,
} from "./conceptLog";

type QueryRow = Record<string, unknown>;

export type ConceptObjective = {
  id: string;
  label: string;
};

export type ConceptLogData = {
  concepts: ConceptLogEntry[];
  objectives: ConceptObjective[];
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrZero(value: unknown): number {
  return optionalNumber(value) ?? 0;
}

export function normalizeConceptLogRow(row: QueryRow): ConceptLogEntry {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    objective_id: optionalString(row.objective_id),
    concept_name: optionalString(row.concept_name) ?? "",
    angle: optionalString(row.angle),
    hypothesis: optionalString(row.hypothesis),
    audience: optionalString(row.audience),
    format: optionalString(row.format),
    platform: optionalString(row.platform),
    offer: optionalString(row.offer),
    landing_page_url: optionalString(row.landing_page_url),
    primary_copy: optionalString(row.primary_copy),
    bid_strategy: optionalString(row.bid_strategy),
    cost_cap: optionalNumber(row.cost_cap),
    expected_daily_spend: optionalNumber(row.expected_daily_spend),
    campaign_link_url: optionalString(row.campaign_link_url),
    ads_per_concept: optionalNumber(row.ads_per_concept),
    status: optionalString(row.status) ?? "draft",
    launch_date: optionalString(row.launch_date),
    end_date: optionalString(row.end_date),
    spend: numberOrZero(row.spend),
    impressions: numberOrZero(row.impressions),
    clicks: numberOrZero(row.clicks),
    orders: numberOrZero(row.orders),
    revenue: numberOrZero(row.revenue),
    cpa: optionalNumber(row.cpa),
    ctr: optionalNumber(row.ctr),
    verdict: optionalString(row.verdict),
    learning: optionalString(row.learning),
    next_action: optionalString(row.next_action),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)).filter(Boolean) : null,
  };
}

export function normalizeConceptObjectiveRow(row: QueryRow): ConceptObjective {
  return {
    id: String(row.id ?? ""),
    label: optionalString(row.label) ?? "",
  };
}

export function toConceptCreatePayload(clientId: string) {
  return {
    client_id: clientId,
    concept_name: "Nouveau concept",
    status: "draft",
    ads_per_concept: 1,
    spend: 0,
    impressions: 0,
    clicks: 0,
    orders: 0,
    revenue: 0,
  };
}

export function toConceptUpdatePayload(concept: ConceptLogEntry) {
  const derived = computeConceptDerivedMetrics(concept);
  return {
    objective_id: concept.objective_id,
    concept_name: concept.concept_name.trim() || "Untitled concept",
    angle: concept.angle?.trim() || null,
    hypothesis: concept.hypothesis?.trim() || null,
    audience: concept.audience?.trim() || null,
    format: concept.format?.trim() || null,
    platform: concept.platform?.trim() || null,
    offer: concept.offer?.trim() || null,
    landing_page_url: concept.landing_page_url?.trim() || null,
    primary_copy: concept.primary_copy?.trim() || null,
    bid_strategy: concept.bid_strategy?.trim() || null,
    cost_cap: optionalNumber(concept.cost_cap),
    expected_daily_spend: optionalNumber(concept.expected_daily_spend),
    campaign_link_url: concept.campaign_link_url?.trim() || null,
    ads_per_concept: optionalNumber(concept.ads_per_concept),
    status: concept.status || "draft",
    launch_date: concept.launch_date || null,
    end_date: concept.end_date || null,
    spend: numberOrZero(concept.spend),
    impressions: numberOrZero(concept.impressions),
    clicks: numberOrZero(concept.clicks),
    orders: numberOrZero(concept.orders),
    revenue: numberOrZero(concept.revenue),
    cpa: derived.cpa,
    ctr: derived.ctr,
    verdict: concept.verdict?.trim() || null,
    learning: concept.learning?.trim() || null,
    next_action: concept.next_action?.trim() || null,
    tags: concept.tags ?? null,
  };
}

export async function fetchConceptLogData(clientId: string): Promise<ConceptLogData> {
  const [conceptsResult, objectivesResult] = await Promise.all([
    supabase
      .from("gos_concept_log" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("launch_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("gos_business_objectives" as never)
      .select("id,label")
      .eq("client_id", clientId)
      .eq("status", "active"),
  ]);

  if (conceptsResult.error) throw conceptsResult.error;
  if (objectivesResult.error) throw objectivesResult.error;

  return {
    concepts: ((conceptsResult.data ?? []) as QueryRow[]).map(normalizeConceptLogRow),
    objectives: ((objectivesResult.data ?? []) as QueryRow[]).map(normalizeConceptObjectiveRow),
  };
}

export async function createConceptLogEntry(clientId: string) {
  const { error } = await supabase.from("gos_concept_log" as never).insert(toConceptCreatePayload(clientId) as never);
  if (error) throw error;
}

export async function updateConceptLogEntry(concept: ConceptLogEntry) {
  const { error } = await supabase
    .from("gos_concept_log" as never)
    .update(toConceptUpdatePayload(concept) as never)
    .eq("id", concept.id);
  if (error) throw error;
}

export async function deleteConceptLogEntry(id: string) {
  const { error } = await supabase.from("gos_concept_log" as never).delete().eq("id", id);
  if (error) throw error;
}
