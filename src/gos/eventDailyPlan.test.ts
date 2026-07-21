import { describe, expect, it } from "vitest";
import { runEventDailyPlan } from "./eventDailyPlan";
import { UNIFORM_WEIGHTS } from "./dailyTargets";

function sum(values: number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(4));
}

describe("event daily plan", () => {
  it("raises pacing on planned event dates while preserving normalized total", () => {
    const output = runEventDailyPlan({
      dates: [
        "2026-07-01",
        "2026-07-02",
        "2026-07-03",
        "2026-07-04",
        "2026-07-05",
        "2026-07-06",
        "2026-07-07",
      ],
      day_weights: UNIFORM_WEIGHTS,
      events: [
        {
          event_name: "Summer launch",
          event_type: "LAUNCH",
          start_date: "2026-07-04",
          end_date: "2026-07-04",
          expected_lift_pct: 100,
        },
      ],
    });

    const eventDay = output.date_weights.find((row) => row.date === "2026-07-04");
    const normalDay = output.date_weights.find((row) => row.date === "2026-07-03");

    expect(output.engine_version).toBe("event_daily_plan_v1");
    expect(output.events[0].full_impact_multiplier).toBe(2);
    expect(eventDay?.event_multiplier).toBe(2);
    expect(eventDay?.normalized_weight).toBeGreaterThan(normalDay?.normalized_weight ?? 0);
    expect(sum(output.date_weights.map((row) => row.normalized_weight))).toBe(1);
  });

  it("applies shoulder pacing before and after an event", () => {
    const output = runEventDailyPlan({
      dates: [
        "2026-07-01",
        "2026-07-02",
        "2026-07-03",
        "2026-07-04",
        "2026-07-05",
      ],
      day_weights: UNIFORM_WEIGHTS,
      events: [
        {
          event_name: "Promo",
          event_type: "PROMO",
          start_date: "2026-07-03",
          end_date: "2026-07-03",
          expected_lift_pct: 100,
          pre_event_days: 1,
          post_event_days: 1,
          shoulder_weight_pct: 50,
        },
      ],
    });

    const preDay = output.date_weights.find((row) => row.date === "2026-07-02");
    const eventDay = output.date_weights.find((row) => row.date === "2026-07-03");
    const postDay = output.date_weights.find((row) => row.date === "2026-07-04");

    expect(preDay?.event_multiplier).toBe(1.5);
    expect(eventDay?.event_multiplier).toBe(2);
    expect(postDay?.event_multiplier).toBe(1.5);
  });

  it("keeps base day weights and reports a condition when no events are provided", () => {
    const output = runEventDailyPlan({
      dates: ["2026-07-01", "2026-07-02"],
      day_weights: UNIFORM_WEIGHTS,
      events: [],
    });

    expect(output.events).toHaveLength(0);
    expect(output.date_weights.map((row) => row.final_weight)).toEqual([1, 1]);
    expect(output.conditions.join(" ")).toContain("planned marketing events");
  });
});
