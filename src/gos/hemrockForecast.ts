// Hemrock Forecast Engine — replica v1
// Réplique déterministe du "Ecommerce Forecasting Tool by Hemrock".
// Modèle cohorte mensuel sur N mois (par défaut 48) qui produit :
//   • Retention curve (orders/1 customer sur les cycles de rachat, décroissance
//     géométrique via churn_per_cycle).
//   • Waterfall de cohortes : chaque mois d'acquisition génère des commandes
//     dans les mois suivants selon la retention curve.
//   • AOV new / AOV repeat / CoS% / CAC / growth avec une rate-of-change
//     compoundée (rate lui-même évolue chaque mois via change_in_rate).
//   • P&L mensuel : revenue, COGS, shipping, marketing, operating income,
//     contribution margin, LTV.
//   • Roll-up annuel + LTV:CAC + CAC payback.
//
// Aucune dépendance externe.

export type HemrockInputs = {
  // Timescale
  horizon_months?: number;               // défaut 48

  // Revenue & marketing (par order)
  aov_new: number;
  aov_repeat: number;                    // défaut aov_new * 0.8
  aov_rate_start: number;                // rate mensuel initial (ex 0.10)
  aov_rate_change: number;               // change_in_rate mensuel (ex -0.05)
  cos_pct: number;                       // 0..1 (Cost of Sales % du revenu)
  cos_pct_extra_1?: number;              // "Additional Cost of Sales" %
  cos_pct_extra_2?: number;
  cos_rate_start?: number;
  cos_rate_change?: number;
  shipping_revenue_per_order?: number;
  shipping_cost_per_order?: number;
  cac_new: number;
  cac_repeat: number;
  cac_rate_start?: number;
  cac_rate_change?: number;

  // Growth & churn
  starting_new_customers: number;        // month 1
  growth_rate_start: number;             // ex 0.90 = +90%/mois initial
  growth_rate_change: number;            // ex -0.15 (le growth ralentit)
  conversion_rate: number;               // sessions → orders
  churn_per_cycle: number;               // 0..1
  repeat_cycle_months: number;           // ex 3
  cohort_size_break_after?: number;      // 0 = pas d'ajustement
  cohort_size_adjustment?: number;       // ex 1 = pas d'ajustement
};

export type HemrockMonthly = {
  month: number;                         // 1..N
  new_customers: number;
  growth_rate: number;
  orders_new: number;
  orders_repeat: number;
  orders_total: number;
  website_traffic: number;
  aov_new: number;
  aov_repeat: number;
  aov_rate: number;
  cos_pct: number;
  cac_new: number;
  cac_repeat: number;
  revenue: number;
  shipping_revenue: number;
  total_revenue: number;
  cogs: number;
  shipping_cogs: number;
  total_cogs: number;
  marketing_spend: number;
  operating_income: number;
  aov_realized: number;                  // revenue / orders
  gross_margin_per_order: number;
  acquisition_cost_per_order: number;
  contribution_margin_per_order: number;
};

export type HemrockAnnual = {
  year: number;                          // 1..
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  marketing_spend: number;
  operating_income: number;
  orders: number;
  new_customers: number;
  avg_cac_blended: number;
  ltv_estimated: number;
  ltv_cac_ratio: number;
  cac_payback_months: number | null;
};

export type HemrockOutput = {
  engine_version: "hemrock_forecast_replica_v1";
  retention_curve: number[];             // len = horizon+1, orders per 1 new customer per month index
  lifetime_orders: number;               // Σ retention_curve
  monthly: HemrockMonthly[];
  annual: HemrockAnnual[];
  ltv_final: number;                     // (aov_new + aov_repeat*(orders_lifetime-1)) * (1-cos_total) + shipping_margin*orders_lifetime
  summary: string;
};

// ---------- Retention curve (rows 41 & 44 du sheet Hemrock) ----------
// t=1  → 1 commande (premier achat)
// t=cycle → (1-churn)   commandes cumulées sur ce cycle
// t=2*cycle → (1-churn)^2
// entre les cycles : 0.
export function buildRetentionCurve(
  churnPerCycle: number,
  cycleMonths: number,
  horizonMonths: number,
): number[] {
  const curve = new Array(horizonMonths + 1).fill(0);
  curve[1] = 1;
  if (cycleMonths <= 0) return curve;
  const survivalPerCycle = Math.max(0, Math.min(1, 1 - churnPerCycle));
  let last = 1;
  for (let t = 2; t <= horizonMonths; t++) {
    if ((t - 1) % cycleMonths === 0) {
      last = last * survivalPerCycle;
      curve[t] = last;
    }
  }
  return curve;
}

// ---------- Rate-of-change compound (row 161, 165, 168 : ratX = prev * (1 + change)) ----------
function compoundSeries(start: number, change: number, len: number): number[] {
  const out = new Array(len);
  out[0] = start;
  for (let i = 1; i < len; i++) out[i] = out[i - 1] * (1 + change);
  return out;
}

// ---------- Value compound with dynamic rate (row 159, 160, 162, 166, 167) ----------
// val[t] = val[t-1] * (1 + rate[t])
function valueCompound(start: number, rateSeries: number[]): number[] {
  const out = new Array(rateSeries.length);
  out[0] = start;
  for (let i = 1; i < rateSeries.length; i++) out[i] = out[i - 1] * (1 + rateSeries[i]);
  return out;
}

// ---------- Engine ----------

export function runHemrockForecast(inp: HemrockInputs): HemrockOutput {
  const H = inp.horizon_months ?? 48;
  const cycle = Math.max(1, Math.floor(inp.repeat_cycle_months));

  // 1) Retention curve (per 1 new customer)
  const retention = buildRetentionCurve(inp.churn_per_cycle, cycle, H);
  const lifetimeOrders = retention.reduce((a, b) => a + b, 0);

  // 2) Rate series (compounded change of rate)
  const aovRateSeries = compoundSeries(inp.aov_rate_start, 0, H); // rate_change on rate itself
  // Actually Hemrock: T161 = S161*(1+T19) where T19 = aov_rate_change (row 19 fixed)
  // So rate compounds by aov_rate_change each month.
  for (let i = 1; i < H; i++) aovRateSeries[i] = aovRateSeries[i - 1] * (1 + inp.aov_rate_change);

  const cosRateSeries = compoundSeries(inp.cos_rate_start ?? 0, 0, H);
  for (let i = 1; i < H; i++) cosRateSeries[i] = cosRateSeries[i - 1] * (1 + (inp.cos_rate_change ?? 0));

  const cacRateSeries = compoundSeries(inp.cac_rate_start ?? 0, 0, H);
  for (let i = 1; i < H; i++) cacRateSeries[i] = cacRateSeries[i - 1] * (1 + (inp.cac_rate_change ?? 0));

  // 3) Value series (compound with dynamic rate)
  const aovNewSeries = valueCompound(inp.aov_new, aovRateSeries);
  const aovRepeatSeries = valueCompound(inp.aov_repeat ?? inp.aov_new * 0.8, aovRateSeries);
  const cosPctSeries = valueCompound(inp.cos_pct, cosRateSeries);
  const cosExtra1Series = valueCompound(inp.cos_pct_extra_1 ?? 0, cosRateSeries);
  const cosExtra2Series = valueCompound(inp.cos_pct_extra_2 ?? 0, cosRateSeries);
  const cacNewSeries = valueCompound(inp.cac_new, cacRateSeries);
  const cacRepeatSeries = valueCompound(inp.cac_repeat, cacRateSeries);

  // 4) Growth rate series (row 53 : S53*(1+T36))
  const growthSeries: number[] = new Array(H);
  growthSeries[0] = inp.growth_rate_start;
  for (let i = 1; i < H; i++) growthSeries[i] = growthSeries[i - 1] * (1 + inp.growth_rate_change);

  // 5) New customers per month (row 52 : S52*(1+T53))
  const newCust: number[] = new Array(H);
  newCust[0] = inp.starting_new_customers;
  for (let i = 1; i < H; i++) newCust[i] = newCust[i - 1] * (1 + growthSeries[i]);

  // 6) Cohort waterfall — orders per month
  // orders[t] = Σ_{c=1..t} newCust[c] * retention[t - c + 1] * adjustment(c)
  const cumulNewAt: number[] = new Array(H + 1).fill(0);
  const orders: number[] = new Array(H).fill(0);
  const ordersNew: number[] = new Array(H).fill(0);
  const ordersRepeat: number[] = new Array(H).fill(0);

  const breakAfter = inp.cohort_size_break_after ?? 0;
  const cohortAdj = inp.cohort_size_adjustment ?? 1;

  for (let cohortM = 1; cohortM <= H; cohortM++) {
    cumulNewAt[cohortM] = cumulNewAt[cohortM - 1] + newCust[cohortM - 1];
    const adj = breakAfter > 0 && cumulNewAt[cohortM] > breakAfter ? cohortAdj : 1;
    for (let t = cohortM; t <= H; t++) {
      const age = t - cohortM + 1;
      const rc = retention[age] ?? 0;
      const contribution = newCust[cohortM - 1] * rc * adj;
      orders[t - 1] += contribution;
      if (t === cohortM) ordersNew[t - 1] += contribution;
      else ordersRepeat[t - 1] += contribution;
    }
  }

  // 7) P&L per month
  const monthly: HemrockMonthly[] = [];
  for (let i = 0; i < H; i++) {
    const rev = ordersNew[i] * aovNewSeries[i] + ordersRepeat[i] * aovRepeatSeries[i];
    const shipRev = orders[i] * (inp.shipping_revenue_per_order ?? 0);
    const totalRev = rev + shipRev;
    const cogs = rev * cosPctSeries[i];
    const cogsExtra = rev * (cosExtra1Series[i] + cosExtra2Series[i]);
    const shipCogs = orders[i] * (inp.shipping_cost_per_order ?? 0);
    const totalCogs = cogs + cogsExtra + shipCogs;
    const mkt = ordersNew[i] * cacNewSeries[i] + ordersRepeat[i] * cacRepeatSeries[i];
    const opInc = totalRev - totalCogs - mkt;
    const aovR = orders[i] > 0 ? rev / orders[i] : 0;
    const cosPerOrder = orders[i] > 0 ? cogs / orders[i] : 0;
    const gmPerOrder = aovR - cosPerOrder;
    const shipMargin = (inp.shipping_revenue_per_order ?? 0) - (inp.shipping_cost_per_order ?? 0);
    const acqPerOrder = orders[i] > 0 ? mkt / orders[i] : 0;
    monthly.push({
      month: i + 1,
      new_customers: round(newCust[i]),
      growth_rate: round(growthSeries[i], 4),
      orders_new: round(ordersNew[i]),
      orders_repeat: round(ordersRepeat[i]),
      orders_total: round(orders[i]),
      website_traffic: inp.conversion_rate > 0 ? round(orders[i] / inp.conversion_rate) : 0,
      aov_new: round(aovNewSeries[i]),
      aov_repeat: round(aovRepeatSeries[i]),
      aov_rate: round(aovRateSeries[i], 4),
      cos_pct: round(cosPctSeries[i], 4),
      cac_new: round(cacNewSeries[i]),
      cac_repeat: round(cacRepeatSeries[i]),
      revenue: round(rev),
      shipping_revenue: round(shipRev),
      total_revenue: round(totalRev),
      cogs: round(cogs + cogsExtra),
      shipping_cogs: round(shipCogs),
      total_cogs: round(totalCogs),
      marketing_spend: round(mkt),
      operating_income: round(opInc),
      aov_realized: round(aovR),
      gross_margin_per_order: round(gmPerOrder),
      acquisition_cost_per_order: round(acqPerOrder),
      contribution_margin_per_order: round(gmPerOrder + shipMargin - acqPerOrder),
    });
  }

  // 8) Annual roll-up (12-month buckets)
  const annual: HemrockAnnual[] = [];
  const years = Math.ceil(H / 12);
  for (let y = 0; y < years; y++) {
    const slice = monthly.slice(y * 12, (y + 1) * 12);
    const rev = slice.reduce((a, m) => a + m.total_revenue, 0);
    const cogs = slice.reduce((a, m) => a + m.total_cogs, 0);
    const mkt = slice.reduce((a, m) => a + m.marketing_spend, 0);
    const ord = slice.reduce((a, m) => a + m.orders_total, 0);
    const nc = slice.reduce((a, m) => a + m.new_customers, 0);
    const gp = rev - cogs;
    const cacBlended = nc > 0 ? mkt / nc : 0;
    // LTV Hemrock (row 191) = (aov_new + aov_repeat*(N-1)) * (1 - cos_total) + ship_margin*N
    const aovN = slice[0]?.aov_new ?? inp.aov_new;
    const aovR = slice[0]?.aov_repeat ?? inp.aov_repeat;
    const cosTotal = (slice[0]?.cos_pct ?? inp.cos_pct) + (inp.cos_pct_extra_1 ?? 0) + (inp.cos_pct_extra_2 ?? 0);
    const shipMargin = (inp.shipping_revenue_per_order ?? 0) - (inp.shipping_cost_per_order ?? 0);
    const ltv = (aovN + aovR * (lifetimeOrders - 1)) * (1 - cosTotal) + shipMargin * lifetimeOrders;
    const gmPct = rev > 0 ? gp / rev : 0;
    const gpPerCust = nc > 0 ? gp / nc : 0;
    const payback = gpPerCust > 0 ? cacBlended / (gpPerCust / 12) : null;
    annual.push({
      year: y + 1,
      total_revenue: round(rev),
      total_cogs: round(cogs),
      gross_profit: round(gp),
      gross_margin_pct: round(gmPct, 4),
      marketing_spend: round(mkt),
      operating_income: round(rev - cogs - mkt),
      orders: round(ord),
      new_customers: round(nc),
      avg_cac_blended: round(cacBlended),
      ltv_estimated: round(ltv),
      ltv_cac_ratio: cacBlended > 0 ? round(ltv / cacBlended, 2) : 0,
      cac_payback_months: payback !== null ? round(payback, 2) : null,
    });
  }

  const ltvFinal = annual[0]?.ltv_estimated ?? 0;
  const summary = `Hemrock replica · ${H}mo horizon · ${monthly[H - 1]?.orders_total ?? 0} orders month ${H} · LTV ${ltvFinal.toFixed(0)} · LTV:CAC ${annual[0]?.ltv_cac_ratio ?? 0} · lifetime orders/cust ${lifetimeOrders.toFixed(2)}.`;

  return {
    engine_version: "hemrock_forecast_replica_v1",
    retention_curve: retention.map((v) => round(v, 4)),
    lifetime_orders: round(lifetimeOrders, 4),
    monthly,
    annual,
    ltv_final: round(ltvFinal),
    summary,
  };
}

function round(x: number, dp = 2): number {
  if (!isFinite(x)) return 0;
  const p = Math.pow(10, dp);
  return Math.round(x * p) / p;
}
