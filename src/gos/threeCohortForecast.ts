import type { CustomerTransaction } from "./customerCohorts";

export const THREE_COHORT_FORECAST_VERSION = "three_cohort_forecast_v1" as const;

export type ThreeCohortForecastInput = {
  period_start: string;
  period_end?: string | null;
  transactions: CustomerTransaction[];
  planned_new_customers: number | null | undefined;
  planned_new_customer_revenue: number | null | undefined;
  planned_ad_spend?: number | null;
  gross_margin_rate?: number | null;
  recent_window_days?: number | null;
  active_window_days?: number | null;
  trailing_window_days?: number | null;
};

export type ForecastCohortKey =
  | "new_customers"
  | "recently_acquired_180d"
  | "active_non_recent";

export type ForecastCohortLayer = {
  key: ForecastCohortKey;
  label: string;
  customer_count: number;
  active_customer_count: number;
  trailing_returning_orders: number;
  trailing_returning_revenue: number;
  trailing_returning_gross_profit: number | null;
  projected_orders: number;
  projected_revenue: number;
  projected_gross_profit: number;
  contribution_after_ads: number;
  confidence: number;
  formula_used: string;
};

export type ThreeCohortForecastOutput = {
  engine_version: typeof THREE_COHORT_FORECAST_VERSION;
  period_start: string;
  period_end: string;
  horizon_days: number;
  cohorts: {
    new_customers: ForecastCohortLayer;
    recently_acquired_180d: ForecastCohortLayer;
    active_non_recent: ForecastCohortLayer;
  };
  totals: {
    projected_revenue: number;
    projected_new_customer_revenue: number;
    projected_returning_revenue: number;
    projected_gross_profit: number;
    projected_contribution_margin: number;
    projected_orders: number;
    projected_new_customers: number;
    projected_returning_orders: number;
    projected_returning_customers: number;
  };
  diagnostics: {
    valid_transactions: number;
    ignored_future_transactions: number;
    lapsed_customers: number;
    recent_window_days: number;
    active_window_days: number;
    trailing_window_days: number;
    returning_projection_scale: number;
  };
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type PreparedTransaction = {
  customer_id: string;
  transaction_date: string;
  time: number;
  acquisition_time: number;
  is_first_purchase: boolean;
  revenue: number | null;
  gross_profit: number | null;
};

type SegmentKey = Exclude<ForecastCohortKey, "new_customers"> | "lapsed";

const DAY_MS = 86_400_000;

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseDate(value: unknown): Date | null {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function monthEndIso(startIso: string): string {
  const date = new Date(`${startIso}T00:00:00Z`);
  return isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.floor((end - start) / DAY_MS) + 1;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(value: unknown): number {
  return Math.max(0, finiteNumber(value) ?? 0);
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function rate01(value: unknown): number {
  const n = finiteNumber(value);
  if (n === null || n <= 0) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function whole(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function prepareTransactions(transactions: CustomerTransaction[], periodStart: string): {
  prepared: PreparedTransaction[];
  ignoredFuture: number;
} {
  const periodStartTime = new Date(`${periodStart}T00:00:00Z`).getTime();
  const valid = (Array.isArray(transactions) ? transactions : [])
    .map((tx) => {
      const customerId = cleanText(tx.customer_id);
      const date = parseDate(tx.transaction_date);
      if (!customerId || !date) return null;
      return {
        tx,
        customer_id: customerId,
        transaction_date: isoDate(date),
        time: date.getTime(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.time - b.time || a.customer_id.localeCompare(b.customer_id));

  const ignoredFuture = valid.filter((row) => row.time >= periodStartTime).length;
  const historical = valid.filter((row) => row.time < periodStartTime);
  const acquisitionByCustomer = new Map<string, number>();

  for (const row of historical) {
    if (!acquisitionByCustomer.has(row.customer_id)) {
      acquisitionByCustomer.set(row.customer_id, row.time);
    }
  }

  return {
    prepared: historical.map((row) => {
      const acquisitionTime = acquisitionByCustomer.get(row.customer_id) ?? row.time;
      return {
        customer_id: row.customer_id,
        transaction_date: row.transaction_date,
        time: row.time,
        acquisition_time: acquisitionTime,
        is_first_purchase: row.time === acquisitionTime,
        revenue: finiteNumber(row.tx.revenue),
        gross_profit: finiteNumber(row.tx.gross_profit),
      };
    }),
    ignoredFuture,
  };
}

function segmentCustomers(
  prepared: PreparedTransaction[],
  periodStartTime: number,
  recentWindowDays: number,
  activeWindowDays: number,
): Map<string, SegmentKey> {
  const acquisition = new Map<string, number>();
  const lastPurchase = new Map<string, number>();

  for (const tx of prepared) {
    const first = acquisition.get(tx.customer_id);
    if (first === undefined || tx.acquisition_time < first) acquisition.set(tx.customer_id, tx.acquisition_time);
    const last = lastPurchase.get(tx.customer_id);
    if (last === undefined || tx.time > last) lastPurchase.set(tx.customer_id, tx.time);
  }

  const recentCutoff = periodStartTime - recentWindowDays * DAY_MS;
  const activeCutoff = periodStartTime - activeWindowDays * DAY_MS;
  const segments = new Map<string, SegmentKey>();

  for (const [customerId, acquisitionTime] of acquisition.entries()) {
    const lastTime = lastPurchase.get(customerId) ?? acquisitionTime;
    if (acquisitionTime >= recentCutoff) {
      segments.set(customerId, "recently_acquired_180d");
    } else if (lastTime >= activeCutoff) {
      segments.set(customerId, "active_non_recent");
    } else {
      segments.set(customerId, "lapsed");
    }
  }

  return segments;
}

function returningLayer(
  key: Exclude<ForecastCohortKey, "new_customers">,
  label: string,
  prepared: PreparedTransaction[],
  segments: Map<string, SegmentKey>,
  trailingStartTime: number,
  scale: number,
  grossMarginRate: number,
  missingData: string[],
  risks: string[],
  conditions: string[],
): ForecastCohortLayer {
  const segmentCustomers = Array.from(segments.entries())
    .filter(([, segment]) => segment === key)
    .map(([customerId]) => customerId);
  const segmentCustomerSet = new Set(segmentCustomers);
  const trailing = prepared.filter((tx) => (
    segmentCustomerSet.has(tx.customer_id) &&
    !tx.is_first_purchase &&
    tx.time >= trailingStartTime
  ));
  const trailingRevenueRows = trailing.filter((tx) => tx.revenue !== null);
  const trailingGrossRows = trailing.filter((tx) => tx.gross_profit !== null);
  const trailingRevenue = money(trailingRevenueRows.reduce((sum, tx) => sum + (tx.revenue ?? 0), 0));
  const projectedRevenue = money(trailingRevenue * scale);
  const trailingGrossProfit = trailingGrossRows.length === trailing.length
    ? money(trailingGrossRows.reduce((sum, tx) => sum + (tx.gross_profit ?? 0), 0))
    : null;
  const projectedGrossProfit = trailingGrossProfit !== null
    ? money(trailingGrossProfit * scale)
    : money(projectedRevenue * grossMarginRate);
  const projectedOrders = whole(trailing.length * scale);
  const activeCustomers = new Set(trailing.map((tx) => tx.customer_id)).size;
  const confidence = trailing.length >= 8 && trailingGrossProfit !== null
    ? 0.7
    : trailing.length >= 3
      ? 0.55
      : segmentCustomers.length > 0
        ? 0.35
        : 0.2;

  if (segmentCustomers.length > 0 && trailing.length === 0) {
    conditions.push(`${label}: no returning orders in trailing window; projection is zero until more repeat data exists.`);
  }
  if (trailing.length > 0 && trailingRevenueRows.length < trailing.length) {
    missingData.push(`${key}.revenue`);
  }
  if (trailing.length > 0 && trailingGrossProfit === null && grossMarginRate <= 0) {
    missingData.push(`${key}.gross_profit or gross_margin_rate`);
  }
  if (trailing.length > 0 && trailing.length < 3) {
    risks.push(`${label}: returning forecast is based on fewer than 3 repeat orders.`);
  }

  return {
    key,
    label,
    customer_count: segmentCustomers.length,
    active_customer_count: activeCustomers,
    trailing_returning_orders: trailing.length,
    trailing_returning_revenue: trailingRevenue,
    trailing_returning_gross_profit: trailingGrossProfit,
    projected_orders: projectedOrders,
    projected_revenue: projectedRevenue,
    projected_gross_profit: projectedGrossProfit,
    contribution_after_ads: projectedGrossProfit,
    confidence,
    formula_used: "projected returning revenue = trailing repeat revenue * (forecast days / trailing window days)",
  };
}

export function runThreeCohortForecast(input: ThreeCohortForecastInput): ThreeCohortForecastOutput {
  const periodStartDate = parseDate(input.period_start);
  if (!periodStartDate) throw new Error("period_start is required.");
  const periodStart = isoDate(periodStartDate);
  const periodEnd = input.period_end ? isoDate(parseDate(input.period_end) ?? new Date(`${monthEndIso(periodStart)}T00:00:00Z`)) : monthEndIso(periodStart);
  const horizonDays = daysBetweenInclusive(periodStart, periodEnd);
  const recentWindowDays = positiveInt(input.recent_window_days, 180);
  const activeWindowDays = positiveInt(input.active_window_days, 365);
  const trailingWindowDays = positiveInt(input.trailing_window_days, 90);
  const periodStartTime = periodStartDate.getTime();
  const trailingStartTime = periodStartTime - trailingWindowDays * DAY_MS;
  const scale = horizonDays / trailingWindowDays;
  const grossMarginRate = rate01(input.gross_margin_rate);
  const missingData: string[] = [];
  const risks: string[] = [];
  const conditions: string[] = [];
  const { prepared, ignoredFuture } = prepareTransactions(input.transactions, periodStart);
  const segments = segmentCustomers(prepared, periodStartTime, recentWindowDays, activeWindowDays);
  const plannedNewCustomers = whole(nonNegative(input.planned_new_customers));
  const plannedNewRevenue = money(nonNegative(input.planned_new_customer_revenue));
  const plannedAdSpend = money(nonNegative(input.planned_ad_spend));

  if (prepared.length === 0) {
    missingData.push("transactions");
    conditions.push("Import normalized customer transactions to activate recently acquired and active non-recent forecasts.");
  }
  if (plannedNewCustomers <= 0) missingData.push("planned_new_customers");
  if (plannedNewRevenue <= 0) missingData.push("planned_new_customer_revenue");
  if (grossMarginRate <= 0) missingData.push("gross_margin_rate");
  if (ignoredFuture > 0) conditions.push(`${ignoredFuture} transaction(s) on or after period_start were ignored for forecast training.`);

  const newGrossProfit = money(plannedNewRevenue * grossMarginRate);
  const newCustomers: ForecastCohortLayer = {
    key: "new_customers",
    label: "New customers",
    customer_count: plannedNewCustomers,
    active_customer_count: plannedNewCustomers,
    trailing_returning_orders: 0,
    trailing_returning_revenue: 0,
    trailing_returning_gross_profit: null,
    projected_orders: plannedNewCustomers,
    projected_revenue: plannedNewRevenue,
    projected_gross_profit: newGrossProfit,
    contribution_after_ads: money(newGrossProfit - plannedAdSpend),
    confidence: plannedNewCustomers > 0 && plannedNewRevenue > 0 && grossMarginRate > 0 ? 0.7 : 0.35,
    formula_used: "planned new customer revenue from Profit Plan acquisition layer",
  };
  const recent = returningLayer(
    "recently_acquired_180d",
    "Recently acquired 180d",
    prepared,
    segments,
    trailingStartTime,
    scale,
    grossMarginRate,
    missingData,
    risks,
    conditions,
  );
  const activeNonRecent = returningLayer(
    "active_non_recent",
    "Active non-recent",
    prepared,
    segments,
    trailingStartTime,
    scale,
    grossMarginRate,
    missingData,
    risks,
    conditions,
  );
  const lapsedCustomers = Array.from(segments.values()).filter((segment) => segment === "lapsed").length;
  const projectedReturningRevenue = money(recent.projected_revenue + activeNonRecent.projected_revenue);
  const projectedGrossProfit = money(
    newCustomers.projected_gross_profit + recent.projected_gross_profit + activeNonRecent.projected_gross_profit,
  );
  const projectedOrders = whole(newCustomers.projected_orders + recent.projected_orders + activeNonRecent.projected_orders);
  const projectedReturningOrders = whole(recent.projected_orders + activeNonRecent.projected_orders);
  const projectedReturningCustomers = recent.customer_count + activeNonRecent.customer_count;

  if (lapsedCustomers > 0) {
    conditions.push(`${lapsedCustomers} customer(s) are lapsed outside the active window and excluded from the base forecast.`);
  }

  const totals = {
    projected_revenue: money(newCustomers.projected_revenue + projectedReturningRevenue),
    projected_new_customer_revenue: newCustomers.projected_revenue,
    projected_returning_revenue: projectedReturningRevenue,
    projected_gross_profit: projectedGrossProfit,
    projected_contribution_margin: money(projectedGrossProfit - plannedAdSpend),
    projected_orders: projectedOrders,
    projected_new_customers: plannedNewCustomers,
    projected_returning_orders: projectedReturningOrders,
    projected_returning_customers: projectedReturningCustomers,
  };
  const summary = `Three-cohort forecast v1 - new ${totals.projected_new_customer_revenue} - returning ${totals.projected_returning_revenue} - total ${totals.projected_revenue}.`;

  return {
    engine_version: THREE_COHORT_FORECAST_VERSION,
    period_start: periodStart,
    period_end: periodEnd,
    horizon_days: horizonDays,
    cohorts: {
      new_customers: newCustomers,
      recently_acquired_180d: recent,
      active_non_recent: activeNonRecent,
    },
    totals,
    diagnostics: {
      valid_transactions: prepared.length,
      ignored_future_transactions: ignoredFuture,
      lapsed_customers: lapsedCustomers,
      recent_window_days: recentWindowDays,
      active_window_days: activeWindowDays,
      trailing_window_days: trailingWindowDays,
      returning_projection_scale: Number(scale.toFixed(4)),
    },
    missing_data: unique(missingData),
    risks: unique(risks),
    conditions: unique(conditions),
    summary,
  };
}
