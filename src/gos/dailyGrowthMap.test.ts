import { describe, expect, it } from "vitest";
import { buildDailyGrowthMap, type DailyGrowthMapDailyInput } from "./dailyGrowthMap";

function day(partial: Partial<DailyGrowthMapDailyInput>): DailyGrowthMapDailyInput {
  return {
    client_id: "client-1",
    target_date: "2026-07-01",
    target_revenue: 1_000,
    target_new_customer_revenue: 700,
    target_returning_revenue: 300,
    target_ad_spend: 300,
    target_orders: 10,
    target_new_customers: 7,
    target_returning_orders: 3,
    target_leads: 40,
    target_gross_profit: 600,
    target_contribution_margin: 300,
    projection_revenue: 950,
    projection_ad_spend: 290,
    projection_orders: 9,
    projection_leads: 38,
    projection_gross_profit: 570,
    projection_contribution_margin: 280,
    actual_revenue: 900,
    actual_new_customer_revenue: 600,
    actual_returning_revenue: 300,
    actual_ad_spend: 250,
    actual_orders: 9,
    actual_new_customers: 6,
    actual_returning_orders: 3,
    actual_leads: 35,
    actual_gross_profit: 540,
    actual_contribution_margin: 290,
    ...partial,
  };
}

describe("daily growth map", () => {
  it("builds a 35+ metric hierarchy for daily profit execution", () => {
    const output = buildDailyGrowthMap({
      client_id: "client-1",
      scope: "mtd",
      as_of_date: "2026-07-04",
      days: [
        day({ target_date: "2026-07-01" }),
        day({
          target_date: "2026-07-02",
          actual_revenue: 1_100,
          actual_new_customer_revenue: 800,
          actual_ad_spend: 320,
          actual_orders: 11,
          actual_new_customers: 8,
          actual_leads: 42,
          actual_gross_profit: 660,
          actual_contribution_margin: 340,
        }),
        day({
          target_date: "2026-07-03",
          actual_revenue: null,
          actual_new_customer_revenue: null,
          actual_returning_revenue: null,
          actual_ad_spend: null,
          actual_orders: null,
          actual_new_customers: null,
          actual_returning_orders: null,
          actual_leads: null,
          actual_gross_profit: null,
          actual_contribution_margin: null,
        }),
      ],
    });

    const contribution = output.metrics.find((metric) => metric.key === "contribution_margin");
    const revenue = output.metrics.find((metric) => metric.key === "revenue");
    const spend = output.metrics.find((metric) => metric.key === "ad_spend");

    expect(output.engine_version).toBe("daily_growth_map_v1");
    expect(output.portfolio.base_metric_count).toBeGreaterThanOrEqual(40);
    expect(output.metrics.length).toBeGreaterThanOrEqual(35);
    expect(contribution?.parent_key).toBeNull();
    expect(contribution?.children_count).toBeGreaterThan(0);
    expect(revenue?.parent_key).toBe("contribution_margin");
    expect(spend?.parent_key).toBe("contribution_margin");
    expect(output.portfolio.actual_coverage_rate).toBeCloseTo(0.6667, 4);
  });

  it("keeps actual contribution missing when actual gross profit is missing", () => {
    const output = buildDailyGrowthMap({
      client_id: "client-1",
      scope: "mtd",
      as_of_date: "2026-07-03",
      days: [
        day({
          target_date: "2026-07-01",
          actual_gross_profit: null,
          actual_contribution_margin: null,
        }),
      ],
    });

    const contribution = output.metrics.find((metric) => metric.key === "contribution_margin");

    expect(contribution?.actual).toBeNull();
    expect(contribution?.status).toBe("MISSING");
    expect(output.missing_data).toContain("actual_gross_profit");
  });

  it("adds channel and campaign metrics from the campaign daily plan", () => {
    const output = buildDailyGrowthMap({
      client_id: "client-1",
      scope: "mtd",
      as_of_date: "2026-07-03",
      days: [day({ target_date: "2026-07-01" })],
      campaign_days: [
        {
          campaign_id: "meta-1",
          campaign_name: "Meta Prospecting",
          platform: "meta",
          channel_name: "Meta",
          plan_date: "2026-07-01",
          target_spend: 100,
          platform_revenue_required: 280,
          platform_conversions_required: 2,
          actual_spend: 90,
          actual_revenue: 300,
          actual_orders: 3,
        },
      ],
    });

    expect(output.portfolio.channel_metric_count).toBeGreaterThan(0);
    expect(output.portfolio.campaign_metric_count).toBeGreaterThan(0);
    expect(output.metrics.some((metric) => metric.key.includes("amazon"))).toBe(false);
    expect(output.metrics.find((metric) => metric.key === "channel_campaign_execution")?.target).toBe(100);
  });
});
