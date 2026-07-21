export type MediaBuyingMetric =
  | "roas"
  | "cpa"
  | "cpl"
  | "spend"
  | "revenue"
  | "orders"
  | "leads"
  | "ctr"
  | "cpm";

export type MediaBuyingOperator = "<" | "<=" | ">" | ">=";

export type MediaBuyingRuleInput = {
  id: string;
  rule_name: string;
  platform: string;
  scope: string;
  metric: string;
  operator: string;
  threshold_value: number | null | undefined;
  lookback_days: number | null | undefined;
  action_type: string;
  action_value: number | null | undefined;
  cooldown_hours: number | null | undefined;
  priority: string;
  is_active: boolean;
  notes?: string | null;
};

export type MediaBuyingCampaignInput = {
  id: string;
  name: string;
  platform: string;
  active?: boolean | null;
};

export type MediaBuyingDailyPerformanceInput = {
  campaign_id: string;
  perf_date: string;
  spend?: number | null;
  revenue?: number | null;
  orders?: number | null;
  leads?: number | null;
  clicks?: number | null;
  impressions?: number | null;
};

export type MediaBuyingActionHistoryInput = {
  rule_id: string | null;
  target_name: string;
  target_platform?: string | null;
  status: string;
  created_at: string;
};

export type MediaBuyingBudgetComplianceInput = {
  status?: string | null;
  generated_at?: string | null;
};

export type MediaBuyingCampaignSummary = {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  spend: number;
  revenue: number;
  orders: number;
  leads: number;
  clicks: number | null;
  impressions: number | null;
  roas: number | null;
  cpa: number | null;
  cpl: number | null;
};

export type MediaBuyingSuggestion = {
  key: string;
  rule_id: string;
  target_name: string;
  target_platform: string;
  metric: string;
  metric_value: number | null;
  threshold_value: number;
  action_type: string;
  action_value: number | null;
  priority: string;
  lookback_days: number;
  original_action_type: string;
  guardrail_status: "clear" | "requires_gate" | "held_by_compliance";
  notes: string;
};

export type MediaBuyingSuppressedTrigger = {
  key: string;
  rule_id: string;
  target_name: string;
  reason: "cooldown";
  cooldown_hours: number;
  last_action_at: string;
};

export type MediaBuyingSkippedCheck = {
  rule_id: string;
  rule_name: string;
  target_name?: string;
  metric: string;
  reason: string;
  missing_fields: string[];
};

export type MediaBuyingRuleEvaluationInput = {
  rules: MediaBuyingRuleInput[];
  campaigns: MediaBuyingCampaignInput[];
  daily_performance: MediaBuyingDailyPerformanceInput[];
  action_history?: MediaBuyingActionHistoryInput[];
  budget_compliance?: MediaBuyingBudgetComplianceInput | null;
  generated_at?: string;
};

export type MediaBuyingRuleEvaluationOutput = {
  engine_version: "media_buying_rule_evaluation_v1";
  generated_at: string;
  campaign_count: number;
  active_rule_count: number;
  suggestion_count: number;
  suppressed_count: number;
  skipped_count: number;
  suggestions: MediaBuyingSuggestion[];
  suppressed: MediaBuyingSuppressedTrigger[];
  skipped: MediaBuyingSkippedCheck[];
  campaign_summaries: MediaBuyingCampaignSummary[];
  risks: string[];
  next_actions: string[];
  summary: string;
};

type MetricResult = {
  value: number | null;
  storedValue: number | null;
  missingFields: string[];
  reason?: string;
};

const DAY_MS = 86_400_000;
const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 };

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableFinite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function ratio(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeDate(value: string | undefined): Date {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function lookbackStartIso(generatedAt: string, lookbackDays: number): string {
  const end = normalizeDate(generatedAt);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, lookbackDays) + 1);
  return isoDate(start);
}

function isInWindow(perfDate: string, generatedAt: string, lookbackDays: number): boolean {
  const date = perfDate.slice(0, 10);
  return date >= lookbackStartIso(generatedAt, lookbackDays) && date <= generatedAt.slice(0, 10);
}

function normalizeMetric(metric: string): MediaBuyingMetric | null {
  const key = metric.trim().toLowerCase();
  if (
    key === "roas" ||
    key === "cpa" ||
    key === "cpl" ||
    key === "spend" ||
    key === "revenue" ||
    key === "orders" ||
    key === "leads" ||
    key === "ctr" ||
    key === "cpm"
  ) {
    return key;
  }
  return null;
}

function normalizeOperator(operator: string): MediaBuyingOperator | null {
  if (operator === "<" || operator === "<=" || operator === ">" || operator === ">=") return operator;
  return null;
}

function compareMetric(operator: MediaBuyingOperator, value: number | null, threshold: number): boolean {
  if (value == null) return false;
  if (value === Infinity) return operator === ">" || operator === ">=";
  if (value === -Infinity) return operator === "<" || operator === "<=";
  switch (operator) {
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case ">": return value > threshold;
    case ">=": return value >= threshold;
  }
}

function aggregateRows(rows: MediaBuyingDailyPerformanceInput[]): {
  spend: number;
  revenue: number;
  orders: number;
  leads: number;
  clicks: number | null;
  impressions: number | null;
} {
  let hasClicks = false;
  let hasImpressions = false;
  let clicks = 0;
  let impressions = 0;
  const aggregate = rows.reduce(
    (acc, row) => {
      acc.spend += finiteNumber(row.spend);
      acc.revenue += finiteNumber(row.revenue);
      acc.orders += finiteNumber(row.orders);
      acc.leads += finiteNumber(row.leads);
      const rowClicks = nullableFinite(row.clicks);
      const rowImpressions = nullableFinite(row.impressions);
      if (rowClicks != null) {
        hasClicks = true;
        clicks += rowClicks;
      }
      if (rowImpressions != null) {
        hasImpressions = true;
        impressions += rowImpressions;
      }
      return acc;
    },
    { spend: 0, revenue: 0, orders: 0, leads: 0 },
  );

  return {
    spend: money(aggregate.spend),
    revenue: money(aggregate.revenue),
    orders: Math.round(aggregate.orders),
    leads: Math.round(aggregate.leads),
    clicks: hasClicks ? Math.round(clicks) : null,
    impressions: hasImpressions ? Math.round(impressions) : null,
  };
}

function summarizeCampaign(
  campaign: MediaBuyingCampaignInput,
  rows: MediaBuyingDailyPerformanceInput[],
): MediaBuyingCampaignSummary {
  const totals = aggregateRows(rows);
  const roas = totals.spend > 0 ? ratio(totals.revenue / totals.spend) : null;
  const cpa = totals.orders > 0 ? money(totals.spend / totals.orders) : null;
  const cpl = totals.leads > 0 ? money(totals.spend / totals.leads) : null;
  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    platform: campaign.platform,
    ...totals,
    roas,
    cpa,
    cpl,
  };
}

function metricResult(summary: MediaBuyingCampaignSummary, metric: MediaBuyingMetric): MetricResult {
  switch (metric) {
    case "roas":
      if (summary.spend <= 0) return { value: null, storedValue: null, missingFields: ["spend"], reason: "ROAS requires spend above zero." };
      return { value: summary.revenue / summary.spend, storedValue: ratio(summary.revenue / summary.spend), missingFields: [] };
    case "cpa":
      if (summary.orders > 0) return { value: summary.spend / summary.orders, storedValue: money(summary.spend / summary.orders), missingFields: [] };
      if (summary.spend > 0) return { value: Infinity, storedValue: null, missingFields: [], reason: "Spend exists with zero orders; CPA is unbounded." };
      return { value: null, storedValue: null, missingFields: ["orders"], reason: "CPA requires orders or spend without orders." };
    case "cpl":
      if (summary.leads > 0) return { value: summary.spend / summary.leads, storedValue: money(summary.spend / summary.leads), missingFields: [] };
      if (summary.spend > 0) return { value: Infinity, storedValue: null, missingFields: [], reason: "Spend exists with zero leads; CPL is unbounded." };
      return { value: null, storedValue: null, missingFields: ["leads"], reason: "CPL requires leads or spend without leads." };
    case "spend":
      return { value: summary.spend, storedValue: money(summary.spend), missingFields: [] };
    case "revenue":
      return { value: summary.revenue, storedValue: money(summary.revenue), missingFields: [] };
    case "orders":
      return { value: summary.orders, storedValue: summary.orders, missingFields: [] };
    case "leads":
      return { value: summary.leads, storedValue: summary.leads, missingFields: [] };
    case "ctr":
      if (summary.clicks == null || summary.impressions == null || summary.impressions <= 0) {
        return { value: null, storedValue: null, missingFields: ["clicks", "impressions"], reason: "CTR requires click and impression data." };
      }
      return { value: (summary.clicks / summary.impressions) * 100, storedValue: ratio((summary.clicks / summary.impressions) * 100), missingFields: [] };
    case "cpm":
      if (summary.impressions == null || summary.impressions <= 0) {
        return { value: null, storedValue: null, missingFields: ["impressions"], reason: "CPM requires impression data." };
      }
      return { value: (summary.spend / summary.impressions) * 1000, storedValue: money((summary.spend / summary.impressions) * 1000), missingFields: [] };
  }
}

function lastMatchingAction(
  history: MediaBuyingActionHistoryInput[],
  ruleId: string,
  targetName: string,
): MediaBuyingActionHistoryInput | null {
  const matches = history
    .filter((row) => row.rule_id === ruleId && row.target_name === targetName)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return matches[0] ?? null;
}

function isWithinCooldown(generatedAt: string, lastActionAt: string, cooldownHours: number): boolean {
  if (cooldownHours <= 0) return false;
  const generated = normalizeDate(generatedAt).getTime();
  const last = normalizeDate(lastActionAt).getTime();
  return generated - last < cooldownHours * 60 * 60 * 1000;
}

function suggestionNotes(
  rule: MediaBuyingRuleInput,
  lookbackDays: number,
  metric: MetricResult,
  guardrailStatus: MediaBuyingSuggestion["guardrail_status"],
  complianceStatus: string | null,
): string {
  const notes = [`Rule: ${rule.rule_name} (${lookbackDays}d)`];
  if (metric.reason) notes.push(metric.reason);
  if (guardrailStatus === "requires_gate") {
    notes.push("Scale-up requires Budget Change Gate before any budget write.");
  }
  if (guardrailStatus === "held_by_compliance") {
    notes.push(`Scale-up held because budget compliance is ${complianceStatus ?? "unknown"}; run compliance review and Budget Change Gate first.`);
  }
  if (rule.notes) notes.push(rule.notes);
  return notes.join(" | ");
}

export function aggregateCampaignPerformance(
  campaigns: MediaBuyingCampaignInput[],
  dailyPerformance: MediaBuyingDailyPerformanceInput[],
  lookbackDays = 7,
  generatedAt = new Date().toISOString(),
): MediaBuyingCampaignSummary[] {
  return campaigns
    .filter((campaign) => campaign.active !== false)
    .map((campaign) => {
      const rows = dailyPerformance.filter(
        (row) => row.campaign_id === campaign.id && isInWindow(row.perf_date, generatedAt, lookbackDays),
      );
      return summarizeCampaign(campaign, rows);
    });
}

export function evaluateMediaBuyingRules(input: MediaBuyingRuleEvaluationInput): MediaBuyingRuleEvaluationOutput {
  const generatedAt = normalizeDate(input.generated_at).toISOString();
  const activeRules = input.rules.filter((rule) => rule.is_active);
  const maxLookback = Math.max(1, ...activeRules.map((rule) => Math.max(1, Math.round(finiteNumber(rule.lookback_days, 1)))));
  const campaignSummaries = aggregateCampaignPerformance(input.campaigns, input.daily_performance, maxLookback, generatedAt);
  const suggestions: MediaBuyingSuggestion[] = [];
  const suppressed: MediaBuyingSuppressedTrigger[] = [];
  const skipped: MediaBuyingSkippedCheck[] = [];
  const risks = new Set<string>();
  const complianceStatus = input.budget_compliance?.status?.trim() || null;

  activeRules.forEach((rule) => {
    const metric = normalizeMetric(rule.metric);
    const operator = normalizeOperator(rule.operator);
    const threshold = nullableFinite(rule.threshold_value);
    const lookbackDays = Math.max(1, Math.round(finiteNumber(rule.lookback_days, 1)));
    const cooldownHours = Math.max(0, Math.round(finiteNumber(rule.cooldown_hours, 0)));

    if (!metric || !operator || threshold == null) {
      skipped.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        metric: rule.metric,
        reason: "Invalid rule metric, operator, or threshold.",
        missing_fields: [],
      });
      return;
    }

    const matchingCampaigns = input.campaigns.filter(
      (campaign) => campaign.active !== false && campaign.platform === rule.platform,
    );
    if (matchingCampaigns.length === 0) {
      skipped.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        metric,
        reason: `No active ${rule.platform} campaign found.`,
        missing_fields: ["campaign"],
      });
      return;
    }

    matchingCampaigns.forEach((campaign) => {
      const rows = input.daily_performance.filter(
        (row) => row.campaign_id === campaign.id && isInWindow(row.perf_date, generatedAt, lookbackDays),
      );
      const summary = summarizeCampaign(campaign, rows);
      const result = metricResult(summary, metric);
      if (result.value == null) {
        skipped.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          target_name: campaign.name,
          metric,
          reason: result.reason ?? "Metric cannot be computed from available performance rows.",
          missing_fields: result.missingFields,
        });
        if (result.missingFields.length > 0) risks.add("MISSING_MEDIA_BUYING_INPUTS");
        return;
      }

      if (!compareMetric(operator, result.value, threshold)) return;

      const lastAction = lastMatchingAction(input.action_history ?? [], rule.id, campaign.name);
      if (lastAction && isWithinCooldown(generatedAt, lastAction.created_at, cooldownHours)) {
        suppressed.push({
          key: `${rule.id}:${campaign.id}`,
          rule_id: rule.id,
          target_name: campaign.name,
          reason: "cooldown",
          cooldown_hours: cooldownHours,
          last_action_at: lastAction.created_at,
        });
        return;
      }

      const originalAction = rule.action_type;
      let actionType = rule.action_type;
      let guardrailStatus: MediaBuyingSuggestion["guardrail_status"] = "clear";
      if (rule.action_type === "scale_up") {
        guardrailStatus = "requires_gate";
        if (complianceStatus && complianceStatus !== "COMPLIANT") {
          actionType = "alert_only";
          guardrailStatus = "held_by_compliance";
          risks.add("SCALE_UP_HELD_BY_BUDGET_COMPLIANCE");
        }
      }

      suggestions.push({
        key: `${rule.id}:${campaign.id}`,
        rule_id: rule.id,
        target_name: campaign.name,
        target_platform: campaign.platform,
        metric,
        metric_value: result.storedValue,
        threshold_value: threshold,
        action_type: actionType,
        action_value: rule.action_value ?? null,
        priority: rule.priority,
        lookback_days: lookbackDays,
        original_action_type: originalAction,
        guardrail_status: guardrailStatus,
        notes: suggestionNotes(rule, lookbackDays, result, guardrailStatus, complianceStatus),
      });
    });
  });

  suggestions.sort((a, b) => {
    const priority = (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
    if (priority !== 0) return priority;
    return a.target_name.localeCompare(b.target_name);
  });

  const nextActions =
    suggestions.length > 0
      ? [
          "Review suggested media-buying actions.",
          "Run Budget Change Gate before applying any spend increase.",
          "Record applied or dismissed status after review.",
        ]
      : ["No rule-triggered media-buying action is required right now."];

  if (suppressed.length > 0) nextActions.push("Review cooldown-suppressed triggers if the same issue persists.");
  if (skipped.length > 0) nextActions.push("Fix missing campaign performance fields before relying on skipped metrics.");

  return {
    engine_version: "media_buying_rule_evaluation_v1",
    generated_at: generatedAt,
    campaign_count: input.campaigns.filter((campaign) => campaign.active !== false).length,
    active_rule_count: activeRules.length,
    suggestion_count: suggestions.length,
    suppressed_count: suppressed.length,
    skipped_count: skipped.length,
    suggestions,
    suppressed,
    skipped,
    campaign_summaries: campaignSummaries,
    risks: Array.from(risks),
    next_actions: nextActions,
    summary: `${suggestions.length} suggestion(s), ${suppressed.length} cooldown suppression(s), ${skipped.length} skipped check(s).`,
  };
}
