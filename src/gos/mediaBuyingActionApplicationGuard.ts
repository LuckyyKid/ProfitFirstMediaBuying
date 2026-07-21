import type { BudgetApplicationAuditOutput } from "./budgetApplicationGuard";

export type MediaBuyingActionApplicationDecision = "ALLOW" | "BLOCK" | "REVIEW";
export type MediaBuyingActionApplicationCheckStatus = "pass" | "fail" | "warn" | "not_applicable";

export type MediaBuyingActionApplicationAction = {
  id: string;
  target_name: string;
  action_type: string;
  action_value: number | null;
  status: string;
  created_at: string;
};

export type MediaBuyingActionCampaignRef = {
  campaign_id: string;
  name: string;
  current_daily_budget: number | null;
  active?: boolean | null;
};

export type MediaBuyingActionBudgetApplicationAudit = {
  generated_at: string | null;
  output: BudgetApplicationAuditOutput;
};

export type MediaBuyingActionApplicationGuardInput = {
  action: MediaBuyingActionApplicationAction;
  campaigns: MediaBuyingActionCampaignRef[];
  application_audits?: MediaBuyingActionBudgetApplicationAudit[];
  generatedAt?: string;
};

export type MediaBuyingActionApplicationCheck = {
  id: string;
  label: string;
  status: MediaBuyingActionApplicationCheckStatus;
  detail: string;
};

export type MediaBuyingActionApplicationGuardOutput = {
  engine_version: "media_buying_action_application_guard_v1";
  generated_at: string;
  decision: MediaBuyingActionApplicationDecision;
  action_type: string;
  target_name: string;
  budget_mutation_required: boolean;
  matched_campaign_id: string | null;
  matching_application_generated_at: string | null;
  matching_application_applied: boolean | null;
  checks: MediaBuyingActionApplicationCheck[];
  risks: string[];
  next_actions: string[];
  summary: string;
};

const BUDGET_ACTIONS = new Set(["scale_up", "scale_down", "pause", "increase", "decrease"]);

function generatedAt(input?: string): string {
  const parsed = input ? new Date(input) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function timeMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function check(
  id: string,
  label: string,
  status: MediaBuyingActionApplicationCheckStatus,
  detail: string,
): MediaBuyingActionApplicationCheck {
  return { id, label, status, detail };
}

function isBudgetAction(actionType: string): boolean {
  return BUDGET_ACTIONS.has(actionType);
}

function auditTime(audit: MediaBuyingActionBudgetApplicationAudit): string | null {
  return audit.generated_at ?? audit.output.generated_at ?? null;
}

function updateForCampaign(audit: BudgetApplicationAuditOutput, campaignId: string) {
  return audit.application.updates.find((update) => update.campaign_id === campaignId) ?? null;
}

function findMatchingAudit(
  audits: MediaBuyingActionBudgetApplicationAudit[],
  actionCreatedAt: string,
  campaignId: string,
): MediaBuyingActionBudgetApplicationAudit | null {
  return audits
    .filter((audit) => timeMs(auditTime(audit)) >= timeMs(actionCreatedAt))
    .filter((audit) => Boolean(updateForCampaign(audit.output, campaignId)))
    .sort((a, b) => timeMs(auditTime(b)) - timeMs(auditTime(a)))[0] ?? null;
}

function actionMatchesAudit(
  action: MediaBuyingActionApplicationAction,
  audit: BudgetApplicationAuditOutput,
  campaignId: string,
): boolean {
  const update = updateForCampaign(audit, campaignId);
  if (!update) return false;
  if (action.action_type === "scale_up" || action.action_type === "increase") return audit.change_type === "increase";
  if (action.action_type === "scale_down" || action.action_type === "decrease") return audit.change_type === "decrease";
  if (action.action_type === "pause") return update.proposed_daily_budget <= 0;
  return true;
}

export function buildMediaBuyingActionApplicationGuard(
  input: MediaBuyingActionApplicationGuardInput,
): MediaBuyingActionApplicationGuardOutput {
  const action = input.action;
  const actionType = action.action_type;
  const budgetMutationRequired = isBudgetAction(actionType);
  const checks: MediaBuyingActionApplicationCheck[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];
  let decision: MediaBuyingActionApplicationDecision = "ALLOW";

  checks.push(check(
    "status_transition",
    "Action is pending application",
    action.status === "suggested" ? "pass" : "warn",
    action.status === "suggested" ? "Action can be reviewed." : `Current status is ${action.status}.`,
  ));

  if (!budgetMutationRequired) {
    checks.push(check(
      "budget_mutation_required",
      "Budget mutation required",
      "not_applicable",
      `${actionType} does not require campaign-budget mutation audit.`,
    ));
    nextActions.push("Mark applied only after the human/platform action is actually complete.");
    return {
      engine_version: "media_buying_action_application_guard_v1",
      generated_at: generatedAt(input.generatedAt),
      decision,
      action_type: actionType,
      target_name: action.target_name,
      budget_mutation_required: false,
      matched_campaign_id: null,
      matching_application_generated_at: null,
      matching_application_applied: null,
      checks,
      risks,
      next_actions: nextActions,
      summary: `ALLOW - ${actionType} can be marked applied without budget mutation audit.`,
    };
  }

  const campaignMatches = input.campaigns.filter((campaign) => campaign.name === action.target_name);
  const campaign = campaignMatches[0] ?? null;

  if (!campaign || campaignMatches.length > 1) {
    decision = "BLOCK";
    risks.push(!campaign ? "TARGET_CAMPAIGN_NOT_FOUND" : "TARGET_CAMPAIGN_AMBIGUOUS");
    checks.push(check(
      "campaign_match",
      "Target campaign match",
      "fail",
      !campaign
        ? `No campaign named ${action.target_name} was found.`
        : `Multiple campaigns named ${action.target_name} were found.`,
    ));
    nextActions.push("Resolve campaign targeting before marking this budget action applied.");
    return {
      engine_version: "media_buying_action_application_guard_v1",
      generated_at: generatedAt(input.generatedAt),
      decision,
      action_type: actionType,
      target_name: action.target_name,
      budget_mutation_required: true,
      matched_campaign_id: null,
      matching_application_generated_at: null,
      matching_application_applied: null,
      checks,
      risks,
      next_actions: nextActions,
      summary: `BLOCK - ${actionType} cannot be marked applied because the target campaign is not uniquely identified.`,
    };
  }

  checks.push(check(
    "campaign_match",
    "Target campaign match",
    "pass",
    `Matched ${campaign.name} to ${campaign.campaign_id}.`,
  ));

  const audits = input.application_audits ?? [];
  const matchingAudit = findMatchingAudit(audits, action.created_at, campaign.campaign_id);
  const matchingOutput = matchingAudit?.output ?? null;
  const matchingGeneratedAt = matchingAudit ? auditTime(matchingAudit) : null;
  const matchingApplied = matchingOutput?.application.applied ?? null;

  if (!matchingAudit) {
    decision = "BLOCK";
    risks.push("MISSING_BUDGET_APPLICATION_AUDIT");
    checks.push(check(
      "application_audit",
      "Budget application audit exists",
      "fail",
      "No matching budget_application_guard audit was found after this action was created.",
    ));
    nextActions.push("Apply the budget change through Budget Application Guard, then mark this action applied.");
  } else {
    checks.push(check(
      "application_audit",
      "Budget application audit exists",
      "pass",
      `Matched application audit generated at ${matchingGeneratedAt ?? "unknown"}.`,
    ));

    if (matchingApplied !== true) {
      decision = "BLOCK";
      risks.push("BUDGET_APPLICATION_NOT_APPLIED");
      checks.push(check(
        "application_applied",
        "Budget application was applied",
        "fail",
        "The matching budget application audit was rejected or not applied.",
      ));
      nextActions.push("Use a successfully applied Budget Application Guard audit before marking applied.");
    } else {
      checks.push(check(
        "application_applied",
        "Budget application was applied",
        "pass",
        "The matching budget application audit confirms the budget write was applied.",
      ));
    }

    if (!actionMatchesAudit(action, matchingOutput, campaign.campaign_id)) {
      decision = "BLOCK";
      risks.push("ACTION_TYPE_DOES_NOT_MATCH_BUDGET_APPLICATION");
      checks.push(check(
        "action_alignment",
        "Action aligns with budget application",
        "fail",
        `Action ${actionType} does not match application change type ${matchingOutput.change_type}.`,
      ));
      nextActions.push("Create/apply the correct budget change before marking this action applied.");
    } else {
      checks.push(check(
        "action_alignment",
        "Action aligns with budget application",
        "pass",
        `Action ${actionType} aligns with application change type ${matchingOutput.change_type}.`,
      ));
    }
  }

  if (decision === "ALLOW") {
    nextActions.push("Mark action applied and keep the application audit available for review.");
  }

  return {
    engine_version: "media_buying_action_application_guard_v1",
    generated_at: generatedAt(input.generatedAt),
    decision,
    action_type: actionType,
    target_name: action.target_name,
    budget_mutation_required: true,
    matched_campaign_id: campaign.campaign_id,
    matching_application_generated_at: matchingGeneratedAt,
    matching_application_applied: matchingApplied,
    checks,
    risks,
    next_actions: nextActions,
    summary: `${decision} - ${actionType} application status for ${action.target_name}.`,
  };
}
