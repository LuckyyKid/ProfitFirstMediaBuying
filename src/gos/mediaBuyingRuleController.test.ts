import { describe, expect, it, vi } from "vitest";
import {
  maxRuleLookbackDays,
  normalizeMediaBuyingPerformanceRow,
  toMediaBuyingActionApplicationGuardModelRunPayload,
  toMediaBuyingActionInsertRows,
  toMediaBuyingRuleEvaluationModelRunPayload,
} from "./mediaBuyingRuleController";
import { evaluateMediaBuyingRules, type MediaBuyingRuleEvaluationInput } from "./mediaBuyingRuleEngine";
import { buildMediaBuyingActionApplicationGuard } from "./mediaBuyingActionApplicationGuard";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("media buying rule controller", () => {
  const input: MediaBuyingRuleEvaluationInput = {
    rules: [
      {
        id: "rule_1",
        rule_name: "Low ROAS",
        platform: "meta",
        scope: "campaign",
        metric: "roas",
        operator: "<",
        threshold_value: 1.2,
        lookback_days: 3,
        action_type: "pause",
        action_value: null,
        cooldown_hours: 24,
        priority: "high",
        is_active: true,
      },
    ],
    campaigns: [{ id: "camp_1", name: "Meta Prospecting", platform: "meta", active: true }],
    daily_performance: [
      { campaign_id: "camp_1", perf_date: "2026-07-14", spend: 100, revenue: 80, orders: 1 },
    ],
    generated_at: "2026-07-14T12:00:00.000Z",
  };

  it("builds model_run payload with audit-friendly formula metadata", () => {
    const output = evaluateMediaBuyingRules(input);
    const payload = toMediaBuyingRuleEvaluationModelRunPayload("client_1", input, output);

    expect(payload.model_name).toBe("media_buying_rule_evaluation");
    expect(payload.model_version).toBe("v1");
    expect(payload.generated_by).toBe("gos_media_buying_rule_evaluation");
    expect(payload.output_json.engine_version).toBe("media_buying_rule_evaluation_v1");
    expect(payload.formula_used.components).toContain("budget_compliance_scale_up_guardrail");
  });

  it("maps suggestions into gos_media_buying_actions insert rows", () => {
    const output = evaluateMediaBuyingRules(input);
    const rows = toMediaBuyingActionInsertRows("client_1", output.suggestions);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      client_id: "client_1",
      rule_id: "rule_1",
      target_name: "Meta Prospecting",
      metric: "roas",
      action_type: "pause",
      status: "suggested",
    });
  });

  it("normalizes campaign performance rows from perf_date source columns", () => {
    const row = normalizeMediaBuyingPerformanceRow({
      campaign_id: "camp_1",
      perf_date: "2026-07-14",
      spend: "150.5",
      revenue: "300",
      orders: 3,
    });

    expect(row).toMatchObject({
      campaign_id: "camp_1",
      perf_date: "2026-07-14",
      spend: 150.5,
      revenue: 300,
      orders: 3,
    });
  });

  it("caps fetched lookback windows to a safe bound", () => {
    expect(maxRuleLookbackDays(input.rules)).toBe(7);
    expect(maxRuleLookbackDays([{ ...input.rules[0], lookback_days: 120 }])).toBe(90);
  });

  it("builds action application guard model_run payloads", () => {
    const action = {
      id: "action_1",
      client_id: "client_1",
      rule_id: "rule_1",
      target_name: "Meta Prospecting",
      target_platform: "meta",
      metric: "roas",
      metric_value: 3.2,
      threshold_value: 3,
      action_type: "alert_only",
      action_value: null,
      status: "suggested",
      applied_at: null,
      notes: null,
      created_at: "2026-07-14T12:00:00.000Z",
    };
    const output = buildMediaBuyingActionApplicationGuard({
      action,
      campaigns: [],
      generatedAt: "2026-07-14T12:05:00.000Z",
    });
    const payload = toMediaBuyingActionApplicationGuardModelRunPayload("client_1", action, output);

    expect(payload.model_name).toBe("media_buying_action_application_guard");
    expect(payload.model_version).toBe("v1");
    expect(payload.generated_by).toBe("gos_media_buying_action_application_guard");
    expect(payload.output_json.engine_version).toBe("media_buying_action_application_guard_v1");
    expect(payload.formula_used.components).toContain("budget_application_audit_required_for_budget_actions");
  });
});
