// Centralized TDIA API client — talks ONLY to the `tdia-proxy` edge function,
// which forwards to the tdia-audit FastAPI with a server-side bearer token.

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

/** Build an absolute URL to a binary proxy endpoint (Excel downloads). */
export function proxyUrl(path: string, extraQuery?: Record<string, string>): string {
  const params = new URLSearchParams({ path });
  if (extraQuery) for (const [k, v] of Object.entries(extraQuery)) params.set(k, v);
  return `${PROXY_BASE}?${params.toString()}`;
}
