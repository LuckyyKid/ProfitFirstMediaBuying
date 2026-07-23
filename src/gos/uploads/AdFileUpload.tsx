// src/gos/uploads/AdFileUpload.tsx
//
// Modal to upload a Meta / Google Ads / GA4 CSV or XLSX export. The file is
// auto-parsed: platform + currency detected, columns mapped, aggregate
// computed. The user sees a preview and can override any mapping if a
// column got misread, then confirms → we upsert one row into
// gos_measurement_snapshots (JSON payload in `notes`, aggregates in the
// numeric columns).

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UploadCloud, FileText, X, Save } from "lucide-react";
import {
  aggregate,
  parseAdFile,
  toCanonicalRows,
  type CanonicalField,
  type ParseResult,
  type Platform,
} from "./adPlatformParser";

const PLATFORM_LABEL: Record<Platform, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
};

const FIELD_LABEL: Record<CanonicalField, string> = {
  date_start: "Date début",
  date_end: "Date fin",
  campaign: "Campagne",
  spend: "Dépense",
  impressions: "Impressions",
  reach: "Portée",
  clicks: "Clics",
  purchases: "Achats / conversions",
  revenue: "Revenu",
  roas: "ROAS",
  sessions: "Sessions",
  users: "Utilisateurs",
};

type Props = {
  clientId: string;
  expectedPlatform: Platform;   // provider card the user clicked from
  onClose: () => void;
  onDone: () => void;
};

export function AdFileUpload({ clientId, expectedPlatform, onClose, onDone }: Props) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const res = await parseAdFile(file);
      setParseResult(res);
      if (!res.platform) {
        toast.error("Format non reconnu. Ajuste le mapping des colonnes manuellement.");
      } else if (res.platform !== expectedPlatform) {
        toast.warning(`Détecté "${PLATFORM_LABEL[res.platform]}" mais tu importes dans "${PLATFORM_LABEL[expectedPlatform]}". Vérifie le mapping.`);
      } else {
        toast.success(`${PLATFORM_LABEL[res.platform]} · ${res.currency ?? "?"} · ${res.rows.length} lignes`);
      }
    } catch (err) {
      toast.error(`Lecture échouée : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [expectedPlatform]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const updateMapping = (field: CanonicalField, header: string) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      mapping: { ...parseResult.mapping, [field]: header || undefined },
    });
  };

  const overridePlatform = (platform: Platform) => {
    if (!parseResult) return;
    setParseResult({ ...parseResult, platform });
  };

  const canonical = useMemo(() => {
    if (!parseResult) return [];
    return toCanonicalRows(parseResult.rows, parseResult.mapping);
  }, [parseResult]);

  const agg = useMemo(() => {
    if (!parseResult) return null;
    return aggregate(canonical, parseResult.currency);
  }, [canonical, parseResult]);

  const doImport = async () => {
    if (!parseResult || !agg) return;
    const platform = parseResult.platform ?? expectedPlatform;
    const label = `${PLATFORM_LABEL[platform]} · ${formatPeriod(agg.period_start, agg.period_end)}`;
    const payload = {
      source: "file_upload",
      platform,
      filename: parseResult.filename,
      currency: parseResult.currency,
      mapping: parseResult.mapping,
      campaigns_count: agg.campaigns_count,
      active_count: agg.active_count,
      actual_impressions: agg.actual_impressions,
      actual_clicks: agg.actual_clicks,
      imported_at: new Date().toISOString(),
      rows: canonical.slice(0, 500),
    };

    setBusy(true);
    const { error } = await supabase.from("gos_measurement_snapshots").insert({
      client_id: clientId,
      period_label: label,
      period_start: agg.period_start,
      period_end: agg.period_end,
      actual_ad_spend: agg.actual_ad_spend,
      actual_revenue: agg.actual_revenue,
      actual_orders: agg.actual_orders,
      actual_roas: agg.actual_roas,
      actual_mer: agg.actual_mer,
      notes: JSON.stringify(payload),
    });

    let baselineSyncedTo: string | null = null;
    if (!error && platform === "meta_ads") {
      baselineSyncedTo = await syncMetaToBaseline(clientId, agg);
    }
    setBusy(false);

    if (error) {
      toast.error(`Import échoué : ${error.message}`);
      return;
    }
    const baselineNote = baselineSyncedTo ? ` · Baseline CRM mis à jour (${baselineSyncedTo})` : "";
    toast.success(`Import ${PLATFORM_LABEL[platform]} ✓ — ${agg.active_count}/${agg.campaigns_count} campagnes actives, ${agg.actual_ad_spend} ${parseResult.currency ?? ""}${baselineNote}`);
    onDone();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(6, 9, 16, 0.72)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "6vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 94vw)", maxHeight: "88vh", overflow: "auto",
          background: "linear-gradient(135deg, #0b1322, #080d18)",
          border: "1px solid rgba(148, 170, 215, 0.15)",
          borderRadius: 16,
          boxShadow: "0 40px 100px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px",
          borderBottom: "1px solid rgba(148, 170, 215, 0.12)",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#eef2fa" }}>
              Import fichier — {PLATFORM_LABEL[expectedPlatform]}
            </h3>
            <div style={{ fontSize: 12, color: "#8b97ad", marginTop: 3 }}>
              CSV ou XLSX. Détection automatique du format et de la devise.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid rgba(148, 170, 215, 0.15)",
              color: "#c8d2e4", borderRadius: 8, padding: "6px 10px", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
            }}
          >
            <X size={13} /> Fermer
          </button>
        </div>

        <div style={{ padding: 22 }}>
          {!parseResult ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                padding: "60px 24px", borderRadius: 14,
                border: `1px dashed ${dragOver ? "rgba(77,159,255,0.55)" : "rgba(148,170,215,0.25)"}`,
                background: dragOver
                  ? "linear-gradient(135deg, rgba(77,159,255,0.10), rgba(47,107,255,0.04))"
                  : "rgba(255,255,255,0.015)",
                cursor: "pointer", textAlign: "center", transition: "all 0.15s ease",
              }}
            >
              <UploadCloud size={32} style={{ color: "#9ec8ff" }} />
              <div style={{ color: "#eef2fa", fontSize: 14, fontWeight: 500 }}>
                Dépose un fichier <span style={{ color: "#9ec8ff" }}>CSV ou XLSX</span> ici
              </div>
              <div style={{ color: "#8b97ad", fontSize: 12 }}>
                ou clique pour parcourir
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
          ) : (
            <PreviewSection
              parseResult={parseResult}
              canonical={canonical}
              agg={agg!}
              expectedPlatform={expectedPlatform}
              onUpdateMapping={updateMapping}
              onOverridePlatform={overridePlatform}
              onReset={() => setParseResult(null)}
              onImport={doImport}
              busy={busy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function PreviewSection({
  parseResult, canonical, agg, expectedPlatform,
  onUpdateMapping, onOverridePlatform, onReset, onImport, busy,
}: {
  parseResult: ParseResult;
  canonical: ReturnType<typeof toCanonicalRows>;
  agg: ReturnType<typeof aggregate>;
  expectedPlatform: Platform;
  onUpdateMapping: (f: CanonicalField, h: string) => void;
  onOverridePlatform: (p: Platform) => void;
  onReset: () => void;
  onImport: () => void;
  busy: boolean;
}) {
  const platform = parseResult.platform ?? expectedPlatform;
  const relevantFields: CanonicalField[] = platform === "ga4"
    ? ["date_start", "sessions", "users", "purchases", "revenue"]
    : ["date_start", "date_end", "campaign", "spend", "impressions", "reach", "clicks", "purchases", "revenue", "roas"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Detected summary */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "12px 14px", borderRadius: 10,
        background: "linear-gradient(135deg, rgba(77,159,255,0.08), rgba(47,107,255,0.02))",
        border: "1px solid rgba(77,159,255,0.18)",
      }}>
        <FileText size={16} style={{ color: "#9ec8ff" }} />
        <span style={{ color: "#eef2fa", fontSize: 13, fontWeight: 600 }}>{parseResult.filename}</span>
        <span style={{ color: "#3a4358" }}>·</span>
        <span className="font-data" style={{ fontSize: 11, color: "#9ec8ff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {parseResult.platform ? PLATFORM_LABEL[parseResult.platform] : "Non détecté"}
        </span>
        <span style={{ color: "#3a4358" }}>·</span>
        <span className="font-data" style={{ fontSize: 11, color: "#c8d2e4" }}>
          {parseResult.currency ?? "?"}
        </span>
        <span style={{ color: "#3a4358" }}>·</span>
        <span style={{ color: "#c8d2e4", fontSize: 12 }}>
          {agg.campaigns_count} lignes · <strong style={{ color: "#3ddc97" }}>{agg.active_count}</strong> actives
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onReset}
          style={{
            background: "transparent", border: "1px solid rgba(148,170,215,0.15)",
            color: "#c8d2e4", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11,
          }}
        >
          Autre fichier
        </button>
      </div>

      {/* Aggregate KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Kpi label="Période" value={formatPeriod(agg.period_start, agg.period_end)} />
        <Kpi label="Dépense" value={fmtMoney(agg.actual_ad_spend, parseResult.currency)} tone="watch" />
        <Kpi label="Revenu" value={fmtMoney(agg.actual_revenue, parseResult.currency)} tone="good" />
        <Kpi label="Achats" value={String(agg.actual_orders)} />
        <Kpi label="ROAS" value={agg.actual_roas != null ? `${agg.actual_roas.toFixed(2)}×` : "—"} />
        <Kpi label="Impressions" value={fmtInt(agg.actual_impressions)} />
      </div>

      {/* Platform override if wrong */}
      {parseResult.platform !== expectedPlatform && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(245, 183, 78, 0.06)", border: "1px solid rgba(245, 183, 78, 0.28)",
          color: "#f5b74e", fontSize: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <span>Plateforme détectée différente. Forcer :</span>
          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => onOverridePlatform(p)}
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                border: platform === p ? "1px solid #f5b74e" : "1px solid rgba(245,183,78,0.28)",
                background: platform === p ? "rgba(245,183,78,0.14)" : "transparent",
                color: platform === p ? "#f5b74e" : "#c8d2e4",
              }}
            >
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
      )}

      {/* Editable mapping */}
      <div>
        <div className="microlabel" style={{ fontSize: 10, color: "#8b97ad", marginBottom: 8 }}>
          Correspondance des colonnes
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          {relevantFields.map((field) => (
            <MappingRow
              key={field}
              field={field}
              headers={parseResult.headers}
              value={parseResult.mapping[field] ?? ""}
              onChange={(h) => onUpdateMapping(field, h)}
            />
          ))}
        </div>
      </div>

      {/* Preview of first canonical rows */}
      <div>
        <div className="microlabel" style={{ fontSize: 10, color: "#8b97ad", marginBottom: 8 }}>
          Aperçu (10 premières lignes après mapping)
        </div>
        <div style={{
          borderRadius: 10, overflow: "auto", maxHeight: 260,
          border: "1px solid rgba(148,170,215,0.12)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Campagne", "Dépense", "Impressions", "Achats", "Revenu", "ROAS"].map((h) => (
                  <th key={h} style={{
                    padding: "8px 10px", textAlign: "left",
                    color: "#8b97ad", fontWeight: 600, fontSize: 10, letterSpacing: "0.04em",
                    textTransform: "uppercase", borderBottom: "1px solid rgba(148,170,215,0.12)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canonical.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td style={cellStyle}>{r.campaign ?? "—"}</td>
                  <td style={cellNum}>{r.spend.toFixed(2)}</td>
                  <td style={cellNum}>{fmtInt(r.impressions)}</td>
                  <td style={cellNum}>{r.purchases}</td>
                  <td style={cellNum}>{r.revenue.toFixed(2)}</td>
                  <td style={cellNum}>{r.roas != null ? r.roas.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          onClick={onImport}
          disabled={busy || agg.actual_ad_spend === 0}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10, cursor: busy || agg.actual_ad_spend === 0 ? "not-allowed" : "pointer",
            background: "linear-gradient(135deg, #4d9fff, #2f6bff)",
            border: "none", color: "#fff", fontWeight: 600, fontSize: 13,
            opacity: busy || agg.actual_ad_spend === 0 ? 0.5 : 1,
            boxShadow: "0 0 24px rgba(47,107,255,0.25)",
          }}
        >
          <Save size={14} /> {busy ? "Import…" : `Importer dans le client`}
        </button>
      </div>
    </div>
  );
}

function MappingRow({ field, headers, value, onChange }: {
  field: CanonicalField; headers: string[]; value: string; onChange: (h: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#8b97ad", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {FIELD_LABEL[field]}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "7px 10px", fontSize: 12,
          background: "rgba(255,255,255,0.02)", color: "#eef2fa",
          border: `1px solid ${value ? "rgba(77,159,255,0.22)" : "rgba(148,170,215,0.15)"}`,
          borderRadius: 8, outline: "none",
        }}
      >
        <option value="">— non mappé —</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "watch" }) {
  const color = tone === "good" ? "#3ddc97" : tone === "watch" ? "#f5b74e" : "#eef2fa";
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10,
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,170,215,0.12)",
    }}>
      <div style={{ fontSize: 9, color: "#8b97ad", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div className="font-data" style={{ fontSize: 15, color, fontWeight: 500, marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "6px 10px", color: "#c8d2e4",
  borderBottom: "1px solid rgba(148,170,215,0.06)",
  maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const cellNum: React.CSSProperties = { ...cellStyle, textAlign: "right", fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#eef2fa" };

// Meta CSV → CRM baseline sync. Uses shared client_code between gos_clients and crm_clients.
// Returns the crm_clients.id it updated, or null if no match / no data.
async function syncMetaToBaseline(gosClientId: string, agg: ReturnType<typeof aggregate>): Promise<string | null> {
  const { data: gosClient } = await supabase
    .from("gos_clients")
    .select("client_code, company_name")
    .eq("id", gosClientId)
    .maybeSingle();
  const code = (gosClient as { client_code?: string } | null)?.client_code;
  if (!code) return null;

  const { data: crmClient } = await supabase
    .from("crm_clients")
    .select("id")
    .eq("client_code", code)
    .maybeSingle();
  const crmId = (crmClient as { id?: string } | null)?.id;
  if (!crmId) return null;

  const spend = agg.actual_ad_spend;
  const impr  = agg.actual_impressions;
  const clicks = agg.actual_clicks;
  const orders = agg.actual_orders;
  const revenue = agg.actual_revenue;
  const patch: Record<string, number | string | null> = {
    meta_spend: spend || null,
    meta_impressions: impr || null,
    meta_reach: agg.actual_reach || null,
    meta_clicks: clicks || null,
    meta_purchases: orders || null,
    meta_purchase_value: revenue || null,
    meta_roas: agg.actual_roas,
    meta_cpm: impr > 0 ? round2((spend / impr) * 1000) : null,
    meta_cpc: clicks > 0 ? round2(spend / clicks) : null,
    meta_ctr: impr > 0 ? round2((clicks / impr) * 100) : null,
    meta_cpa: orders > 0 ? round2(spend / orders) : null,
  };

  // No unique constraint on crm_quantitative_baselines.client_id — select-then-update-or-insert.
  const { data: existing } = await supabase
    .from("crm_quantitative_baselines")
    .select("id")
    .eq("client_id", crmId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existingId = (existing as { id?: string } | null)?.id;
  const { error } = existingId
    ? await supabase.from("crm_quantitative_baselines").update(patch).eq("id", existingId)
    : await supabase.from("crm_quantitative_baselines").insert({ client_id: crmId, ...patch });
  if (error) {
    console.error("[syncMetaToBaseline] baseline write failed:", error.message);
    return null;
  }
  const name = (gosClient as { company_name?: string } | null)?.company_name;
  return name ?? code;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function fmtMoney(n: number, currency: string | null): string {
  if (!n) return "0";
  return `${n.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}${currency ? " " + currency : ""}`;
}
function fmtInt(n: number): string {
  return n.toLocaleString("fr-CA");
}
function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? "—";
}
