import type { ProfitFirstBudgetChangeGateOutput } from "./profitFirstBudgetChangeGate";
import type { BudgetApplicationAuditOutput, CampaignBudgetState } from "./budgetApplicationGuard";

export type BudgetComplianceStatus = "COMPLIANT" | "WATCH" | "BREACH" | "NO_GATE";
export type BudgetComplianceCheckStatus = "pass" | "warn" | "fail";

export type BudgetComplianceCheck = {
  id: string;
  label: string;
  status: BudgetComplianceCheckStatus;
  evidence: string;
};

export type BudgetComplianceMonitorInput = {
  campaigns: CampaignBudgetState[];
  latest_gate?: ProfitFirstBudgetChangeGateOutput | null;
  latest_gate_generated_at?: string | null;
  latest_application?: BudgetApplicationAuditOutput | null;
  latest_application_generated_at?: string | null;
  generatedAt?: string;
};

export type BudgetComplianceMonitorOutput = {
  engine_version: "budget_compliance_monitor_v1";
  generated_at: string;
  status: BudgetComplianceStatus;
  current_daily_total: number;
  current_monthly_total: number;
  gated_monthly_spend: number | null;
  max_safe_monthly_spend: number | null;
  latest_application_applied: boolean | null;
  latest_application_monthly_total: number | null;
  drift_from_gate: number | null;
  drift_from_application: number | null;
  checks: BudgetComplianceCheck[];
  risks: string[];
  next_actions: string[];
  source_refs: {
    latest_gate_generated_at: string | null;
    latest_gate_decision: string | null;
    latest_application_generated_at: string | null;
    latest_application_source: string | null;
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

function check(id: string, label: string, status: BudgetComplianceCheckStatus, evidence: string): BudgetComplianceCheck {
  return { id, label, status, evidence };
}

function totalDaily(campaigns: CampaignBudgetState[]): number {
  return campaigns
    .filter((campaign) => campaign.active !== false)
    .reduce((sum, campaign) => sum + nonNegative(campaign.current_daily_budget), 0);
}

function tolerance(amount: number | null): number {
  if (amount == null) return 10;
  return Math.max(10, Math.abs(amount) * 0.02);
}

function statusFromChecks(checks: BudgetComplianceCheck[], hasGate: boolean, currentMonthly: number): BudgetComplianceStatus {
  if (!hasGate && currentMonthly > 0) return "NO_GATE";
  if (checks.some((item) => item.status === "fail")) return "BREACH";
  if (checks.some((item) => item.status === "warn")) return "WATCH";
  return "COMPLIANT";
}

export function buildBudgetComplianceMonitor(
  input: BudgetComplianceMonitorInput,
): BudgetComplianceMonitorOutput {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const campaigns = Array.isArray(input.campaigns) ? input.campaigns : [];
  const latestGate = input.latest_gate ?? null;
  const latestApplication = input.latest_application ?? null;
  const currentDaily = money(totalDaily(campaigns));
  const currentMonthly = money(currentDaily * DAYS_PER_MONTH);
  const gatedMonthly = latestGate?.proposed_monthly_spend ?? null;
  const maxSafeMonthly = latestGate?.max_safe_monthly_spend ?? null;
  const latestApplicationMonthly = latestApplication?.proposed_monthly_total ?? null;
  const driftFromGate = gatedMonthly == null ? null : money(currentMonthly - gatedMonthly);
  const driftFromApplication = latestApplicationMonthly == null ? null : money(currentMonthly - latestApplicationMonthly);
  const checks: BudgetComplianceCheck[] = [];

  if (!latestGate) {
    checks.push(check(
      "gate_presence",
      "Budget Change Gate",
      currentMonthly > 0 ? "fail" : "pass",
      currentMonthly > 0 ? "Active spend exists without a Budget Change Gate." : "No active spend and no gate required.",
    ));
  } else {
    checks.push(check("gate_presence", "Budget Change Gate", "pass", `Latest gate decision is ${latestGate.decision}.`));

    const gateAllowsSpend = latestGate.decision === "APPROVED" || latestGate.decision === "APPROVED_WITH_CONDITIONS";
    if (!gateAllowsSpend && currentMonthly > latestGate.current_monthly_spend + tolerance(latestGate.current_monthly_spend)) {
      checks.push(check(
        "blocked_gate_drift",
        "Blocked gate drift",
        "fail",
        `Current spend ${currentMonthly} is above blocked/held gate baseline ${latestGate.current_monthly_spend}.`,
      ));
    }

    if (gatedMonthly != null && currentMonthly > gatedMonthly + tolerance(gatedMonthly)) {
      checks.push(check(
        "gated_spend_cap",
        "Gated proposal cap",
        "fail",
        `Current spend ${currentMonthly} exceeds gated proposal ${gatedMonthly}.`,
      ));
    } else if (gatedMonthly != null && currentMonthly > gatedMonthly * 0.95) {
      checks.push(check(
        "gated_spend_headroom",
        "Gated proposal headroom",
        "warn",
        `Current spend ${currentMonthly} is within 5% of gated proposal ${gatedMonthly}.`,
      ));
    } else if (gatedMonthly != null) {
      checks.push(check("gated_spend_cap", "Gated proposal cap", "pass", `Current spend ${currentMonthly} is below gated proposal ${gatedMonthly}.`));
    }

    if (maxSafeMonthly != null && currentMonthly > maxSafeMonthly + tolerance(maxSafeMonthly)) {
      checks.push(check(
        "max_safe_cap",
        "Max safe cap",
        "fail",
        `Current spend ${currentMonthly} exceeds max safe spend ${maxSafeMonthly}.`,
      ));
    } else if (maxSafeMonthly != null) {
      checks.push(check("max_safe_cap", "Max safe cap", "pass", `Current spend ${currentMonthly} is below max safe spend ${maxSafeMonthly}.`));
    }
  }

  if (!latestApplication) {
    checks.push(check(
      "application_audit_presence",
      "Application audit",
      currentMonthly > 0 ? "warn" : "pass",
      currentMonthly > 0 ? "No Budget Application Guard audit run is available." : "No active spend and no application audit required.",
    ));
  } else if (!latestApplication.application.applied && latestApplicationMonthly != null && Math.abs(currentMonthly - latestApplicationMonthly) <= tolerance(latestApplicationMonthly)) {
    checks.push(check(
      "rejected_application_live",
      "Rejected application appears live",
      "fail",
      "The latest rejected application proposal appears to match current live budgets.",
    ));
  } else if (latestApplication.application.applied && latestApplicationMonthly != null && Math.abs(currentMonthly - latestApplicationMonthly) > tolerance(latestApplicationMonthly)) {
    checks.push(check(
      "application_drift",
      "Application drift",
      "warn",
      `Current spend ${currentMonthly} differs from latest applied audit ${latestApplicationMonthly}.`,
    ));
  } else {
    checks.push(check(
      "application_audit_presence",
      "Application audit",
      "pass",
      latestApplication.application.applied ? "Latest application audit was applied." : "Latest application audit was rejected and not live.",
    ));
  }

  const status = statusFromChecks(checks, !!latestGate, currentMonthly);
  const risks = checks.filter((item) => item.status === "fail").map((item) => `${item.label}: ${item.evidence}`);
  const nextActions = risks.length > 0
    ? ["Freeze budget increases until compliance is restored.", "Run Budget Change Gate with the current proposed spend.", "Reconcile campaign budgets against the latest applied audit."]
    : checks.some((item) => item.status === "warn")
      ? ["Review compliance warnings before the next budget change.", "Confirm the latest application audit matches campaign budgets."]
      : ["No immediate action required."];

  return {
    engine_version: "budget_compliance_monitor_v1",
    generated_at: generatedAt,
    status,
    current_daily_total: currentDaily,
    current_monthly_total: currentMonthly,
    gated_monthly_spend: gatedMonthly,
    max_safe_monthly_spend: maxSafeMonthly,
    latest_application_applied: latestApplication?.application.applied ?? null,
    latest_application_monthly_total: latestApplicationMonthly,
    drift_from_gate: driftFromGate,
    drift_from_application: driftFromApplication,
    checks,
    risks,
    next_actions: nextActions,
    source_refs: {
      latest_gate_generated_at: input.latest_gate_generated_at?.trim() || null,
      latest_gate_decision: latestGate?.decision ?? null,
      latest_application_generated_at: input.latest_application_generated_at?.trim() || null,
      latest_application_source: latestApplication?.application.source ?? null,
    },
    summary: `${status} - current monthly spend ${currentMonthly}; gated ${gatedMonthly ?? "none"}; max safe ${maxSafeMonthly ?? "none"}.`,
  };
}
