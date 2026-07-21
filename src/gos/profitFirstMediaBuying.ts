// Profit-First Media Buying Engine - v1.1
//
// MVC role: this file is the model layer for PFMB. React pages should collect
// inputs, call this function, render output, and persist the JSON result.
//
// The engine is deterministic and does not need Python. Python/R becomes useful
// when upgrading the regression/MMM layer, not for these unit-economics rules.

import { runSpendingPowerV2, type HistoryPoint, type SpendingPowerV2Output } from "./spendingPowerV2";

export type CohortEconomics = {
  aov_new: number;
  aov_repeat: number;
  cac_new: number;
  cac_repeat: number;
  conversion_rate: number;
  repeat_cycle_months: number;
  churn_per_cycle: number;
  gross_margin_pct: number;
};

export type CashConstraint = {
  cash_available: number;
  monthly_burn: number;
  inventory_days: number;
  payout_delay_days: number;
  safety_months?: number;
};

export type FunnelConstraint = {
  monthly_sessions: number;
  sessions_per_dollar?: number;
};

export type ProfitFirstInput = {
  planned_spend: number;
  history: HistoryPoint[];
  cohort: CohortEconomics;
  cash: CashConstraint;
  funnel: FunnelConstraint;
  target_cac?: number | null;
  target_mer?: number | null;
  horizon_months?: number;
};

export type ProfitFirstOutput = {
  engine_version: "profit_first_media_buying_v1";
  spending_power: SpendingPowerV2Output;

  max_orders_by_funnel: number;
  max_orders_by_spend: number;
  planned_orders: number;
  planned_new_customers: number;
  planned_repeat_orders: number;
  max_spend_by_funnel: number;
  funnel_capacity_ratio: number;

  cash_locked_inventory: number;
  cash_locked_payout: number;
  effective_cash_available: number;
  cash_capped_spend: number;

  ltv_new_horizon: number;
  ltv_new_net_horizon: number;
  contribution_new: number;
  contribution_repeat: number;
  contribution_total: number;
  payback_months_estimate: number | null;

  recommended_spend: number;
  binding_constraint: "CASH" | "FUNNEL" | "REGRESSION" | "PLANNED";
  risks: string[];
  conditions: string[];
  summary: string;
};

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finite(value, fallback));
}

function positive(value: unknown, fallback = 0): number {
  const n = finite(value, fallback);
  return n > 0 ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rate01(value: unknown, fallback = 0): number {
  const n = finite(value, fallback);
  if (n <= 0) return 0;
  return clamp(n > 1 ? n / 100 : n, 0, 1);
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function whole(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function buildCohort(input: CohortEconomics) {
  const marginRate = rate01(input.gross_margin_pct);
  const conversionRate = rate01(input.conversion_rate);
  const churnPerCycle = rate01(input.churn_per_cycle);
  return {
    aovNew: nonNegative(input.aov_new),
    aovRepeat: nonNegative(input.aov_repeat),
    cacNew: nonNegative(input.cac_new),
    cacRepeat: nonNegative(input.cac_repeat),
    conversionRate,
    repeatCycleMonths: Math.max(1, whole(input.repeat_cycle_months || 1)),
    churnPerCycle,
    marginRate,
    cogsRate: clamp(1 - marginRate, 0, 1),
  };
}

function buildCash(input: CashConstraint) {
  return {
    cashAvailable: nonNegative(input.cash_available),
    monthlyBurn: nonNegative(input.monthly_burn),
    inventoryDays: nonNegative(input.inventory_days),
    payoutDelayDays: nonNegative(input.payout_delay_days),
    safetyMonths: Math.max(1, nonNegative(input.safety_months ?? 3)),
  };
}

function buildFunnel(input: FunnelConstraint) {
  return {
    monthlySessions: nonNegative(input.monthly_sessions),
    sessionsPerDollar: positive(input.sessions_per_dollar, 0.5),
  };
}

/**
 * Gross contribution LTV before first acquisition CAC.
 * Repeat reactivation CAC remains included because it is tied to future repeat orders.
 */
export function ltvNewOverHorizon(c: CohortEconomics, horizonMonths: number): number {
  const cohort = buildCohort(c);
  const horizon = Math.max(1, whole(horizonMonths || 12));
  const firstOrderContribution = cohort.aovNew * cohort.marginRate;
  const cycles = Math.floor(horizon / cohort.repeatCycleMonths);

  let cumulative = firstOrderContribution;
  let survival = 1;
  for (let cycle = 1; cycle <= cycles; cycle++) {
    survival *= 1 - cohort.churnPerCycle;
    const repeatContribution = cohort.aovRepeat * cohort.marginRate - cohort.cacRepeat;
    cumulative += survival * repeatContribution;
  }
  return money(cumulative);
}

function estimatePaybackMonths(c: ReturnType<typeof buildCohort>): number | null {
  const firstOrderContribution = c.aovNew * c.marginRate;
  if (c.cacNew <= 0) return null;
  if (firstOrderContribution >= c.cacNew) return 0;

  const retainedContributionPerCycle = (1 - c.churnPerCycle) * (c.aovRepeat * c.marginRate - c.cacRepeat);
  if (retainedContributionPerCycle <= 0) return null;

  const monthlyRepeatContribution = retainedContributionPerCycle / c.repeatCycleMonths;
  if (monthlyRepeatContribution <= 0) return null;
  return money((c.cacNew - firstOrderContribution) / monthlyRepeatContribution);
}

export function runProfitFirstMediaBuying(input: ProfitFirstInput): ProfitFirstOutput {
  const plannedSpend = nonNegative(input.planned_spend);
  const horizon = Math.max(1, whole(input.horizon_months ?? 12));
  const cohort = buildCohort(input.cohort);
  const cash = buildCash(input.cash);
  const funnel = buildFunnel(input.funnel);
  const risks: string[] = [];
  const conditions: string[] = [];

  const sp = runSpendingPowerV2({
    history: Array.isArray(input.history) ? input.history : [],
    planned_spend: plannedSpend,
    target_cac: input.target_cac,
    target_mer: input.target_mer,
    cash_available: cash.cashAvailable,
    monthly_burn: cash.monthlyBurn,
    gross_margin_pct: cohort.marginRate * 100,
  });

  const maxOrdersByFunnel = funnel.monthlySessions * cohort.conversionRate;
  const incrementalSessions = plannedSpend * funnel.sessionsPerDollar;
  const maxOrdersBySpend = incrementalSessions * cohort.conversionRate;
  const plannedOrders = Math.min(maxOrdersBySpend, maxOrdersByFunnel);
  const plannedNewCustomers = Math.max(0, plannedOrders);
  const plannedRepeatOrders = Math.max(0, maxOrdersByFunnel - plannedNewCustomers);
  const funnelRatio = maxOrdersByFunnel > 0 ? maxOrdersBySpend / maxOrdersByFunnel : 0;
  const maxSpendByFunnel = cohort.conversionRate > 0
    ? maxOrdersByFunnel / Math.max(funnel.sessionsPerDollar * cohort.conversionRate, 1e-6)
    : 0;

  const weightedAov = cohort.aovRepeat > 0
    ? (cohort.aovNew + cohort.aovRepeat) / 2
    : cohort.aovNew;
  const dailyRevenueEstimate = (maxOrdersByFunnel * weightedAov) / 30;
  const cashLockedInventory = dailyRevenueEstimate * cohort.cogsRate * cash.inventoryDays;
  const cashLockedPayout = dailyRevenueEstimate * cash.payoutDelayDays;
  const effectiveCash = Math.max(
    0,
    cash.cashAvailable - cash.monthlyBurn * cash.safetyMonths - cashLockedInventory - cashLockedPayout,
  );
  const cashCappedSpend = whole(effectiveCash / cash.safetyMonths);

  const firstOrderContribution = cohort.aovNew * cohort.marginRate;
  const repeatOrderContribution = cohort.aovRepeat * cohort.marginRate - cohort.cacRepeat;
  const ltvNew = ltvNewOverHorizon(input.cohort, horizon);
  const ltvNewNet = ltvNew - cohort.cacNew;
  const contributionNew = plannedNewCustomers * firstOrderContribution - plannedSpend;
  const contributionRepeat = plannedRepeatOrders * repeatOrderContribution;
  const contributionTotal = contributionNew + contributionRepeat;
  const paybackMonths = estimatePaybackMonths(cohort);

  const caps = {
    CASH: cashCappedSpend,
    FUNNEL: whole(maxSpendByFunnel),
    REGRESSION: sp.recommended_spend.high,
  };

  let recommended = plannedSpend;
  let binding: ProfitFirstOutput["binding_constraint"] = "PLANNED";
  for (const [constraint, cap] of Object.entries(caps) as Array<[Exclude<ProfitFirstOutput["binding_constraint"], "PLANNED">, number]>) {
    if (cap < recommended) {
      recommended = cap;
      binding = constraint;
    }
  }
  recommended = whole(Math.max(0, recommended));

  if (cohort.marginRate <= 0) {
    risks.push("Gross margin is missing or zero; contribution and cash capacity are directionally unreliable.");
  }
  if (cohort.conversionRate <= 0) {
    risks.push("Conversion rate is missing or zero; funnel capacity is zero.");
    conditions.push("Set a conversion_rate before scaling spend.");
  }
  if (funnelRatio > 1) {
    risks.push(`Planned spend demands ${(funnelRatio * 100).toFixed(0)}% of funnel capacity; orders are capped by sessions x CVR.`);
    conditions.push("Increase qualified sessions or conversion rate before scaling above the funnel cap.");
  } else if (funnelRatio > 0.85) {
    risks.push(`Funnel capacity is near saturation at ${(funnelRatio * 100).toFixed(0)}%.`);
    conditions.push("Prepare more traffic or conversion-rate lift before increasing spend.");
  }
  if (cashCappedSpend < plannedSpend) {
    risks.push(`Planned spend exceeds effective cash cap (${cashCappedSpend} $) after safety reserve, inventory cost, and payout delay.`);
  }
  if (ltvNew < cohort.cacNew) {
    risks.push(`LTV horizon (${ltvNew.toFixed(0)} $) is below new customer CAC (${cohort.cacNew.toFixed(0)} $).`);
  }
  if (contributionTotal < 0) {
    risks.push(`Monthly contribution is negative (${contributionTotal.toFixed(0)} $) at planned spend.`);
  }

  risks.push(...sp.risks);
  conditions.push(...sp.conditions);

  const summary = `PFMB v1.1 - recommended spend ${recommended} $/month (${binding}) - LTV${horizon}m=${ltvNew.toFixed(0)} $ - net LTV=${ltvNewNet.toFixed(0)} $ - contribution ${contributionTotal.toFixed(0)} $ - funnel ${(funnelRatio * 100).toFixed(0)}%.`;

  return {
    engine_version: "profit_first_media_buying_v1",
    spending_power: sp,
    max_orders_by_funnel: money(maxOrdersByFunnel),
    max_orders_by_spend: money(maxOrdersBySpend),
    planned_orders: money(plannedOrders),
    planned_new_customers: money(plannedNewCustomers),
    planned_repeat_orders: money(plannedRepeatOrders),
    max_spend_by_funnel: whole(maxSpendByFunnel),
    funnel_capacity_ratio: money(funnelRatio),
    cash_locked_inventory: whole(cashLockedInventory),
    cash_locked_payout: whole(cashLockedPayout),
    effective_cash_available: whole(effectiveCash),
    cash_capped_spend: cashCappedSpend,
    ltv_new_horizon: money(ltvNew),
    ltv_new_net_horizon: money(ltvNewNet),
    contribution_new: money(contributionNew),
    contribution_repeat: money(contributionRepeat),
    contribution_total: money(contributionTotal),
    payback_months_estimate: paybackMonths,
    recommended_spend: recommended,
    binding_constraint: binding,
    risks,
    conditions,
    summary,
  };
}
