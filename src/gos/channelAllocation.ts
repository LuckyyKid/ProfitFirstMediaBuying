export const CHANNEL_ALLOCATION_ENGINE_VERSION = "channel_allocation_v1" as const;

export type ChannelAllocationChannelInput = {
  channel_id?: string | null;
  channel_name?: string | null;
  platform?: string | null;
  planned_spend?: number | null;
  allocation_weight?: number | null;
  expected_amr?: number | null;
  expected_roas?: number | null;
  business_target_amr?: number | null;
  business_target_roas?: number | null;
  business_target_cac?: number | null;
  incrementality_factor?: number | null;
  min_spend?: number | null;
  max_spend?: number | null;
};

export type ChannelAllocationInput = {
  planned_ad_spend: number;
  business_target_amr?: number | null;
  business_target_roas?: number | null;
  business_target_cac?: number | null;
  default_incrementality_factor?: number | null;
  max_channel_spend_share?: number | null;
  channels: ChannelAllocationChannelInput[];
};

export type ChannelAllocationMethod =
  | "planned_spend"
  | "allocation_weight"
  | "incremental_efficiency"
  | "equal_weight";

export type ChannelAllocationChannel = {
  channel_id: string | null;
  channel_name: string;
  platform: string | null;
  allocation_method: ChannelAllocationMethod;
  allocation_basis: number;
  allocated_spend: number;
  spend_share: number;
  business_target_amr: number | null;
  business_target_cac: number | null;
  incrementality_factor: number;
  incremental_target_amr: number | null;
  required_platform_amr: number | null;
  required_platform_cac: number | null;
  incremental_revenue_target: number | null;
  platform_revenue_required: number | null;
  incremental_new_customer_target: number | null;
  platform_conversion_required: number | null;
  missing_data: string[];
  risks: string[];
  conditions: string[];
};

export type ChannelAllocationPortfolio = {
  channel_count: number;
  allocation_method: ChannelAllocationMethod;
  planned_ad_spend: number;
  allocated_spend: number;
  weighted_incrementality_factor: number;
  weighted_incremental_target_amr: number | null;
  weighted_required_platform_amr: number | null;
  weighted_required_platform_cac: number | null;
  incremental_revenue_target: number | null;
  platform_revenue_required: number | null;
  incremental_new_customer_target: number | null;
  platform_conversion_required: number | null;
};

export type ChannelAllocationOutput = {
  engine_version: typeof CHANNEL_ALLOCATION_ENGINE_VERSION;
  channels: ChannelAllocationChannel[];
  portfolio: ChannelAllocationPortfolio;
  assumptions: {
    formula: string;
    allocation_method: ChannelAllocationMethod;
    max_channel_spend_share: number;
  };
  confidence_score: number;
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type DraftChannel = {
  input: ChannelAllocationChannelInput;
  channel_id: string | null;
  channel_name: string;
  platform: string | null;
  business_target_amr: number | null;
  business_target_cac: number | null;
  incrementality_factor: number;
  basis: number;
  missing_data: string[];
  risks: string[];
  conditions: string[];
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n > 0 ? n : null;
}

function nonNegative(value: unknown, fallback = 0): number {
  const n = toNumber(value);
  return n !== null && n >= 0 ? n : fallback;
}

function text(value: unknown): string | null {
  const valueText = String(value ?? "").trim();
  return valueText ? valueText : null;
}

function round(value: number, dp = 2): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(dp));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function rate01(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null || n < 0) return null;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function resolveMethod(channels: ChannelAllocationChannelInput[]): ChannelAllocationMethod {
  if (channels.some((channel) => positive(channel.planned_spend) !== null)) return "planned_spend";
  if (channels.some((channel) => positive(channel.allocation_weight) !== null)) return "allocation_weight";
  if (channels.some((channel) => positive(channel.expected_amr ?? channel.expected_roas) !== null)) {
    return "incremental_efficiency";
  }
  return "equal_weight";
}

function resolveTargetAmr(
  channel: ChannelAllocationChannelInput,
  input: ChannelAllocationInput,
): number | null {
  return positive(channel.business_target_amr)
    ?? positive(channel.business_target_roas)
    ?? positive(channel.expected_amr)
    ?? positive(channel.expected_roas)
    ?? positive(input.business_target_amr)
    ?? positive(input.business_target_roas);
}

function resolveBusinessTargetCac(
  channel: ChannelAllocationChannelInput,
  input: ChannelAllocationInput,
): number | null {
  return positive(channel.business_target_cac) ?? positive(input.business_target_cac);
}

function resolveIncrementality(
  channel: ChannelAllocationChannelInput,
  input: ChannelAllocationInput,
  prefix: string,
  missingData: string[],
  conditions: string[],
): number {
  const explicit = rate01(channel.incrementality_factor);
  if (explicit !== null) return explicit;

  const fallback = rate01(input.default_incrementality_factor);
  if (fallback !== null) {
    missingData.push(`${prefix}.incrementality_factor`);
    conditions.push(`${prefix}: default incrementality factor used until channel-specific incrementality is configured.`);
    return fallback;
  }

  missingData.push(`${prefix}.incrementality_factor`);
  conditions.push(`${prefix}: incrementality defaults to 1.0 until MMM or lift-test evidence exists.`);
  return 1;
}

function buildBasis(
  method: ChannelAllocationMethod,
  channel: ChannelAllocationChannelInput,
  targetAmr: number | null,
  incrementalityFactor: number,
): number {
  if (method === "planned_spend") return nonNegative(channel.planned_spend);
  if (method === "allocation_weight") return positive(channel.allocation_weight) ?? 0;
  if (method === "incremental_efficiency") {
    const expectedAmr = positive(channel.expected_amr) ?? positive(channel.expected_roas) ?? targetAmr ?? 0;
    return Math.max(0, expectedAmr * incrementalityFactor);
  }
  return 1;
}

function buildDrafts(input: ChannelAllocationInput, method: ChannelAllocationMethod): DraftChannel[] {
  return input.channels.map((channel, index) => {
    const prefix = `channels[${index}]`;
    const missingData: string[] = [];
    const risks: string[] = [];
    const conditions: string[] = [];
    const channelName = text(channel.channel_name) ?? `Channel ${index + 1}`;
    const targetAmr = resolveTargetAmr(channel, input);
    const targetCac = resolveBusinessTargetCac(channel, input);

    if (!text(channel.channel_name)) missingData.push(`${prefix}.channel_name`);
    if (targetAmr === null) missingData.push(`${prefix}.business_target_amr_or_roas`);
    if (targetCac === null) missingData.push(`${prefix}.business_target_cac`);

    const incrementalityFactor = resolveIncrementality(channel, input, prefix, missingData, conditions);
    if (incrementalityFactor <= 0) {
      risks.push(`${channelName}: incrementality factor is zero, so no incremental revenue can be credited.`);
    }
    if (incrementalityFactor < 0.5) {
      risks.push(`${channelName}: incrementality factor is below 0.50; keep spend constrained until lift-test evidence improves.`);
    }

    return {
      input: channel,
      channel_id: text(channel.channel_id),
      channel_name: channelName,
      platform: text(channel.platform),
      business_target_amr: targetAmr,
      business_target_cac: targetCac,
      incrementality_factor: incrementalityFactor,
      basis: buildBasis(method, channel, targetAmr, incrementalityFactor),
      missing_data: missingData,
      risks,
      conditions,
    };
  });
}

function allocateSpend(totalSpend: number, drafts: DraftChannel[]): number[] {
  const basisTotal = drafts.reduce((sum, draft) => sum + draft.basis, 0);
  const safeBasisTotal = basisTotal > 0 ? basisTotal : drafts.length || 1;
  const raw = drafts.map((draft) => totalSpend * ((basisTotal > 0 ? draft.basis : 1) / safeBasisTotal));
  const rounded = raw.map((value) => round(value));
  const diff = round(totalSpend - rounded.reduce((sum, value) => sum + value, 0));
  if (rounded.length > 0) rounded[rounded.length - 1] = round(rounded[rounded.length - 1] + diff);
  return rounded;
}

function applySpendBounds(totalSpend: number, drafts: DraftChannel[], allocated: number[]): number[] {
  const bounded = allocated.map((spend, index) => {
    const minSpend = positive(drafts[index].input.min_spend) ?? 0;
    const maxSpend = positive(drafts[index].input.max_spend) ?? Number.POSITIVE_INFINITY;
    return Math.max(minSpend, Math.min(maxSpend, spend));
  });
  const boundedTotal = bounded.reduce((sum, value) => sum + value, 0);
  if (bounded.length === 0 || boundedTotal <= 0) return bounded;
  const scaled = bounded.map((value) => round(value * (totalSpend / boundedTotal)));
  const diff = round(totalSpend - scaled.reduce((sum, value) => sum + value, 0));
  scaled[scaled.length - 1] = round(scaled[scaled.length - 1] + diff);
  return scaled;
}

function buildChannel(
  draft: DraftChannel,
  method: ChannelAllocationMethod,
  allocatedSpend: number,
  totalSpend: number,
  maxChannelSpendShare: number,
): ChannelAllocationChannel {
  const spendShare = totalSpend > 0 ? allocatedSpend / totalSpend : 0;
  const incrementalTargetAmr = draft.business_target_amr !== null
    ? round(draft.business_target_amr * draft.incrementality_factor)
    : null;
  const requiredPlatformAmr = draft.business_target_amr !== null && draft.incrementality_factor > 0
    ? round(draft.business_target_amr / draft.incrementality_factor)
    : null;
  const requiredPlatformCac = draft.business_target_cac !== null
    ? round(draft.business_target_cac * draft.incrementality_factor)
    : null;
  const incrementalRevenueTarget = incrementalTargetAmr !== null
    ? round(allocatedSpend * incrementalTargetAmr)
    : null;
  const platformRevenueRequired = requiredPlatformAmr !== null
    ? round(allocatedSpend * requiredPlatformAmr)
    : null;
  const incrementalNewCustomerTarget = draft.business_target_cac !== null && draft.business_target_cac > 0
    ? round(allocatedSpend / draft.business_target_cac, 2)
    : null;
  const platformConversionRequired = requiredPlatformCac !== null && requiredPlatformCac > 0
    ? round(allocatedSpend / requiredPlatformCac, 2)
    : null;
  const risks = [...draft.risks];

  if (spendShare > maxChannelSpendShare) {
    risks.push(`${draft.channel_name}: allocated spend share exceeds max channel concentration threshold.`);
  }

  return {
    channel_id: draft.channel_id,
    channel_name: draft.channel_name,
    platform: draft.platform,
    allocation_method: method,
    allocation_basis: round(draft.basis, 4),
    allocated_spend: allocatedSpend,
    spend_share: round(spendShare, 4),
    business_target_amr: draft.business_target_amr !== null ? round(draft.business_target_amr) : null,
    business_target_cac: draft.business_target_cac !== null ? round(draft.business_target_cac) : null,
    incrementality_factor: round(draft.incrementality_factor, 4),
    incremental_target_amr: incrementalTargetAmr,
    required_platform_amr: requiredPlatformAmr,
    required_platform_cac: requiredPlatformCac,
    incremental_revenue_target: incrementalRevenueTarget,
    platform_revenue_required: platformRevenueRequired,
    incremental_new_customer_target: incrementalNewCustomerTarget,
    platform_conversion_required: platformConversionRequired,
    missing_data: unique(draft.missing_data),
    risks: unique(risks),
    conditions: unique(draft.conditions),
  };
}

function sumNullable<T>(rows: T[], selector: (row: T) => number | null): number | null {
  const values = rows.map(selector);
  if (values.every((value) => value === null)) return null;
  return round(values.reduce((sum, value) => sum + (value ?? 0), 0));
}

function weightedNullable(rows: ChannelAllocationChannel[], selector: (row: ChannelAllocationChannel) => number | null): number | null {
  const values = rows.map(selector);
  if (values.every((value) => value === null)) return null;
  return round(rows.reduce((sum, row, index) => sum + (values[index] ?? 0) * row.spend_share, 0));
}

function emptyOutput(plannedAdSpend: number, maxChannelSpendShare: number): ChannelAllocationOutput {
  return {
    engine_version: CHANNEL_ALLOCATION_ENGINE_VERSION,
    channels: [],
    portfolio: {
      channel_count: 0,
      allocation_method: "equal_weight",
      planned_ad_spend: round(plannedAdSpend),
      allocated_spend: 0,
      weighted_incrementality_factor: 0,
      weighted_incremental_target_amr: null,
      weighted_required_platform_amr: null,
      weighted_required_platform_cac: null,
      incremental_revenue_target: null,
      platform_revenue_required: null,
      incremental_new_customer_target: null,
      platform_conversion_required: null,
    },
    assumptions: {
      formula: "allocated_spend by channel; incremental_target_amr = business_target_amr * incrementality_factor; required_platform_amr = business_target_amr / incrementality_factor",
      allocation_method: "equal_weight",
      max_channel_spend_share: maxChannelSpendShare,
    },
    confidence_score: 0,
    missing_data: ["channels"],
    risks: [],
    conditions: ["Add paid channel allocation inputs before building a channel-level Profit Plan."],
    summary: "Channel Allocation v1 - no channels configured.",
  };
}

export function runChannelAllocation(input: ChannelAllocationInput): ChannelAllocationOutput {
  const plannedAdSpend = nonNegative(input.planned_ad_spend);
  const channels = Array.isArray(input.channels) ? input.channels : [];
  const maxChannelSpendShare = rate01(input.max_channel_spend_share) ?? 0.7;
  if (channels.length === 0) return emptyOutput(plannedAdSpend, maxChannelSpendShare);

  const method = resolveMethod(channels);
  const drafts = buildDrafts(input, method);
  const boundedSpend = applySpendBounds(plannedAdSpend, drafts, allocateSpend(plannedAdSpend, drafts));
  const channelOutputs = drafts.map((draft, index) => buildChannel(
    draft,
    method,
    boundedSpend[index] ?? 0,
    plannedAdSpend,
    maxChannelSpendShare,
  ));
  const missingData = unique(channelOutputs.flatMap((channel) => channel.missing_data));
  const risks = unique(channelOutputs.flatMap((channel) => channel.risks));
  const conditions = unique([
    ...channelOutputs.flatMap((channel) => channel.conditions),
    "Replace manual incrementality factors with MMM or lift-test outputs when enough data exists.",
  ]);
  const confidence = round(Math.max(0, Math.min(100, 92 - missingData.length * 5 - risks.length * 7)), 0);
  const allocatedSpend = round(channelOutputs.reduce((sum, channel) => sum + channel.allocated_spend, 0));
  const weightedIncrementality = round(
    channelOutputs.reduce((sum, channel) => sum + channel.incrementality_factor * channel.spend_share, 0),
    4,
  );
  const summary = `Channel Allocation v1 - ${channels.length} channels - spend ${allocatedSpend} - weighted incrementality ${weightedIncrementality} - confidence ${confidence}/100.`;

  return {
    engine_version: CHANNEL_ALLOCATION_ENGINE_VERSION,
    channels: channelOutputs,
    portfolio: {
      channel_count: channelOutputs.length,
      allocation_method: method,
      planned_ad_spend: round(plannedAdSpend),
      allocated_spend: allocatedSpend,
      weighted_incrementality_factor: weightedIncrementality,
      weighted_incremental_target_amr: weightedNullable(channelOutputs, (channel) => channel.incremental_target_amr),
      weighted_required_platform_amr: weightedNullable(channelOutputs, (channel) => channel.required_platform_amr),
      weighted_required_platform_cac: weightedNullable(channelOutputs, (channel) => channel.required_platform_cac),
      incremental_revenue_target: sumNullable(channelOutputs, (channel) => channel.incremental_revenue_target),
      platform_revenue_required: sumNullable(channelOutputs, (channel) => channel.platform_revenue_required),
      incremental_new_customer_target: sumNullable(channelOutputs, (channel) => channel.incremental_new_customer_target),
      platform_conversion_required: sumNullable(channelOutputs, (channel) => channel.platform_conversion_required),
    },
    assumptions: {
      formula: "allocated_spend by channel; incremental_target_amr = business_target_amr * incrementality_factor; required_platform_amr = business_target_amr / incrementality_factor",
      allocation_method: method,
      max_channel_spend_share: maxChannelSpendShare,
    },
    confidence_score: confidence,
    missing_data: missingData,
    risks,
    conditions,
    summary,
  };
}
