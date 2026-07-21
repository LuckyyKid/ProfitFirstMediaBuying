import { describe, expect, it } from "vitest";
import { ltvNewOverHorizon, runProfitFirstMediaBuying, type ProfitFirstInput } from "./profitFirstMediaBuying";

const baseInput: ProfitFirstInput = {
  planned_spend: 5000,
  history: [],
  cohort: {
    aov_new: 100,
    aov_repeat: 100,
    cac_new: 40,
    cac_repeat: 5,
    conversion_rate: 0.03,
    repeat_cycle_months: 3,
    churn_per_cycle: 0.4,
    gross_margin_pct: 60,
  },
  cash: {
    cash_available: 100000,
    monthly_burn: 10000,
    inventory_days: 10,
    payout_delay_days: 3,
    safety_months: 3,
  },
  funnel: {
    monthly_sessions: 3000,
    sessions_per_dollar: 0.5,
  },
  target_cac: 50,
  target_mer: 2,
};

describe("profitFirstMediaBuying", () => {
  it("locks inventory cash at COGS value, not retail revenue", () => {
    const out = runProfitFirstMediaBuying(baseInput);

    // 3000 sessions * 3% CVR = 90 orders/month.
    // Weighted AOV 100 => 300/day revenue. Gross margin 60% => COGS 40%.
    // 300 * 40% * 10 days = 1200 inventory cash locked.
    expect(out.cash_locked_inventory).toBe(1200);
  });

  it("calculates LTV before first acquisition CAC and reports net LTV separately", () => {
    const ltv = ltvNewOverHorizon({
      ...baseInput.cohort,
      aov_repeat: 0,
      cac_repeat: 0,
      repeat_cycle_months: 12,
      churn_per_cycle: 1,
      gross_margin_pct: 50,
    }, 12);

    const out = runProfitFirstMediaBuying({
      ...baseInput,
      cohort: {
        ...baseInput.cohort,
        aov_repeat: 0,
        cac_repeat: 0,
        repeat_cycle_months: 12,
        churn_per_cycle: 1,
        gross_margin_pct: 50,
      },
    });

    expect(ltv).toBe(50);
    expect(out.ltv_new_horizon).toBe(50);
    expect(out.ltv_new_net_horizon).toBe(10);
  });

  it("caps planned orders by funnel capacity", () => {
    const out = runProfitFirstMediaBuying({
      ...baseInput,
      planned_spend: 20000,
      cohort: { ...baseInput.cohort, conversion_rate: 0.01 },
      funnel: { monthly_sessions: 1000, sessions_per_dollar: 0.1 },
    });

    expect(out.max_orders_by_funnel).toBe(10);
    expect(out.max_orders_by_spend).toBe(20);
    expect(out.planned_orders).toBe(10);
    expect(out.binding_constraint).toBe("FUNNEL");
    expect(out.recommended_spend).toBeLessThanOrEqual(out.max_spend_by_funnel);
  });

  it("accepts percent and decimal rate inputs equivalently", () => {
    const decimalOut = runProfitFirstMediaBuying(baseInput);
    const percentOut = runProfitFirstMediaBuying({
      ...baseInput,
      cohort: {
        ...baseInput.cohort,
        conversion_rate: 3,
        churn_per_cycle: 40,
        gross_margin_pct: 60,
      },
    });

    expect(percentOut.max_orders_by_funnel).toBe(decimalOut.max_orders_by_funnel);
    expect(percentOut.cash_locked_inventory).toBe(decimalOut.cash_locked_inventory);
  });
});
