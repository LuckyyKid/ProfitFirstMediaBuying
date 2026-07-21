import { describe, expect, it } from "vitest";
import {
  aggregateCampaignPerformance,
  evaluateMediaBuyingRules,
  type MediaBuyingCampaignInput,
  type MediaBuyingDailyPerformanceInput,
  type MediaBuyingRuleInput,
} from "./mediaBuyingRuleEngine";

const campaigns: MediaBuyingCampaignInput[] = [
  { id: "camp_1", name: "Meta Prospecting", platform: "meta", active: true },
  { id: "camp_2", name: "Google Brand", platform: "google", active: true },
];

function rule(partial: Partial<MediaBuyingRuleInput>): MediaBuyingRuleInput {
  return {
    id: "rule_1",
    rule_name: "Rule",
    platform: "meta",
    scope: "campaign",
    metric: "roas",
    operator: "<",
    threshold_value: 1.5,
    lookback_days: 3,
    action_type: "pause",
    action_value: null,
    cooldown_hours: 24,
    priority: "high",
    is_active: true,
    ...partial,
  };
}

const perfRows: MediaBuyingDailyPerformanceInput[] = [
  { campaign_id: "camp_1", perf_date: "2026-07-13", spend: 100, revenue: 80, orders: 2, leads: 0 },
  { campaign_id: "camp_1", perf_date: "2026-07-14", spend: 100, revenue: 90, orders: 3, leads: 0 },
  { campaign_id: "camp_2", perf_date: "2026-07-14", spend: 50, revenue: 500, orders: 10, leads: 0 },
];

describe("media buying rule engine", () => {
  it("aggregates campaign performance for the selected lookback window", () => {
    const summaries = aggregateCampaignPerformance(campaigns, perfRows, 2, "2026-07-14T12:00:00.000Z");

    expect(summaries[0]).toMatchObject({
      campaign_id: "camp_1",
      spend: 200,
      revenue: 170,
      orders: 5,
      roas: 0.85,
      cpa: 40,
    });
  });

  it("creates a suggestion when ROAS breaches a rule threshold", () => {
    const output = evaluateMediaBuyingRules({
      rules: [rule({})],
      campaigns,
      daily_performance: perfRows,
      generated_at: "2026-07-14T12:00:00.000Z",
    });

    expect(output.suggestion_count).toBe(1);
    expect(output.suggestions[0]).toMatchObject({
      target_name: "Meta Prospecting",
      metric: "roas",
      metric_value: 0.85,
      action_type: "pause",
    });
  });

  it("treats spend with zero orders as unbounded CPA for cost guardrails", () => {
    const output = evaluateMediaBuyingRules({
      rules: [rule({ metric: "cpa", operator: ">", threshold_value: 60, action_type: "scale_down" })],
      campaigns,
      daily_performance: [
        { campaign_id: "camp_1", perf_date: "2026-07-14", spend: 250, revenue: 0, orders: 0 },
      ],
      generated_at: "2026-07-14T12:00:00.000Z",
    });

    expect(output.suggestion_count).toBe(1);
    expect(output.suggestions[0].metric_value).toBeNull();
    expect(output.suggestions[0].notes).toContain("CPA is unbounded");
  });

  it("suppresses duplicate suggestions during rule cooldown", () => {
    const output = evaluateMediaBuyingRules({
      rules: [rule({ cooldown_hours: 48 })],
      campaigns,
      daily_performance: perfRows,
      action_history: [
        {
          rule_id: "rule_1",
          target_name: "Meta Prospecting",
          target_platform: "meta",
          status: "suggested",
          created_at: "2026-07-14T08:00:00.000Z",
        },
      ],
      generated_at: "2026-07-14T12:00:00.000Z",
    });

    expect(output.suggestion_count).toBe(0);
    expect(output.suppressed_count).toBe(1);
    expect(output.suppressed[0].reason).toBe("cooldown");
  });

  it("skips CTR rules when click and impression data are unavailable", () => {
    const output = evaluateMediaBuyingRules({
      rules: [rule({ metric: "ctr", operator: "<", threshold_value: 0.8 })],
      campaigns,
      daily_performance: perfRows,
      generated_at: "2026-07-14T12:00:00.000Z",
    });

    expect(output.suggestion_count).toBe(0);
    expect(output.skipped_count).toBe(1);
    expect(output.skipped[0].missing_fields).toEqual(["clicks", "impressions"]);
    expect(output.risks).toContain("MISSING_MEDIA_BUYING_INPUTS");
  });

  it("holds scale-up suggestions when budget compliance is not compliant", () => {
    const output = evaluateMediaBuyingRules({
      rules: [
        rule({
          metric: "roas",
          operator: ">",
          threshold_value: 0.5,
          action_type: "scale_up",
          action_value: 20,
        }),
      ],
      campaigns,
      daily_performance: perfRows,
      budget_compliance: { status: "BREACH", generated_at: "2026-07-14T11:00:00.000Z" },
      generated_at: "2026-07-14T12:00:00.000Z",
    });

    expect(output.suggestion_count).toBe(1);
    expect(output.suggestions[0]).toMatchObject({
      original_action_type: "scale_up",
      action_type: "alert_only",
      guardrail_status: "held_by_compliance",
    });
    expect(output.risks).toContain("SCALE_UP_HELD_BY_BUDGET_COMPLIANCE");
  });
});
