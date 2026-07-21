// Wave 10C — Statistical Spending Power v2
// Régression OLS déterministe en TypeScript. Pas de dépendance ML.
// Fallback sur v1 (seuil) si moins de 4 points ou données invalides.
//
// Objet : à partir d'un historique de périodes { spend, cac, mer }, estimer
//   - CAC(spend) et MER(spend) par régression linéaire simple,
//   - projeter CAC/MER à un `planned_spend` donné (low/base/high),
//   - fournir une bande recommandée de spend et un score de confiance
//     modéré par R² et une erreur de backtest leave-one-out.

export type HistoryPoint = { spend: number; cac?: number | null; mer?: number | null };

export type OlsFit = {
  slope: number;
  intercept: number;
  r_squared: number;
  n: number;
};

/** Régression linéaire simple y = a*x + b. Retourne null si n<2 ou variance nulle. */
export function ols(xs: number[], ys: number[]): OlsFit | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0) return null;
  const slope = num / denX;
  const intercept = my - slope * mx;
  // R² = (cov / (sdX*sdY))²  ↔ 1 - SSres/SStot
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept;
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = denY === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / denY));
  return { slope, intercept, r_squared: Number(r2.toFixed(4)), n };
}

/** Leave-one-out backtest — erreur % moyenne absolue de prédiction. */
export function leaveOneOutError(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return null;
  let sumPct = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const xTrain = xs.filter((_, j) => j !== i);
    const yTrain = ys.filter((_, j) => j !== i);
    const fit = ols(xTrain, yTrain);
    if (!fit) continue;
    const pred = fit.slope * xs[i] + fit.intercept;
    const actual = ys[i];
    if (actual === 0) continue;
    sumPct += Math.abs((pred - actual) / actual) * 100;
    count++;
  }
  return count === 0 ? null : Number((sumPct / count).toFixed(1));
}

// ---------- v1 threshold fallback (repris de SpendingPower.tsx) ----------
export function v1Threshold(cash: number, burn: number, marginPct: number, roas: number) {
  const safetyMonths = 3;
  const runway = burn > 0 ? cash / burn : 999;
  const cashBudget = Math.max(0, (cash - burn * safetyMonths) / safetyMonths);
  const marginSupported = marginPct > 0 && roas > 0
    ? (burn / ((marginPct / 100) * roas)) * 1.5
    : cashBudget;
  const maxSpend = Math.round(Math.min(cashBudget, marginSupported));
  const recommended = Math.round(maxSpend * 0.7);
  return {
    runway_months: Number(runway.toFixed(1)),
    max_monthly_ad_spend: maxSpend,
    recommended_monthly_ad_spend: recommended,
  };
}

// ---------- Engine v2 ----------
export type SpendingPowerV2Input = {
  history: HistoryPoint[];
  planned_spend: number;
  target_cac?: number | null;
  target_mer?: number | null;
  // Contexte cash pour fallback / plafond
  cash_available?: number;
  monthly_burn?: number;
  gross_margin_pct?: number;
};

export type SpendingPowerV2Output = {
  model_type: "V2_REGRESSION" | "THRESHOLD_FALLBACK";
  sample_size: number;
  fallback_reason: string | null;
  fit_cac: OlsFit | null;
  fit_mer: OlsFit | null;
  backtest_error_percent: number | null;
  recommended_model_confidence: number; // 0..100
  planned_spend: number;
  projected_cac: { low: number | null; base: number | null; high: number | null };
  projected_mer: { low: number | null; base: number | null; high: number | null };
  recommended_spend: { low: number; base: number; high: number };
  spend_risk: "LOW" | "MEDIUM" | "HIGH";
  efficiency_risk: "LOW" | "MEDIUM" | "HIGH";
  risks: string[];
  conditions: string[];
  summary: string;
  // v1 side-outputs pour rétro-compat
  runway_months: number;
  max_monthly_ad_spend: number;
  recommended_monthly_ad_spend: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function runSpendingPowerV2(input: SpendingPowerV2Input): SpendingPowerV2Output {
  const cash = input.cash_available ?? 0;
  const burn = input.monthly_burn ?? 0;
  const margin = input.gross_margin_pct ?? 0;
  const targetRoas = input.target_mer ?? 2.5;
  const v1 = v1Threshold(cash, burn, margin, targetRoas);

  const clean = input.history.filter((h) => Number.isFinite(h.spend) && h.spend > 0);
  const cacPoints = clean.filter((h) => h.cac != null && Number.isFinite(Number(h.cac)));
  const merPoints = clean.filter((h) => h.mer != null && Number.isFinite(Number(h.mer)));
  const usable = Math.max(cacPoints.length, merPoints.length);

  const risks: string[] = [];
  const conditions: string[] = [];

  if (usable < 4) {
    // Fallback v1
    risks.push("Historique insuffisant (<4 périodes) : régression désactivée, retour au modèle de seuil v1.");
    conditions.push("Ajouter des périodes historiques (spend + CAC + MER) pour activer la régression.");
    return {
      model_type: "THRESHOLD_FALLBACK",
      sample_size: usable,
      fallback_reason: `insufficient_history (${usable} < 4)`,
      fit_cac: null,
      fit_mer: null,
      backtest_error_percent: null,
      recommended_model_confidence: 30,
      planned_spend: input.planned_spend,
      projected_cac: { low: null, base: null, high: null },
      projected_mer: { low: null, base: null, high: null },
      recommended_spend: {
        low: Math.round(v1.recommended_monthly_ad_spend * 0.85),
        base: v1.recommended_monthly_ad_spend,
        high: v1.max_monthly_ad_spend,
      },
      spend_risk: input.planned_spend > v1.max_monthly_ad_spend ? "HIGH" : "MEDIUM",
      efficiency_risk: "MEDIUM",
      risks,
      conditions,
      summary: `Modèle de seuil v1 utilisé (${usable} points d'historique). Spend recommandé : ${v1.recommended_monthly_ad_spend} $ / mois.`,
      ...v1,
    };
  }

  const fitCac = cacPoints.length >= 2
    ? ols(cacPoints.map((h) => h.spend), cacPoints.map((h) => Number(h.cac)))
    : null;
  const fitMer = merPoints.length >= 2
    ? ols(merPoints.map((h) => h.spend), merPoints.map((h) => Number(h.mer)))
    : null;

  const backtest = fitCac
    ? leaveOneOutError(cacPoints.map((h) => h.spend), cacPoints.map((h) => Number(h.cac)))
    : null;

  // Projections à planned_spend (borne ±10% pour low/high)
  const project = (fit: OlsFit | null, spend: number) => {
    if (!fit) return { low: null, base: null, high: null };
    const base = fit.slope * spend + fit.intercept;
    const spread = Math.abs(base) * (1 - fit.r_squared) * 0.5 + Math.abs(base) * 0.05;
    return {
      low: Number((base - spread).toFixed(2)),
      base: Number(base.toFixed(2)),
      high: Number((base + spread).toFixed(2)),
    };
  };

  const projCac = project(fitCac, input.planned_spend);
  const projMer = project(fitMer, input.planned_spend);

  // Confiance : R² pondéré + pénalité backtest + pénalité petit échantillon
  const r2Avg = ((fitCac?.r_squared ?? 0) + (fitMer?.r_squared ?? 0)) / (Number(!!fitCac) + Number(!!fitMer) || 1);
  const backtestPenalty = backtest == null ? 15 : clamp(backtest / 2, 0, 40);
  const sizeBonus = clamp((usable - 4) * 5, 0, 20);
  const confidence = Math.round(clamp(40 + r2Avg * 60 - backtestPenalty + sizeBonus, 0, 100));

  // Bande de spend recommandée : centrée sur planned_spend, plafonnée par v1.max
  const cap = v1.max_monthly_ad_spend > 0 ? v1.max_monthly_ad_spend : input.planned_spend * 1.5;
  const base = Math.min(input.planned_spend, cap);
  const rec = {
    low: Math.round(base * 0.8),
    base: Math.round(base),
    high: Math.round(Math.min(base * 1.2, cap)),
  };

  // Risques
  let spendRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let effRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (input.planned_spend > cap) {
    spendRisk = "HIGH";
    risks.push(`Spend planifié (${input.planned_spend} $) dépasse le plafond cash-soutenable (${cap} $).`);
  } else if (input.planned_spend > cap * 0.85) {
    spendRisk = "MEDIUM";
  }
  if (input.target_cac != null && projCac.base != null && projCac.base > Number(input.target_cac)) {
    effRisk = "HIGH";
    risks.push(`CAC projeté (${projCac.base}) > CAC cible (${input.target_cac}).`);
  }
  if (input.target_mer != null && projMer.base != null && projMer.base < Number(input.target_mer)) {
    effRisk = effRisk === "HIGH" ? "HIGH" : "MEDIUM";
    risks.push(`MER projeté (${projMer.base}) < MER cible (${input.target_mer}).`);
  }
  if (r2Avg < 0.3) {
    risks.push(`Ajustement du modèle faible (R² moyen ${r2Avg.toFixed(2)}) — projections directionnelles seulement.`);
    conditions.push("Compléter l'historique ou ajuster la période (retirer événements exceptionnels).");
  }
  if (backtest != null && backtest > 25) {
    risks.push(`Erreur backtest ${backtest}% — modèle instable sur les données actuelles.`);
  }

  const summary = `Régression v2 sur ${usable} périodes · R² CAC=${fitCac?.r_squared ?? "—"} · R² MER=${fitMer?.r_squared ?? "—"} · confiance ${confidence}/100 · spend recommandé ${rec.base} $ / mois.`;

  return {
    model_type: "V2_REGRESSION",
    sample_size: usable,
    fallback_reason: null,
    fit_cac: fitCac,
    fit_mer: fitMer,
    backtest_error_percent: backtest,
    recommended_model_confidence: confidence,
    planned_spend: input.planned_spend,
    projected_cac: projCac,
    projected_mer: projMer,
    recommended_spend: rec,
    spend_risk: spendRisk,
    efficiency_risk: effRisk,
    risks,
    conditions,
    summary,
    ...v1,
  };
}
