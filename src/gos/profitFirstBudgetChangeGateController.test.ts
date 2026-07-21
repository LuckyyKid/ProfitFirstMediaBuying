import { describe, expect, it, vi } from "vitest";
import {
  normalizeProfitFirstBudgetChangeGateModelRunRow,
  normalizeProfitFirstMediaBuyingModelRunRow,
  toProfitFirstBudgetChangeGateModelRunPayload,
} from "./profitFirstBudgetChangeGateController";
import { buildProfitFirstBudgetChangeGate, type ProfitFirstBudgetChangeGateInput } from "./profitFirstBudgetChangeGate";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("profit first budget change gate controller", () => {
  it("builds an auditable model_runs payload", () => {
    const input: ProfitFirstBudgetChangeGateInput = {
      current_monthly_spend: 5000,
      proposed_monthly_spend: 6000,
      proposal_source: "media_buyer",
      reason: "controlled scale test",
      profit_first: null,
      execution_plan: null,
      generatedAt: "2026-07-15T00:00:00Z",
    };
    const output = buildProfitFirstBudgetChangeGate(input);
    const payload = toProfitFirstBudgetChangeGateModelRunPayload("client-1", input, output);

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("profit_first_budget_change_gate");
    expect(payload.input_json.proposed_monthly_spend).toBe(6000);
    expect(payload.output_json.engine_version).toBe("profit_first_budget_change_gate_v1");
    expect(payload.formula_used.components).toContain("pfmb_safe_spend_cap");
  });

  it("normalizes saved budget gate rows", () => {
    const output = buildProfitFirstBudgetChangeGate({
      current_monthly_spend: 5000,
      proposed_monthly_spend: 6000,
      generatedAt: "2026-07-15T00:00:00Z",
    });
    const row = normalizeProfitFirstBudgetChangeGateModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "profit_first_budget_change_gate",
      model_version: "v1",
      input_json: { proposed_monthly_spend: 6000 },
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-15T00:00:00Z",
      generated_by: "gos_profit_first_budget_change_gate",
      am_approved: true,
      am_override: false,
      override_reason: null,
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.decision).toBe("BLOCKED");
    expect(row.am_approved).toBe(true);
  });

  it("normalizes latest Profit First Media Buying rows", () => {
    const row = normalizeProfitFirstMediaBuyingModelRunRow({
      id: "pfmb-1",
      client_id: "client-1",
      model_name: "profit_first_media_buying",
      model_version: "1.0",
      input_json: { planned_spend: 5000 },
      output_json: { engine_version: "profit_first_media_buying_v1", recommended_spend: 5000 },
      generated_at: "2026-07-15T00:00:00Z",
    });

    expect(row.id).toBe("pfmb-1");
    expect(row.output_json.recommended_spend).toBe(5000);
    expect(row.generated_at).toBe("2026-07-15T00:00:00Z");
  });
});
