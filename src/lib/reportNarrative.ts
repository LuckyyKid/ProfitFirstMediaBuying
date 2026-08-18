// Génération déterministe du rapport client à partir du payload système
// (calculé par report-payload-build) et des inputs AM (contexte + réponses
// aux questions ouvertes + actions décidées).
//
// Zéro LLM. Chaque hypothèse du SO WHAT porte un niveau de certitude
// (confirmé / probable / hypothèse / non_explique), pour que le rendu
// portail affiche un badge honnête plutôt qu'une affirmation lisse.

export type EventType =
  | "creative_coupee"
  | "creative_lancee"
  | "changement_budget"
  | "changement_destination"
  | "changement_audience"
  | "changement_offre"
  | "note";

export interface ActivityEntry {
  id: string;
  client_code: string;
  event_date: string;
  event_type: EventType;
  description: string;
}

export interface Kpis {
  spend?: number;
  purchases?: number;
  purchase_value?: number;
  roas?: number;
  cpa?: number;
  ctr?: number;
  cpm?: number;
  aov?: number;
  clicks?: number;
  impressions?: number;
  frequency_approx?: number;
}

export interface Variation {
  metric: keyof Kpis;
  current: number;
  previous: number;
  delta_pct: number;
  impact_dollars?: number;
}

export interface OpenQuestion {
  id: string;
  metric: keyof Kpis;
  context: string;
  linked_events?: string[]; // ids d'ActivityEntry
}

// Shapes attendus dans breakdown_ad_sets et creatives_highlight. Le backend
// Lovable est censé garantir ces champs (voir prompt d'enrichissement), mais
// tout est optionnel côté type pour rester tolérant tant que l'enrichissement
// n'est pas déployé : les rendus dégradent gracieusement.
export interface AdSetRow {
  id?: string;
  name?: string;
  campaign_name?: string;
  spend?: number;
  purchases?: number;
  purchase_value?: number;
  roas?: number | null;
  cpa?: number | null;
  ctr?: number | null;
  cpm?: number | null;
  aov?: number | null;
  adds_to_cart?: number | null;
  is_active?: boolean;
}

export interface CreativeRow {
  id?: string;
  ad_name?: string;
  ad_set_id?: string;
  ad_set_name?: string;
  ad_image_url?: string;
  spend?: number;
  purchases?: number;
  purchase_value?: number;
  ctr?: number | null;
  roas?: number | null;
  highlight_reason?: "top_spend" | "top_roas" | "top_ctr" | "am_cut";
}

// Narratives : regroupement déterministe des variations en récits factuels
// avec catalogue de causes par étage de funnel. Le frontend consomme ceci
// pour remplacer les questions_ouvertes yes/no/other par des chips causes
// + un select certitude choisi par l'AM.
export type FunnelStage =
  | "creative"
  | "post_click"
  | "conversion"
  | "aov"
  | "cost"
  | "scaling";

export interface NarrativeCause {
  id: string;
  label: string;
  needs_detail?: boolean;
  needs_linked_creative?: boolean;
}

export interface Narrative {
  id: string;
  title: string;
  human_description: string;
  funnel_stage: FunnelStage;
  linked_metrics: string[];
  verified_facts: string[];
  auto_resolved: boolean;
  auto_resolution?: string;
  available_causes: NarrativeCause[];
}

// Snapshot du dernier rapport publié pour ce client — permet à l'AM de
// valider ce qui a été fait / bloqué depuis la semaine dernière. Fourni par
// report-payload-build (null si aucun rapport publié précédent).
export interface PreviousReportSnapshot {
  report_id: string;
  periode_debut: string;
  periode_fin: string;
  published_at: string;
  actions: Array<{
    id: string;
    action: string;
    responsible?: "agence" | "client";
    horizon?: "cette_semaine" | "prochaine" | "mois";
  }>;
}

export interface PayloadSysteme {
  periode: { debut: string; fin: string; nb_jours: number };
  fraicheur: { last_refreshed_at: string; source: string };
  config_utilisee: {
    client_type?: string;
    conversion_metric?: "purchases" | "leads";
    target_cpl_or_roas?: number;
    variance_threshold_pct?: number;
  };
  kpis_semaine: Kpis;
  kpis_semaine_prec: Kpis;
  variations: Variation[];
  historique_hebdo: Array<{
    iso_week: string;
    spend: number;
    revenue: number;
    roas: number | null;
    cpa: number | null;
  }>;
  breakdown_ad_sets: AdSetRow[];
  breakdown_annonces: CreativeRow[];
  creatives_highlight: CreativeRow[];
  flags: string[];
  questions_ouvertes: OpenQuestion[];
  narratives?: Narrative[];
  am_activity_log: ActivityEntry[];
  previous_report_snapshot?: PreviousReportSnapshot | null;
}

// Réponse AM à une question ouverte : oui/non/autre + texte libre.
// Conservé pour rapports legacy — les nouveaux rapports passent par
// narrative_answers ci-dessous.
export interface AnswerToQuestion {
  question_id: string;
  confirm: "yes" | "no" | "other";
  explanation?: string;
}

// Cause cochée par l'AM sur une carte narrative, avec sous-détail optionnel
// (le catalogue backend signale needs_detail / needs_linked_creative sur les
// causes qui l'attendent).
export interface CheckedCause {
  cause_id: string;
  details?: string;
  linked_ad_ids?: string[];
}

// Réponse AM structurée à une narrative — remplace AnswerToQuestion.
// L'AM coche les causes plausibles, ajoute une note libre facultative si
// aucune ne colle, et tranche lui-même la certitude (à la place d'un LLM
// ou d'une heuristique). Vide (certainty=null) tant que l'AM n'a rien saisi.
export interface NarrativeAnswer {
  narrative_id: string;
  checked_causes: CheckedCause[];
  note?: string;
  certainty?: Certainty;
}

// Statut décidé par l'AM sur une créative détectée dans creatives_highlight.
// L'identifiant privilégié est `creative_id` quand présent, sinon fallback
// sur `creative_name` (nom d'annonce Meta). Le rendu affiche une pastille
// colorée à côté de la vignette.
export type CreativeStatusValue = "keep" | "cut" | "test";

export interface CreativeStatus {
  creative_id?: string;
  creative_name?: string;
  status: CreativeStatusValue;
}

// Note narrative facultative que l'AM ajoute sous un ad set, pour raconter
// une décision qui ne tient pas dans les chiffres (ex. « on a coupé les
// statiques sous 1 % CTR, on garde les UGC »).
export interface AdSetNote {
  ad_set_id?: string;
  ad_set_name?: string;
  note: string;
}

export type ActionCategory =
  | "creative"
  | "budget"
  | "audience"
  | "landing"
  | "offre"
  | "mesure"
  | "attente";

export interface ProposedAction {
  action: string;
  pourquoi_chiffre?: string;
  resultat_attendu?: string;
  category?: ActionCategory;
  responsible?: "agence" | "client";
  horizon?: "cette_semaine" | "prochaine" | "mois";
}

export interface PreviousActionStatus {
  action_id: string;
  status: "done" | "in_progress" | "blocked";
  blocker?: string;              // requis si status === "blocked"
}

export interface InputsAm {
  contexte_flags: string[];      // ex. ["promo", "rupture_stock"]
  contexte_business?: string;    // texte libre
  a_venir?: string;              // texte libre
  answers: AnswerToQuestion[];   // legacy — remplacé par narrative_answers
  narrative_answers?: NarrativeAnswer[];
  actions: ProposedAction[];
  creative_statuses?: CreativeStatus[];
  ad_set_notes?: AdSetNote[];
  previous_actions_status?: PreviousActionStatus[];
}

// ─── Sortie ─────────────────────────────────────────────────────────

export type Certainty = "confirmed" | "probable" | "hypothesis" | "unexplained";

export interface WhatKpiLine {
  metric: keyof Kpis;
  label: string;
  current: number | null;
  previous: number | null;
  delta_pct: number | null;
  tone: "good" | "watch" | "bad" | "neutral";
  format: "money" | "int" | "roas" | "pct";
}

export interface SoWhatHypothesis {
  id: string;
  linked_metric?: keyof Kpis;
  text: string;
  certainty: Certainty;
  linked_events?: string[];
  linked_action_ids?: string[];
}

export interface NowWhatAction {
  id: string;
  // Champ agrégé conservé pour compat (anciens rapports persistés) —
  // le rendu doit préférer les 3 champs structurés ci-dessous quand présents.
  text: string;
  action?: string;
  pourquoi?: string;
  attendu?: string;
  category?: ActionCategory;
  responsible?: "agence" | "client";
  horizon?: "cette_semaine" | "prochaine" | "mois";
  linked_hypothesis_ids?: string[];
}

// Rendu structuré des créatives : le tableau original (thumbnails, spend, CTR)
// vient du payload système, mais les statuts + notes ad set viennent des inputs
// AM. On les propage ici pour que le renderer ait tout au même endroit et que
// le rapport persisté reste rendable sans re-fetcher le payload.
export interface CreativesReview {
  ad_set_notes: AdSetNote[];
  creative_statuses: CreativeStatus[];
}

// Suivi des actions du rapport précédent, tel qu'affiché dans le nouveau
// rapport. Combine le snapshot système (action + responsible + horizon) avec
// le statut AM (done / in_progress / blocked + blocker).
export interface PreviousActionsReview {
  periode_debut: string;
  periode_fin: string;
  entries: Array<{
    action_id: string;
    action: string;
    responsible?: "agence" | "client";
    horizon?: "cette_semaine" | "prochaine" | "mois";
    status: "done" | "in_progress" | "blocked" | "pending";
    blocker?: string;
  }>;
}

export interface ReportNarrative {
  what: {
    resume: string;
    kpis: WhatKpiLine[];
  };
  so_what: SoWhatHypothesis[];
  now_what: NowWhatAction[];
  creatives_review?: CreativesReview;
  previous_actions_review?: PreviousActionsReview;
}

// ─── Helpers formatage ──────────────────────────────────────────────

const CAD = new Intl.NumberFormat("fr-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const CAD2 = new Intl.NumberFormat("fr-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const INT = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });

function money(n: number | null | undefined, decimals = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return decimals ? CAD2.format(n) : CAD.format(n);
}
function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return INT.format(n);
}
function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)} %`;
}
function roas(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}×`;
}
function signedPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)} %`;
}

const METRIC_LABELS: Record<keyof Kpis, string> = {
  spend: "dépense publicitaire",
  purchases: "achats",
  purchase_value: "revenu",
  roas: "ROAS",
  cpa: "coût par achat",
  ctr: "taux de clic",
  cpm: "coût pour mille impressions",
  aov: "panier moyen",
  clicks: "clics",
  impressions: "impressions",
  frequency_approx: "fréquence",
};

// En mode leads, `purchases` et `cpa` sont remontés par le pipeline Meta mais
// le client les lit comme leads/CPL — on relabelle seulement l'affichage,
// jamais les clés (le stockage reste stable pour la comparaison historique).
function metricLabel(
  m: keyof Kpis,
  mode?: "purchases" | "leads",
): string {
  if (mode === "leads") {
    if (m === "purchases") return "leads";
    if (m === "cpa") return "CPL";
  }
  return METRIC_LABELS[m] ?? String(m);
}

// Un tone naïf par métrique clé — le vrai jugement est dans le SO WHAT.
function toneFor(metric: keyof Kpis, delta_pct: number | null): WhatKpiLine["tone"] {
  if (delta_pct == null) return "neutral";
  const good = delta_pct > 0;
  const isCostLike = metric === "cpa" || metric === "cpm";
  const improved = isCostLike ? !good : good;
  const magnitude = Math.abs(delta_pct);
  if (magnitude < 5) return "neutral";
  if (magnitude < 15) return improved ? "good" : "watch";
  return improved ? "good" : "bad";
}

function formatFor(metric: keyof Kpis): WhatKpiLine["format"] {
  if (metric === "roas") return "roas";
  if (metric === "ctr") return "pct";
  if (metric === "purchases" || metric === "clicks" || metric === "impressions") return "int";
  return "money";
}

// ─── Construction du WHAT ───────────────────────────────────────────

// L'ordre des KPI affichés et considérés par le blocker de publication
// dépend du modèle du client. Un client leads (agence locale) n'a ni
// revenu ni AOV ni ROAS — les inclure produirait des tirets partout.
const WHAT_METRIC_ORDER_PURCHASES: Array<keyof Kpis> = [
  "spend",
  "purchases",
  "purchase_value",
  "aov",
  "roas",
  "cpa",
  "ctr",
];
const WHAT_METRIC_ORDER_LEADS: Array<keyof Kpis> = [
  "spend",
  "purchases",
  "cpa",
  "ctr",
  "cpm",
];
function whatMetricOrder(payload: PayloadSysteme): Array<keyof Kpis> {
  return payload.config_utilisee?.conversion_metric === "leads"
    ? WHAT_METRIC_ORDER_LEADS
    : WHAT_METRIC_ORDER_PURCHASES;
}

// Enrichit les KPIs avec l'AOV (revenu / achats) calculé côté frontend si le
// payload ne le fournit pas — évite qu'un rapport présente "moins d'achats mais
// panier plus élevé" comme hypothèse alors que la donnée est vérifiable.
function computeMissingKpis(k: Kpis): Kpis {
  const out: Kpis = { ...k };
  if (out.aov == null && typeof k.purchase_value === "number" && typeof k.purchases === "number" && k.purchases > 0) {
    out.aov = k.purchase_value / k.purchases;
  }
  if (out.roas == null && typeof k.purchase_value === "number" && typeof k.spend === "number" && k.spend > 0) {
    out.roas = k.purchase_value / k.spend;
  }
  if (out.cpa == null && typeof k.spend === "number" && typeof k.purchases === "number" && k.purchases > 0) {
    out.cpa = k.spend / k.purchases;
  }
  return out;
}

// Formulation directionnelle stricte à partir d'un delta signé — utilisée
// dans le résumé pour éviter que le PDF n'invente ("hausse malgré budget stable"
// alors que les achats ont baissé). Chaque phrase du résumé est prouvable
// depuis les kpis passés en argument.
function directionLabel(delta_pct: number | null, quasiStableThresholdPct = 3): string {
  if (delta_pct == null) return "non comparable";
  const abs = Math.abs(delta_pct);
  if (abs < quasiStableThresholdPct) return "quasi stable";
  return delta_pct > 0 ? `en hausse de ${signedPct(delta_pct)}` : `en baisse de ${signedPct(delta_pct)}`;
}

function pctChange(current: number | undefined, previous: number | undefined): number | null {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function buildWhat(payload: PayloadSysteme): ReportNarrative["what"] {
  const cur = computeMissingKpis(payload.kpis_semaine);
  const prev = computeMissingKpis(payload.kpis_semaine_prec);
  const mode = payload.config_utilisee?.conversion_metric;

  const kpis: WhatKpiLine[] = whatMetricOrder(payload).map((metric) => {
    const c = cur[metric];
    const p = prev[metric];
    let delta_pct: number | null = null;
    if (typeof c === "number" && typeof p === "number" && p !== 0) {
      delta_pct = ((c - p) / p) * 100;
    }
    return {
      metric,
      label: metricLabel(metric, mode),
      current: typeof c === "number" ? c : null,
      previous: typeof p === "number" ? p : null,
      delta_pct,
      tone: toneFor(metric, delta_pct),
      format: formatFor(metric),
    };
  });

  // Résumé factuel en 3 mouvements — chacun vérifiable depuis les KPIs.
  // Zone budget → zone conversion → zone efficacité. Toute affirmation
  // directionnelle est dérivée du delta signé (jamais inventée).
  const dSpend = pctChange(cur.spend, prev.spend);
  const dPurchases = pctChange(cur.purchases, prev.purchases);
  const dRevenue = pctChange(cur.purchase_value, prev.purchase_value);
  const dAov = pctChange(cur.aov, prev.aov);
  const dRoas = pctChange(cur.roas, prev.roas);

  const spendCur = typeof cur.spend === "number" ? money(cur.spend) : "—";
  const revenueCur = typeof cur.purchase_value === "number" ? money(cur.purchase_value) : "—";
  const ordersCur = typeof cur.purchases === "number" ? num(cur.purchases) : "—";
  const roasCur = typeof cur.roas === "number" ? roas(cur.roas) : "—";
  const aovCur = typeof cur.aov === "number" ? money(cur.aov, true) : null;

  const target = payload.config_utilisee.target_cpl_or_roas;
  const targetLabel =
    typeof target === "number"
      ? payload.config_utilisee.client_type === "local"
        ? ` (cible ${money(target)})`
        : ` (cible ${target.toFixed(2)}×)`
      : "";

  const lines: string[] = [];

  // Ligne 1 : cadre de la semaine (dépense + revenu).
  lines.push(
    `Sur la période du ${payload.periode.debut} au ${payload.periode.fin} (${payload.periode.nb_jours} jours), la dépense publicitaire est ${directionLabel(dSpend)} à ${spendCur} et le revenu attribué est ${directionLabel(dRevenue)} à ${revenueCur}.`,
  );

  // Ligne 2 : volume vs panier moyen — c'est là que se joue "moins d'achats
  // mais plus de valeur par achat" : on l'énonce factuellement au lieu de le
  // laisser en hypothèse.
  if (dPurchases != null && dAov != null && aovCur) {
    lines.push(
      `Le volume d'achats est ${directionLabel(dPurchases)} (${ordersCur} achats) tandis que le panier moyen est ${directionLabel(dAov)} à ${aovCur}.`,
    );
  } else if (dPurchases != null) {
    lines.push(`Le volume d'achats est ${directionLabel(dPurchases)} (${ordersCur} achats).`);
  }

  // Ligne 3 : efficacité globale (ROAS) + cible si connue.
  lines.push(`Résultat : un ROAS ${directionLabel(dRoas)} à ${roasCur}${targetLabel}.`);

  return { resume: lines.join(" "), kpis };
}

// ─── Construction du SO WHAT ────────────────────────────────────────

// Fenêtre de rapprochement journal/variation : on considère qu'un
// événement journalisé peut expliquer une variation s'il est datée
// dans la période du rapport OU jusqu'à 3 jours avant le début
// (délai d'apprentissage typique de Meta).
const LOOKBACK_DAYS = 3;

function withinWindow(eventIso: string, debut: string, fin: string): boolean {
  const e = new Date(eventIso).getTime();
  const d = new Date(debut).getTime() - LOOKBACK_DAYS * 86_400_000;
  const f = new Date(fin).getTime() + 86_400_000; // fin inclusive
  return e >= d && e <= f;
}

// Heuristique de matching événement ↔ métrique : quels event_types
// peuvent plausiblement expliquer une variation de quelle KPI ?
const CAUSAL_MAP: Record<keyof Kpis, EventType[]> = {
  spend: ["changement_budget"],
  purchases: [
    "changement_destination",
    "changement_offre",
    "changement_audience",
    "creative_coupee",
    "creative_lancee",
    "changement_budget",
  ],
  purchase_value: [
    "changement_destination",
    "changement_offre",
    "changement_audience",
  ],
  roas: [
    "changement_destination",
    "changement_offre",
    "changement_audience",
    "creative_coupee",
    "creative_lancee",
  ],
  cpa: [
    "changement_destination",
    "changement_audience",
    "creative_coupee",
    "creative_lancee",
    "changement_offre",
  ],
  ctr: ["creative_coupee", "creative_lancee", "changement_audience"],
  cpm: ["changement_audience"],
  aov: ["changement_offre"],
  clicks: ["creative_coupee", "creative_lancee", "changement_audience"],
  impressions: ["changement_budget", "changement_audience"],
  frequency_approx: ["changement_budget", "changement_audience"],
};

function directionWord(v: Variation): string {
  if (v.delta_pct > 0) return "en hausse";
  if (v.delta_pct < 0) return "en baisse";
  return "stable";
}

function impactSentence(v: Variation): string {
  if (v.impact_dollars == null || !Number.isFinite(v.impact_dollars)) return "";
  const sign = v.impact_dollars >= 0 ? "captés" : "non-captés";
  return ` Impact estimé : ≈ ${money(Math.abs(v.impact_dollars))} ${sign}.`;
}

function isInsufficientData(v: Variation, flags: string[]): boolean {
  return flags.some((f) => f.startsWith("donnees_insuffisantes"));
}

// Mots-clés qui identifient une métrique dans un texte libre AM.
// Si l'AM parle d'une métrique dont le payload contient les chiffres,
// on refuse de laisser la sortie en "hypothèse" — au minimum "probable"
// (la métrique bouge dans le sens claimed) ou "confirmed" (l'ampleur
// est significative), et on annote le texte avec la valeur vérifiée.
const METRIC_KEYWORDS: Array<{ metric: keyof Kpis; patterns: RegExp[] }> = [
  { metric: "aov", patterns: [/panier\s+moyen/i, /\baov\b/i, /valeur\s+par\s+achat/i] },
  { metric: "cpa", patterns: [/\bcpa\b/i, /co[uû]t\s+par\s+achat/i, /co[uû]t\s+d'acquisition/i] },
  { metric: "ctr", patterns: [/\bctr\b/i, /taux\s+de\s+clic/i] },
  { metric: "roas", patterns: [/\broas\b/i, /retour\s+publicitaire/i] },
  { metric: "purchase_value", patterns: [/revenu/i, /chiffre\s+d'affaires?/i, /\bca\b/i] },
  { metric: "spend", patterns: [/d[eé]pense/i, /budget/i, /investissement/i] },
  { metric: "purchases", patterns: [/nombre\s+d'achats?/i, /volume\s+d'achats?/i] },
  { metric: "cpm", patterns: [/\bcpm\b/i] },
  { metric: "frequency_approx", patterns: [/fr[eé]quence/i] },
];

interface VerifiedMetric {
  metric: keyof Kpis;
  current: number;
  previous: number;
  delta_pct: number;
  format: WhatKpiLine["format"];
}

function verifiedMetricsFromText(
  text: string,
  cur: Kpis,
  prev: Kpis,
): VerifiedMetric[] {
  const out: VerifiedMetric[] = [];
  for (const { metric, patterns } of METRIC_KEYWORDS) {
    if (!patterns.some((p) => p.test(text))) continue;
    const c = cur[metric];
    const p = prev[metric];
    if (typeof c !== "number" || typeof p !== "number" || p === 0) continue;
    out.push({
      metric,
      current: c,
      previous: p,
      delta_pct: ((c - p) / p) * 100,
      format: formatFor(metric),
    });
  }
  return out;
}

function formatMetricValue(value: number, format: WhatKpiLine["format"]): string {
  switch (format) {
    case "money": return money(value, true);
    case "int": return num(value);
    case "roas": return roas(value);
    case "pct": return pct(value);
  }
}

// Applique la règle "jamais hypothèse si vérifiable" :
// - Scan de la sortie construite
// - Si le texte mentionne une métrique dont on a les chiffres → append la
//   valeur factuelle + upgrade la certitude (hypothesis → probable, ou
//   → confirmed si le mouvement est significatif ≥ 10%).
function enforceVerifiabilityRule(
  h: SoWhatHypothesis,
  cur: Kpis,
  prev: Kpis,
  mode?: "purchases" | "leads",
): SoWhatHypothesis {
  if (h.certainty === "confirmed" || h.certainty === "unexplained") return h;
  const verified = verifiedMetricsFromText(h.text, cur, prev);
  if (verified.length === 0) return h;

  const facts = verified
    .map((v) => {
      const cur = formatMetricValue(v.current, v.format);
      const prev = formatMetricValue(v.previous, v.format);
      return `${metricLabel(v.metric, mode)} : ${prev} → ${cur} (${signedPct(v.delta_pct)})`;
    })
    .join(" · ");

  const maxMagnitude = Math.max(...verified.map((v) => Math.abs(v.delta_pct)));
  const newCertainty: Certainty =
    maxMagnitude >= 10 ? "confirmed" : "probable";

  return {
    ...h,
    certainty: newCertainty,
    text: `${h.text.replace(/\s+$/, "")} Données vérifiées : ${facts}.`,
  };
}

// Rend une carte narrative auto-résolue (le payload prouve déjà la cause,
// pas de question posée à l'AM) — l'AM peut néanmoins avoir laissé une note.
function buildAutoResolvedHypothesis(
  narrative: Narrative,
  answer: NarrativeAnswer | undefined,
): SoWhatHypothesis {
  const parts: string[] = [narrative.human_description];
  if (narrative.auto_resolution) parts.push(narrative.auto_resolution);
  if (narrative.verified_facts.length > 0) {
    parts.push(`Données vérifiées : ${narrative.verified_facts.join(" · ")}.`);
  }
  const note = answer?.note?.trim();
  if (note) parts.push(`Note de l'équipe : ${note}`);
  return {
    id: narrative.id,
    text: parts.join(" "),
    certainty: "confirmed",
  };
}

// Rend une carte narrative où l'AM a coché des causes. L'AM tranche lui-même
// la certitude — le calcul déterministe reste : concaténer les labels de
// causes cochées + les verified_facts + la note libre. Pas d'invention.
function buildNarrativeHypothesis(
  narrative: Narrative,
  answer: NarrativeAnswer | undefined,
): SoWhatHypothesis {
  const parts: string[] = [narrative.human_description];
  const causeLabels: string[] = [];
  const causesById = new Map(narrative.available_causes.map((c) => [c.id, c]));
  for (const checked of answer?.checked_causes ?? []) {
    const cause = causesById.get(checked.cause_id);
    if (!cause) continue;
    const detail = checked.details?.trim();
    causeLabels.push(detail ? `${cause.label} — ${detail}` : cause.label);
  }
  if (causeLabels.length > 0) {
    parts.push(`Cause${causeLabels.length > 1 ? "s" : ""} identifiée${causeLabels.length > 1 ? "s" : ""} par l'équipe : ${causeLabels.join(" · ")}.`);
  }
  const note = answer?.note?.trim();
  if (note) parts.push(note);
  if (narrative.verified_facts.length > 0) {
    parts.push(`Données vérifiées : ${narrative.verified_facts.join(" · ")}.`);
  }
  // Certitude : l'AM tranche. Défaut = hypothesis tant qu'aucune cause n'est
  // cochée (empêche un rapport publié qui affirme sans base).
  const certainty: Certainty =
    answer?.certainty ?? (causeLabels.length > 0 ? "probable" : "hypothesis");
  return {
    id: narrative.id,
    text: parts.join(" "),
    certainty,
  };
}

function buildSoWhatFromNarratives(
  payload: PayloadSysteme,
  inputs: InputsAm,
): SoWhatHypothesis[] {
  const narratives = payload.narratives ?? [];
  if (narratives.length === 0) {
    return [{
      id: "so_all_targets",
      text: "Aucun écart significatif cette semaine par rapport à la semaine précédente. La campagne tient sa trajectoire.",
      certainty: "confirmed",
    }];
  }
  const answersById = new Map((inputs.narrative_answers ?? []).map((a) => [a.narrative_id, a]));
  return narratives.map((n) => {
    const answer = answersById.get(n.id);
    if (n.auto_resolved) return buildAutoResolvedHypothesis(n, answer);
    return buildNarrativeHypothesis(n, answer);
  });
}

function buildSoWhat(
  payload: PayloadSysteme,
  inputs: InputsAm,
): SoWhatHypothesis[] {
  // Nouveau chemin : le payload backend fournit des narratives regroupées.
  // On les consomme directement, la logique legacy sert de fallback pour
  // les rapports antérieurs à l'ajout du champ narratives.
  if (payload.narratives !== undefined) {
    return buildSoWhatFromNarratives(payload, inputs);
  }

  const answersById = new Map(inputs.answers.map((a) => [a.question_id, a]));
  const hypotheses: SoWhatHypothesis[] = [];

  // Cas « tout dans les cibles » : rien qui dépasse le seuil.
  if (payload.variations.length === 0) {
    hypotheses.push({
      id: "so_all_targets",
      text: "Aucun écart significatif cette semaine par rapport à la semaine précédente. La campagne tient sa trajectoire.",
      certainty: "confirmed",
    });
    return hypotheses;
  }

  const mode = payload.config_utilisee?.conversion_metric;
  payload.variations.forEach((v, idx) => {
    const id = `so_${idx}`;
    const metricLbl = metricLabel(v.metric, mode);
    const dir = directionWord(v);
    const magnitude = signedPct(v.delta_pct);

    // Question ouverte associée (même métrique)
    const question = payload.questions_ouvertes.find((q) => q.metric === v.metric);
    const answer = question ? answersById.get(question.id) : undefined;

    // Événements journalisés qui matchent la métrique + fenêtre temporelle
    const allowedTypes = CAUSAL_MAP[v.metric] ?? [];
    const matchingEvents = payload.am_activity_log.filter(
      (ev) =>
        allowedTypes.includes(ev.event_type) &&
        withinWindow(ev.event_date, payload.periode.debut, payload.periode.fin),
    );

    // Cas 5 : données insuffisantes (learning phase)
    if (isInsufficientData(v, payload.flags)) {
      hypotheses.push({
        id,
        linked_metric: v.metric,
        text: `Le ${metricLbl} est ${dir} de ${magnitude} par rapport à la semaine précédente, mais un ou plusieurs ad sets sont encore en période d'apprentissage de Meta (moins de 50 $ dépensés ou moins de 7 jours actifs). Trop tôt pour conclure — à ré-évaluer la semaine prochaine.`,
        certainty: "hypothesis",
        linked_events: matchingEvents.map((e) => e.id),
      });
      return;
    }

    // Cas 1 : événement dans le journal + AM confirme
    if (matchingEvents.length > 0 && answer?.confirm === "yes") {
      const ev = matchingEvents[0];
      hypotheses.push({
        id,
        linked_metric: v.metric,
        text: `Le ${metricLbl} est ${dir} de ${magnitude}. L'équipe a effectué ${eventLabelLower(ev.event_type)} le ${ev.event_date} (${ev.description}), et confirme que c'est la cause principale.${impactSentence(v)}`,
        certainty: "confirmed",
        linked_events: matchingEvents.map((e) => e.id),
      });
      return;
    }

    // Cas 2 : événement dans le journal, pas de confirmation explicite
    if (matchingEvents.length > 0 && (!answer || answer.confirm === "other")) {
      const ev = matchingEvents[0];
      hypotheses.push({
        id,
        linked_metric: v.metric,
        text: `Le ${metricLbl} est ${dir} de ${magnitude}. Cela coïncide avec ${eventLabelLower(ev.event_type)} le ${ev.event_date} (${ev.description}) — corrélation forte, cause probable à valider.${impactSentence(v)}`,
        certainty: "probable",
        linked_events: matchingEvents.map((e) => e.id),
      });
      return;
    }

    // Cas 3 : événement dans le journal mais AM infirme → cause selon AM
    if (matchingEvents.length > 0 && answer?.confirm === "no") {
      const explanation = answer.explanation?.trim();
      hypotheses.push({
        id,
        linked_metric: v.metric,
        text: `Le ${metricLbl} est ${dir} de ${magnitude}. Un changement a été effectué (${matchingEvents[0].description}) mais l'équipe indique qu'il n'explique pas la variation. ${explanation ? `Cause probable selon l'équipe : ${explanation}.` : "Cause à investiguer."}${impactSentence(v)}`,
        certainty: "probable",
        linked_events: matchingEvents.map((e) => e.id),
      });
      return;
    }

    // Cas 4 : pas de journal mais AM a donné une explication libre
    if (answer?.explanation?.trim()) {
      hypotheses.push({
        id,
        linked_metric: v.metric,
        text: `Le ${metricLbl} est ${dir} de ${magnitude}. Selon l'équipe : ${answer.explanation.trim()}. À valider avec les données de la semaine prochaine.${impactSentence(v)}`,
        certainty: "hypothesis",
      });
      return;
    }

    // Cas 6 : pas de journal, pas d'explication AM, contexte business flagué
    if (inputs.contexte_flags.length > 0 || inputs.contexte_business?.trim()) {
      const ctx = inputs.contexte_business?.trim() || inputs.contexte_flags.join(", ");
      hypotheses.push({
        id,
        linked_metric: v.metric,
        text: `Le ${metricLbl} est ${dir} de ${magnitude}. Hypothèse liée au contexte business rapporté : ${ctx}. À valider.${impactSentence(v)}`,
        certainty: "hypothesis",
      });
      return;
    }

    // Cas final : rien à raccrocher → non expliqué
    hypotheses.push({
      id,
      linked_metric: v.metric,
      text: `Le ${metricLbl} est ${dir} de ${magnitude}. Aucune cause identifiée à ce stade — ni changement journalisé, ni contexte particulier rapporté. À surveiller la semaine prochaine avant de tirer une conclusion.${impactSentence(v)}`,
      certainty: "unexplained",
    });
  });

  // Règle "jamais hypothèse si vérifiable" — post-processing sur chaque
  // hypothèse pour intégrer les chiffres et remonter la certitude.
  const curEnriched = computeMissingKpis(payload.kpis_semaine);
  const prevEnriched = computeMissingKpis(payload.kpis_semaine_prec);
  return hypotheses.map((h) => enforceVerifiabilityRule(h, curEnriched, prevEnriched, mode));
}

function eventLabelLower(t: EventType): string {
  const map: Record<EventType, string> = {
    creative_coupee: "la coupure d'une créative",
    creative_lancee: "le lancement d'une nouvelle créative",
    changement_budget: "un changement de budget",
    changement_destination: "un changement de landing page",
    changement_audience: "un changement d'audience",
    changement_offre: "un changement d'offre",
    note: "une intervention notée",
  };
  return map[t];
}

// ─── Construction du NOW WHAT ───────────────────────────────────────

function buildNowWhat(
  payload: PayloadSysteme,
  inputs: InputsAm,
  hypotheses: SoWhatHypothesis[],
): NowWhatAction[] {
  const actions: NowWhatAction[] = inputs.actions.map((a, idx) => {
    const action = a.action.trim();
    const pourquoi = a.pourquoi_chiffre?.trim() || undefined;
    const attendu = a.resultat_attendu?.trim() || undefined;

    // Rétrocompat : on maintient un `text` agrégé pour les anciens rendus
    // qui n'affichent qu'un champ — mais les nouveaux rendus (PDF + web
    // portail) doivent afficher action/pourquoi/attendu séparément.
    const parts: string[] = [action];
    if (pourquoi) parts.push(`parce que ${pourquoi}`);
    if (attendu) parts.push(`attendu : ${attendu}`);

    return {
      id: `nw_${idx}`,
      text: parts.join(" — "),
      action,
      pourquoi,
      attendu,
      category: a.category,
      responsible: a.responsible,
      horizon: a.horizon,
    };
  });

  // Si AM n'a pas décidé d'action ET tout est dans les cibles, on propose
  // explicitement le statu quo (c'est une action valide, pas une inaction).
  if (actions.length === 0 && payload.variations.length === 0) {
    actions.push({
      id: "nw_stay",
      text: "Aucun changement structurel cette semaine — parce que tous les KPIs sont dans les cibles verrouillées en début de mois — on protège la cadence en place.",
      action: "Aucun changement structurel cette semaine",
      pourquoi: "tous les KPIs sont dans les cibles verrouillées en début de mois",
      attendu: "protéger la cadence en place",
      category: "attente",
      responsible: "agence",
      horizon: "cette_semaine",
    });
  }

  // Si AM n'a rien saisi mais qu'il y a des hypothèses « unexplained »,
  // proposer par défaut de surveiller.
  if (actions.length === 0 && hypotheses.some((h) => h.certainty === "unexplained")) {
    actions.push({
      id: "nw_watch",
      text: "Surveiller les KPIs non expliqués sur 7 jours — parce qu'aucune cause n'a été identifiée cette semaine — avant de trancher sur un ajustement.",
      action: "Surveiller les KPIs non expliqués sur 7 jours",
      pourquoi: "aucune cause n'a été identifiée cette semaine",
      attendu: "un signal clair avant de trancher sur un ajustement",
      category: "attente",
      responsible: "agence",
      horizon: "prochaine",
    });
  }

  return actions;
}

// ─── Construction du CREATIVES REVIEW ───────────────────────────────

function buildCreativesReview(inputs: InputsAm): CreativesReview | undefined {
  const statuses = inputs.creative_statuses?.filter((s) => s && s.status) ?? [];
  const notes = (inputs.ad_set_notes ?? []).filter((n) => n?.note?.trim());
  if (statuses.length === 0 && notes.length === 0) return undefined;
  return {
    creative_statuses: statuses,
    ad_set_notes: notes,
  };
}

// ─── Construction du PREVIOUS ACTIONS REVIEW ────────────────────────

function buildPreviousActionsReview(
  payload: PayloadSysteme,
  inputs: InputsAm,
): PreviousActionsReview | undefined {
  const snap = payload.previous_report_snapshot;
  if (!snap || snap.actions.length === 0) return undefined;
  const byId = new Map(
    (inputs.previous_actions_status ?? []).map((s) => [s.action_id, s]),
  );
  return {
    periode_debut: snap.periode_debut,
    periode_fin: snap.periode_fin,
    entries: snap.actions.map((a) => {
      const s = byId.get(a.id);
      return {
        action_id: a.id,
        action: a.action,
        responsible: a.responsible,
        horizon: a.horizon,
        status: s?.status ?? "pending",
        blocker: s?.status === "blocked" ? s.blocker : undefined,
      };
    }),
  };
}

// ─── Garde-fou publication ──────────────────────────────────────────

// Renvoie un message d'erreur actionnable si la publication doit être bloquée,
// ou null si tout est OK. Bloque uniquement quand une variation dégradée
// significative n'est accompagnée d'aucune action décidée par l'AM — le client
// ne doit jamais recevoir un rapport rouge sans plan.
export function publishBlocker(
  payload: PayloadSysteme,
  inputs: InputsAm,
): string | null {
  const cur = computeMissingKpis(payload.kpis_semaine);
  const prev = computeMissingKpis(payload.kpis_semaine_prec);
  const mode = payload.config_utilisee?.conversion_metric;
  const redMetrics: string[] = [];
  for (const metric of whatMetricOrder(payload)) {
    const c = cur[metric];
    const p = prev[metric];
    if (typeof c !== "number" || typeof p !== "number" || p === 0) continue;
    const delta = ((c - p) / p) * 100;
    if (toneFor(metric, delta) === "bad") redMetrics.push(metricLabel(metric, mode));
  }
  if (redMetrics.length === 0) return null;
  if (inputs.actions.length > 0) return null;
  return `Un indicateur est hors cible (${redMetrics.join(", ")}) et aucune action n'est saisie. Ajoute au moins une action ou explique le statu quo avant de publier.`;
}

// ─── Point d'entrée ─────────────────────────────────────────────────

export function buildNarrative(
  payload: PayloadSysteme,
  inputs: InputsAm,
): ReportNarrative {
  const what = buildWhat(payload);
  const so_what = buildSoWhat(payload, inputs);
  const now_what = buildNowWhat(payload, inputs, so_what);
  const creatives_review = buildCreativesReview(inputs);
  const previous_actions_review = buildPreviousActionsReview(payload, inputs);
  return { what, so_what, now_what, creatives_review, previous_actions_review };
}

// Formatteurs exposés pour le composant de rendu
export const fmt = { money, num, pct, roas, signedPct };
