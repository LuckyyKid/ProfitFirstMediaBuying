import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, RiskBadge, PhaseBadge, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { buildGosClientPayload, loadDealSources } from "@/gos/dealPrefill";
import { isInternalAgency } from "@/gos/internalAgency";
import { toast } from "sonner";
import { ExternalLink, Zap, RefreshCw } from "lucide-react";

type PendingRow = { key: string; label: string; deal: any | null; progress: any | null };

export default function GosClients() {
  const [rows, setRows] = useState<any[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const { setSelectedClient } = useSelectedClient();
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    const [{ data: clients }, { sources, existingCodes }] = await Promise.all([
      supabase.from("gos_clients").select("*").order("created_at", { ascending: false }),
      loadDealSources(),
    ]);
    setRows((clients ?? []).filter((c) => !isInternalAgency(c)));
    setPending(sources.filter((s) => !existingCodes.has(s.key)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activate = async (row: PendingRow) => {
    setActivating(row.key);
    const payload = buildGosClientPayload(row.deal, row.progress);
    if (!payload.client_code) payload.client_code = row.key;
    const { data, error } = await supabase.from("gos_clients").insert(payload).select().single();
    setActivating(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.company_name} activé dans Profit First.`);
    setSelectedClient(data as any);
    nav(`/admin/gos/clients/${data.id}/workspace`);
  };

  const matchQ = (s: string | null | undefined) => !q || (s ?? "").toLowerCase().includes(q.toLowerCase());
  const filtered = rows.filter((r) => [r.company_name, r.client_code, r.industry, r.am_owner].some(matchQ));
  const filteredPending = pending.filter((p) => [p.label, p.key, p.deal?.owner_email, p.progress?.email].some(matchQ));

  return (
    <div>
      <SectionHeader
        title="Clients"
        subtitle="Clients issus des deals fermés + onboarding, avec relation directe (pas de double-saisie)."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <Link to="/admin/gos/clients/new" className="gos-btn-primary" style={{ textDecoration: "none" }}>
              Créer manuellement
            </Link>
          </>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <input
          className="gos-input"
          placeholder="Chercher entreprise, code, email, AM…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* À activer */}
      <div className="gos-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>À activer</div>
            <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>
              Deals fermés / onboardings pas encore reliés à Profit First. Un clic pour créer la fiche.
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>{filteredPending.length} en attente</div>
        </div>

        {loading ? (
          <div style={{ height: 120, background: "rgba(255, 255, 255, 0.02)", borderRadius: 12 }} />
        ) : filteredPending.length === 0 ? (
          <EmptyState title="Rien à activer" hint="Tous les deals/onboardings sont déjà reliés." />
        ) : (
          <table className="gos-table">
            <thead><tr>
              <th>Entreprise</th><th>Code</th><th>Source</th><th>Contact</th><th>Deal</th><th></th>
            </tr></thead>
            <tbody>
              {filteredPending.map((r) => {
                const contact = r.deal?.owner_email || r.progress?.email || r.deal?.contact_name || r.progress?.client_name || "—";
                const deal = r.deal?.contract_value != null ? `$${Number(r.deal.contract_value).toLocaleString()}` : "—";
                const sources: string[] = [];
                if (r.deal) sources.push("deal");
                if (r.progress) sources.push("onboarding");
                return (
                  <tr key={r.key}>
                    <td style={{ fontWeight: 500 }}>{r.label}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.key}</td>
                    <td style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--tdia-blue-light)" }}>
                      {sources.join(" + ").toUpperCase()}
                    </td>
                    <td style={{ fontSize: 12 }}>{contact}</td>
                    <td>{deal}</td>
                    <td>
                      <button
                        className="gos-btn-primary"
                        disabled={activating === r.key}
                        onClick={() => activate(r)}
                      >
                        <Zap size={12} style={{ marginRight: 6, verticalAlign: -1 }} />
                        {activating === r.key ? "Activation…" : "Activer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Actifs */}
      <div className="gos-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Actifs dans Profit First</div>
          <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>{filtered.length} client{filtered.length > 1 ? "s" : ""}</div>
        </div>

        {loading ? (
          <div style={{ height: 200, background: "rgba(255, 255, 255, 0.02)", borderRadius: 12 }} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Aucun client actif" hint="Active un deal ci-dessus ou crée-en un manuellement." />
        ) : (
          <table className="gos-table">
            <thead><tr>
              <th>Company</th><th>Code</th><th>Business Type</th><th>Industry</th>
              <th>Phase</th><th>Risk</th><th>AM Owner</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.client_code}</td>
                  <td>{(r.business_type ?? "—").replace("_"," ")}</td>
                  <td>{r.industry ?? "—"}</td>
                  <td><PhaseBadge phase={r.current_phase} /></td>
                  <td><RiskBadge level={r.risk_level} /></td>
                  <td>{r.am_owner ?? "—"}</td>
                  <td>
                    <button className="gos-btn-secondary" onClick={() => { setSelectedClient(r); nav(`/admin/gos/clients/${r.id}/workspace`); }}>
                      Open Workspace <ExternalLink size={12} style={{ marginLeft: 4, verticalAlign: -1 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
