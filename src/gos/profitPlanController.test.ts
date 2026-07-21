import { describe, expect, it, vi } from "vitest";
import {
  normalizeProfitPlanDayRow,
  normalizeProfitPlanMonthRow,
  normalizeProfitPlanRow,
  toProfitPlanDayInsertPayload,
  toProfitPlanInsertPayload,
  toProfitPlanMonthInsertPayload,
} from "./profitPlanController";
import { runProfitPlanEngine, type ProfitPlanEngineInput } from "./profitPlanEngine";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const input: ProfitPlanEngineInput = {
  client_id: "client-1",
  plan_name: "Controller Plan",
  period_start: "2026-07-01",
  planned_spend: 2_000,
  profit_first: {
    history: [
      { spend: 1_000, cac: 30, mer: 3.1 },
      { spend: 2_000, cac: 35, mer: 2.9 },
      { spend: 3_000, cac: 40, mer: 2.7 },
      { spend: 4_000, cac: 46, mer: 2.5 },
    ],
    cohort: {
      aov_new: 100,
      aov_repeat: 80,
      cac_new: 35,
      cac_repeat: 6,
      conversion_rate: 0.025,
      repeat_cycle_months: 3,
      churn_per_cycle: 0.35,
      gross_margin_pct: 55,
    },
    cash: {
      cash_available: 50_000,
      monthly_burn: 6_000,
      inventory_days: 10,
      payout_delay_days: 2,
    },
    funnel: {
      monthly_sessions: 40_000,
      sessions_per_dollar: 0.5,
    },
    target_cac: 45,
    target_mer: 2,
  },
  spend_efficiency: {
    history: [
      { spend: 1_000, new_customer_revenue: 3_400 },
      { spend: 2_000, new_customer_revenue: 6_000 },
      { spend: 3_000, new_customer_revenue: 8_400 },
    ],
    objective: "CUSTOM_SPEND",
    gross_margin_rate: 55,
    target_spend: 2_000,
  },
  creative_demand: {
    avg_cpm: 12,
    fatigue_threshold_impressions: 100_000,
  },
};

describe("profit plan controller mappers", () => {
  it("builds auditable plan, month, and day insert payloads", () => {
    const output = runProfitPlanEngine(input);
    const planPayload = toProfitPlanInsertPayload(input, output);
    const monthPayload = toProfitPlanMonthInsertPayload("plan-1", output.month);
    const dayPayload = toProfitPlanDayInsertPayload("plan-1", "month-1", output.days[0]);

    expect(planPayload.client_id).toBe("client-1");
    expect(planPayload.engine_version).toBe("profit_plan_engine_v1");
    expect(planPayload.input_json.plan_name).toBe("Controller Plan");
    expect(planPayload.output_json.month).toBeDefined();
    expect(monthPayload.profit_plan_id).toBe("plan-1");
    expect(monthPayload.output_json.planned_ad_spend).toBe(output.month.planned_ad_spend);
    expect(dayPayload.month_id).toBe("month-1");
    expect(dayPayload.plan_date).toBe("2026-07-01");
    expect(dayPayload.output_json.target_revenue).toBe(output.days[0].target_revenue);
  });

  it("normalizes persisted rows into typed Profit Plan records", () => {
    const output = runProfitPlanEngine(input);
    const plan = normalizeProfitPlanRow({
      id: "plan-1",
      client_id: "client-1",
      plan_name: "Controller Plan",
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      status: "DRAFT",
      engine_version: "profit_plan_engine_v1",
      input_json: input,
      output_json: output,
      summary: output.summary,
    });
    const month = normalizeProfitPlanMonthRow({
      id: "month-1",
      profit_plan_id: "plan-1",
      client_id: "client-1",
      month_start: "2026-07-01",
      month_end: "2026-07-31",
      planned_revenue: "6000.25",
      planned_ad_spend: "2000",
      planned_orders: "50",
      output_json: output.month,
    });
    const day = normalizeProfitPlanDayRow({
      id: "day-1",
      profit_plan_id: "plan-1",
      month_id: "month-1",
      client_id: "client-1",
      plan_date: "2026-07-01",
      day_of_week: "3",
      day_index: "1",
      pacing_weight: "0.0333",
      target_revenue: "200.50",
      target_orders: "2",
      status: "",
      output_json: output.days[0],
    });

    expect(plan.output_json.engine_version).toBe("profit_plan_engine_v1");
    expect(month.planned_revenue).toBe(6000.25);
    expect(month.planned_orders).toBe(50);
    expect(day.day_of_week).toBe(3);
    expect(day.target_revenue).toBe(200.5);
    expect(day.status).toBe("PLANNED");
  });
});
