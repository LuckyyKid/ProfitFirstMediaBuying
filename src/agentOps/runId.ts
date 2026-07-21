export function sanitizeRunId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  return id && id !== "undefined" && id !== "null" ? id : "";
}

export function pickRunId(value: { id?: unknown; run_id?: unknown; workflow_run_id?: unknown } | null | undefined): string {
  if (!value) return "";
  return sanitizeRunId(value.run_id) || sanitizeRunId(value.workflow_run_id) || sanitizeRunId(value.id);
}