import { describe, expect, it, vi } from "vitest";
import {
  canApplyBudgetGuard,
  normalizeBudgetApplicationGuardModelRunRow,
  toBudgetApplicationGuardModelRunPayload,
} from "./budgetApplicationController";
import type { BudgetApplicationGuardOutput } from "./budgetApplicationGuard";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const baseGuard: BudgetApplicationGuardOutput = {
  engine_version: "budget_application_guard_v1",
  generated_at: "2026-07-15T00:00:00Z",
  decision: "ALLOW",
  change_type: "increase",
  current_daily_total: 100,
  proposed_daily_total: 110,
  current_monthly_total: 3040,
  proposed_monthly_total: 3344,
  delta_monthly: 304,
  gate_decision: "APPROVED",
  gate_proposed_monthly_spend: 4000,
  gate_max_safe_monthly_spend: 4500,
  conditions: [],
  risks: [],
  summary: "allow",
};

describe("budget application controller", () => {
  it("allows only allow decisions to mutate budgets", () => {
    expect(canApplyBudgetGuard(baseGuard)).toBe(true);
    expect(canApplyBudgetGuard({ ...baseGuard, decision: "ALLOW_WITH_CONDITIONS" })).toBe(true);
    expect(canApplyBudgetGuard({ ...baseGuard, decision: "REQUIRE_GATE" })).toBe(false);
    expect(canApplyBudgetGuard({ ...baseGuard, decision: "BLOCK" })).toBe(false);
  });

  it("builds an auditable budget application model_runs payload", () => {
    const updates = [{ campaign_id: "camp-1", proposed_daily_budget: 125 }];
    const payload = toBudgetApplicationGuardModelRunPayload("client-1", baseGuard, updates, true, {
      source: "daily_budget_planner",
    });

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("budget_application_guard");
    expect(payload.input_json.applied).toBe(true);
    expect(payload.output_json.application.update_count).toBe(1);
    expect(payload.output_json.application.source).toBe("daily_budget_planner");
    expect(payload.formula_used.components).toContain("application_audit_record");
  });

  it("normalizes saved budget application guard rows", () => {
    const updates = [{ campaign_id: "camp-1", proposed_daily_budget: 125 }];
    const payload = toBudgetApplicationGuardModelRunPayload("client-1", baseGuard, updates, false, {
      source: "buyer_workspace",
    });
    const row = normalizeBudgetApplicationGuardModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "budget_application_guard",
      model_version: "v1",
      input_json: payload.input_json,
      output_json: payload.output_json,
      formula_used: payload.formula_used,
      generated_at: "2026-07-15T01:00:00Z",
      generated_by: "gos_budget_application_guard",
      am_approved: false,
      am_override: false,
      override_reason: null,
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.application.applied).toBe(false);
    expect(row.output_json.application.source).toBe("buyer_workspace");
    expect(row.generated_by).toBe("gos_budget_application_guard");
  });
});
