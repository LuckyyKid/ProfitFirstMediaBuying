import Decimal from "decimal.js";

export const ATTRIBUTION_TARGET_ENGINE_VERSION = "attribution_target_engine_v1" as const;

export type AttributionReportingWindow =
  | "1_DAY_CLICK"
  | "7_DAY_CLICK"
  | "28_DAY_CLICK";

export type AttributionChannelInput = {
  channel_id?: string | null;
  channel_name?: string | null;
  platform?: string | null;
  reporting_window?: AttributionReportingWindow | null;
  planned_spend?: number | null;
  business_target_amr?: number | null;
  business_target_roas?: number | null;
  business_target_cac?: number | null;
  click_1d_to_28d_ratio?: number | null;
  click_7d_to_28d_ratio?: number | null;
  delayed_attribution_multiplier?: number | null;
  includes_view_through?: boolean | null;
  view_through_revenue_share?: number | null;
};

export type AttributionTargetInput = {
  channels: AttributionChannelInput[];
  business_target_amr?: number | null;
  business_target_roas?: number | null;
  business_target_cac?: number | null;
  planned_ad_spend?: number | null;
  default_reporting_window?: AttributionReportingWindow | null;
  default_click_1d_to_28d_ratio?: number | null;
  default_click_7d_to_28d_ratio?: number | null;
  default_delayed_attribution_multiplier?: number | null;
  default_view_through_revenue_share?: number | null;
  no_view_through?: boolean | null;
};

export type AttributionChannelTarget = {
  channel_id: string | null;
  channel_name: string;
  platform: string | null;
  reporting_window: AttributionReportingWindow;
  planned_spend: number;
  business_target_amr: number | null;
  business_target_cac: number | null;
  click_window_multiplier: number;
  delayed_attribution_multiplier: number;
  view_through_exclusion_multiplier: number;
  total_attribution_multiplier: number;
  platform_target_amr: number | null;
  platform_target_roas: number | null;
  platform_target_cac: number | null;
  business_revenue_target: number | null;
  platform_revenue_target: number | null;
  business_new_customer_target: number | null;
  platform_conversion_target: number | null;
  excludes_view_through: boolean;
  missing_data: string[];
  risks: string[];
  conditions: string[];
};

export type AttributionPortfolioTarget = {
  channel_count: number;
  modeled_channel_count: number;
  weight_source: "planned_spend" | "equal_channel_weight";
  planned_ad_spend: number;
  weighted_business_target_amr: number | null;
  weighted_business_target_cac: number | null;
  weighted_click_window_multiplier: number;
  weighted_delayed_attribution_multiplier: number;
  weighted_view_through_exclusion_multiplier: number;
  weighted_total_attribution_multiplier: number;
  weighted_platform_target_amr: number | null;
  weighted_platform_target_roas: number | null;
  weighted_platform_target_cac: number | null;
  business_revenue_target: number | null;
  platform_revenue_target: number | null;
  business_new_customer_target: number | null;
  platform_conversion_target: number | null;
};

export type AttributionTargetOutput = {
  engine_version: typeof ATTRIBUTION_TARGET_ENGINE_VERSION;
  channels: AttributionChannelTarget[];
  portfolio: AttributionPortfolioTarget;
  confidence_score: number;
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type InternalChannel = {
  target: AttributionChannelTarget;
  weight_basis: number;
};

const ROUNDING = Decimal.ROUND_HALF_UP;
const DEFAULT_CLICK_1D_TO_28D_RATIO = 0.55;
const DEFAULT_CLICK_7D_TO_28D_RATIO = 0.8;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(values: unknown[]): number | null {
  for (const value of values) {
    const n = toNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function positive(values: unknown[]): number | null {
  const n = firstNumber(values);
  return n !== null && n > 0 ? n : null;
}

function nonNegative(values: unknown[], fallback = 0): number {
  const n = firstNumber(values);
  return n !== null && n >= 0 ? n : fallback;
}

function optionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rate01(values: unknown[]): number | null {
  const n = firstNumber(values);
  if (n === null || n < 0) return null;
  return clamp(n > 1 ? n / 100 : n, 0, 1);
}

function round(value: Decimal.Value, dp = 2): number {
  return new Decimal(value).toDecimalPlaces(dp, ROUNDING).toNumber();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function weightedNullable(
  rows: InternalChannel[],
  weights: number[],
  selector: (target: AttributionChannelTarget) => number | null,
): number | null {
  const values = rows.map((row) => selector(row.target));
  if (values.every((value) => value === null)) return null;
  return round(values.reduce((sum, value, index) => sum + (value ?? 0) * (weights[index] ?? 0), 0));
}

function weighted(
  rows: InternalChannel[],
  weights: number[],
  selector: (target: AttributionChannelTarget) => number,
): number {
  return round(rows.reduce((sum, row, index) => sum + selector(row.target) * (weights[index] ?? 0), 0), 4);
}

function resolveReportingWindow(
  channel: AttributionChannelInput,
  input: AttributionTargetInput,
): AttributionReportingWindow {
  return channel.reporting_window
    ?? input.default_reporting_window
    ?? "7_DAY_CLICK";
}

function resolveClickWindowMultiplier(
  channel: AttributionChannelInput,
  input: AttributionTargetInput,
  window: AttributionReportingWindow,
  prefix: string,
  missingData: string[],
  conditions: string[],
): number {
  if (window === "28_DAY_CLICK") return 1;

  if (window === "7_DAY_CLICK") {
    const explicit = rate01([channel.click_7d_to_28d_ratio, input.default_click_7d_to_28d_ratio]);
    if (explicit !== null) return explicit;
    missingData.push(`${prefix}.click_7d_to_28d_ratio`);
    conditions.push("Using default 7-day click to 28-day click ratio until channel history is configured.");
    return DEFAULT_CLICK_7D_TO_28D_RATIO;
  }

  const explicit = rate01([channel.click_1d_to_28d_ratio, input.default_click_1d_to_28d_ratio]);
  if (explicit !== null) return explicit;
  missingData.push(`${prefix}.click_1d_to_28d_ratio`);
  conditions.push("Using default 1-day click to 28-day click ratio until channel history is configured.");
  return DEFAULT_CLICK_1D_TO_28D_RATIO;
}

function buildChannelTarget(
  channel: AttributionChannelInput,
  input: AttributionTargetInput,
  index: number,
): InternalChannel {
  const prefix = `channels[${index}]`;
  const missingData: string[] = [];
  const risks: string[] = [];
  const conditions: string[] = [];
  const channelName = optionalText(channel.channel_name) ?? `Channel ${index + 1}`;
  const reportingWindow = resolveReportingWindow(channel, input);
  const plannedSpend = nonNegative([channel.planned_spend]);
  const businessTargetAmr = positive([
    channel.business_target_amr,
    channel.business_target_roas,
    input.business_target_amr,
    input.business_target_roas,
  ]);
  const businessTargetCac = positive([
    channel.business_target_cac,
    input.business_target_cac,
  ]);

  if (!optionalText(channel.channel_name)) missingData.push(`${prefix}.channel_name`);
  if (plannedSpend <= 0) missingData.push(`${prefix}.planned_spend`);
  if (businessTargetAmr === null) missingData.push(`${prefix}.business_target_amr_or_roas`);
  if (businessTargetCac === null) missingData.push(`${prefix}.business_target_cac`);

  const clickWindowMultiplier = resolveClickWindowMultiplier(
    channel,
    input,
    reportingWindow,
    prefix,
    missingData,
    conditions,
  );
  const delayedMultiplier = rate01([
    channel.delayed_attribution_multiplier,
    input.default_delayed_attribution_multiplier,
  ]) ?? 1;
  if (channel.delayed_attribution_multiplier === undefined && input.default_delayed_attribution_multiplier === undefined) {
    conditions.push("Delayed attribution multiplier defaults to 1.0 until settled attribution history is configured.");
  }

  const noViewThrough = input.no_view_through !== false;
  const includesViewThrough = channel.includes_view_through === true;
  const viewThroughShare = rate01([
    channel.view_through_revenue_share,
    input.default_view_through_revenue_share,
  ]);
  let viewThroughExclusionMultiplier = 1;
  if (noViewThrough && includesViewThrough) {
    if (viewThroughShare === null) {
      missingData.push(`${prefix}.view_through_revenue_share`);
      risks.push(`${channelName}: platform reporting includes view-through, but no view-through share is configured.`);
    } else {
      viewThroughExclusionMultiplier = round(1 - viewThroughShare, 4);
      conditions.push(`${channelName}: view-through revenue excluded from platform targets.`);
    }
  }

  const totalMultiplier = round(
    new Decimal(clickWindowMultiplier)
      .times(delayedMultiplier)
      .times(viewThroughExclusionMultiplier),
    4,
  );
  const platformTargetAmr = businessTargetAmr !== null
    ? round(businessTargetAmr * totalMultiplier)
    : null;
  const platformTargetCac = businessTargetCac !== null && totalMultiplier > 0
    ? round(businessTargetCac / totalMultiplier)
    : null;
  const businessRevenueTarget = businessTargetAmr !== null && plannedSpend > 0
    ? round(plannedSpend * businessTargetAmr)
    : null;
  const platformRevenueTarget = platformTargetAmr !== null && plannedSpend > 0
    ? round(plannedSpend * platformTargetAmr)
    : null;
  const businessNewCustomerTarget = businessTargetCac !== null && plannedSpend > 0
    ? round(plannedSpend / businessTargetCac, 2)
    : null;
  const platformConversionTarget = businessNewCustomerTarget !== null
    ? round(businessNewCustomerTarget * totalMultiplier, 2)
    : null;

  if (totalMultiplier <= 0) risks.push(`${channelName}: attribution multiplier is zero, platform targets are unusable.`);
  if (reportingWindow === "28_DAY_CLICK" && delayedMultiplier < 1) {
    conditions.push(`${channelName}: in-flight 28-day click reporting is discounted for delayed attribution.`);
  }
  if (businessTargetAmr !== null && platformTargetAmr !== null && platformTargetAmr > businessTargetAmr) {
    risks.push(`${channelName}: platform target AMR is above business target; review attribution multipliers.`);
  }

  return {
    target: {
      channel_id: optionalText(channel.channel_id),
      channel_name: channelName,
      platform: optionalText(channel.platform),
      reporting_window: reportingWindow,
      planned_spend: round(plannedSpend),
      business_target_amr: businessTargetAmr !== null ? round(businessTargetAmr) : null,
      business_target_cac: businessTargetCac !== null ? round(businessTargetCac) : null,
      click_window_multiplier: round(clickWindowMultiplier, 4),
      delayed_attribution_multiplier: round(delayedMultiplier, 4),
      view_through_exclusion_multiplier: round(viewThroughExclusionMultiplier, 4),
      total_attribution_multiplier: totalMultiplier,
      platform_target_amr: platformTargetAmr,
      platform_target_roas: platformTargetAmr,
      platform_target_cac: platformTargetCac,
      business_revenue_target: businessRevenueTarget,
      platform_revenue_target: platformRevenueTarget,
      business_new_customer_target: businessNewCustomerTarget,
      platform_conversion_target: platformConversionTarget,
      excludes_view_through: noViewThrough,
      missing_data: unique(missingData),
      risks: unique(risks),
      conditions: unique(conditions),
    },
    weight_basis: plannedSpend,
  };
}

function resolveWeights(rows: InternalChannel[]): {
  source: AttributionPortfolioTarget["weight_source"];
  weights: number[];
} {
  const totalSpend = rows.reduce((sum, row) => sum + row.weight_basis, 0);
  if (totalSpend > 0) {
    return {
      source: "planned_spend",
      weights: rows.map((row) => row.weight_basis / totalSpend),
    };
  }

  const equalWeight = rows.length > 0 ? 1 / rows.length : 0;
  return {
    source: "equal_channel_weight",
    weights: rows.map(() => equalWeight),
  };
}

function sumNullable(
  rows: InternalChannel[],
  selector: (target: AttributionChannelTarget) => number | null,
): number | null {
  const values = rows.map((row) => selector(row.target));
  if (values.every((value) => value === null)) return null;
  return round(values.reduce((sum, value) => sum + (value ?? 0), 0));
}

function emptyOutput(plannedAdSpend: number): AttributionTargetOutput {
  return {
    engine_version: ATTRIBUTION_TARGET_ENGINE_VERSION,
    channels: [],
    portfolio: {
      channel_count: 0,
      modeled_channel_count: 0,
      weight_source: "equal_channel_weight",
      planned_ad_spend: round(plannedAdSpend),
      weighted_business_target_amr: null,
      weighted_business_target_cac: null,
      weighted_click_window_multiplier: 0,
      weighted_delayed_attribution_multiplier: 0,
      weighted_view_through_exclusion_multiplier: 0,
      weighted_total_attribution_multiplier: 0,
      weighted_platform_target_amr: null,
      weighted_platform_target_roas: null,
      weighted_platform_target_cac: null,
      business_revenue_target: null,
      platform_revenue_target: null,
      business_new_customer_target: null,
      platform_conversion_target: null,
    },
    confidence_score: 0,
    missing_data: ["channels"],
    risks: [],
    conditions: ["Add at least one paid channel to translate business targets into attribution-window targets."],
    summary: "Attribution Target v1 - no channels provided.",
  };
}

export function runAttributionTargetEngine(input: AttributionTargetInput): AttributionTargetOutput {
  const channels = Array.isArray(input.channels) ? input.channels : [];
  const plannedAdSpend = nonNegative([input.planned_ad_spend]);
  if (channels.length === 0) return emptyOutput(plannedAdSpend);

  const rows = channels.map((channel, index) => buildChannelTarget(channel, input, index));
  const { source: weightSource, weights } = resolveWeights(rows);
  const channelTargets = rows.map((row) => row.target);
  const missingData = unique(channelTargets.flatMap((channel) => channel.missing_data));
  const risks = unique(channelTargets.flatMap((channel) => channel.risks));
  const conditions = unique(channelTargets.flatMap((channel) => channel.conditions));
  const confidence = round(clamp(92 - missingData.length * 6 - risks.length * 5, 0, 100), 0);
  const portfolioPlatformAmr = weightedNullable(rows, weights, (channel) => channel.platform_target_amr);
  const portfolioPlatformCac = weightedNullable(rows, weights, (channel) => channel.platform_target_cac);
  const summary = `Attribution Target v1 - ${channels.length} channels - platform AMR ${portfolioPlatformAmr ?? "n/a"} - platform CAC ${portfolioPlatformCac ?? "n/a"} - confidence ${confidence}/100.`;

  return {
    engine_version: ATTRIBUTION_TARGET_ENGINE_VERSION,
    channels: channelTargets,
    portfolio: {
      channel_count: channels.length,
      modeled_channel_count: channelTargets.filter((channel) => channel.platform_target_amr !== null || channel.platform_target_cac !== null).length,
      weight_source: weightSource,
      planned_ad_spend: round(plannedAdSpend),
      weighted_business_target_amr: weightedNullable(rows, weights, (channel) => channel.business_target_amr),
      weighted_business_target_cac: weightedNullable(rows, weights, (channel) => channel.business_target_cac),
      weighted_click_window_multiplier: weighted(rows, weights, (channel) => channel.click_window_multiplier),
      weighted_delayed_attribution_multiplier: weighted(rows, weights, (channel) => channel.delayed_attribution_multiplier),
      weighted_view_through_exclusion_multiplier: weighted(rows, weights, (channel) => channel.view_through_exclusion_multiplier),
      weighted_total_attribution_multiplier: weighted(rows, weights, (channel) => channel.total_attribution_multiplier),
      weighted_platform_target_amr: portfolioPlatformAmr,
      weighted_platform_target_roas: portfolioPlatformAmr,
      weighted_platform_target_cac: portfolioPlatformCac,
      business_revenue_target: sumNullable(rows, (channel) => channel.business_revenue_target),
      platform_revenue_target: sumNullable(rows, (channel) => channel.platform_revenue_target),
      business_new_customer_target: sumNullable(rows, (channel) => channel.business_new_customer_target),
      platform_conversion_target: sumNullable(rows, (channel) => channel.platform_conversion_target),
    },
    confidence_score: confidence,
    missing_data: missingData,
    risks,
    conditions,
    summary,
  };
}
