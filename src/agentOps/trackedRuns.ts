// Tracks run IDs locally since the backend has no "list all runs" endpoint.
import { sanitizeRunId } from "./runId";

const KEY = "tdia.tracked_runs";

export function getTrackedRuns(): string[] {
  try {
    const cleaned = (JSON.parse(localStorage.getItem(KEY) || "[]") as unknown[])
      .map(sanitizeRunId)
      .filter(Boolean);
    localStorage.setItem(KEY, JSON.stringify(cleaned.slice(0, 25)));
    return cleaned;
  } catch {
    return [];
  }
}

export function trackRun(id: string) {
  const cleanId = sanitizeRunId(id);
  if (!cleanId) return;
  const cur = getTrackedRuns().filter(x => x !== cleanId);
  cur.unshift(cleanId);
  localStorage.setItem(KEY, JSON.stringify(cur.slice(0, 25)));
}

export function untrackRun(id: string) {
  const cleanId = sanitizeRunId(id);
  localStorage.setItem(KEY, JSON.stringify(getTrackedRuns().filter(x => x !== cleanId)));
}
