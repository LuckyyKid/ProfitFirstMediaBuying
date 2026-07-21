// Wave 10E — Measurement / Incrementality v2
// Deterministic statistical engine for A/B tests. No external deps.
// Supports:
//   - BINARY metrics (conversion rate) → two-proportion z-test
//   - CONTINUOUS metrics (AOV, revenue/user) → Welch's t-test
// Also computes: standard error, 95% CI on lift, achieved MDE, statistical power,
// and a plain-language recommendation.

export type MetricType = "BINARY" | "CONTINUOUS";

export interface IncrementalityInput {
  metric_type: MetricType;
  control_sample_size: number;
  variant_sample_size: number;
  // binary
  control_conversions?: number | null;
  variant_conversions?: number | null;
  // continuous
  control_mean?: number | null;
  variant_mean?: number | null;
  control_std?: number | null;
  variant_std?: number | null;
  significance_level?: number; // default 0.05
}

export interface IncrementalityOutput {
  engine_version: "incrementality_engine_v2";
  metric_type: MetricType;
  control_rate_or_mean: number;
  variant_rate_or_mean: number;
  absolute_lift: number;
  relative_lift_pct: number;
  test_statistic: number;
  p_value: number;
  standard_error: number;
  ci_low: number;
  ci_high: number;
  mde_relative: number;
  statistical_power: number;
  significance_level: number;
  significant: boolean;
  winner: "CONTROL" | "VARIANT" | "TIE";
  recommendation: string;
  risks: string[];
  conditions: string[];
  missing_data: string[];
}

// ---------- Numerical helpers ----------

// Standard normal CDF via Abramowitz & Stegun 7.1.26 (erf approx). Accurate to ~1e-7.
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
function normalPdf(z: number): number { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }
// Inverse normal (Beasley-Springer-Moro). Accurate ~1e-7.
function normalInv(p: number): number {
  if (p <= 0 || p >= 1) return NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p <= phigh) {
    q = p - 0.5; r = q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

// ---------- Engine ----------

export function runIncrementalityV2(input: IncrementalityInput): IncrementalityOutput {
  const alpha = input.significance_level ?? 0.05;
  const zAlpha = normalInv(1 - alpha / 2); // two-sided
  const risks: string[] = [];
  const conditions: string[] = [];
  const missing: string[] = [];

  const nC = input.control_sample_size;
  const nV = input.variant_sample_size;

  if (!nC || !nV || nC < 2 || nV < 2) {
    missing.push("Sample sizes required (>= 2 per arm)");
  }

  let pC = 0, pV = 0, se = 0, stat = 0, absLift = 0, relLift = 0;
  let ciLow = 0, ciHigh = 0;

  if (input.metric_type === "BINARY") {
    const xC = input.control_conversions ?? 0;
    const xV = input.variant_conversions ?? 0;
    if (input.control_conversions == null || input.variant_conversions == null) {
      missing.push("Conversions required for binary metrics");
    }
    if (xC > nC || xV > nV) {
      risks.push("Conversions exceed sample size — check data integrity");
    }
    pC = nC > 0 ? xC / nC : 0;
    pV = nV > 0 ? xV / nV : 0;
    absLift = pV - pC;
    relLift = pC > 0 ? (absLift / pC) * 100 : 0;
    // Pooled z-test
    const pPool = (xC + xV) / Math.max(1, nC + nV);
    const sePool = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(1, nC) + 1 / Math.max(1, nV)));
    // Unpooled SE for CI on lift
    se = Math.sqrt((pC * (1 - pC)) / Math.max(1, nC) + (pV * (1 - pV)) / Math.max(1, nV));
    stat = sePool > 0 ? absLift / sePool : 0;
    ciLow = absLift - zAlpha * se;
    ciHigh = absLift + zAlpha * se;
    // Rule of thumb: expected successes/failures per arm >= 10
    const minExp = Math.min(nC * pC, nC * (1 - pC), nV * pV, nV * (1 - pV));
    if (minExp < 10) risks.push(`Approximation normale limite (min expected count = ${minExp.toFixed(1)} < 10)`);
  } else {
    const mC = input.control_mean ?? 0;
    const mV = input.variant_mean ?? 0;
    const sC = input.control_std ?? 0;
    const sV = input.variant_std ?? 0;
    if (input.control_mean == null || input.variant_mean == null) missing.push("Moyennes requises pour métriques continues");
    if (!input.control_std || !input.variant_std) missing.push("Écarts-types requis pour métriques continues");
    pC = mC; pV = mV;
    absLift = mV - mC;
    relLift = mC !== 0 ? (absLift / Math.abs(mC)) * 100 : 0;
    se = Math.sqrt((sC * sC) / Math.max(1, nC) + (sV * sV) / Math.max(1, nV));
    stat = se > 0 ? absLift / se : 0;
    // Welch-Satterthwaite df for reference; approximate p via normal (n typically large in AB tests)
    ciLow = absLift - zAlpha * se;
    ciHigh = absLift + zAlpha * se;
    if (nC < 30 || nV < 30) risks.push("n < 30 par variante — préférer un test-t exact hors moteur");
  }

  // Two-sided p-value via normal approx
  const pValue = 2 * (1 - normalCdf(Math.abs(stat)));

  // Achieved MDE (relative %) — smallest detectable relative lift given current n & baseline
  // Using standard sample-size formula inverted: MDE_abs = (z_alpha + z_beta) * SE_baseline, β=0.2 → power 0.8
  const zBeta = normalInv(0.8);
  let mdeAbs = 0;
  if (input.metric_type === "BINARY") {
    const seBase = Math.sqrt((pC * (1 - pC)) * (1 / Math.max(1, nC) + 1 / Math.max(1, nV)));
    mdeAbs = (zAlpha + zBeta) * seBase;
  } else {
    // reuse combined SE as baseline noise proxy
    mdeAbs = (zAlpha + zBeta) * se;
  }
  const mdeRel = pC !== 0 ? (mdeAbs / Math.abs(pC)) * 100 : 0;

  // Statistical power (post-hoc): P(|Z| > z_alpha | true effect = observed)
  const power = se > 0
    ? (1 - normalCdf(zAlpha - Math.abs(stat))) + normalCdf(-zAlpha - Math.abs(stat))
    : 0;

  const significant = pValue < alpha && missing.length === 0;
  const winner: "CONTROL" | "VARIANT" | "TIE" =
    !significant ? "TIE" : absLift > 0 ? "VARIANT" : "CONTROL";

  // Guidance
  if (power < 0.8 && !significant) {
    conditions.push(`Puissance = ${(power * 100).toFixed(0)}% (< 80%) — résultat non concluant, pas de conclusion "pas de différence"`);
  }
  if (significant && Math.abs(relLift) < 2) {
    risks.push("Lift < 2% — significatif mais faible impact opérationnel");
  }
  if (nC / nV > 1.5 || nV / nC > 1.5) {
    risks.push("Déséquilibre d'échantillon (ratio > 1.5) — vérifie l'assignation");
  }

  let recommendation = "";
  if (missing.length) {
    recommendation = "Données manquantes — impossible de conclure.";
  } else if (significant && winner === "VARIANT") {
    recommendation = `Déployer la variante (lift ${relLift.toFixed(1)}%, p=${pValue.toFixed(4)}, IC95 [${ciLow.toFixed(4)}, ${ciHigh.toFixed(4)}]).`;
  } else if (significant && winner === "CONTROL") {
    recommendation = `Garder le contrôle (variante -${Math.abs(relLift).toFixed(1)}%, p=${pValue.toFixed(4)}).`;
  } else if (power >= 0.8) {
    recommendation = `Pas de différence détectable (power=${(power*100).toFixed(0)}%, MDE≈${mdeRel.toFixed(1)}%). Passe au test suivant.`;
  } else {
    recommendation = `Non concluant — continue le test (n insuffisant, MDE actuel ≈ ${mdeRel.toFixed(1)}%).`;
  }

  return {
    engine_version: "incrementality_engine_v2",
    metric_type: input.metric_type,
    control_rate_or_mean: Number(pC.toFixed(6)),
    variant_rate_or_mean: Number(pV.toFixed(6)),
    absolute_lift: Number(absLift.toFixed(6)),
    relative_lift_pct: Number(relLift.toFixed(2)),
    test_statistic: Number(stat.toFixed(4)),
    p_value: Number(pValue.toFixed(6)),
    standard_error: Number(se.toFixed(6)),
    ci_low: Number(ciLow.toFixed(6)),
    ci_high: Number(ciHigh.toFixed(6)),
    mde_relative: Number(mdeRel.toFixed(2)),
    statistical_power: Number(power.toFixed(4)),
    significance_level: alpha,
    significant,
    winner,
    recommendation,
    risks,
    conditions,
    missing_data: missing,
  };
}
