import { supabase } from "@/integrations/supabase/client";
import { runIncrementalityV2, type IncrementalityInput, type IncrementalityOutput, type MetricType } from "./incrementalityV2";

type QueryRow = Record<string, unknown>;

export type MeasurementSnapshot = {
  id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  linked_target_id: string | null;
  actual_revenue: number | null;
  actual_orders: number | null;
  actual_leads: number | null;
  actual_ad_spend: number | null;
  actual_cac: number | null;
  actual_cpl: number | null;
  actual_mer: number | null;
  actual_gross_profit: number | null;
  variance_pct: Record<string, number | null> | null;
  alert_level: string | null;
  notes: string | null;
  created_at: string | null;
};

export type MeasurementTest = {
  id: string;
  test_name: string;
  test_type: string | null;
  hypothesis: string | null;
  variant_a: string | null;
  variant_b: string | null;
  primary_metric: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  result: string | null;
  winner: string | null;
  lift_pct: number | null;
  confidence: number | null;
  learning: string | null;
};

export type MeasurementTarget = {
  id: string;
  period_label?: string | null;
  target_revenue?: number | null;
  target_ad_spend?: number | null;
  target_cac?: number | null;
  target_mer?: number | null;
  target_orders?: number | null;
  target_leads?: number | null;
};

export type MeasurementData = {
  client: Record<string, unknown> | null;
  snapshots: MeasurementSnapshot[];
  tests: MeasurementTest[];
  targets: MeasurementTarget[];
};

export type MeasurementSnapshotDraft = {
  period_label: string;
  period_start?: string | null;
  period_end?: string | null;
  linked_target_id?: string | null;
  actual_revenue?: unknown;
  actual_orders?: unknown;
  actual_leads?: unknown;
  actual_ad_spend?: unknown;
  actual_cac?: unknown;
  actual_cpl?: unknown;
  actual_mer?: unknown;
  actual_gross_profit?: unknown;
};

export type MeasurementTestDraft = {
  test_name: string;
  test_type?: string | null;
  hypothesis?: string | null;
  variant_a?: string | null;
  variant_b?: string | null;
  primary_metric?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type IncrementalityRunDraft = {
  test_id: string;
  test_name?: string | null;
  metric_type: MetricType;
  control_sample_size: unknown;
  variant_sample_size: unknown;
  control_conversions?: unknown;
  variant_conversions?: unknown;
  control_mean?: unknown;
  variant_mean?: unknown;
  control_std?: unknown;
  variant_std?: unknown;
  significance_level?: unknown;
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

function requiredString(value: unknown, message: string): string {
  const text = optionalString(value);
  if (!text) throw new Error(message);
  return text;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeMeasurementSnapshotRow(row: QueryRow): MeasurementSnapshot {
  return {
    id: String(row.id ?? ""),
    period_label: optionalString(row.period_label) ?? "",
    period_start: optionalString(row.period_start),
    period_end: optionalString(row.period_end),
    linked_target_id: optionalString(row.linked_target_id),
    actual_revenue: optionalNumber(row.actual_revenue),
    actual_orders: optionalNumber(row.actual_orders),
    actual_leads: optionalNumber(row.actual_leads),
    actual_ad_spend: optionalNumber(row.actual_ad_spend),
    actual_cac: optionalNumber(row.actual_cac),
    actual_cpl: optionalNumber(row.actual_cpl),
    actual_mer: optionalNumber(row.actual_mer),
    actual_gross_profit: optionalNumber(row.actual_gross_profit),
    variance_pct: (row.variance_pct as Record<string, number | null> | null | undefined) ?? null,
    alert_level: optionalString(row.alert_level),
    notes: optionalString(row.notes),
    created_at: optionalString(row.created_at),
  };
}

export function normalizeMeasurementTestRow(row: QueryRow): MeasurementTest {
  return {
    id: String(row.id ?? ""),
    test_name: optionalString(row.test_name) ?? "",
    test_type: optionalString(row.test_type),
    hypothesis: optionalString(row.hypothesis),
    variant_a: optionalString(row.variant_a),
    variant_b: optionalString(row.variant_b),
    primary_metric: optionalString(row.primary_metric),
    start_date: optionalString(row.start_date),
    end_date: optionalString(row.end_date),
    status: optionalString(row.status),
    result: optionalString(row.result),
    winner: optionalString(row.winner),
    lift_pct: optionalNumber(row.lift_pct),
    confidence: optionalNumber(row.confidence),
    learning: optionalString(row.learning),
  };
}

export function normalizeMeasurementTargetRow(row: QueryRow): MeasurementTarget {
  return {
    id: String(row.id ?? ""),
    period_label: optionalString(row.period_label),
    target_revenue: optionalNumber(row.target_revenue),
    target_ad_spend: optionalNumber(row.target_ad_spend),
    target_cac: optionalNumber(row.target_cac),
    target_mer: optionalNumber(row.target_mer),
    target_orders: optionalNumber(row.target_orders),
    target_leads: optionalNumber(row.target_leads),
  };
}

export function computeMeasurementVariance(
  snap: Partial<MeasurementSnapshot>,
  target: MeasurementTarget | null | undefined,
) {
  if (!target) return { variance: {}, alert: "GREEN" };
  const compare = (actual: unknown, goal: unknown) => {
    const actualNumber = optionalNumber(actual);
    const goalNumber = optionalNumber(goal);
    return actualNumber !== null && goalNumber !== null && goalNumber !== 0
      ? Number((((actualNumber - goalNumber) / goalNumber) * 100).toFixed(1))
      : null;
  };
  const variance = {
    revenue: compare(snap.actual_revenue, target.target_revenue),
    ad_spend: compare(snap.actual_ad_spend, target.target_ad_spend),
    cac: compare(snap.actual_cac, target.target_cac),
    mer: compare(snap.actual_mer, target.target_mer),
    orders: compare(snap.actual_orders, target.target_orders),
    leads: compare(snap.actual_leads, target.target_leads),
  };
  const revenueVariance = variance.revenue ?? 0;
  let alert = "GREEN";
  if (revenueVariance < -25) alert = "RED";
  else if (revenueVariance < -15) alert = "ORANGE";
  else if (revenueVariance < -5) alert = "YELLOW";
  return { variance, alert };
}

export function toMeasurementSnapshotPayload(
  clientId: string,
  draft: MeasurementSnapshotDraft,
  targets: MeasurementTarget[],
) {
  const payload = {
    client_id: clientId,
    period_label: requiredString(draft.period_label, "Label requis"),
    period_start: optionalString(draft.period_start),
    period_end: optionalString(draft.period_end),
    linked_target_id: optionalString(draft.linked_target_id),
    actual_revenue: optionalNumber(draft.actual_revenue),
    actual_orders: optionalNumber(draft.actual_orders),
    actual_leads: optionalNumber(draft.actual_leads),
    actual_ad_spend: optionalNumber(draft.actual_ad_spend),
    actual_cac: optionalNumber(draft.actual_cac),
    actual_cpl: optionalNumber(draft.actual_cpl),
    actual_mer: optionalNumber(draft.actual_mer),
    actual_gross_profit: optionalNumber(draft.actual_gross_profit),
  };
  const target = targets.find((item) => item.id === payload.linked_target_id);
  const { variance, alert } = computeMeasurementVariance(payload, target);
  return { ...payload, variance_pct: variance, alert_level: alert };
}

export function toMeasurementTestPayload(clientId: string, draft: MeasurementTestDraft) {
  return {
    client_id: clientId,
    test_name: requiredString(draft.test_name, "Nom requis"),
    test_type: optionalString(draft.test_type) ?? "AB",
    hypothesis: optionalString(draft.hypothesis),
    variant_a: optionalString(draft.variant_a),
    variant_b: optionalString(draft.variant_b),
    primary_metric: optionalString(draft.primary_metric),
    start_date: optionalString(draft.start_date),
    end_date: optionalString(draft.end_date),
    status: "PLANNED",
  };
}

export function toIncrementalityInput(draft: IncrementalityRunDraft): IncrementalityInput {
  return {
    metric_type: draft.metric_type,
    control_sample_size: optionalNumber(draft.control_sample_size) ?? 0,
    variant_sample_size: optionalNumber(draft.variant_sample_size) ?? 0,
    control_conversions: optionalNumber(draft.control_conversions),
    variant_conversions: optionalNumber(draft.variant_conversions),
    control_mean: optionalNumber(draft.control_mean),
    variant_mean: optionalNumber(draft.variant_mean),
    control_std: optionalNumber(draft.control_std),
    variant_std: optionalNumber(draft.variant_std),
    significance_level: optionalNumber(draft.significance_level) ?? 0.05,
  };
}

export function toIncrementalityTestPatch(input: IncrementalityInput, result: IncrementalityOutput) {
  return {
    metric_type: input.metric_type,
    control_sample_size: input.control_sample_size,
    variant_sample_size: input.variant_sample_size,
    control_conversions: input.control_conversions,
    variant_conversions: input.variant_conversions,
    control_mean: input.control_mean,
    variant_mean: input.variant_mean,
    control_std: input.control_std,
    variant_std: input.variant_std,
    significance_level: result.significance_level,
    test_statistic: result.test_statistic,
    p_value: result.p_value,
    standard_error: result.standard_error,
    ci_low: result.ci_low,
    ci_high: result.ci_high,
    mde_relative: result.mde_relative,
    statistical_power: result.statistical_power,
    lift_pct: result.relative_lift_pct,
    confidence: Number(((1 - result.p_value) * 100).toFixed(1)),
    winner: result.winner === "TIE" ? null : result.winner,
    recommendation: result.recommendation,
    engine_version: result.engine_version,
    engine_output: jsonClone(result) as Record<string, unknown>,
    result: result.significant ? "SIGNIFICANT" : "NOT_SIGNIFICANT",
  };
}

export function toIncrementalityModelRunPayload(
  clientId: string,
  draft: IncrementalityRunDraft,
  input: IncrementalityInput,
  result: IncrementalityOutput,
) {
  return {
    client_id: clientId,
    model_name: "incrementality_engine_v2",
    model_version: "v2.0",
    input_json: {
      test_id: draft.test_id,
      test_name: draft.test_name ?? null,
      ...input,
    },
    output_json: jsonClone(result) as Record<string, unknown>,
    formula_used: input.metric_type === "BINARY" ? "two_proportion_z_test" : "welch_t_test_normal_approx",
    generated_by: "gos_measurement_v2",
  };
}

export async function fetchMeasurementData(clientId: string): Promise<MeasurementData> {
  const [clientResult, snapshotsResult, testsResult, targetsResult] = await Promise.all([
    supabase.from("gos_clients" as never).select("*").eq("id", clientId).single(),
    supabase
      .from("gos_measurement_snapshots" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("period_start", { ascending: false, nullsFirst: false }),
    supabase
      .from("gos_measurement_tests" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("gos_metric_targets" as never).select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (snapshotsResult.error) throw snapshotsResult.error;
  if (testsResult.error) throw testsResult.error;
  if (targetsResult.error) throw targetsResult.error;

  return {
    client: (clientResult.data as Record<string, unknown> | null) ?? null,
    snapshots: ((snapshotsResult.data ?? []) as QueryRow[]).map(normalizeMeasurementSnapshotRow),
    tests: ((testsResult.data ?? []) as QueryRow[]).map(normalizeMeasurementTestRow),
    targets: ((targetsResult.data ?? []) as QueryRow[]).map(normalizeMeasurementTargetRow),
  };
}

export async function createMeasurementSnapshot(
  clientId: string,
  draft: MeasurementSnapshotDraft,
  targets: MeasurementTarget[],
) {
  const payload = toMeasurementSnapshotPayload(clientId, draft, targets);
  const { error } = await supabase.from("gos_measurement_snapshots" as never).insert(payload as never);
  if (error) throw error;
  return payload;
}

export async function createMeasurementTest(clientId: string, draft: MeasurementTestDraft) {
  const payload = toMeasurementTestPayload(clientId, draft);
  const { error } = await supabase.from("gos_measurement_tests" as never).insert(payload as never);
  if (error) throw error;
  return payload;
}

export async function updateMeasurementTest(id: string, patch: Partial<MeasurementTest>) {
  const { error } = await supabase.from("gos_measurement_tests" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function runAndSaveIncrementalityForTest(
  clientId: string,
  draft: IncrementalityRunDraft,
): Promise<IncrementalityOutput> {
  const input = toIncrementalityInput(draft);
  const result = runIncrementalityV2(input);
  const patch = toIncrementalityTestPatch(input, result);
  const { error } = await supabase.from("gos_measurement_tests" as never).update(patch as never).eq("id", draft.test_id);
  if (error) throw error;

  const { error: runError } = await supabase
    .from("model_runs" as never)
    .insert(toIncrementalityModelRunPayload(clientId, draft, input, result) as never);
  if (runError) throw runError;
  return result;
}
