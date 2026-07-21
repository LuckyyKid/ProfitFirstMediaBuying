import { describe, expect, it } from "vitest";
import { projectGrowthScenario } from "./forecastProjection";

describe("projectGrowthScenario", () => {
  it("uses new customers for ecommerce CAC instead of orders", () => {
    const projection = projectGrowthScenario({
      client: { business_type: "ECOMMERCE" },
      financialInputs: { aov: 60, gross_margin_percent: 50, target_cac: 30 },
      quantitativeBaseline: {
        ad_spend_30d: 12000,
        orders_30d: 1000,
        new_customers_30d: 300,
      },
      scenario: "BASE",
      horizonDays: 30,
    });

    expect(projection.projected_cac).toBe(40);
    expect(projection.assumptions.historical_cost_per_order).toBe(12);
    expect(projection.projected_orders).toBe(1000);
  });

  it("keeps gross profit separate from contribution margin after ads", () => {
    const projection = projectGrowthScenario({
      client: { business_type: "ECOMMERCE" },
      financialInputs: { aov: 100, gross_margin_percent: 50 },
      quantitativeBaseline: {
        ad_spend_30d: 1000,
        orders_30d: 10,
        new_customers_30d: 5,
      },
      scenario: "BASE",
      horizonDays: 30,
    });

    expect(projection.projected_revenue).toBe(1000);
    expect(projection.projected_gross_profit).toBe(500);
    expect(projection.assumptions.contribution_margin_after_ads).toBe(-500);
  });

  it("uses avg_job_value for local service revenue", () => {
    const projection = projectGrowthScenario({
      client: { business_type: "LOCAL_SERVICE" },
      financialInputs: { avg_job_value: 500, aov: 100, gross_margin_percent: 40, target_cpl: 50 },
      quantitativeBaseline: {
        ad_spend_30d: 1000,
        leads_30d: 20,
        jobs_closed_30d: 10,
      },
      scenario: "BASE",
      horizonDays: 30,
    });

    expect(projection.projected_leads).toBe(20);
    expect(projection.projected_orders).toBe(10);
    expect(projection.projected_revenue).toBe(5000);
    expect(projection.projected_gross_profit).toBe(2000);
  });
});
