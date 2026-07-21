import { supabase } from "@/integrations/supabase/client";
import {
  buildProjectionUpdatePayload,
  buildTargetLockPayload,
  type DailyProjectionPatch,
  type ProjectionScope,
  type WeeklyProjectionPatch,
} from "./projectionAudit";

type QueryRow = Record<string, unknown>;

export type ProjectionUpdateRow = {
  id: string;
  client_id: string;
  scope: ProjectionScope;
  target_row_id: string;
  period_date: string | null;
  period_start: string | null;
  period_end: string | null;
  metric_name: string;
  old_value: unknown;
  new_value: unknown;
  change_type: "projection_update" | "target_lock" | "target_unlock" | string;
  note: string | null;
  updated_by: string | null;
  created_at: string;
};

export type ProjectionAuditFilter = {
  scope?: ProjectionScope;
  targetRowIds?: string[];
  limit?: number;
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function normalizeProjectionUpdateRow(row: QueryRow): ProjectionUpdateRow {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    scope: row.scope === "weekly" ? "weekly" : "daily",
    target_row_id: String(row.target_row_id ?? ""),
    period_date: optionalString(row.period_date),
    period_start: optionalString(row.period_start),
    period_end: optionalString(row.period_end),
    metric_name: String(row.metric_name ?? ""),
    old_value: row.old_value ?? null,
    new_value: row.new_value ?? null,
    change_type: String(row.change_type ?? "projection_update"),
    note: optionalString(row.note),
    updated_by: optionalString(row.updated_by),
    created_at: String(row.created_at ?? ""),
  };
}

export async function fetchProjectionUpdates(
  clientId: string,
  filter: ProjectionAuditFilter = {},
): Promise<ProjectionUpdateRow[]> {
  let query = supabase
    .from("gos_projection_updates" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 50);

  if (filter.scope) {
    query = query.eq("scope", filter.scope);
  }

  if (filter.targetRowIds?.length) {
    query = query.in("target_row_id", filter.targetRowIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeProjectionUpdateRow);
}

export function buildDailyProjectionPayload(patch: DailyProjectionPatch): DailyProjectionPatch {
  return buildProjectionUpdatePayload("daily", patch) as DailyProjectionPatch;
}

export function buildWeeklyProjectionPayload(patch: WeeklyProjectionPatch): WeeklyProjectionPatch {
  return buildProjectionUpdatePayload("weekly", patch) as WeeklyProjectionPatch;
}

export async function updateDailyProjection(
  id: string,
  patch: DailyProjectionPatch,
): Promise<void> {
  const payload = buildDailyProjectionPayload(patch);
  const { error } = await supabase
    .from("gos_daily_pnl_targets" as never)
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function updateWeeklyProjection(
  id: string,
  patch: WeeklyProjectionPatch,
): Promise<void> {
  const payload = buildWeeklyProjectionPayload(patch);
  const { error } = await supabase
    .from("gos_weekly_pnl_targets" as never)
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function setTargetLock(
  scope: ProjectionScope,
  id: string,
  locked: boolean,
): Promise<void> {
  const table = scope === "daily" ? "gos_daily_pnl_targets" : "gos_weekly_pnl_targets";
  const payload = buildTargetLockPayload(locked);
  const { error } = await supabase
    .from(table as never)
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}
