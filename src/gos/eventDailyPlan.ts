import { EVENT_TYPE_DEFAULT_LIFTS } from "./eventEffectV2";
import type { DayWeights } from "./dailyTargets";

export const EVENT_DAILY_PLAN_ENGINE_VERSION = "event_daily_plan_v1" as const;

export type EventDailyPlanEventInput = {
  event_name?: string | null;
  event_type?: string | null;
  start_date: string;
  end_date?: string | null;
  expected_lift_pct?: number | null;
  custom_lift_pct?: number | null;
  weight_multiplier?: number | null;
  pre_event_days?: number | null;
  post_event_days?: number | null;
  shoulder_weight_pct?: number | null;
};

export type EventDailyPlanInput = {
  dates: string[];
  day_weights: DayWeights;
  events?: EventDailyPlanEventInput[] | null;
  default_pre_event_days?: number | null;
  default_post_event_days?: number | null;
  default_shoulder_weight_pct?: number | null;
  min_daily_multiplier?: number | null;
  max_daily_multiplier?: number | null;
};

export type EventDailyPlanEventOutput = {
  event_name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  expected_lift_pct: number;
  full_impact_multiplier: number;
  shoulder_multiplier: number;
  pre_event_days: number;
  post_event_days: number;
  affected_dates: string[];
  full_impact_dates: string[];
  shoulder_dates: string[];
  confidence: "LOW" | "MEDIUM";
};

export type EventDailyPlanDateWeight = {
  date: string;
  day_of_week: number;
  base_weight: number;
  event_multiplier: number;
  final_weight: number;
  normalized_weight: number;
  event_names: string[];
};

export type EventDailyPlanOutput = {
  engine_version: typeof EVENT_DAILY_PLAN_ENGINE_VERSION;
  date_weights: EventDailyPlanDateWeight[];
  events: EventDailyPlanEventOutput[];
  assumptions: {
    formula: string;
    normalized_to_month_total: boolean;
    default_pre_event_days: number;
    default_post_event_days: number;
    default_shoulder_weight_pct: number;
    min_daily_multiplier: number;
    max_daily_multiplier: number;
  };
  missing_data: string[];
  risks: string[];
  conditions: string[];
};

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function whole(value: unknown, fallback = 0): number {
  return Math.max(0, Math.round(finite(value, fallback)));
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(4));
}

function toIsoDate(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === text ? text : null;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function dateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

function eventTypeLift(eventType: string): number {
  return EVENT_TYPE_DEFAULT_LIFTS[eventType] ?? EVENT_TYPE_DEFAULT_LIFTS.OTHER;
}

function normalizeWeights(rows: Omit<EventDailyPlanDateWeight, "normalized_weight">[]): EventDailyPlanDateWeight[] {
  const total = rows.reduce((sum, row) => sum + row.final_weight, 0) || 1;
  return rows.map((row) => ({
    ...row,
    normalized_weight: money(row.final_weight / total),
  }));
}

export function runEventDailyPlan(input: EventDailyPlanInput): EventDailyPlanOutput {
  const missingData: string[] = [];
  const risks: string[] = [];
  const conditions: string[] = [];
  const validDates = input.dates
    .map(toIsoDate)
    .filter((date): date is string => Boolean(date));
  const dateSet = new Set(validDates);
  const defaultPreEventDays = whole(input.default_pre_event_days, 0);
  const defaultPostEventDays = whole(input.default_post_event_days, 0);
  const defaultShoulderWeightPct = clamp(finite(input.default_shoulder_weight_pct, 50), 0, 100);
  const minDailyMultiplier = Math.max(0.05, finite(input.min_daily_multiplier, 0.25));
  const maxDailyMultiplier = Math.max(minDailyMultiplier, finite(input.max_daily_multiplier, 2));

  if (validDates.length === 0) {
    missingData.push("dates");
  }

  const baseRows = validDates.map((date) => {
    const baseWeight = Math.max(0.01, finite(input.day_weights[dayOfWeek(date)], 1));
    return {
      date,
      day_of_week: dayOfWeek(date),
      base_weight: money(baseWeight),
      event_multiplier: 1,
      final_weight: money(baseWeight),
      event_names: [] as string[],
    };
  });

  const events = input.events ?? [];
  if (events.length === 0) {
    conditions.push("Add planned marketing events to activate event-adjusted daily pacing.");
    return {
      engine_version: EVENT_DAILY_PLAN_ENGINE_VERSION,
      date_weights: normalizeWeights(baseRows),
      events: [],
      assumptions: {
        formula: "final_weight = day_of_week_weight * product(planned_event_multipliers), normalized across plan dates",
        normalized_to_month_total: true,
        default_pre_event_days: defaultPreEventDays,
        default_post_event_days: defaultPostEventDays,
        default_shoulder_weight_pct: defaultShoulderWeightPct,
        min_daily_multiplier: minDailyMultiplier,
        max_daily_multiplier: maxDailyMultiplier,
      },
      missing_data: missingData,
      risks,
      conditions,
    };
  }

  const rowsByDate = new Map(baseRows.map((row) => [row.date, row]));
  const eventOutputs: EventDailyPlanEventOutput[] = [];

  events.forEach((event, index) => {
    const eventName = String(event.event_name ?? "").trim() || `event_${index + 1}`;
    const eventType = String(event.event_type ?? "OTHER").trim().toUpperCase() || "OTHER";
    const startDate = toIsoDate(event.start_date);
    const endDate = toIsoDate(event.end_date ?? event.start_date);

    if (!String(event.event_name ?? "").trim()) missingData.push(`events.${index}.event_name`);
    if (!startDate) missingData.push(`events.${index}.start_date`);
    if (!endDate) missingData.push(`events.${index}.end_date`);
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      risks.push(`events.${index}.end_date_before_start_date`);
      return;
    }

    const explicitLift = event.custom_lift_pct ?? event.expected_lift_pct;
    const expectedLiftPct = finite(explicitLift, eventTypeLift(eventType));
    const explicitMultiplier = event.weight_multiplier != null ? finite(event.weight_multiplier, NaN) : null;
    const rawFullMultiplier = explicitMultiplier && explicitMultiplier > 0
      ? explicitMultiplier
      : 1 + expectedLiftPct / 100;
    const fullImpactMultiplier = clamp(rawFullMultiplier, minDailyMultiplier, maxDailyMultiplier);
    if (fullImpactMultiplier !== rawFullMultiplier) {
      risks.push(`events.${index}.multiplier_capped`);
    }

    const preEventDays = whole(event.pre_event_days, defaultPreEventDays);
    const postEventDays = whole(event.post_event_days, defaultPostEventDays);
    const shoulderPct = clamp(
      finite(event.shoulder_weight_pct, defaultShoulderWeightPct),
      0,
      100,
    );
    const shoulderMultiplier = clamp(
      1 + (fullImpactMultiplier - 1) * (shoulderPct / 100),
      minDailyMultiplier,
      maxDailyMultiplier,
    );
    const windowStart = addDaysIso(startDate, -preEventDays);
    const windowEnd = addDaysIso(endDate, postEventDays);
    const affectedDates = dateRange(windowStart, windowEnd).filter((date) => dateSet.has(date));
    const fullImpactDates = affectedDates.filter((date) => date >= startDate && date <= endDate);
    const shoulderDates = affectedDates.filter((date) => date < startDate || date > endDate);

    if (affectedDates.length === 0) {
      conditions.push(`events.${index}.outside_plan_period`);
    }

    affectedDates.forEach((date) => {
      const row = rowsByDate.get(date);
      if (!row) return;
      const multiplier = fullImpactDates.includes(date) ? fullImpactMultiplier : shoulderMultiplier;
      row.event_multiplier = money(row.event_multiplier * multiplier);
      row.final_weight = money(row.base_weight * row.event_multiplier);
      row.event_names.push(eventName);
    });

    eventOutputs.push({
      event_name: eventName,
      event_type: eventType,
      start_date: startDate,
      end_date: endDate,
      expected_lift_pct: money(expectedLiftPct),
      full_impact_multiplier: money(fullImpactMultiplier),
      shoulder_multiplier: money(shoulderMultiplier),
      pre_event_days: preEventDays,
      post_event_days: postEventDays,
      affected_dates: affectedDates,
      full_impact_dates: fullImpactDates,
      shoulder_dates: shoulderDates,
      confidence: explicitLift != null || event.weight_multiplier != null ? "MEDIUM" : "LOW",
    });
  });

  const dateWeights = normalizeWeights(Array.from(rowsByDate.values()));

  return {
    engine_version: EVENT_DAILY_PLAN_ENGINE_VERSION,
    date_weights: dateWeights,
    events: eventOutputs,
    assumptions: {
      formula: "final_weight = day_of_week_weight * product(planned_event_multipliers), normalized across plan dates",
      normalized_to_month_total: true,
      default_pre_event_days: defaultPreEventDays,
      default_post_event_days: defaultPostEventDays,
      default_shoulder_weight_pct: defaultShoulderWeightPct,
      min_daily_multiplier: minDailyMultiplier,
      max_daily_multiplier: maxDailyMultiplier,
    },
    missing_data: [...new Set(missingData)],
    risks: [...new Set(risks)],
    conditions: [...new Set(conditions)],
  };
}
