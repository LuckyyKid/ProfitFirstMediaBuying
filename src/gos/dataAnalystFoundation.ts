import { buildCustomerCohortAnalysis, type CustomerTransaction } from "./customerCohorts";
import { computeActualVsProjectionPct, effectiveProjectionValue } from "./projectionAudit";

export type AnalystCheckStatus = "pass" | "warn" | "fail";
export type AnalystSeverity = "info" | "success" | "warning" | "critical";
export type AnalystReadiness = "BLOCKED" | "NEEDS_WORK" | "READY_FOR_BASIC_ANALYSIS" | "READY_FOR_ADVANCED_ANALYSIS";

export type AnalystCheck = {
  id: string;
  label: string;
  status: AnalystCheckStatus;
  severity: AnalystSeverity;
  detail: string;
  recommendation: string;
};

export type AnalystSignal = {
  id: string;
  label: string;
  severity: AnalystSeverity;
  value: string;
  interpretation: string;
  next_action: string;
};

export type AnalystDailyRow = {
  id?: string;
  target_date: string;
  target_revenue?: number | null;
  target_ad_spend?: number | null;
  target_orders?: number | null;
  target_leads?: number | null;
  projection_revenue?: number | null;
  projection_ad_spend?: number | null;
  projection_orders?: number | null;
  projection_leads?: number | null;
  actual_revenue?: number | null;
  actual_ad_spend?: number | null;
  actual_orders?: number | null;
  actual_leads?: number | null;
};

export type AnalystProjectionUpdate = {
  id?: string;
  scope: "daily" | "weekly" | string;
  metric_name: string;
  created_at: string;
};

export type DataAnalystFoundationInput = {
  transactions: CustomerTransaction[];
  dailyTargets: AnalystDailyRow[];
  projectionUpdates: AnalystProjectionUpdate[];
  nowIso?: string;
};

export type DataAnalystFoundationOutput = {
  engine_version: "data_analyst_foundation_v1";
  generated_at: string;
  score: number;
  readiness: AnalystReadiness;
  coverage: {
    transactions: number;
    valid_transactions: number;
    unique_customers: number;
    acquisition_cohorts: number;
    cohort_age_columns: number;
    revenue_coverage_pct: number;
    gross_profit_coverage_pct: number;
    daily_rows: number;
    daily_actual_coverage_pct: number;
    daily_projection_coverage_pct: number;
    projection_updates_14d: number;
  };
  checks: AnalystCheck[];
  signals: AnalystSignal[];
  model_card: {
    purpose: string;
    inputs: string[];
    assumptions: string[];
    limitations: string[];
    next_statistical_upgrade: string[];
  };
  summary: string;
};

const DAY_MS = 86_400_000;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: string | null | undefined): Date | null {
  const raw = String(value ?? "").slice(0, 10);
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function pct(part: number, total: number): number {
  return total > 0 ? round((part / total) * 100, 1) : 0;
}

function statusFromPct(value: number, warnAt: number, passAt: number): AnalystCheckStatus {
  if (value >= passAt) return "pass";
  if (value >= warnAt) return "warn";
  return "fail";
}

function severityFromStatus(status: AnalystCheckStatus, failSeverity: AnalystSeverity = "critical"): AnalystSeverity {
  if (status === "pass") return "success";
  if (status === "warn") return "warning";
  return failSeverity;
}

function sumDaily(rows: AnalystDailyRow[], key: keyof AnalystDailyRow): number {
  return rows.reduce((sum, row) => sum + Number(optionalNumber(row[key]) ?? 0), 0);
}

function dailyRowsWithActual(rows: AnalystDailyRow[]): AnalystDailyRow[] {
  return rows.filter((row) => (
    row.actual_revenue != null
    || row.actual_ad_spend != null
    || row.actual_orders != null
    || row.actual_leads != null
  ));
}

function dailyRowsWithProjection(rows: AnalystDailyRow[]): AnalystDailyRow[] {
  return rows.filter((row) => (
    row.projection_revenue != null
    || row.projection_ad_spend != null
    || row.projection_orders != null
    || row.projection_leads != null
  ));
}

function scoreForThreshold(count: number, low: number, mid: number, high: number, points: number): number {
  if (count >= high) return points;
  if (count >= mid) return points * 0.7;
  if (count >= low) return points * 0.35;
  return 0;
}

export function runDataAnalystFoundation(
  input: DataAnalystFoundationInput,
): DataAnalystFoundationOutput {
  const generatedAt = input.nowIso ?? new Date().toISOString();
  const now = new Date(generatedAt);
  const transactions = input.transactions ?? [];
  const validTransactions = transactions.filter((tx) => tx.customer_id?.trim() && toDate(tx.transaction_date));
  const uniqueCustomers = new Set(validTransactions.map((tx) => tx.customer_id.trim())).size;
  const revenueRows = validTransactions.filter((tx) => tx.revenue != null).length;
  const grossProfitRows = validTransactions.filter((tx) => tx.gross_profit != null).length;

  const cohort = buildCustomerCohortAnalysis(validTransactions, { cadence: "month", metric: "customers" });
  const dailyTargets = input.dailyTargets ?? [];
  const actualRows = dailyRowsWithActual(dailyTargets);
  const projectionRows = dailyRowsWithProjection(dailyTargets);

  const projectionUpdates14d = (input.projectionUpdates ?? []).filter((update) => {
    const created = new Date(update.created_at);
    return Number.isFinite(created.getTime()) && ((now.getTime() - created.getTime()) / DAY_MS) <= 14;
  }).length;

  const revenueCoveragePct = pct(revenueRows, validTransactions.length);
  const grossProfitCoveragePct = pct(grossProfitRows, validTransactions.length);
  const actualCoveragePct = pct(actualRows.length, dailyTargets.length);
  const projectionCoveragePct = pct(projectionRows.length, dailyTargets.length);

  const checks: AnalystCheck[] = [];
  const addCheck = (
    id: string,
    label: string,
    status: AnalystCheckStatus,
    detail: string,
    recommendation: string,
    failSeverity: AnalystSeverity = "critical",
  ) => {
    checks.push({
      id,
      label,
      status,
      severity: severityFromStatus(status, failSeverity),
      detail,
      recommendation,
    });
  };

  addCheck(
    "transactions_present",
    "Transaction dataset present",
    validTransactions.length > 0 ? "pass" : "fail",
    `${validTransactions.length} valid transaction row(s).`,
    "Connect integrations or enter manual transactions with customer_id and transaction_date.",
  );

  addCheck(
    "cohort_depth",
    "Cohort depth",
    cohort.acquisition_cohorts.length >= 3 && cohort.age_columns.length >= 3
      ? "pass"
      : cohort.acquisition_cohorts.length >= 2
        ? "warn"
        : "fail",
    `${cohort.acquisition_cohorts.length} acquisition cohort(s), ${cohort.age_columns.length} age column(s).`,
    "Build at least 3 acquisition cohorts and 3 post-acquisition periods before treating cohort patterns as stable.",
    "warning",
  );

  addCheck(
    "customer_sample",
    "Customer sample size",
    uniqueCustomers >= 100 ? "pass" : uniqueCustomers >= 30 ? "warn" : "fail",
    `${uniqueCustomers} unique customer(s).`,
    "Use directional analysis below 100 customers; avoid advanced retention forecasting until the sample is larger.",
    "warning",
  );

  const revenueStatus = statusFromPct(revenueCoveragePct, 60, 85);
  addCheck(
    "revenue_coverage",
    "Revenue coverage",
    revenueStatus,
    `${revenueCoveragePct}% of valid transactions include revenue.`,
    "Map order revenue from integrations or require manual revenue entry for cohort value analysis.",
    "warning",
  );

  const grossProfitStatus = statusFromPct(grossProfitCoveragePct, 40, 75);
  addCheck(
    "gross_profit_coverage",
    "Gross profit coverage",
    grossProfitStatus,
    `${grossProfitCoveragePct}% of valid transactions include gross profit.`,
    "Add gross profit or contribution data before making CAC/LTV budget decisions from cohorts.",
    "warning",
  );

  addCheck(
    "daily_targets",
    "Daily P&L target rows",
    dailyTargets.length >= 7 ? "pass" : dailyTargets.length > 0 ? "warn" : "fail",
    `${dailyTargets.length} daily P&L row(s).`,
    "Generate daily P&L rows from weekly targets so the analyst layer can compare target, projection, and actual.",
  );

  addCheck(
    "actual_coverage",
    "Actual coverage",
    statusFromPct(actualCoveragePct, 35, 70),
    `${actualCoveragePct}% of daily rows include at least one actual metric.`,
    "Sync integrations or enter actuals daily; without actuals the analyst layer can only evaluate plan quality.",
    "warning",
  );

  addCheck(
    "projection_coverage",
    "Projection coverage",
    statusFromPct(projectionCoveragePct, 35, 70),
    `${projectionCoveragePct}% of daily rows include explicit projections.`,
    "Use projection edits for AM forecast changes instead of modifying targets.",
    "warning",
  );

  addCheck(
    "projection_audit",
    "Projection audit trail",
    projectionUpdates14d > 0 ? "pass" : "warn",
    `${projectionUpdates14d} projection update(s) in the last 14 days.`,
    "Edit projections through the P&L workflow so changes are captured in gos_projection_updates.",
    "warning",
  );

  let score = 0;
  score += validTransactions.length > 0 ? 12 : 0;
  score += scoreForThreshold(uniqueCustomers, 10, 30, 100, 14);
  score += cohort.acquisition_cohorts.length >= 3 ? 10 : cohort.acquisition_cohorts.length >= 2 ? 5 : 0;
  score += cohort.age_columns.length >= 3 ? 8 : cohort.age_columns.length >= 2 ? 4 : 0;
  score += revenueCoveragePct >= 85 ? 10 : revenueCoveragePct >= 60 ? 6 : revenueCoveragePct > 0 ? 3 : 0;
  score += grossProfitCoveragePct >= 75 ? 8 : grossProfitCoveragePct >= 40 ? 5 : grossProfitCoveragePct > 0 ? 2 : 0;
  score += dailyTargets.length >= 7 ? 12 : dailyTargets.length > 0 ? 6 : 0;
  score += actualCoveragePct >= 70 ? 14 : actualCoveragePct >= 35 ? 8 : actualCoveragePct > 0 ? 3 : 0;
  score += projectionCoveragePct >= 70 ? 8 : projectionCoveragePct >= 35 ? 5 : projectionCoveragePct > 0 ? 2 : 0;
  score += projectionUpdates14d > 0 ? 4 : 0;
  score = Math.round(clamp(score));

  const criticalFails = checks.filter((check) => check.status === "fail" && check.severity === "critical").length;
  const readiness: AnalystReadiness = criticalFails > 1
    ? "BLOCKED"
    : score >= 85
      ? "READY_FOR_ADVANCED_ANALYSIS"
      : score >= 70
        ? "READY_FOR_BASIC_ANALYSIS"
        : score >= 45
          ? "NEEDS_WORK"
          : "BLOCKED";

  const signals: AnalystSignal[] = [];
  if (actualRows.length > 0) {
    const actualRevenue = sumDaily(actualRows, "actual_revenue");
    const projectionRevenue = actualRows.reduce(
      (sum, row) => sum + Number(effectiveProjectionValue(row.projection_revenue, row.target_revenue) ?? 0),
      0,
    );
    const actualSpend = sumDaily(actualRows, "actual_ad_spend");
    const projectionSpend = actualRows.reduce(
      (sum, row) => sum + Number(effectiveProjectionValue(row.projection_ad_spend, row.target_ad_spend) ?? 0),
      0,
    );
    const revenueVariance = computeActualVsProjectionPct(projectionRevenue, null, actualRevenue);
    const spendVariance = computeActualVsProjectionPct(projectionSpend, null, actualSpend);

    if (revenueVariance !== null) {
      signals.push({
        id: "revenue_vs_projection",
        label: "Revenue vs projection",
        severity: revenueVariance < -10 ? "critical" : revenueVariance < -3 ? "warning" : "success",
        value: `${revenueVariance > 0 ? "+" : ""}${revenueVariance}%`,
        interpretation: `Actual revenue is ${Math.abs(revenueVariance)}% ${revenueVariance >= 0 ? "above" : "below"} projection on rows with actuals.`,
        next_action: revenueVariance < -10
          ? "Review media spend, offer pressure, conversion rate, and inventory constraints today."
          : "Keep monitoring against projection as new actuals arrive.",
      });
    }

    if (spendVariance !== null) {
      signals.push({
        id: "spend_vs_projection",
        label: "Spend vs projection",
        severity: spendVariance > 10 ? "warning" : "info",
        value: `${spendVariance > 0 ? "+" : ""}${spendVariance}%`,
        interpretation: `Actual ad spend is ${Math.abs(spendVariance)}% ${spendVariance >= 0 ? "above" : "below"} projection.`,
        next_action: spendVariance > 10
          ? "Confirm spend increase is intentional and contribution-positive."
          : "Use this as pacing context, not a standalone decision.",
      });
    }
  }

  signals.push({
    id: "cohort_readiness",
    label: "Cohort readiness",
    severity: cohort.acquisition_cohorts.length >= 3 && uniqueCustomers >= 30 ? "success" : "warning",
    value: `${cohort.acquisition_cohorts.length} cohorts / ${uniqueCustomers} customers`,
    interpretation: cohort.acquisition_cohorts.length >= 3
      ? "Cohort structure is available for directional survival and retention analysis."
      : "Cohort reads are not stable yet; treat them as setup validation.",
    next_action: "Keep customer_id and transaction_date flowing from integrations or AM manual entry.",
  });

  if (grossProfitCoveragePct < 75) {
    signals.push({
      id: "gross_profit_gap",
      label: "Gross profit gap",
      severity: "warning",
      value: `${grossProfitCoveragePct}% coverage`,
      interpretation: "Revenue cohorts exist, but profit-aware LTV and CAC guardrails are weak.",
      next_action: "Map COGS/gross profit by order or SKU before using LTV to raise CAC limits.",
    });
  }

  const modelCard = {
    purpose: "Determine whether client data is ready for analyst interpretation and identify the highest-priority data gaps.",
    inputs: [
      "gos_customer_transactions",
      "gos_daily_pnl_targets target/projection/actual fields",
      "gos_projection_updates",
    ],
    assumptions: [
      "customer_id identifies a unique customer across transactions",
      "transaction_date is the commercial purchase date",
      "projection_* is the latest AM forecast and target_* is the committed plan",
      "actual_* is either integration-fed or manually entered realized performance",
    ],
    limitations: [
      "No statistical confidence interval is produced in this TypeScript runtime layer",
      "Small samples are directional only",
      "Gross-profit analysis is limited when transaction gross_profit is missing",
      "Projection audit depends on database triggers being active",
    ],
    next_statistical_upgrade: [
      "retention curve fitting",
      "outlier detection",
      "spend-to-efficiency regression",
      "confidence intervals and backtesting",
    ],
  };

  return {
    engine_version: "data_analyst_foundation_v1",
    generated_at: generatedAt,
    score,
    readiness,
    coverage: {
      transactions: transactions.length,
      valid_transactions: validTransactions.length,
      unique_customers: uniqueCustomers,
      acquisition_cohorts: cohort.acquisition_cohorts.length,
      cohort_age_columns: cohort.age_columns.length,
      revenue_coverage_pct: revenueCoveragePct,
      gross_profit_coverage_pct: grossProfitCoveragePct,
      daily_rows: dailyTargets.length,
      daily_actual_coverage_pct: actualCoveragePct,
      daily_projection_coverage_pct: projectionCoveragePct,
      projection_updates_14d: projectionUpdates14d,
    },
    checks,
    signals,
    model_card: modelCard,
    summary: `${readiness} - score ${score}/100 - ${validTransactions.length} valid transaction(s), ${dailyTargets.length} daily P&L row(s), ${projectionUpdates14d} recent projection update(s).`,
  };
}
