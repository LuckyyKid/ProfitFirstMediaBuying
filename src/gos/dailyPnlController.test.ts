import { describe, expect, it, vi } from "vitest";
import { WEIGHT_PRESETS } from "./dailyTargets";
import {
  buildDailyActualUpdatePayload,
  buildDailyPnlInsertPayloads,
  normalizeDailyPnlTargetRow,
  toDailyPnlInsertPayload,
  weeklyPnlRowToDailyInput,
  type DailyPnlTargetRow,
} from "./dailyPnlController";
import type { WeeklyPnlTargetRow } from "./weeklyPnlController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("daily P&L controller", () => {
  it("builds seven daily insert payloads from a weekly target", () => {
    const payloads = buildDailyPnlInsertPayloads({
      id: "week-1",
      client_id: "client-1",
      week_start: "2026-07-06",
      target_revenue: 700,
      target_ad_spend: 350,
      target_orders: 7,
      target_leads: 14,
      target_gross_profit: 280,
    }, WEIGHT_PRESETS.uniform);

    expect(payloads).toHaveLength(7);
    expect(payloads[0]).toMatchObject({
      client_id: "client-1",
      parent_weekly_id: "week-1",
      target_date: "2026-07-06",
      target_revenue: 100,
      target_orders: 1,
      projection_revenue: 100,
      projection_orders: 1,
      status: "PLANNED",
    });
    expect(payloads.reduce((sum, row) => sum + Number(row.target_orders ?? 0), 0)).toBe(7);
  });

  it("initializes projection fields from targets on insert", () => {
    const payload = toDailyPnlInsertPayload({
      client_id: "client-1",
      parent_weekly_id: "week-1",
      target_date: "2026-07-06",
      day_of_week: 1,
      day_index: 1,
      pacing_weight: 0.1429,
      target_revenue: 100,
      target_ad_spend: 40,
      target_orders: 2,
      target_leads: null,
      target_gross_profit: 55,
      status: "PLANNED",
    });

    expect(payload.projection_revenue).toBe(100);
    expect(payload.projection_ad_spend).toBe(40);
    expect(payload.projection_orders).toBe(2);
    expect(payload.projection_leads).toBeNull();
    expect(payload.projection_gross_profit).toBe(55);
  });

  it("converts a weekly P&L row to the daily target input shape", () => {
    const week = {
      id: "week-1",
      client_id: "client-1",
      week_number: 1,
      week_start: "2026-07-06",
      week_end: "2026-07-12",
      target_revenue: 700,
      target_ad_spend: 350,
      target_orders: 7,
      target_leads: null,
      target_gross_profit: 280,
      target_cac: null,
      target_mer: null,
      actual_revenue: null,
      actual_ad_spend: null,
      actual_orders: null,
      actual_leads: null,
      actual_gross_profit: null,
      variance_pct: null,
      projection_revenue: 700,
      projection_ad_spend: 350,
      projection_orders: 7,
      projection_leads: null,
      projection_gross_profit: 280,
      projection_cac: null,
      projection_mer: null,
      target_locked_at: null,
      target_locked_by: null,
      projection_last_updated_at: null,
      projection_last_updated_by: null,
      parent_target_id: "target-1",
      status: "PLANNED",
      notes: null,
    } satisfies WeeklyPnlTargetRow;

    expect(weeklyPnlRowToDailyInput(week)).toEqual({
      id: "week-1",
      client_id: "client-1",
      week_start: "2026-07-06",
      target_revenue: 700,
      target_ad_spend: 350,
      target_orders: 7,
      target_leads: null,
      target_gross_profit: 280,
    });
  });

  it("computes revenue variance in actual update payloads", () => {
    const current = {
      id: "day-1",
      client_id: "client-1",
      parent_weekly_id: "week-1",
      target_date: "2026-07-06",
      day_of_week: 1,
      day_index: 1,
      pacing_weight: 0.1429,
      target_revenue: 100,
      target_ad_spend: 40,
      target_orders: 2,
      target_leads: null,
      target_gross_profit: 55,
      actual_revenue: null,
      actual_ad_spend: null,
      actual_orders: null,
      actual_leads: null,
      variance_pct: null,
      projection_revenue: 100,
      projection_ad_spend: 40,
      projection_orders: 2,
      projection_leads: null,
      projection_gross_profit: 55,
      target_locked_at: null,
      target_locked_by: null,
      projection_last_updated_at: null,
      projection_last_updated_by: null,
      status: "PLANNED",
      notes: null,
    } satisfies DailyPnlTargetRow;

    const payload = buildDailyActualUpdatePayload(current, { actual_revenue: 125 });
    expect(payload.actual_revenue).toBe(125);
    expect(payload.variance_pct).toBe(25);
  });

  it("normalizes Supabase daily rows", () => {
    const row = normalizeDailyPnlTargetRow({
      id: "day-1",
      client_id: "client-1",
      parent_weekly_id: "week-1",
      target_date: "2026-07-06",
      day_of_week: "1",
      day_index: "1",
      pacing_weight: "0.1429",
      target_revenue: "100.5",
      actual_revenue: "90",
      variance_pct: "-10.4",
      projection_revenue: "100.5",
      status: "",
    });

    expect(row.day_of_week).toBe(1);
    expect(row.day_index).toBe(1);
    expect(row.pacing_weight).toBe(0.1429);
    expect(row.target_revenue).toBe(100.5);
    expect(row.actual_revenue).toBe(90);
    expect(row.variance_pct).toBe(-10.4);
    expect(row.projection_revenue).toBe(100.5);
    expect(row.status).toBe("PLANNED");
  });
});
