import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, RefreshCw, Save, Trash2, Database } from "lucide-react";
import {
  SOURCE_TYPES, CONNECTION_MODES, CONNECTION_STATUSES, FRESHNESS_STATUSES,
  reliabilityFor, freshnessFromLastSync, feedsHintFor,
  type SourceType, type ConnectionMode, type ConnectionStatus, type FreshnessStatus,
  type DataSource,
} from "@/gos/dataSources";
import IntegrationsPanel from "@/gos/IntegrationsPanel";

const SOURCE_LABELS: Record<SourceType, string> = {
  SHOPIFY: "Shopify",
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  GA4: "GA4",
  KLAVIYO: "Klaviyo",
  TIKTOK_ADS: "TikTok Ads",
  AMAZON: "Amazon",
  STRIPE: "Stripe",
  QUICKBOOKS: "QuickBooks",
  MANUAL_UPLOAD: "Import manuel",
  GOOGLE_SHEETS: "Google Sheets",
  OTHER: "Autre",
};

const MODE_LABELS: Record<ConnectionMode, string> = {
  NOT_CONNECTED: "Non connecté",
  MANUAL_ENTRY: "Saisie manuelle",
  MANUAL_EXPORT: "Export manuel",
  CSV_UPLOAD: "Upload CSV",
  API_PLACEHOLDER: "API (placeholder)",
  API_CONNECTED: "API connectée",
};

const STATUS_COLORS: Record<ConnectionStatus, { bg: string; color: string }> = {
  NOT_STARTED: { bg: "#efe9df", color: "#5b4d3a" },
  NEEDS_ACCESS: { bg: "#fff4d9", color: "#a8730a" },
  CONNECTED: { bg: "#e3f7ec", color: "#0f8a44" },
  ERROR: { bg: "#ffe3e3", color: "#c1121f" },
  STALE: { bg: "#ece0ff", color: "#5b3a8a" },
  DISABLED: { bg: "#eee", color: "#666" },
};

const FRESHNESS_COLORS: Record<FreshnessStatus, { bg: string; color: string }> = {
  FRESH: { bg: "#e3f7ec", color: "#0f8a44" },
  STALE: { bg: "#fff4d9", color: "#a8730a" },
  MISSING: { bg: "#ffe3e3", color: "#c1121f" },
  UNKNOWN: { bg: "#efe9df", color: "#5b4d3a" },
};

export default function DataSources() {
  const { selectedClient } = useSelectedClient();
  const [rows, setRows] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<{ source_type: SourceType; source_name: string; connection_mode: ConnectionMode }>({
    source_type: "SHOPIFY", source_name: "", connection_mode: "NOT_CONNECTED",
  });

  const load = async () => {
    if (!selectedClient) { setRows([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("gos_data_sources")
      .select("*")
      .eq("client_id", selectedClient.id)
      .order("source_type", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as DataSource[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [selectedClient?.id]);

  const summary = useMemo(() => {
    const total = rows.length;
    const api = rows.filter(r => r.connection_mode === "API_CONNECTED").length;
    const manual = rows.filter(r => r.connection_mode === "MANUAL_EXPORT" || r.connection_mode === "MANUAL_ENTRY" || r.connection_mode === "CSV_UPLOAD").length;
    const stale = rows.filter(r => r.data_freshness_status === "STALE").length;
    const missing = rows.filter(r => r.data_freshness_status === "MISSING" || r.connection_status === "NEEDS_ACCESS").length;
    return { total, api, manual, stale, missing };
  }, [rows]);

  if (!selectedClient) {
    return (
      <>
        <SectionHeader
          title="Sources de données"
          subtitle="Registre des sources de données et statut de connexion par client."
        />
        <EmptyState
          title="Aucun client sélectionné"
          hint="Ouvre un espace client depuis la liste, puis reviens ici."
        />
        <div style={{ marginTop: 12 }}>
          <Link to="/admin/gos/clients" className="gos-btn-primary">Voir les clients</Link>
        </div>
      </>
    );
  }

  const addSource = async () => {
    if (!draft.source_name.trim()) { toast.error("Nom requis"); return; }
    const reliability = reliabilityFor(draft.connection_mode);
    const { error } = await supabase.from("gos_data_sources").insert({
      client_id: selectedClient.id,
      source_type: draft.source_type,
      source_name: draft.source_name.trim(),
      connection_mode: draft.connection_mode,
      connection_status: draft.connection_mode === "NOT_CONNECTED" ? "NOT_STARTED" : "CONNECTED",
      data_freshness_status: "UNKNOWN",
      reliability_score: reliability,
      feeds: feedsHintFor(draft.source_type),
    });
    if (error) { toast.error(error.message); return; }
    setAddOpen(false);
    setDraft({ source_type: "SHOPIFY", source_name: "", connection_mode: "NOT_CONNECTED" });
    toast.success("Source ajoutée");
    load();
  };

  const updateRow = async (id: string, patch: Partial<DataSource>) => {
    const { error } = await supabase.from("gos_data_sources").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const markSyncedNow = async (r: DataSource) => {
    await updateRow(r.id, {
      last_sync_at: new Date().toISOString(),
      data_freshness_status: "FRESH",
    });
    toast.success("Dernier sync mis à jour");
  };

  const deleteRow = async (id: string) => {
    if (!confirm("Supprimer cette source ?")) return;
    const { error } = await supabase.from("gos_data_sources").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <>
      <SectionHeader
        title="Intégrations"
        subtitle={`Connecte les plateformes de ${selectedClient.company_name}. Un clic sur « Se connecter » lance l'authentification sécurisée.`}
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} /> Rafraîchir
            </button>
            <button className="gos-btn-primary" onClick={() => setAddOpen(v => !v)}>
              <Plus size={14} /> Ajouter une source manuelle
            </button>
          </>
        }
        guide={{
          purpose: "Connecter chaque plateforme du client (Shopify, Meta, GA4...) via OAuth pour ingérer les données automatiquement.",
          dataSource: "Auth OAuth des providers. Fallback saisie manuelle pour sources hors API.",
          usedBy: "Data Quality Score, Client Intelligence, Forecast.",
          nextStep: rows.length === 0 ? "Connecte Shopify pour commencer." : undefined,
        }}
      />

      <IntegrationsPanel clientId={selectedClient.id} />

      <div className="gos-card" style={{ padding: 16, marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>Cartographie Shopify (readiness)</h3>
        <p style={{ margin: "4px 0 12px", fontSize: 12, color: "var(--tdia-muted)" }}>
          Ce que Shopify alimentera automatiquement dès la connexion, et ce qui restera en saisie manuelle.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: "#0f8a44", marginBottom: 6 }}>SHOPIFY FOURNIT</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--tdia-text)", lineHeight: 1.7 }}>
              <li>orders, gross sales, discounts, refunds</li>
              <li>shipping collected, taxes collected</li>
              <li>products, variants, SKUs</li>
              <li>inventory levels (units on hand)</li>
              <li>customers (new vs returning via orders_count)</li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: "#a8730a", marginBottom: 6 }}>À SAISIR MANUELLEMENT</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--tdia-text)", lineHeight: 1.7 }}>
              <li>landed cost, duties/tariffs</li>
              <li>true shipping cost (carrier), pick & pack</li>
              <li>payment processing exacts (multi-gateway)</li>
              <li>OPEX, interest expense</li>
              <li>supplier terms, cash conversion cycle</li>
              <li>chargebacks (payment processor)</li>
            </ul>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--tdia-muted)" }}>
          Détail complet dans <code>.lovable/shopify-data-mapping-blueprint.md</code>.
        </p>
      </div>




      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <SummaryCard label="Sources" value={summary.total} />
        <SummaryCard label="API connectées" value={summary.api} tone="ok" />
        <SummaryCard label="Manuelles" value={summary.manual} />
        <SummaryCard label="Stale" value={summary.stale} tone={summary.stale > 0 ? "warn" : undefined} />
        <SummaryCard label="Manquantes" value={summary.missing} tone={summary.missing > 0 ? "danger" : undefined} />
      </div>

      {addOpen && (
        <div className="gos-card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: "var(--tdia-text)" }}>Nouvelle source</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <Field label="Type">
              <select className="gos-input" value={draft.source_type} onChange={(e) => setDraft(d => ({ ...d, source_type: e.target.value as SourceType, source_name: d.source_name || SOURCE_LABELS[e.target.value as SourceType] }))}>
                {SOURCE_TYPES.map(t => <option key={t} value={t}>{SOURCE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Nom (compte, boutique...)">
              <input className="gos-input" value={draft.source_name} onChange={(e) => setDraft(d => ({ ...d, source_name: e.target.value }))} placeholder={SOURCE_LABELS[draft.source_type]} />
            </Field>
            <Field label="Mode de connexion">
              <select className="gos-input" value={draft.connection_mode} onChange={(e) => setDraft(d => ({ ...d, connection_mode: e.target.value as ConnectionMode }))}>
                {CONNECTION_MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
              </select>
            </Field>
            <button className="gos-btn-primary" onClick={addSource}><Save size={14} /> Enregistrer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--tdia-muted)" }}>Chargement...</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune source enregistrée" hint="Clique sur « Ajouter une source » pour commencer." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          {rows.map(r => (
            <SourceCard
              key={r.id}
              row={r}
              onUpdate={(patch) => updateRow(r.id, patch)}
              onSyncNow={() => markSyncedNow(r)}
              onDelete={() => deleteRow(r.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "#0f8a44" : tone === "warn" ? "#a8730a" : tone === "danger" ? "#c1121f" : "var(--tdia-text)";
  return (
    <div className="gos-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--tdia-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function SourceCard({ row, onUpdate, onSyncNow, onDelete }:
  { row: DataSource; onUpdate: (p: Partial<DataSource>) => void; onSyncNow: () => void; onDelete: () => void; }) {
  const [notes, setNotes] = useState(row.notes ?? "");
  const [feeds, setFeeds] = useState(row.feeds ?? "");
  const statusStyle = STATUS_COLORS[row.connection_status];
  const freshStyle = FRESHNESS_COLORS[row.data_freshness_status];
  const auto = freshnessFromLastSync(row.last_sync_at);

  return (
    <div className="gos-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--tdia-text)" }}>
            <Database size={14} /> {SOURCE_LABELS[row.source_type]}
          </div>
          <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginTop: 2 }}>{row.source_name}</div>
        </div>
        <button
          className="gos-btn-secondary"
          onClick={onDelete}
          style={{ padding: "4px 8px" }}
          title="Supprimer"
        ><Trash2 size={12} /></button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip {...statusStyle} label={row.connection_status} />
        <Chip {...freshStyle} label={row.data_freshness_status} />
        <Chip bg="#e0edff" color="#0b5cad" label={`Fiabilité ${row.reliability_score}%`} />
      </div>

      <Field label="Mode de connexion">
        <select
          className="gos-input"
          value={row.connection_mode}
          onChange={(e) => {
            const mode = e.target.value as ConnectionMode;
            onUpdate({ connection_mode: mode, reliability_score: reliabilityFor(mode) });
          }}
        >
          {CONNECTION_MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </select>
      </Field>

      <Field label="Statut de connexion">
        <select
          className="gos-input"
          value={row.connection_status}
          onChange={(e) => onUpdate({ connection_status: e.target.value as ConnectionStatus })}
        >
          {CONNECTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="Fraîcheur des données">
        <select
          className="gos-input"
          value={row.data_freshness_status}
          onChange={(e) => onUpdate({ data_freshness_status: e.target.value as FreshnessStatus })}
        >
          {FRESHNESS_STATUSES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 4 }}>
          Dernier sync : {row.last_sync_at ? new Date(row.last_sync_at).toLocaleString() : "jamais"}
          {row.last_sync_at && auto !== row.data_freshness_status && (
            <span style={{ marginLeft: 6, color: "#a8730a" }}>· auto = {auto}</span>
          )}
        </div>
      </Field>

      <Field label="Alimente (données fournies)">
        <input
          className="gos-input"
          value={feeds}
          onChange={(e) => setFeeds(e.target.value)}
          onBlur={() => { if (feeds !== (row.feeds ?? "")) onUpdate({ feeds }); }}
          placeholder="Revenu, commandes, dépense pub..."
        />
      </Field>

      <Field label="Notes">
        <textarea
          className="gos-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (row.notes ?? "")) onUpdate({ notes }); }}
          rows={2}
        />
      </Field>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="gos-btn-secondary" onClick={onSyncNow} title="Marquer comme synchronisé maintenant">
          <RefreshCw size={12} /> Sync maintenant
        </button>
      </div>
    </div>
  );
}

function Chip({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{ padding: "3px 8px", borderRadius: 999, background: bg, color, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em" }}>
      {label}
    </span>
  );
}
