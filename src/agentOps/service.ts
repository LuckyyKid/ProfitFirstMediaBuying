// Real TDIA service layer — calls the `tdia-proxy` edge function, which forwards
// authenticated requests to https://api.tdiaconnect.ca. NO MOCK FALLBACK.

import { apiGet, apiPost, proxyUrl } from "./api";
import { pickRunId } from "./runId";
import type {
  AgentDefinition,
  AgentRun,
  Artifact,
  BenchmarkReport,
  Client,
  EngineRun,
  HumanReview,
  Incident,
  Remediation,
  RunEvent,
  Source,
  SupervisorDefinition,
  SupervisorRun,
  WorkflowRun,
} from "./types";

type WorkflowRunResponse = WorkflowRun & {
  run_id?: string | null;
  workflow_run_id?: string | null;
};

function normalizeWorkflowRun(run: WorkflowRunResponse): WorkflowRun {
  return {
    ...run,
    id: pickRunId(run),
  };
}

export const tdia = {
  health: () => apiGet<{ status: string; redis?: boolean; artifact_root?: string }>("/api/v1/health"),

  // Clients
  listClients: () => apiGet<Client[]>("/api/clients"),
  createClient: (input: Partial<Client> & Record<string, unknown>) =>
    apiPost<Client>("/api/clients", input),
  // Backend has no GET endpoint to list runs per client (only POST to create).
  // Return [] so UIs degrade gracefully; open a specific run by ID instead.
  listClientRuns: (_clientId: string) => Promise.resolve([] as WorkflowRun[]),
  createRun: (clientId: string, body: { workflow?: string; mode?: string; test_mode?: string }) =>
    apiPost<WorkflowRunResponse>(`/api/v1/clients/${encodeURIComponent(clientId)}/runs`, body).then(normalizeWorkflowRun),

  // Runs
  getRun: (id: string) => apiGet<WorkflowRunResponse>(`/api/v1/runs/${id}`).then(normalizeWorkflowRun),
  listEngines: (runId: string) => apiGet<EngineRun[]>(`/api/v1/runs/${runId}/engines`),
  listAgents: (runId: string) => apiGet<AgentRun[]>(`/api/v1/runs/${runId}/agents`),
  listSupervisors: (runId: string) => apiGet<SupervisorRun[]>(`/api/v1/runs/${runId}/supervisors`),
  listArtifacts: (runId: string) => apiGet<Artifact[]>(`/api/v1/runs/${runId}/artifacts`),
  listSources: (runId: string) => apiGet<Source[]>(`/api/v1/runs/${runId}/sources`),
  getBenchmark: (runId: string) => apiGet<BenchmarkReport>(`/api/v1/runs/${runId}/benchmark`),
  listEvents: (runId: string) => apiGet<RunEvent[]>(`/api/v1/runs/${runId}/events`),
  listReviews: (runId: string) => apiGet<HumanReview[]>(`/api/runs/${runId}/reviews`),

  // Catalog
  listAgentDefinitions: () => apiGet<AgentDefinition[]>("/api/agents"),
  listSupervisorDefinitions: () => apiGet<SupervisorDefinition[]>("/api/supervisors"),

  // Ops
  listIncidents: () => apiGet<Incident[]>("/api/incidents"),
  listRemediations: () => apiGet<Remediation[]>("/api/remediations"),

  // Artifacts (single)
  getArtifactContent: (artifactId: string) =>
    apiGet<unknown>(`/api/artifacts/${artifactId}`),
  artifactDownloadUrl: (artifactId: string) =>
    proxyUrl(`/api/artifacts/${artifactId}/download`),

  // PDF
  finalPdfUrl: (runId: string) => proxyUrl(`/api/v1/runs/${runId}/final-pdf`),
};

export type TdiaService = typeof tdia;
