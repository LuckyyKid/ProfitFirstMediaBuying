export type CohortCadence = "week" | "month" | "quarter";

export type CohortMetric = "customers" | "orders" | "revenue" | "gross_profit" | "avg_lifetime_revenue";

export type CustomerTransaction = {
  customer_id: string;
  transaction_date: string;
  order_id?: string | null;
  revenue?: number | null;
  gross_profit?: number | null;
  acquisition_channel?: string | null;
  product_key?: string | null;
  segment_key?: string | null;
  source?: "integration" | "manual" | string | null;
};

export type PreparedCustomerTransaction = CustomerTransaction & {
  transaction_period: string;
  transaction_period_index: number;
  acquisition_date: string;
  acquisition_cohort: string;
  acquisition_period_index: number;
  age_index: number;
};

export type CohortCell = {
  acquisition_cohort: string;
  transaction_period: string;
  age_index: number;
  customers: number;
  orders: number;
  revenue: number;
  gross_profit: number;
  survival_rate: number | null;
  avg_lifetime_revenue: number | null;
};

export type AcquisitionCohortSummary = {
  acquisition_cohort: string;
  acquisition_period_index: number;
  acquisition_size: number;
  first_purchase_revenue: number;
  first_purchase_gross_profit: number;
};

export type PeriodRetentionSummary = {
  transaction_period: string;
  transaction_period_index: number;
  active_customers: number;
  cumulative_acquired_customers: number;
  retention_rate: number | null;
  revenue: number;
  gross_profit: number;
};

export type CustomerCohortAnalysis = {
  cadence: CohortCadence;
  metric: CohortMetric;
  prepared_transactions: PreparedCustomerTransaction[];
  acquisition_cohorts: AcquisitionCohortSummary[];
  age_columns: number[];
  period_columns: string[];
  cells: CohortCell[];
  survival_matrix: Record<string, Record<number, number | null>>;
  metric_matrix: Record<string, Record<number, number>>;
  period_retention: PeriodRetentionSummary[];
  seasonality_diagonal: PeriodRetentionSummary[];
  risks: string[];
  conditions: string[];
  summary: string;
};

export type CustomerCohortOptions = {
  cadence?: CohortCadence;
  metric?: CohortMetric;
  segmentKey?: keyof Pick<CustomerTransaction, "acquisition_channel" | "product_key" | "segment_key" | "source">;
  segmentValue?: string;
};

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;

function cleanId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id ? id : null;
}

function toDate(value: string): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const d = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoWeekStart(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = out.getUTCDay() || 7;
  out.setUTCDate(out.getUTCDate() - day + 1);
  return out;
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const isoYear = tmp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${isoYear}-W${pad2(week)}`;
}

function periodKey(d: Date, cadence: CohortCadence): string {
  const year = d.getUTCFullYear();
  if (cadence === "week") return isoWeekKey(d);
  if (cadence === "quarter") return `${year}-Q${Math.ceil((d.getUTCMonth() + 1) / 3)}`;
  return `${year}-${pad2(d.getUTCMonth() + 1)}`;
}

function periodIndex(d: Date, cadence: CohortCadence): number {
  const year = d.getUTCFullYear();
  if (cadence === "week") return Math.floor(isoWeekStart(d).getTime() / WEEK_MS);
  if (cadence === "quarter") return year * 4 + Math.ceil((d.getUTCMonth() + 1) / 3) - 1;
  return year * 12 + d.getUTCMonth();
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 2): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function metricValue(cell: CohortCell, metric: CohortMetric): number {
  if (metric === "orders") return cell.orders;
  if (metric === "revenue") return round(cell.revenue, 2);
  if (metric === "gross_profit") return round(cell.gross_profit, 2);
  if (metric === "avg_lifetime_revenue") return round(cell.avg_lifetime_revenue ?? 0, 2);
  return cell.customers;
}

export function prepareCustomerCohortTransactions(
  transactions: CustomerTransaction[],
  cadence: CohortCadence = "month",
): PreparedCustomerTransaction[] {
  const valid = transactions
    .map((tx) => ({ tx, customerId: cleanId(tx.customer_id), date: toDate(tx.transaction_date) }))
    .filter((row): row is { tx: CustomerTransaction; customerId: string; date: Date } => Boolean(row.customerId && row.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.customerId.localeCompare(b.customerId));

  const acquisitionByCustomer = new Map<string, Date>();
  for (const row of valid) {
    const current = acquisitionByCustomer.get(row.customerId);
    if (!current || row.date < current) acquisitionByCustomer.set(row.customerId, row.date);
  }

  return valid.map(({ tx, customerId, date }) => {
    const acquisitionDate = acquisitionByCustomer.get(customerId) ?? date;
    const tIndex = periodIndex(date, cadence);
    const aIndex = periodIndex(acquisitionDate, cadence);
    return {
      ...tx,
      customer_id: customerId,
      transaction_date: isoDate(date),
      transaction_period: periodKey(date, cadence),
      transaction_period_index: tIndex,
      acquisition_date: isoDate(acquisitionDate),
      acquisition_cohort: periodKey(acquisitionDate, cadence),
      acquisition_period_index: aIndex,
      age_index: Math.max(0, tIndex - aIndex),
    };
  });
}

export function buildCustomerCohortAnalysis(
  transactions: CustomerTransaction[],
  options: CustomerCohortOptions = {},
): CustomerCohortAnalysis {
  const cadence = options.cadence ?? "month";
  const metric = options.metric ?? "customers";
  const filtered = options.segmentKey && options.segmentValue
    ? transactions.filter((tx) => String(tx[options.segmentKey!] ?? "") === options.segmentValue)
    : transactions;
  const prepared = prepareCustomerCohortTransactions(filtered, cadence);
  const risks: string[] = [];
  const conditions: string[] = [];

  const cohortCustomers = new Map<string, Set<string>>();
  const firstPurchaseRevenue = new Map<string, number>();
  const firstPurchaseGrossProfit = new Map<string, number>();
  const periodActiveCustomers = new Map<string, Set<string>>();
  const periodRevenue = new Map<string, number>();
  const periodGrossProfit = new Map<string, number>();
  const cellCustomers = new Map<string, Set<string>>();
  const cellOrders = new Map<string, number>();
  const cellRevenue = new Map<string, number>();
  const cellGrossProfit = new Map<string, number>();
  const periodIndexByKey = new Map<string, number>();
  const cohortIndexByKey = new Map<string, number>();

  for (const tx of prepared) {
    cohortIndexByKey.set(tx.acquisition_cohort, tx.acquisition_period_index);
    periodIndexByKey.set(tx.transaction_period, tx.transaction_period_index);

    if (!cohortCustomers.has(tx.acquisition_cohort)) cohortCustomers.set(tx.acquisition_cohort, new Set());
    cohortCustomers.get(tx.acquisition_cohort)!.add(tx.customer_id);

    if (tx.age_index === 0) {
      firstPurchaseRevenue.set(tx.acquisition_cohort, (firstPurchaseRevenue.get(tx.acquisition_cohort) ?? 0) + money(tx.revenue));
      firstPurchaseGrossProfit.set(tx.acquisition_cohort, (firstPurchaseGrossProfit.get(tx.acquisition_cohort) ?? 0) + money(tx.gross_profit));
    }

    if (!periodActiveCustomers.has(tx.transaction_period)) periodActiveCustomers.set(tx.transaction_period, new Set());
    periodActiveCustomers.get(tx.transaction_period)!.add(tx.customer_id);
    periodRevenue.set(tx.transaction_period, (periodRevenue.get(tx.transaction_period) ?? 0) + money(tx.revenue));
    periodGrossProfit.set(tx.transaction_period, (periodGrossProfit.get(tx.transaction_period) ?? 0) + money(tx.gross_profit));

    const key = `${tx.acquisition_cohort}::${tx.transaction_period}::${tx.age_index}`;
    if (!cellCustomers.has(key)) cellCustomers.set(key, new Set());
    cellCustomers.get(key)!.add(tx.customer_id);
    cellOrders.set(key, (cellOrders.get(key) ?? 0) + 1);
    cellRevenue.set(key, (cellRevenue.get(key) ?? 0) + money(tx.revenue));
    cellGrossProfit.set(key, (cellGrossProfit.get(key) ?? 0) + money(tx.gross_profit));
  }

  const acquisitionCohorts = Array.from(cohortCustomers.entries())
    .map(([acquisition_cohort, customers]) => ({
      acquisition_cohort,
      acquisition_period_index: cohortIndexByKey.get(acquisition_cohort) ?? 0,
      acquisition_size: customers.size,
      first_purchase_revenue: round(firstPurchaseRevenue.get(acquisition_cohort) ?? 0, 2),
      first_purchase_gross_profit: round(firstPurchaseGrossProfit.get(acquisition_cohort) ?? 0, 2),
    }))
    .sort((a, b) => a.acquisition_period_index - b.acquisition_period_index);

  const cells = Array.from(cellCustomers.entries())
    .map(([key, customers]) => {
      const [acquisition_cohort, transaction_period, ageRaw] = key.split("::");
      const age_index = Number(ageRaw);
      const acquisitionSize = cohortCustomers.get(acquisition_cohort)?.size ?? 0;
      const revenue = cellRevenue.get(key) ?? 0;
      const customerCount = customers.size;
      return {
        acquisition_cohort,
        transaction_period,
        age_index,
        customers: customerCount,
        orders: cellOrders.get(key) ?? 0,
        revenue: round(revenue, 2),
        gross_profit: round(cellGrossProfit.get(key) ?? 0, 2),
        survival_rate: acquisitionSize > 0 ? round((customerCount / acquisitionSize) * 100, 1) : null,
        avg_lifetime_revenue: customerCount > 0 ? round(revenue / customerCount, 2) : null,
      };
    })
    .sort((a, b) => {
      const cohortDelta = (cohortIndexByKey.get(a.acquisition_cohort) ?? 0) - (cohortIndexByKey.get(b.acquisition_cohort) ?? 0);
      return cohortDelta || a.age_index - b.age_index;
    });

  const ageColumns = Array.from(new Set(cells.map((c) => c.age_index))).sort((a, b) => a - b);
  const periodColumns = Array.from(periodIndexByKey.entries()).sort((a, b) => a[1] - b[1]).map(([key]) => key);

  const survivalMatrix: Record<string, Record<number, number | null>> = {};
  const metricMatrix: Record<string, Record<number, number>> = {};
  for (const cohort of acquisitionCohorts) {
    survivalMatrix[cohort.acquisition_cohort] = {};
    metricMatrix[cohort.acquisition_cohort] = {};
    for (const age of ageColumns) {
      const cell = cells.find((c) => c.acquisition_cohort === cohort.acquisition_cohort && c.age_index === age);
      survivalMatrix[cohort.acquisition_cohort][age] = cell?.survival_rate ?? null;
      metricMatrix[cohort.acquisition_cohort][age] = cell ? metricValue(cell, metric) : 0;
    }
  }

  const cumulativeCustomers = new Set<string>();
  const periodRetention = periodColumns.map((period) => {
    const periodIndexValue = periodIndexByKey.get(period) ?? 0;
    for (const tx of prepared.filter((row) => row.acquisition_period_index <= periodIndexValue)) {
      cumulativeCustomers.add(tx.customer_id);
    }
    const active = periodActiveCustomers.get(period)?.size ?? 0;
    const cumulative = cumulativeCustomers.size;
    return {
      transaction_period: period,
      transaction_period_index: periodIndexValue,
      active_customers: active,
      cumulative_acquired_customers: cumulative,
      retention_rate: cumulative > 0 ? round((active / cumulative) * 100, 1) : null,
      revenue: round(periodRevenue.get(period) ?? 0, 2),
      gross_profit: round(periodGrossProfit.get(period) ?? 0, 2),
    };
  });

  const seasonalityDiagonal = periodRetention.filter((row) => row.active_customers > 0);

  if (prepared.length === 0) conditions.push("No valid transactions. Required fields: customer_id and transaction_date.");
  if (acquisitionCohorts.length < 3) conditions.push("At least 3 acquisition cohorts are recommended before comparing trends.");
  if (ageColumns.length < 3) conditions.push("At least 3 post-acquisition periods are recommended before reading survival curves.");
  const latestRetention = periodRetention.at(-1)?.retention_rate ?? null;
  if (latestRetention !== null && latestRetention < 20) risks.push(`Latest period retention is low (${latestRetention}%).`);

  const summary = prepared.length
    ? `${prepared.length} transactions, ${acquisitionCohorts.length} acquisition cohorts, ${periodColumns.length} ${cadence} periods.`
    : "No cohort analysis available yet.";

  return {
    cadence,
    metric,
    prepared_transactions: prepared,
    acquisition_cohorts: acquisitionCohorts,
    age_columns: ageColumns,
    period_columns: periodColumns,
    cells,
    survival_matrix: survivalMatrix,
    metric_matrix: metricMatrix,
    period_retention: periodRetention,
    seasonality_diagonal: seasonalityDiagonal,
    risks,
    conditions,
    summary,
  };
}

export function buildSegmentedCustomerCohorts(
  transactions: CustomerTransaction[],
  segmentKey: NonNullable<CustomerCohortOptions["segmentKey"]>,
  options: Omit<CustomerCohortOptions, "segmentKey" | "segmentValue"> = {},
): Record<string, CustomerCohortAnalysis> {
  const values = Array.from(new Set(transactions.map((tx) => String(tx[segmentKey] ?? "unknown")))).sort();
  return Object.fromEntries(values.map((value) => [
    value,
    buildCustomerCohortAnalysis(transactions, { ...options, segmentKey, segmentValue: value }),
  ]));
}
