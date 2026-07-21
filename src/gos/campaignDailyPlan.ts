import type { ChannelAllocationChannel, ChannelAllocationOutput } from "./channelAllocation";

export const CAMPAIGN_DAILY_PLAN_ENGINE_VERSION = "campaign_daily_plan_v1" as const;

export type CampaignDailyPlanDayInput = {
  plan_date: string;
  day_index?: number | null;
  pacing_weight?: number | null;
  target_ad_spend: number;
};

export type CampaignDailyPlanCampaignInput = {
  campaign_id?: string | null;
  campaign_name?: string | null;
  platform?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  active?: boolean | null;
  current_daily_budget?: number | null;
  planned_spend?: number | null;
  allocation_weight?: number | null;
  external_id?: string | null;
};

export type CampaignDailyPlanInput = {
  days: CampaignDailyPlanDayInput[];
  channel_allocation: ChannelAllocationOutput | null;
  campaigns?: CampaignDailyPlanCampaignInput[] | null;
  include_inactive?: boolean | null;
};

export type CampaignAllocationMethod =
  | "planned_spend"
  | "allocation_weight"
  | "current_daily_budget"
  | "equal_weight"
  | "unassigned_channel_placeholder";

export type CampaignDailyPlanCampaignSummary = {
  campaign_id: string | null;
  campaign_name: string;
  platform: string | null;
  channel_id: string | null;
  channel_name: string;
  allocation_method: CampaignAllocationMethod;
  allocation_basis: number;
  monthly_target_spend: number;
  monthly_platform_revenue_required: number | null;
  monthly_incremental_revenue_target: number | null;
  monthly_platform_conversions_required: number | null;
  required_platform_amr: number | null;
  required_platform_cac: number | null;
  incremental_target_amr: number | null;
  active: boolean;
  missing_data: string[];
  risks: string[];
  conditions: string[];
};

export type CampaignDailyPlanRow = {
  campaign_id: string | null;
  campaign_name: string;
  platform: string | null;
  channel_id: string | null;
  channel_name: string;
  plan_date: string;
  day_index: number;
  pacing_weight: number;
  target_spend: number;
  platform_revenue_required: number | null;
  incremental_revenue_target: number | null;
  platform_conversions_required: number | null;
  required_platform_amr: number | null;
  required_platform_cac: number | null;
  incremental_target_amr: number | null;
  status: "PLANNED";
};

export type CampaignDailyPlanChannelSummary = {
  channel_id: string | null;
  channel_name: string;
  platform: string | null;
  campaign_count: number;
  allocated_spend: number;
  planned_spend: number;
  platform_revenue_required: number | null;
  incremental_revenue_target: number | null;
  platform_conversions_required: number | null;
};

export type CampaignDailyPlanPortfolio = {
  campaign_count: number;
  day_count: number;
  row_count: number;
  planned_ad_spend: number;
  allocated_campaign_spend: number;
  platform_revenue_required: number | null;
  incremental_revenue_target: number | null;
  platform_conversions_required: number | null;
};

export type CampaignDailyPlanOutput = {
  engine_version: typeof CAMPAIGN_DAILY_PLAN_ENGINE_VERSION;
  campaigns: CampaignDailyPlanCampaignSummary[];
  days: CampaignDailyPlanRow[];
  channels: CampaignDailyPlanChannelSummary[];
  portfolio: CampaignDailyPlanPortfolio;
  assumptions: {
    formula: string;
    inactive_campaigns_included: boolean;
    unassigned_channel_policy: string;
  };
  missing_data: string[];
  risks: string[];
  conditions: string[];
  summary: string;
};

type CampaignDraft = {
  input: CampaignDailyPlanCampaignInput;
  campaign_id: string | null;
  campaign_name: string;
  platform: string | null;
  active: boolean;
  allocation_method: CampaignAllocationMethod;
  allocation_basis: number;
  missing_data: string[];
  risks: string[];
  conditions: string[];
};

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(value: unknown, fallback = 0): number {
  const n = finite(value);
  return n !== null && n >= 0 ? n : fallback;
}

function positive(value: unknown): number | null {
  const n = finite(value);
  return n !== null && n > 0 ? n : null;
}

function text(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function key(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function rounded(value: number, dp = 2): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(dp));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sumNullable<T>(rows: T[], selector: (row: T) => number | null): number | null {
  const values = rows.map(selector);
  if (values.every((value) => value === null)) return null;
  return money(values.reduce((sum, value) => sum + (value ?? 0), 0));
}

function parseDate(value: unknown): string | null {
  const date = text(value)?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}

function splitMoney(total: number, weights: number[]): number[] {
  const target = money(total);
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const rows = weights.map((weight) => money(target * (weight / sum)));
  const diff = money(target - rows.reduce((acc, value) => acc + value, 0));
  if (rows.length > 0) rows[rows.length - 1] = money(rows[rows.length - 1] + diff);
  return rows;
}

function splitNumber(total: number | null, weights: number[]): (number | null)[] {
  if (total === null) return weights.map(() => null);
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const rows = weights.map((weight) => rounded(total * (weight / sum), 2));
  const diff = rounded(total - rows.reduce((acc, value) => acc + value, 0), 2);
  if (rows.length > 0) rows[rows.length - 1] = rounded(rows[rows.length - 1] + diff, 2);
  return rows;
}

function dailyWeights(days: CampaignDailyPlanDayInput[]): number[] {
  const spendTotal = days.reduce((sum, day) => sum + nonNegative(day.target_ad_spend), 0);
  if (spendTotal > 0) return days.map((day) => nonNegative(day.target_ad_spend));

  const pacingTotal = days.reduce((sum, day) => sum + nonNegative(day.pacing_weight), 0);
  if (pacingTotal > 0) return days.map((day) => nonNegative(day.pacing_weight));

  return days.map(() => 1);
}

function campaignMatchesChannel(
  campaign: CampaignDailyPlanCampaignInput,
  channel: ChannelAllocationChannel,
): boolean {
  const campaignChannelId = key(campaign.channel_id);
  const channelId = key(channel.channel_id);
  if (campaignChannelId && channelId) return campaignChannelId === channelId;

  const campaignChannelName = key(campaign.channel_name);
  const channelName = key(channel.channel_name);
  if (campaignChannelName && channelName) return campaignChannelName === channelName;

  const campaignPlatform = key(campaign.platform);
  const channelPlatform = key(channel.platform);
  return Boolean(campaignPlatform && channelPlatform && campaignPlatform === channelPlatform);
}

function resolveCampaignBasis(campaign: CampaignDailyPlanCampaignInput): {
  method: CampaignAllocationMethod;
  basis: number;
} {
  const plannedSpend = positive(campaign.planned_spend);
  if (plannedSpend !== null) return { method: "planned_spend", basis: plannedSpend };

  const allocationWeight = positive(campaign.allocation_weight);
  if (allocationWeight !== null) return { method: "allocation_weight", basis: allocationWeight };

  const currentDailyBudget = positive(campaign.current_daily_budget);
  if (currentDailyBudget !== null) return { method: "current_daily_budget", basis: currentDailyBudget };

  return { method: "equal_weight", basis: 1 };
}

function buildCampaignDraft(
  campaign: CampaignDailyPlanCampaignInput,
  index: number,
): CampaignDraft {
  const missingData: string[] = [];
  const { method, basis } = resolveCampaignBasis(campaign);
  const campaignName = text(campaign.campaign_name) ?? `Campaign ${index + 1}`;
  if (!text(campaign.campaign_name)) missingData.push(`campaigns[${index}].campaign_name`);

  return {
    input: campaign,
    campaign_id: text(campaign.campaign_id),
    campaign_name: campaignName,
    platform: text(campaign.platform),
    active: campaign.active !== false,
    allocation_method: method,
    allocation_basis: basis,
    missing_data: missingData,
    risks: [],
    conditions: [],
  };
}

function placeholderCampaign(channel: ChannelAllocationChannel, index: number): CampaignDraft {
  return {
    input: {
      campaign_name: `Unassigned - ${channel.channel_name}`,
      platform: channel.platform,
      channel_id: channel.channel_id,
      channel_name: channel.channel_name,
      active: true,
      allocation_weight: 1,
    },
    campaign_id: null,
    campaign_name: `Unassigned - ${channel.channel_name}`,
    platform: channel.platform,
    active: true,
    allocation_method: "unassigned_channel_placeholder",
    allocation_basis: 1,
    missing_data: [`channels[${index}].campaigns`],
    risks: [],
    conditions: [`${channel.channel_name}: no active campaigns matched; channel spend is held in an unassigned placeholder.`],
  };
}

function buildCampaignSummary(
  draft: CampaignDraft,
  channel: ChannelAllocationChannel,
  monthlySpend: number,
  dailySpend: number[],
  dailyPlatformRevenue: (number | null)[],
  dailyIncrementalRevenue: (number | null)[],
  dailyConversions: (number | null)[],
): CampaignDailyPlanCampaignSummary {
  const conditions = [...draft.conditions];
  if (draft.allocation_method === "equal_weight") {
    conditions.push(`${draft.campaign_name}: equal campaign weighting used until campaign budget or allocation weight is configured.`);
  }

  return {
    campaign_id: draft.campaign_id,
    campaign_name: draft.campaign_name,
    platform: draft.platform ?? channel.platform,
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    allocation_method: draft.allocation_method,
    allocation_basis: rounded(draft.allocation_basis, 4),
    monthly_target_spend: monthlySpend,
    monthly_platform_revenue_required: sumNullable(dailyPlatformRevenue, (value) => value),
    monthly_incremental_revenue_target: sumNullable(dailyIncrementalRevenue, (value) => value),
    monthly_platform_conversions_required: sumNullable(dailyConversions, (value) => value),
    required_platform_amr: channel.required_platform_amr,
    required_platform_cac: channel.required_platform_cac,
    incremental_target_amr: channel.incremental_target_amr,
    active: draft.active,
    missing_data: unique(draft.missing_data),
    risks: unique(draft.risks),
    conditions: unique(conditions),
  };
}

function buildRows(
  draft: CampaignDraft,
  channel: ChannelAllocationChannel,
  days: CampaignDailyPlanDayInput[],
  weights: number[],
  dailySpend: number[],
  dailyPlatformRevenue: (number | null)[],
  dailyIncrementalRevenue: (number | null)[],
  dailyConversions: (number | null)[],
): CampaignDailyPlanRow[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return days.map((day, index) => ({
    campaign_id: draft.campaign_id,
    campaign_name: draft.campaign_name,
    platform: draft.platform ?? channel.platform,
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    plan_date: parseDate(day.plan_date) ?? String(day.plan_date).slice(0, 10),
    day_index: Math.max(1, Math.round(nonNegative(day.day_index, index + 1))),
    pacing_weight: rounded(weights[index] / totalWeight, 4),
    target_spend: dailySpend[index],
    platform_revenue_required: dailyPlatformRevenue[index],
    incremental_revenue_target: dailyIncrementalRevenue[index],
    platform_conversions_required: dailyConversions[index],
    required_platform_amr: channel.required_platform_amr,
    required_platform_cac: channel.required_platform_cac,
    incremental_target_amr: channel.incremental_target_amr,
    status: "PLANNED",
  }));
}

function emptyOutput(missingData: string[], conditions: string[]): CampaignDailyPlanOutput {
  return {
    engine_version: CAMPAIGN_DAILY_PLAN_ENGINE_VERSION,
    campaigns: [],
    days: [],
    channels: [],
    portfolio: {
      campaign_count: 0,
      day_count: 0,
      row_count: 0,
      planned_ad_spend: 0,
      allocated_campaign_spend: 0,
      platform_revenue_required: null,
      incremental_revenue_target: null,
      platform_conversions_required: null,
    },
    assumptions: {
      formula: "campaign spend = channel allocated spend x campaign allocation share; daily rows follow Profit Plan pacing",
      inactive_campaigns_included: false,
      unassigned_channel_policy: "create placeholder rows so channel spend is not lost",
    },
    missing_data: unique(missingData),
    risks: [],
    conditions: unique(conditions),
    summary: "Campaign Daily Plan v1 - no campaign rows generated.",
  };
}

export function runCampaignDailyPlan(input: CampaignDailyPlanInput): CampaignDailyPlanOutput {
  const validDays = input.days.filter((day) => parseDate(day.plan_date) !== null);
  if (!input.channel_allocation || input.channel_allocation.channels.length === 0) {
    return emptyOutput(
      ["channel_allocation"],
      ["Run channel allocation before generating campaign-level daily plans."],
    );
  }
  if (validDays.length === 0) {
    return emptyOutput(
      ["days"],
      ["Generate Profit Plan daily rows before generating campaign-level daily plans."],
    );
  }

  const includeInactive = input.include_inactive === true;
  const campaignInputs = input.campaigns ?? [];
  const activeCampaignInputs = campaignInputs.filter((campaign) => includeInactive || campaign.active !== false);
  const weights = dailyWeights(validDays);
  const campaignSummaries: CampaignDailyPlanCampaignSummary[] = [];
  const dailyRows: CampaignDailyPlanRow[] = [];
  const channelSummaries: CampaignDailyPlanChannelSummary[] = [];
  const missingData: string[] = [];
  const risks: string[] = [];
  const conditions: string[] = [
    "Campaign Daily Plan is derived; budget mutations must still flow through Budget Change Gate and Budget Application Guard.",
  ];

  input.channel_allocation.channels.forEach((channel, channelIndex) => {
    const matchedInputs = activeCampaignInputs.filter((campaign) => campaignMatchesChannel(campaign, channel));
    const drafts = matchedInputs.length > 0
      ? matchedInputs.map(buildCampaignDraft)
      : [placeholderCampaign(channel, channelIndex)];
    const campaignSpend = splitMoney(channel.allocated_spend, drafts.map((draft) => draft.allocation_basis));
    const summaryStart = campaignSummaries.length;
    const rowStart = dailyRows.length;

    drafts.forEach((draft, draftIndex) => {
      const monthlySpend = campaignSpend[draftIndex] ?? 0;
      const dailySpend = splitMoney(monthlySpend, weights);
      const platformRevenueMonthly = channel.required_platform_amr !== null
        ? money(monthlySpend * channel.required_platform_amr)
        : null;
      const incrementalRevenueMonthly = channel.incremental_target_amr !== null
        ? money(monthlySpend * channel.incremental_target_amr)
        : null;
      const conversionMonthly = channel.required_platform_cac !== null && channel.required_platform_cac > 0
        ? rounded(monthlySpend / channel.required_platform_cac, 2)
        : null;
      const dailyPlatformRevenue = splitNumber(platformRevenueMonthly, weights);
      const dailyIncrementalRevenue = splitNumber(incrementalRevenueMonthly, weights);
      const dailyConversions = splitNumber(conversionMonthly, weights);

      campaignSummaries.push(buildCampaignSummary(
        draft,
        channel,
        monthlySpend,
        dailySpend,
        dailyPlatformRevenue,
        dailyIncrementalRevenue,
        dailyConversions,
      ));
      dailyRows.push(...buildRows(
        draft,
        channel,
        validDays,
        weights,
        dailySpend,
        dailyPlatformRevenue,
        dailyIncrementalRevenue,
        dailyConversions,
      ));
    });

    const channelCampaigns = campaignSummaries.slice(summaryStart);
    const channelRows = dailyRows.slice(rowStart);
    channelSummaries.push({
      channel_id: channel.channel_id,
      channel_name: channel.channel_name,
      platform: channel.platform,
      campaign_count: channelCampaigns.length,
      allocated_spend: channel.allocated_spend,
      planned_spend: money(channelRows.reduce((sum, row) => sum + row.target_spend, 0)),
      platform_revenue_required: sumNullable(channelRows, (row) => row.platform_revenue_required),
      incremental_revenue_target: sumNullable(channelRows, (row) => row.incremental_revenue_target),
      platform_conversions_required: sumNullable(channelRows, (row) => row.platform_conversions_required),
    });
  });

  campaignSummaries.forEach((campaign) => {
    missingData.push(...campaign.missing_data);
    risks.push(...campaign.risks);
    conditions.push(...campaign.conditions);
  });

  const plannedSpend = input.channel_allocation.portfolio.allocated_spend;
  const allocatedCampaignSpend = money(campaignSummaries.reduce((sum, campaign) => sum + campaign.monthly_target_spend, 0));
  if (Math.abs(plannedSpend - allocatedCampaignSpend) > 0.05) {
    risks.push("Campaign plan spend does not reconcile to channel allocation spend.");
  }

  const summary = `Campaign Daily Plan v1 - ${campaignSummaries.length} campaigns - ${validDays.length} days - spend ${allocatedCampaignSpend}.`;

  return {
    engine_version: CAMPAIGN_DAILY_PLAN_ENGINE_VERSION,
    campaigns: campaignSummaries,
    days: dailyRows,
    channels: channelSummaries,
    portfolio: {
      campaign_count: campaignSummaries.length,
      day_count: validDays.length,
      row_count: dailyRows.length,
      planned_ad_spend: plannedSpend,
      allocated_campaign_spend: allocatedCampaignSpend,
      platform_revenue_required: sumNullable(dailyRows, (row) => row.platform_revenue_required),
      incremental_revenue_target: sumNullable(dailyRows, (row) => row.incremental_revenue_target),
      platform_conversions_required: sumNullable(dailyRows, (row) => row.platform_conversions_required),
    },
    assumptions: {
      formula: "campaign spend = channel allocated spend x campaign allocation share; daily rows follow Profit Plan pacing",
      inactive_campaigns_included: includeInactive,
      unassigned_channel_policy: "create placeholder rows so channel spend is not lost",
    },
    missing_data: unique(missingData),
    risks: unique(risks),
    conditions: unique(conditions),
    summary,
  };
}
