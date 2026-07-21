import { describe, expect, it, vi } from "vitest";
import {
  normalizeDataAnalystDecisionBriefModelRunRow,
  toDataAnalystDecisionBriefModelRunPayload,
} from "./dataAnalystDecisionBriefController";
import { buildDataAnalystDecisionBrief } from "./dataAnalystDecisionBrief";
import type { DataAnalystFoundationOutput } from "./dataAnalystFoundation";
import type { DataAnalystStatisticalOutput } from "./dataAnalystStatisticalController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const foundation = {
  generated_at: "2026-07-15T00:00:00Z",
  readiness: "READY_FOR_ADVANCED_ANALYSIS",
  score: 95,
} as DataAnalystFoundationOutput;

const statistical = {
  engine_version: "data_analyst_statistical_upgrade_v1",
  generated_at: "2026-07-15T00:05:00Z",
  readiness: "READY_FOR_ADVANCED_ANALYSIS",
  retention_curve: { status: "fit", cohorts: 4, r_squared: 0.9, backtest_mape_pct: 10 },
  pnl_anomalies: { rows_analyzed: 21, anomalies: [] },
  spend_efficiency_regression: { status: "fit", elasticity: 0.7, r_squared: 0.8, p_value: 0.01 },
} as DataAnalystStatisticalOutput;

describe("data analyst decision brief controller", () => {
  it("builds an auditable model_runs payload", () => {
    const output = buildDataAnalystDecisionBrief({ foundation, statistical });
    const payload = toDataAnalystDecisionBriefModelRunPayload("client-1", foundation, statistical, output);

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("data_analyst_decision_brief");
    expect(payload.input_json.foundation_score).toBe(95);
    expect(payload.input_json.statistical_engine).toBe("data_analyst_statistical_upgrade_v1");
    expect(payload.output_json.engine_version).toBe("data_analyst_decision_brief_v1");
    expect(payload.formula_used.components).toContain("decision_posture_selection");
  });

  it("normalizes saved model_runs rows", () => {
    const output = buildDataAnalystDecisionBrief({ foundation, statistical });
    const row = normalizeDataAnalystDecisionBriefModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "data_analyst_decision_brief",
      model_version: "v1",
      input_json: { foundation_score: 95 },
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-15T01:00:00Z",
      generated_by: "gos_data_analyst_decision_brief",
      am_approved: true,
      am_override: false,
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.posture).toBe(output.posture);
    expect(row.am_approved).toBe(true);
    expect(row.override_reason).toBeNull();
  });
});
