import { describe, expect, it } from "vitest";
import { runProfitFirstMediaBuying, type ProfitFirstInput } from "./profitFirstMediaBuying";
import { buildDataAnalystExecutionPlan } from "./dataAnalystExecutionPlan";
import { buildProfitFirstBudgetChangeGate } from "./profitFirstBudgetChangeGate";
import type { DataAnalystDecisionBriefOutput } from "./dataAnalystDecisionBrief";

const pfmbInput: ProfitFirstInput = {
  planned_spend: 6000,
  history: [
    { spend: 3000, cac: 30, mer: 3 },
    { spend: 5000, cac: 38, mer: 2.5 },
    { spend: 7000, cac: 45, mer: 2.2 },
  ],
  cohort: {
    aov_new: 120,
    aov_repeat: 100,
    cac_new: 42,
    cac_repeat: 5,
    conversion_rate: 0.03,
    repeat_cycle_months: 3,
    churn_per_cycle: 0.35,
    gross_margin_pct: 65,
  },
  cash: {
    cash_available: 150000,
    monthly_burn: 12000,
    inventory_days: 8,
    payout_delay_days: 3,
    safety_months: 3,
  },
  funnel: {
    monthly_sessions: 20000,
    sessions_per_dollar: 0.5,
  },
  target_cac: 55,
  target_mer: 2,
};

const controlledBrief: DataAnalystDecisionBriefOutput = {
  engine_version: "data_analyst_decision_brief_v1",
  generated_at: "2026-07-15T00:00:00Z",
  posture: "READY_FOR_CONTROLLED_SCALE",
  confidence_score: 90,
  primary_decision: "Controlled scale is allowed if Profit First guardrails pass.",
  actions: [],
  guardrails: [
    {
      id: "projection_integrity",
      label: "Projection integrity",
      status: "active",
      rule: "Check anomalies before budget changes.",
      evidence: "No critical anomaly.",
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

describe("profit first budget change gate", () => {
  it("approves a controlled increase below Profit First caps", () => {
    const pfmb = runProfitFirstMediaBuying(pfmbInput);
    const executionPlan = buildDataAnalystExecutionPlan({
      brief: controlledBrief,
      generatedAt: "2026-07-15T01:00:00Z",
    });

    const output = buildProfitFirstBudgetChangeGate({
      current_monthly_spend: 5000,
      proposed_monthly_spend: 5500,
      proposal_source: "media_buyer",
      profit_first: pfmb,
      execution_plan: executionPlan,
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.decision).toBe("APPROVED");
    expect(output.change_type).toBe("increase");
    expect(output.max_safe_monthly_spend).toBeGreaterThanOrEqual(5500);
    expect(output.checks.every((item) => item.status !== "fail")).toBe(true);
  });

  it("blocks an increase above the Profit First spend cap", () => {
    const pfmb = runProfitFirstMediaBuying({
      ...pfmbInput,
      cash: { ...pfmbInput.cash, cash_available: 45000 },
    });
    const executionPlan = buildDataAnalystExecutionPlan({
      brief: controlledBrief,
      generatedAt: "2026-07-15T01:00:00Z",
    });

    const output = buildProfitFirstBudgetChangeGate({
      current_monthly_spend: 5000,
      proposed_monthly_spend: 25000,
      profit_first: pfmb,
      execution_plan: executionPlan,
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.decision).toBe("BLOCKED");
    expect(output.checks.find((item) => item.id === "pfmb_spend_cap")?.status).toBe("fail");
    expect(output.risks.some((risk) => risk.includes("PFMB max safe spend"))).toBe(true);
  });

  it("holds a budget increase when the execution plan posture requires investigation", () => {
    const pfmb = runProfitFirstMediaBuying(pfmbInput);
    const executionPlan = buildDataAnalystExecutionPlan({
      brief: { ...controlledBrief, posture: "HOLD_AND_INVESTIGATE" },
      generatedAt: "2026-07-15T01:00:00Z",
    });

    const output = buildProfitFirstBudgetChangeGate({
      current_monthly_spend: 5000,
      proposed_monthly_spend: 5500,
      profit_first: pfmb,
      execution_plan: executionPlan,
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.decision).toBe("HOLD");
    expect(output.checks.find((item) => item.id === "execution_posture_hold")?.status).toBe("fail");
    expect(output.required_approval).toBe("AM_LEAD");
  });
});
