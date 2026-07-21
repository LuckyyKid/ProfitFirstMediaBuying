import { supabase } from "@/integrations/supabase/client";
import {
  runSpendEfficiencyFrontier,
  type SpendEfficiencyFrontierOutput,
  type SpendEfficiencyInput,
} from "./spendEfficiencyFrontier";

export type SpendEfficiencyModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: SpendEfficiencyFrontierOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

type QueryRow = Record<string, unknown>;

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toSpendEfficiencyModelRunPayload(
  clientId: string,
  input: SpendEfficiencyInput,
  output: SpendEfficiencyFrontierOutput,
) {
  return {
    client_id: clientId,
    model_name: "spend_efficiency_frontier",
    model_version: "v1",
    input_json: jsonClone(input) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: ["log_linear_amr_or_average_fallback", "contribution_margin", "ltv_multiplier", "objective_selection"],
      objective: output.objective,
    },
    generated_by: "gos_spend_efficiency_frontier",
  };
}

export function normalizeSpendEfficiencyModelRunRow(row: QueryRow): SpendEfficiencyModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as SpendEfficiencyFrontierOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export async function saveSpendEfficiencyFrontierRun(
  clientId: string,
  input: SpendEfficiencyInput,
  output: SpendEfficiencyFrontierOutput,
): Promise<SpendEfficiencyModelRunRow> {
  const payload = toSpendEfficiencyModelRunPayload(clientId, input, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeSpendEfficiencyModelRunRow(data as QueryRow);
}

export async function runAndSaveSpendEfficiencyFrontier(
  clientId: string,
  input: SpendEfficiencyInput,
): Promise<{ output: SpendEfficiencyFrontierOutput; run: SpendEfficiencyModelRunRow }> {
  const output = runSpendEfficiencyFrontier(input);
  const run = await saveSpendEfficiencyFrontierRun(clientId, input, output);
  return { output, run };
}

export async function fetchSpendEfficiencyFrontierRuns(clientId: string): Promise<SpendEfficiencyModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "spend_efficiency_frontier")
    .order("generated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeSpendEfficiencyModelRunRow);
}
