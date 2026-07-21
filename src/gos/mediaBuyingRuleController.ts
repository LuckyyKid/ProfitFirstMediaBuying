import { supabase } from "@/integrations/supabase/client";
import {
  aggregateCampaignPerformance,
  evaluateMediaBuyingRules,
  type MediaBuyingActionHistoryInput,
  type MediaBuyingCampaignInput,
  type MediaBuyingCampaignSummary,
  type MediaBuyingDailyPerformanceInput,
  type MediaBuyingRuleEvaluationInput,
  type MediaBuyingRuleEvaluationOutput,
  type MediaBuyingRuleInput,
  type MediaBuyingSuggestion,
} from "./mediaBuyingRuleEngine";
import { fetchBudgetComplianceMonitorRuns } from "./budgetComplianceMonitorController";
import {
  buildMediaBuyingActionApplicationGuard,
  type MediaBuyingActionApplicationGuardOutput,
} from "./mediaBuyingActionApplicationGuard";
import { fetchBudgetApplicationGuardRuns } from "./budgetApplicationController";

export type MediaBuyingRuleRow = MediaBuyingRuleInput & {
  client_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MediaBuyingActionRow = MediaBuyingActionHistoryInput & {
  id: string;
  client_id: string | null;
  action_type: string;
  action_value: number | null;
  applied_at: string | null;
  metric: string | null;
  metric_value: number | null;
  notes: string | null;
  threshold_value: number | null;
};

export type MediaBuyingAutomationData = {
  rules: MediaBuyingRuleRow[];
  actions: MediaBuyingActionRow[];
  campaigns: MediaBuyingCampaignInput[];
  daily_performance: MediaBuyingDailyPerformanceInput[];
  campaign_summaries: MediaBuyingCampaignSummary[];
  evaluation: MediaBuyingRuleEvaluationOutput;
  latest_compliance_status: string | null;
};

export type MediaBuyingRuleEvaluationModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: MediaBuyingRuleEvaluationOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

export type MediaBuyingActionApplicationGuardModelRunRow = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: Record<string, unknown>;
  output_json: MediaBuyingActionApplicationGuardOutput;
  formula_used: Record<string, unknown> | null;
  generated_at: string | null;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

export type MediaBuyingActionStatusUpdateResult = {
  updated: boolean;
  guard: MediaBuyingActionApplicationGuardOutput | null;
};

type QueryRow = Record<string, unknown>;

const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 90;

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isoDaysAgo(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - Math.max(0, days));
  return d.toISOString().slice(0, 10);
}

export function maxRuleLookbackDays(rules: MediaBuyingRuleInput[]): number {
  const activeLookbacks = rules
    .filter((rule) => rule.is_active)
    .map((rule) => Math.max(1, Math.round(optionalNumber(rule.lookback_days) ?? DEFAULT_LOOKBACK_DAYS)));
  return Math.min(MAX_LOOKBACK_DAYS, Math.max(DEFAULT_LOOKBACK_DAYS, ...activeLookbacks));
}

export function normalizeMediaBuyingRuleRow(row: QueryRow): MediaBuyingRuleRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    rule_name: optionalString(row.rule_name) ?? "",
    platform: optionalString(row.platform) ?? "meta",
    scope: optionalString(row.scope) ?? "campaign",
    metric: optionalString(row.metric) ?? "",
    operator: optionalString(row.operator) ?? "",
    threshold_value: optionalNumber(row.threshold_value),
    lookback_days: optionalNumber(row.lookback_days),
    action_type: optionalString(row.action_type) ?? "alert_only",
    action_value: optionalNumber(row.action_value),
    cooldown_hours: optionalNumber(row.cooldown_hours),
    priority: optionalString(row.priority) ?? "medium",
    is_active: row.is_active !== false,
    notes: optionalString(row.notes),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export function normalizeMediaBuyingActionRow(row: QueryRow): MediaBuyingActionRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    rule_id: optionalString(row.rule_id),
    target_name: optionalString(row.target_name) ?? "",
    target_platform: optionalString(row.target_platform),
    metric: optionalString(row.metric),
    metric_value: optionalNumber(row.metric_value),
    threshold_value: optionalNumber(row.threshold_value),
    action_type: optionalString(row.action_type) ?? "",
    action_value: optionalNumber(row.action_value),
    status: optionalString(row.status) ?? "suggested",
    applied_at: optionalString(row.applied_at),
    notes: optionalString(row.notes),
    created_at: optionalString(row.created_at) ?? new Date(0).toISOString(),
  };
}

export function normalizeMediaBuyingActionApplicationGuardRunRow(row: QueryRow): MediaBuyingActionApplicationGuardModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as MediaBuyingActionApplicationGuardOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export function normalizeMediaBuyingCampaignRow(row: QueryRow): MediaBuyingCampaignInput {
  return {
    id: String(row.id ?? ""),
    name: optionalString(row.name) ?? "",
    platform: optionalString(row.platform) ?? "meta",
    active: row.active !== false,
  };
}

export function normalizeMediaBuyingPerformanceRow(row: QueryRow): MediaBuyingDailyPerformanceInput {
  return {
    campaign_id: String(row.campaign_id ?? ""),
    perf_date: optionalString(row.perf_date) ?? "",
    spend: optionalNumber(row.spend) ?? 0,
    revenue: optionalNumber(row.revenue) ?? 0,
    orders: optionalNumber(row.orders) ?? 0,
    leads: optionalNumber(row.leads) ?? 0,
    clicks: optionalNumber(row.clicks),
    impressions: optionalNumber(row.impressions),
  };
}

export function normalizeMediaBuyingRuleEvaluationRunRow(row: QueryRow): MediaBuyingRuleEvaluationModelRunRow {
  return {
    id: String(row.id ?? ""),
    client_id: optionalString(row.client_id),
    model_name: optionalString(row.model_name) ?? "",
    model_version: optionalString(row.model_version) ?? "",
    input_json: (row.input_json as Record<string, unknown> | null | undefined) ?? {},
    output_json: row.output_json as MediaBuyingRuleEvaluationOutput,
    formula_used: (row.formula_used as Record<string, unknown> | null | undefined) ?? null,
    generated_at: optionalString(row.generated_at),
    generated_by: optionalString(row.generated_by),
    am_approved: toBoolean(row.am_approved),
    am_override: toBoolean(row.am_override),
    override_reason: optionalString(row.override_reason),
  };
}

export function toMediaBuyingRuleEvaluationModelRunPayload(
  clientId: string,
  input: MediaBuyingRuleEvaluationInput,
  output: MediaBuyingRuleEvaluationOutput,
) {
  return {
    client_id: clientId,
    model_name: "media_buying_rule_evaluation",
    model_version: "v1",
    input_json: jsonClone({
      rule_count: input.rules.length,
      campaign_count: input.campaigns.length,
      performance_row_count: input.daily_performance.length,
      action_history_count: input.action_history?.length ?? 0,
      budget_compliance_status: input.budget_compliance?.status ?? null,
      generated_at: output.generated_at,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "campaign_performance_lookback_aggregation",
        "rule_threshold_evaluation",
        "cooldown_filtering",
        "budget_compliance_scale_up_guardrail",
      ],
      deterministic: true,
    },
    generated_by: "gos_media_buying_rule_evaluation",
  };
}

export function toMediaBuyingActionApplicationGuardModelRunPayload(
  clientId: string,
  action: MediaBuyingActionRow,
  output: MediaBuyingActionApplicationGuardOutput,
) {
  return {
    client_id: clientId,
    model_name: "media_buying_action_application_guard",
    model_version: "v1",
    input_json: jsonClone({
      action_id: action.id,
      action_type: action.action_type,
      action_status: action.status,
      target_name: action.target_name,
      action_created_at: action.created_at,
      matched_campaign_id: output.matched_campaign_id,
      matching_application_generated_at: output.matching_application_generated_at,
    }) as Record<string, unknown>,
    output_json: jsonClone(output) as Record<string, unknown>,
    formula_used: {
      engine: output.engine_version,
      components: [
        "media_buying_action_status_transition",
        "campaign_name_to_budget_campaign_match",
        "budget_application_audit_required_for_budget_actions",
        "action_type_to_budget_change_alignment",
      ],
      deterministic: true,
    },
    generated_by: "gos_media_buying_action_application_guard",
  };
}

export function toMediaBuyingActionInsertRows(clientId: string, suggestions: MediaBuyingSuggestion[]) {
  return suggestions.map((suggestion) => ({
    client_id: clientId,
    rule_id: suggestion.rule_id,
    target_name: suggestion.target_name,
    target_platform: suggestion.target_platform,
    metric: suggestion.metric,
    metric_value: suggestion.metric_value,
    threshold_value: suggestion.threshold_value,
    action_type: suggestion.action_type,
    action_value: suggestion.action_value,
    status: "suggested",
    notes: suggestion.notes,
  }));
}

export async function fetchMediaBuyingRules(clientId: string): Promise<MediaBuyingRuleRow[]> {
  const { data, error } = await supabase
    .from("gos_media_buying_rules" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeMediaBuyingRuleRow);
}

export async function fetchMediaBuyingActions(clientId: string): Promise<MediaBuyingActionRow[]> {
  const { data, error } = await supabase
    .from("gos_media_buying_actions" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeMediaBuyingActionRow);
}

export async function fetchMediaBuyingActionById(
  clientId: string,
  actionId: string,
): Promise<MediaBuyingActionRow | null> {
  const { data, error } = await supabase
    .from("gos_media_buying_actions" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("id", actionId)
    .limit(1);

  if (error) throw error;
  const row = ((data ?? []) as QueryRow[])[0];
  return row ? normalizeMediaBuyingActionRow(row) : null;
}

export async function fetchMediaBuyingCampaigns(clientId: string): Promise<MediaBuyingCampaignInput[]> {
  const { data, error } = await supabase
    .from("gos_campaigns" as never)
    .select("id,name,platform,active")
    .eq("client_id", clientId);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeMediaBuyingCampaignRow);
}

export async function fetchMediaBuyingActionCampaignRefs(clientId: string) {
  const { data, error } = await supabase
    .from("gos_campaigns" as never)
    .select("id,name,current_daily_budget,active")
    .eq("client_id", clientId);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map((row) => ({
    campaign_id: String(row.id ?? ""),
    name: optionalString(row.name) ?? "",
    current_daily_budget: optionalNumber(row.current_daily_budget),
    active: row.active !== false,
  }));
}

export async function fetchMediaBuyingDailyPerformance(
  clientId: string,
  sinceDate: string,
): Promise<MediaBuyingDailyPerformanceInput[]> {
  const { data, error } = await supabase
    .from("gos_campaign_daily_perf" as never)
    .select("*")
    .eq("client_id", clientId)
    .gte("perf_date", sinceDate);

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeMediaBuyingPerformanceRow);
}

export async function buildMediaBuyingRuleEvaluationInput(
  clientId: string,
): Promise<MediaBuyingRuleEvaluationInput> {
  const [rules, actions, campaigns, complianceRuns] = await Promise.all([
    fetchMediaBuyingRules(clientId),
    fetchMediaBuyingActions(clientId),
    fetchMediaBuyingCampaigns(clientId),
    fetchBudgetComplianceMonitorRuns(clientId),
  ]);
  const lookbackDays = maxRuleLookbackDays(rules);
  const dailyPerformance = await fetchMediaBuyingDailyPerformance(clientId, isoDaysAgo(lookbackDays - 1));
  const latestCompliance = complianceRuns[0] ?? null;

  return {
    rules,
    campaigns,
    daily_performance: dailyPerformance,
    action_history: actions,
    budget_compliance: latestCompliance
      ? {
          status: latestCompliance.output_json.status,
          generated_at: latestCompliance.generated_at,
        }
      : null,
  };
}

export async function fetchMediaBuyingAutomationData(clientId: string): Promise<MediaBuyingAutomationData> {
  const input = await buildMediaBuyingRuleEvaluationInput(clientId);
  const evaluation = evaluateMediaBuyingRules(input);
  return {
    rules: input.rules as MediaBuyingRuleRow[],
    actions: (input.action_history ?? []) as MediaBuyingActionRow[],
    campaigns: input.campaigns,
    daily_performance: input.daily_performance,
    campaign_summaries: aggregateCampaignPerformance(input.campaigns, input.daily_performance, maxRuleLookbackDays(input.rules), evaluation.generated_at),
    evaluation,
    latest_compliance_status: input.budget_compliance?.status ?? null,
  };
}

export async function createMediaBuyingRule(
  clientId: string,
  draft: Partial<MediaBuyingRuleInput>,
): Promise<void> {
  const { error } = await supabase.from("gos_media_buying_rules" as never).insert({
    client_id: clientId,
    rule_name: draft.rule_name,
    platform: draft.platform ?? "meta",
    scope: draft.scope ?? "campaign",
    metric: draft.metric,
    operator: draft.operator,
    threshold_value: draft.threshold_value,
    lookback_days: draft.lookback_days ?? DEFAULT_LOOKBACK_DAYS,
    action_type: draft.action_type,
    action_value: draft.action_value ?? null,
    cooldown_hours: draft.cooldown_hours ?? 24,
    priority: draft.priority ?? "medium",
    is_active: draft.is_active ?? true,
    notes: draft.notes ?? null,
  } as never);

  if (error) throw error;
}

export async function toggleMediaBuyingRule(rule: MediaBuyingRuleInput): Promise<void> {
  const { error } = await supabase
    .from("gos_media_buying_rules" as never)
    .update({ is_active: !rule.is_active } as never)
    .eq("id", rule.id);

  if (error) throw error;
}

export async function deleteMediaBuyingRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from("gos_media_buying_rules" as never)
    .delete()
    .eq("id", ruleId);

  if (error) throw error;
}

export async function saveMediaBuyingRuleEvaluationRun(
  clientId: string,
  input: MediaBuyingRuleEvaluationInput,
  output: MediaBuyingRuleEvaluationOutput,
): Promise<MediaBuyingRuleEvaluationModelRunRow> {
  const payload = toMediaBuyingRuleEvaluationModelRunPayload(clientId, input, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeMediaBuyingRuleEvaluationRunRow(data as QueryRow);
}

export async function saveMediaBuyingActionApplicationGuardRun(
  clientId: string,
  action: MediaBuyingActionRow,
  output: MediaBuyingActionApplicationGuardOutput,
): Promise<MediaBuyingActionApplicationGuardModelRunRow> {
  const payload = toMediaBuyingActionApplicationGuardModelRunPayload(clientId, action, output);
  const { data, error } = await supabase
    .from("model_runs" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeMediaBuyingActionApplicationGuardRunRow(data as QueryRow);
}

export async function insertMediaBuyingSuggestions(
  clientId: string,
  suggestions: MediaBuyingSuggestion[],
): Promise<number> {
  if (suggestions.length === 0) return 0;
  const rows = toMediaBuyingActionInsertRows(clientId, suggestions);
  const { error } = await supabase
    .from("gos_media_buying_actions" as never)
    .insert(rows as never);

  if (error) throw error;
  return rows.length;
}

export async function runAndSaveMediaBuyingRuleEvaluation(
  clientId: string,
): Promise<{
  output: MediaBuyingRuleEvaluationOutput;
  run: MediaBuyingRuleEvaluationModelRunRow;
  inserted_actions: number;
}> {
  const input = await buildMediaBuyingRuleEvaluationInput(clientId);
  const output = evaluateMediaBuyingRules(input);
  const run = await saveMediaBuyingRuleEvaluationRun(clientId, input, output);
  const insertedActions = await insertMediaBuyingSuggestions(clientId, output.suggestions);
  return { output, run, inserted_actions: insertedActions };
}

export async function updateMediaBuyingActionStatus(
  clientId: string,
  actionId: string,
  status: "applied" | "dismissed",
): Promise<MediaBuyingActionStatusUpdateResult> {
  const action = await fetchMediaBuyingActionById(clientId, actionId);
  if (!action) throw new Error("Media buying action not found");

  if (status === "applied") {
    const [campaigns, applicationRuns] = await Promise.all([
      fetchMediaBuyingActionCampaignRefs(clientId),
      fetchBudgetApplicationGuardRuns(clientId),
    ]);
    const guard = buildMediaBuyingActionApplicationGuard({
      action,
      campaigns,
      application_audits: applicationRuns.map((run) => ({
        generated_at: run.generated_at,
        output: run.output_json,
      })),
    });
    await saveMediaBuyingActionApplicationGuardRun(clientId, action, guard);
    if (guard.decision !== "ALLOW") {
      return { updated: false, guard };
    }

    const { error } = await supabase
      .from("gos_media_buying_actions" as never)
      .update({
        status,
        applied_at: new Date().toISOString(),
      } as never)
      .eq("client_id", clientId)
      .eq("id", actionId);

    if (error) throw error;
    return { updated: true, guard };
  }

  const { error } = await supabase
    .from("gos_media_buying_actions" as never)
    .update({
      status,
      applied_at: null,
    } as never)
    .eq("client_id", clientId)
    .eq("id", actionId);

  if (error) throw error;
  return { updated: true, guard: null };
}
