import { supabase } from "@/integrations/supabase/client";
import {
  computeWeeklyRevenueVariance,
  splitMetricTargetIntoWeeks,
  type MetricTargetForWeeklyPnl,
  type WeeklyPnlTargetDraft,
} from "./weeklyPnlTargets";

export type WeeklyPnlTargetRow = WeeklyPnlTargetDraft & {
  id: string;
  client_id: string;
  actual_revenue: number | null;
  actual_ad_spend: number | null;
  actual_orders: number | null;
  actual_leads: number | null;
  actual_gross_profit: number | null;
  variance_pct: number | null;
  projection_revenue: number | null;
  projection_ad_spend: number | null;
  projection_orders: number | null;
  projection_leads: number | null;
  projection_gross_profit: number | null;
  projection_cac: number | null;
  projection_mer: number | null;
  target_locked_at: string | null;
  target_locked_by: string | null;
  projection_last_updated_at: string | null;
  projection_last_updated_by: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type WeeklyPnlActualPatch = Partial<Pick<
  WeeklyPnlTargetRow,
  "actual_revenue" | "actual_ad_spend" | "actual_orders" | "actual_leads" | "actual_gross_profit"
>>;

export type WeeklyPnlInsertPayload = WeeklyPnlTargetDraft & {
  client_id: string;
  projection_revenue: number | null;
  projection_ad_spend: number | null;
  projection_orders: number | null;
  projection_leads: number | null;
  projection_gross_profit: number | null;
  projection_cac: number | null;
  projection_mer: number | null;
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

export function normalizeWeeklyPnlTargetRow(row: QueryRow): WeeklyPnlTargetRow {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    week_number: Number(row.week_number ?? 0),
    week_start: String(row.week_start ?? ""),
    week_end: String(row.week_end ?? ""),
    target_revenue: optionalNumber(row.target_revenue),
    target_ad_spend: optionalNumber(row.target_ad_spend),
    target_orders: optionalNumber(row.target_orders),
    target_leads: optionalNumber(row.target_leads),
    target_gross_profit: optionalNumber(row.target_gross_profit),
    target_cac: optionalNumber(row.target_cac),
    target_mer: optionalNumber(row.target_mer),
    actual_revenue: optionalNumber(row.actual_revenue),
    actual_ad_spend: optionalNumber(row.actual_ad_spend),
    actual_orders: optionalNumber(row.actual_orders),
    actual_leads: optionalNumber(row.actual_leads),
    actual_gross_profit: optionalNumber(row.actual_gross_profit),
    variance_pct: optionalNumber(row.variance_pct),
    projection_revenue: optionalNumber(row.projection_revenue),
    projection_ad_spend: optionalNumber(row.projection_ad_spend),
    projection_orders: optionalNumber(row.projection_orders),
    projection_leads: optionalNumber(row.projection_leads),
    projection_gross_profit: optionalNumber(row.projection_gross_profit),
    projection_cac: optionalNumber(row.projection_cac),
    projection_mer: optionalNumber(row.projection_mer),
    target_locked_at: optionalString(row.target_locked_at),
    target_locked_by: optionalString(row.target_locked_by),
    projection_last_updated_at: optionalString(row.projection_last_updated_at),
    projection_last_updated_by: optionalString(row.projection_last_updated_by),
    parent_target_id: optionalString(row.parent_target_id),
    status: optionalString(row.status) ?? "PLANNED",
    notes: optionalString(row.notes),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export function toWeeklyPnlTargetPayload(
  clientId: string,
  draft: WeeklyPnlTargetDraft,
): WeeklyPnlInsertPayload {
  return {
    client_id: clientId,
    ...draft,
    projection_revenue: draft.target_revenue,
    projection_ad_spend: draft.target_ad_spend,
    projection_orders: draft.target_orders,
    projection_leads: draft.target_leads,
    projection_gross_profit: draft.target_gross_profit,
    projection_cac: draft.target_cac,
    projection_mer: draft.target_mer,
  };
}

export function buildWeeklyPnlTargetPayloads(
  clientId: string,
  target: MetricTargetForWeeklyPnl,
  numWeeks: number,
  startDate: string,
) {
  return splitMetricTargetIntoWeeks(target, numWeeks, startDate)
    .map((draft) => toWeeklyPnlTargetPayload(clientId, draft));
}

export function buildWeeklyActualUpdatePayload(
  current: WeeklyPnlTargetRow,
  patch: WeeklyPnlActualPatch,
) {
  const merged = { ...current, ...patch };
  return {
    ...patch,
    variance_pct: computeWeeklyRevenueVariance(merged),
  };
}

export async function fetchWeeklyPnlTargets(clientId: string): Promise<WeeklyPnlTargetRow[]> {
  const { data, error } = await supabase
    .from("gos_weekly_pnl_targets" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("week_start", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeWeeklyPnlTargetRow);
}

export async function createWeeklyPnlTargets(
  clientId: string,
  target: MetricTargetForWeeklyPnl,
  numWeeks: number,
  startDate: string,
): Promise<void> {
  const payloads = buildWeeklyPnlTargetPayloads(clientId, target, numWeeks, startDate);
  const { error } = await supabase
    .from("gos_weekly_pnl_targets" as never)
    .insert(payloads);

  if (error) throw error;
}

export async function updateWeeklyPnlActuals(
  current: WeeklyPnlTargetRow,
  patch: WeeklyPnlActualPatch,
): Promise<void> {
  const payload = buildWeeklyActualUpdatePayload(current, patch);
  const { error } = await supabase
    .from("gos_weekly_pnl_targets" as never)
    .update(payload)
    .eq("id", current.id);

  if (error) throw error;
}
