import type { DataAnalystFoundationOutput } from "./dataAnalystFoundation";
import type { DataAnalystStatisticalOutput } from "./dataAnalystStatisticalController";

export type DecisionBriefPosture =
  | "BLOCKED"
  | "FIX_DATA_FIRST"
  | "HOLD_AND_INVESTIGATE"
  | "MAINTAIN_WITH_GUARDRAILS"
  | "READY_FOR_CONTROLLED_SCALE";

export type DecisionBriefPriority = "P0" | "P1" | "P2";
export type DecisionBriefArea = "data" | "retention" | "pnl" | "spend" | "forecast" | "incrementality";
export type DecisionBriefOwner = "AM" | "MEDIA_BUYER" | "DATA_ANALYST" | "CLIENT";

export type DecisionBriefAction = {
  id: string;
  priority: DecisionBriefPriority;
  area: DecisionBriefArea;
  owner: DecisionBriefOwner;
  action: string;
  rationale: string;
  evidence: string;
};

export type DecisionBriefGuardrail = {
  id: string;
  label: string;
  status: "active" | "watch" | "blocked";
  rule: string;
  evidence: string;
};

export type DataAnalystDecisionBriefInput = {
  foundation?: DataAnalystFoundationOutput | null;
  statistical?: DataAnalystStatisticalOutput | null;
  generatedAt?: string;
};

export type DataAnalystDecisionBriefOutput = {
  engine_version: "data_analyst_decision_brief_v1";
  generated_at: string;
  posture: DecisionBriefPosture;
  confidence_score: number;
  primary_decision: string;
  actions: DecisionBriefAction[];
  guardrails: DecisionBriefGuardrail[];
  risks: string[];
  model_card: {
    purpose: string;
    inputs: string[];
    assumptions: string[];
    limitations: string[];
  };
  summary: string;
};

function round(value: number, digits = 0): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readinessScore(readiness?: string | null): number {
  if (readiness === "READY_FOR_ADVANCED_ANALYSIS") return 30;
  if (readiness === "READY_FOR_BASIC_ANALYSIS") return 18;
  if (readiness === "NEEDS_WORK") return 8;
  return 0;
}

function hasCriticalAnomaly(statistical?: DataAnalystStatisticalOutput | null): boolean {
  return Boolean(statistical?.pnl_anomalies?.anomalies?.some((row) => row.severity === "critical"));
}

function spendRegressionStrong(statistical?: DataAnalystStatisticalOutput | null): boolean {
  const regression = statistical?.spend_efficiency_regression;
  return regression?.status === "fit"
    && Number(regression.r_squared ?? 0) >= 0.5
    && Number(regression.p_value ?? 1) <= 0.1
    && Number(regression.elasticity ?? 0) > 0;
}

function retentionUsable(statistical?: DataAnalystStatisticalOutput | null): boolean {
  const retention = statistical?.retention_curve;
  return Boolean(retention?.status && retention.status !== "insufficient_data" && Number(retention.cohorts ?? 0) >= 3);
}

function retentionBacktestWeak(statistical?: DataAnalystStatisticalOutput | null): boolean {
  const mape = statistical?.retention_curve?.backtest_mape_pct;
  return mape != null && Number(mape) > 30;
}

function mmmUsable(statistical?: DataAnalystStatisticalOutput | null): boolean {
  const mmm = statistical?.mmm_incrementality;
  return mmm?.status === "fit"
    && Number(mmm.portfolio?.weighted_incrementality_factor ?? 0) > 0
    && Number(mmm.channels?.length ?? 0) >= 2;
}

function mmmDirectional(statistical?: DataAnalystStatisticalOutput | null): boolean {
  return statistical?.mmm_incrementality?.status === "directional";
}

function addAction(actions: DecisionBriefAction[], action: DecisionBriefAction): void {
  if (!actions.some((existing) => existing.id === action.id)) actions.push(action);
}

export function buildDataAnalystDecisionBrief(
  input: DataAnalystDecisionBriefInput,
): DataAnalystDecisionBriefOutput {
  const foundation = input.foundation ?? null;
  const statistical = input.statistical ?? null;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const actions: DecisionBriefAction[] = [];
  const guardrails: DecisionBriefGuardrail[] = [];
  const risks: string[] = [];

  const foundationReadiness = foundation?.readiness ?? "BLOCKED";
  const statisticalReadiness = statistical?.readiness ?? "BLOCKED";
  const criticalAnomaly = hasCriticalAnomaly(statistical);
  const regressionStrong = spendRegressionStrong(statistical);
  const retentionReady = retentionUsable(statistical);
  const weakRetentionBacktest = retentionBacktestWeak(statistical);
  const mmmReady = mmmUsable(statistical);
  const mmmContextOnly = mmmDirectional(statistical);

  if (!foundation || foundationReadiness === "BLOCKED" || foundationReadiness === "NEEDS_WORK") {
    addAction(actions, {
      id: "fix_foundation_data",
      priority: "P0",
      area: "data",
      owner: "AM",
      action: "Fix Data Analyst Foundation blockers before using statistical outputs for budget decisions.",
      rationale: "The statistical layer depends on clean transactions, daily P&L actuals, projections, and audit trail.",
      evidence: foundation ? `Foundation readiness is ${foundationReadiness} with score ${foundation.score}/100.` : "No foundation run is available.",
    });
    risks.push("Statistical decisions are blocked until source data readiness improves.");
  }

  if (!statistical || statisticalReadiness === "BLOCKED") {
    addAction(actions, {
      id: "run_statistical_batch",
      priority: foundationReadiness === "READY_FOR_ADVANCED_ANALYSIS" ? "P1" : "P2",
      area: "data",
      owner: "DATA_ANALYST",
      action: "Run the Python statistical batch and save the output JSON.",
      rationale: "The decision brief needs retention fit, P&L residuals, and spend regression to produce statistical guardrails.",
      evidence: statistical ? `Statistical readiness is ${statisticalReadiness}.` : "No statistical run is saved.",
    });
  }

  if (criticalAnomaly) {
    const count = statistical?.pnl_anomalies?.anomalies?.filter((row) => row.severity === "critical").length ?? 0;
    addAction(actions, {
      id: "investigate_critical_pnl_anomalies",
      priority: "P0",
      area: "pnl",
      owner: "AM",
      action: "Investigate critical actual-vs-projection anomalies before increasing spend.",
      rationale: "Large projection residuals can indicate tracking, conversion, offer, inventory, or spend pacing issues.",
      evidence: `${count} critical P&L anomal${count === 1 ? "y" : "ies"} detected.`,
    });
    risks.push("Budget increases are unsafe until critical P&L anomalies are explained.");
  }

  if (!retentionReady) {
    addAction(actions, {
      id: "build_retention_depth",
      priority: "P1",
      area: "retention",
      owner: "DATA_ANALYST",
      action: "Collect more cohort history before using retention to expand CAC limits.",
      rationale: "Retention curve fitting requires enough acquisition cohorts and post-acquisition age periods.",
      evidence: `Retention status is ${statistical?.retention_curve?.status ?? "missing"} with ${statistical?.retention_curve?.cohorts ?? 0} cohort(s).`,
    });
  } else if (weakRetentionBacktest) {
    addAction(actions, {
      id: "treat_retention_as_directional",
      priority: "P1",
      area: "retention",
      owner: "DATA_ANALYST",
      action: "Use retention curve directionally until backtest error improves.",
      rationale: "High retention backtest error makes LTV expansion risky.",
      evidence: `Retention backtest MAPE is ${statistical?.retention_curve?.backtest_mape_pct}%.`,
    });
    risks.push("Retention-based LTV guardrails are directional, not approval-grade.");
  }

  if (!regressionStrong) {
    addAction(actions, {
      id: "do_not_use_regression_alone",
      priority: "P1",
      area: "spend",
      owner: "MEDIA_BUYER",
      action: "Keep spend decisions anchored to deterministic spend frontier and contribution constraints.",
      rationale: "Spend regression is not strong enough to drive budget decisions by itself.",
      evidence: `Regression status ${statistical?.spend_efficiency_regression?.status ?? "missing"}, R2 ${statistical?.spend_efficiency_regression?.r_squared ?? "n/a"}, p-value ${statistical?.spend_efficiency_regression?.p_value ?? "n/a"}.`,
    });
  }

  if (!mmmReady) {
    addAction(actions, {
      id: mmmContextOnly ? "treat_mmm_as_directional" : "build_channel_incrementality_history",
      priority: "P1",
      area: "incrementality",
      owner: "DATA_ANALYST",
      action: mmmContextOnly
        ? "Use MMM incrementality only as directional channel context until fit quality improves."
        : "Collect channel-level daily campaign performance before using MMM incrementality in channel allocation.",
      rationale: "Channel incrementality should inform allocation assumptions only when the statistical context is stable enough for review.",
      evidence: `MMM status ${statistical?.mmm_incrementality?.status ?? "missing"}, R2 ${statistical?.mmm_incrementality?.portfolio?.r_squared ?? "n/a"}, channels ${statistical?.mmm_incrementality?.channels?.length ?? 0}.`,
    });
  }

  guardrails.push({
    id: "projection_integrity",
    label: "Projection integrity",
    status: criticalAnomaly ? "blocked" : "active",
    rule: "Do not increase budget when critical actual-vs-projection anomalies are unresolved.",
    evidence: criticalAnomaly ? "Critical P&L anomaly detected." : "No critical P&L anomaly detected in latest statistical run.",
  });

  guardrails.push({
    id: "retention_ltv",
    label: "Retention/LTV expansion",
    status: retentionReady && !weakRetentionBacktest ? "active" : retentionReady ? "watch" : "blocked",
    rule: "Use fitted retention to inform CAC/LTV guardrails only when cohort depth and backtest are acceptable.",
    evidence: `Retention status ${statistical?.retention_curve?.status ?? "missing"}, R2 ${statistical?.retention_curve?.r_squared ?? "n/a"}, backtest ${statistical?.retention_curve?.backtest_mape_pct ?? "n/a"}.`,
  });

  guardrails.push({
    id: "spend_regression",
    label: "Spend regression",
    status: regressionStrong ? "active" : "watch",
    rule: "Use spend regression as context beside deterministic frontier, not as a replacement for incrementality.",
    evidence: `Elasticity ${statistical?.spend_efficiency_regression?.elasticity ?? "n/a"}, R2 ${statistical?.spend_efficiency_regression?.r_squared ?? "n/a"}, p-value ${statistical?.spend_efficiency_regression?.p_value ?? "n/a"}.`,
  });

  guardrails.push({
    id: "channel_incrementality",
    label: "Channel incrementality",
    status: mmmReady ? "active" : mmmContextOnly ? "watch" : "blocked",
    rule: "Use MMM incrementality as reviewed allocation context only; never apply budget changes directly from MMM output.",
    evidence: `MMM status ${statistical?.mmm_incrementality?.status ?? "missing"}, weighted incrementality ${statistical?.mmm_incrementality?.portfolio?.weighted_incrementality_factor ?? "n/a"}, R2 ${statistical?.mmm_incrementality?.portfolio?.r_squared ?? "n/a"}.`,
  });

  let posture: DecisionBriefPosture = "BLOCKED";
  if (!foundation || foundationReadiness === "BLOCKED") posture = "BLOCKED";
  else if (foundationReadiness === "NEEDS_WORK") posture = "FIX_DATA_FIRST";
  else if (criticalAnomaly) posture = "HOLD_AND_INVESTIGATE";
  else if (foundationReadiness === "READY_FOR_ADVANCED_ANALYSIS" && statisticalReadiness === "READY_FOR_ADVANCED_ANALYSIS" && regressionStrong && retentionReady && !weakRetentionBacktest) {
    posture = "READY_FOR_CONTROLLED_SCALE";
  } else {
    posture = "MAINTAIN_WITH_GUARDRAILS";
  }

  let confidence = 10;
  confidence += readinessScore(foundationReadiness);
  confidence += readinessScore(statisticalReadiness);
  confidence += regressionStrong ? 15 : 4;
  confidence += retentionReady ? 12 : 3;
  confidence += mmmReady ? 8 : mmmContextOnly ? 3 : 0;
  confidence -= criticalAnomaly ? 25 : 0;
  confidence -= weakRetentionBacktest ? 12 : 0;
  confidence = round(clamp(confidence));

  const primaryDecision = posture === "READY_FOR_CONTROLLED_SCALE"
    ? "Controlled scale is allowed if Profit First contribution, inventory, and cash guardrails still pass."
    : posture === "HOLD_AND_INVESTIGATE"
      ? "Hold budget increases until critical projection anomalies are explained."
      : posture === "MAINTAIN_WITH_GUARDRAILS"
        ? "Maintain current spend posture and use statistical outputs only as supporting context."
        : "Fix readiness blockers before making statistical budget decisions.";

  return {
    engine_version: "data_analyst_decision_brief_v1",
    generated_at: generatedAt,
    posture,
    confidence_score: confidence,
    primary_decision: primaryDecision,
    actions,
    guardrails,
    risks,
    model_card: {
      purpose: "Translate Data Analyst Foundation and Statistical Analyst outputs into operational AM/media-buying decisions.",
      inputs: [
        "latest data_analyst_foundation model_run",
        "latest data_analyst_statistical_upgrade model_run",
      ],
      assumptions: [
        "Statistical outputs are batch-generated and saved to model_runs",
        "MMM incrementality is advisory context for reviewed channel allocation",
        "Deterministic Profit First guardrails remain the source of truth for spend approvals",
        "Critical P&L anomalies must be explained before budget increases",
      ],
      limitations: [
        "This brief does not execute new statistical tests",
        "This brief does not treat lightweight MMM as causal proof",
        "This brief does not approve spend without Profit First contribution, cash, inventory, and funnel checks",
        "Missing foundation or statistical runs reduce confidence and block advanced recommendations",
      ],
    },
    summary: `${posture} - confidence ${confidence}/100 - ${actions.length} action(s), ${guardrails.length} guardrail(s).`,
  };
}
