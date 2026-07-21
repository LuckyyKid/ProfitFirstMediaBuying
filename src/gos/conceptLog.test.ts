import { describe, expect, it } from "vitest";
import {
  computeConceptDerivedMetrics,
  evaluateConceptOperationalReadiness,
  runConceptLogOperationalPlan,
  type ConceptLogEntry,
} from "./conceptLog";

function concept(overrides: Partial<ConceptLogEntry> = {}): ConceptLogEntry {
  return {
    id: "concept-1",
    client_id: "client-1",
    objective_id: null,
    concept_name: "Proof concept",
    angle: "social-proof",
    hypothesis: "Proof-led copy should improve conversion.",
    audience: "prospecting",
    format: "video-short",
    platform: "meta",
    offer: "Core Bundle",
    landing_page_url: "https://example.com/core",
    primary_copy: "A proof-led concept for the core bundle.",
    bid_strategy: "cost-cap",
    cost_cap: 40,
    expected_daily_spend: 100,
    campaign_link_url: null,
    ads_per_concept: 4,
    status: "in_review",
    launch_date: "2026-07-01",
    end_date: "2026-07-31",
    spend: 500,
    impressions: 50_000,
    clicks: 1_000,
    orders: 20,
    revenue: 2_000,
    cpa: null,
    ctr: null,
    verdict: null,
    learning: null,
    next_action: null,
    tags: null,
    ...overrides,
  };
}

describe("concept log operational model", () => {
  it("computes concept metrics without UI formulas", () => {
    const metrics = computeConceptDerivedMetrics(concept());

    expect(metrics.cpa).toBe(25);
    expect(metrics.ctr).toBe(2);
    expect(metrics.roas).toBe(4);
    expect(metrics.aov).toBe(100);
  });

  it("flags missing operational fields before a concept enters campaign planning", () => {
    const readiness = evaluateConceptOperationalReadiness(concept({
      offer: null,
      landing_page_url: null,
      primary_copy: null,
      expected_daily_spend: null,
      ads_per_concept: null,
    }));

    expect(readiness.ready_for_campaign_plan).toBe(false);
    expect(readiness.stage).toBe("INCOMPLETE");
    expect(readiness.missing_fields).toEqual(expect.arrayContaining([
      "offer",
      "landing_page_url",
      "primary_copy",
      "expected_daily_spend",
      "ads_per_concept",
    ]));
  });

  it("builds a portfolio coverage summary for the Profit Plan", () => {
    const output = runConceptLogOperationalPlan({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      planned_monthly_spend: 5_000,
      minimum_ready_concepts: 1,
      concepts: [concept()],
    });

    expect(output.engine_version).toBe("concept_log_operational_v1");
    expect(output.portfolio.ready_concepts).toBe(1);
    expect(output.portfolio.planned_ads).toBe(4);
    expect(output.portfolio.expected_period_spend).toBe(3_100);
    expect(output.portfolio.spend_coverage_rate).toBe(0.62);
    expect(output.risks.join(" ")).toContain("less than 80%");
  });
});
