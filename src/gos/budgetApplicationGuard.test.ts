import { describe, expect, it } from "vitest";
import { buildBudgetApplicationGuard, type CampaignBudgetState } from "./budgetApplicationGuard";
import type { ProfitFirstBudgetChangeGateOutput } from "./profitFirstBudgetChangeGate";

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
  current_monthly_spend: 4560,
  proposed_monthly_spend: 6080,
  proposed_daily_spend: 200,
  delta_monthly_spend: 1520,
  delta_pct: 0.3333,
  max_safe_monthly_spend: 7000,
  max_safe_daily_spend: 230.26,
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

describe("budget application guard", () => {
  it("allows decreases without requiring a gate", () => {
    const output = buildBudgetApplicationGuard({
      campaigns,
      updates: [{ campaign_id: "camp-1", proposed_daily_budget: 75 }],
      generatedAt: "2026-07-15T01:00:00Z",
    });

    expect(output.decision).toBe("ALLOW");
    expect(output.change_type).toBe("decrease");
  });

  it("requires a Budget Change Gate for increases", () => {
    const output = buildBudgetApplicationGuard({
      campaigns,
      updates: [{ campaign_id: "camp-1", proposed_daily_budget: 125 }],
      generatedAt: "2026-07-15T01:00:00Z",
    });

    expect(output.decision).toBe("REQUIRE_GATE");
    expect(output.risks[0]).toContain("No Budget Change Gate");
  });

  it("allows increases covered by the latest approved gate", () => {
    const output = buildBudgetApplicationGuard({
      campaigns,
      updates: [{ campaign_id: "camp-1", proposed_daily_budget: 125 }],
      latest_gate: gate,
      generatedAt: "2026-07-15T01:00:00Z",
    });

    expect(output.decision).toBe("ALLOW");
    expect(output.proposed_monthly_total).toBeLessThanOrEqual(gate.proposed_monthly_spend);
  });

  it("requires a new gate when proposed spend exceeds the gated proposal", () => {
    const output = buildBudgetApplicationGuard({
      campaigns,
      updates: [{ campaign_id: "camp-1", proposed_daily_budget: 180 }],
      latest_gate: gate,
      generatedAt: "2026-07-15T01:00:00Z",
    });

    expect(output.decision).toBe("REQUIRE_GATE");
    expect(output.risks.some((risk) => risk.includes("gated proposal"))).toBe(true);
  });
});
