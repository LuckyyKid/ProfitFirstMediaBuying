import { describe, expect, it } from "vitest";
import {
  buildProjectionUpdatePayload,
  buildTargetLockPayload,
  computeActualVsProjectionPct,
  effectiveProjectionValue,
  isProjectionField,
} from "./projectionAudit";

describe("projection audit model", () => {
  it("keeps only scope-allowed projection fields", () => {
    const dailyPayload = buildProjectionUpdatePayload("daily", {
      projection_revenue: "1200",
      projection_cac: "40",
      random_field: 99,
      projection_leads: "",
    });

    expect(dailyPayload).toEqual({
      projection_revenue: 1200,
      projection_leads: null,
    });

    const weeklyPayload = buildProjectionUpdatePayload("weekly", {
      projection_revenue: "1200",
      projection_cac: "40",
    });

    expect(weeklyPayload).toEqual({
      projection_revenue: 1200,
      projection_cac: 40,
    });
  });

  it("builds lock and unlock payloads", () => {
    expect(buildTargetLockPayload(true, "2026-07-15T00:00:00.000Z")).toEqual({
      target_locked_at: "2026-07-15T00:00:00.000Z",
      target_locked_by: null,
    });

    expect(buildTargetLockPayload(false)).toEqual({
      target_locked_at: null,
      target_locked_by: null,
    });
  });

  it("uses target as projection fallback", () => {
    expect(effectiveProjectionValue(null, 100)).toBe(100);
    expect(effectiveProjectionValue(120, 100)).toBe(120);
    expect(effectiveProjectionValue(null, null)).toBeNull();
  });

  it("computes actual vs projection variance", () => {
    expect(computeActualVsProjectionPct(100, 90, 110)).toBe(10);
    expect(computeActualVsProjectionPct(null, 100, 90)).toBe(-10);
    expect(computeActualVsProjectionPct(0, 100, 90)).toBeNull();
  });

  it("identifies projection fields by scope", () => {
    expect(isProjectionField("daily", "projection_revenue")).toBe(true);
    expect(isProjectionField("daily", "projection_cac")).toBe(false);
    expect(isProjectionField("weekly", "projection_cac")).toBe(true);
  });
});
