import { supabase } from "@/integrations/supabase/client";
import {
  buildProfitFirstBudgetChangeGate,
  type ProfitFirstBudgetChangeGateInput,
  type ProfitFirstBudgetChangeGateOutput,
} from "./profitFirstBudgetChangeGate";
import type { ProfitFirstOutput } from "./profitFirstMediaBuying";
import {
  fetchDataAnalystExecutionPlanRuns,
  type DataAnalystExecutionPlanModelRunRow,
} from "./dataAnalystExecutionPlanController";

export type BudgetChangeGateProposal = {
  proposed_monthly_spend: number;
  current_monthly_spend?: number | null;
  proposal_source?: string | null;
  reason?: string | null;
};

export type ActiveCampaignBudgetTotals = {
  active_campaign_count: number;
  current_daily_spend: number;
  current_monthly_spend: number;
};

export type ProfitFirstMediaBuyingModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: ProfitFirstOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

export type ProfitFirstBudgetChangeGateModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: ProfitFirstBudgetChangeGateOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

type QueryRow = Record<string, unknown>;

const DAYS_PER_MONTH = 30.4;

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

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

export function normalizeProfitFirstMediaBuyingModelRunRow(row: QueryRow): ProfitFirstMediaBuyingModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as ProfitFirstOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export function normalizeProfitFirstBudgetChangeGateModelRunRow(row: QueryRow): ProfitFirstBudgetChangeGateModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as ProfitFirstBudgetChangeGateOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export function toProfitFirstBudgetChangeGateModelRunPayload(
  clientId: string,
  input: ProfitFirstBudgetChangeGateInput,
  output: ProfitFirstBudgetChangeGateOutput,
) {
  return {
    client_id: clientId,
    model_name: "profit_first_budget_change_gate",
    model_version: "v1",
    input_json: jsonClone({
      current_monthly_spend: input.current_monthly_spend ?? null,
      proposed_monthly_spend: input.proposed_monthly_spend ?? null,
      proposal_source: input.proposal_source ?? null,
      reason: input.reason ?? null,
      profit_first_generated_at: input.profit_first_generated_at ?? null,
      execution_plan_generated_at: input.execution_plan?.generated_at ?? null,
      execution_plan_posture: input.execution_plan?.posture ?? null,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "pfmb_safe_spend_cap",
        "cash_cap",
        "funnel_cap",
        "contribution_guardrail",
        "ltv_cac_guardrail",
        "execution_plan_posture_gate",
      ],
      deterministic: true,
    },
    generated_by: "gos_profit_first_budget_change_gate",
  };
}

export async function fetchActiveCampaignBudgetTotals(clientId: string): Promise<ActiveCampaignBudgetTotals> {
  const { data, error } = await supabase
    .from("gos_campaigns" as never)
    .select("current_daily_budget, active")
    .eq("client_id", clientId);

  if (error) throw error;
  const rows = (data ?? []) as Array<{ current_daily_budget?: number | null; active?: boolean | null }>;
  const activeRows = rows.filter((row) => row.active !== false);
  const daily = activeRows.reduce((sum, row) => sum + Number(row.current_daily_budget ?? 0), 0);
  return {
    active_campaign_count: activeRows.length,
    current_daily_spend: money(daily),
    current_monthly_spend: money(daily * DAYS_PER_MONTH),
  };
}

export async function fetchLatestProfitFirstMediaBuyingRun(clientId: string): Promise<ProfitFirstMediaBuyingModelRunRow | null> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "profit_first_media_buying")
    .order("generated_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const row = ((data ?? []) as QueryRow[])[0];
  return row ? normalizeProfitFirstMediaBuyingModelRunRow(row) : null;
}

export async function buildProfitFirstBudgetChangeGateInputForClient(
  clientId: string,
  proposal: BudgetChangeGateProposal,
): Promise<{
  input: ProfitFirstBudgetChangeGateInput;
  budget_totals: ActiveCampaignBudgetTotals;
  profit_first_run: ProfitFirstMediaBuyingModelRunRow | null;
  execution_plan_run: DataAnalystExecutionPlanModelRunRow | null;
}> {
  const [budgetTotals, profitFirstRun, executionRuns] = await Promise.all([
    fetchActiveCampaignBudgetTotals(clientId),
    fetchLatestProfitFirstMediaBuyingRun(clientId),
    fetchDataAnalystExecutionPlanRuns(clientId),
  ]);
  const executionPlanRun = executionRuns[0] ?? null;
  const input: ProfitFirstBudgetChangeGateInput = {
    current_monthly_spend: proposal.current_monthly_spend ?? budgetTotals.current_monthly_spend,
    proposed_monthly_spend: proposal.proposed_monthly_spend,
    proposal_source: proposal.proposal_source ?? "manual",
    reason: proposal.reason ?? null,
    profit_first: profitFirstRun?.output_json ?? null,
    profit_first_generated_at: profitFirstRun?.generated_at ?? null,
    execution_plan: executionPlanRun?.output_json ?? null,
  };

  return { input, budget_totals: budgetTotals, profit_first_run: profitFirstRun, execution_plan_run: executionPlanRun };
}

export async function saveProfitFirstBudgetChangeGateRun(
  clientId: string,
  input: ProfitFirstBudgetChangeGateInput,
  output: ProfitFirstBudgetChangeGateOutput,
): Promise<ProfitFirstBudgetChangeGateModelRunRow> {
  const payload = toProfitFirstBudgetChangeGateModelRunPayload(clientId, input, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeProfitFirstBudgetChangeGateModelRunRow(data as QueryRow);
}

export async function runAndSaveProfitFirstBudgetChangeGate(
  clientId: string,
  proposal: BudgetChangeGateProposal,
): Promise<{
  output: ProfitFirstBudgetChangeGateOutput;
  run: ProfitFirstBudgetChangeGateModelRunRow;
  budget_totals: ActiveCampaignBudgetTotals;
  profit_first_run: ProfitFirstMediaBuyingModelRunRow | null;
  execution_plan_run: DataAnalystExecutionPlanModelRunRow | null;
}> {
  const context = await buildProfitFirstBudgetChangeGateInputForClient(clientId, proposal);
  const output = buildProfitFirstBudgetChangeGate(context.input);
  const run = await saveProfitFirstBudgetChangeGateRun(clientId, context.input, output);
  return { output, run, ...context };
}

export async function fetchProfitFirstBudgetChangeGateRuns(
  clientId: string,
): Promise<ProfitFirstBudgetChangeGateModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "profit_first_budget_change_gate")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeProfitFirstBudgetChangeGateModelRunRow);
}
