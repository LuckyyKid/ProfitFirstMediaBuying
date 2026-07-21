import { describe, expect, it } from "vitest";
import { buildBudgetComplianceMonitor } from "./budgetComplianceMonitor";
import type { ProfitFirstBudgetChangeGateOutput } from "./profitFirstBudgetChangeGate";
import type { BudgetApplicationAuditOutput, CampaignBudgetState } from "./budgetApplicationGuard";

const campaigns: CampaignBudgetState[] = [
  { campaign_id: "camp-1", current_daily_budget: 100, active: true },
  { campaign_id: "camp-2", current_daily_budget: 50, active: true },
];

const gate: ProfitFirstBudgetChangeGateOutput = {
  engine_version: "profit_first_budget_change_gate_v1",
  generated_at: "2026-07-15T00:00:00Z",
  decision: "APPROVED",
  change_type: "increase",
  required_approval: "NONE",
  current_monthly_spend: 3040,
  proposed_monthly_spend: 5000,
  proposed_daily_spend: 164.47,
  delta_monthly_spend: 1960,
  delta_pct: 0.6447,
  max_safe_monthly_spend: 6000,
  max_safe_daily_spend: 197.37,
  checks: [],
  conditions: [],
  risks: [],
  source_refs: {
    proposal_source: "test",
    profit_first_generated_at: null,
    execution_plan_generated_at: null,
    execution_plan_posture: null,
  },
  summary: "approved",
};

const appAudit: BudgetApplicationAuditOutput = {
  engine_version: "budget_application_guard_v1",
  generated_at: "2026-07-15T01:00:00Z",
  decision: "ALLOW",
  change_type: "increase",
  current_daily_total: 120,
  proposed_daily_total: 150,
  current_monthly_total: 3648,
  proposed_monthly_total: 4560,
  delta_monthly: 912,
  gate_decision: "APPROVED",
  gate_proposed_monthly_spend: 5000,
  gate_max_safe_monthly_spend: 6000,
  conditions: [],
  risks: [],
  summary: "allow",
  application: {
    applied: true,
    source: "daily_budget_planner",
    update_count: 1,
    updates: [{ campaign_id: "camp-1", proposed_daily_budget: 100 }],
  },
};

describe("budget compliance monitor", () => {
  it("marks current spend below the approved gate as compliant", () => {
    const output = buildBudgetComplianceMonitor({
      campaigns,
      latest_gate: gate,
      latest_application: { ...appAudit, proposed_monthly_total: 4560, proposed_daily_total: 150 },
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.status).toBe("COMPLIANT");
    expect(output.current_monthly_total).toBe(4560);
    expect(output.risks).toHaveLength(0);
  });

  it("flags active spend without a Budget Change Gate", () => {
    const output = buildBudgetComplianceMonitor({
      campaigns,
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.status).toBe("NO_GATE");
    expect(output.risks[0]).toContain("Budget Change Gate");
  });

  it("flags current spend that exceeds the gated proposal", () => {
    const output = buildBudgetComplianceMonitor({
      campaigns: [{ campaign_id: "camp-1", current_daily_budget: 220, active: true }],
      latest_gate: gate,
      latest_application: appAudit,
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.status).toBe("BREACH");
    expect(output.checks.find((item) => item.id === "gated_spend_cap")?.status).toBe("fail");
  });

  it("watches when current spend drifts from the latest applied audit", () => {
    const output = buildBudgetComplianceMonitor({
      campaigns,
      latest_gate: { ...gate, proposed_monthly_spend: 6000, max_safe_monthly_spend: 7000 },
      latest_application: { ...appAudit, proposed_monthly_total: 4000 },
      generatedAt: "2026-07-15T02:00:00Z",
    });

    expect(output.status).toBe("WATCH");
    expect(output.checks.find((item) => item.id === "application_drift")?.status).toBe("warn");
  });
});
