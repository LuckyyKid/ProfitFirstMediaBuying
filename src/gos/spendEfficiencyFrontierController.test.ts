import { describe, expect, it, vi } from "vitest";
import {
  normalizeSpendEfficiencyModelRunRow,
  toSpendEfficiencyModelRunPayload,
} from "./spendEfficiencyFrontierController";
import { runSpendEfficiencyFrontier, type SpendEfficiencyInput } from "./spendEfficiencyFrontier";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const input: SpendEfficiencyInput = {
  history: [
    { period: "2026-01", spend: 1000, new_customer_revenue: 4000 },
    { period: "2026-02", spend: 2000, new_customer_revenue: 7200 },
    { period: "2026-03", spend: 4000, new_customer_revenue: 12000 },
  ],
  objective: "MAX_FIRST_ORDER_CONTRIBUTION",
  gross_margin_rate: 50,
};

describe("spend efficiency frontier controller mappers", () => {
  it("builds a model_runs payload without leaking Supabase concerns into the model", () => {
    const output = runSpendEfficiencyFrontier(input);
    const payload = toSpendEfficiencyModelRunPayload("client-1", input, output);

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("spend_efficiency_frontier");
    expect(payload.model_version).toBe("v1");
    expect(payload.input_json.objective).toBe("MAX_FIRST_ORDER_CONTRIBUTION");
    expect(payload.output_json.engine_version).toBe("spend_efficiency_frontier_v1");
    expect(payload.formula_used.components).toContain("objective_selection");
  });

  it("normalizes model_runs rows into typed frontier run rows", () => {
    const output = runSpendEfficiencyFrontier(input);
    const row = normalizeSpendEfficiencyModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "spend_efficiency_frontier",
      model_version: "v1",
      input_json: input,
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-14T20:00:00Z",
      generated_by: "gos_spend_efficiency_frontier",
      am_approved: true,
      am_override: false,
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.recommended_spend).toBe(output.recommended_spend);
    expect(row.am_approved).toBe(true);
    expect(row.am_override).toBe(false);
    expect(row.override_reason).toBeNull();
  });
});
