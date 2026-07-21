import { describe, expect, it, vi } from "vitest";
import {
  buildWeeklyActualUpdatePayload,
  buildWeeklyPnlTargetPayloads,
  normalizeWeeklyPnlTargetRow,
  toWeeklyPnlTargetPayload,
  type WeeklyPnlTargetRow,
} from "./weeklyPnlController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("weekly P&L controller", () => {
  it("builds insert payloads from metric targets", () => {
    const payloads = buildWeeklyPnlTargetPayloads("client-1", {
      id: "target-1",
      target_revenue: 100,
      target_ad_spend: 40,
      target_orders: 10,
      target_cac: 25,
      target_mer: 3,
    }, 3, "2026-07-01");

    expect(payloads).toHaveLength(3);
    expect(payloads[0].client_id).toBe("client-1");
    expect(payloads.map((row) => row.target_revenue)).toEqual([34, 33, 33]);
    expect(payloads.map((row) => row.target_ad_spend)).toEqual([14, 13, 13]);
    expect(payloads.map((row) => row.projection_revenue)).toEqual([34, 33, 33]);
    expect(payloads.map((row) => row.projection_ad_spend)).toEqual([14, 13, 13]);
    expect(payloads[0].target_cac).toBe(25);
    expect(payloads[0].target_mer).toBe(3);
    expect(payloads[0].projection_cac).toBe(25);
    expect(payloads[0].projection_mer).toBe(3);
  });

  it("keeps client id outside the pure weekly draft", () => {
    const payload = toWeeklyPnlTargetPayload("client-1", {
      week_number: 1,
      week_start: "2026-07-01",
      week_end: "2026-07-07",
      target_revenue: 100,
      target_ad_spend: 50,
      target_orders: null,
      target_leads: null,
      target_gross_profit: null,
      target_cac: null,
      target_mer: null,
      parent_target_id: "target-1",
      status: "PLANNED",
    });

    expect(payload.client_id).toBe("client-1");
    expect(payload.parent_target_id).toBe("target-1");
    expect(payload.projection_revenue).toBe(100);
    expect(payload.projection_ad_spend).toBe(50);
  });

  it("computes revenue variance in update payloads", () => {
    const current = {
      id: "week-1",
      client_id: "client-1",
      week_number: 1,
      week_start: "2026-07-01",
      week_end: "2026-07-07",
      target_revenue: 1000,
      target_ad_spend: 200,
      target_orders: 20,
      target_leads: null,
      target_gross_profit: null,
      target_cac: null,
      target_mer: null,
      actual_revenue: null,
      actual_ad_spend: null,
      actual_orders: null,
      actual_leads: null,
      actual_gross_profit: null,
      variance_pct: null,
      projection_revenue: 1000,
      projection_ad_spend: 200,
      projection_orders: 20,
      projection_leads: null,
      projection_gross_profit: null,
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

    const payload = buildWeeklyActualUpdatePayload(current, { actual_revenue: 1200 });
    expect(payload.actual_revenue).toBe(1200);
    expect(payload.variance_pct).toBe(20);
  });

  it("normalizes Supabase rows", () => {
    const row = normalizeWeeklyPnlTargetRow({
      id: "week-1",
      client_id: "client-1",
      week_number: "1",
      week_start: "2026-07-01",
      week_end: "2026-07-07",
      target_revenue: "1000",
      actual_revenue: "900",
      variance_pct: "-10",
      projection_revenue: "950",
      projection_cac: "30",
      target_locked_at: "2026-07-15T00:00:00.000Z",
      status: "",
    });

    expect(row.week_number).toBe(1);
    expect(row.target_revenue).toBe(1000);
    expect(row.actual_revenue).toBe(900);
    expect(row.variance_pct).toBe(-10);
    expect(row.projection_revenue).toBe(950);
    expect(row.projection_cac).toBe(30);
    expect(row.target_locked_at).toBe("2026-07-15T00:00:00.000Z");
    expect(row.status).toBe("PLANNED");
  });
});
