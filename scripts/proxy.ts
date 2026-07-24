// Typed wrapper around the Lovable Cloud integrations-proxy edge function.
//
// The proxy carries the service_role key server-side (Lovable-managed), so
// this script only needs INTEGRATIONS_PROXY_TOKEN to authorize. That token
// is expected in .env (root) or .env.local — we look up both.
//
// CLI: npx tsx scripts/proxy.ts <action> "<sql or json payload>"
//   npx tsx scripts/proxy.ts db.query "select 1"
//   npx tsx scripts/proxy.ts db.exec  "alter table foo add column bar text"
//
// Library:
//   import { proxy, dbExec, dbQuery } from "./proxy";
//   await dbExec("create table ...");
//   const rows = await dbQuery<{ id: string }[]>("select id from gos_clients");

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROXY_URL =
  "https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/integrations-proxy";

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(resolve(path), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const [, k, rawV] = m;
      if (process.env[k]) continue; // don't overwrite an existing var
      let v = rawV.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch { /* file absent → ignore */ }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const TOKEN = process.env.INTEGRATIONS_PROXY_TOKEN;
if (!TOKEN) {
  console.error("Missing INTEGRATIONS_PROXY_TOKEN. Add it to .env or .env.local.");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Typed action surface
// -----------------------------------------------------------------------------

export type DbExecPayload = { sql: string };
export type DbQueryPayload = { sql: string };
export type SupabaseFilters = Record<string, unknown>;

export type ProxyRequest =
  | { action: "db.exec"; payload: DbExecPayload }
  | { action: "db.query"; payload: DbQueryPayload }
  | { action: "supabase.select"; payload: { table: string; select?: string; filters?: SupabaseFilters } }
  | { action: "supabase.insert"; payload: { table: string; values: unknown } }
  | { action: "supabase.update"; payload: { table: string; values: unknown; filters: SupabaseFilters } }
  | { action: "supabase.delete"; payload: { table: string; filters: SupabaseFilters } }
  | { action: "supabase.rpc"; payload: { fn: string; args?: unknown } }
  | { action: "resend.send"; payload: unknown }
  | { action: "resend.request"; payload: unknown }
  | { action: "slack.webhook"; payload: unknown }
  | { action: "slack.webhook.tracker"; payload: unknown }
  | { action: "slack.bot"; payload: unknown }
  | { action: "shopify.rest"; payload: unknown }
  | { action: "gateway"; payload: unknown };

export async function proxy<T = unknown>(req: ProxyRequest): Promise<T> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Token": TOKEN!,
    },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Proxy ${req.action} failed (${res.status}): ${text}`);
  }
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

// Shortcuts for the two DB actions we use most (migrations + probes).
export const dbExec = (sql: string) => proxy<{ ok: true }>({ action: "db.exec", payload: { sql } });
export const dbQuery = <T = unknown>(sql: string) => proxy<T>({ action: "db.query", payload: { sql } });

// -----------------------------------------------------------------------------
// CLI mode: `npx tsx scripts/proxy.ts <action> "<sql or JSON payload>"`
// -----------------------------------------------------------------------------

// Platform-safe "is this file being executed directly as a script?" check.
// Handles Windows (file:///C:/...) vs POSIX (file:///path) URL differences.
const isCli = (() => {
  try { return fileURLToPath(import.meta.url) === process.argv[1]; }
  catch { return false; }
})();
if (isCli) {
  const [, , action, ...rest] = process.argv;
  const arg = rest.join(" ").trim();
  if (!action) {
    console.error('Usage: tsx scripts/proxy.ts <action> "<sql or JSON payload>"');
    console.error('Examples:');
    console.error('  tsx scripts/proxy.ts db.query "select 1"');
    console.error('  tsx scripts/proxy.ts db.exec  "alter table x add column y text"');
    process.exit(1);
  }

  // For db.exec/db.query the arg is raw SQL. For anything else it's JSON.
  let payload: unknown;
  if (action === "db.exec" || action === "db.query") {
    payload = { sql: arg };
  } else {
    try { payload = arg ? JSON.parse(arg) : {}; }
    catch (e) { console.error("Invalid JSON payload:", (e as Error).message); process.exit(1); }
  }

  proxy({ action: action as ProxyRequest["action"], payload } as ProxyRequest)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
