import { describe, expect, it, vi } from "vitest";
import {
  buildProfitFirstMediaBuyingInput,
  buildSpendEfficiencyFrontierInput,
  normalizeSpendingPowerSnapshotRow,
  normalizeSpendHistory,
  toProfitFirstMediaBuyingModelRunPayload,
  toSpendHistoryPoint,
  toSpendingPowerV1SnapshotPayload,
  toSpendingPowerV2ModelRunPayload,
  type SpendingPowerBasketEconomics,
  type SpendingPowerFinancialInput,
} from "./spendingPowerController";
import { runProfitFirstMediaBuying } from "./profitFirstMediaBuying";
import { runSpendingPowerV2 } from "./spendingPowerV2";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const financialInput: SpendingPowerFinancialInput = {
  id: "fi-1",
  client_id: "client-1",
  gross_margin_percent: 60,
  target_cac: 40,
  target_mer: 3,
  target_roas: 3,
};

const basket: SpendingPowerBasketEconomics = {
  id: "basket-1",
  client_id: "client-1",
  aov_new: 100,
  aov_repeat: null,
  avg_order_value: 95,
  cac_new: null,
  cac_repeat: 12,
  conversion_rate: 0.03,
  repeat_cycle_months: 3,
  churn_per_cycle: 0.4,
  basket_gross_margin_percent: 58,
  inventory_days: 25,
  payout_delay_days: 3,
};

describe("spending power controller", () => {
  it("normalizes stored snapshot history and numeric fields", () => {
    const snapshot = normalizeSpendingPowerSnapshotRow({
      id: "snap-1",
      client_id: "client-1",
      cash_available: "30000",
      monthly_burn: "5000",
      model_type: "V2_REGRESSION",
      risks: ["risk"],
      conditions: ["condition"],
      spending_history: [
        { spend: "1000", cac: "35", mer: "2.8", new_customer_revenue: "2800" },
        { spend: "", cac: "x" },
      ],
    });

    expect(snapshot.cash_available).toBe(30000);
    expect(snapshot.monthly_burn).toBe(5000);
    expect(snapshot.spending_history).toEqual([
      { spend: 1000, cac: 35, mer: 2.8, new_customer_revenue: 2800 },
    ]);
    expect(snapshot.risks).toEqual(["risk"]);
  });

  it("builds v1 threshold snapshot payloads outside the React page", () => {
    const payload = toSpendingPowerV1SnapshotPayload("client-1", {
      period_label: " Nov 2026 ",
      cash_available: "30000",
      monthly_burn: "5000",
      target_roas: "",
    }, financialInput);

    expect(payload.period_label).toBe("Nov 2026");
    expect(payload.model_type).toBe("V1_THRESHOLD");
    expect(payload.runway_months).toBe(6);
    expect(payload.max_monthly_ad_spend).toBe(4167);
    expect(payload.recommended_monthly_ad_spend).toBe(2917);
  });

  it("validates and normalizes manual history rows", () => {
    expect(toSpendHistoryPoint({
      spend: "1500",
      cac: "",
      mer: "2.5",
      new_customer_revenue: "3750",
    })).toEqual({
      spend: 1500,
      cac: null,
      mer: 2.5,
      new_customer_revenue: 3750,
    });

    expect(() => toSpendHistoryPoint({ spend: "0", cac: "", mer: "", new_customer_revenue: "" })).toThrow("Spend requis");
    expect(normalizeSpendHistory([{ spend: 0 }, { spend: 100, cac: 10 }])).toEqual([
      { spend: 100, cac: 10, mer: null, new_customer_revenue: null },
    ]);
  });

  it("builds spend efficiency frontier inputs from NCR history", () => {
    const input = buildSpendEfficiencyFrontierInput({
      history: [
        { spend: 1000, cac: 20, mer: 2.1, new_customer_revenue: 2100 },
        { spend: 2000, cac: 25, mer: 2.0, new_customer_revenue: null },
      ],
      objective: "MAX_FIRST_ORDER_CONTRIBUTION",
      financialInput,
      basket,
      ltvMultiplier: "1.5",
      plannedSpend: "3000",
      minFirstOrderContribution: "",
    });

    expect(input.history).toEqual([{ period: "P1", spend: 1000, new_customer_revenue: 2100 }]);
    expect(input.gross_margin_rate).toBe(60);
    expect(input.ltv_revenue_multiplier).toBe(1.5);
  });

  it("builds PFMB input from latest basket, financial input, and cash snapshot", () => {
    const input = buildProfitFirstMediaBuyingInput({
      plannedSpend: "5000",
      monthlySessions: "60000",
      history: [{ spend: 1000, cac: 35, mer: 2.8, new_customer_revenue: 2800 }],
      basket,
      financialInput,
      latestSnapshot: normalizeSpendingPowerSnapshotRow({
        id: "snap-1",
        client_id: "client-1",
        cash_available: 30000,
        monthly_burn: 5000,
      }),
    });

    expect(input.planned_spend).toBe(5000);
    expect(input.funnel.monthly_sessions).toBe(60000);
    expect(input.cohort.aov_repeat).toBe(95);
    expect(input.cohort.cac_new).toBe(40);
    expect(input.cash.inventory_days).toBe(25);
  });

  it("builds auditable model run payloads for v2 and PFMB", () => {
    const v2Input = {
      history: [{ spend: 1000, cac: 35, mer: 2.8 }],
      planned_spend: 5000,
      target_cac: 40,
      target_mer: 3,
      cash_available: 30000,
      monthly_burn: 5000,
      gross_margin_pct: 60,
    };
    const v2Output = runSpendingPowerV2(v2Input);
    const v2Payload = toSpendingPowerV2ModelRunPayload("client-1", v2Input, v2Output);

    const pfmbInput = buildProfitFirstMediaBuyingInput({
      plannedSpend: "5000",
      monthlySessions: "60000",
      history: v2Input.history,
      basket,
      financialInput,
      latestSnapshot: normalizeSpendingPowerSnapshotRow({
        id: "snap-1",
        client_id: "client-1",
        cash_available: 30000,
        monthly_burn: 5000,
      }),
    });
    const pfmbOutput = runProfitFirstMediaBuying(pfmbInput);
    const pfmbPayload = toProfitFirstMediaBuyingModelRunPayload("client-1", pfmbInput, pfmbOutput, basket.id);

    expect(v2Payload.model_name).toBe("spending_power_engine_v2");
    expect(v2Payload.formula_used.backtest).toBe("leave-one-out");
    expect(pfmbPayload.model_name).toBe("profit_first_media_buying");
    expect(pfmbPayload.input_json.basket_id).toBe("basket-1");
    expect(pfmbPayload.output_json.engine_version).toBe("profit_first_media_buying_v1");
  });
});
