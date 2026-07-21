import { computeVariancePct } from "./dailyTargets";

export type DailyPnlSummaryInput = {
  target_revenue: number | null;
  actual_revenue: number | null;
};

export type DailyPnlSummary = {
  targetRevenue: number;
  actualRevenue: number;
  daysWithActual: number;
  paceDeltaPct: number | null;
  projectedRevenue: number;
};

export type DailyPnlSparkPoint = {
  x: number;
  v: number;
};

export function computeDailyPnlSummary(days: DailyPnlSummaryInput[]): DailyPnlSummary {
  const targetRevenue = days.reduce((sum, day) => sum + Number(day.target_revenue ?? 0), 0);
  const actualRevenue = days.reduce((sum, day) => sum + Number(day.actual_revenue ?? 0), 0);
  const daysWithActual = days.filter((day) => day.actual_revenue != null).length;

  return {
    targetRevenue,
    actualRevenue,
    daysWithActual,
    paceDeltaPct: computeVariancePct(targetRevenue, actualRevenue),
    projectedRevenue: daysWithActual > 0
      ? Math.round((actualRevenue / daysWithActual) * days.length)
      : targetRevenue,
  };
}

export function buildCumulativeRevenueSparkline(days: DailyPnlSummaryInput[]): DailyPnlSparkPoint[] {
  let cumulative = 0;
  return days.map((day, index) => {
    cumulative += Number(day.actual_revenue ?? day.target_revenue ?? 0);
    const x = days.length > 1 ? (index / (days.length - 1)) * 100 : 50;
    return { x, v: cumulative };
  });
}

export function buildSparkPath(points: DailyPnlSparkPoint[], height = 30, topPadding = 5): string {
  const maxValue = Math.max(1, ...points.map((point) => point.v));
  return points
    .map((point, index) => {
      const y = height - (point.v / maxValue) * (height - topPadding);
      return `${index === 0 ? "M" : "L"}${point.x} ${y}`;
    })
    .join(" ");
}
