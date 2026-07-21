import { supabase } from "@/integrations/supabase/client";
import {
  computeVariancePct,
  generateDailyTargets,
  type DailyTargetRow,
  type DayWeights,
  type WeeklyTargetInput,
} from "./dailyTargets";
import {
  normalizeWeeklyPnlTargetRow,
  type WeeklyPnlTargetRow,
} from "./weeklyPnlController";

type QueryRow = Record<string, unknown>;

export type DailyPnlTargetRow = DailyTargetRow & {
  id: string;
  actual_revenue: number | null;
  actual_ad_spend: number | null;
  actual_orders: number | null;
  actual_leads: number | null;
  variance_pct: number | null;
  projection_revenue: number | null;
  projection_ad_spend: number | null;
  projection_orders: number | null;
  projection_leads: number | null;
  projection_gross_profit: number | null;
  target_locked_at: string | null;
  target_locked_by: string | null;
  projection_last_updated_at: string | null;
  projection_last_updated_by: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DailyPnlActualPatch = Partial<Pick<
  DailyPnlTargetRow,
  "actual_revenue" | "actual_ad_spend" | "actual_orders" | "actual_leads"
>>;

export type DailyPnlWorkspace = {
  weeks: WeeklyPnlTargetRow[];
  days: DailyPnlTargetRow[];
};

export type DailyPnlInsertPayload = DailyTargetRow & {
  projection_revenue: number | null;
  projection_ad_spend: number | null;
  projection_orders: number | null;
  projection_leads: number | null;
  projection_gross_profit: number | null;
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

export function normalizeDailyPnlTargetRow(row: QueryRow): DailyPnlTargetRow {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    parent_weekly_id: String(row.parent_weekly_id ?? ""),
    target_date: String(row.target_date ?? ""),
    day_of_week: Number(row.day_of_week ?? 0),
    day_index: Number(row.day_index ?? 0),
    pacing_weight: optionalNumber(row.pacing_weight) ?? 0,
    target_revenue: optionalNumber(row.target_revenue),
    target_ad_spend: optionalNumber(row.target_ad_spend),
    target_orders: optionalNumber(row.target_orders),
    target_leads: optionalNumber(row.target_leads),
    target_gross_profit: optionalNumber(row.target_gross_profit),
    actual_revenue: optionalNumber(row.actual_revenue),
    actual_ad_spend: optionalNumber(row.actual_ad_spend),
    actual_orders: optionalNumber(row.actual_orders),
    actual_leads: optionalNumber(row.actual_leads),
    variance_pct: optionalNumber(row.variance_pct),
    projection_revenue: optionalNumber(row.projection_revenue),
    projection_ad_spend: optionalNumber(row.projection_ad_spend),
    projection_orders: optionalNumber(row.projection_orders),
    projection_leads: optionalNumber(row.projection_leads),
    projection_gross_profit: optionalNumber(row.projection_gross_profit),
    target_locked_at: optionalString(row.target_locked_at),
    target_locked_by: optionalString(row.target_locked_by),
    projection_last_updated_at: optionalString(row.projection_last_updated_at),
    projection_last_updated_by: optionalString(row.projection_last_updated_by),
    status: optionalString(row.status) ?? "PLANNED",
    notes: optionalString(row.notes),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export function toDailyPnlInsertPayload(row: DailyTargetRow): DailyPnlInsertPayload {
  return {
    ...row,
    projection_revenue: row.target_revenue,
    projection_ad_spend: row.target_ad_spend,
    projection_orders: row.target_orders,
    projection_leads: row.target_leads,
    projection_gross_profit: row.target_gross_profit,
  };
}

export function buildDailyPnlInsertPayloads(
  weekly: WeeklyTargetInput,
  weights: DayWeights,
): DailyPnlInsertPayload[] {
  return generateDailyTargets(weekly, weights).map(toDailyPnlInsertPayload);
}

export function weeklyPnlRowToDailyInput(
  week: WeeklyPnlTargetRow,
  fallbackClientId?: string,
): WeeklyTargetInput {
  return {
    id: week.id,
    client_id: week.client_id || fallbackClientId || "",
    week_start: week.week_start,
    target_revenue: week.target_revenue,
    target_ad_spend: week.target_ad_spend,
    target_orders: week.target_orders,
    target_leads: week.target_leads,
    target_gross_profit: week.target_gross_profit,
  };
}

export function buildDailyActualUpdatePayload(
  current: DailyPnlTargetRow,
  patch: DailyPnlActualPatch,
) {
  const merged = { ...current, ...patch };
  return {
    ...patch,
    variance_pct: computeVariancePct(merged.target_revenue, merged.actual_revenue),
  };
}

export async function fetchDailyPnlWorkspace(clientId: string): Promise<DailyPnlWorkspace> {
  const [weeksResult, daysResult] = await Promise.all([
    supabase
      .from("gos_weekly_pnl_targets" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("week_start", { ascending: true }),
    supabase
      .from("gos_daily_pnl_targets" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("target_date", { ascending: true }),
  ]);

  if (weeksResult.error) throw weeksResult.error;
  if (daysResult.error) throw daysResult.error;

  return {
    weeks: ((weeksResult.data ?? []) as QueryRow[]).map(normalizeWeeklyPnlTargetRow),
    days: ((daysResult.data ?? []) as QueryRow[]).map(normalizeDailyPnlTargetRow),
  };
}

export async function regenerateDailyPnlTargets(
  week: WeeklyPnlTargetRow,
  weights: DayWeights,
  fallbackClientId?: string,
): Promise<void> {
  const payloads = buildDailyPnlInsertPayloads(
    weeklyPnlRowToDailyInput(week, fallbackClientId),
    weights,
  );

  const { error: deleteError } = await supabase
    .from("gos_daily_pnl_targets" as never)
    .delete()
    .eq("parent_weekly_id", week.id);

  if (deleteError) throw deleteError;

  const { error } = await supabase
    .from("gos_daily_pnl_targets" as never)
    .insert(payloads);

  if (error) throw error;
}

export async function updateDailyPnlActuals(
  current: DailyPnlTargetRow,
  patch: DailyPnlActualPatch,
): Promise<void> {
  const payload = buildDailyActualUpdatePayload(current, patch);
  const { error } = await supabase
    .from("gos_daily_pnl_targets" as never)
    .update(payload)
    .eq("id", current.id);

  if (error) throw error;
}
