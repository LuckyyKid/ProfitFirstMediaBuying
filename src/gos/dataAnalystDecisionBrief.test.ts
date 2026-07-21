import { describe, expect, it } from "vitest";
import { buildDataAnalystDecisionBrief } from "./dataAnalystDecisionBrief";
import type { DataAnalystFoundationOutput } from "./dataAnalystFoundation";
import type { DataAnalystStatisticalOutput } from "./dataAnalystStatisticalController";

const foundation: DataAnalystFoundationOutput = {
  engine_version: "data_analyst_foundation_v1",
  generated_at: "2026-07-15T00:00:00Z",
  score: 96,
  readiness: "READY_FOR_ADVANCED_ANALYSIS",
  coverage: {
    transactions: 120,
    valid_transactions: 120,
    unique_customers: 100,
    acquisition_cohorts: 4,
    cohort_age_columns: 4,
    revenue_coverage_pct: 100,
    gross_profit_coverage_pct: 90,
    daily_rows: 21,
    daily_actual_coverage_pct: 100,
    daily_projection_coverage_pct: 100,
    projection_updates_14d: 2,
  },
  checks: [],
  signals: [],
  model_card: {
    purpose: "test",
    inputs: [],
    assumptions: [],
    limitations: [],
    next_statistical_upgrade: [],
  },
  summary: "ready",
};

const statistical: DataAnalystStatisticalOutput = {
  engine_version: "data_analyst_statistical_upgrade_v1",
  generated_at: "2026-07-15T00:00:00Z",
  readiness: "READY_FOR_ADVANCED_ANALYSIS",
  retention_curve: {
    status: "fit",
    cohorts: 4,
    age_periods: 4,
    r_squared: 0.9,
    backtest_mape_pct: 12,
  },
  pnl_anomalies: {
    rows_analyzed: 21,
    anomalies: [],
  },
  spend_efficiency_regression: {
    status: "fit",
    observations: 6,
    elasticity: 0.74,
    r_squared: 0.88,
    p_value: 0.002,
  },
  mmm_incrementality: {
    status: "fit",
    observations: 21,
    portfolio: {
      weighted_incrementality_factor: 0.68,
      weighted_incremental_roas: 1.7,
      r_squared: 0.61,
    },
    channels: [
      { channel: "meta", spend: 3000, estimated_incremental_revenue: 4800, incrementality_factor: 0.64 },
      { channel: "google", spend: 2000, estimated_incremental_revenue: 3700, incrementality_factor: 0.72 },
    ],
  },
  recommendations: [],
};

describe("data analyst decision brief", () => {
  it("allows controlled scale when foundation, retention, spend regression, and P&L are healthy", () => {
    const brief = buildDataAnalystDecisionBrief({
      foundation,
      statistical,
      generatedAt: "2026-07-15T00:00:00Z",
    });

    expect(brief.posture).toBe("READY_FOR_CONTROLLED_SCALE");
    expect(brief.confidence_score).toBeGreaterThanOrEqual(85);
    expect(brief.primary_decision).toContain("Controlled scale");
    expect(brief.guardrails.find((g) => g.id === "spend_regression")?.status).toBe("active");
    expect(brief.guardrails.find((g) => g.id === "channel_incrementality")?.status).toBe("active");
  });

  it("holds budget increases when critical P&L anomalies exist", () => {
    const brief = buildDataAnalystDecisionBrief({
      foundation,
      statistical: {
        ...statistical,
        pnl_anomalies: {
          rows_analyzed: 21,
          anomalies: [{ date: "2026-07-12", metric: "revenue", delta_pct: -42, severity: "critical" }],
        },
      },
    });

    expect(brief.posture).toBe("HOLD_AND_INVESTIGATE");
    expect(brief.actions[0].id).toBe("investigate_critical_pnl_anomalies");
    expect(brief.guardrails.find((g) => g.id === "projection_integrity")?.status).toBe("blocked");
  });

  it("blocks advanced recommendations when foundation is missing or weak", () => {
    const brief = buildDataAnalystDecisionBrief({
      foundation: { ...foundation, readiness: "NEEDS_WORK", score: 48 },
      statistical,
    });

    expect(brief.posture).toBe("FIX_DATA_FIRST");
    expect(brief.actions.find((action) => action.id === "fix_foundation_data")?.priority).toBe("P0");
    expect(brief.confidence_score).toBeLessThan(85);
  });

  it("keeps lightweight MMM as a watch guardrail when it is directional", () => {
    const brief = buildDataAnalystDecisionBrief({
      foundation,
      statistical: {
        ...statistical,
        mmm_incrementality: {
          status: "directional",
          observations: 21,
          portfolio: { weighted_incrementality_factor: 0.4, r_squared: 0.2 },
          channels: [{ channel: "meta", spend: 3000, estimated_incremental_revenue: 2000 }],
        },
      },
    });

    expect(brief.guardrails.find((g) => g.id === "channel_incrementality")?.status).toBe("watch");
    expect(brief.actions.find((action) => action.id === "treat_mmm_as_directional")?.area).toBe("incrementality");
  });
});
