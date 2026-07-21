import { supabase } from "@/integrations/supabase/client";

type QueryRow = Record<string, unknown>;

export type BusinessObjective = {
  id: string;
  client_id: string;
  objective_type: string;
  label: string;
  primary_kpi: string;
  target_value: number | null;
  current_value: number | null;
  timeframe_start: string | null;
  timeframe_end: string | null;
  rationale: string | null;
  constraints_notes: string | null;
  status: string;
  priority: number;
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

function integerOr(value: unknown, fallback: number): number {
  const n = optionalNumber(value);
  return n == null ? fallback : Math.max(1, Math.round(n));
}

export function normalizeBusinessObjectiveRow(row: QueryRow): BusinessObjective {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    objective_type: optionalString(row.objective_type) ?? "acquire_new",
    label: optionalString(row.label) ?? "Nouvel objectif",
    primary_kpi: optionalString(row.primary_kpi) ?? "new_customers",
    target_value: optionalNumber(row.target_value),
    current_value: optionalNumber(row.current_value),
    timeframe_start: optionalString(row.timeframe_start),
    timeframe_end: optionalString(row.timeframe_end),
    rationale: optionalString(row.rationale),
    constraints_notes: optionalString(row.constraints_notes),
    status: optionalString(row.status) ?? "active",
    priority: integerOr(row.priority, 1),
  };
}

export function toBusinessObjectiveCreatePayload(clientId: string, priority: number) {
  return {
    client_id: clientId,
    objective_type: "acquire_new",
    label: "Nouvel objectif",
    primary_kpi: "new_customers",
    status: "active",
    priority: integerOr(priority, 1),
  };
}

export function toBusinessObjectiveUpdatePayload(item: BusinessObjective) {
  return {
    objective_type: optionalString(item.objective_type) ?? "other",
    label: optionalString(item.label) ?? "Untitled objective",
    primary_kpi: optionalString(item.primary_kpi) ?? "new_customers",
    target_value: optionalNumber(item.target_value),
    current_value: optionalNumber(item.current_value),
    timeframe_start: optionalString(item.timeframe_start),
    timeframe_end: optionalString(item.timeframe_end),
    rationale: optionalString(item.rationale),
    constraints_notes: optionalString(item.constraints_notes),
    status: optionalString(item.status) ?? "active",
    priority: integerOr(item.priority, 1),
  };
}

export async function fetchBusinessObjectives(clientId: string): Promise<BusinessObjective[]> {
  const { data, error } = await supabase
    .from("gos_business_objectives" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("status")
    .order("priority");

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeBusinessObjectiveRow);
}

export async function createBusinessObjective(clientId: string, priority: number): Promise<void> {
  const { error } = await supabase
    .from("gos_business_objectives" as never)
    .insert(toBusinessObjectiveCreatePayload(clientId, priority) as never);

  if (error) throw error;
}

export async function saveBusinessObjective(item: BusinessObjective): Promise<void> {
  const { error } = await supabase
    .from("gos_business_objectives" as never)
    .update(toBusinessObjectiveUpdatePayload(item) as never)
    .eq("id", item.id);

  if (error) throw error;
}

export async function deleteBusinessObjective(id: string): Promise<void> {
  const { error } = await supabase
    .from("gos_business_objectives" as never)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
