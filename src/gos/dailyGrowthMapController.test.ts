import { describe, expect, it, vi } from "vitest";
import {
  mergeCampaignPerformanceRows,
  mergeGrowthMapDailyRows,
  normalizeCampaignPerformanceRow,
  normalizeDailyGrowthMapDailyRow,
  normalizeProfitPlanDayForGrowthMap,
} from "./dailyGrowthMapController";
import type { ProfitPlanDayPlan } from "./profitPlanEngine";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("daily growth map controller mappers", () => {
  it("normalizes daily P&L rows with actual gross profit", () => {
    const row = normalizeDailyGrowthMapDailyRow({
      id: "day-1",
      client_id: "client-1",
      target_date: "2026-07-01",
      target_revenue: "1000",
      actual_revenue: "900",
      actual_gross_profit: "540",
    });

    expect(row.id).toBe("day-1");
    expect(row.target_revenue).toBe(1000);
    expect(row.actual_revenue).toBe(900);
    expect(row.actual_gross_profit).toBe(540);
  });

  it("merges Profit Plan targets with daily actuals without losing new vs returning targets", () => {
    const planDay: ProfitPlanDayPlan = {
      client_id: "client-1",
      plan_date: "2026-07-01",
      day_of_week: 3,
      day_index: 1,
      pacing_weight: 0.1,
      target_revenue: 1_000,
      target_new_customer_revenue: 700,
      target_returning_revenue: 300,
      target_ad_spend: 300,
      target_orders: 10,
      target_new_customers: 7,
      target_returning_orders: 3,
      target_gross_profit: 600,
      target_contribution_margin: 300,
      status: "PLANNED",
    };
    const merged = mergeGrowthMapDailyRows(
      [normalizeProfitPlanDayForGrowthMap(planDay)],
      [
        normalizeDailyGrowthMapDailyRow({
          id: "daily-1",
          target_date: "2026-07-01",
          target_revenue: 950,
          actual_revenue: 900,
          actual_ad_spend: 250,
          actual_gross_profit: 540,
        }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].target_revenue).toBe(950);
    expect(merged[0].target_new_customer_revenue).toBe(700);
    expect(merged[0].target_returning_revenue).toBe(300);
    expect(merged[0].actual_gross_profit).toBe(540);
  });

  it("joins campaign plan rows to buyer workspace performance actuals", () => {
    const merged = mergeCampaignPerformanceRows(
      [
        {
          campaign_id: "campaign-1",
          campaign_name: "Meta Prospecting",
          channel_name: "Meta",
          plan_date: "2026-07-01",
          target_spend: 100,
        },
      ],
      [
        normalizeCampaignPerformanceRow({
          campaign_id: "campaign-1",
          perf_date: "2026-07-01",
          spend: 95,
          revenue: 280,
          orders: 3,
          leads: 12,
        }),
      ],
    );

    expect(merged[0].actual_spend).toBe(95);
    expect(merged[0].actual_revenue).toBe(280);
    expect(merged[0].actual_orders).toBe(3);
    expect(merged[0].actual_leads).toBe(12);
  });
});
