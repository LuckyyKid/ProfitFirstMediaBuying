// Centralized TDIA API client — talks ONLY to the `tdia-proxy` edge function,
// which forwards to https://api.tdiaconnect.ca with a server-side bearer token.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const PROXY_BASE = `${SUPABASE_URL}/functions/v1/tdia-proxy`;

export interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

export async function apiGet<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = `${PROXY_BASE}?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  return handle<T>(res);
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = `${PROXY_BASE}?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    const err: ApiError = new Error(
      typeof parsed === "object" && parsed && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : `Request failed (${res.status})`,
    );
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed as T;
}

/** Build an absolute URL to a binary / streaming proxy endpoint (PDF, SSE). */
export function proxyUrl(path: string, extraQuery?: Record<string, string>): string {
  const params = new URLSearchParams({ path });
  if (extraQuery) for (const [k, v] of Object.entries(extraQuery)) params.set(k, v);
  return `${PROXY_BASE}?${params.toString()}`;
}

/**
 * Subscribe to the SSE stream for a run. Returns a cleanup function.
 * Uses native EventSource (the edge function deploys with verify_jwt=false by default,
 * so no Authorization header is needed from the browser).
 */
export function subscribeRunEvents(
  runId: string,
  handlers: {
    onEvent: (ev: { type: string; data: unknown; id?: string }) => void;
    onOpen?: () => void;
    onError?: (err: Event) => void;
  },
  opts?: { lastEventId?: string },
): () => void {
  const path = `/api/v1/runs/${encodeURIComponent(runId)}/stream`;
  const extras: Record<string, string> = {};
  if (opts?.lastEventId) extras.last_event_id = opts.lastEventId;
  const url = proxyUrl(path, extras);
  const es = new EventSource(url);
  es.onopen = () => handlers.onOpen?.();
  es.onerror = (e) => handlers.onError?.(e);
  // Generic message handler
  es.onmessage = (msg) => {
    let data: unknown = msg.data;
    try { data = JSON.parse(msg.data); } catch { /* keep text */ }
    handlers.onEvent({ type: "message", data, id: msg.lastEventId });
  };
  // Named events — we don't know the full list ahead of time. Listen for the common ones.
  const KNOWN = [
    "workflow_queued","workflow_started","workflow_completed","workflow_failed",
    "engine_started","engine_completed","engine_failed",
    "agent_started","agent_progress","agent_completed","agent_failed",
    "source_collected","screenshot_created","artifact_created",
    "supervisor_started","supervisor_decision","benchmark_completed",
    "retry_requested","retry_started","retry_completed",
    "human_review_required","incident_detected","pdf_ready","heartbeat","ping",
  ];
  for (const name of KNOWN) {
    es.addEventListener(name, (ev: MessageEvent) => {
      let data: unknown = ev.data;
      try { data = JSON.parse(ev.data); } catch { /* keep text */ }
      handlers.onEvent({ type: name, data, id: ev.lastEventId });
    });
  }
  return () => es.close();
}
