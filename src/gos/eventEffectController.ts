import { supabase } from "@/integrations/supabase/client";
import {
  estimatePlannedEventEffect,
  type EventEffectInput,
  type EventEffectOutput,
  type PlannedEventEffectInput,
} from "./eventEffectV2";

export type PlannedEventDraft = {
  event_name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
};

export type EventEffectAnalysisDraft = {
  event_id: string;
  event_name?: string | null;
  metric: string;
  pre_series: number[];
  post_series: number[];
  control_pre_series?: number[] | null;
  control_post_series?: number[] | null;
  use_linear_trend: boolean;
  significance_level: number;
};

type JsonRecord = Record<string, unknown>;

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function parseNumericSeries(text: string): number[] {
  return String(text ?? "")
    .split(/[,\s;]+/)
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
}

export function toPlannedEventPayload(clientId: string, draft: PlannedEventDraft, baselineRevenue30d: number | null | undefined) {
  const estimate = estimatePlannedEventEffect({
    baseline_revenue_30d: baselineRevenue30d,
    event_type: draft.event_type,
    start_date: draft.start_date,
    end_date: draft.end_date,
  } satisfies PlannedEventEffectInput);

  return {
    client_id: clientId,
    event_name: draft.event_name.trim(),
    event_type: draft.event_type,
    start_date: draft.start_date,
    end_date: draft.end_date,
    expected_lift_pct: estimate.expected_lift_pct,
    expected_revenue_delta: estimate.expected_revenue_delta,
    confidence: estimate.confidence,
    assumptions: estimate.assumptions,
    status: "PLANNED",
    notes: optionalString(draft.notes),
  };
}

export function toEventEffectAnalysisPatch(input: EventEffectAnalysisDraft, result: EventEffectOutput) {
  const actualRevenueDelta = input.metric === "revenue"
    ? Math.round(result.causal_lift_abs * input.post_series.length)
    : null;

  return {
    metric: input.metric,
    pre_window_days: input.pre_series.length,
    post_window_days: input.post_series.length,
    pre_series: input.pre_series,
    post_series: input.post_series,
    control_pre_series: input.control_pre_series && input.control_pre_series.length >= 2 ? input.control_pre_series : null,
    control_post_series: input.control_post_series && input.control_post_series.length >= 2 ? input.control_post_series : null,
    pre_mean: result.pre_mean,
    pre_std: result.pre_std,
    post_mean: result.post_mean,
    post_std: result.post_std,
    counterfactual_mean: result.counterfactual_mean,
    causal_lift_abs: result.causal_lift_abs,
    causal_lift_pct: result.causal_lift_pct,
    test_statistic: result.test_statistic,
    p_value: result.p_value,
    ci_low: result.ci_low,
    ci_high: result.ci_high,
    method: result.method,
    recommendation: result.recommendation,
    engine_version: result.engine_version,
    engine_output: result as unknown as JsonRecord,
    actual_lift_pct: result.causal_lift_pct,
    actual_revenue_delta: actualRevenueDelta,
    status: "MEASURED",
    confidence: result.significant ? "HIGH" : result.missing_data.length ? "LOW" : "MEDIUM",
  };
}

export function toEventEffectModelRunPayload(
  clientId: string,
  input: EventEffectAnalysisDraft,
  result: EventEffectOutput,
) {
  return {
    client_id: clientId,
    model_name: "event_effect_v2",
    model_version: "v2.0",
    input_json: {
      event_id: input.event_id,
      event_name: input.event_name ?? null,
      metric: input.metric,
      pre_series: input.pre_series,
      post_series: input.post_series,
      control_pre_series: input.control_pre_series ?? null,
      control_post_series: input.control_post_series ?? null,
      use_linear_trend: input.use_linear_trend,
      significance_level: input.significance_level,
    },
    output_json: result as unknown as JsonRecord,
    formula_used: {
      engine: result.engine_version,
      method: result.method === "DID" ? "difference_in_differences" : "interrupted_time_series",
    },
    generated_by: "gos_event_effect_v2",
  };
}

export function toEventEffectInput(input: EventEffectAnalysisDraft): EventEffectInput {
  return {
    metric: input.metric,
    pre_series: input.pre_series,
    post_series: input.post_series,
    control_pre_series: input.control_pre_series ?? null,
    control_post_series: input.control_post_series ?? null,
    use_linear_trend: input.use_linear_trend,
    significance_level: input.significance_level,
  };
}

export async function createPlannedEventEffect(
  clientId: string,
  draft: PlannedEventDraft,
  baselineRevenue30d: number | null | undefined,
) {
  const payload = toPlannedEventPayload(clientId, draft, baselineRevenue30d);
  const { error } = await supabase
    .from("gos_event_effects" as never)
    .insert(payload);

  if (error) throw error;
}

export async function saveEventEffectAnalysis(
  clientId: string,
  input: EventEffectAnalysisDraft,
  result: EventEffectOutput,
) {
  const patch = toEventEffectAnalysisPatch(input, result);
  const { error } = await supabase
    .from("gos_event_effects" as never)
    .update(patch)
    .eq("id", input.event_id);

  if (error) throw error;

  const { error: runError } = await supabase
    .from("model_runs" as never)
    .insert(toEventEffectModelRunPayload(clientId, input, result));

  if (runError) throw runError;
}
