import { supabase } from "@/integrations/supabase/client";
import {
  runCreativeDemand,
  type CreativeDemandInput,
  type CreativeDemandOutput,
} from "./creativeDemand";

export type CreativeDemandDraft = {
  period_label: string;
  target_ad_spend: number | null | undefined;
  avg_cpm: number | null | undefined;
  fatigue_threshold_impressions: number | null | undefined;
  notes?: string | null;
};

export type CreativeDemandRunRow = {
  id: string;
  client_id: string;
  period_label: string;
  target_ad_spend: number | null;
  avg_cpm: number | null;
  fatigue_threshold_impressions: number | null;
  creatives_per_week_needed: number | null;
  static_creatives_needed: number | null;
  video_creatives_needed: number | null;
  ugc_creatives_needed: number | null;
  breakdown: Record<string, unknown> | null;
  confidence: number | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

type QueryRow = Record<string, unknown>;

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toCreativeDemandInput(draft: CreativeDemandDraft): CreativeDemandInput {
  return {
    weekly_spend: optionalNumber(draft.target_ad_spend),
    avg_cpm: optionalNumber(draft.avg_cpm),
    fatigue_threshold_impressions: optionalNumber(draft.fatigue_threshold_impressions),
  };
}

export function toCreativeDemandRunPayload(
  clientId: string,
  draft: CreativeDemandDraft,
  output: CreativeDemandOutput = runCreativeDemand(toCreativeDemandInput(draft)),
) {
  return {
    client_id: clientId,
    period_label: draft.period_label.trim(),
    target_ad_spend: optionalNumber(draft.target_ad_spend),
    avg_cpm: optionalNumber(draft.avg_cpm),
    fatigue_threshold_impressions: optionalNumber(draft.fatigue_threshold_impressions),
    creatives_per_week_needed: output.creatives_per_week_needed,
    static_creatives_needed: output.static_creatives_needed,
    video_creatives_needed: output.video_creatives_needed,
    ugc_creatives_needed: output.ugc_creatives_needed,
    breakdown: output.breakdown,
    assumptions: output.assumptions,
    formula_used: output.formula_used,
    confidence: output.confidence,
    status: "DRAFT",
    notes: optionalString(draft.notes),
  };
}

export function normalizeCreativeDemandRunRow(row: QueryRow): CreativeDemandRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    period_label: String(row.period_label ?? ""),
    target_ad_spend: optionalNumber(row.target_ad_spend),
    avg_cpm: optionalNumber(row.avg_cpm),
    fatigue_threshold_impressions: optionalNumber(row.fatigue_threshold_impressions),
    creatives_per_week_needed: optionalNumber(row.creatives_per_week_needed),
    static_creatives_needed: optionalNumber(row.static_creatives_needed),
    video_creatives_needed: optionalNumber(row.video_creatives_needed),
    ugc_creatives_needed: optionalNumber(row.ugc_creatives_needed),
    breakdown: (row.breakdown as Record<string, unknown> | null | undefined) ?? null,
    confidence: optionalNumber(row.confidence),
    status: optionalString(row.status),
    notes: optionalString(row.notes),
    created_at: String(row.created_at ?? ""),
  };
}

export async function fetchCreativeDemandRuns(clientId: string): Promise<CreativeDemandRunRow[]> {
  const { data, error } = await supabase
    .from("gos_creative_demand_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeCreativeDemandRunRow);
}

export async function createCreativeDemandRun(
  clientId: string,
  draft: CreativeDemandDraft,
): Promise<void> {
  const output = runCreativeDemand(toCreativeDemandInput(draft));
  const payload = toCreativeDemandRunPayload(clientId, draft, output);
  const { error } = await supabase
    .from("gos_creative_demand_runs" as never)
    .insert(payload);

  if (error) throw error;
}
