import { describe, expect, it } from "vitest";
import { buildDataAnalystExecutionPlan } from "./dataAnalystExecutionPlan";
import type { DataAnalystDecisionBriefOutput } from "./dataAnalystDecisionBrief";

const brief: DataAnalystDecisionBriefOutput = {
  engine_version: "data_analyst_decision_brief_v1",
  generated_at: "2026-07-15T00:00:00Z",
  posture: "READY_FOR_CONTROLLED_SCALE",
  confidence_score: 92,
  primary_decision: "Controlled scale is allowed if Profit First guardrails pass.",
  actions: [
    {
      id: "investigate_critical_pnl_anomalies",
      priority: "P0",
      area: "pnl",
      owner: "AM",
      action: "Investigate anomalies.",
      rationale: "Projection residuals are large.",
      evidence: "1 critical anomaly.",
    },
    {
      id: "prepare_scale",
      priority: "P1",
      area: "spend",
      owner: "MEDIA_BUYER",
      action: "Prepare scale plan.",
      rationale: "Regression and retention are strong.",
      evidence: "R2 0.88.",
    },
  ],
  guardrails: [
    {
      id: "projection_integrity",
      label: "Projection integrity",
      status: "active",
      rule: "Check anomalies before budget changes.",
      evidence: "No critical anomaly.",
    },
    {
      id: "retention_ltv",
      label: "Retention/LTV expansion",
      status: "watch",
      rule: "Review backtest before CAC expansion.",
      evidence: "Backtest 20%.",
    },
  ],
  risks: [],
  model_card: {
    purpose: "test",
    inputs: [],
    assumptions: [],
    limitations: [],
  },
  summary: "ready",
};

describe("data analyst execution plan", () => {
  it("creates a blocked plan when no decision brief is available", () => {
    const plan = buildDataAnalystExecutionPlan({ generatedAt: "2026-07-15T00:00:00Z" });

    expect(plan.posture).toBe("NO_BRIEF");
    expect(plan.operating_mode).toBe("blocked");
    expect(plan.work_items[0].id).toBe("work_generate_decision_brief");
    expect(plan.work_items[0].due_date).toBe("2026-07-16");
    expect(plan.clash_code_confirm.map((step) => step.stage)).toEqual(["clash", "code", "confirm"]);
  });

  it("turns decision brief actions into dated work items and guardrail monitors", () => {
    const plan = buildDataAnalystExecutionPlan({
      brief,
      generatedAt: "2026-07-15T00:00:00Z",
    });

    expect(plan.posture).toBe("READY_FOR_CONTROLLED_SCALE");
    expect(plan.operating_mode).toBe("controlled_scale");
    expect(plan.work_items.find((item) => item.source_action_id === "investigate_critical_pnl_anomalies")?.due_date).toBe("2026-07-16");
    expect(plan.work_items.find((item) => item.source_action_id === "prepare_scale")?.due_date).toBe("2026-07-18");
    expect(plan.work_items.find((item) => item.id === "work_controlled_scale_review")).toBeTruthy();
    expect(plan.guardrail_monitors.find((monitor) => monitor.source_guardrail_id === "retention_ltv")?.check_frequency).toBe("weekly");
    expect(plan.clash_code_confirm).toHaveLength(plan.work_items.length * 3);
    expect(plan.clash_code_confirm.find((step) => step.stage === "clash")?.instruction).toContain("Challenge the work item");
    expect(plan.clash_code_confirm.find((step) => step.stage === "code")?.completion_signal).toContain("operating record");
    expect(plan.clash_code_confirm.find((step) => step.stage === "confirm")?.completion_signal).toContain("confirmation");
  });

  it("blocks non-P0 tasks when the brief posture requires data fixes", () => {
    const plan = buildDataAnalystExecutionPlan({
      brief: { ...brief, posture: "FIX_DATA_FIRST" },
      generatedAt: "2026-07-15T00:00:00Z",
    });

    expect(plan.operating_mode).toBe("blocked");
    expect(plan.work_items.find((item) => item.priority === "P0")?.status).toBe("ready");
    expect(plan.work_items.find((item) => item.priority === "P1")?.status).toBe("blocked");
  });
});
