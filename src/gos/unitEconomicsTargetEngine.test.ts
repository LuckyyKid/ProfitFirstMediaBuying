import { describe, expect, it } from "vitest";
import { runUnitEconomicsTargetEngine } from "./unitEconomicsTargetEngine";

describe("unit economics target engine", () => {
  it("computes offer-level break-even and target CAC from landed costs", () => {
    const output = runUnitEconomicsTargetEngine({
      planned_ad_spend: 350,
      offers: [
        {
          offer_name: "Core Bundle",
          sku: "CORE",
          price: 100,
          cogs_per_order: 35,
          shipping_cost_per_order: 8,
          fulfillment_cost_per_order: 4,
          payment_fee_rate: 0.03,
          refund_rate: 0.05,
          desired_contribution_per_order: 10,
          expected_orders: 20,
        },
      ],
    });

    expect(output.engine_version).toBe("unit_economics_target_engine_v1");
    expect(output.offers[0].contribution_before_ads_per_order).toBe(45);
    expect(output.offers[0].break_even_cac).toBe(45);
    expect(output.offers[0].target_cac).toBe(35);
    expect(output.offers[0].target_roas).toBe(2.86);
    expect(output.portfolio.weighted_target_cac).toBe(35);
    expect(output.portfolio.weighted_target_amr).toBe(2.86);
    expect(output.portfolio.planned_orders_at_target_cac).toBe(10);
    expect(output.portfolio.planned_revenue_at_target_cac).toBe(1_000);
    expect(output.portfolio.planned_contribution_after_ads_at_target_cac).toBe(100);
    expect(output.portfolio.expected_ad_spend_capacity).toBe(700);
  });

  it("uses gross margin and default cost assumptions when direct COGS is unavailable", () => {
    const output = runUnitEconomicsTargetEngine({
      default_shipping_cost_per_order: 5,
      default_fulfillment_cost_per_order: 5,
      default_payment_processing_percent: 2.5,
      default_refund_rate_percent: 5,
      default_desired_contribution_margin_rate: 0.1,
      offers: [
        {
          offer_name: "Starter Offer",
          aov: 80,
          gross_margin_percent: 50,
          expected_revenue_mix: 1,
        },
      ],
    });

    expect(output.offers[0].cogs_per_order).toBe(40);
    expect(output.offers[0].payment_fee_per_order).toBe(2);
    expect(output.offers[0].refund_reserve_per_order).toBe(4);
    expect(output.offers[0].contribution_before_ads_per_order).toBe(24);
    expect(output.offers[0].desired_contribution_per_order).toBe(8);
    expect(output.offers[0].target_cac).toBe(16);
    expect(output.offers[0].target_roas).toBe(5);
    expect(output.missing_data).toEqual([]);
  });

  it("weights portfolio targets by expected orders when available", () => {
    const output = runUnitEconomicsTargetEngine({
      offers: [
        {
          offer_name: "Offer A",
          price: 100,
          cogs_per_order: 35,
          shipping_cost_per_order: 8,
          fulfillment_cost_per_order: 4,
          payment_fee_rate: 0.03,
          refund_rate: 0.05,
          desired_contribution_per_order: 10,
          expected_orders: 20,
        },
        {
          offer_name: "Offer B",
          price: 150,
          gross_margin_rate: 0.5,
          shipping_cost_per_order: 10,
          fulfillment_cost_per_order: 5,
          payment_fee_rate: 0.02,
          refund_rate: 0.04,
          desired_contribution_margin_rate: 0.1,
          expected_orders: 10,
        },
      ],
    });

    expect(output.portfolio.weight_source).toBe("expected_orders");
    expect(output.offers[0].portfolio_weight).toBe(0.6667);
    expect(output.offers[1].portfolio_weight).toBe(0.3333);
    expect(output.portfolio.weighted_revenue_per_order).toBe(116.67);
    expect(output.portfolio.weighted_target_cac).toBe(35.33);
    expect(output.portfolio.weighted_target_roas).toBe(3.3);
    expect(output.portfolio.expected_orders).toBe(30);
  });

  it("surfaces missing source economics without producing NaN or infinite targets", () => {
    const output = runUnitEconomicsTargetEngine({
      planned_ad_spend: 1_000,
      offers: [{ offer_name: "Incomplete Offer" }],
    });

    expect(output.missing_data).toContain("offers[0].aov_or_price");
    expect(output.missing_data).toContain("offers[0].cogs_per_order_or_gross_margin_rate");
    expect(output.portfolio.weighted_target_cac).toBeNull();
    expect(output.portfolio.weighted_target_roas).toBeNull();
    expect(output.portfolio.planned_orders_at_target_cac).toBeNull();
    expect(output.offers[0].target_cac).toBe(0);
    expect(Number.isFinite(output.confidence_score)).toBe(true);
  });
});
