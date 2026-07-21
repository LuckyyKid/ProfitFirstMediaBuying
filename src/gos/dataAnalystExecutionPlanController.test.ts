import { describe, expect, it, vi } from "vitest";
import {
  normalizeDataAnalystExecutionPlanModelRunRow,
  toDataAnalystExecutionPlanModelRunPayload,
} from "./dataAnalystExecutionPlanController";
import { buildDataAnalystExecutionPlan } from "./dataAnalystExecutionPlan";
import type { DataAnalystDecisionBriefOutput } from "./dataAnalystDecisionBrief";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const brief = {
  generated_at: "2026-07-15T00:00:00Z",
  posture: "MAINTAIN_WITH_GUARDRAILS",
  confidence_score: 72,
  actions: [],
  guardrails: [],
} as unknown as DataAnalystDecisionBriefOutput;

describe("data analyst execution plan controller", () => {
  it("builds an auditable model_runs payload", () => {
    const output = buildDataAnalystExecutionPlan({ brief, generatedAt: "2026-07-15T01:00:00Z" });
    const payload = toDataAnalystExecutionPlanModelRunPayload("client-1", brief, output);

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("data_analyst_execution_plan");
    expect(payload.input_json.brief_posture).toBe("MAINTAIN_WITH_GUARDRAILS");
    expect(payload.input_json.clash_code_confirm_step_count).toBe(output.clash_code_confirm.length);
    expect(payload.output_json.engine_version).toBe("data_analyst_execution_plan_v1");
    expect(payload.formula_used.components).toContain("priority_due_date_assignment");
    expect(payload.formula_used.components).toContain("clash_code_confirm_workflow_mapping");
  });

  it("normalizes saved model_runs rows", () => {
    const output = buildDataAnalystExecutionPlan({ brief, generatedAt: "2026-07-15T01:00:00Z" });
    const row = normalizeDataAnalystExecutionPlanModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "data_analyst_execution_plan",
      model_version: "v1",
      input_json: { brief_posture: "MAINTAIN_WITH_GUARDRAILS" },
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-15T01:00:00Z",
      generated_by: "gos_data_analyst_execution_plan",
      am_approved: false,
      am_override: true,
      override_reason: "Manual adjustment",
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.operating_mode).toBe("guardrailed_execution");
    expect(row.am_override).toBe(true);
    expect(row.override_reason).toBe("Manual adjustment");
  });
});
