// src/gos/uploads/adPlatformParser.ts
//
// Parses a CSV/XLSX export from Meta Ads, Google Ads or GA4 and maps the
// raw rows to a canonical shape the app can aggregate into a measurement
// snapshot. Auto-detects the platform from the header names, tolerates
// mixed-case and multilingual (FR/EN) column labels, and never mutates
// the original data — the user can override any field mapping in the UI.

import Papa from "papaparse";
import * as XLSX from "xlsx";

export type Platform = "meta_ads" | "google_ads" | "ga4";

export type CanonicalField =
  | "date_start"
  | "date_end"
  | "campaign"
  | "spend"
  | "impressions"
  | "reach"
  | "clicks"
  | "purchases"
  | "revenue"
  | "roas"
  | "sessions"
  | "users";

export type ParseResult = {
  platform: Platform | null;
  currency: string | null;   // "CAD" | "EUR" | "USD" | null
  headers: string[];
  rows: Record<string, string>[];
  mapping: Partial<Record<CanonicalField, string>>;
  filename: string;
};

export type CanonicalRow = {
  date_start: string | null;
  date_end: string | null;
  campaign: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  revenue: number;   // computed as spend * roas when missing
  roas: number | null;
};

// Header hints per platform. Case-insensitive substring match on the raw
// header. First match wins.
const HEADER_HINTS: Record<Platform, Partial<Record<CanonicalField, string[]>>> = {
  meta_ads: {
    date_start:  ["début du rapport", "reporting starts", "date start"],
    date_end:    ["compte-rendu terminé", "reporting ends", "date end"],
    campaign:    ["nom de la campagne", "campaign name"],
    spend:       ["montant dépensé", "amount spent"],
    impressions: ["impressions"],
    reach:       ["portée", "reach"],
    clicks:      ["clics sur le lien", "link clicks", "clics"],
    purchases:   ["achats", "purchases", "résultats"],
    revenue:     ["valeur de conversion", "purchase conversion value", "purchases conversion value"],
    roas:        ["roas des achats", "purchase roas", "roas"],
  },
  google_ads: {
    date_start:  ["day", "date", "jour"],
    campaign:    ["campaign", "campagne"],
    spend:       ["cost", "coût"],
    impressions: ["impr", "impressions"],
    clicks:      ["clicks", "clics"],
    purchases:   ["conversions"],
    revenue:     ["conv. value", "conversions value", "valeur de conv"],
  },
  ga4: {
    date_start:  ["date", "day"],
    sessions:    ["sessions"],
    users:       ["total users", "users", "utilisateurs"],
    purchases:   ["ecommerce purchases", "purchases", "transactions"],
    revenue:     ["total revenue", "purchase revenue", "revenu"],
  },
};

// Currency detection: matches "(CAD)" / "[EUR]" / trailing "USD" inside a header.
const CURRENCY_RE = /[([\s]([A-Z]{3})[)\]\s]?$/;

// ---- Public API ------------------------------------------------------------

export async function parseAdFile(file: File): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const isCsv = ext === "csv" || ext === "tsv";
  const raw = isCsv ? await readAsCsv(file) : await readAsXlsx(file);
  const headers = raw.headers.map((h) => h.trim());
  const platform = detectPlatform(headers);
  const currency = detectCurrency(headers);
  const mapping = platform ? autoMap(headers, HEADER_HINTS[platform]) : {};
  return {
    platform,
    currency,
    headers,
    rows: raw.rows,
    mapping,
    filename: file.name,
  };
}

export function detectPlatform(headers: string[]): Platform | null {
  const H = headers.map((h) => h.toLowerCase());
  const has = (needle: string) => H.some((h) => h.includes(needle));

  // Meta Ads: FR export has "nom de la campagne" + "montant dépensé" + "roas des achats"
  if (has("nom de la campagne") && has("montant dépensé")) return "meta_ads";
  if (has("campaign name") && has("amount spent")) return "meta_ads";

  // Google Ads: "cost" or "coût" + "impr" + no "montant dépensé"
  if ((has("cost") || has("coût")) && has("impr") && (has("campaign") || has("campagne"))) return "google_ads";

  // GA4: has "sessions" or "purchase revenue" without campaign columns
  if (has("sessions") && (has("purchase revenue") || has("ecommerce purchases") || has("transactions"))) return "ga4";

  return null;
}

export function detectCurrency(headers: string[]): string | null {
  for (const h of headers) {
    const m = h.match(CURRENCY_RE);
    if (m) return m[1];
  }
  return null;
}

export function autoMap(
  headers: string[],
  hints: Partial<Record<CanonicalField, string[]>>,
): Partial<Record<CanonicalField, string>> {
  const out: Partial<Record<CanonicalField, string>> = {};
  const H = headers.map((h) => h.toLowerCase());
  for (const [field, candidates] of Object.entries(hints) as [CanonicalField, string[]][]) {
    for (const c of candidates) {
      const idx = H.findIndex((h) => h.includes(c));
      if (idx >= 0) {
        out[field] = headers[idx];
        break;
      }
    }
  }
  return out;
}

export function toCanonicalRows(
  rows: Record<string, string>[],
  mapping: Partial<Record<CanonicalField, string>>,
): CanonicalRow[] {
  return rows.map((r) => {
    const get = (field: CanonicalField): string => {
      const col = mapping[field];
      if (!col) return "";
      return (r[col] ?? "").toString().trim();
    };
    const spend = num(get("spend"));
    const roasRaw = get("roas");
    const roas = roasRaw === "" || roasRaw === "-" ? null : num(roasRaw);
    const revenueDirect = num(get("revenue"));
    const revenue = revenueDirect > 0 ? revenueDirect : (roas != null ? spend * roas : 0);
    return {
      date_start:  get("date_start") || null,
      date_end:    get("date_end") || null,
      campaign:    get("campaign") || null,
      spend,
      impressions: num(get("impressions")),
      reach:       num(get("reach")),
      clicks:      num(get("clicks")),
      purchases:   num(get("purchases")),
      revenue,
      roas,
    };
  });
}

export type Aggregate = {
  period_start: string | null;
  period_end: string | null;
  currency: string | null;
  campaigns_count: number;
  active_count: number;
  actual_ad_spend: number;
  actual_revenue: number;
  actual_orders: number;
  actual_impressions: number;
  actual_clicks: number;
  actual_reach: number;
  actual_roas: number | null;
  actual_mer: number | null;
};

export function aggregate(rows: CanonicalRow[], currency: string | null): Aggregate {
  const active = rows.filter((r) => r.spend > 0 || r.impressions > 0);
  const spend  = sum(rows.map((r) => r.spend));
  const rev    = sum(rows.map((r) => r.revenue));
  const orders = sum(rows.map((r) => r.purchases));
  const impr   = sum(rows.map((r) => r.impressions));
  const clicks = sum(rows.map((r) => r.clicks));
  const reach  = sum(rows.map((r) => r.reach));
  return {
    period_start:      firstDefined(rows.map((r) => r.date_start)),
    period_end:        firstDefined(rows.map((r) => r.date_end)),
    currency,
    campaigns_count:   rows.length,
    active_count:      active.length,
    actual_ad_spend:   round2(spend),
    actual_revenue:    round2(rev),
    actual_orders:     orders,
    actual_impressions: impr,
    actual_clicks:     clicks,
    actual_reach:      reach,
    actual_roas:       spend > 0 ? round2(rev / spend) : null,
    actual_mer:        spend > 0 ? round2(rev / spend) : null,
  };
}

// ---- File readers ----------------------------------------------------------

function readAsCsv(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve({
        headers: (res.meta.fields ?? []).map((h) => h.trim()),
        rows: res.data.filter((r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== "")),
      }),
      error: (err) => reject(err),
    });
  });
}

async function readAsXlsx(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const headers = rows.length > 0 ? Object.keys(rows[0]).map((h) => h.trim()) : [];
  const stringRows = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(r)) out[k.trim()] = (r[k] ?? "").toString();
    return out;
  });
  return { headers, rows: stringRows };
}

// ---- Number helpers --------------------------------------------------------

function num(s: string): number {
  if (!s || s === "-") return 0;
  const cleaned = s.replace(/\s/g, "").replace(/[^\d,.\-]/g, "");
  const dotDecimal = cleaned.lastIndexOf(".");
  const commaDecimal = cleaned.lastIndexOf(",");
  let normalized: string;
  if (commaDecimal > dotDecimal) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function sum(xs: number[]): number { return xs.reduce((a, b) => a + b, 0); }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function firstDefined<T>(xs: (T | null)[]): T | null {
  for (const x of xs) if (x != null && x !== "") return x;
  return null;
}
