import { describe, expect, it, vi } from "vitest";
import {
  buildDailyProjectionPayload,
  buildWeeklyProjectionPayload,
  normalizeProjectionUpdateRow,
} from "./projectionAuditController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("projection audit controller", () => {
  it("normalizes projection update rows", () => {
    const row = normalizeProjectionUpdateRow({
      id: "audit-1",
      client_id: "client-1",
      scope: "weekly",
      target_row_id: "week-1",
      period_start: "2026-07-06",
      period_end: "2026-07-12",
      metric_name: "projection_revenue",
      old_value: 100,
      new_value: 120,
      change_type: "projection_update",
      updated_by: "",
      created_at: "2026-07-15T00:00:00.000Z",
    });

    expect(row.scope).toBe("weekly");
    expect(row.period_date).toBeNull();
    expect(row.old_value).toBe(100);
    expect(row.new_value).toBe(120);
    expect(row.updated_by).toBeNull();
  });

  it("builds daily projection payloads", () => {
    expect(buildDailyProjectionPayload({
      projection_revenue: 100,
      projection_orders: null,
      projection_cac: 50,
    } as never)).toEqual({
      projection_revenue: 100,
      projection_orders: null,
    });
  });

  it("builds weekly projection payloads", () => {
    expect(buildWeeklyProjectionPayload({
      projection_revenue: 100,
      projection_cac: 50,
    })).toEqual({
      projection_revenue: 100,
      projection_cac: 50,
    });
  });
});
