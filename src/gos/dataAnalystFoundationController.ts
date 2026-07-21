import { supabase } from "@/integrations/supabase/client";
import { fetchCustomerTransactions } from "./customerCohortController";
import { fetchDailyPnlWorkspace } from "./dailyPnlController";
import { fetchProjectionUpdates } from "./projectionAuditController";
import {
  runDataAnalystFoundation,
  type DataAnalystFoundationInput,
  type DataAnalystFoundationOutput,
} from "./dataAnalystFoundation";

export type DataAnalystFoundationModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: DataAnalystFoundationOutput;
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

function minDate(rows: { transaction_date?: string | null; target_date?: string | null }[]): string | null {
  const dates = rows
    .map((row) => row.transaction_date ?? row.target_date ?? null)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates[0] ?? null;
}

function maxDate(rows: { transaction_date?: string | null; target_date?: string | null }[]): string | null {
  const dates = rows
    .map((row) => row.transaction_date ?? row.target_date ?? null)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.at(-1) ?? null;
}

export function toDataAnalystFoundationModelRunPayload(
  clientId: string,
  input: DataAnalystFoundationInput,
  output: DataAnalystFoundationOutput,
) {
  return {
    client_id: clientId,
    model_name: "data_analyst_foundation",
    model_version: "v1",
    input_json: jsonClone({
      transaction_count: input.transactions.length,
      transaction_start: minDate(input.transactions),
      transaction_end: maxDate(input.transactions),
      daily_row_count: input.dailyTargets.length,
      daily_start: minDate(input.dailyTargets),
      daily_end: maxDate(input.dailyTargets),
      projection_update_count: input.projectionUpdates.length,
      nowIso: input.nowIso ?? output.generated_at,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "transaction_data_quality",
        "monthly_customer_cohort_readiness",
        "daily_pnl_target_projection_actual_coverage",
        "projection_audit_recency",
        "analyst_model_card",
      ],
      deterministic: true,
    },
    generated_by: "gos_data_analyst_foundation",
  };
}

export function normalizeDataAnalystFoundationModelRunRow(row: QueryRow): DataAnalystFoundationModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as DataAnalystFoundationOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export async function buildDataAnalystFoundationInput(clientId: string): Promise<DataAnalystFoundationInput> {
  const [transactions, workspace, projectionUpdates] = await Promise.all([
    fetchCustomerTransactions(clientId),
    fetchDailyPnlWorkspace(clientId),
    fetchProjectionUpdates(clientId, { limit: 200 }),
  ]);

  return {
    transactions,
    dailyTargets: workspace.days,
    projectionUpdates,
  };
}

export async function runDataAnalystFoundationForClient(clientId: string): Promise<DataAnalystFoundationOutput> {
  const input = await buildDataAnalystFoundationInput(clientId);
  return runDataAnalystFoundation(input);
}

export async function saveDataAnalystFoundationRun(
  clientId: string,
  input: DataAnalystFoundationInput,
  output: DataAnalystFoundationOutput,
): Promise<DataAnalystFoundationModelRunRow> {
  const payload = toDataAnalystFoundationModelRunPayload(clientId, input, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeDataAnalystFoundationModelRunRow(data as QueryRow);
}

export async function runAndSaveDataAnalystFoundation(
  clientId: string,
): Promise<{ output: DataAnalystFoundationOutput; run: DataAnalystFoundationModelRunRow }> {
  const input = await buildDataAnalystFoundationInput(clientId);
  const output = runDataAnalystFoundation(input);
  const run = await saveDataAnalystFoundationRun(clientId, input, output);
  return { output, run };
}

export async function fetchDataAnalystFoundationRuns(
  clientId: string,
): Promise<DataAnalystFoundationModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "data_analyst_foundation")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeDataAnalystFoundationModelRunRow);
}
