import { supabase } from "@/integrations/supabase/client";
import {
  buildBudgetComplianceMonitor,
  type BudgetComplianceMonitorInput,
  type BudgetComplianceMonitorOutput,
} from "./budgetComplianceMonitor";
import { fetchProfitFirstBudgetChangeGateRuns } from "./profitFirstBudgetChangeGateController";
import {
  fetchBudgetApplicationGuardRuns,
  fetchCampaignBudgetStates,
} from "./budgetApplicationController";

export type BudgetComplianceMonitorModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: BudgetComplianceMonitorOutput;
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

export function normalizeBudgetComplianceMonitorModelRunRow(row: QueryRow): BudgetComplianceMonitorModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as BudgetComplianceMonitorOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export function toBudgetComplianceMonitorModelRunPayload(
  clientId: string,
  input: BudgetComplianceMonitorInput,
  output: BudgetComplianceMonitorOutput,
) {
  return {
    client_id: clientId,
    model_name: "budget_compliance_monitor",
    model_version: "v1",
    input_json: jsonClone({
      campaign_count: input.campaigns.length,
      latest_gate_generated_at: input.latest_gate_generated_at ?? null,
      latest_gate_decision: input.latest_gate?.decision ?? null,
      latest_application_generated_at: input.latest_application_generated_at ?? null,
      latest_application_applied: input.latest_application?.application.applied ?? null,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "current_campaign_budget_totals",
        "budget_change_gate_compliance",
        "budget_application_audit_drift",
        "max_safe_spend_monitoring",
      ],
      deterministic: true,
    },
    generated_by: "gos_budget_compliance_monitor",
  };
}

export async function buildBudgetComplianceMonitorInputForClient(clientId: string): Promise<BudgetComplianceMonitorInput> {
  const [campaigns, gateRuns, applicationRuns] = await Promise.all([
    fetchCampaignBudgetStates(clientId),
    fetchProfitFirstBudgetChangeGateRuns(clientId),
    fetchBudgetApplicationGuardRuns(clientId),
  ]);
  const gateRun = gateRuns[0] ?? null;
  const applicationRun = applicationRuns[0] ?? null;

  return {
    campaigns,
    latest_gate: gateRun?.output_json ?? null,
    latest_gate_generated_at: gateRun?.generated_at ?? null,
    latest_application: applicationRun?.output_json ?? null,
    latest_application_generated_at: applicationRun?.generated_at ?? null,
  };
}

export async function saveBudgetComplianceMonitorRun(
  clientId: string,
  input: BudgetComplianceMonitorInput,
  output: BudgetComplianceMonitorOutput,
): Promise<BudgetComplianceMonitorModelRunRow> {
  const payload = toBudgetComplianceMonitorModelRunPayload(clientId, input, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeBudgetComplianceMonitorModelRunRow(data as QueryRow);
}

export async function runAndSaveBudgetComplianceMonitor(
  clientId: string,
): Promise<{ output: BudgetComplianceMonitorOutput; run: BudgetComplianceMonitorModelRunRow }> {
  const input = await buildBudgetComplianceMonitorInputForClient(clientId);
  const output = buildBudgetComplianceMonitor(input);
  const run = await saveBudgetComplianceMonitorRun(clientId, input, output);
  return { output, run };
}

export async function fetchBudgetComplianceMonitorRuns(clientId: string): Promise<BudgetComplianceMonitorModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "budget_compliance_monitor")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeBudgetComplianceMonitorModelRunRow);
}
