import Decimal from "decimal.js";

export type SpendEfficiencyObjective =
  | "MAX_FIRST_ORDER_CONTRIBUTION"
  | "MAX_LIFETIME_CONTRIBUTION"
  | "MAX_NEW_CUSTOMER_REVENUE_AT_BREAK_EVEN"
  | "CUSTOM_SPEND";

export type SpendEfficiencyHistoryPoint = {
  period?: string | null;
  spend: number;
  new_customer_revenue: number;
};

export type SpendEfficiencyInput = {
  history: SpendEfficiencyHistoryPoint[];
  objective: SpendEfficiencyObjective;
  contribution_margin_rate?: number | null;
  gross_margin_rate?: number | null;
  cost_of_delivery_rate?: number | null;
  ltv_revenue_multiplier?: number | null;
  target_spend?: number | null;
  min_first_order_contribution?: number | null;
  max_extrapolation_ratio?: number | null;
  step_count?: number | null;
};

export type SpendEfficiencyFit = {
  model_type: "LOG_LINEAR_AMR" | "HISTORICAL_AVERAGE";
  sample_size: number;
  intercept: number | null;
  slope: number | null;
  r_squared: number | null;
  historical_average_amr: number;
  historical_min_spend: number;
  historical_max_spend: number;
};

export type SpendEfficiencyFrontierPoint = {
  spend: number;
  amr: number;
  new_customer_revenue: number;
  contribution_before_ads: number;
  first_order_contribution: number;
  lifetime_revenue: number;
  lifetime_contribution: number;
  first_order_break_even: boolean;
  extrapolation_risk: "IN_SAMPLE" | "MODERATE" | "HIGH";
};

export type SpendEfficiencyFrontierOutput = {
  engine_version: "spend_efficiency_frontier_v1";
  objective: SpendEfficiencyObjective;
  fit: SpendEfficiencyFit;
  selected: SpendEfficiencyFrontierPoint;
  frontier: SpendEfficiencyFrontierPoint[];
  recommended_spend: number;
  recommended_amr: number;
  break_even_amr: number | null;
  contribution_margin_rate: number;
  ltv_revenue_multiplier: number;
  confidence_score: number;
  risks: string[];
  conditions: string[];
  missing_data: string[];
  summary: string;
};

type CleanPoint = SpendEfficiencyHistoryPoint & {
  spend: number;
  new_customer_revenue: number;
  amr: number;
};

type OlsFit = {
  intercept: number;
  slope: number;
  r_squared: number;
};

const ROUNDING = Decimal.ROUND_HALF_UP;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n > 0 ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rate01(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null || n < 0) return null;
  return clamp(n > 1 ? n / 100 : n, 0, 1);
}

function round(value: Decimal.Value, dp = 2): number {
  return new Decimal(value).toDecimalPlaces(dp, ROUNDING).toNumber();
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function uniqSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => round(value, 2)).filter((value) => value > 0))]
    .sort((a, b) => a - b);
}

function cleanHistory(history: SpendEfficiencyHistoryPoint[]): CleanPoint[] {
  return (Array.isArray(history) ? history : [])
    .map((point) => {
      const spend = positive(point.spend);
      const revenue = positive(point.new_customer_revenue);
      if (!spend || !revenue) return null;
      return {
        ...point,
        spend,
        new_customer_revenue: revenue,
        amr: revenue / spend,
      };
    })
    .filter((point): point is CleanPoint => Boolean(point));
}

function resolveContributionMarginRate(input: SpendEfficiencyInput, missingData: string[]): number {
  const directContribution = rate01(input.contribution_margin_rate);
  if (directContribution !== null) return directContribution;

  const grossMargin = rate01(input.gross_margin_rate);
  if (grossMargin !== null) return grossMargin;

  const costOfDelivery = rate01(input.cost_of_delivery_rate);
  if (costOfDelivery !== null) return round(new Decimal(1).minus(costOfDelivery), 6);

  missingData.push("contribution_margin_rate or gross_margin_rate or cost_of_delivery_rate");
  return 0;
}

export function fitLogLinearAmr(points: CleanPoint[]): OlsFit | null {
  if (points.length < 3) return null;

  const xs = points.map((point) => Math.log(point.spend));
  const ys = points.map((point) => point.amr);
  const xMean = mean(xs);
  const yMean = mean(ys);

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let i = 0; i < points.length; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    numerator += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }
  if (xVariance <= 0) return null;

  const slope = numerator / xVariance;
  const intercept = yMean - slope * xMean;
  let residual = 0;
  for (let i = 0; i < points.length; i++) {
    const predicted = intercept + slope * xs[i];
    residual += (ys[i] - predicted) ** 2;
  }
  const rSquared = yVariance <= 0 ? 1 : clamp(1 - residual / yVariance, 0, 1);

  return {
    intercept: round(intercept, 6),
    slope: round(slope, 6),
    r_squared: round(rSquared, 4),
  };
}

function buildFit(points: CleanPoint[], risks: string[], conditions: string[]): SpendEfficiencyFit {
  const spends = points.map((point) => point.spend);
  const amrs = points.map((point) => point.amr);
  const historicalAverageAmr = round(mean(amrs), 4);
  const historicalMinSpend = Math.min(...spends);
  const historicalMaxSpend = Math.max(...spends);
  const logFit = fitLogLinearAmr(points);

  if (!logFit) {
    risks.push("Historique insuffisant ou variance de spend nulle: la courbe utilise l'AMR moyen historique.");
    conditions.push("Ajouter au moins 3 periodes avec spend et new customer revenue pour activer la courbe log-lineaire.");
    return {
      model_type: "HISTORICAL_AVERAGE",
      sample_size: points.length,
      intercept: null,
      slope: null,
      r_squared: null,
      historical_average_amr: historicalAverageAmr,
      historical_min_spend: historicalMinSpend,
      historical_max_spend: historicalMaxSpend,
    };
  }

  if (logFit.slope >= 0) {
    risks.push("L'historique ne montre pas de baisse d'efficacite quand le spend augmente; AMR moyen utilise par prudence.");
    conditions.push("Verifier si des offres, pics saisonniers ou changements creative expliquent une efficacite croissante.");
    return {
      model_type: "HISTORICAL_AVERAGE",
      sample_size: points.length,
      intercept: null,
      slope: null,
      r_squared: null,
      historical_average_amr: historicalAverageAmr,
      historical_min_spend: historicalMinSpend,
      historical_max_spend: historicalMaxSpend,
    };
  }

  return {
    model_type: "LOG_LINEAR_AMR",
    sample_size: points.length,
    intercept: logFit.intercept,
    slope: logFit.slope,
    r_squared: logFit.r_squared,
    historical_average_amr: historicalAverageAmr,
    historical_min_spend: historicalMinSpend,
    historical_max_spend: historicalMaxSpend,
  };
}

function predictAmr(fit: SpendEfficiencyFit, spend: number): number {
  if (fit.model_type === "LOG_LINEAR_AMR" && fit.intercept !== null && fit.slope !== null) {
    return round(Math.max(0.01, fit.intercept + fit.slope * Math.log(Math.max(1, spend))), 4);
  }
  return round(fit.historical_average_amr, 4);
}

function buildCandidateSpends(
  points: CleanPoint[],
  targetSpend: number | null,
  maxExtrapolationRatio: number,
  stepCount: number,
): number[] {
  const spends = points.map((point) => point.spend);
  const minSpend = Math.max(1, Math.min(...spends));
  const historicalMax = Math.max(...spends);
  const modeledMax = historicalMax * maxExtrapolationRatio;
  const maxSpend = targetSpend && targetSpend > modeledMax ? targetSpend : modeledMax;
  const step = (maxSpend - minSpend) / Math.max(1, stepCount - 1);
  const generated = Array.from({ length: stepCount }, (_, index) => minSpend + step * index);
  return uniqSorted([...generated, ...spends, targetSpend ?? 0]);
}

function extrapolationRisk(spend: number, historicalMaxSpend: number, maxExtrapolationRatio: number) {
  if (spend <= historicalMaxSpend) return "IN_SAMPLE";
  if (spend <= historicalMaxSpend * maxExtrapolationRatio) return "MODERATE";
  return "HIGH";
}

function buildFrontierPoint(
  spend: number,
  fit: SpendEfficiencyFit,
  contributionMarginRate: number,
  ltvRevenueMultiplier: number,
  maxExtrapolationRatio: number,
): SpendEfficiencyFrontierPoint {
  const spendD = new Decimal(spend);
  const amr = predictAmr(fit, spend);
  const revenue = spendD.times(amr);
  const contributionBeforeAds = revenue.times(contributionMarginRate);
  const firstOrderContribution = contributionBeforeAds.minus(spendD);
  const lifetimeRevenue = revenue.times(ltvRevenueMultiplier);
  const lifetimeContribution = lifetimeRevenue.times(contributionMarginRate).minus(spendD);

  return {
    spend: round(spendD, 0),
    amr,
    new_customer_revenue: round(revenue, 0),
    contribution_before_ads: round(contributionBeforeAds, 0),
    first_order_contribution: round(firstOrderContribution, 0),
    lifetime_revenue: round(lifetimeRevenue, 0),
    lifetime_contribution: round(lifetimeContribution, 0),
    first_order_break_even: firstOrderContribution.gte(0),
    extrapolation_risk: extrapolationRisk(spend, fit.historical_max_spend, maxExtrapolationRatio),
  };
}

function maxBy<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((best, item) => score(item) > score(best) ? item : best, items[0]);
}

function selectFrontierPoint(
  objective: SpendEfficiencyObjective,
  frontier: SpendEfficiencyFrontierPoint[],
  targetSpend: number | null,
  minFirstOrderContribution: number,
  risks: string[],
): SpendEfficiencyFrontierPoint {
  if (objective === "CUSTOM_SPEND" && targetSpend !== null) {
    return frontier.reduce((closest, point) => (
      Math.abs(point.spend - targetSpend) < Math.abs(closest.spend - targetSpend) ? point : closest
    ), frontier[0]);
  }

  if (objective === "MAX_LIFETIME_CONTRIBUTION") {
    return maxBy(frontier, (point) => point.lifetime_contribution);
  }

  if (objective === "MAX_NEW_CUSTOMER_REVENUE_AT_BREAK_EVEN") {
    const viable = frontier.filter((point) => point.first_order_contribution >= minFirstOrderContribution);
    if (viable.length > 0) return maxBy(viable, (point) => point.new_customer_revenue);
    risks.push("Aucun niveau de spend ne respecte le seuil de contribution first-order; selection du point le moins negatif.");
    return maxBy(frontier, (point) => point.first_order_contribution);
  }

  return maxBy(frontier, (point) => point.first_order_contribution);
}

function confidenceScore(fit: SpendEfficiencyFit, selected: SpendEfficiencyFrontierPoint, missingDataCount: number): number {
  const sampleScore = clamp(fit.sample_size * 8, 0, 32);
  const fitScore = fit.model_type === "LOG_LINEAR_AMR" ? (fit.r_squared ?? 0) * 42 : 14;
  const extrapolationPenalty = selected.extrapolation_risk === "HIGH" ? 28 : selected.extrapolation_risk === "MODERATE" ? 12 : 0;
  const missingPenalty = missingDataCount * 15;
  return round(clamp(25 + sampleScore + fitScore - extrapolationPenalty - missingPenalty, 0, 100), 0);
}

export function runSpendEfficiencyFrontier(input: SpendEfficiencyInput): SpendEfficiencyFrontierOutput {
  const risks: string[] = [];
  const conditions: string[] = [];
  const missingData: string[] = [];
  const points = cleanHistory(input.history);

  if (points.length === 0) {
    throw new Error("Spend efficiency frontier requires at least one valid history point.");
  }

  const contributionMarginRate = resolveContributionMarginRate(input, missingData);
  if (contributionMarginRate <= 0) {
    risks.push("Contribution margin manquante ou nulle: les recommandations de contribution sont conservatrices.");
  }

  const ltvRevenueMultiplier = Math.max(1, positive(input.ltv_revenue_multiplier) ?? 1);
  const targetSpend = positive(input.target_spend);
  const maxExtrapolationRatio = clamp(positive(input.max_extrapolation_ratio) ?? 1.3, 1, 3);
  const stepCount = Math.round(clamp(positive(input.step_count) ?? 40, 10, 120));
  const minFirstOrderContribution = toNumber(input.min_first_order_contribution) ?? 0;
  const fit = buildFit(points, risks, conditions);
  const candidateSpends = buildCandidateSpends(points, targetSpend, maxExtrapolationRatio, stepCount);
  const frontier = candidateSpends.map((spend) => buildFrontierPoint(
    spend,
    fit,
    contributionMarginRate,
    ltvRevenueMultiplier,
    maxExtrapolationRatio,
  ));
  const selected = selectFrontierPoint(
    input.objective,
    frontier,
    targetSpend,
    minFirstOrderContribution,
    risks,
  );

  if (selected.extrapolation_risk === "HIGH") {
    risks.push("Spend recommande au-dela de la zone extrapolable depuis l'historique.");
    conditions.push("Valider avec un test graduel ou un modele statistique batch avant execution.");
  } else if (selected.extrapolation_risk === "MODERATE") {
    conditions.push("Scaler par paliers: le spend recommande depasse le maximum historique.");
  }
  if (selected.first_order_contribution < 0) {
    risks.push(`Contribution first-order negative au spend recommande (${selected.first_order_contribution} $).`);
  }
  if (fit.model_type === "LOG_LINEAR_AMR" && (fit.r_squared ?? 0) < 0.5) {
    risks.push(`Fit AMR faible (R2=${fit.r_squared}); traiter la courbe comme directionnelle.`);
  }

  const breakEvenAmr = contributionMarginRate > 0 ? round(new Decimal(1).div(contributionMarginRate), 2) : null;
  const confidence = confidenceScore(fit, selected, missingData.length);
  const summary = `Spend frontier v1 - objectif ${input.objective} - spend recommande ${selected.spend} $ - AMR ${selected.amr} - contribution first-order ${selected.first_order_contribution} $ - confiance ${confidence}/100.`;

  return {
    engine_version: "spend_efficiency_frontier_v1",
    objective: input.objective,
    fit,
    selected,
    frontier,
    recommended_spend: selected.spend,
    recommended_amr: selected.amr,
    break_even_amr: breakEvenAmr,
    contribution_margin_rate: round(contributionMarginRate, 4),
    ltv_revenue_multiplier: round(ltvRevenueMultiplier, 4),
    confidence_score: confidence,
    risks,
    conditions,
    missing_data: missingData,
    summary,
  };
}
