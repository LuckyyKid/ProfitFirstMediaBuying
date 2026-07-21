import type { ProfitFirstBudgetChangeGateOutput } from "./profitFirstBudgetChangeGate";

export type BudgetApplicationDecision = "ALLOW" | "ALLOW_WITH_CONDITIONS" | "REQUIRE_GATE" | "BLOCK";
export type BudgetApplicationChangeType = "increase" | "decrease" | "maintain";

export type CampaignBudgetState = {
  campaign_id: string;
  current_daily_budget: number | null;
  active?: boolean | null;
};

export type CampaignBudgetUpdate = {
  campaign_id: string;
  proposed_daily_budget: number;
};

export type BudgetApplicationGuardInput = {
  campaigns: CampaignBudgetState[];
  updates: CampaignBudgetUpdate[];
  latest_gate?: ProfitFirstBudgetChangeGateOutput | null;
  generatedAt?: string;
};

export type BudgetApplicationGuardOutput = {
  engine_version: "budget_application_guard_v1";
  generated_at: string;
  decision: BudgetApplicationDecision;
  change_type: BudgetApplicationChangeType;
  current_daily_total: number;
  proposed_daily_total: number;
  current_monthly_total: number;
  proposed_monthly_total: number;
  delta_monthly: number;
  gate_decision: ProfitFirstBudgetChangeGateOutput["decision"] | null;
  gate_proposed_monthly_spend: number | null;
  gate_max_safe_monthly_spend: number | null;
  conditions: string[];
  risks: string[];
  summary: string;
};

export type BudgetApplicationAuditOutput = BudgetApplicationGuardOutput & {
  application: {
    applied: boolean;
    source: string | null;
    update_count: number;
    updates: CampaignBudgetUpdate[];
  };
};

const DAYS_PER_MONTH = 30.4;

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finite(value, fallback));
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function changeType(deltaMonthly: number): BudgetApplicationChangeType {
  if (Math.abs(deltaMonthly) < 1) return "maintain";
  return deltaMonthly > 0 ? "increase" : "decrease";
}

function totalDaily(campaigns: CampaignBudgetState[]): number {
  return campaigns
    .filter((campaign) => campaign.active !== false)
    .reduce((sum, campaign) => sum + nonNegative(campaign.current_daily_budget), 0);
}

function proposedCampaigns(campaigns: CampaignBudgetState[], updates: CampaignBudgetUpdate[]): CampaignBudgetState[] {
  const updateById = new Map(updates.map((update) => [update.campaign_id, nonNegative(update.proposed_daily_budget)]));
  return campaigns.map((campaign) => ({
    ...campaign,
    current_daily_budget: updateById.has(campaign.campaign_id)
      ? updateById.get(campaign.campaign_id) ?? 0
      : campaign.current_daily_budget,
  }));
}

export function buildBudgetApplicationGuard(
  input: BudgetApplicationGuardInput,
): BudgetApplicationGuardOutput {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const campaigns = Array.isArray(input.campaigns) ? input.campaigns : [];
  const updates = Array.isArray(input.updates) ? input.updates : [];
  const latestGate = input.latest_gate ?? null;
  const currentDaily = money(totalDaily(campaigns));
  const proposedDaily = money(totalDaily(proposedCampaigns(campaigns, updates)));
  const currentMonthly = money(currentDaily * DAYS_PER_MONTH);
  const proposedMonthly = money(proposedDaily * DAYS_PER_MONTH);
  const deltaMonthly = money(proposedMonthly - currentMonthly);
  const type = changeType(deltaMonthly);
  const conditions: string[] = [];
  const risks: string[] = [];

  let decision: BudgetApplicationDecision = "ALLOW";

  if (updates.length === 0) {
    decision = "REQUIRE_GATE";
    risks.push("No budget update was provided.");
  } else if (type === "decrease" || type === "maintain") {
    decision = "ALLOW";
  } else if (!latestGate) {
    decision = "REQUIRE_GATE";
    risks.push("No Budget Change Gate run is available for this increase.");
  } else if (latestGate.decision === "BLOCKED" || latestGate.decision === "HOLD") {
    decision = "BLOCK";
    risks.push(`Latest Budget Change Gate decision is ${latestGate.decision}.`);
  } else if (latestGate.max_safe_monthly_spend != null && proposedMonthly > latestGate.max_safe_monthly_spend) {
    decision = "REQUIRE_GATE";
    risks.push(`Proposed monthly total ${proposedMonthly} exceeds gate max safe spend ${latestGate.max_safe_monthly_spend}.`);
  } else if (proposedMonthly > latestGate.proposed_monthly_spend) {
    decision = "REQUIRE_GATE";
    risks.push(`Proposed monthly total ${proposedMonthly} exceeds the gated proposal ${latestGate.proposed_monthly_spend}.`);
  } else if (latestGate.decision === "APPROVED_WITH_CONDITIONS") {
    decision = "ALLOW_WITH_CONDITIONS";
    conditions.push(...latestGate.conditions);
    if (conditions.length === 0) conditions.push("Latest gate approved with conditions; confirm AM ownership before applying.");
  }

  const summary = `${decision} - ${type} from ${currentMonthly} to ${proposedMonthly} monthly spend.`;

  return {
    engine_version: "budget_application_guard_v1",
    generated_at: generatedAt,
    decision,
    change_type: type,
    current_daily_total: currentDaily,
    proposed_daily_total: proposedDaily,
    current_monthly_total: currentMonthly,
    proposed_monthly_total: proposedMonthly,
    delta_monthly: deltaMonthly,
    gate_decision: latestGate?.decision ?? null,
    gate_proposed_monthly_spend: latestGate?.proposed_monthly_spend ?? null,
    gate_max_safe_monthly_spend: latestGate?.max_safe_monthly_spend ?? null,
    conditions,
    risks,
    summary,
  };
}
