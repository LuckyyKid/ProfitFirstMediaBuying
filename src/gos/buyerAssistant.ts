// Buyer Decision Assistant — diagnostic tree
// Reads yesterday's campaign perf vs category target and outputs a recommendation
// (decision_type + new_budget + reasoning + expected_impact) following the
// What / So What / Now What framework.

export type AssistantInput = {
  campaign_name: string;
  platform: string;
  current_daily_budget: number;
  target_cpa: number | null;
  target_daily_budget: number | null;
  spend: number;
  orders: number;
  revenue: number;
  // optional 7d rolling for stability check
  spend_7d?: number;
  orders_7d?: number;
};

export type AssistantOutput = {
  decision_type: "scale" | "increase" | "hold" | "decrease" | "pause" | "kill" | "resume";
  new_budget: number | null;
  confidence: "low" | "medium" | "high";
  what: string;        // observed facts
  so_what: string;     // interpretation
  now_what: string;    // action + expected impact
  reasoning: string;   // consolidated for storage
};

// Daily budget rule from Growth Ops playbook: target_cpa × 50 / 7 as a floor
export function idealDailyBudget(targetCpa: number | null): number | null {
  if (!targetCpa || targetCpa <= 0) return null;
  return Math.round((targetCpa * 50) / 7);
}

export function runBuyerAssistant(i: AssistantInput): AssistantOutput {
  const cpa = i.orders > 0 ? i.spend / i.orders : null;
  const cpa7 = (i.spend_7d && i.orders_7d && i.orders_7d > 0) ? i.spend_7d / i.orders_7d : null;
  const roas = i.spend > 0 && i.revenue > 0 ? i.revenue / i.spend : null;
  const target = i.target_cpa;
  const ideal = idealDailyBudget(target);
  const budget = i.current_daily_budget || 0;

  // No target → cannot advise
  if (!target) {
    return {
      decision_type: "hold",
      new_budget: null,
      confidence: "low",
      what: `Aucun CPA cible défini pour cette campagne.`,
      so_what: `Impossible d'évaluer la performance sans référence.`,
      now_what: `Définir un target_cpa au niveau de la catégorie avant toute décision.`,
      reasoning: "Pas de cible → hold par défaut.",
    };
  }

  // No orders and meaningful spend → kill/pause
  if (i.orders === 0 && i.spend >= (ideal ?? budget) * 0.5) {
    return {
      decision_type: i.spend >= (ideal ?? budget) ? "kill" : "pause",
      new_budget: 0,
      confidence: "high",
      what: `Dépense de $${i.spend.toFixed(0)} sans aucune commande.`,
      so_what: `CPA infini → capital brûlé sans acquisition. Le seuil de test (½ budget idéal) est franchi.`,
      now_what: i.spend >= (ideal ?? budget)
        ? `Tuer la campagne, réallouer le budget vers une catégorie plus performante.`
        : `Pauser 24-48h, revoir l'audience/créatif, retester avec un budget réduit.`,
      reasoning: `0 order @ $${i.spend.toFixed(0)} spend → au-delà du budget de test.`,
    };
  }

  if (cpa == null) {
    return {
      decision_type: "hold",
      new_budget: null,
      confidence: "low",
      what: `Peu de données : ${i.orders} commande(s), $${i.spend.toFixed(0)} dépensés.`,
      so_what: `Volume insuffisant pour conclure — écart CPA non significatif.`,
      now_what: `Maintenir 3-7 jours, réévaluer avec le rolling 7 jours.`,
      reasoning: "Volume insuffisant.",
    };
  }

  const gap = (cpa - target) / target;        // >0 = mauvais (CPA trop haut)
  const gap7 = cpa7 != null ? (cpa7 - target) / target : null;
  const stable = gap7 != null && Math.sign(gap7) === Math.sign(gap);

  // Very bad (>25% over target)
  if (gap > 0.25) {
    return {
      decision_type: "decrease",
      new_budget: Math.max(Math.round(budget * 0.5), ideal ? Math.round(ideal * 0.5) : 0),
      confidence: stable ? "high" : "medium",
      what: `CPA $${cpa.toFixed(2)} vs cible $${target} (+${(gap * 100).toFixed(0)}%).`,
      so_what: `Campagne significativement au-dessus de la cible${stable ? " et confirmée sur 7j" : ""}.`,
      now_what: `Réduire le budget de 50%, auditer l'audience/hook créatif dans 48h.`,
      reasoning: `CPA +${(gap * 100).toFixed(0)}% vs target ${stable ? "(stable 7j)" : ""}.`,
    };
  }

  // Bad (10-25% over)
  if (gap > 0.10) {
    return {
      decision_type: "decrease",
      new_budget: Math.round(budget * 0.8),
      confidence: stable ? "medium" : "low",
      what: `CPA $${cpa.toFixed(2)} vs cible $${target} (+${(gap * 100).toFixed(0)}%).`,
      so_what: `Hors bande +10% — dérive contrôlée mais réelle.`,
      now_what: `Réduire budget -20% et surveiller 3 jours. Si retour dans bande → réaugmenter.`,
      reasoning: `CPA hors bande haute (+${(gap * 100).toFixed(0)}%).`,
    };
  }

  // Great (>25% below target = très bon)
  if (gap < -0.25) {
    const newBudget = Math.max(Math.round(budget * 1.2), ideal ?? 0);
    return {
      decision_type: "scale",
      new_budget: newBudget,
      confidence: stable ? "high" : "medium",
      what: `CPA $${cpa.toFixed(2)} vs cible $${target} (${(gap * 100).toFixed(0)}%)${roas ? `, ROAS ${roas.toFixed(2)}` : ""}.`,
      so_what: `Campagne largement rentable${stable ? " et confirmée 7j" : ""}. Marge pour scaler sans casser l'algorithme.`,
      now_what: `Scale +20% (règle : max +20%/48h pour préserver l'apprentissage).`,
      reasoning: `CPA ${(gap * 100).toFixed(0)}% vs target → scale contrôlé.`,
    };
  }

  // Good (10-25% below)
  if (gap < -0.10) {
    return {
      decision_type: "increase",
      new_budget: Math.round(budget * 1.15),
      confidence: stable ? "medium" : "low",
      what: `CPA $${cpa.toFixed(2)} vs cible $${target} (${(gap * 100).toFixed(0)}%).`,
      so_what: `Sous la cible avec marge — signal positif à confirmer.`,
      now_what: `Augmenter le budget +15%. Vérifier stabilité sur 3 jours avant scale plus agressif.`,
      reasoning: `CPA sous cible (${(gap * 100).toFixed(0)}%) → increase.`,
    };
  }

  // In-band → hold, but flag underspend vs ideal budget
  if (ideal && budget < ideal * 0.7) {
    return {
      decision_type: "increase",
      new_budget: ideal,
      confidence: "medium",
      what: `CPA dans la bande ($${cpa.toFixed(2)} vs $${target}) mais budget $${budget}/j < budget idéal $${ideal}/j (CPA×50/7).`,
      so_what: `Sous-investi : l'algo n'a pas assez de signal pour optimiser (< 50 conversions/semaine).`,
      now_what: `Monter au budget idéal $${ideal}/j pour atteindre le seuil d'apprentissage.`,
      reasoning: `In-band + underspend vs CPA×50/7.`,
    };
  }

  return {
    decision_type: "hold",
    new_budget: budget,
    confidence: "medium",
    what: `CPA $${cpa.toFixed(2)} vs cible $${target} (${(gap * 100).toFixed(0)}%) — dans la bande ±10%.`,
    so_what: `Performance conforme, pas de signal pour bouger.`,
    now_what: `Maintenir le budget, réévaluer demain.`,
    reasoning: `In-band, hold.`,
  };
}
