import { describe, expect, it, vi } from "vitest";
import {
  normalizeDataAnalystStatisticalModelRunRow,
  parseDataAnalystStatisticalOutput,
  toDataAnalystStatisticalBatchInput,
  toDataAnalystStatisticalModelRunPayload,
  type DataAnalystStatisticalOutput,
} from "./dataAnalystStatisticalController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const output: DataAnalystStatisticalOutput = {
  engine_version: "data_analyst_statistical_upgrade_v1",
  generated_at: "2026-07-15T00:00:00Z",
  client_id: "client-1",
  readiness: "READY_FOR_ADVANCED_ANALYSIS",
  libraries: { pandas: "2.3.3", numpy: "2.3.5", scipy: "1.16.3" },
  retention_curve: {
    status: "fit",
    cohorts: 4,
    age_periods: 4,
    r_squared: 0.91,
    backtest_mape_pct: 12.4,
  },
  pnl_anomalies: {
    rows_analyzed: 21,
    anomalies: [{ date: "2026-07-12", metric: "revenue", delta_pct: -42, severity: "critical" }],
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
      total_spend: 4200,
      observed_revenue: 12000,
      estimated_incremental_revenue: 7000,
      weighted_incrementality_factor: 0.58,
      weighted_incremental_roas: 1.67,
      r_squared: 0.72,
    },
    channels: [
      {
        channel: "meta",
        spend: 2500,
        estimated_incremental_revenue: 4200,
        incrementality_factor: 0.56,
      },
    ],
  },
  recommendations: ["Use spend regression as a statistical companion."],
};

describe("data analyst statistical controller", () => {
  it("builds the Python batch input contract from normalized app rows", () => {
    const batchInput = toDataAnalystStatisticalBatchInput(
      "client-1",
      [
        {
          id: "tx-1",
          client_id: "client-1",
          customer_id: "customer-1",
          transaction_date: "2026-01-05T00:00:00.000Z",
          order_id: "order-1",
          revenue: 100,
          gross_profit: 55,
          acquisition_channel: "meta",
          product_key: "sku-1",
          segment_key: null,
          source: "integration",
        },
      ],
      [
        {
          id: "day-1",
          client_id: "client-1",
          parent_weekly_id: "week-1",
          target_date: "2026-07-01",
          day_of_week: 3,
          day_index: 0,
          pacing_weight: 1,
          target_revenue: 1000,
          target_ad_spend: 200,
          target_orders: 20,
          target_leads: 0,
          target_gross_profit: 500,
          projection_revenue: 950,
          projection_ad_spend: 190,
          projection_orders: 19,
          projection_leads: 0,
          projection_gross_profit: 480,
          actual_revenue: 900,
          actual_ad_spend: 180,
          actual_orders: 18,
          actual_leads: 0,
          variance_pct: -10,
          target_locked_at: null,
          target_locked_by: null,
          projection_last_updated_at: null,
          projection_last_updated_by: null,
          status: "PLANNED",
          notes: null,
        },
      ],
      [{ period: "2026-01", spend: 1000, new_customer_revenue: 4200 }],
      "2026-07-15T00:00:00.000Z",
      [{ date: "2026-07-01", channel: "meta", spend: 180, revenue: 900, orders: 18, leads: 0 }],
    );

    expect(batchInput.client_id).toBe("client-1");
    expect(batchInput.generated_at).toBe("2026-07-15T00:00:00.000Z");
    expect(batchInput.transactions[0]).toEqual({
      customer_id: "customer-1",
      transaction_date: "2026-01-05",
      order_id: "order-1",
      revenue: 100,
      gross_profit: 55,
      acquisition_channel: "meta",
      product_key: "sku-1",
      segment_key: null,
      source: "integration",
    });
    expect(batchInput.daily_pnl[0].projection_revenue).toBe(950);
    expect(batchInput.spend_history[0].new_customer_revenue).toBe(4200);
    expect(batchInput.channel_daily[0]).toEqual({
      date: "2026-07-01",
      channel: "meta",
      spend: 180,
      revenue: 900,
      orders: 18,
      leads: 0,
    });
    expect(batchInput.source_summary).toEqual({
      transaction_count: 1,
      daily_pnl_count: 1,
      spend_history_count: 1,
      spend_history_source: "spend_efficiency_frontier_model_run",
      channel_daily_count: 1,
      channel_daily_source: "gos_campaign_daily_perf",
    });
  });

  it("parses only the expected statistical batch output contract", () => {
    expect(parseDataAnalystStatisticalOutput(JSON.stringify(output)).readiness).toBe("READY_FOR_ADVANCED_ANALYSIS");

    expect(() => parseDataAnalystStatisticalOutput(JSON.stringify({
      ...output,
      engine_version: "wrong_engine",
    }))).toThrow("Invalid engine_version");
  });

  it("builds an auditable model_runs payload", () => {
    const payload = toDataAnalystStatisticalModelRunPayload("client-1", output, { source: "local_batch" });

    expect(payload.client_id).toBe("client-1");
    expect(payload.model_name).toBe("data_analyst_statistical_upgrade");
    expect(payload.model_version).toBe("v1");
    expect(payload.input_json.source).toBe("local_batch");
    expect(payload.input_json.libraries).toEqual(output.libraries);
    expect(payload.output_json.engine_version).toBe("data_analyst_statistical_upgrade_v1");
    expect(payload.formula_used.runtime).toBe("python_batch");
    expect(payload.formula_used.components).toContain("log_log_spend_efficiency_regression");
    expect(payload.formula_used.components).toContain("lightweight_adstock_ridge_mmm_incrementality");
  });

  it("normalizes model_runs rows into typed statistical run rows", () => {
    const row = normalizeDataAnalystStatisticalModelRunRow({
      id: "run-1",
      client_id: "client-1",
      model_name: "data_analyst_statistical_upgrade",
      model_version: "v1",
      input_json: { source: "local_batch" },
      output_json: output,
      formula_used: { engine: output.engine_version },
      generated_at: "2026-07-15T01:00:00Z",
      generated_by: "python_batch_data_analyst_statistical_upgrade",
      am_approved: true,
      am_override: false,
    });

    expect(row.id).toBe("run-1");
    expect(row.output_json.retention_curve?.r_squared).toBe(0.91);
    expect(row.am_approved).toBe(true);
    expect(row.am_override).toBe(false);
    expect(row.override_reason).toBeNull();
  });
});
