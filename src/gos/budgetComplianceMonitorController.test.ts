import { describe, expect, it, vi } from "vitest";
import { buildBudgetComplianceMonitor } from "./budgetComplianceMonitor";
import {
  normalizeBudgetComplianceMonitorModelRunRow,
  toBudgetComplianceMonitorModelRunPayload,
} from "./budgetComplianceMonitorController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("budget compliance monitor controller", () => {
  it("builds an auditable model_runs payload", () => {
    const input = {
      campaigns: [{ campaign_id: "camp-1", current_daily_budget: 100, active: true }],
      latest_gate_generated_at: "2026-07-15T00:00:00Z",
    };
    const output = buildBudgetComplianceMonitor({
      ...input,
      generatedAt: "2026-07-15T01:00:00Z",
    });
    const payload = toBudgetComplianceMonitorModelRunPayload("client-1", input, output);

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("budget_compliance_monitor");
    expect(payload.input_json.campaign_count).toBe(1);
    expect(payload.output_json.engine_version).toBe("budget_compliance_monitor_v1");
    expect(payload.formula_used.components).toContain("budget_application_audit_drift");
  });

  it("normalizes saved compliance rows", () => {
    const output = buildBudgetComplianceMonitor({
      campaigns: [{ campaign_id: "camp-1", current_daily_budget: 100, active: true }],
      generatedAt: "2026-07-15T01:00:00Z",
    });
    const row = normalizeBudgetComplianceMonitorModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "budget_compliance_monitor",
      model_version: "v1",
      input_json: { campaign_count: 1 },
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-15T01:00:00Z",
      generated_by: "gos_budget_compliance_monitor",
      am_approved: false,
      am_override: false,
      override_reason: null,
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.status).toBe("NO_GATE");
    expect(row.generated_by).toBe("gos_budget_compliance_monitor");
  });
});
