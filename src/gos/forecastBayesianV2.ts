// Wave 10F — Bayesian Forecast Update v2
// Deterministic Normal-Normal conjugate update. Blends a prior (parent forecast)
// with the likelihood built from recent measurement snapshots, yielding a
// posterior mean, variance, 95% CI, Kalman gain, and drift signal.
// No external deps.

export interface BayesianForecastInput {
  metric: "revenue" | "ad_spend" | "cac";
  prior_mean: number;              // parent forecast projected value
  prior_confidence: number;        // 0..1 — parent forecast confidence
  observations: number[];          // recent measurement snapshots (same metric)
  prior_scale_pct?: number;        // relative std of prior as % of mean (default 15%)
  min_obs_variance_pct?: number;   // floor for likelihood std (default 5%)
}

export interface BayesianForecastOutput {
  engine_version: "forecast_bayesian_v2";
  metric: string;
  prior_mean: number;
  prior_variance: number;
  likelihood_mean: number;
  likelihood_variance: number;
  n_observations: number;
  posterior_mean: number;
  posterior_variance: number;
  posterior_std: number;
  posterior_ci_low: number;
  posterior_ci_high: number;
  kalman_gain: number;              // weight given to the observations
  delta_vs_prior_pct: number;
  drift_signal: "STABLE" | "MINOR_DRIFT" | "MAJOR_DRIFT" | "REVERSAL";
  new_confidence: number;           // 0..1 — 1 - normalized posterior std
  recommendation: string;
  risks: string[];
  conditions: string[];
  missing_data: string[];
}

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function variance(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}

export function runForecastBayesianV2(input: BayesianForecastInput): BayesianForecastOutput {
  const risks: string[] = [];
  const conditions: string[] = [];
  const missing: string[] = [];

  const priorScalePct = input.prior_scale_pct ?? 0.15;
  const minObsVarPct = input.min_obs_variance_pct ?? 0.05;

  const priorMean = input.prior_mean;
  // Prior variance: wider when confidence is low. σ_prior = mean * scale / max(conf, 0.2)
  const priorConf = Math.max(0.2, Math.min(1, input.prior_confidence || 0.5));
  const priorStd = Math.abs(priorMean) * (priorScalePct / priorConf);
  const priorVar = priorStd * priorStd;

  const obs = input.observations.filter((v) => typeof v === "number" && !isNaN(v));
  const n = obs.length;

  if (n === 0) missing.push("Aucune observation — impossible de calculer la vraisemblance");
  if (priorMean === 0 || priorMean == null) missing.push("Moyenne a priori manquante");

  const likMean = n > 0 ? mean(obs) : priorMean;
  const rawLikVar = n > 1 ? variance(obs) : Math.pow(Math.abs(likMean) * minObsVarPct, 2);
  const floorVar = Math.pow(Math.abs(likMean) * minObsVarPct, 2);
  const likVarSingle = Math.max(rawLikVar, floorVar);
  // Variance of the sample mean = σ² / n
  const likVar = n > 0 ? likVarSingle / n : likVarSingle;

  // Conjugate Normal-Normal update
  const invPrior = priorVar > 0 ? 1 / priorVar : 0;
  const invLik = likVar > 0 ? 1 / likVar : 0;
  const postVar = invPrior + invLik > 0 ? 1 / (invPrior + invLik) : priorVar;
  const postMean = postVar * (priorMean * invPrior + likMean * invLik);
  const postStd = Math.sqrt(postVar);
  const kalmanGain = invPrior + invLik > 0 ? invLik / (invPrior + invLik) : 0;

  const ciLow = postMean - 1.96 * postStd;
  const ciHigh = postMean + 1.96 * postStd;

  const deltaPct = priorMean !== 0 ? ((postMean - priorMean) / Math.abs(priorMean)) * 100 : 0;
  const absDelta = Math.abs(deltaPct);
  let drift: BayesianForecastOutput["drift_signal"] = "STABLE";
  if (absDelta >= 25) drift = "MAJOR_DRIFT";
  else if (absDelta >= 10) drift = "MINOR_DRIFT";
  // Reversal = observations consistently on opposite side of prior
  if (n >= 3 && obs.every((v) => (v - priorMean) * (likMean - priorMean) > 0) && absDelta >= 15) {
    drift = "REVERSAL";
  }

  // Confidence = 1 - relative posterior std
  const relStd = Math.abs(postMean) > 0 ? postStd / Math.abs(postMean) : 1;
  const newConfidence = Math.max(0, Math.min(1, 1 - relStd));

  if (n < 3) conditions.push(`n=${n} observation(s) — postérieur dominé par le prior, ré-évaluer après plus de données`);
  if (n >= 3 && likVarSingle > Math.pow(Math.abs(likMean) * 0.4, 2)) risks.push("Variance observée élevée (>40% du niveau) — signal bruité");
  if (drift === "MAJOR_DRIFT" || drift === "REVERSAL") risks.push(`Dérive détectée (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs prior) — reforecaster le cycle`);

  let recommendation = "";
  if (missing.length) {
    recommendation = "Données manquantes — pas d'update possible.";
  } else if (drift === "STABLE") {
    recommendation = `Forecast maintenu (posterior ${postMean.toFixed(0)} ≈ prior ${priorMean.toFixed(0)}, gain=${(kalmanGain * 100).toFixed(0)}%).`;
  } else if (drift === "MINOR_DRIFT") {
    recommendation = `Ajuster forecast à ${postMean.toFixed(0)} (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs prior). Surveiller.`;
  } else if (drift === "MAJOR_DRIFT") {
    recommendation = `Reforecaster complètement : posterior ${postMean.toFixed(0)} vs prior ${priorMean.toFixed(0)} (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%). Escalader en revue de cycle.`;
  } else {
    recommendation = `Renversement de tendance détecté — challenger les hypothèses du forecast parent avant tout ajustement budget.`;
  }

  return {
    engine_version: "forecast_bayesian_v2",
    metric: input.metric,
    prior_mean: Number(priorMean.toFixed(2)),
    prior_variance: Number(priorVar.toFixed(4)),
    likelihood_mean: Number(likMean.toFixed(2)),
    likelihood_variance: Number(likVar.toFixed(4)),
    n_observations: n,
    posterior_mean: Number(postMean.toFixed(2)),
    posterior_variance: Number(postVar.toFixed(4)),
    posterior_std: Number(postStd.toFixed(2)),
    posterior_ci_low: Number(ciLow.toFixed(2)),
    posterior_ci_high: Number(ciHigh.toFixed(2)),
    kalman_gain: Number(kalmanGain.toFixed(4)),
    delta_vs_prior_pct: Number(deltaPct.toFixed(2)),
    drift_signal: drift,
    new_confidence: Number(newConfidence.toFixed(3)),
    recommendation,
    risks,
    conditions,
    missing_data: missing,
  };
}
