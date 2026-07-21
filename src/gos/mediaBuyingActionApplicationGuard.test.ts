import { describe, expect, it } from "vitest";
import { buildMediaBuyingActionApplicationGuard } from "./mediaBuyingActionApplicationGuard";
import type { BudgetApplicationAuditOutput } from "./budgetApplicationGuard";

const baseAction = {
  id: "action-1",
  target_name: "Meta Prospecting",
  action_type: "scale_up",
  action_value: 20,
  status: "suggested",
  created_at: "2026-07-15T10:00:00Z",
};

const campaigns = [
  { campaign_id: "camp-1", name: "Meta Prospecting", current_daily_budget: 120, active: true },
];

function audit(partial: Partial<BudgetApplicationAuditOutput> = {}): BudgetApplicationAuditOutput {
  return {
    engine_version: "budget_application_guard_v1",
    generated_at: "2026-07-15T10:30:00Z",
    decision: "ALLOW",
    change_type: "increase",
    current_daily_total: 100,
    proposed_daily_total: 120,
    current_monthly_total: 3040,
    proposed_monthly_total: 3648,
    delta_monthly: 608,
    gate_decision: "APPROVED",
    gate_proposed_monthly_spend: 4000,
    gate_max_safe_monthly_spend: 4500,
    conditions: [],
    risks: [],
    summary: "ALLOW - increase from 3040 to 3648 monthly spend.",
    application: {
      applied: true,
      source: "buyer_workspace",
      update_count: 1,
      updates: [{ campaign_id: "camp-1", proposed_daily_budget: 120 }],
    },
    ...partial,
  };
}

describe("media buying action application guard", () => {
  it("allows non-budget actions to be marked applied without budget audit", () => {
    const output = buildMediaBuyingActionApplicationGuard({
      action: { ...baseAction, action_type: "alert_only", action_value: null },
      campaigns,
      generatedAt: "2026-07-15T11:00:00Z",
    });

    expect(output.decision).toBe("ALLOW");
    expect(output.budget_mutation_required).toBe(false);
    expect(output.checks.some((check) => check.status === "fail")).toBe(false);
  });

  it("blocks budget actions when no matching budget application audit exists", () => {
    const output = buildMediaBuyingActionApplicationGuard({
      action: baseAction,
      campaigns,
      generatedAt: "2026-07-15T11:00:00Z",
    });

    expect(output.decision).toBe("BLOCK");
    expect(output.risks).toContain("MISSING_BUDGET_APPLICATION_AUDIT");
  });

  it("allows scale-up when a later applied audit matches the target campaign", () => {
    const output = buildMediaBuyingActionApplicationGuard({
      action: baseAction,
      campaigns,
      application_audits: [{ generated_at: "2026-07-15T10:30:00Z", output: audit() }],
      generatedAt: "2026-07-15T11:00:00Z",
    });

    expect(output.decision).toBe("ALLOW");
    expect(output.matched_campaign_id).toBe("camp-1");
    expect(output.matching_application_applied).toBe(true);
  });

  it("blocks when the applied audit does not match the action type", () => {
    const output = buildMediaBuyingActionApplicationGuard({
      action: baseAction,
      campaigns,
      application_audits: [
        {
          generated_at: "2026-07-15T10:30:00Z",
          output: audit({
            change_type: "decrease",
            delta_monthly: -608,
            summary: "ALLOW - decrease from 3648 to 3040 monthly spend.",
          }),
        },
      ],
      generatedAt: "2026-07-15T11:00:00Z",
    });

    expect(output.decision).toBe("BLOCK");
    expect(output.risks).toContain("ACTION_TYPE_DOES_NOT_MATCH_BUDGET_APPLICATION");
  });

  it("blocks pause actions unless the matching update sets budget to zero", () => {
    const output = buildMediaBuyingActionApplicationGuard({
      action: { ...baseAction, action_type: "pause", action_value: null },
      campaigns,
      application_audits: [{ generated_at: "2026-07-15T10:30:00Z", output: audit() }],
      generatedAt: "2026-07-15T11:00:00Z",
    });

    expect(output.decision).toBe("BLOCK");
    expect(output.risks).toContain("ACTION_TYPE_DOES_NOT_MATCH_BUDGET_APPLICATION");
  });
});
