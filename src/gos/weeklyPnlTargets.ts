export type MetricTargetForWeeklyPnl = {
  id: string;
  target_revenue?: number | null;
  target_ad_spend?: number | null;
  target_orders?: number | null;
  target_leads?: number | null;
  target_gross_profit?: number | null;
  target_cac?: number | null;
  target_mer?: number | null;
};

export type WeeklyPnlTargetDraft = {
  week_number: number;
  week_start: string;
  week_end: string;
  target_revenue: number | null;
  target_ad_spend: number | null;
  target_orders: number | null;
  target_leads: number | null;
  target_gross_profit: number | null;
  target_cac: number | null;
  target_mer: number | null;
  parent_target_id: string | null;
  status: string;
};

export type WeeklyPnlActualFields = {
  target_revenue?: number | null;
  actual_revenue?: number | null;
};

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function splitWholeValue(total: number | null | undefined, parts: number): (number | null)[] {
  const value = optionalNumber(total);
  if (value == null) return Array.from({ length: parts }, () => null);

  const normalizedTotal = Math.round(value);
  const base = Math.trunc(normalizedTotal / parts);
  const remainder = normalizedTotal - base * parts;
  const rows = Array.from({ length: parts }, () => base);
  const direction = remainder >= 0 ? 1 : -1;

  for (let i = 0; i < Math.abs(remainder); i++) {
    rows[i % parts] += direction;
  }

  return rows;
}

export function computeVariancePct(target?: number | null, actual?: number | null): number | null {
  const t = optionalNumber(target);
  const a = optionalNumber(actual);
  if (t == null || a == null || t === 0) return null;
  return Number((((a - t) / t) * 100).toFixed(1));
}

export function computeWeeklyRevenueVariance(row: WeeklyPnlActualFields): number | null {
  return computeVariancePct(row.target_revenue, row.actual_revenue);
}

export function splitMetricTargetIntoWeeks(
  target: MetricTargetForWeeklyPnl,
  numWeeks: number,
  startDate: string,
): WeeklyPnlTargetDraft[] {
  const weeks = toPositiveInt(numWeeks, 4);
  const start = startDate.slice(0, 10);

  const revenue = splitWholeValue(target.target_revenue, weeks);
  const spend = splitWholeValue(target.target_ad_spend, weeks);
  const orders = splitWholeValue(target.target_orders, weeks);
  const leads = splitWholeValue(target.target_leads, weeks);
  const grossProfit = splitWholeValue(target.target_gross_profit, weeks);

  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDaysIso(start, i * 7);
    return {
      week_number: i + 1,
      week_start: weekStart,
      week_end: addDaysIso(weekStart, 6),
      target_revenue: revenue[i],
      target_ad_spend: spend[i],
      target_orders: orders[i],
      target_leads: leads[i],
      target_gross_profit: grossProfit[i],
      target_cac: optionalNumber(target.target_cac),
      target_mer: optionalNumber(target.target_mer),
      parent_target_id: target.id || null,
      status: "PLANNED",
    };
  });
}
