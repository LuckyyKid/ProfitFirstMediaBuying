import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Target as TargetIcon, RefreshCw, Plus, Wand2 } from "lucide-react";

type Row = {
  id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  target_revenue: number | null;
  target_orders: number | null;
  target_leads: number | null;
  target_ad_spend: number | null;
  target_cac: number | null;
  target_cpl: number | null;
  target_mer: number | null;
  target_roas: number | null;
  target_cvr: number | null;
  target_close_rate: number | null;
  target_aov: number | null;
  target_gross_profit: number | null;
  status: string | null;
  derived_from_forecast_id: string | null;
  created_at: string;
};

export default function MetricTargets() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    period_label: "", period_start: "", period_end: "",
    target_revenue: "", target_ad_spend: "", target_orders: "", target_leads: "",
    target_cac: "", target_cpl: "", target_mer: "", target_aov: "",
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, r, f] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_metric_targets").select("*").eq("client_id", clientId).order("period_start", { ascending: false, nullsFirst: false }),
      supabase.from("gos_forecasts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) { setClient(c.data); setSelectedClient(c.data as any); }
    setRows((r.data ?? []) as Row[]);
    setForecasts(f.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const submit = async () => {
    if (!form.period_label) { toast.error("Label période requis"); return; }
    const num = (v: string) => v === "" ? null : Number(v);
    const { error } = await supabase.from("gos_metric_targets").insert({
      client_id: clientId!,
      period_label: form.period_label,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      target_revenue: num(form.target_revenue),
      target_ad_spend: num(form.target_ad_spend),
      target_orders: form.target_orders === "" ? null : Number(form.target_orders),
      target_leads: form.target_leads === "" ? null : Number(form.target_leads),
      target_cac: num(form.target_cac),
      target_cpl: num(form.target_cpl),
      target_mer: num(form.target_mer),
      target_aov: num(form.target_aov),
      status: "DRAFT",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cibles créées");
    setForm({ period_label: "", period_start: "", period_end: "", target_revenue: "", target_ad_spend: "", target_orders: "", target_leads: "", target_cac: "", target_cpl: "", target_mer: "", target_aov: "" });
    setShowForm(false);
    load();
  };

  const deriveFromLatestBase = async () => {
    const base = forecasts.find((f) => f.scenario === "BASE");
    if (!base) { toast.error("Aucun forecast BASE trouvé"); return; }
    const { error } = await supabase.from("gos_metric_targets").insert({
      client_id: clientId!,
      period_label: `From forecast ${new Date(base.created_at).toLocaleDateString()}`,
      target_revenue: base.projected_revenue,
      target_ad_spend: base.projected_ad_spend,
      target_orders: base.projected_orders,
      target_leads: base.projected_leads,
      target_cac: base.projected_cac,
      target_mer: base.projected_mer,
      target_roas: base.projected_roas,
      target_gross_profit: base.projected_gross_profit,
      derived_from_forecast_id: base.id,
      status: "DRAFT",
      assumptions: { source: "forecast_base", horizon_days: base.horizon_days },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cibles dérivées du forecast BASE");
    load();
  };

  if (loading) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  const isLocal = client?.business_type === "LOCAL_SERVICE";

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Verrouille les objectifs revenu / dépense / CAC / MER pour la prochaine période à partir du BASE forecast et du Spending Power.",
          dataSource: "Prévisions (BASE) · Pouvoir de dépense · focus recommandé du diagnostic.",
          usedBy: "P&L hebdo · Optimisation live · Mesure (calcul de variance).",
          requiredInputs: ["Libellé de période", "Revenu cible", "Dépense cible", "CAC/CPL cible", "MER cible"],
          nextStep: "Approuve les objectifs, puis génère le P&L hebdo pour les décomposer en plans opérables.",
          primaryCta: "Créer un objectif",
        }}
        title="Objectifs de métriques"
        subtitle="Cibles de performance par période. Peuvent être créées manuellement ou dérivées d'un forecast."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-secondary" onClick={deriveFromLatestBase} disabled={forecasts.length === 0}>
              <Wand2 size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Dériver du forecast BASE
            </button>
            <button className="gos-btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouvelle cible
            </button>
          </>
        }
      />

      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouvelle cible</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <F label="Label"><input className="gos-input" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="e.g. Semaine 45" /></F>
            <F label="Début"><input className="gos-input" type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></F>
            <F label="Fin"><input className="gos-input" type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></F>
            <F label="Revenu cible ($)"><input className="gos-input" type="number" value={form.target_revenue} onChange={(e) => setForm({ ...form, target_revenue: e.target.value })} /></F>
            <F label="Spend cible ($)"><input className="gos-input" type="number" value={form.target_ad_spend} onChange={(e) => setForm({ ...form, target_ad_spend: e.target.value })} /></F>
            <F label="AOV cible ($)"><input className="gos-input" type="number" value={form.target_aov} onChange={(e) => setForm({ ...form, target_aov: e.target.value })} /></F>
            {!isLocal && (
              <>
                <F label="Orders cible"><input className="gos-input" type="number" value={form.target_orders} onChange={(e) => setForm({ ...form, target_orders: e.target.value })} /></F>
                <F label="CAC cible"><input className="gos-input" type="number" value={form.target_cac} onChange={(e) => setForm({ ...form, target_cac: e.target.value })} /></F>
                <F label="MER cible"><input className="gos-input" type="number" step="0.1" value={form.target_mer} onChange={(e) => setForm({ ...form, target_mer: e.target.value })} /></F>
              </>
            )}
            {isLocal && (
              <>
                <F label="Leads cible"><input className="gos-input" type="number" value={form.target_leads} onChange={(e) => setForm({ ...form, target_leads: e.target.value })} /></F>
                <F label="CPL cible"><input className="gos-input" type="number" value={form.target_cpl} onChange={(e) => setForm({ ...form, target_cpl: e.target.value })} /></F>
              </>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submit}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="gos-card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <EmptyState title="Aucune cible" hint="Crée une cible manuelle ou dérive-la d'un forecast." />
        ) : (
          <table className="gos-table">
            <thead>
              <tr>
                <th>Période</th><th>Revenu</th><th>Spend</th>
                {isLocal ? <><th>Leads</th><th>CPL</th></> : <><th>Orders</th><th>CAC</th></>}
                <th>MER</th><th>AOV</th><th>GP</th><th>Source</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><TargetIcon size={12} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--tdia-blue)" }} />{r.period_label}</td>
                  <td>{r.target_revenue != null ? `${Number(r.target_revenue).toLocaleString()} $` : "—"}</td>
                  <td>{r.target_ad_spend != null ? `${Number(r.target_ad_spend).toLocaleString()} $` : "—"}</td>
                  {isLocal ? <><td>{r.target_leads ?? "—"}</td><td>{r.target_cpl ?? "—"}</td></> : <><td>{r.target_orders ?? "—"}</td><td>{r.target_cac ?? "—"}</td></>}
                  <td>{r.target_mer != null ? `${r.target_mer}x` : "—"}</td>
                  <td>{r.target_aov ?? "—"}</td>
                  <td>{r.target_gross_profit != null ? `${Number(r.target_gross_profit).toLocaleString()} $` : "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--tdia-muted)" }}>{r.derived_from_forecast_id ? "Forecast" : "Manuel"}</td>
                  <td>{r.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}
