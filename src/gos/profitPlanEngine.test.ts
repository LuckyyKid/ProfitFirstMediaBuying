import { describe, expect, it } from "vitest";
import {
  runProfitPlanEngine,
  type ProfitPlanEngineInput,
  type ProfitPlanDayPlan,
} from "./profitPlanEngine";

function baseInput(): ProfitPlanEngineInput {
  return {
    client_id: "client-1",
    plan_name: "July Profit Plan",
    period_start: "2026-07-01",
    planned_spend: 5_000,
    profit_first: {
      history: [
        { spend: 1_000, cac: 32, mer: 3.2 },
        { spend: 2_000, cac: 36, mer: 3 },
        { spend: 4_000, cac: 42, mer: 2.7 },
        { spend: 6_000, cac: 49, mer: 2.4 },
      ],
      cohort: {
        aov_new: 120,
        aov_repeat: 90,
        cac_new: 42,
        cac_repeat: 8,
        conversion_rate: 0.03,
        repeat_cycle_months: 3,
        churn_per_cycle: 0.35,
        gross_margin_pct: 60,
      },
      cash: {
        cash_available: 100_000,
        monthly_burn: 10_000,
        inventory_days: 14,
        payout_delay_days: 3,
        safety_months: 3,
      },
      funnel: {
        monthly_sessions: 3_000,
        sessions_per_dollar: 0.5,
      },
      target_cac: 50,
      target_mer: 2.2,
      horizon_months: 12,
    },
    spend_efficiency: {
      history: [
        { period: "2026-03", spend: 1_000, new_customer_revenue: 4_000 },
        { period: "2026-04", spend: 2_000, new_customer_revenue: 7_200 },
        { period: "2026-05", spend: 4_000, new_customer_revenue: 12_000 },
        { period: "2026-06", spend: 6_000, new_customer_revenue: 16_200 },
      ],
      objective: "CUSTOM_SPEND",
      gross_margin_rate: 60,
      target_spend: 5_000,
    },
    customer_transactions: [
      { customer_id: "A", transaction_date: "2026-05-04", order_id: "1", revenue: 120, gross_profit: 72, acquisition_channel: "meta" },
      { customer_id: "B", transaction_date: "2026-05-10", order_id: "2", revenue: 100, gross_profit: 60, acquisition_channel: "google" },
      { customer_id: "A", transaction_date: "2026-06-08", order_id: "3", revenue: 90, gross_profit: 54, acquisition_channel: "meta" },
    ],
    creative_demand: {
      avg_cpm: 10,
      fatigue_threshold_impressions: 150_000,
      minimum_creatives: 2,
    },
    day_weight_preset: "ecom_b2c",
  };
}

function sum(rows: ProfitPlanDayPlan[], key: keyof ProfitPlanDayPlan): number {
  return Number(rows.reduce((total, row) => total + Number(row[key] ?? 0), 0).toFixed(2));
}

describe("profit plan engine", () => {
  it("builds a monthly and daily Profit Plan from existing deterministic engines", () => {
    const output = runProfitPlanEngine(baseInput());

    expect(output.engine_version).toBe("profit_plan_engine_v1");
    expect(output.period_start).toBe("2026-07-01");
    expect(output.period_end).toBe("2026-07-31");
    expect(output.month.planned_ad_spend).toBe(5_000);
    expect(output.days).toHaveLength(31);
    expect(output.weeks).toHaveLength(5);
    expect(output.sources.profit_first_media_buying.engine_version).toBe("profit_first_media_buying_v1");
    expect(output.sources.spend_efficiency_frontier?.engine_version).toBe("spend_efficiency_frontier_v1");
    expect(output.sources.three_cohort_forecast?.engine_version).toBe("three_cohort_forecast_v1");
    expect(output.sources.customer_cohorts?.acquisition_cohorts).toHaveLength(1);
    expect(output.sources.creative_demand.engine_version).toBe("creative_demand_v1");
    expect(output.unit_economics.break_even_cac).toBe(72);
    expect(output.cohort_summary.latest_active_customers).toBe(1);
    expect(output.month.planned_returning_revenue).toBe(
      output.sources.three_cohort_forecast?.totals.projected_returning_revenue,
    );

    expect(sum(output.days, "target_ad_spend")).toBe(output.month.planned_ad_spend);
    expect(sum(output.days, "target_revenue")).toBe(output.month.planned_revenue);
    expect(sum(output.days, "target_gross_profit")).toBe(output.month.planned_gross_profit);
    expect(sum(output.days, "target_contribution_margin")).toBe(output.month.planned_contribution_margin);
    expect(sum(output.days, "target_orders")).toBe(output.month.planned_orders);
    expect(sum(output.days, "target_new_customers")).toBe(output.month.planned_new_customers);
  });

  it("keeps producing a plan when spend frontier data is missing", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      spend_efficiency: null,
    });

    expect(output.sources.spend_efficiency_frontier).toBeNull();
    expect(output.missing_data).toContain("spend_efficiency");
    expect(output.conditions.join(" ")).toContain("spend frontier");
    expect(output.month.planned_ad_spend).toBeGreaterThan(0);
  });

  it("surfaces missing margin instead of hiding it as profitable output", () => {
    const input = baseInput();
    const output = runProfitPlanEngine({
      ...input,
      profit_first: {
        ...input.profit_first,
        cohort: {
          ...input.profit_first.cohort,
          gross_margin_pct: 0,
        },
      },
      spend_efficiency: {
        ...input.spend_efficiency!,
        gross_margin_rate: 0,
      },
    });

    expect(output.missing_data).toContain("profit_first.cohort.gross_margin_pct");
    expect(output.missing_data).toContain("spend_efficiency.contribution_margin_rate");
    expect(output.missing_data).toContain("three_cohort_forecast.gross_margin_rate");
    expect(output.sources.three_cohort_forecast?.cohorts.new_customers.projected_gross_profit).toBe(0);
    expect(output.month.planned_gross_profit).toBeGreaterThan(0);
    expect(output.risks.join(" ")).toContain("Gross margin");
  });

  it("uses offer unit economics as the Profit Plan target source when provided", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      unit_economics_targets: {
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
      },
    });

    expect(output.sources.unit_economics_targets?.engine_version).toBe("unit_economics_target_engine_v1");
    expect(output.unit_economics.source).toBe("unit_economics_target_engine");
    expect(output.unit_economics.break_even_cac).toBe(45);
    expect(output.unit_economics.target_cac).toBe(35);
    expect(output.unit_economics.target_mer).toBe(2.86);
    expect(output.month.target_cac).toBe(35);
    expect(output.month.target_mer).toBe(2.86);
  });

  it("translates Profit Plan business targets into attribution-window media targets", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      attribution_targets: {
        no_view_through: true,
        channels: [
          {
            channel_name: "Meta",
            platform: "meta",
            reporting_window: "7_DAY_CLICK",
            click_7d_to_28d_ratio: 0.8,
            delayed_attribution_multiplier: 0.9,
          },
        ],
      },
    });

    expect(output.sources.attribution_targets?.engine_version).toBe("attribution_target_engine_v1");
    expect(output.sources.attribution_targets?.channels[0].planned_spend).toBe(5_000);
    expect(output.sources.attribution_targets?.channels[0].business_target_amr).toBe(2.2);
    expect(output.sources.attribution_targets?.channels[0].business_target_cac).toBe(50);
    expect(output.sources.attribution_targets?.channels[0].total_attribution_multiplier).toBe(0.72);
    expect(output.sources.attribution_targets?.channels[0].platform_target_amr).toBe(1.58);
    expect(output.sources.attribution_targets?.channels[0].platform_target_cac).toBe(69.44);
    expect(output.month.target_mer).toBe(2.2);
  });

  it("adds channel allocation targets with incrementality factors to the Profit Plan", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      channel_allocation: {
        channels: [
          {
            channel_name: "Meta",
            platform: "meta",
            allocation_weight: 3,
            incrementality_factor: 0.7,
          },
          {
            channel_name: "Google",
            platform: "google",
            allocation_weight: 2,
            incrementality_factor: 0.9,
          },
        ],
      },
    });

    expect(output.sources.channel_allocation?.engine_version).toBe("channel_allocation_v1");
    expect(output.sources.channel_allocation?.portfolio.allocated_spend).toBe(output.month.planned_ad_spend);
    expect(output.sources.channel_allocation?.portfolio.weighted_incrementality_factor).toBe(0.78);
    expect(output.sources.channel_allocation?.channels[0].allocated_spend).toBe(3_000);
    expect(output.sources.channel_allocation?.channels[0].incremental_target_amr).toBe(1.54);
    expect(output.sources.channel_allocation?.channels[0].required_platform_amr).toBe(3.14);
    expect(output.assumptions.channel_allocation_formula).toContain("incrementality_factor");
    expect(sum(output.days, "target_ad_spend")).toBe(output.month.planned_ad_spend);
  });

  it("builds campaign-level daily targets from channel allocation and campaign inputs", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      day_weights: [1, 1, 1, 1, 1, 1, 1],
      channel_allocation: {
        channels: [
          {
            channel_name: "Meta",
            platform: "meta",
            allocation_weight: 3,
            incrementality_factor: 0.75,
          },
          {
            channel_name: "Google",
            platform: "google",
            allocation_weight: 2,
            incrementality_factor: 1,
          },
        ],
      },
      campaign_daily_plan: {
        campaigns: [
          {
            campaign_id: "meta-prospecting",
            campaign_name: "Meta Prospecting",
            platform: "meta",
            allocation_weight: 2,
          },
          {
            campaign_id: "meta-retargeting",
            campaign_name: "Meta Retargeting",
            platform: "meta",
            allocation_weight: 1,
          },
          {
            campaign_id: "google-search",
            campaign_name: "Google Search",
            platform: "google",
            current_daily_budget: 100,
          },
        ],
      },
    });

    const campaignPlan = output.sources.campaign_daily_plan;
    const metaProspecting = campaignPlan?.campaigns.find((campaign) => campaign.campaign_id === "meta-prospecting");
    const firstMetaProspectingDay = campaignPlan?.days.find((row) => (
      row.campaign_id === "meta-prospecting" && row.plan_date === "2026-07-01"
    ));

    expect(campaignPlan?.engine_version).toBe("campaign_daily_plan_v1");
    expect(campaignPlan?.portfolio.allocated_campaign_spend).toBe(output.month.planned_ad_spend);
    expect(campaignPlan?.portfolio.day_count).toBe(output.days.length);
    expect(campaignPlan?.portfolio.row_count).toBe((campaignPlan?.campaigns.length ?? 0) * output.days.length);
    expect(metaProspecting?.monthly_target_spend).toBe(2_000);
    expect(firstMetaProspectingDay?.target_spend).toBeGreaterThan(0);
    expect(output.assumptions.campaign_daily_plan_formula).toContain("campaign allocation share");
  });

  it("adds Concept Log operational readiness to the Profit Plan", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      concept_log: {
        minimum_ready_concepts: 1,
        concepts: [
          {
            id: "concept-1",
            client_id: "client-1",
            objective_id: null,
            concept_name: "Bundle proof ad",
            angle: "social-proof",
            hypothesis: "Proof-led copy should increase acquisition quality.",
            audience: "prospecting",
            format: "video-short",
            platform: "meta",
            offer: "Core Bundle",
            landing_page_url: "https://example.com/bundle",
            primary_copy: "Customers are switching because the bundle solves the full routine.",
            bid_strategy: "cost-cap",
            cost_cap: 45,
            expected_daily_spend: 100,
            campaign_link_url: null,
            ads_per_concept: 4,
            status: "in_review",
            launch_date: "2026-07-01",
            end_date: "2026-07-31",
            spend: 0,
            impressions: 0,
            clicks: 0,
            orders: 0,
            revenue: 0,
            cpa: null,
            ctr: null,
            verdict: null,
            learning: null,
            next_action: null,
            tags: null,
          },
        ],
      },
    });

    expect(output.sources.concept_log?.engine_version).toBe("concept_log_operational_v1");
    expect(output.sources.concept_log?.portfolio.ready_concepts).toBe(1);
    expect(output.sources.concept_log?.portfolio.planned_ads).toBe(4);
    expect(output.assumptions.concept_log_formula).toContain("expected spend coverage");
  });

  it("injects planned events into daily Profit Plan pacing without changing monthly totals", () => {
    const output = runProfitPlanEngine({
      ...baseInput(),
      day_weights: [1, 1, 1, 1, 1, 1, 1],
      event_daily_plan: {
        events: [
          {
            event_name: "Founders launch",
            event_type: "LAUNCH",
            start_date: "2026-07-15",
            end_date: "2026-07-15",
            expected_lift_pct: 100,
          },
        ],
      },
    });

    const eventDay = output.days.find((row) => row.plan_date === "2026-07-15");
    const normalDay = output.days.find((row) => row.plan_date === "2026-07-14");

    expect(output.sources.event_daily_plan?.engine_version).toBe("event_daily_plan_v1");
    expect(output.sources.event_daily_plan?.events[0].event_name).toBe("Founders launch");
    expect(output.assumptions.daily_weight_source).toBe("custom+event_daily_plan");
    expect(eventDay?.pacing_weight).toBeGreaterThan(normalDay?.pacing_weight ?? 0);
    expect(sum(output.days, "target_ad_spend")).toBe(output.month.planned_ad_spend);
    expect(sum(output.days, "target_revenue")).toBe(output.month.planned_revenue);
    expect(sum(output.days, "target_orders")).toBe(output.month.planned_orders);
  });
});
