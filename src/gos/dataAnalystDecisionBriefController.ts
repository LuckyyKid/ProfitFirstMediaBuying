import { supabase } from "@/integrations/supabase/client";
import {
  buildDataAnalystDecisionBrief,
  type DataAnalystDecisionBriefOutput,
} from "./dataAnalystDecisionBrief";
import { fetchDataAnalystFoundationRuns } from "./dataAnalystFoundationController";
import { fetchDataAnalystStatisticalRuns } from "./dataAnalystStatisticalController";
import type { DataAnalystFoundationOutput } from "./dataAnalystFoundation";
import type { DataAnalystStatisticalOutput } from "./dataAnalystStatisticalController";

export type DataAnalystDecisionBriefModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: DataAnalystDecisionBriefOutput;
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

export function toDataAnalystDecisionBriefModelRunPayload(
  clientId: string,
  foundation: DataAnalystFoundationOutput | null,
  statistical: DataAnalystStatisticalOutput | null,
  output: DataAnalystDecisionBriefOutput,
) {
  return {
    client_id: clientId,
    model_name: "data_analyst_decision_brief",
    model_version: "v1",
    input_json: jsonClone({
      foundation_generated_at: foundation?.generated_at ?? null,
      foundation_readiness: foundation?.readiness ?? null,
      foundation_score: foundation?.score ?? null,
      statistical_generated_at: statistical?.generated_at ?? null,
      statistical_readiness: statistical?.readiness ?? null,
      statistical_engine: statistical?.engine_version ?? null,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "foundation_readiness_gate",
        "critical_pnl_anomaly_gate",
        "retention_ltv_guardrail",
        "spend_regression_guardrail",
        "channel_incrementality_context_guardrail",
        "decision_posture_selection",
      ],
      deterministic: true,
    },
    generated_by: "gos_data_analyst_decision_brief",
  };
}

export function normalizeDataAnalystDecisionBriefModelRunRow(row: QueryRow): DataAnalystDecisionBriefModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as DataAnalystDecisionBriefOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export async function saveDataAnalystDecisionBriefRun(
  clientId: string,
  foundation: DataAnalystFoundationOutput | null,
  statistical: DataAnalystStatisticalOutput | null,
  output: DataAnalystDecisionBriefOutput,
): Promise<DataAnalystDecisionBriefModelRunRow> {
  const payload = toDataAnalystDecisionBriefModelRunPayload(clientId, foundation, statistical, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeDataAnalystDecisionBriefModelRunRow(data as QueryRow);
}

export async function runAndSaveDataAnalystDecisionBrief(
  clientId: string,
): Promise<{ output: DataAnalystDecisionBriefOutput; run: DataAnalystDecisionBriefModelRunRow }> {
  const [foundationRuns, statisticalRuns] = await Promise.all([
    fetchDataAnalystFoundationRuns(clientId),
    fetchDataAnalystStatisticalRuns(clientId),
  ]);
  const foundation = foundationRuns[0]?.output_json ?? null;
  const statistical = statisticalRuns[0]?.output_json ?? null;
  const output = buildDataAnalystDecisionBrief({ foundation, statistical });
  const run = await saveDataAnalystDecisionBriefRun(clientId, foundation, statistical, output);
  return { output, run };
}

export async function fetchDataAnalystDecisionBriefRuns(
  clientId: string,
): Promise<DataAnalystDecisionBriefModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "data_analyst_decision_brief")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeDataAnalystDecisionBriefModelRunRow);
}
