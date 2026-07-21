import { supabase } from "@/integrations/supabase/client";
import {
  buildDataAnalystExecutionPlan,
  type DataAnalystExecutionPlanOutput,
} from "./dataAnalystExecutionPlan";
import { fetchDataAnalystDecisionBriefRuns } from "./dataAnalystDecisionBriefController";
import type { DataAnalystDecisionBriefOutput } from "./dataAnalystDecisionBrief";

export type DataAnalystExecutionPlanModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: DataAnalystExecutionPlanOutput;
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

export function toDataAnalystExecutionPlanModelRunPayload(
  clientId: string,
  brief: DataAnalystDecisionBriefOutput | null,
  output: DataAnalystExecutionPlanOutput,
) {
  return {
    client_id: clientId,
    model_name: "data_analyst_execution_plan",
    model_version: "v1",
    input_json: jsonClone({
      brief_generated_at: brief?.generated_at ?? null,
      brief_posture: brief?.posture ?? null,
      brief_confidence_score: brief?.confidence_score ?? null,
      source_action_count: brief?.actions.length ?? 0,
      source_guardrail_count: brief?.guardrails.length ?? 0,
      clash_code_confirm_step_count: output.clash_code_confirm.length,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "decision_action_to_work_item_mapping",
        "clash_code_confirm_workflow_mapping",
        "priority_due_date_assignment",
        "guardrail_monitor_mapping",
        "operating_mode_selection",
      ],
      deterministic: true,
    },
    generated_by: "gos_data_analyst_execution_plan",
  };
}

export function normalizeDataAnalystExecutionPlanModelRunRow(row: QueryRow): DataAnalystExecutionPlanModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as DataAnalystExecutionPlanOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export async function saveDataAnalystExecutionPlanRun(
  clientId: string,
  brief: DataAnalystDecisionBriefOutput | null,
  output: DataAnalystExecutionPlanOutput,
): Promise<DataAnalystExecutionPlanModelRunRow> {
  const payload = toDataAnalystExecutionPlanModelRunPayload(clientId, brief, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeDataAnalystExecutionPlanModelRunRow(data as QueryRow);
}

export async function runAndSaveDataAnalystExecutionPlan(
  clientId: string,
): Promise<{ output: DataAnalystExecutionPlanOutput; run: DataAnalystExecutionPlanModelRunRow }> {
  const briefRuns = await fetchDataAnalystDecisionBriefRuns(clientId);
  const brief = briefRuns[0]?.output_json ?? null;
  const output = buildDataAnalystExecutionPlan({ brief });
  const run = await saveDataAnalystExecutionPlanRun(clientId, brief, output);
  return { output, run };
}

export async function fetchDataAnalystExecutionPlanRuns(
  clientId: string,
): Promise<DataAnalystExecutionPlanModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "data_analyst_execution_plan")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeDataAnalystExecutionPlanModelRunRow);
}
