import {
  runProfitPlanEngine,
  type ProfitPlanEngineInput,
} from "../src/gos/profitPlanEngine";
import {
  buildDailyGrowthMap,
  type DailyGrowthMapCampaignDayInput,
  type DailyGrowthMapDailyInput,
} from "../src/gos/dailyGrowthMap";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
}

function money(value: number | null | undefined): number {
  return Number((Number(value ?? 0)).toFixed(2));
}

function pct(value: number | null | undefined): number | null {
  return value == null ? null : Number((value * 100).toFixed(2));
}

function ecommerceScenario(): ProfitPlanEngineInput {
  return {
    client_id: "ecom-client-001",
    plan_name: "July Ecommerce Profit Run",
    period_start: "2026-07-01",
    planned_spend: 18_000,
    status: "DRAFT",
    profit_first: {
      history: [
        { spend: 8_000, cac: 38, mer: 3.2 },
        { spend: 11_000, cac: 41, mer: 3.05 },
        { spend: 14_000, cac: 44, mer: 2.82 },
        { spend: 17_000, cac: 48, mer: 2.62 },
      ],
      cohort: {
        aov_new: 118,
        aov_repeat: 82,
        cac_new: 44,
        cac_repeat: 9,
        conversion_rate: 0.028,
        repeat_cycle_months: 3,
        churn_per_cycle: 0.32,
        gross_margin_pct: 62,
      },
      cash: {
        cash_available: 300_000,
        monthly_burn: 25_000,
        inventory_days: 24,
        payout_delay_days: 4,
        safety_months: 2.5,
      },
      funnel: {
        monthly_sessions: 78_000,
        sessions_per_dollar: 1.15,
      },
      target_cac: 44,
      target_mer: 2.65,
      horizon_months: 12,
    },
    spend_efficiency: {
      history: [
        { period: "2026-03", spend: 8_000, new_customer_revenue: 28_000 },
        { period: "2026-04", spend: 11_000, new_customer_revenue: 35_750 },
        { period: "2026-05", spend: 14_000, new_customer_revenue: 42_700 },
        { period: "2026-06", spend: 17_000, new_customer_revenue: 48_450 },
      ],
      objective: "CUSTOM_SPEND",
      gross_margin_rate: 0.62,
      cost_of_delivery_rate: 0.08,
      ltv_revenue_multiplier: 1.42,
      target_spend: 18_000,
    },
    customer_transactions: [
      { customer_id: "C001", transaction_date: "2026-01-06", order_id: "1001", revenue: 130, gross_profit: 78, acquisition_channel: "meta" },
      { customer_id: "C002", transaction_date: "2026-02-11", order_id: "1002", revenue: 112, gross_profit: 67, acquisition_channel: "google" },
      { customer_id: "C003", transaction_date: "2026-03-02", order_id: "1003", revenue: 145, gross_profit: 87, acquisition_channel: "tiktok" },
      { customer_id: "C001", transaction_date: "2026-04-03", order_id: "1004", revenue: 86, gross_profit: 52, acquisition_channel: "email" },
      { customer_id: "C004", transaction_date: "2026-04-18", order_id: "1005", revenue: 121, gross_profit: 73, acquisition_channel: "meta" },
      { customer_id: "C005", transaction_date: "2026-05-08", order_id: "1006", revenue: 99, gross_profit: 59, acquisition_channel: "google" },
      { customer_id: "C003", transaction_date: "2026-05-26", order_id: "1007", revenue: 78, gross_profit: 47, acquisition_channel: "email" },
      { customer_id: "C006", transaction_date: "2026-06-04", order_id: "1008", revenue: 134, gross_profit: 80, acquisition_channel: "meta" },
      { customer_id: "C007", transaction_date: "2026-06-12", order_id: "1009", revenue: 118, gross_profit: 71, acquisition_channel: "google" },
      { customer_id: "C004", transaction_date: "2026-06-20", order_id: "1010", revenue: 91, gross_profit: 55, acquisition_channel: "email" },
      { customer_id: "C008", transaction_date: "2026-06-27", order_id: "1011", revenue: 156, gross_profit: 94, acquisition_channel: "tiktok" },
    ],
    unit_economics_targets: {
      planned_ad_spend: 18_000,
      offers: [
        {
          offer_name: "Core Bundle",
          sku: "CORE-BUNDLE",
          price: 118,
          cogs_per_order: 38,
          shipping_cost_per_order: 8,
          fulfillment_cost_per_order: 5,
          payment_fee_rate: 0.03,
          refund_rate: 0.04,
          desired_contribution_per_order: 14,
          expected_orders: 300,
        },
        {
          offer_name: "Starter Kit",
          sku: "STARTER",
          price: 78,
          cogs_per_order: 24,
          shipping_cost_per_order: 7,
          fulfillment_cost_per_order: 4,
          payment_fee_rate: 0.03,
          refund_rate: 0.05,
          desired_contribution_per_order: 9,
          expected_orders: 155,
        },
      ],
    },
    attribution_targets: {
      no_view_through: true,
      channels: [
        {
          channel_name: "Meta",
          platform: "meta",
          planned_spend: 10_800,
          reporting_window: "7_DAY_CLICK",
          click_7d_to_28d_ratio: 0.78,
          delayed_attribution_multiplier: 0.92,
        },
        {
          channel_name: "Google Search",
          platform: "google",
          planned_spend: 5_400,
          reporting_window: "28_DAY_CLICK",
          click_7d_to_28d_ratio: 1,
          delayed_attribution_multiplier: 0.97,
        },
        {
          channel_name: "TikTok",
          platform: "tiktok",
          planned_spend: 1_800,
          reporting_window: "7_DAY_CLICK",
          click_7d_to_28d_ratio: 0.7,
          delayed_attribution_multiplier: 0.9,
        },
      ],
    },
    channel_allocation: {
      default_incrementality_factor: 0.8,
      channels: [
        {
          channel_name: "Meta",
          platform: "meta",
          planned_spend: 10_800,
          incrementality_factor: 0.72,
        },
        {
          channel_name: "Google Search",
          platform: "google",
          planned_spend: 5_400,
          incrementality_factor: 0.88,
        },
        {
          channel_name: "TikTok",
          platform: "tiktok",
          planned_spend: 1_800,
          incrementality_factor: 0.62,
        },
      ],
    },
    campaign_daily_plan: {
      campaigns: [
        {
          campaign_id: "meta-prospecting",
          campaign_name: "Meta Prospecting - Core Bundle",
          platform: "meta",
          allocation_weight: 3,
        },
        {
          campaign_id: "meta-retargeting",
          campaign_name: "Meta Retargeting - Starter Kit",
          platform: "meta",
          allocation_weight: 1,
        },
        {
          campaign_id: "google-brand",
          campaign_name: "Google Brand/Search",
          platform: "google",
          allocation_weight: 2,
        },
        {
          campaign_id: "tiktok-test",
          campaign_name: "TikTok Creative Test",
          platform: "tiktok",
          allocation_weight: 1,
        },
      ],
    },
    concept_log: {
      minimum_ready_concepts: 2,
      concepts: [
        {
          id: "concept-core-proof",
          client_id: "ecom-client-001",
          objective_id: null,
          concept_name: "Core Bundle Proof",
          angle: "social-proof",
          hypothesis: "Proof-led messaging should lower CAC on cold traffic.",
          audience: "prospecting",
          format: "video-short",
          platform: "meta",
          offer: "Core Bundle",
          landing_page_url: "https://example.com/core",
          primary_copy: "Customers switch because the bundle solves the complete routine.",
          bid_strategy: "cost-cap",
          cost_cap: 48,
          expected_daily_spend: 420,
          campaign_link_url: "https://ads.example.com/meta-core",
          ads_per_concept: 5,
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
          tags: ["bundle", "proof"],
        },
        {
          id: "concept-starter-ugc",
          client_id: "ecom-client-001",
          objective_id: null,
          concept_name: "Starter Kit UGC",
          angle: "founder-demo",
          hypothesis: "Demo UGC should improve starter kit conversion.",
          audience: "prospecting",
          format: "ugc",
          platform: "tiktok",
          offer: "Starter Kit",
          landing_page_url: "https://example.com/starter",
          primary_copy: "Start with the simple kit customers reorder after 30 days.",
          bid_strategy: "lowest-cost",
          cost_cap: null,
          expected_daily_spend: 160,
          campaign_link_url: "https://ads.example.com/tiktok-starter",
          ads_per_concept: 3,
          status: "in_review",
          launch_date: "2026-07-08",
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
          tags: ["ugc", "starter"],
        },
      ],
    },
    event_daily_plan: {
      events: [
        {
          event_name: "Mid-month offer push",
          event_type: "PROMO",
          start_date: "2026-07-15",
          end_date: "2026-07-17",
          expected_lift_pct: 35,
          pre_event_days: 2,
          post_event_days: 2,
        },
      ],
    },
    creative_demand: {
      avg_cpm: 12,
      fatigue_threshold_impressions: 120_000,
      minimum_creatives: 5,
      mix: {
        static: 0.35,
        video: 0.4,
        ugc: 0.25,
      },
    },
    day_weight_preset: "ecom_b2c",
  };
}

const profitPlan = runProfitPlanEngine(ecommerceScenario());
const campaignPlan = profitPlan.sources.campaign_daily_plan;

if (process.env.DEBUG_ECOM_SMOKE === "1") {
  console.error(JSON.stringify({
    month: profitPlan.month,
    profit_first_recommended_spend: profitPlan.sources.profit_first_media_buying.recommended_spend,
    frontier_recommended_spend: profitPlan.sources.spend_efficiency_frontier?.recommended_spend,
    frontier_selected: profitPlan.sources.spend_efficiency_frontier?.selected,
    risks: profitPlan.risks,
    missing_data: profitPlan.missing_data,
  }, null, 2));
}

assert(profitPlan.engine_version === "profit_plan_engine_v1", "Profit Plan engine version");
assert(profitPlan.sources.profit_first_media_buying.engine_version === "profit_first_media_buying_v1", "PFMB present");
assert(profitPlan.sources.spend_efficiency_frontier?.engine_version === "spend_efficiency_frontier_v1", "Spend frontier present");
assert(profitPlan.sources.three_cohort_forecast?.engine_version === "three_cohort_forecast_v1", "Three-cohort forecast present");
assert(profitPlan.sources.unit_economics_targets?.engine_version === "unit_economics_target_engine_v1", "Unit economics present");
assert(profitPlan.sources.attribution_targets?.engine_version === "attribution_target_engine_v1", "Attribution target present");
assert(profitPlan.sources.channel_allocation?.engine_version === "channel_allocation_v1", "Channel allocation present");
assert(campaignPlan?.engine_version === "campaign_daily_plan_v1", "Campaign daily plan present");
assert(profitPlan.sources.concept_log?.engine_version === "concept_log_operational_v1", "Concept log operational present");
assert(profitPlan.sources.event_daily_plan?.engine_version === "event_daily_plan_v1", "Event daily plan present");
assert(profitPlan.sources.creative_demand.engine_version === "creative_demand_v1", "Creative demand present");

assert(profitPlan.days.length === 31, "July daily plan has 31 rows");
assert(profitPlan.month.planned_ad_spend > 0, "Executable spend is positive");
assert(profitPlan.month.planned_ad_spend <= 18_000, "Executable spend does not exceed requested spend");
assert(profitPlan.month.planned_revenue > profitPlan.month.planned_ad_spend, "Revenue exceeds ad spend");
assert(profitPlan.month.planned_contribution_margin > 0, "Contribution margin positive");
assert((profitPlan.sources.channel_allocation?.portfolio.allocated_spend ?? 0) === profitPlan.month.planned_ad_spend, "Channel allocation reconciles to spend");
assert((campaignPlan?.portfolio.allocated_campaign_spend ?? 0) === profitPlan.month.planned_ad_spend, "Campaign allocation reconciles to spend");
assert((campaignPlan?.portfolio.row_count ?? 0) === (campaignPlan?.campaigns.length ?? 0) * profitPlan.days.length, "Campaign day rows complete");
assert((profitPlan.sources.concept_log?.portfolio.ready_concepts ?? 0) >= 2, "Enough launch-ready concepts");
assert(profitPlan.sources.creative_demand.creatives_per_week_needed >= 5, "Creative demand floor respected");

const firstTenDates = new Set(profitPlan.days.slice(0, 10).map((row) => row.plan_date));
const actualizedDays: DailyGrowthMapDailyInput[] = profitPlan.days.map((row, index) => {
  const hasActual = firstTenDates.has(row.plan_date);
  const actualMultiplier = index % 3 === 0 ? 1.08 : index % 3 === 1 ? 0.96 : 1.01;
  const actualRevenue = hasActual ? money(row.target_revenue * actualMultiplier) : null;
  const actualSpend = hasActual ? money(row.target_ad_spend * (index % 2 === 0 ? 0.98 : 1.03)) : null;
  const actualGrossProfit = actualRevenue == null ? null : money(actualRevenue * profitPlan.unit_economics.gross_margin_rate);

  return {
    client_id: profitPlan.client_id,
    target_date: row.plan_date,
    target_revenue: row.target_revenue,
    target_new_customer_revenue: row.target_new_customer_revenue,
    target_returning_revenue: row.target_returning_revenue,
    target_ad_spend: row.target_ad_spend,
    target_orders: row.target_orders,
    target_new_customers: row.target_new_customers,
    target_returning_orders: row.target_returning_orders,
    target_gross_profit: row.target_gross_profit,
    target_contribution_margin: row.target_contribution_margin,
    projection_revenue: money(row.target_revenue * 1.01),
    projection_new_customer_revenue: money(row.target_new_customer_revenue * 1.01),
    projection_returning_revenue: money(row.target_returning_revenue * 1.01),
    projection_ad_spend: money(row.target_ad_spend),
    projection_orders: money(row.target_orders * 1.01),
    projection_new_customers: money(row.target_new_customers * 1.01),
    projection_returning_orders: money(row.target_returning_orders * 1.01),
    projection_gross_profit: money(row.target_gross_profit * 1.01),
    projection_contribution_margin: money(row.target_contribution_margin * 1.01),
    actual_revenue: actualRevenue,
    actual_new_customer_revenue: actualRevenue == null ? null : money(actualRevenue * 0.78),
    actual_returning_revenue: actualRevenue == null ? null : money(actualRevenue * 0.22),
    actual_ad_spend: actualSpend,
    actual_orders: hasActual ? Math.round(row.target_orders * actualMultiplier) : null,
    actual_new_customers: hasActual ? Math.round(row.target_new_customers * actualMultiplier) : null,
    actual_returning_orders: hasActual ? Math.max(0, Math.round(row.target_returning_orders * actualMultiplier)) : null,
    actual_gross_profit: actualGrossProfit,
    actual_contribution_margin: actualGrossProfit == null || actualSpend == null ? null : money(actualGrossProfit - actualSpend),
  };
});

const actualizedCampaignDays: DailyGrowthMapCampaignDayInput[] = (campaignPlan?.days ?? []).map((row, index) => {
  const hasActual = firstTenDates.has(row.plan_date);
  const actualRevenue = hasActual && row.platform_revenue_required != null
    ? money(row.platform_revenue_required * (index % 2 === 0 ? 1.04 : 0.94))
    : null;

  return {
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    platform: row.platform,
    channel_id: row.channel_id,
    channel_name: row.channel_name,
    plan_date: row.plan_date,
    target_spend: row.target_spend,
    platform_revenue_required: row.platform_revenue_required,
    incremental_revenue_target: row.incremental_revenue_target,
    platform_conversions_required: row.platform_conversions_required,
    required_platform_amr: row.required_platform_amr,
    required_platform_cac: row.required_platform_cac,
    incremental_target_amr: row.incremental_target_amr,
    actual_spend: hasActual ? money(row.target_spend * (index % 2 === 0 ? 0.98 : 1.02)) : null,
    actual_revenue: actualRevenue,
    actual_orders: hasActual ? Math.max(0, Math.round((row.platform_conversions_required ?? 0) * (index % 2 === 0 ? 1.05 : 0.95))) : null,
  };
});

const growthMap = buildDailyGrowthMap({
  client_id: profitPlan.client_id,
  scope: "mtd",
  period_start: profitPlan.period_start,
  period_end: profitPlan.period_end,
  as_of_date: "2026-07-10",
  days: actualizedDays,
  campaign_days: actualizedCampaignDays,
});

assert(growthMap.engine_version === "daily_growth_map_v1", "Growth Map present");
assert(growthMap.portfolio.metric_count >= 35, "Growth Map has 35+ metrics");
assert(growthMap.portfolio.channel_metric_count > 0, "Growth Map has channel layer");
assert(growthMap.portfolio.campaign_metric_count > 0, "Growth Map has campaign layer");
assert(!growthMap.metrics.some((metric) => metric.key.toLowerCase().includes("amazon")), "Amazon metrics are not included");

const report = {
  checks: {
    profit_plan: "PASS",
    profit_first_media_buying: "PASS",
    spend_efficiency_frontier: "PASS",
    three_cohort_forecast: "PASS",
    unit_economics_targets: "PASS",
    attribution_targets: "PASS",
    channel_allocation: "PASS",
    campaign_daily_plan: "PASS",
    concept_log: "PASS",
    event_daily_plan: "PASS",
    creative_demand: "PASS",
    daily_growth_map: "PASS",
  },
  account_manager_verdict: {
    client_type: "ecommerce",
    month: `${profitPlan.period_start} to ${profitPlan.period_end}`,
    outcome: profitPlan.month.planned_contribution_margin > 0 ? "PLAN_IS_EXECUTABLE_WITH_MONITORING" : "PLAN_NEEDS_REWORK",
    planned_revenue: profitPlan.month.planned_revenue,
    planned_ad_spend: profitPlan.month.planned_ad_spend,
    planned_gross_profit: profitPlan.month.planned_gross_profit,
    planned_contribution_margin: profitPlan.month.planned_contribution_margin,
    target_cac: profitPlan.month.target_cac,
    target_mer: profitPlan.month.target_mer,
    recommended_spend: profitPlan.month.recommended_spend,
    binding_constraint: profitPlan.month.binding_constraint,
    new_customer_revenue: profitPlan.month.planned_new_customer_revenue,
    returning_revenue: profitPlan.month.planned_returning_revenue,
  },
  model_outputs: {
    unit_economics: {
      source: profitPlan.unit_economics.source,
      weighted_revenue_per_order: profitPlan.unit_economics.portfolio_revenue_per_order,
      contribution_before_ads_per_order: profitPlan.unit_economics.portfolio_contribution_before_ads_per_order,
      break_even_cac: profitPlan.unit_economics.break_even_cac,
      target_cac: profitPlan.unit_economics.target_cac,
      target_mer: profitPlan.unit_economics.target_mer,
      gross_margin_rate_percent: pct(profitPlan.unit_economics.gross_margin_rate),
    },
    channel_allocation: profitPlan.sources.channel_allocation?.channels.map((channel) => ({
      channel: channel.channel_name,
      spend: channel.allocated_spend,
      incrementality_factor: channel.incrementality_factor,
      required_platform_amr: channel.required_platform_amr,
      required_platform_cac: channel.required_platform_cac,
    })),
    campaign_plan: campaignPlan?.campaigns.map((campaign) => ({
      campaign: campaign.campaign_name,
      channel: campaign.channel_name,
      monthly_spend: campaign.monthly_target_spend,
      platform_revenue_required: campaign.monthly_platform_revenue_required,
      required_platform_amr: campaign.required_platform_amr,
    })),
    creative_demand: {
      impressions_per_week: profitPlan.sources.creative_demand.impressions_per_week,
      creatives_per_week_needed: profitPlan.sources.creative_demand.creatives_per_week_needed,
      static: profitPlan.sources.creative_demand.static_creatives_needed,
      video: profitPlan.sources.creative_demand.video_creatives_needed,
      ugc: profitPlan.sources.creative_demand.ugc_creatives_needed,
      fatigue_load_pct: profitPlan.sources.creative_demand.fatigue_load_pct,
    },
    concept_log: {
      ready_concepts: profitPlan.sources.concept_log?.portfolio.ready_concepts,
      planned_ads: profitPlan.sources.concept_log?.portfolio.planned_ads,
      expected_period_spend: profitPlan.sources.concept_log?.portfolio.expected_period_spend,
      spend_coverage_rate: profitPlan.sources.concept_log?.portfolio.spend_coverage_rate,
    },
    daily_growth_map: {
      metric_count: growthMap.portfolio.metric_count,
      root_status: growthMap.portfolio.root_status,
      actual_coverage_rate: growthMap.portfolio.actual_coverage_rate,
      bad_metric_count: growthMap.portfolio.bad_metric_count,
      watch_metric_count: growthMap.portfolio.watch_metric_count,
      channel_metric_count: growthMap.portfolio.channel_metric_count,
      campaign_metric_count: growthMap.portfolio.campaign_metric_count,
    },
  },
  risks: {
    profit_plan: profitPlan.risks,
    growth_map: growthMap.risks,
  },
  conditions: {
    profit_plan: profitPlan.conditions,
    growth_map: growthMap.conditions,
  },
  missing_data: {
    profit_plan: profitPlan.missing_data,
    growth_map: growthMap.missing_data,
  },
};

console.log(JSON.stringify(report, null, 2));
