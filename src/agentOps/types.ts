// TDIA backend response models (source: live probes of api.tdiaconnect.ca).

export type RunStatus = "queued" | "running" | "completed" | "failed" | string;
export type SupervisorDecision = "PASS" | "RETRY" | "HUMAN_REVIEW" | "FAIL" | "PENDING" | string;

export interface Client {
  id: string;
  name: string;
  website?: string | null;
  vertical?: string | null;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  client_id: string;
  status: RunStatus;
  progress?: number | null;
  test_mode?: string | null;
  workflow?: string | null;
  mode?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface EngineRun {
  id: string;
  workflow_run_id: string;
  name: string;
  status: RunStatus;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AgentRun {
  id: string;
  workflow_run_id: string;
  engine_run_id: string;
  agent_definition_id: string;
  supervisor_run_id?: string | null;
  attempt: number;
  status: RunStatus;
  progress?: number | null;
  input_artifacts: string[];
  output_artifacts: string[];
  safe_summary?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
}

export interface SupervisorRun {
  id: string;
  workflow_run_id: string;
  name: string;
  decision: SupervisorDecision;
  rubric_name?: string | null;
  score?: number | null;
  evidence: string[];
  skills: string[];
  attempt: number;
  target_stage?: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  workflow_run_id: string;
  agent_run_id?: string | null;
  kind: string;
  title: string;
  path?: string | null;
  media_type?: string | null;
  created_at: string;
}

export interface Source {
  id: string;
  workflow_run_id: string;
  url: string;
  title?: string | null;
  source_type?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface BenchmarkReport {
  run_id: string;
  overall_score: number;
  verdict: string;
  supervisors: SupervisorRun[];
}

export interface RunEvent {
  id: number;
  workflow_run_id: string;
  event_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  mission: string;
  engine: string;
  type: string;
  skills: string[];
  model_provider?: string | null;
  model_name?: string | null;
  expected_inputs: string[];
  expected_outputs: string[];
  display_order: number;
}

export interface SupervisorDefinition {
  name: string;
  rubric: string;
}

export interface Incident {
  id: string;
  workflow_run_id?: string | null;
  incident_type: string;
  severity: string;
  sanitized_diagnosis: string;
  status: string;
  created_at: string;
}

export interface Remediation {
  id: string;
  incident_record_id: string;
  level: number;
  action: string;
  worktree_path?: string | null;
  diff_path?: string | null;
  report_path?: string | null;
  tests_passed?: boolean | null;
  merged?: boolean | null;
  deployed?: boolean | null;
  created_at: string;
}

export interface HumanReview {
  id: string;
  workflow_run_id: string;
  status: string;
  reason?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export const ENGINE_ORDER = [
  "website_audit",
  "competitor_intelligence",
  "market_research",
  "offer_positioning",
  "creative_strategy",
  "strategic_roadmap",
  "final_strategy_pack",
] as const;

export const ENGINE_LABELS: Record<string, string> = {
  website_audit: "Website Audit",
  competitor_intelligence: "Competitor Intelligence",
  market_research: "Market & Customer Research",
  offer_positioning: "Offer & Positioning",
  creative_strategy: "Creative Strategy",
  strategic_roadmap: "Strategic Roadmap & Kick-off",
  final_strategy_pack: "Final Strategy Pack",
};

export const ENGINE_HIGHLIGHT = new Set([
  "offer_positioning",
  "market_research",
  "creative_strategy",
  "final_strategy_pack",
]);

export const WORKFLOWS = [
  "full-prelaunch",
  "website-audit",
  "competitor-intelligence",
  "market-research",
  "offer-positioning",
  "creative-strategy",
  "strategic-roadmap",
  "final-strategy-pack",
] as const;
