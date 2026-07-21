// Wave 10D — Retention Cohort v2 : active/lapsed logic, quick ratio, backtesting.
// Déterministe, aucune dépendance ML.

export type ActivityRow = {
  snapshot_month: string; // YYYY-MM-DD (1er du mois)
  new_customers: number;
  reactivated_customers: number;
  active_customers: number;
  lapsed_customers: number;
};

export type ActivityDerived = ActivityRow & {
  net_active_customer_change: number;
  quick_ratio: number;
};

export type RetentionQuality = "HIGH" | "MEDIUM" | "LOW";

export type RetentionCohortResult = {
  rows: ActivityDerived[];
  latest_quick_ratio: number | null;
  avg_quick_ratio: number | null;
  quality: RetentionQuality;
  quality_reason: string;
  backtest_error_percent: number | null;
  trend_slope: number | null; // net_active_customer_change slope over time
  risks: string[];
  conditions: string[];
  summary: string;
};

export function deriveActivity(row: ActivityRow): ActivityDerived {
  const net =
    (row.new_customers || 0) +
    (row.reactivated_customers || 0) +
    (row.active_customers || 0) -
    (row.lapsed_customers || 0);
  const denom = Math.max(row.lapsed_customers || 0, 1);
  const qr =
    ((row.new_customers || 0) +
      (row.reactivated_customers || 0) +
      (row.active_customers || 0)) /
    denom;
  return {
    ...row,
    net_active_customer_change: net,
    quick_ratio: Number(qr.toFixed(2)),
  };
}

function slope(ys: number[]): number | null {
  const n = ys.length;
  if (n < 2) return null;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : Number((num / den).toFixed(2));
}

/**
 * Backtest simple : estime le net_change de la dernière période à partir de
 * la moyenne des N-1 précédentes, retourne erreur % absolue.
 */
function backtestError(derived: ActivityDerived[]): number | null {
  if (derived.length < 4) return null;
  const last = derived[derived.length - 1];
  const prev = derived.slice(0, -1);
  const avg =
    prev.reduce((a, b) => a + b.net_active_customer_change, 0) / prev.length;
  if (last.net_active_customer_change === 0) return null;
  return Number(
    (
      Math.abs((avg - last.net_active_customer_change) / last.net_active_customer_change) * 100
    ).toFixed(1),
  );
}

export function runRetentionCohortV2(
  activity: ActivityRow[],
  ltvLifts?: { lift30?: number; lift60?: number; lift90?: number; lift180?: number },
): RetentionCohortResult {
  const rows = activity
    .slice()
    .sort((a, b) => (a.snapshot_month < b.snapshot_month ? -1 : 1))
    .map(deriveActivity);

  const risks: string[] = [];
  const conditions: string[] = [];

  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const latestQr = latest ? latest.quick_ratio : null;
  const avgQr =
    rows.length > 0
      ? Number((rows.reduce((a, b) => a + b.quick_ratio, 0) / rows.length).toFixed(2))
      : null;

  // Qualité
  let quality: RetentionQuality = "LOW";
  let qualityReason = "Données insuffisantes";
  const strongRepeatLift = (ltvLifts?.lift90 ?? 0) > 25 || (ltvLifts?.lift180 ?? 0) > 40;

  if (latestQr != null) {
    if (latestQr > 1.2 && strongRepeatLift) {
      quality = "HIGH";
      qualityReason = `Quick ratio ${latestQr} > 1.2 et lift LTV solide.`;
    } else if (latestQr > 1.2) {
      quality = "MEDIUM";
      qualityReason = `Quick ratio ${latestQr} > 1.2 mais lift LTV modeste.`;
    } else if (latestQr >= 0.9) {
      quality = "MEDIUM";
      qualityReason = `Quick ratio ${latestQr} ≈ 1 : base stable, croissance neutre.`;
    } else {
      quality = "LOW";
      qualityReason = `Quick ratio ${latestQr} < 1 : base en contraction.`;
      risks.push(
        `Plus de clients perdus que gagnés (QR ${latestQr}) — CAC et payback vont se dégrader.`,
      );
    }
  }

  if (rows.length < 3) {
    conditions.push("Ajouter ≥3 mois d'activité pour évaluer la tendance.");
  }
  if (rows.length < 6) {
    conditions.push("≥6 mois recommandés pour un backtest fiable.");
  }

  const trend = slope(rows.map((r) => r.net_active_customer_change));
  if (trend != null && trend < 0) {
    risks.push(`Tendance négative sur net_active_change (pente ${trend}).`);
  }

  const backtest = backtestError(rows);
  if (backtest != null && backtest > 30) {
    risks.push(`Backtest instable (${backtest}%) — projection peu fiable.`);
  }

  const summary = latest
    ? `${rows.length} mois · QR courant ${latestQr} (moyen ${avgQr}) · qualité ${quality} · tendance nette ${trend ?? "—"}`
    : "Aucune donnée d'activité — commence par saisir un mois.";

  return {
    rows,
    latest_quick_ratio: latestQr,
    avg_quick_ratio: avgQr,
    quality,
    quality_reason: qualityReason,
    backtest_error_percent: backtest,
    trend_slope: trend,
    risks,
    conditions,
    summary,
  };
}
