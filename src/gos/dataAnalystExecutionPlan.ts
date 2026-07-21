import type {
  DataAnalystDecisionBriefOutput,
  DecisionBriefAction,
  DecisionBriefGuardrail,
  DecisionBriefOwner,
  DecisionBriefPosture,
  DecisionBriefPriority,
} from "./dataAnalystDecisionBrief";

export type ExecutionPlanStatus = "blocked" | "ready" | "watch";
export type ExecutionPlanPhase = "triage" | "analysis" | "execution" | "validation";
export type ClashCodeConfirmStage = "clash" | "code" | "confirm";

export type AnalystExecutionWorkItem = {
  id: string;
  source_action_id: string | null;
  priority: DecisionBriefPriority;
  owner: DecisionBriefOwner;
  phase: ExecutionPlanPhase;
  status: ExecutionPlanStatus;
  due_date: string;
  task: string;
  acceptance_criteria: string[];
  evidence: string;
};

export type AnalystClashCodeConfirmStep = {
  id: string;
  work_item_id: string;
  sequence: number;
  stage: ClashCodeConfirmStage;
  owner: DecisionBriefOwner;
  status: ExecutionPlanStatus;
  instruction: string;
  required_evidence: string[];
  failure_mode: string;
  completion_signal: string;
};

export type AnalystExecutionGuardrailMonitor = {
  id: string;
  source_guardrail_id: string;
  label: string;
  status: DecisionBriefGuardrail["status"];
  check_frequency: "daily" | "weekly" | "before_budget_change";
  escalation_rule: string;
  validation_metric: string;
};

export type DataAnalystExecutionPlanInput = {
  brief?: DataAnalystDecisionBriefOutput | null;
  generatedAt?: string;
};

export type DataAnalystExecutionPlanOutput = {
  engine_version: "data_analyst_execution_plan_v1";
  generated_at: string;
  source_brief_generated_at: string | null;
  posture: DecisionBriefPosture | "NO_BRIEF";
  operating_mode: "blocked" | "investigation" | "guardrailed_execution" | "controlled_scale";
  work_items: AnalystExecutionWorkItem[];
  clash_code_confirm: AnalystClashCodeConfirmStep[];
  guardrail_monitors: AnalystExecutionGuardrailMonitor[];
  validation_checklist: string[];
  risks: string[];
  summary: string;
};

const DAY_MS = 86_400_000;

function isoDatePlusDays(baseIso: string, days: number): string {
  const base = new Date(baseIso);
  const time = Number.isFinite(base.getTime()) ? base.getTime() : Date.now();
  return new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

function dueDays(priority: DecisionBriefPriority): number {
  if (priority === "P0") return 1;
  if (priority === "P1") return 3;
  return 7;
}

function phaseForAction(action: DecisionBriefAction): ExecutionPlanPhase {
  if (action.area === "data") return "triage";
  if (action.area === "retention" || action.area === "spend" || action.area === "incrementality") return "analysis";
  if (action.area === "pnl" || action.area === "forecast") return "validation";
  return "execution";
}

function statusForAction(action: DecisionBriefAction, posture: DecisionBriefPosture): ExecutionPlanStatus {
  if (posture === "BLOCKED" || posture === "FIX_DATA_FIRST") return action.priority === "P0" ? "ready" : "blocked";
  if (posture === "HOLD_AND_INVESTIGATE") return action.priority === "P0" ? "ready" : "watch";
  return "ready";
}

function operatingMode(posture: DecisionBriefPosture | "NO_BRIEF"): DataAnalystExecutionPlanOutput["operating_mode"] {
  if (posture === "READY_FOR_CONTROLLED_SCALE") return "controlled_scale";
  if (posture === "MAINTAIN_WITH_GUARDRAILS") return "guardrailed_execution";
  if (posture === "HOLD_AND_INVESTIGATE") return "investigation";
  return "blocked";
}

function monitorFrequency(status: DecisionBriefGuardrail["status"]): AnalystExecutionGuardrailMonitor["check_frequency"] {
  if (status === "blocked") return "daily";
  if (status === "watch") return "weekly";
  return "before_budget_change";
}

function workItemFromAction(
  action: DecisionBriefAction,
  posture: DecisionBriefPosture,
  generatedAt: string,
): AnalystExecutionWorkItem {
  return {
    id: `work_${action.id}`,
    source_action_id: action.id,
    priority: action.priority,
    owner: action.owner,
    phase: phaseForAction(action),
    status: statusForAction(action, posture),
    due_date: isoDatePlusDays(generatedAt, dueDays(action.priority)),
    task: action.action,
    acceptance_criteria: [
      "Evidence is attached or summarized in the account notes.",
      "Owner has recorded the decision or next action.",
      action.priority === "P0" ? "Escalation is complete before the next budget change." : "Follow-up date is set.",
    ],
    evidence: action.evidence,
  };
}

function clashInstruction(item: AnalystExecutionWorkItem): string {
  return `Challenge the work item before execution: identify what source data, model output, or business context would make "${item.task}" wrong or unsafe.`;
}

function codeInstruction(item: AnalystExecutionWorkItem): string {
  return `Code the decision into the operating system: record the chosen action, owner, due date, and guardrail impact for "${item.task}" in the client notes or saved workflow output.`;
}

function confirmInstruction(item: AnalystExecutionWorkItem): string {
  return `Confirm the result before marking the work item complete or using it in a budget decision: verify evidence, owner sign-off, and next review date for "${item.task}".`;
}

function clashCodeConfirmForWorkItem(item: AnalystExecutionWorkItem): AnalystClashCodeConfirmStep[] {
  return [
    {
      id: `${item.id}_clash`,
      work_item_id: item.id,
      sequence: 1,
      stage: "clash",
      owner: item.owner,
      status: item.status,
      instruction: clashInstruction(item),
      required_evidence: [
        item.evidence,
        "Latest source run/date is named.",
        "Contradictory P&L, cohort, spend, or campaign signal is either ruled out or escalated.",
      ],
      failure_mode: "The team executes an action from stale, contradicted, or incomplete evidence.",
      completion_signal: "Contradictions are documented as resolved, accepted, or escalated.",
    },
    {
      id: `${item.id}_code`,
      work_item_id: item.id,
      sequence: 2,
      stage: "code",
      owner: item.owner,
      status: item.status,
      instruction: codeInstruction(item),
      required_evidence: [
        `Owner: ${item.owner}.`,
        `Due date: ${item.due_date}.`,
        `Phase: ${item.phase}.`,
      ],
      failure_mode: "The decision remains verbal and cannot be audited or resumed by another operator.",
      completion_signal: "Decision, owner, due date, and follow-up are written into the operating record.",
    },
    {
      id: `${item.id}_confirm`,
      work_item_id: item.id,
      sequence: 3,
      stage: "confirm",
      owner: item.owner,
      status: item.status,
      instruction: confirmInstruction(item),
      required_evidence: item.acceptance_criteria,
      failure_mode: "The work item is treated as complete without evidence or sign-off.",
      completion_signal: item.priority === "P0"
        ? "P0 confirmation is complete before any material budget change."
        : "Confirmation is complete before the next planned review or dependent action.",
    },
  ];
}

function monitorFromGuardrail(guardrail: DecisionBriefGuardrail): AnalystExecutionGuardrailMonitor {
  return {
    id: `monitor_${guardrail.id}`,
    source_guardrail_id: guardrail.id,
    label: guardrail.label,
    status: guardrail.status,
    check_frequency: monitorFrequency(guardrail.status),
    escalation_rule: guardrail.status === "blocked"
      ? "Escalate to AM lead before any budget increase."
      : guardrail.status === "watch"
        ? "Review in the next optimization meeting before changing the plan."
        : "Check before the next material budget change.",
    validation_metric: guardrail.evidence,
  };
}

export function buildDataAnalystExecutionPlan(
  input: DataAnalystExecutionPlanInput,
): DataAnalystExecutionPlanOutput {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const brief = input.brief ?? null;

  if (!brief) {
    const workItem: AnalystExecutionWorkItem = {
      id: "work_generate_decision_brief",
      source_action_id: null,
      priority: "P0",
      owner: "AM",
      phase: "triage",
      status: "ready",
      due_date: isoDatePlusDays(generatedAt, 1),
      task: "Generate an Analyst Decision Brief before creating an execution plan.",
      acceptance_criteria: [
        "Latest Foundation run is available.",
        "Latest Statistical run is available when applicable.",
        "Decision Brief is saved to model_runs.",
      ],
      evidence: "No data_analyst_decision_brief run is available.",
    };
    return {
      engine_version: "data_analyst_execution_plan_v1",
      generated_at: generatedAt,
      source_brief_generated_at: null,
      posture: "NO_BRIEF",
      operating_mode: "blocked",
      work_items: [workItem],
      clash_code_confirm: clashCodeConfirmForWorkItem(workItem),
      guardrail_monitors: [],
      validation_checklist: ["Generate and save a decision brief."],
      risks: ["No execution plan can be trusted without a decision brief."],
      summary: "NO_BRIEF - 1 work item, 0 guardrail monitors.",
    };
  }

  const workItems = brief.actions.map((action) => workItemFromAction(action, brief.posture, generatedAt));
  const guardrailMonitors = brief.guardrails.map(monitorFromGuardrail);

  if (brief.posture === "READY_FOR_CONTROLLED_SCALE") {
    workItems.push({
      id: "work_controlled_scale_review",
      source_action_id: null,
      priority: "P1",
      owner: "MEDIA_BUYER",
      phase: "execution",
      status: "ready",
      due_date: isoDatePlusDays(generatedAt, 3),
      task: "Prepare controlled scale proposal with Profit First guardrails attached.",
      acceptance_criteria: [
        "Spend frontier still supports the proposed budget.",
        "Contribution, cash, inventory, and funnel constraints are checked.",
        "AM has approved the scale amount and fallback threshold.",
      ],
      evidence: brief.primary_decision,
    });
  }

  const clashCodeConfirm = workItems.flatMap(clashCodeConfirmForWorkItem);

  const validationChecklist = [
    "Every active work item completes clash-code-confirm before it is treated as done.",
    "Foundation readiness is reviewed before using statistical recommendations.",
    "Critical P&L anomalies are resolved or explicitly accepted.",
    "Retention/LTV guardrail status is checked before expanding CAC limits.",
    "Spend regression is used only beside deterministic spend frontier and Profit First constraints.",
    "Next AM review date is set after work items are completed.",
  ];

  const risks = [
    ...(brief.risks ?? []),
    ...(brief.posture === "READY_FOR_CONTROLLED_SCALE"
      ? ["Controlled scale still requires Profit First contribution, cash, inventory, and funnel checks."]
      : []),
  ];

  return {
    engine_version: "data_analyst_execution_plan_v1",
    generated_at: generatedAt,
    source_brief_generated_at: brief.generated_at,
    posture: brief.posture,
    operating_mode: operatingMode(brief.posture),
    work_items: workItems,
    clash_code_confirm: clashCodeConfirm,
    guardrail_monitors: guardrailMonitors,
    validation_checklist: validationChecklist,
    risks,
    summary: `${brief.posture} - ${workItems.length} work item(s), ${guardrailMonitors.length} guardrail monitor(s).`,
  };
}
