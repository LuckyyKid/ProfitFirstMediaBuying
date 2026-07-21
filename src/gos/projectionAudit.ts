export const DAILY_PROJECTION_FIELDS = [
  "projection_revenue",
  "projection_ad_spend",
  "projection_orders",
  "projection_leads",
  "projection_gross_profit",
] as const;

export const WEEKLY_PROJECTION_FIELDS = [
  ...DAILY_PROJECTION_FIELDS,
  "projection_cac",
  "projection_mer",
] as const;

export type ProjectionScope = "daily" | "weekly";
export type DailyProjectionField = typeof DAILY_PROJECTION_FIELDS[number];
export type WeeklyProjectionField = typeof WEEKLY_PROJECTION_FIELDS[number];
export type ProjectionField = DailyProjectionField | WeeklyProjectionField;

export type DailyProjectionPatch = Partial<Record<DailyProjectionField, number | null>>;
export type WeeklyProjectionPatch = Partial<Record<WeeklyProjectionField, number | null>>;

export type TargetLockPayload = {
  target_locked_at: string | null;
  target_locked_by: string | null;
};

const DAILY_FIELD_SET = new Set<string>(DAILY_PROJECTION_FIELDS);
const WEEKLY_FIELD_SET = new Set<string>(WEEKLY_PROJECTION_FIELDS);

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function allowedFields(scope: ProjectionScope): Set<string> {
  return scope === "daily" ? DAILY_FIELD_SET : WEEKLY_FIELD_SET;
}

export function isProjectionField(scope: ProjectionScope, field: string): field is ProjectionField {
  return allowedFields(scope).has(field);
}

export function buildProjectionUpdatePayload(
  scope: ProjectionScope,
  patch: Record<string, unknown>,
): DailyProjectionPatch | WeeklyProjectionPatch {
  const allowed = allowedFields(scope);
  return Object.entries(patch).reduce<Record<string, number | null>>((payload, [key, value]) => {
    if (allowed.has(key)) {
      payload[key] = optionalNumber(value);
    }
    return payload;
  }, {});
}

export function buildTargetLockPayload(
  locked: boolean,
  nowIso = new Date().toISOString(),
): TargetLockPayload {
  return {
    target_locked_at: locked ? nowIso : null,
    target_locked_by: null,
  };
}

export function effectiveProjectionValue(
  projection: number | null | undefined,
  target: number | null | undefined,
): number | null {
  return projection ?? target ?? null;
}

export function computeVariancePct(
  baseline?: number | null,
  actual?: number | null,
): number | null {
  if (baseline == null || actual == null || Number(baseline) === 0) return null;
  return Number((((Number(actual) - Number(baseline)) / Number(baseline)) * 100).toFixed(1));
}

export function computeActualVsProjectionPct(
  projection?: number | null,
  targetFallback?: number | null,
  actual?: number | null,
): number | null {
  return computeVariancePct(effectiveProjectionValue(projection, targetFallback), actual);
}
