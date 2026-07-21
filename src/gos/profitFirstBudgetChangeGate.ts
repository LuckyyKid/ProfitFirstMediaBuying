import type { ProfitFirstOutput } from "./profitFirstMediaBuying";
import type { DataAnalystExecutionPlanOutput } from "./dataAnalystExecutionPlan";

export type BudgetGateDecision = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "HOLD" | "BLOCKED";
export type BudgetGateChangeType = "increase" | "decrease" | "maintain" | "unknown";
export type BudgetGateCheckStatus = "pass" | "warn" | "fail";
export type BudgetGateApproval = "NONE" | "AM" | "AM_LEAD" | "FINANCE";

export type BudgetGateCheck = {
  id: string;
  label: string;
  status: BudgetGateCheckStatus;
  source: "proposal" | "profit_first" | "execution_plan";
  evidence: string;
};

export type ProfitFirstBudgetChangeGateInput = {
  current_monthly_spend?: number | null;
  proposed_monthly_spend?: number | null;
  proposal_source?: string | null;
  reason?: string | null;
  profit_first?: ProfitFirstOutput | null;
  profit_first_generated_at?: string | null;
  execution_plan?: DataAnalystExecutionPlanOutput | null;
  generatedAt?: string;
};

export type ProfitFirstBudgetChangeGateOutput = {
  engine_version: "profit_first_budget_change_gate_v1";
  generated_at: string;
  decision: BudgetGateDecision;
  change_type: BudgetGateChangeType;
  required_approval: BudgetGateApproval;
  current_monthly_spend: number;
  proposed_monthly_spend: number;
  proposed_daily_spend: number;
  delta_monthly_spend: number;
  delta_pct: number | null;
  max_safe_monthly_spend: number | null;
  max_safe_daily_spend: number | null;
  checks: BudgetGateCheck[];
  conditions: string[];
  risks: string[];
  source_refs: {
    proposal_source: string | null;
    profit_first_generated_at: string | null;
    execution_plan_generated_at: string | null;
    execution_plan_posture: string | null;
  };
  summary: string;
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

function pct(value: number | null): number | null {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(4));
}

function changeType(current: number, proposed: number): BudgetGateChangeType {
  if (proposed <= 0) return "unknown";
  if (current <= 0 && proposed > 0) return "increase";
  const delta = proposed - current;
  if (Math.abs(delta) < 1) return "maintain";
  return delta > 0 ? "increase" : "decrease";
}

function check(
  id: string,
  label: string,
  status: BudgetGateCheckStatus,
  source: BudgetGateCheck["source"],
  evidence: string,
): BudgetGateCheck {
  return { id, label, status, source, evidence };
}

function positiveCaps(pf: ProfitFirstOutput): number[] {
  return [
    pf.recommended_spend,
    pf.cash_capped_spend,
    pf.max_spend_by_funnel,
    pf.spending_power?.recommended_spend?.high,
  ]
    .map((value) => finite(value, Number.POSITIVE_INFINITY))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function maxSafeMonthlySpend(pf: ProfitFirstOutput | null): number | null {
  if (!pf) return null;
  const caps = positiveCaps(pf);
  if (caps.length === 0) return null;
  return money(Math.min(...caps));
}

function executionPlanChecks(
  plan: DataAnalystExecutionPlanOutput | null,
  type: BudgetGateChangeType,
): BudgetGateCheck[] {
  if (!plan) {
    return [
      check(
        "execution_plan_required",
        "Analyst execution plan available",
        type === "increase" ? "fail" : "warn",
        "execution_plan",
        "No data_analyst_execution_plan run is available.",
      ),
    ];
  }

  const checks: BudgetGateCheck[] = [];
  if (plan.posture === "READY_FOR_CONTROLLED_SCALE") {
    checks.push(check("execution_plan_posture", "Execution posture", "pass", "execution_plan", "Controlled scale posture is available."));
  } else if (plan.posture === "MAINTAIN_WITH_GUARDRAILS") {
    checks.push(check(
      "execution_plan_posture",
      "Execution posture",
      type === "increase" ? "warn" : "pass",
      "execution_plan",
      "Plan allows guardrailed execution, not unconstrained scale.",
    ));
  } else if (plan.posture === "HOLD_AND_INVESTIGATE") {
    checks.push(check(
      "execution_posture_hold",
      "Execution posture",
      type === "increase" ? "fail" : "warn",
      "execution_plan",
      "Decision brief requires hold and investigation before budget increases.",
    ));
  } else {
    checks.push(check(
      "execution_posture_blocked",
      "Execution posture",
      "fail",
      "execution_plan",
      `Execution posture is ${plan.posture}.`,
    ));
  }

  const blockedMonitor = plan.guardrail_monitors.find((monitor) => monitor.status === "blocked");
  if (blockedMonitor) {
    checks.push(check(
      "blocked_guardrail",
      "Blocked guardrail",
      "fail",
      "execution_plan",
      `${blockedMonitor.label}: ${blockedMonitor.escalation_rule}`,
    ));
  } else {
    const watchCount = plan.guardrail_monitors.filter((monitor) => monitor.status === "watch").length;
    checks.push(check(
      "guardrail_monitors",
      "Guardrail monitors",
      watchCount > 0 ? "warn" : "pass",
      "execution_plan",
      watchCount > 0 ? `${watchCount} guardrail monitor(s) require review.` : "No blocked or watch guardrails.",
    ));
  }

  const p0Count = plan.work_items.filter((item) => item.priority === "P0" && item.status !== "blocked").length;
  if (p0Count > 0) {
    checks.push(check(
      "p0_work_items",
      "P0 execution work",
      "warn",
      "execution_plan",
      `${p0Count} P0 work item(s) must be confirmed complete before applying a budget change.`,
    ));
  }

  return checks;
}

function profitFirstChecks(
  pf: ProfitFirstOutput | null,
  current: number,
  proposed: number,
  type: BudgetGateChangeType,
): BudgetGateCheck[] {
  if (!pf) {
    return [
      check(
        "profit_first_required",
        "Profit First Media Buying run available",
        type === "increase" ? "fail" : "warn",
        "profit_first",
        "No profit_first_media_buying run is available.",
      ),
    ];
  }

  const maxSafe = maxSafeMonthlySpend(pf);
  const isIncrease = type === "increase";
  const checks: BudgetGateCheck[] = [
    check(
      "pfmb_spend_cap",
      "PFMB max safe spend",
      maxSafe != null && proposed <= maxSafe ? "pass" : isIncrease ? "fail" : "warn",
      "profit_first",
      maxSafe == null
        ? "No safe spend cap could be computed from PFMB."
        : `Proposed ${proposed} / safe cap ${maxSafe}.`,
    ),
    check(
      "cash_cap",
      "Cash cap",
      proposed <= pf.cash_capped_spend ? "pass" : isIncrease ? "fail" : "warn",
      "profit_first",
      `Proposed ${proposed} / cash cap ${pf.cash_capped_spend}.`,
    ),
    check(
      "funnel_cap",
      "Funnel cap",
      proposed <= pf.max_spend_by_funnel ? "pass" : isIncrease ? "fail" : "warn",
      "profit_first",
      `Proposed ${proposed} / funnel cap ${pf.max_spend_by_funnel}.`,
    ),
    check(
      "contribution",
      "Contribution",
      pf.contribution_total >= 0 ? "pass" : isIncrease ? "fail" : "warn",
      "profit_first",
      `Latest PFMB contribution at planned spend is ${pf.contribution_total}.`,
    ),
    check(
      "ltv_cac",
      "Net LTV/CAC",
      pf.ltv_new_net_horizon >= 0 ? "pass" : isIncrease ? "fail" : "warn",
      "profit_first",
      `Net LTV horizon is ${pf.ltv_new_net_horizon}.`,
    ),
  ];

  if (type === "increase" && current > 0) {
    const increasePct = (proposed - current) / current;
    checks.push(check(
      "increase_size",
      "Increase size",
      increasePct <= 0.2 || pf.binding_constraint === "PLANNED" ? "pass" : "warn",
      "proposal",
      `Increase is ${(increasePct * 100).toFixed(1)}%; binding constraint is ${pf.binding_constraint}.`,
    ));
  }

  if (pf.payback_months_estimate != null && pf.payback_months_estimate > 6 && isIncrease) {
    checks.push(check(
      "payback_window",
      "Payback window",
      "warn",
      "profit_first",
      `Estimated payback is ${pf.payback_months_estimate} months.`,
    ));
  }

  return checks;
}

function requiredApproval(decision: BudgetGateDecision, proposed: number, current: number, maxSafe: number | null): BudgetGateApproval {
  if (decision === "BLOCKED" || decision === "HOLD") return "AM_LEAD";
  if (maxSafe != null && proposed > maxSafe * 0.9) return "AM";
  if (current > 0 && proposed > current * 1.2) return "AM_LEAD";
  if (proposed - current > 10_000) return "FINANCE";
  return "NONE";
}

function decisionFromChecks(checks: BudgetGateCheck[]): BudgetGateDecision {
  const failIds = checks.filter((item) => item.status === "fail").map((item) => item.id);
  const hardFails = failIds.filter((id) => id !== "execution_posture_hold");
  if (hardFails.length > 0) return "BLOCKED";
  if (failIds.includes("execution_posture_hold")) return "HOLD";
  return checks.some((item) => item.status === "warn") ? "APPROVED_WITH_CONDITIONS" : "APPROVED";
}

export function buildProfitFirstBudgetChangeGate(
  input: ProfitFirstBudgetChangeGateInput,
): ProfitFirstBudgetChangeGateOutput {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const current = money(nonNegative(input.current_monthly_spend));
  const proposed = money(nonNegative(input.proposed_monthly_spend));
  const type = changeType(current, proposed);
  const checks: BudgetGateCheck[] = [];

  checks.push(check(
    "proposal_amount",
    "Proposal amount",
    proposed > 0 ? "pass" : "fail",
    "proposal",
    proposed > 0 ? `Proposed monthly spend is ${proposed}.` : "Proposed monthly spend is missing or zero.",
  ));

  const delta = money(proposed - current);
  const deltaPct = current > 0 ? pct(delta / current) : null;
  if (type === "increase" && deltaPct != null && deltaPct > 0.2 && input.execution_plan?.posture !== "READY_FOR_CONTROLLED_SCALE") {
    checks.push(check(
      "controlled_scale_required",
      "Controlled scale required",
      "fail",
      "execution_plan",
      `Increase is ${(deltaPct * 100).toFixed(1)}%; execution posture must be READY_FOR_CONTROLLED_SCALE.`,
    ));
  }

  checks.push(...profitFirstChecks(input.profit_first ?? null, current, proposed, type));
  checks.push(...executionPlanChecks(input.execution_plan ?? null, type));

  const decision = decisionFromChecks(checks);
  const maxSafe = maxSafeMonthlySpend(input.profit_first ?? null);
  const approval = requiredApproval(decision, proposed, current, maxSafe);

  const conditions = checks
    .filter((item) => item.status === "warn")
    .map((item) => `${item.label}: ${item.evidence}`);
  const risks = checks
    .filter((item) => item.status === "fail")
    .map((item) => `${item.label}: ${item.evidence}`);

  const summary = `${decision} - ${type} from ${current} to ${proposed} monthly spend. Max safe spend: ${maxSafe ?? "unknown"}. Approval: ${approval}.`;

  return {
    engine_version: "profit_first_budget_change_gate_v1",
    generated_at: generatedAt,
    decision,
    change_type: type,
    required_approval: approval,
    current_monthly_spend: current,
    proposed_monthly_spend: proposed,
    proposed_daily_spend: money(proposed / DAYS_PER_MONTH),
    delta_monthly_spend: delta,
    delta_pct: deltaPct,
    max_safe_monthly_spend: maxSafe,
    max_safe_daily_spend: maxSafe == null ? null : money(maxSafe / DAYS_PER_MONTH),
    checks,
    conditions,
    risks,
    source_refs: {
      proposal_source: input.proposal_source?.trim() || null,
      profit_first_generated_at: input.profit_first_generated_at?.trim() || null,
      execution_plan_generated_at: input.execution_plan?.generated_at ?? null,
      execution_plan_posture: input.execution_plan?.posture ?? null,
    },
    summary,
  };
}
