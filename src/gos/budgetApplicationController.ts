import { supabase } from "@/integrations/supabase/client";
import {
  buildBudgetApplicationGuard,
  type BudgetApplicationAuditOutput,
  type BudgetApplicationGuardOutput,
  type CampaignBudgetState,
  type CampaignBudgetUpdate,
} from "./budgetApplicationGuard";
import { fetchProfitFirstBudgetChangeGateRuns } from "./profitFirstBudgetChangeGateController";

export type BudgetApplicationResult = {
  applied: boolean;
  guard: BudgetApplicationGuardOutput;
};

export type BudgetApplicationContext = {
  source?: string | null;
};

export type BudgetApplicationGuardModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: BudgetApplicationAuditOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

type CampaignRow = {
  id: string;
  current_daily_budget: number | null;
  active: boolean | null;
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

function toCampaignState(row: CampaignRow): CampaignBudgetState {
  return {
    campaign_id: row.id,
    current_daily_budget: row.current_daily_budget,
    active: row.active,
  };
}

export function canApplyBudgetGuard(guard: BudgetApplicationGuardOutput): boolean {
  return guard.decision === "ALLOW" || guard.decision === "ALLOW_WITH_CONDITIONS";
}

export function toBudgetApplicationAuditOutput(
  guard: BudgetApplicationGuardOutput,
  updates: CampaignBudgetUpdate[],
  applied: boolean,
  context: BudgetApplicationContext = {},
): BudgetApplicationAuditOutput {
  return {
    ...jsonClone(guard),
    application: {
      applied,
      source: context.source?.trim() || null,
      update_count: updates.length,
      updates: jsonClone(updates),
    },
  };
}

export function toBudgetApplicationGuardModelRunPayload(
  clientId: string,
  guard: BudgetApplicationGuardOutput,
  updates: CampaignBudgetUpdate[],
  applied: boolean,
  context: BudgetApplicationContext = {},
) {
  const output = toBudgetApplicationAuditOutput(guard, updates, applied, context);
  return {
    client_id: clientId,
    model_name: "budget_application_guard",
    model_version: "v1",
    input_json: jsonClone({
      source: context.source ?? null,
      applied,
      update_count: updates.length,
      updates,
      guard_decision: guard.decision,
      change_type: guard.change_type,
      current_monthly_total: guard.current_monthly_total,
      proposed_monthly_total: guard.proposed_monthly_total,
      gate_decision: guard.gate_decision,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: guard.engine_version,
      components: [
        "active_campaign_budget_totals",
        "latest_budget_change_gate_check",
        "allowed_mutation_decision",
        "application_audit_record",
      ],
      deterministic: true,
    },
    generated_by: "gos_budget_application_guard",
  };
}

export function normalizeBudgetApplicationGuardModelRunRow(row: QueryRow): BudgetApplicationGuardModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as BudgetApplicationAuditOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export async function fetchCampaignBudgetStates(clientId: string): Promise<CampaignBudgetState[]> {
  const { data, error } = await supabase
    .from("gos_campaigns" as never)
    .select("id,current_daily_budget,active")
    .eq("client_id", clientId);

  if (error) throw error;
  return ((data ?? []) as CampaignRow[]).map(toCampaignState);
}

export async function evaluateBudgetApplicationGuard(
  clientId: string,
  updates: CampaignBudgetUpdate[],
): Promise<BudgetApplicationGuardOutput> {
  const [campaigns, gateRuns] = await Promise.all([
    fetchCampaignBudgetStates(clientId),
    fetchProfitFirstBudgetChangeGateRuns(clientId),
  ]);
  return buildBudgetApplicationGuard({
    campaigns,
    updates,
    latest_gate: gateRuns[0]?.output_json ?? null,
  });
}

export async function applyCampaignBudgetUpdatesWithGuard(
  clientId: string,
  updates: CampaignBudgetUpdate[],
  context: BudgetApplicationContext = {},
): Promise<BudgetApplicationResult> {
  const guard = await evaluateBudgetApplicationGuard(clientId, updates);
  if (!canApplyBudgetGuard(guard)) {
    await saveBudgetApplicationGuardRun(clientId, guard, updates, false, context);
    return { applied: false, guard };
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("gos_campaigns" as never)
      .update({ current_daily_budget: update.proposed_daily_budget } as never)
      .eq("client_id", clientId)
      .eq("id", update.campaign_id);

    if (error) throw error;
  }

  await saveBudgetApplicationGuardRun(clientId, guard, updates, true, context);
  return { applied: true, guard };
}

export async function saveBudgetApplicationGuardRun(
  clientId: string,
  guard: BudgetApplicationGuardOutput,
  updates: CampaignBudgetUpdate[],
  applied: boolean,
  context: BudgetApplicationContext = {},
): Promise<BudgetApplicationGuardModelRunRow> {
  const payload = toBudgetApplicationGuardModelRunPayload(clientId, guard, updates, applied, context);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeBudgetApplicationGuardModelRunRow(data as QueryRow);
}

export async function fetchBudgetApplicationGuardRuns(clientId: string): Promise<BudgetApplicationGuardModelRunRow[]> {
  const { data, error } = await supabase
    .from("model_runs" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("model_name", "budget_application_guard")
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeBudgetApplicationGuardModelRunRow);
}
