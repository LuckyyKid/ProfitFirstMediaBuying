export const CONCEPT_LOG_OPERATIONAL_VERSION = "concept_log_operational_v1" as const;

export type ConceptLogEntry = {
  id: string;
  client_id: string;
  objective_id: string | null;
  concept_name: string;
  angle: string | null;
  hypothesis: string | null;
  audience: string | null;
  format: string | null;
  platform: string | null;
  offer: string | null;
  landing_page_url: string | null;
  primary_copy: string | null;
  bid_strategy: string | null;
  cost_cap: number | null;
  expected_daily_spend: number | null;
  campaign_link_url: string | null;
  ads_per_concept: number | null;
  status: string;
  launch_date: string | null;
  end_date: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
  cpa: number | null;
  ctr: number | null;
  verdict: string | null;
  learning: string | null;
  next_action: string | null;
  tags: string[] | null;
};

export type ConceptDerivedMetrics = {
  cpa: number | null;
  ctr: number | null;
  roas: number | null;
  aov: number | null;
};

export type ConceptStats = {
  winners: number;
  losers: number;
  live: number;
  tested: number;
  winRate: number;
};

export type ConceptOperationalStage =
  | "INCOMPLETE"
  | "READY_TO_BUILD"
  | "READY_TO_LAUNCH"
  | "LIVE_WITH_RESULTS";

export type ConceptOperationalReadiness = {
  concept_id: string;
  concept_name: string;
  status: string;
  stage: ConceptOperationalStage;
  readiness_score: number;
  ready_for_campaign_plan: boolean;
  missing_fields: string[];
  warnings: string[];
  expected_daily_spend: number;
  expected_period_spend: number;
  ads_planned: number;
  active_days_in_period: number;
  offer: string | null;
  landing_page_url: string | null;
  campaign_link_url: string | null;
};

export type ConceptLogOperationalInput = {
  concepts: ConceptLogEntry[];
  period_start?: string | null;
  period_end?: string | null;
  planned_monthly_spend?: number | null;
  minimum_ready_concepts?: number | null;
};

export type ConceptLogOperationalOutput = {
  engine_version: typeof CONCEPT_LOG_OPERATIONAL_VERSION;
  concepts: ConceptOperationalReadiness[];
  portfolio: {
    total_concepts: number;
    ready_concepts: number;
    live_concepts: number;
    concepts_with_results: number;
    planned_ads: number;
    expected_daily_spend: number;
    expected_period_spend: number;
    planned_monthly_spend: number | null;
    spend_coverage_rate: number | null;
    minimum_ready_concepts: number;
  };
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type MetricInput = Pick<ConceptLogEntry, "spend" | "impressions" | "clicks" | "orders" | "revenue">;

function text(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value: unknown): number {
  return Math.max(0, finite(value));
}

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseIso(value: string | null | undefined): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysInclusive(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000) + 1);
}

function activeDaysInPeriod(concept: ConceptLogEntry, input: ConceptLogOperationalInput): number {
  const periodStart = parseIso(input.period_start);
  const periodEnd = parseIso(input.period_end);
  if (!periodStart || !periodEnd) return 30;

  const launchDate = parseIso(concept.launch_date) ?? periodStart;
  const endDate = parseIso(concept.end_date) ?? periodEnd;
  const start = launchDate > periodStart ? launchDate : periodStart;
  const end = endDate < periodEnd ? endDate : periodEnd;
  return daysInclusive(start, end);
}

export function computeConceptDerivedMetrics(concept: MetricInput): ConceptDerivedMetrics {
  const spend = nonNegative(concept.spend);
  const impressions = nonNegative(concept.impressions);
  const clicks = nonNegative(concept.clicks);
  const orders = nonNegative(concept.orders);
  const revenue = nonNegative(concept.revenue);

  return {
    cpa: orders > 0 ? money(spend / orders) : null,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null,
    roas: spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : null,
    aov: orders > 0 ? money(revenue / orders) : null,
  };
}

export function computeConceptStats(concepts: ConceptLogEntry[]): ConceptStats {
  const winners = concepts.filter((concept) => concept.status === "winner" || concept.verdict === "winner").length;
  const losers = concepts.filter((concept) => concept.status === "loser" || concept.verdict === "loser").length;
  const live = concepts.filter((concept) => concept.status === "live").length;
  const tested = concepts.filter((concept) => ["winner", "loser", "live", "paused", "archived"].includes(concept.status)).length;
  const winRate = tested > 0 ? (winners / tested) * 100 : 0;
  return { winners, losers, live, tested, winRate };
}

export function evaluateConceptOperationalReadiness(
  concept: ConceptLogEntry,
  input: Pick<ConceptLogOperationalInput, "period_start" | "period_end"> = {},
): ConceptOperationalReadiness {
  const missing: string[] = [];
  const warnings: string[] = [];
  const requiredTextFields: Array<[keyof ConceptLogEntry, string]> = [
    ["concept_name", "concept_name"],
    ["offer", "offer"],
    ["landing_page_url", "landing_page_url"],
    ["primary_copy", "primary_copy"],
    ["platform", "platform"],
    ["format", "format"],
    ["audience", "audience"],
    ["hypothesis", "hypothesis"],
  ];

  requiredTextFields.forEach(([key, label]) => {
    if (!text(concept[key])) missing.push(label);
  });

  const expectedDailySpend = positive(concept.expected_daily_spend) ?? 0;
  const adsPlanned = Math.max(0, Math.floor(positive(concept.ads_per_concept) ?? 0));
  if (expectedDailySpend <= 0) missing.push("expected_daily_spend");
  if (adsPlanned <= 0) missing.push("ads_per_concept");
  if (!text(concept.bid_strategy)) warnings.push("bid_strategy is missing.");
  if (positive(concept.cost_cap) === null) warnings.push("cost_cap is missing.");
  if (concept.status === "live" && !text(concept.campaign_link_url)) {
    missing.push("campaign_link_url");
  }

  const days = activeDaysInPeriod(concept, {
    concepts: [concept],
    period_start: input.period_start,
    period_end: input.period_end,
  });
  const expectedPeriodSpend = money(expectedDailySpend * days);
  const metrics = computeConceptDerivedMetrics(concept);
  const hasResults = concept.orders > 0 || concept.revenue > 0 || metrics.roas !== null;
  const ready = missing.length === 0;
  const scoreBase = 100 - missing.length * 10 - warnings.length * 3;
  const readinessScore = Math.max(0, Math.min(100, scoreBase));
  const stage: ConceptOperationalStage = concept.status === "live" && hasResults
    ? "LIVE_WITH_RESULTS"
    : ready && ["draft", "in_review"].includes(concept.status)
      ? "READY_TO_LAUNCH"
      : text(concept.primary_copy) && text(concept.offer) && text(concept.landing_page_url)
        ? "READY_TO_BUILD"
        : "INCOMPLETE";

  return {
    concept_id: concept.id,
    concept_name: concept.concept_name,
    status: concept.status,
    stage,
    readiness_score: readinessScore,
    ready_for_campaign_plan: ready,
    missing_fields: unique(missing),
    warnings: unique(warnings),
    expected_daily_spend: money(expectedDailySpend),
    expected_period_spend: expectedPeriodSpend,
    ads_planned: adsPlanned,
    active_days_in_period: days,
    offer: text(concept.offer),
    landing_page_url: text(concept.landing_page_url),
    campaign_link_url: text(concept.campaign_link_url),
  };
}

export function runConceptLogOperationalPlan(input: ConceptLogOperationalInput): ConceptLogOperationalOutput {
  const concepts = Array.isArray(input.concepts) ? input.concepts : [];
  const plannedMonthlySpend = positive(input.planned_monthly_spend);
  const minimumReadyConcepts = Math.max(1, Math.floor(positive(input.minimum_ready_concepts) ?? 3));
  const activeConcepts = concepts.filter((concept) => !["archived", "loser"].includes(concept.status));
  const readiness = activeConcepts.map((concept) => evaluateConceptOperationalReadiness(concept, input));
  const readyConcepts = readiness.filter((concept) => concept.ready_for_campaign_plan);
  const expectedPeriodSpend = money(readiness.reduce((sum, concept) => sum + concept.expected_period_spend, 0));
  const expectedDailySpend = money(readiness.reduce((sum, concept) => sum + concept.expected_daily_spend, 0));
  const plannedAds = readiness.reduce((sum, concept) => sum + concept.ads_planned, 0);
  const spendCoverageRate = plannedMonthlySpend ? ratio(expectedPeriodSpend, plannedMonthlySpend) : null;
  const stats = computeConceptStats(concepts);
  const missingData = unique(readiness.flatMap((concept) => (
    concept.missing_fields.map((field) => `concepts.${concept.concept_id}.${field}`)
  )));
  const risks: string[] = [];
  const conditions: string[] = [];

  if (concepts.length === 0) {
    conditions.push("Add Concept Log entries before using creative execution coverage in the Profit Plan.");
  }
  if (readyConcepts.length < minimumReadyConcepts) {
    risks.push(`Only ${readyConcepts.length} launch-ready concepts; minimum is ${minimumReadyConcepts}.`);
    conditions.push("Complete offer, landing page, copy, spend, and ads-per-concept fields for more concepts.");
  }
  if (plannedMonthlySpend && expectedPeriodSpend < plannedMonthlySpend * 0.8) {
    risks.push("Concept Log expected spend covers less than 80% of planned monthly spend.");
    conditions.push("Assign expected daily spend to enough concepts to cover the media plan.");
  }
  if (readiness.some((concept) => concept.status === "live" && !concept.campaign_link_url)) {
    risks.push("At least one live concept is missing a campaign link.");
  }

  return {
    engine_version: CONCEPT_LOG_OPERATIONAL_VERSION,
    concepts: readiness,
    portfolio: {
      total_concepts: concepts.length,
      ready_concepts: readyConcepts.length,
      live_concepts: stats.live,
      concepts_with_results: concepts.filter((concept) => concept.orders > 0 || concept.revenue > 0).length,
      planned_ads: plannedAds,
      expected_daily_spend: expectedDailySpend,
      expected_period_spend: expectedPeriodSpend,
      planned_monthly_spend: plannedMonthlySpend,
      spend_coverage_rate: spendCoverageRate,
      minimum_ready_concepts: minimumReadyConcepts,
    },
    missing_data: missingData,
    risks: unique(risks),
    conditions: unique(conditions),
    summary: `Concept Log Operational v1 - ${readyConcepts.length}/${activeConcepts.length} active concepts ready - ${plannedAds} ads planned - expected spend ${expectedPeriodSpend}.`,
  };
}
