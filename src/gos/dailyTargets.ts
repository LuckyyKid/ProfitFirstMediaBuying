// Wave 10B — Daily Targets Engine
// Décompose un objectif hebdomadaire en objectifs journaliers en appliquant
// des poids de pacing par jour de la semaine (index 0 = dimanche).
//
// Le moteur reste 100% déterministe : somme(poids) est normalisée à 1 avant
// répartition, ce qui garantit que la somme des cibles quotidiennes ≈ cible
// hebdomadaire (aux arrondis près, absorbés dans le dernier jour).

export type DayWeights = [number, number, number, number, number, number, number];

// Poids par défaut : plat (1/7). Peut être surchargé par vertical / historique.
export const UNIFORM_WEIGHTS: DayWeights = [1, 1, 1, 1, 1, 1, 1];

// Ecommerce B2C : pic weekend, creux mardi.
export const ECOM_B2C_WEIGHTS: DayWeights = [1.15, 0.95, 0.85, 0.9, 1.0, 1.15, 1.0];

// B2B / Lead gen : pic milieu de semaine, creux weekend.
export const B2B_WEEKDAY_WEIGHTS: DayWeights = [0.6, 1.2, 1.3, 1.35, 1.25, 1.0, 0.6];

export const WEIGHT_PRESETS: Record<string, DayWeights> = {
  uniform: UNIFORM_WEIGHTS,
  ecom_b2c: ECOM_B2C_WEIGHTS,
  b2b_weekday: B2B_WEEKDAY_WEIGHTS,
};

export type WeeklyTargetInput = {
  id: string;
  client_id: string;
  week_start: string; // YYYY-MM-DD (lundi typiquement)
  target_revenue?: number | null;
  target_ad_spend?: number | null;
  target_orders?: number | null;
  target_leads?: number | null;
  target_gross_profit?: number | null;
};

export type DailyTargetRow = {
  client_id: string;
  parent_weekly_id: string;
  target_date: string;
  day_of_week: number;
  day_index: number;
  pacing_weight: number;
  target_revenue: number | null;
  target_ad_spend: number | null;
  target_orders: number | null;
  target_leads: number | null;
  target_gross_profit: number | null;
  status: string;
};

function normalize(weights: DayWeights, startDow: number): number[] {
  // Réordonne les poids pour commencer au jour de départ de la semaine.
  const ordered = Array.from({ length: 7 }, (_, i) => weights[(startDow + i) % 7]);
  const sum = ordered.reduce((a, b) => a + b, 0) || 1;
  return ordered.map((w) => w / sum);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function splitValue(
  total: number | null | undefined,
  norm: number[],
  isInt: boolean,
): (number | null)[] {
  if (total == null) return norm.map(() => null);
  const raw = norm.map((w) => Number(total) * w);
  if (!isInt) return raw.map((v) => Number(v.toFixed(2)));
  // Largest-remainder method (Hare/Hamilton) : distribue les entiers restants
  // aux jours ayant la plus grosse partie fractionnaire, plutôt qu'empiler
  // tout le reste sur le dernier jour (évite le pattern 0,0,0,0,0,0,2).
  const floors = raw.map((v) => Math.floor(v));
  const target = Math.round(Number(total));
  const remainder = target - floors.reduce((a, b) => a + b, 0);
  if (remainder > 0) {
    const idx = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac || norm[b.i] - norm[a.i]);
    for (let k = 0; k < remainder && k < idx.length; k++) floors[idx[k].i] += 1;
  } else if (remainder < 0) {
    // Rare (total négatif ou arrondi baisse) — retire aux plus petites fractions.
    const idx = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => a.frac - b.frac);
    for (let k = 0; k < -remainder && k < idx.length; k++) floors[idx[k].i] -= 1;
  }
  return floors;
}

export function generateDailyTargets(
  weekly: WeeklyTargetInput,
  weights: DayWeights = UNIFORM_WEIGHTS,
): DailyTargetRow[] {
  const startDate = new Date(weekly.week_start + "T00:00:00Z");
  const startDow = startDate.getUTCDay();
  const norm = normalize(weights, startDow);

  const rev = splitValue(weekly.target_revenue, norm, false);
  const spend = splitValue(weekly.target_ad_spend, norm, false);
  const gp = splitValue(weekly.target_gross_profit, norm, false);
  const orders = splitValue(weekly.target_orders, norm, true);
  const leads = splitValue(weekly.target_leads, norm, true);

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekly.week_start, i);
    return {
      client_id: weekly.client_id,
      parent_weekly_id: weekly.id,
      target_date: date,
      day_of_week: (startDow + i) % 7,
      day_index: i + 1,
      pacing_weight: Number(norm[i].toFixed(4)),
      target_revenue: rev[i] as number | null,
      target_ad_spend: spend[i] as number | null,
      target_orders: orders[i] as number | null,
      target_leads: leads[i] as number | null,
      target_gross_profit: gp[i] as number | null,
      status: "PLANNED",
    };
  });
}

export function computeVariancePct(target?: number | null, actual?: number | null): number | null {
  if (target == null || actual == null || Number(target) === 0) return null;
  return Number((((Number(actual) - Number(target)) / Number(target)) * 100).toFixed(1));
}
