import { describe, expect, it, vi } from "vitest";
import {
  normalizeDataAnalystFoundationModelRunRow,
  toDataAnalystFoundationModelRunPayload,
} from "./dataAnalystFoundationController";
import { runDataAnalystFoundation, type DataAnalystFoundationInput } from "./dataAnalystFoundation";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const input: DataAnalystFoundationInput = {
  transactions: [
    { customer_id: "A", transaction_date: "2026-01-05", order_id: "1", revenue: 100, gross_profit: 50 },
    { customer_id: "A", transaction_date: "2026-02-05", order_id: "2", revenue: 50, gross_profit: 25 },
    { customer_id: "B", transaction_date: "2026-02-10", order_id: "3", revenue: 80, gross_profit: 40 },
  ],
  dailyTargets: [
    {
      id: "day-1",
      target_date: "2026-07-01",
      target_revenue: 1000,
      projection_revenue: 1000,
      actual_revenue: 950,
    },
  ],
  projectionUpdates: [
    { id: "u-1", scope: "daily", metric_name: "projection_revenue", created_at: "2026-07-14T00:00:00.000Z" },
  ],
  nowIso: "2026-07-15T00:00:00.000Z",
};

describe("data analyst foundation controller mappers", () => {
  it("builds a compact model_runs payload for auditability", () => {
    const output = runDataAnalystFoundation(input);
    const payload = toDataAnalystFoundationModelRunPayload("client-1", input, output);

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("data_analyst_foundation");
    expect(payload.model_version).toBe("v1");
    expect(payload.input_json.transaction_count).toBe(3);
    expect(payload.input_json.transaction_start).toBe("2026-01-05");
    expect(payload.output_json.engine_version).toBe("data_analyst_foundation_v1");
    expect(payload.formula_used.components).toContain("analyst_model_card");
  });

  it("normalizes model_runs rows into typed analyst run rows", () => {
    const output = runDataAnalystFoundation(input);
    const row = normalizeDataAnalystFoundationModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "data_analyst_foundation",
      model_version: "v1",
      input_json: { transaction_count: 3 },
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-15T00:00:00.000Z",
      generated_by: "gos_data_analyst_foundation",
      am_approved: false,
      am_override: true,
      override_reason: "Manual review",
    });

    expect(row.id).toBe("run-1");
    expect(row.client_id).toBe("client-1");
    expect(row.output_json.score).toBe(output.score);
    expect(row.am_approved).toBe(false);
    expect(row.am_override).toBe(true);
    expect(row.override_reason).toBe("Manual review");
  });
});
