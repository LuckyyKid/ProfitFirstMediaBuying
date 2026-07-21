import { supabase } from "@/integrations/supabase/client";
import {
  runProfitPlanEngine,
  type ProfitPlanDayPlan,
  type ProfitPlanEngineInput,
  type ProfitPlanEngineOutput,
  type ProfitPlanMonthPlan,
} from "./profitPlanEngine";

type QueryRow = Record<string, unknown>;

export type ProfitPlanRow = {
  id: string;
  client_id: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  status: string;
  engine_version: string;
  input_json: Record<string, unknown>;
  output_json: ProfitPlanEngineOutput;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProfitPlanMonthRow = ProfitPlanMonthPlan & {
  id: string;
  profit_plan_id: string;
  output_json: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type ProfitPlanDayRow = ProfitPlanDayPlan & {
  id: string;
  profit_plan_id: string;
  month_id: string;
  output_json: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
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

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toProfitPlanInsertPayload(input: ProfitPlanEngineInput, output: ProfitPlanEngineOutput) {
  return {
    client_id: output.client_id,
    plan_name: output.plan_name,
    period_start: output.period_start,
    period_end: output.period_end,
    status: output.status,
    engine_version: output.engine_version,
    input_json: jsonClone(input) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    summary: output.summary,
  };
}

export function toProfitPlanMonthInsertPayload(profitPlanId: string, month: ProfitPlanMonthPlan) {
  return {
    profit_plan_id: profitPlanId,
    client_id: month.client_id,
    month_start: month.month_start,
    month_end: month.month_end,
    planned_revenue: month.planned_revenue,
    planned_new_customer_revenue: month.planned_new_customer_revenue,
    planned_returning_revenue: month.planned_returning_revenue,
    planned_ad_spend: month.planned_ad_spend,
    planned_orders: month.planned_orders,
    planned_new_customers: month.planned_new_customers,
    planned_returning_orders: month.planned_returning_orders,
    planned_gross_profit: month.planned_gross_profit,
    planned_contribution_margin: month.planned_contribution_margin,
    recommended_spend: month.recommended_spend,
    recommended_amr: month.recommended_amr,
    binding_constraint: month.binding_constraint,
    target_cac: month.target_cac,
    target_mer: month.target_mer,
    output_json: jsonClone(month) as Record<string, unknown>,
  };
}

export function toProfitPlanDayInsertPayload(
  profitPlanId: string,
  monthId: string,
  day: ProfitPlanDayPlan,
) {
  return {
    profit_plan_id: profitPlanId,
    month_id: monthId,
    client_id: day.client_id,
    plan_date: day.plan_date,
    day_of_week: day.day_of_week,
    day_index: day.day_index,
    pacing_weight: day.pacing_weight,
    target_revenue: day.target_revenue,
    target_new_customer_revenue: day.target_new_customer_revenue,
    target_returning_revenue: day.target_returning_revenue,
    target_ad_spend: day.target_ad_spend,
    target_orders: day.target_orders,
    target_new_customers: day.target_new_customers,
    target_returning_orders: day.target_returning_orders,
    target_gross_profit: day.target_gross_profit,
    target_contribution_margin: day.target_contribution_margin,
    status: day.status,
    output_json: jsonClone(day) as Record<string, unknown>,
  };
}

export function normalizeProfitPlanRow(row: QueryRow): ProfitPlanRow {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    plan_name: String(row.plan_name ?? ""),
    period_start: String(row.period_start ?? ""),
    period_end: String(row.period_end ?? ""),
    status: String(row.status ?? "DRAFT"),
    engine_version: String(row.engine_version ?? ""),
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as ProfitPlanEngineOutput,
    summary: optionalString(row.summary),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export function normalizeProfitPlanMonthRow(row: QueryRow): ProfitPlanMonthRow {
  return {
    id: String(row.id ?? ""),
    profit_plan_id: String(row.profit_plan_id ?? ""),
    client_id: String(row.client_id ?? ""),
    month_start: String(row.month_start ?? ""),
    month_end: String(row.month_end ?? ""),
    planned_revenue: optionalNumber(row.planned_revenue) ?? 0,
    planned_new_customer_revenue: optionalNumber(row.planned_new_customer_revenue) ?? 0,
    planned_returning_revenue: optionalNumber(row.planned_returning_revenue) ?? 0,
    planned_ad_spend: optionalNumber(row.planned_ad_spend) ?? 0,
    planned_orders: optionalNumber(row.planned_orders) ?? 0,
    planned_new_customers: optionalNumber(row.planned_new_customers) ?? 0,
    planned_returning_orders: optionalNumber(row.planned_returning_orders) ?? 0,
    planned_gross_profit: optionalNumber(row.planned_gross_profit) ?? 0,
    planned_contribution_margin: optionalNumber(row.planned_contribution_margin) ?? 0,
    recommended_spend: optionalNumber(row.recommended_spend) ?? 0,
    recommended_amr: optionalNumber(row.recommended_amr),
    binding_constraint: String(row.binding_constraint ?? ""),
    target_cac: optionalNumber(row.target_cac),
    target_mer: optionalNumber(row.target_mer),
    output_json: (row.output_json as Record<string, unknown> | null | undefined) ?? {},
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export function normalizeProfitPlanDayRow(row: QueryRow): ProfitPlanDayRow {
  return {
    id: String(row.id ?? ""),
    profit_plan_id: String(row.profit_plan_id ?? ""),
    month_id: String(row.month_id ?? ""),
    client_id: String(row.client_id ?? ""),
    plan_date: String(row.plan_date ?? ""),
    day_of_week: optionalNumber(row.day_of_week) ?? 0,
    day_index: optionalNumber(row.day_index) ?? 0,
    pacing_weight: optionalNumber(row.pacing_weight) ?? 0,
    target_revenue: optionalNumber(row.target_revenue) ?? 0,
    target_new_customer_revenue: optionalNumber(row.target_new_customer_revenue) ?? 0,
    target_returning_revenue: optionalNumber(row.target_returning_revenue) ?? 0,
    target_ad_spend: optionalNumber(row.target_ad_spend) ?? 0,
    target_orders: optionalNumber(row.target_orders) ?? 0,
    target_new_customers: optionalNumber(row.target_new_customers) ?? 0,
    target_returning_orders: optionalNumber(row.target_returning_orders) ?? 0,
    target_gross_profit: optionalNumber(row.target_gross_profit) ?? 0,
    target_contribution_margin: optionalNumber(row.target_contribution_margin) ?? 0,
    status: (optionalString(row.status) ?? "PLANNED") as "PLANNED",
    output_json: (row.output_json as Record<string, unknown> | null | undefined) ?? {},
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export async function saveProfitPlanOutput(
  input: ProfitPlanEngineInput,
  output: ProfitPlanEngineOutput,
): Promise<{ plan: ProfitPlanRow; month: ProfitPlanMonthRow; days: ProfitPlanDayRow[] }> {
  const { data: planData, error: planError } = await supabase
    .from("gos_profit_plans" as never)
    .insert(toProfitPlanInsertPayload(input, output))
    .select("*")
    .single();

  if (planError) throw planError;
  const plan = normalizeProfitPlanRow(planData as QueryRow);

  const { data: monthData, error: monthError } = await supabase
    .from("gos_profit_plan_months" as never)
    .insert(toProfitPlanMonthInsertPayload(plan.id, output.month))
    .select("*")
    .single();

  if (monthError) throw monthError;
  const month = normalizeProfitPlanMonthRow(monthData as QueryRow);

  const dayPayloads = output.days.map((day) => toProfitPlanDayInsertPayload(plan.id, month.id, day));
  const { data: dayData, error: dayError } = await supabase
    .from("gos_profit_plan_days" as never)
    .insert(dayPayloads)
    .select("*");

  if (dayError) throw dayError;

  return {
    plan,
    month,
    days: ((dayData ?? []) as QueryRow[]).map(normalizeProfitPlanDayRow),
  };
}

export async function runAndSaveProfitPlan(
  input: ProfitPlanEngineInput,
): Promise<{ output: ProfitPlanEngineOutput; plan: ProfitPlanRow; month: ProfitPlanMonthRow; days: ProfitPlanDayRow[] }> {
  const output = runProfitPlanEngine(input);
  const saved = await saveProfitPlanOutput(input, output);
  return { output, ...saved };
}

export async function fetchProfitPlans(clientId: string): Promise<ProfitPlanRow[]> {
  const { data, error } = await supabase
    .from("gos_profit_plans" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeProfitPlanRow);
}
