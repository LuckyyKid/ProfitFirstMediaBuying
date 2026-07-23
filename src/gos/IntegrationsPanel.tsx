// Wave 10H.1 — Integrations panel (Shopify + placeholders for Meta/GA4/Google Ads)
// Lives at the top of DataSources page. Manages gos_integration_connections rows and triggers ingest edge functions.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Trash2, Save, UploadCloud } from "lucide-react";
import { AdFileUpload } from "./uploads/AdFileUpload";
import type { Platform } from "./uploads/adPlatformParser";

type ProviderId = "shopify" | "meta_ads" | "ga4" | "google_ads";

const UPLOADABLE_PROVIDERS: readonly ProviderId[] = ["meta_ads", "google_ads", "ga4"];
const isUploadable = (id: ProviderId): id is Platform => UPLOADABLE_PROVIDERS.includes(id);

interface Provider {
  id: ProviderId;
  label: string;
  status: "live" | "byo_oauth" | "planned";
  helpText: string;
  brandColor: string;
  logoUrl: string;
  fields: Array<{ key: string; label: string; type: "text" | "password"; placeholder?: string; scope: "config" | "credentials" }>;
  ingestFunction?: string;
  docsUrl?: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "shopify",
    label: "Shopify",
    status: "live",
    brandColor: "#95BF47",
    logoUrl: "https://cdn.simpleicons.org/shopify/95BF47",
    helpText: "Pull des commandes des 90 derniers jours (revenu / commandes / clients uniques) vers gos_measurement_snapshots.",
    fields: [
      { key: "shop_domain", label: "Domaine boutique (xxx.myshopify.com)", type: "text", placeholder: "acme.myshopify.com", scope: "config" },
      { key: "admin_access_token", label: "Admin API access token (shpat_...)", type: "password", placeholder: "shpat_...", scope: "credentials" },
    ],
    ingestFunction: "ingest-shopify",
    docsUrl: "https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin",
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    status: "byo_oauth",
    brandColor: "#0866FF",
    logoUrl: "https://cdn.simpleicons.org/meta/0866FF",
    helpText: "Nécessite un System User Meta Business Manager avec long-lived access token + permission ads_read. Edge function d'ingestion à venir dans 10H.2.",
    fields: [
      { key: "ad_account_id", label: "Ad Account ID (act_...)", type: "text", placeholder: "act_1234567890", scope: "config" },
      { key: "access_token", label: "System User access token", type: "password", scope: "credentials" },
    ],
    docsUrl: "https://developers.facebook.com/docs/marketing-api/system-users/",
  },
  {
    id: "ga4",
    label: "Google Analytics 4",
    status: "live",
    brandColor: "#F9AB00",
    logoUrl: "https://cdn.simpleicons.org/googleanalytics/F9AB00",
    helpText: "OAuth Google. Sync 30 derniers jours : sessions, utilisateurs, transactions, revenu, conversions.",
    fields: [
      { key: "property_id", label: "GA4 Property ID", type: "text", placeholder: "123456789", scope: "config" },
    ],
    ingestFunction: "gos-ga4-sync",
    docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
  },

  {
    id: "google_ads",
    label: "Google Ads",
    status: "live",
    brandColor: "#4285F4",
    logoUrl: "https://cdn.simpleicons.org/googleads/4285F4",
    helpText: "OAuth Google. Connexion à ton compte Google Ads. Le sync des campagnes arrivera en 10H.3 (nécessite un developer token).",
    fields: [
      { key: "customer_id", label: "Customer ID (xxx-xxx-xxxx)", type: "text", scope: "config" },
    ],
    docsUrl: "https://developers.google.com/google-ads/api/docs/first-call/dev-token",
  },
];

interface ConnectionRow {
  id: string;
  client_id: string;
  provider: string;
  status: string;
  display_name: string | null;
  config: Record<string, unknown>;
  vault_secret_id: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  notes: string | null;
}

interface SyncRunRow {
  id: string;
  connection_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_ingested: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export default function IntegrationsPanel({ clientId }: { clientId: string }) {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [runs, setRuns] = useState<Record<string, SyncRunRow[]>>({});
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ProviderId | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // GA4 property picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerConnId, setPickerConnId] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerProps, setPickerProps] = useState<Array<{ property_id: string; display_name: string; account_name: string; time_zone?: string; currency_code?: string }>>([]);
  const [pickerSaving, setPickerSaving] = useState<string | null>(null);

  // Shopify shop domain modal
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [shopifyDomain, setShopifyDomain] = useState("");

  // CSV/XLSX upload modal (Meta / Google Ads / GA4)
  const [uploadFor, setUploadFor] = useState<Platform | null>(null);


  const load = async () => {
    setLoading(true);
    const { data: connData, error: connErr } = await supabase
      .from("gos_integration_connections")
      .select("*")
      .eq("client_id", clientId)
      .order("provider", { ascending: true });
    if (connErr) toast.error(connErr.message);
    const list = (connData ?? []) as ConnectionRow[];
    setConnections(list);

    if (list.length > 0) {
      const { data: runData } = await supabase
        .from("gos_integration_sync_runs")
        .select("*")
        .eq("client_id", clientId)
        .order("started_at", { ascending: false })
        .limit(50);
      const grouped: Record<string, SyncRunRow[]> = {};
      for (const r of (runData ?? []) as SyncRunRow[]) {
        (grouped[r.connection_id] ||= []).push(r);
      }
      setRuns(grouped);
    } else {
      setRuns({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Detect OAuth return from Google (?ga4_connected=1 / ?google_ads_connected=1) and errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ga4Flag = params.get("ga4_connected");
    const adsFlag = params.get("google_ads_connected");
    const shopifyFlag = params.get("shopify_connected");
    const shopifyShop = params.get("shop");
    const shopifyError = params.get("shopify_error");
    const cid = params.get("connection_id");
    const ga4Error = params.get("ga4_error");
    const ga4ErrorDetail = params.get("ga4_error_detail");

    console.log("[IntegrationsPanel] OAuth return params:", {
      ga4Flag, adsFlag, shopifyFlag, shopifyShop, shopifyError, cid, ga4Error,
      fullSearch: window.location.search,
    });

    if (shopifyError) {
      params.delete("shopify_error");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
      console.error("[IntegrationsPanel] Shopify OAuth error:", shopifyError);
      toast.error(`Shopify OAuth échoué : ${shopifyError}`, { duration: 10000 });
      return;
    }
    if (shopifyFlag === "1") {
      params.delete("shopify_connected");
      params.delete("shop");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
      console.log("[IntegrationsPanel] ✅ Shopify connecté, shop:", shopifyShop, "— reload connections + sync check");
      toast.success(`Shopify connecté ✓ (${shopifyShop ?? "boutique"})`, { duration: 8000 });
      // Reload the connections list, then log what we got back
      load().then(async () => {
        const { data: check } = await supabase
          .from("gos_integration_connections")
          .select("id, provider, status, config, last_sync_at")
          .eq("client_id", clientId)
          .eq("provider", "shopify")
          .maybeSingle();
        console.log("[IntegrationsPanel] Shopify connection row after callback:", check);
        if (check) {
          toast.info(`Connexion enregistrée en base — status: ${check.status}`, { duration: 6000 });
        } else {
          toast.warning("Callback OK mais aucune ligne trouvée en base pour ce client.", { duration: 10000 });
        }
      });
      return;
    }
    if (ga4Error) {
      params.delete("ga4_error");
      params.delete("ga4_error_detail");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
      if (ga4Error === "access_denied" || ga4Error === "403") {
        toast.error(
          "Google OAuth access denied. Vérifie que l'app OAuth est en mode External, que ton compte Google est ajouté comme test user, et que le redirect URI correspond exactement.",
          { duration: 12000 },
        );
      } else {
        toast.error(`Google OAuth échoué : ${ga4Error}${ga4ErrorDetail ? ` — ${ga4ErrorDetail}` : ""}`, { duration: 10000 });
      }
      return;
    }
    if (ga4Flag === "1" && cid) {
      params.delete("ga4_connected");
      params.delete("connection_id");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
      toast.success("Google connecté. Choisis la propriété GA4.");
      openGa4Picker(cid);
    }
    if (adsFlag === "1" && cid) {
      params.delete("google_ads_connected");
      params.delete("connection_id");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
      toast.success("Google Ads connecté avec succès.");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const openGa4Picker = async (connectionId: string) => {
    setPickerOpen(true);
    setPickerConnId(connectionId);
    setPickerLoading(true);
    setPickerProps([]);
    try {
      const { data, error } = await supabase.functions.invoke("gos-ga4-list-properties", {
        body: { connection_id: connectionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPickerProps(data?.properties || []);
      if (!data?.properties?.length) {
        toast.message("Aucune propriété GA4 trouvée pour ce compte Google.");
      }
    } catch (err) {
      toast.error(`Chargement propriétés GA4 échoué : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPickerLoading(false);
    }
  };

  const selectGa4Property = async (prop: { property_id: string; display_name: string; account_name: string; time_zone?: string; currency_code?: string }) => {
    if (!pickerConnId) return;
    setPickerSaving(prop.property_id);
    try {
      const { data: current } = await supabase
        .from("gos_integration_connections")
        .select("config")
        .eq("id", pickerConnId)
        .maybeSingle();
      const prevConfig = (current?.config || {}) as Record<string, unknown>;
      const newConfig = {
        ...prevConfig,
        property_id: prop.property_id,
        property_display_name: prop.display_name,
        account_name: prop.account_name,
        time_zone: prop.time_zone,
        currency_code: prop.currency_code,
      };
      const { error } = await supabase
        .from("gos_integration_connections")
        .update({ config: newConfig as never, status: "connected" })
        .eq("id", pickerConnId);
      if (error) throw error;
      toast.success(`Propriété "${prop.display_name}" sélectionnée`);
      setPickerOpen(false);
      setPickerConnId(null);
      setPickerProps([]);
      await load();
    } catch (err) {
      toast.error(`Sélection échouée : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPickerSaving(null);
    }
  };


  const connByProvider = useMemo(() => {
    const m = new Map<string, ConnectionRow>();
    for (const c of connections) m.set(c.provider, c);
    return m;
  }, [connections]);

  const startEdit = (p: Provider) => {
    const existing = connByProvider.get(p.id);
    const initial: Record<string, string> = {};
    for (const f of p.fields) {
      if (f.scope === "config") {
        initial[f.key] = ((existing?.config as Record<string, unknown> | undefined)?.[f.key] as string) ?? "";
      } else {
        // Credentials live in Vault and are never returned to the client — always start empty.
        initial[f.key] = "";
      }
    }
    setDraft(initial);
    setEditing(p.id);
  };

  const saveConnection = async (p: Provider) => {
    const config: Record<string, unknown> = {};
    const credentials: Record<string, unknown> = {};
    for (const f of p.fields) {
      const v = (draft[f.key] || "").trim();
      if (f.scope === "config" && !v) {
        toast.error(`Champ requis : ${f.label}`);
        return;
      }
      // For credentials, only send when the user typed a new value (Vault keeps the old one otherwise)
      if (f.scope === "config") config[f.key] = v;
      else if (v) credentials[f.key] = v;
    }
    const existing = connByProvider.get(p.id);
    if (!existing && Object.keys(credentials).length === 0) {
      toast.error("Renseigne au moins un champ secret pour créer la connexion.");
      return;
    }
    const { data, error } = await supabase.functions.invoke("gos-integration-save", {
      body: {
        client_id: clientId,
        provider: p.id,
        display_name: p.label,
        config,
        credentials,
      },
    });
    if (error) return toast.error(error.message);
    if ((data as { error?: string })?.error) return toast.error((data as { error: string }).error);
    toast.success(`${p.label} connecté`);
    setEditing(null);
    setDraft({});
    load();
  };

  const runSync = async (conn: ConnectionRow, provider: Provider) => {
    if (!provider.ingestFunction) {
      toast.error("Edge function d'ingestion pas encore branchée pour ce provider");
      return;
    }
    setSyncingId(conn.id);
    try {
      const { data, error } = await supabase.functions.invoke(provider.ingestFunction, {
        body: { connection_id: conn.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Sync OK : ${data?.rows_ingested ?? 0} snapshots ingérés (${data?.orders_fetched ?? 0} commandes)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Sync échoué : ${msg}`);
    } finally {
      setSyncingId(null);
      load();
    }
  };

  const disconnect = async (conn: ConnectionRow) => {
    if (!confirm(`Déconnecter ${conn.display_name || conn.provider} ? Les credentials seront effacés.`)) return;
    const { error } = await supabase.from("gos_integration_connections").delete().eq("id", conn.id);
    if (error) return toast.error(error.message);
    toast.success("Déconnecté");
    load();
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Intégrations</h2>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            Connectez vos outils pour synchroniser les données automatiquement.
          </div>
        </div>
        <button className="gos-btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {PROVIDERS.map(p => {
          const conn = connByProvider.get(p.id);
          const lastRun = conn ? runs[conn.id]?.[0] : undefined;
          const isEditing = editing === p.id;
          const isSyncing = conn && syncingId === conn.id;
          const isConnected = !!conn && conn.status === "connected";
          const statusLabel = isConnected ? "Actif" : "Inactif";
          const statusDot = isConnected ? "#22c55e" : "#ef4444";

          return (
            <div
              key={p.id}
              style={{
                background: "#1a2337",
                borderRadius: 16,
                padding: 24,
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                flexDirection: "column",
                transition: "border-color 0.3s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
            >
              {/* Logo tile */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${p.brandColor}1a`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <img
                  src={p.logoUrl}
                  alt={`${p.label} logo`}
                  style={{ width: 28, height: 28, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                />
              </div>

              {/* Name + inactive pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "#fff" }}>{p.label}</h3>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 9.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Description */}
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af", lineHeight: 1.55, marginBottom: 24 }}>
                {p.helpText}
              </p>

              {lastRun && (
                <div style={{ fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 8, marginBottom: 12 }}>
                  Dernier run : <strong>{lastRun.status}</strong> · {lastRun.rows_ingested} lignes
                  {lastRun.error_message && <div style={{ color: "#c1121f", marginTop: 4 }}>{lastRun.error_message}</div>}
                </div>
              )}

              {isEditing ? (
                <div style={{ display: "grid", gap: 10, marginTop: "auto" }}>
                  {p.fields.map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {f.label} {f.scope === "credentials" && <span style={{ color: "#a8730a" }}>(secret)</span>}
                      </div>
                      <input
                        className="gos-input"
                        type={f.type}
                        value={draft[f.key] || ""}
                        placeholder={f.placeholder}
                        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => saveConnection(p)}
                      style={{
                        flex: 1,
                        background: p.brandColor,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "10px 16px",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Save size={12} /> Enregistrer
                    </button>
                    <button className="gos-btn-secondary" onClick={() => { setEditing(null); setDraft({}); }}>Annuler</button>
                  </div>
                  {p.docsUrl && (
                    <a href={p.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                      <ExternalLink size={11} /> Comment obtenir ces credentials
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, display: "inline-block" }} />
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                      {isConnected ? (conn.last_sync_at ? `Synchronisé ${new Date(conn.last_sync_at).toLocaleDateString()}` : "Connecté") : "Non connecté"}
                    </span>
                  </div>

                  {conn ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.id === "ga4" && conn.status === "pending_property" ? (
                        <button
                          onClick={() => openGa4Picker(conn.id)}
                          style={{
                            flex: 1,
                            background: p.brandColor,
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "10px 16px",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          Choisir la propriété GA4
                        </button>
                      ) : p.ingestFunction ? (
                        <button
                          onClick={() => runSync(conn, p)}
                          disabled={isSyncing}
                          style={{
                            flex: 1,
                            background: p.brandColor,
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "10px 16px",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: isSyncing ? "not-allowed" : "pointer",
                            opacity: isSyncing ? 0.6 : 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <RefreshCw size={12} /> {isSyncing ? "Sync..." : p.id === "ga4" ? "Sync 30 jours" : "Sync maintenant"}
                        </button>
                      ) : null}
                      {p.id === "ga4" && conn.status !== "pending_property" && (
                        <button
                          className="gos-btn-secondary"
                          onClick={() => openGa4Picker(conn.id)}
                          title="Changer de propriété GA4"
                          style={{ padding: "8px 12px" }}
                        >
                          Propriété
                        </button>
                      )}
                      {p.id !== "ga4" && (
                        <button className="gos-btn-secondary" onClick={() => startEdit(p)} style={{ padding: "8px 12px" }}>Modifier</button>
                      )}
                      {isUploadable(p.id) && (
                        <button
                          className="gos-btn-secondary"
                          onClick={() => setUploadFor(p.id)}
                          title="Importer un export CSV/XLSX"
                          style={{ padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <UploadCloud size={12} /> Fichier
                        </button>
                      )}
                      <button className="gos-btn-secondary" onClick={() => disconnect(conn)} title="Déconnecter" style={{ padding: "8px 10px" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          if (p.id === "shopify") { setShopifyDomain(""); setShopifyModalOpen(true); return; }
                          if (p.id === "ga4") return startGoogleOAuth(clientId, "ga4");
                          if (p.id === "google_ads") return startGoogleOAuth(clientId, "google_ads");
                          return startEdit(p);
                        }}
                        style={{
                          flex: 1,
                          background: p.brandColor,
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 16px",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "filter 0.2s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
                      >
                        Se connecter
                      </button>
                      {p.id === "shopify" && (
                        <button
                          className="gos-btn-secondary"
                          onClick={() => startEdit(p)}
                          title="Coller manuellement un token Admin API (dev)"
                          style={{ padding: "8px 12px" }}
                        >
                          Manuel
                        </button>
                      )}
                      {isUploadable(p.id) && (
                        <button
                          className="gos-btn-secondary"
                          onClick={() => setUploadFor(p.id)}
                          title="Importer un export CSV/XLSX sans connecter le compte"
                          style={{ padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <UploadCloud size={12} /> Fichier
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>

      {pickerOpen && (
        <div
          onClick={() => !pickerSaving && setPickerOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a2337", borderRadius: 16, padding: 24, maxWidth: 560, width: "100%",
              maxHeight: "80vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#fff" }}>Propriété GA4</h3>
              <button
                className="gos-btn-secondary"
                onClick={() => setPickerOpen(false)}
                disabled={!!pickerSaving}
                style={{ padding: "4px 10px" }}
              >Fermer</button>
            </div>
            {pickerLoading ? (
              <div style={{ color: "#94a3b8", padding: 20, textAlign: "center" }}>Chargement des propriétés Google Analytics…</div>
            ) : pickerProps.length === 0 ? (
              <div style={{ color: "#94a3b8", padding: 20, textAlign: "center", fontSize: 13 }}>
                Aucune propriété GA4 accessible avec ce compte Google. Vérifie que le compte a bien un accès Viewer sur au moins une propriété.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {pickerProps.map((prop) => {
                  const saving = pickerSaving === prop.property_id;
                  return (
                    <button
                      key={prop.property_id}
                      onClick={() => selectGa4Property(prop)}
                      disabled={!!pickerSaving}
                      style={{
                        textAlign: "left", background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14,
                        color: "#e2e8f0", cursor: pickerSaving ? "wait" : "pointer",
                        opacity: pickerSaving && !saving ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => { if (!pickerSaving) e.currentTarget.style.borderColor = "#F9AB00"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{prop.display_name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                        {prop.account_name} · ID {prop.property_id}
                        {prop.time_zone && <> · {prop.time_zone}</>}
                        {prop.currency_code && <> · {prop.currency_code}</>}
                      </div>
                      {saving && <div style={{ fontSize: 11, color: "#F9AB00", marginTop: 4 }}>Enregistrement…</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {shopifyModalOpen && (
        <div
          onClick={() => setShopifyModalOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(180deg, #1a2337 0%, #151d2e 100%)",
              borderRadius: 16, padding: 28, maxWidth: 480, width: "100%",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: "#95BF471a",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <img src="https://cdn.simpleicons.org/shopify/95BF47" alt="Shopify" style={{ width: 26, height: 26 }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#fff" }}>Connecter Shopify</h3>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Entre le domaine de ta boutique</div>
              </div>
            </div>

            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Domaine Shopify
            </label>
            <div style={{ position: "relative" }}>
              <input
                autoFocus
                className="gos-input"
                type="text"
                value={shopifyDomain}
                placeholder="acme"
                onChange={(e) => setShopifyDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submitShopifyDomain(); }
                  if (e.key === "Escape") setShopifyModalOpen(false);
                }}
                style={{ paddingRight: 120 }}
              />
              <span style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, color: "#64748b", pointerEvents: "none", fontFamily: "monospace",
              }}>.myshopify.com</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              Ex : <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>acme</code> → <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>acme.myshopify.com</code>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="gos-btn-secondary" onClick={() => setShopifyModalOpen(false)} style={{ padding: "10px 16px" }}>
                Annuler
              </button>
              <button
                onClick={submitShopifyDomain}
                disabled={!shopifyDomain.trim()}
                style={{
                  background: "#95BF47", color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 20px", fontWeight: 600, fontSize: 13,
                  cursor: shopifyDomain.trim() ? "pointer" : "not-allowed",
                  opacity: shopifyDomain.trim() ? 1 : 0.5,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <ExternalLink size={13} /> Continuer vers Shopify
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadFor && (
        <AdFileUpload
          clientId={clientId}
          expectedPlatform={uploadFor}
          onClose={() => setUploadFor(null)}
          onDone={load}
        />
      )}
    </div>
  );

  function submitShopifyDomain() {
    const raw = shopifyDomain.trim();
    if (!raw) return;
    const cleaned = raw.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const shopFull = cleaned.endsWith(".myshopify.com") ? cleaned : `${cleaned}.myshopify.com`;
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopFull)) {
      toast.error("Domaine invalide. Format attendu : xxx.myshopify.com");
      return;
    }
    setShopifyModalOpen(false);
    const returnTo = window.location.href;
    const url = new URL(`${SUPABASE_URL}/functions/v1/gos-shopify-oauth-start`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("shop", shopFull);
    url.searchParams.set("redirect", returnTo);
    window.location.href = url.toString();
  }
}

function startGoogleOAuth(clientId: string, provider: "ga4" | "google_ads") {
  const returnTo = window.location.href;
  const url = new URL(`${SUPABASE_URL}/functions/v1/gos-google-oauth-start`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect", returnTo);
  window.location.href = url.toString();
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

