// Standalone check: parses the two sample Meta Ads CSVs and prints the
// detected platform, currency, mapping, and aggregate.
import { readFileSync } from "node:fs";
import Papa from "papaparse";

const files = [
  "Go-Coconut-Campagnes-21-Jun-2026-20-Jul-2026.csv",
  "Gutsy---Compte-Pu-licitaire-Campagnes-21-Jun-2026-20-Jul-2026.csv",
];

const HINTS = {
  date_start: ["début du rapport"],
  date_end:   ["compte-rendu terminé"],
  campaign:   ["nom de la campagne"],
  spend:      ["montant dépensé"],
  impressions:["impressions"],
  reach:      ["portée"],
  purchases:  ["achats"],
  roas:       ["roas des achats"],
};

function autoMap(headers, hints) {
  const H = headers.map((h) => h.toLowerCase());
  const out = {};
  for (const [field, cands] of Object.entries(hints)) {
    for (const c of cands) {
      const idx = H.findIndex((h) => h.includes(c));
      if (idx >= 0) { out[field] = headers[idx]; break; }
    }
  }
  return out;
}

function num(s) {
  if (!s || s === "-") return 0;
  const cleaned = String(s).replace(/\s/g, "").replace(/[^\d,.\-]/g, "");
  const cd = cleaned.lastIndexOf(",");
  const dd = cleaned.lastIndexOf(".");
  const norm = cd > dd ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
}

for (const f of files) {
  const csv = readFileSync(f, "utf8");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (parsed.meta.fields ?? []).map((h) => h.trim());
  const mapping = autoMap(headers, HINTS);
  const currencyMatch = headers.find((h) => /\(([A-Z]{3})\)/.test(h))?.match(/\(([A-Z]{3})\)/);
  const currency = currencyMatch ? currencyMatch[1] : null;

  const rows = parsed.data.filter((r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== ""));
  const canonical = rows.map((r) => {
    const spend = num(r[mapping.spend]);
    const roas = num(r[mapping.roas]);
    return {
      campaign:   r[mapping.campaign],
      spend, roas,
      revenue:    spend * roas,
      purchases:  num(r[mapping.purchases]),
      impressions:num(r[mapping.impressions]),
    };
  });
  const spend = canonical.reduce((a, b) => a + b.spend, 0);
  const rev   = canonical.reduce((a, b) => a + b.revenue, 0);
  const orders= canonical.reduce((a, b) => a + b.purchases, 0);
  const active = canonical.filter((r) => r.spend > 0).length;

  console.log("\n=== " + f + " ===");
  console.log("headers:", headers.length, "cols");
  console.log("currency:", currency);
  console.log("mapping:", mapping);
  console.log("rows:", rows.length, "| active(spend>0):", active);
  console.log("Σ spend:", spend.toFixed(2), currency, "| Σ revenue:", rev.toFixed(2), "| Σ purchases:", orders);
  console.log("ROAS agrégé:", spend > 0 ? (rev / spend).toFixed(2) : "n/a");
}
