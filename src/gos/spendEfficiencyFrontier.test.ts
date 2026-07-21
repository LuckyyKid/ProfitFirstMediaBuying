import { describe, expect, it } from "vitest";
import { runSpendEfficiencyFrontier, type SpendEfficiencyHistoryPoint } from "./spendEfficiencyFrontier";

const history: SpendEfficiencyHistoryPoint[] = [
  { period: "2026-01", spend: 1000, new_customer_revenue: 4200 },
  { period: "2026-02", spend: 2000, new_customer_revenue: 7600 },
  { period: "2026-03", spend: 4000, new_customer_revenue: 12800 },
  { period: "2026-04", spend: 8000, new_customer_revenue: 22400 },
];

describe("spend efficiency frontier", () => {
  it("selects the point with the strongest first-order contribution", () => {
    const out = runSpendEfficiencyFrontier({
      history,
      objective: "MAX_FIRST_ORDER_CONTRIBUTION",
      gross_margin_rate: 55,
      ltv_revenue_multiplier: 1.4,
    });

    const bestContribution = Math.max(...out.frontier.map((point) => point.first_order_contribution));

    expect(out.fit.model_type).toBe("LOG_LINEAR_AMR");
    expect(out.selected.first_order_contribution).toBe(bestContribution);
    expect(out.selected.first_order_break_even).toBe(true);
    expect(out.break_even_amr).toBe(1.82);
  });

  it("can maximize new customer revenue only while first-order contribution remains viable", () => {
    const out = runSpendEfficiencyFrontier({
      history,
      objective: "MAX_NEW_CUSTOMER_REVENUE_AT_BREAK_EVEN",
      gross_margin_rate: 45,
      min_first_order_contribution: 0,
    });

    const viable = out.frontier.filter((point) => point.first_order_contribution >= 0);
    const highestViableRevenue = Math.max(...viable.map((point) => point.new_customer_revenue));

    expect(out.selected.new_customer_revenue).toBe(highestViableRevenue);
    expect(out.selected.first_order_contribution).toBeGreaterThanOrEqual(0);
  });

  it("uses lifetime contribution when the objective depends on LTV", () => {
    const firstOrder = runSpendEfficiencyFrontier({
      history,
      objective: "MAX_FIRST_ORDER_CONTRIBUTION",
      gross_margin_rate: 35,
      ltv_revenue_multiplier: 2,
    });
    const lifetime = runSpendEfficiencyFrontier({
      history,
      objective: "MAX_LIFETIME_CONTRIBUTION",
      gross_margin_rate: 35,
      ltv_revenue_multiplier: 2,
    });

    expect(lifetime.selected.lifetime_contribution).toBe(
      Math.max(...lifetime.frontier.map((point) => point.lifetime_contribution)),
    );
    expect(lifetime.recommended_spend).toBeGreaterThanOrEqual(firstOrder.recommended_spend);
  });

  it("normalizes cost-of-delivery percentages into contribution margin", () => {
    const out = runSpendEfficiencyFrontier({
      history,
      objective: "CUSTOM_SPEND",
      cost_of_delivery_rate: 60,
      target_spend: 3500,
    });

    expect(out.contribution_margin_rate).toBe(0.4);
    expect(out.selected.spend).toBeGreaterThan(0);
    expect(Number.isFinite(out.selected.first_order_contribution)).toBe(true);
  });

  it("falls back to historical average AMR with insufficient history", () => {
    const out = runSpendEfficiencyFrontier({
      history: [{ spend: 2000, new_customer_revenue: 6000 }],
      objective: "CUSTOM_SPEND",
      gross_margin_rate: 50,
      target_spend: 3000,
    });

    expect(out.fit.model_type).toBe("HISTORICAL_AVERAGE");
    expect(out.recommended_amr).toBe(3);
    expect(out.risks.join(" ")).toContain("Historique insuffisant");
  });

  it("surfaces extrapolation risk for custom spend beyond the modeled zone", () => {
    const out = runSpendEfficiencyFrontier({
      history,
      objective: "CUSTOM_SPEND",
      gross_margin_rate: 50,
      target_spend: 20000,
      max_extrapolation_ratio: 1.2,
    });

    expect(out.selected.spend).toBe(20000);
    expect(out.selected.extrapolation_risk).toBe("HIGH");
    expect(out.risks.join(" ")).toContain("zone extrapolable");
  });
});
