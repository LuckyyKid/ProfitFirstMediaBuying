// Wave 10G — Event Effect / Causal Impact v2
// Deterministic Interrupted Time Series (ITS) + optional Difference-in-Differences (DiD)
// when a control series is provided. No external dependencies.
//
// Method summary:
//  - ITS: counterfactual = extrapolation of the pre-window mean (optionally with linear trend).
//    Causal lift = post_mean − counterfactual. Significance via Welch t-test between
//    post observations and their counterfactual reference (using pre variance as noise proxy).
//  - DiD: causal lift = (post_treated − pre_treated) − (post_control − pre_control).
//    Standard error combines all four sample variances.

export interface EventEffectInput {
  metric: string;
  pre_series: number[];       // observations before event (chronological)
  post_series: number[];      // observations during/after event (chronological)
  control_pre_series?: number[] | null;
  control_post_series?: number[] | null;
  use_linear_trend?: boolean; // extrapolate pre trend for counterfactual (default true if ≥4 pts)
  significance_level?: number; // default 0.05
}

export type PlannedEventEffectInput = {
  baseline_revenue_30d?: number | null;
  event_type: string;
  start_date: string;
  end_date: string;
  custom_lift_pct?: number | null;
};

export type PlannedEventEffectOutput = {
  expected_lift_pct: number;
  expected_revenue_delta: number;
  duration_days: number;
  daily_baseline_revenue: number;
  confidence: "LOW" | "MEDIUM";
  assumptions: {
    baseline_revenue_30d: number;
    duration_days: number;
    lift_source: "EVENT_TYPE_DEFAULT" | "CUSTOM";
    formula: string;
  };
};

export interface EventEffectOutput {
  engine_version: "event_effect_v2";
  method: "ITS" | "DID";
  metric: string;
  pre_mean: number;
  pre_std: number;
  post_mean: number;
  post_std: number;
  counterfactual_mean: number;
  causal_lift_abs: number;
  causal_lift_pct: number;
  test_statistic: number;
  p_value: number;
  standard_error: number;
  ci_low: number;
  ci_high: number;
  significance_level: number;
  significant: boolean;
  n_pre: number;
  n_post: number;
  trend_slope: number;
  recommendation: string;
  risks: string[];
  conditions: string[];
  missing_data: string[];
}

export const EVENT_TYPE_DEFAULT_LIFTS: Record<string, number> = {
  PROMO: 18,
  LAUNCH: 25,
  SEASONAL: 30,
  PAID_PUSH: 12,
  PR: 8,
  INFLUENCER: 10,
  OTHER: 5,
};

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function variance(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}
function std(xs: number[]) { return Math.sqrt(variance(xs)); }

// OLS slope of xs vs index 0..n-1
function trendSlope(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(xs);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xMean) * (xs[i] - yMean); den += (i - xMean) * (i - xMean); }
  return den > 0 ? num / den : 0;
}

// Standard normal CDF (Abramowitz & Stegun)
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}
function normalCdf(z: number): number { return 0.5 * (1 + erf(z / Math.SQRT2)); }

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateDaysInclusive(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.ceil((end - start) / 86400000) + 1);
}

export function estimatePlannedEventEffect(input: PlannedEventEffectInput): PlannedEventEffectOutput {
  const baselineRevenue30d = Math.max(0, finite(input.baseline_revenue_30d));
  const eventType = String(input.event_type || "OTHER").toUpperCase();
  const customLift = input.custom_lift_pct != null && Number.isFinite(Number(input.custom_lift_pct))
    ? Number(input.custom_lift_pct)
    : null;
  const expectedLiftPct = customLift ?? EVENT_TYPE_DEFAULT_LIFTS[eventType] ?? EVENT_TYPE_DEFAULT_LIFTS.OTHER;
  const durationDays = dateDaysInclusive(input.start_date, input.end_date);
  const dailyBaselineRevenue = baselineRevenue30d / 30;
  const expectedRevenueDelta = Math.round(dailyBaselineRevenue * durationDays * (expectedLiftPct / 100));

  return {
    expected_lift_pct: expectedLiftPct,
    expected_revenue_delta: expectedRevenueDelta,
    duration_days: durationDays,
    daily_baseline_revenue: Number(dailyBaselineRevenue.toFixed(2)),
    confidence: baselineRevenue30d > 0 ? "MEDIUM" : "LOW",
    assumptions: {
      baseline_revenue_30d: baselineRevenue30d,
      duration_days: durationDays,
      lift_source: customLift == null ? "EVENT_TYPE_DEFAULT" : "CUSTOM",
      formula: "daily_baseline_revenue * duration_days * expected_lift_pct",
    },
  };
}

export function runEventEffectV2(input: EventEffectInput): EventEffectOutput {
  const alpha = input.significance_level ?? 0.05;
  const zAlpha = 1.96; // two-sided 95%
  const risks: string[] = [];
  const conditions: string[] = [];
  const missing: string[] = [];

  const pre = input.pre_series.filter((v) => typeof v === "number" && !isNaN(v));
  const post = input.post_series.filter((v) => typeof v === "number" && !isNaN(v));
  const nPre = pre.length;
  const nPost = post.length;

  if (nPre < 2) missing.push("Fenêtre pré < 2 observations");
  if (nPost < 2) missing.push("Fenêtre post < 2 observations");

  const preMean = nPre > 0 ? mean(pre) : 0;
  const preVar = variance(pre);
  const preStd = Math.sqrt(preVar);
  const postMean = nPost > 0 ? mean(post) : 0;
  const postVar = variance(post);
  const postStd = Math.sqrt(postVar);

  const hasControl = (input.control_pre_series?.length ?? 0) >= 2 && (input.control_post_series?.length ?? 0) >= 2;

  let method: "ITS" | "DID" = "ITS";
  let counterfactual = preMean;
  let liftAbs = 0;
  let se = 0;
  let stat = 0;
  let trend = 0;

  if (hasControl) {
    method = "DID";
    const cPre = input.control_pre_series!.filter((v) => typeof v === "number" && !isNaN(v));
    const cPost = input.control_post_series!.filter((v) => typeof v === "number" && !isNaN(v));
    const cPreMean = mean(cPre), cPostMean = mean(cPost);
    const controlChange = cPostMean - cPreMean;
    counterfactual = preMean + controlChange; // treated would have moved like control
    liftAbs = postMean - counterfactual;
    // SE combines 4 sample means variances
    se = Math.sqrt(
      preVar / Math.max(1, nPre) + postVar / Math.max(1, nPost) +
      variance(cPre) / Math.max(1, cPre.length) + variance(cPost) / Math.max(1, cPost.length)
    );
    if (Math.abs(controlChange / Math.max(1, Math.abs(cPreMean))) > 0.5) {
      risks.push("Contrôle très volatil (>50% de swing) — hypothèse de tendances parallèles fragile");
    }
  } else {
    // ITS with optional linear extrapolation
    const useTrend = (input.use_linear_trend ?? nPre >= 4);
    trend = trendSlope(pre);
    if (useTrend && nPre >= 4) {
      // extrapolate to middle of post window
      const stepsAhead = (nPre - 1 - (nPre - 1) / 2) + (nPost + 1) / 2;
      counterfactual = preMean + trend * stepsAhead;
    }
    liftAbs = postMean - counterfactual;
    // Welch-style SE using pre variance as noise proxy for counterfactual
    se = Math.sqrt(postVar / Math.max(1, nPost) + preVar / Math.max(1, nPre));
    if (nPre < 7) conditions.push(`Fenêtre pré courte (n=${nPre}) — contrefactuel peu robuste, préfère ≥7 points`);
    if (Math.abs(trend) > Math.abs(preMean) * 0.05) risks.push("Forte tendance pré-événement — l'effet peut être confondu avec la trajectoire");
  }

  stat = se > 0 ? liftAbs / se : 0;
  const pValue = 2 * (1 - normalCdf(Math.abs(stat)));
  const liftPct = counterfactual !== 0 ? (liftAbs / Math.abs(counterfactual)) * 100 : 0;
  const ciLow = liftAbs - zAlpha * se;
  const ciHigh = liftAbs + zAlpha * se;

  const significant = pValue < alpha && missing.length === 0;

  if (postVar > preVar * 3 && nPre >= 3 && nPost >= 3) {
    risks.push("Variance post > 3× pré — signal instable, possible mesure erratique");
  }
  if (nPost < nPre / 3) {
    conditions.push(`Fenêtre post beaucoup plus courte que pré (n=${nPost} vs ${nPre}) — attendre plus de données`);
  }

  let recommendation = "";
  if (missing.length) {
    recommendation = "Données insuffisantes pour attribuer l'effet.";
  } else if (significant && liftAbs > 0) {
    recommendation = `Effet causal positif détecté : ${liftAbs > 0 ? "+" : ""}${liftAbs.toFixed(2)} (${liftPct.toFixed(1)}%, p=${pValue.toFixed(4)}, IC95 [${ciLow.toFixed(2)}, ${ciHigh.toFixed(2)}], méthode ${method}). Prolonger / répliquer.`;
  } else if (significant && liftAbs < 0) {
    recommendation = `Effet causal négatif : ${liftAbs.toFixed(2)} (${liftPct.toFixed(1)}%, p=${pValue.toFixed(4)}). Investiguer et interrompre.`;
  } else {
    recommendation = `Pas d'effet causal significatif (lift=${liftAbs.toFixed(2)}, p=${pValue.toFixed(4)}). Ne pas attribuer le changement à l'événement.`;
  }

  return {
    engine_version: "event_effect_v2",
    method,
    metric: input.metric,
    pre_mean: Number(preMean.toFixed(4)),
    pre_std: Number(preStd.toFixed(4)),
    post_mean: Number(postMean.toFixed(4)),
    post_std: Number(postStd.toFixed(4)),
    counterfactual_mean: Number(counterfactual.toFixed(4)),
    causal_lift_abs: Number(liftAbs.toFixed(4)),
    causal_lift_pct: Number(liftPct.toFixed(2)),
    test_statistic: Number(stat.toFixed(4)),
    p_value: Number(pValue.toFixed(6)),
    standard_error: Number(se.toFixed(4)),
    ci_low: Number(ciLow.toFixed(4)),
    ci_high: Number(ciHigh.toFixed(4)),
    significance_level: alpha,
    significant,
    n_pre: nPre,
    n_post: nPost,
    trend_slope: Number(trend.toFixed(4)),
    recommendation,
    risks,
    conditions,
    missing_data: missing,
  };
}
