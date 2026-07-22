import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { DollarSign, TrendingUp, AlertTriangle, Activity, Plus, Trash2, Calculator } from "lucide-react";
import { computePredictiveLtvCac } from "@/gos/ltvCac";

type Cashflow = {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  granularity: "weekly" | "monthly";
  opening_cash: number;
  cash_in: number;
  cash_out_cogs: number;
  cash_out_ads: number;
  cash_out_opex: number;
  cash_out_tax: number;
  cash_out_other: number;
  closing_cash: number;
  runway_weeks: number | null;
  notes: string | null;
};

type LtvCac = {
  id: string;
  client_id: string;
  snapshot_date: string;
  horizon_months: number;
  channel: string | null;
  segment: string | null;
  new_customers: number | null;
  ad_spend: number | null;
  avg_order_value: number | null;
  gross_margin_pct: number | null;
  repeat_rate_pct: number | null;
  purchase_frequency: number | null;
  churn_rate_pct: number | null;
  cac: number | null;
  predicted_ltv: number | null;
  ltv_cac_ratio: number | null;
  payback_months: number | null;
  contribution_margin: number | null;
  confidence_score: number | null;
  model_notes: string | null;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(n ?? 0));

const pct = (n: number | null | undefined) => `${(Number(n ?? 0)).toFixed(1)}%`;
const moneyMaybe = (n: number | null | undefined) => n == null ? "—" : money(n);
const fixedMaybe = (n: number | null | undefined, digits = 1) => n == null ? "—" : Number(n).toFixed(digits);
const ratioTone = (n: number | null | undefined) => n == null ? undefined : n >= 3 ? "ok" : n >= 1.5 ? "warn" : "bad";

function computeLtvCac(input: Partial<LtvCac>) {
  return computePredictiveLtvCac(input);
}

export default function FinancialConsolidated() {
  const { clientId: routeId } = useParams();
  const { selectedClient } = useSelectedClient();
  const clientId = routeId ?? selectedClient?.id ?? null;

  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [ltvcacs, setLtvcacs] = useState<LtvCac[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cashflow" | "ltvcac">("cashflow");

  // Cashflow form
  const [cfForm, setCfForm] = useState({
    period_start: new Date().toISOString().slice(0, 10),
    period_end: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    granularity: "weekly" as "weekly" | "monthly",
    opening_cash: 0,
    cash_in: 0,
    cash_out_cogs: 0,
    cash_out_ads: 0,
    cash_out_opex: 0,
    cash_out_tax: 0,
    cash_out_other: 0,
    runway_weeks: 0,
    notes: "",
  });

  // LTV/CAC form
  const [lcForm, setLcForm] = useState<Partial<LtvCac>>({
    snapshot_date: new Date().toISOString().slice(0, 10),
    horizon_months: 12,
    channel: "meta",
    segment: "all",
    new_customers: 0,
    ad_spend: 0,
    avg_order_value: 0,
    gross_margin_pct: 40,
    repeat_rate_pct: 25,
    purchase_frequency: 1.5,
    churn_rate_pct: 5,
  });

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      const [cf, lc] = await Promise.all([
        supabase.from("gos_cashflow_snapshots").select("*").eq("client_id", clientId).order("period_start", { ascending: false }),
        supabase.from("gos_ltv_cac_predictions").select("*").eq("client_id", clientId).order("snapshot_date", { ascending: false }),
      ]);
      if (cf.error) toast.error(cf.error.message); else setCashflows((cf.data ?? []) as Cashflow[]);
      if (lc.error) toast.error(lc.error.message); else setLtvcacs((lc.data ?? []) as LtvCac[]);
      setLoading(false);
    })();
  }, [clientId]);

  const kpis = useMemo(() => {
    const last = cashflows[0];
    const totalIn = cashflows.reduce((s, c) => s + Number(c.cash_in), 0);
    const totalOut = cashflows.reduce((s, c) =>
      s + Number(c.cash_out_cogs) + Number(c.cash_out_ads) + Number(c.cash_out_opex) + Number(c.cash_out_tax) + Number(c.cash_out_other), 0);
    const ratios = ltvcacs.map((l) => Number(l.ltv_cac_ratio)).filter(Number.isFinite);
    const paybacks = ltvcacs.map((l) => Number(l.payback_months)).filter(Number.isFinite);
    const avgRatio = ratios.length
      ? ratios.reduce((s, v) => s + v, 0) / ratios.length
      : 0;
    const avgPayback = paybacks.length
      ? paybacks.reduce((s, v) => s + v, 0) / paybacks.length
      : 0;
    return {
      closing: last?.closing_cash ?? 0,
      runway: last?.runway_weeks ?? 0,
      totalIn, totalOut,
      avgRatio, avgPayback,
    };
  }, [cashflows, ltvcacs]);

  const preview = useMemo(() => computeLtvCac(lcForm), [lcForm]);

  async function saveCashflow() {
    if (!clientId) return;
    const { error, data } = await supabase.from("gos_cashflow_snapshots")
      .insert({ ...cfForm, client_id: clientId, created_by: (await supabase.auth.getUser()).data.user?.id })
      .select("*").single();
    if (error) return toast.error(error.message);
    setCashflows(prev => [data as Cashflow, ...prev]);
    toast.success("Cashflow enregistré");
  }

  async function saveLtvCac() {
    if (!clientId) return;
    const { warnings: _warnings, missing_data: _missingData, ...computed } = computeLtvCac(lcForm);
    const payload = { ...lcForm, ...computed, client_id: clientId, created_by: (await supabase.auth.getUser()).data.user?.id };
    const { error, data } = await supabase.from("gos_ltv_cac_predictions").insert(payload as never).select("*").single();
    if (error) return toast.error(error.message);
    setLtvcacs(prev => [data as LtvCac, ...prev]);
    toast.success("Prédiction LTV/CAC enregistrée");
  }

  async function del(table: "gos_cashflow_snapshots" | "gos_ltv_cac_predictions", id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (table === "gos_cashflow_snapshots") setCashflows(prev => prev.filter(x => x.id !== id));
    else setLtvcacs(prev => prev.filter(x => x.id !== id));
    toast.success("Supprimé");
  }

  if (!clientId) {
    return <div className="gos-card" style={{ padding: 24 }}>Sélectionne un client d'abord.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--tdia-text)" }}>Finance consolidée</h1>
        <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>Cashflow + LTV/CAC prédictif — vue unifiée du levier financier</div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <KpiCard icon={<DollarSign size={18} />} label="Cash de clôture" value={money(kpis.closing)} />
        <KpiCard icon={<Activity size={18} />} label="Runway (semaines)" value={`${Number(kpis.runway ?? 0).toFixed(1)}`} tone={Number(kpis.runway ?? 0) < 8 ? "warn" : "ok"} />
        <KpiCard icon={<TrendingUp size={18} />} label="Entrées cumulées" value={money(kpis.totalIn)} />
        <KpiCard icon={<AlertTriangle size={18} />} label="Sorties cumulées" value={money(kpis.totalOut)} tone="warn" />
        <KpiCard icon={<Calculator size={18} />} label="Ratio LTV/CAC moyen" value={kpis.avgRatio.toFixed(2)} tone={kpis.avgRatio >= 3 ? "ok" : kpis.avgRatio >= 1.5 ? "warn" : "bad"} />
        <KpiCard icon={<Calculator size={18} />} label="Payback moyen (mois)" value={kpis.avgPayback.toFixed(1)} tone={kpis.avgPayback <= 6 ? "ok" : "warn"} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        <button className={tab === "cashflow" ? "gos-btn-primary" : "gos-btn-secondary"} onClick={() => setTab("cashflow")}>Cashflow</button>
        <button className={tab === "ltvcac" ? "gos-btn-primary" : "gos-btn-secondary"} onClick={() => setTab("ltvcac")}>LTV / CAC prédictif</button>
      </div>

      {tab === "cashflow" && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
          <section className="gos-card" style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Nouveau snapshot de cashflow</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <Field label="Début"><input type="date" className="gos-input" value={cfForm.period_start} onChange={e => setCfForm(f => ({ ...f, period_start: e.target.value }))} /></Field>
              <Field label="Fin"><input type="date" className="gos-input" value={cfForm.period_end} onChange={e => setCfForm(f => ({ ...f, period_end: e.target.value }))} /></Field>
              <Field label="Granularité">
                <select className="gos-input" value={cfForm.granularity} onChange={e => setCfForm(f => ({ ...f, granularity: e.target.value as "weekly" | "monthly" }))}>
                  <option value="weekly">Hebdo</option><option value="monthly">Mensuel</option>
                </select>
              </Field>
              <Field label="Cash d'ouverture"><NumInput v={cfForm.opening_cash} set={v => setCfForm(f => ({ ...f, opening_cash: v }))} /></Field>
              <Field label="Entrées"><NumInput v={cfForm.cash_in} set={v => setCfForm(f => ({ ...f, cash_in: v }))} /></Field>
              <Field label="COGS"><NumInput v={cfForm.cash_out_cogs} set={v => setCfForm(f => ({ ...f, cash_out_cogs: v }))} /></Field>
              <Field label="Ads"><NumInput v={cfForm.cash_out_ads} set={v => setCfForm(f => ({ ...f, cash_out_ads: v }))} /></Field>
              <Field label="Opex"><NumInput v={cfForm.cash_out_opex} set={v => setCfForm(f => ({ ...f, cash_out_opex: v }))} /></Field>
              <Field label="Taxes"><NumInput v={cfForm.cash_out_tax} set={v => setCfForm(f => ({ ...f, cash_out_tax: v }))} /></Field>
              <Field label="Autres"><NumInput v={cfForm.cash_out_other} set={v => setCfForm(f => ({ ...f, cash_out_other: v }))} /></Field>
              <Field label="Runway (sem.)"><NumInput v={cfForm.runway_weeks} set={v => setCfForm(f => ({ ...f, runway_weeks: v }))} /></Field>
            </div>
            <textarea className="gos-input" placeholder="Notes" style={{ marginTop: 10, width: "100%" }} value={cfForm.notes} onChange={e => setCfForm(f => ({ ...f, notes: e.target.value }))} />
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <button className="gos-btn-primary" onClick={saveCashflow}><Plus size={14} /> Enregistrer</button>
              <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>
                Clôture calculée : <strong>{money(
                  cfForm.opening_cash + cfForm.cash_in - cfForm.cash_out_cogs - cfForm.cash_out_ads - cfForm.cash_out_opex - cfForm.cash_out_tax - cfForm.cash_out_other
                )}</strong>
              </div>
            </div>
          </section>

          <section className="gos-card" style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Historique</h3>
            {loading ? <div>Chargement…</div> : cashflows.length === 0 ? <div style={{ color: "var(--tdia-muted)" }}>Aucun snapshot.</div> : (
              <div style={{ overflowX: "auto" }}>
                <table className="gos-table" style={{ width: "100%", fontSize: 13 }}>
                  <thead><tr>
                    <th>Période</th><th>Type</th><th>Ouverture</th><th>Entrées</th><th>Sorties</th><th>Clôture</th><th>Runway</th><th></th>
                  </tr></thead>
                  <tbody>
                    {cashflows.map(c => {
                      const out = Number(c.cash_out_cogs) + Number(c.cash_out_ads) + Number(c.cash_out_opex) + Number(c.cash_out_tax) + Number(c.cash_out_other);
                      return (
                        <tr key={c.id}>
                          <td>{c.period_start} → {c.period_end}</td>
                          <td>{c.granularity}</td>
                          <td>{money(c.opening_cash)}</td>
                          <td style={{ color: "#3ddc97" }}>{money(c.cash_in)}</td>
                          <td style={{ color: "#ff6b6b" }}>{money(out)}</td>
                          <td style={{ fontWeight: 600 }}>{money(c.closing_cash)}</td>
                          <td>{c.runway_weeks ?? "—"}</td>
                          <td><button className="gos-btn-secondary" onClick={() => del("gos_cashflow_snapshots", c.id)}><Trash2 size={12} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "ltvcac" && (
        <div style={{ display: "grid", gap: 16 }}>
          <section className="gos-card" style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Nouvelle prédiction LTV / CAC</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <Field label="Date"><input type="date" className="gos-input" value={lcForm.snapshot_date as string} onChange={e => setLcForm(f => ({ ...f, snapshot_date: e.target.value }))} /></Field>
              <Field label="Horizon (mois)"><NumInput v={Number(lcForm.horizon_months ?? 12)} set={v => setLcForm(f => ({ ...f, horizon_months: v }))} /></Field>
              <Field label="Canal"><input className="gos-input" value={lcForm.channel ?? ""} onChange={e => setLcForm(f => ({ ...f, channel: e.target.value }))} /></Field>
              <Field label="Segment"><input className="gos-input" value={lcForm.segment ?? ""} onChange={e => setLcForm(f => ({ ...f, segment: e.target.value }))} /></Field>
              <Field label="Nouveaux clients"><NumInput v={Number(lcForm.new_customers ?? 0)} set={v => setLcForm(f => ({ ...f, new_customers: v }))} /></Field>
              <Field label="Ad spend"><NumInput v={Number(lcForm.ad_spend ?? 0)} set={v => setLcForm(f => ({ ...f, ad_spend: v }))} /></Field>
              <Field label="AOV"><NumInput v={Number(lcForm.avg_order_value ?? 0)} set={v => setLcForm(f => ({ ...f, avg_order_value: v }))} /></Field>
              <Field label="Marge brute (%)"><NumInput v={Number(lcForm.gross_margin_pct ?? 0)} set={v => setLcForm(f => ({ ...f, gross_margin_pct: v }))} /></Field>
              <Field label="Repeat rate (%)"><NumInput v={Number(lcForm.repeat_rate_pct ?? 0)} set={v => setLcForm(f => ({ ...f, repeat_rate_pct: v }))} /></Field>
              <Field label="Fréquence achat/mois"><NumInput v={Number(lcForm.purchase_frequency ?? 0)} set={v => setLcForm(f => ({ ...f, purchase_frequency: v }))} /></Field>
              <Field label="Churn mensuel (%)"><NumInput v={Number(lcForm.churn_rate_pct ?? 0)} set={v => setLcForm(f => ({ ...f, churn_rate_pct: v }))} /></Field>
            </div>
            <textarea className="gos-input" placeholder="Notes du modèle" style={{ marginTop: 10, width: "100%" }} value={lcForm.model_notes ?? ""} onChange={e => setLcForm(f => ({ ...f, model_notes: e.target.value }))} />

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, padding: 12, background: "var(--tdia-surface-2)", borderRadius: 8 }}>
              <Stat label="CAC" value={moneyMaybe(preview.cac)} />
              <Stat label="LTV prédite" value={moneyMaybe(preview.predicted_ltv)} />
              <Stat label="Ratio" value={fixedMaybe(preview.ltv_cac_ratio, 2)} tone={ratioTone(preview.ltv_cac_ratio)} />
              <Stat label="Payback (mois)" value={fixedMaybe(preview.payback_months, 1)} />
              <Stat label="Marge contribution" value={moneyMaybe(preview.contribution_margin)} />
              <Stat label="Confiance" value={pct(preview.confidence_score)} />
            </div>

            <button className="gos-btn-primary" style={{ marginTop: 12 }} onClick={saveLtvCac}><Plus size={14} /> Enregistrer la prédiction</button>
          </section>

          <section className="gos-card" style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Prédictions passées</h3>
            {loading ? <div>Chargement…</div> : ltvcacs.length === 0 ? <div style={{ color: "var(--tdia-muted)" }}>Aucune prédiction.</div> : (
              <div style={{ overflowX: "auto" }}>
                <table className="gos-table" style={{ width: "100%", fontSize: 13 }}>
                  <thead><tr>
                    <th>Date</th><th>Canal</th><th>Segment</th><th>Horizon</th><th>CAC</th><th>LTV</th><th>Ratio</th><th>Payback</th><th>Confiance</th><th></th>
                  </tr></thead>
                  <tbody>
                    {ltvcacs.map(l => (
                      <tr key={l.id}>
                        <td>{l.snapshot_date}</td>
                        <td>{l.channel ?? "—"}</td>
                        <td>{l.segment ?? "—"}</td>
                        <td>{l.horizon_months}m</td>
                        <td>{money(l.cac)}</td>
                        <td>{money(l.predicted_ltv)}</td>
                        <td style={{ color: Number(l.ltv_cac_ratio) >= 3 ? "#3ddc97" : Number(l.ltv_cac_ratio) >= 1.5 ? "#d97706" : "#ff6b6b", fontWeight: 600 }}>
                          {Number(l.ltv_cac_ratio ?? 0).toFixed(2)}
                        </td>
                        <td>{Number(l.payback_months ?? 0).toFixed(1)}m</td>
                        <td>{pct(l.confidence_score)}</td>
                        <td><button className="gos-btn-secondary" onClick={() => del("gos_ltv_cac_predictions", l.id)}><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "#3ddc97" : tone === "warn" ? "#d97706" : tone === "bad" ? "#ff6b6b" : "var(--tdia-text)";
  return (
    <div className="gos-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--tdia-muted)", fontSize: 12 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function NumInput({ v, set }: { v: number; set: (n: number) => void }) {
  return <input type="number" step="0.01" className="gos-input" value={v} onChange={e => set(Number(e.target.value))} />;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "#3ddc97" : tone === "warn" ? "#d97706" : tone === "bad" ? "#ff6b6b" : "var(--tdia-text)";
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--tdia-muted)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
