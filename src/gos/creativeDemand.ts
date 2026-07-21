export type CreativeMix = {
  static: number;
  video: number;
  ugc: number;
};

export type CreativeDemandInput = {
  weekly_spend: number | null | undefined;
  avg_cpm: number | null | undefined;
  fatigue_threshold_impressions: number | null | undefined;
  minimum_creatives?: number | null;
  mix?: Partial<CreativeMix> | null;
};

export type CreativeDemandOutput = {
  engine_version: "creative_demand_v1";
  impressions_per_week: number;
  creatives_per_week_needed: number;
  static_creatives_needed: number;
  video_creatives_needed: number;
  ugc_creatives_needed: number;
  fatigue_load_pct: number;
  confidence: number;
  breakdown: {
    impressions_per_week: number;
    mix: CreativeMix;
  };
  formula_used: string;
  assumptions: {
    minimum_creatives: number;
    source: "manual";
  };
  missing_data: string[];
  risks: string[];
};

const DEFAULT_MIX: CreativeMix = {
  static: 0.5,
  video: 0.35,
  ugc: 0.15,
};

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finite(value, fallback));
}

function normalizeMix(mix: Partial<CreativeMix> | null | undefined): CreativeMix {
  const raw = {
    static: nonNegative(mix?.static, DEFAULT_MIX.static),
    video: nonNegative(mix?.video, DEFAULT_MIX.video),
    ugc: nonNegative(mix?.ugc, DEFAULT_MIX.ugc),
  };
  const total = raw.static + raw.video + raw.ugc;
  if (total <= 0) return DEFAULT_MIX;
  return {
    static: raw.static / total,
    video: raw.video / total,
    ugc: raw.ugc / total,
  };
}

function allocateCreativeMix(total: number, mix: CreativeMix) {
  const staticCreatives = Math.round(total * mix.static);
  const videoCreatives = Math.round(total * mix.video);
  const ugcCreatives = Math.max(0, total - staticCreatives - videoCreatives);
  return {
    static_creatives_needed: staticCreatives,
    video_creatives_needed: videoCreatives,
    ugc_creatives_needed: ugcCreatives,
  };
}

export function runCreativeDemand(input: CreativeDemandInput): CreativeDemandOutput {
  const weeklySpend = nonNegative(input.weekly_spend);
  const avgCpm = nonNegative(input.avg_cpm);
  const fatigueThreshold = nonNegative(input.fatigue_threshold_impressions);
  const minimumCreatives = Math.max(1, Math.round(nonNegative(input.minimum_creatives, 3) || 3));
  const mix = normalizeMix(input.mix);
  const missingData: string[] = [];
  const risks: string[] = [];

  if (weeklySpend <= 0) missingData.push("weekly_spend");
  if (avgCpm <= 0) missingData.push("avg_cpm");
  if (fatigueThreshold <= 0) missingData.push("fatigue_threshold_impressions");

  const impressions = avgCpm > 0 ? (weeklySpend / avgCpm) * 1000 : 0;
  const demandCreatives = fatigueThreshold > 0
    ? Math.ceil(impressions / fatigueThreshold)
    : 0;
  const creativesPerWeek = Math.max(minimumCreatives, demandCreatives);
  const allocation = allocateCreativeMix(creativesPerWeek, mix);
  const fatigueLoad = fatigueThreshold > 0
    ? Math.min(1, impressions / (fatigueThreshold * Math.max(1, creativesPerWeek)))
    : 0;

  if (fatigueLoad >= 0.7) risks.push("HIGH_FATIGUE_LOAD");
  if (creativesPerWeek === minimumCreatives && impressions > 0) risks.push("MINIMUM_CREATIVE_FLOOR_APPLIED");

  return {
    engine_version: "creative_demand_v1",
    impressions_per_week: Math.round(impressions),
    creatives_per_week_needed: creativesPerWeek,
    ...allocation,
    fatigue_load_pct: Math.round(fatigueLoad * 100),
    confidence: missingData.length ? 0.35 : 0.6,
    breakdown: {
      impressions_per_week: Math.round(impressions),
      mix: {
        static: Number(mix.static.toFixed(4)),
        video: Number(mix.video.toFixed(4)),
        ugc: Number(mix.ugc.toFixed(4)),
      },
    },
    formula_used: "creatives = max(minimum_creatives, ceil((weekly_spend / avg_cpm * 1000) / fatigue_threshold_impressions)); mix static/video/ugc",
    assumptions: {
      minimum_creatives: minimumCreatives,
      source: "manual",
    },
    missing_data: missingData,
    risks,
  };
}
