// Sync src/integrations/supabase/types.ts from the Lovable-managed
// backend repo (tdiaonboarding-9049587d). Lovable regenerates types.ts
// on its side after every migration it applies; this script pulls the
// latest version so our frontend TypeScript picks up new columns/tables.
//
// Usage: npx tsx scripts/sync-types.ts
//
// Safe to run repeatedly — it only writes when the remote differs from
// the local file, and prints a diff-summary before writing.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW_URL =
  "https://raw.githubusercontent.com/LuckyyKid/tdiaonboarding-9049587d/main/src/integrations/supabase/types.ts";
const LOCAL = "src/integrations/supabase/types.ts";

async function main() {
  console.log(`Fetching ${RAW_URL}…`);
  const res = await fetch(RAW_URL, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) {
    throw new Error(`GitHub raw returned ${res.status} ${res.statusText}`);
  }
  const remote = await res.text();

  // Sanity check: the file should at least declare a Database type.
  if (!remote.includes("Database")) {
    throw new Error("Fetched file doesn't look like a Supabase types.ts (no 'Database' export). Aborting.");
  }

  let local = "";
  try { local = readFileSync(resolve(LOCAL), "utf8"); } catch { /* file may not exist yet */ }

  if (local === remote) {
    console.log(`No change — local ${LOCAL} is already in sync (${remote.length} chars).`);
    return;
  }

  const localLines = local.split(/\r?\n/).length;
  const remoteLines = remote.split(/\r?\n/).length;
  console.log(`Local:  ${localLines} lines, ${local.length} chars`);
  console.log(`Remote: ${remoteLines} lines, ${remote.length} chars`);
  console.log(`Diff:   ${remoteLines - localLines >= 0 ? "+" : ""}${remoteLines - localLines} lines`);

  writeFileSync(resolve(LOCAL), remote, "utf8");
  console.log(`Wrote ${LOCAL}. Run \`npx tsc --noEmit\` to verify nothing broke.`);
}

main().catch((e) => {
  console.error("sync-types failed:", e.message);
  process.exit(1);
});
