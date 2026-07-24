// One-shot helper to apply a single migration file via the proxy.
// Usage: npx tsx scripts/apply-migration.ts <path-to-sql>

import { readFileSync } from "node:fs";
import { dbExec } from "./proxy";

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx scripts/apply-migration.ts <path-to-sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
console.log(`Applying ${file} (${sql.length} chars)…`);

dbExec(sql)
  .then((res) => {
    console.log("OK:", JSON.stringify(res, null, 2));
  })
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exit(1);
  });
