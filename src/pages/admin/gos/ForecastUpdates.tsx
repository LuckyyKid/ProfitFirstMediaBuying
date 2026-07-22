import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Plus, TrendingUp, TrendingDown, Sigma } from "lucide-react";
import { runForecastBayesianV2 } from "@/gos/forecastBayesianV2";


type Update = {
  id: string;
  parent_forecast_id: string | null;
  update_reason: string | null;
  triggered_by: string | null;
  previous_revenue: number | null; updated_revenue: number | null;
  previous_ad_spend: number | null; updated_ad_spend: number | null;
  previous_cac: number | null; updated_cac: number | null;
  delta_revenue_pct: number | null; delta_spend_pct: number | null;
  new_confidence: number | null; notes: string | null; status: string | null; created_at: string;
};

const REASONS = ["MEASURED_REALITY", "EVENT_IMPACT", "BUDGET_CHANGE", "MARKET_SHIFT", "TEST_LEARNING", "OTHER"];

export default function ForecastUpdates() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    parent_forecast_id: "", update_reason: "MEASURED_REALITY", triggered_by: "",
    updated_revenue: "", updated_ad_spend: "", updated_cac: "", new_confidence: "0.7", notes: "",
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, u, f] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_forecast_updates").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("gos_forecasts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) { setClient(c.data); setSelectedClient(c.data as any); }
    setUpdates((u.data ?? []) as Update[]);
    setForecasts(f.data ?? []);
    if (f.data?.[0] && !form.parent_forecast_id) setForm((p) => ({ ...p, parent_forecast_id: f.data[0].id }));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const submit = async () => {
    const parent = forecasts.find((f) => f.id === form.parent_forecast_id);
    if (!parent) { toast.error("Sélectionne un forecast parent"); return; }
    const num = (v: string) => v === "" ? null : Number(v);
    const upRev = num(form.updated_revenue);
    const upSpend = num(form.updated_ad_spend);
    const upCac = num(form.updated_cac);
    const deltaRev = upRev != null && parent.projected_revenue ? Number((((upRev - parent.projected_revenue) / parent.projected_revenue) * 100).toFixed(1)) : null;
    const deltaSpend = upSpend != null && parent.projected_ad_spend ? Number((((upSpend - parent.projected_ad_spend) / parent.projected_ad_spend) * 100).toFixed(1)) : null;
    const { error } = await supabase.from("gos_forecast_updates").insert({
      client_id: clientId!,
      parent_forecast_id: parent.id,
      update_reason: form.update_reason,
      triggered_by: form.triggered_by || null,
      previous_revenue: parent.projected_revenue,
      updated_revenue: upRev,
      previous_ad_spend: parent.projected_ad_spend,
      updated_ad_spend: upSpend,
      previous_cac: parent.projected_cac,
      updated_cac: upCac,
      delta_revenue_pct: deltaRev,
      delta_spend_pct: deltaSpend,
      new_confidence: num(form.new_confidence),
      notes: form.notes || null,
      assumptions: { parent_scenario: parent.scenario, parent_horizon_days: parent.horizon_days },
      status: "DRAFT",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Mise à jour créée");
    setForm({ parent_forecast_id: form.parent_forecast_id, update_reason: "MEASURED_REALITY", triggered_by: "", updated_revenue: "", updated_ad_spend: "", updated_cac: "", new_confidence: "0.7", notes: "" });
    setShowForm(false);
    load();
  };

  if (loading) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Rafraîchit la prévision en cours de cycle quand le réel diverge — capture ce qui a changé et pourquoi.",
          dataSource: "Dernière prévision + snapshots de Mesure + revues Optimisation live.",
          usedBy: "Intelligence client · Planification prochain cycle.",
          requiredInputs: ["Raison de la mise à jour", "Δ revenu %", "Nouvelle confiance"],
          nextStep: "Enregistre la mise à jour, puis réaligne les Objectifs de métriques si delta > ±15%.",
          primaryCta: "Nouvelle mise à jour prévisions",
          isForecast: true,
        }}
        title="Mises à jour prévisions"
        subtitle="Mises à jour de prévision suite à la réalité mesurée, un événement ou un apprentissage de test."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={() => setShowForm((v) => !v)} disabled={forecasts.length === 0}>
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouvelle mise à jour
            </button>
          </>
        }
      />

      {forecasts.length === 0 && (
        <div className="gos-card" style={{ marginBottom: 20, borderColor: "rgba(245, 183, 78, 0.4)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun forecast parent</div>
          <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>
            Génère d'abord un forecast dans <b>Forecast</b> pour créer une mise à jour.
          </div>
        </div>
      )}

      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouvelle mise à jour</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <F label="Forecast parent">
              <select className="gos-input" value={form.parent_forecast_id} onChange={(e) => setForm({ ...form, parent_forecast_id: e.target.value })}>
                {forecasts.map((f) => (
                  <option key={f.id} value={f.id}>{f.scenario} · {f.horizon_days}j · {new Date(f.created_at).toLocaleDateString()}</option>
                ))}
              </select>
            </F>
            <F label="Raison">
              <select className="gos-input" value={form.update_reason} onChange={(e) => setForm({ ...form, update_reason: e.target.value })}>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </F>
            <F label="Déclenché par"><input className="gos-input" value={form.triggered_by} onChange={(e) => setForm({ ...form, triggered_by: e.target.value })} placeholder="AM / Auto" /></F>
            <F label="Nouveau revenu"><input className="gos-input" type="number" value={form.updated_revenue} onChange={(e) => setForm({ ...form, updated_revenue: e.target.value })} /></F>
            <F label="Nouveau spend"><input className="gos-input" type="number" value={form.updated_ad_spend} onChange={(e) => setForm({ ...form, updated_ad_spend: e.target.value })} /></F>
            <F label="Nouveau CAC"><input className="gos-input" type="number" value={form.updated_cac} onChange={(e) => setForm({ ...form, updated_cac: e.target.value })} /></F>
            <F label="Confiance (0-1)"><input className="gos-input" type="number" step="0.05" min={0} max={1} value={form.new_confidence} onChange={(e) => setForm({ ...form, new_confidence: e.target.value })} /></F>
            <div style={{ gridColumn: "span 3" }}>
              <F label="Notes"><textarea className="gos-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submit}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <div className="gos-card"><EmptyState title="Aucune mise à jour" hint="Crée une mise à jour à partir d'un forecast existant." /></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {updates.map((u) => (
            <div key={u.id} className="gos-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.update_reason}</div>
                  <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginTop: 4 }}>
                    {new Date(u.created_at).toLocaleString()} · {u.triggered_by ?? "—"}
                    {u.new_confidence != null && ` · Confiance: ${Math.round(u.new_confidence <= 1 ? u.new_confidence * 100 : u.new_confidence)}%`}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <DeltaCard label="Revenu" prev={u.previous_revenue} next={u.updated_revenue} delta={u.delta_revenue_pct} money />
                <DeltaCard label="Ad Spend" prev={u.previous_ad_spend} next={u.updated_ad_spend} delta={u.delta_spend_pct} money invert />
                <DeltaCard label="CAC" prev={u.previous_cac} next={u.updated_cac} delta={null} invert />
              </div>
              {u.notes && <div style={{ marginTop: 12, fontSize: 13 }}>{u.notes}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--tdia-muted)" }}>
        Conditional forecast, not a guarantee. Chaque mise à jour garde une trace du forecast parent (versioning).
      </div>

      <BayesianV2Panel clientId={clientId!} forecasts={forecasts} onDone={load} />
    </>
  );
}


function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}

function DeltaCard({ label, prev, next, delta, money, invert }: { label: string; prev: number | null; next: number | null; delta: number | null; money?: boolean; invert?: boolean }) {
  const fmt = (v: number | null) => v == null ? "—" : money ? `${Number(v).toLocaleString()} $` : String(v);
  const positive = delta != null && (invert ? delta < 0 : delta > 0);
  const color = delta == null ? "var(--tdia-muted)" : positive ? "#3ddc97" : "#ff6b6b";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(next)}</div>
        {delta != null && (
          <span style={{ color, fontSize: 12, fontWeight: 600 }}>
            <Icon size={10} style={{ verticalAlign: "middle" }} /> {delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 4 }}>Avant: {fmt(prev)}</div>
    </div>
  );
}

type Metric = "revenue" | "ad_spend" | "cac";
const METRIC_LABEL: Record<Metric, string> = { revenue: "Revenu", ad_spend: "Ad Spend", cac: "CAC" };
const METRIC_TO_PROJ: Record<Metric, string> = { revenue: "projected_revenue", ad_spend: "projected_ad_spend", cac: "projected_cac" };
const METRIC_TO_ACT: Record<Metric, string> = { revenue: "actual_revenue", ad_spend: "actual_ad_spend", cac: "actual_cac" };
const METRIC_TO_UPD: Record<Metric, string> = { revenue: "updated_revenue", ad_spend: "updated_ad_spend", cac: "updated_cac" };
const METRIC_TO_PREV: Record<Metric, string> = { revenue: "previous_revenue", ad_spend: "previous_ad_spend", cac: "previous_cac" };

function BayesianV2Panel({ clientId, forecasts, onDone }: { clientId: string; forecasts: any[]; onDone: () => void }) {
  const [forecastId, setForecastId] = useState<string>(forecasts[0]?.id ?? "");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [nSnaps, setNSnaps] = useState("6");
  const [priorScale, setPriorScale] = useState("15");
  const [snapshots, setSnapshots] = useState<number[]>([]);
  const [result, setResult] = useState<ReturnType<typeof runForecastBayesianV2> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForecastId(forecasts[0]?.id ?? ""); }, [forecasts]);

  const compute = async () => {
    const parent = forecasts.find((f) => f.id === forecastId);
    if (!parent) { toast.error("Sélectionne un forecast parent"); return; }
    const priorMean = Number(parent[METRIC_TO_PROJ[metric]] ?? 0);
    if (!priorMean) { toast.error("Le forecast parent n'a pas de valeur pour cette métrique"); return; }
    const { data } = await supabase
      .from("gos_measurement_snapshots")
      .select(METRIC_TO_ACT[metric] + ", period_start")
      .eq("client_id", clientId)
      .order("period_start", { ascending: false, nullsFirst: false })
      .limit(Number(nSnaps) || 6);
    const obs = ((data ?? []) as any[])
      .map((r) => Number(r[METRIC_TO_ACT[metric]]))
      .filter((v) => !isNaN(v) && v > 0);
    setSnapshots(obs);
    const out = runForecastBayesianV2({
      metric,
      prior_mean: priorMean,
      prior_confidence: Number(parent.confidence ?? 0.6),
      observations: obs,
      prior_scale_pct: (Number(priorScale) || 15) / 100,
    });
    setResult(out);
    if (out.missing_data.length) toast.error("Données manquantes: " + out.missing_data.join(", "));
    else toast.success(`Bayes v2 · gain=${(out.kalman_gain * 100).toFixed(0)}% · ${out.drift_signal}`);
  };

  const persist = async () => {
    if (!result || !forecastId) return;
    const parent = forecasts.find((f) => f.id === forecastId);
    if (!parent) return;
    setSaving(true);
    const insertRow: any = {
      client_id: clientId,
      parent_forecast_id: forecastId,
      update_reason: "MEASURED_REALITY",
      triggered_by: "bayesian_engine_v2",
      new_confidence: result.new_confidence,
      status: "DRAFT",
      notes: result.recommendation,
      assumptions: { parent_scenario: parent.scenario, metric, n_obs: result.n_observations, prior_scale_pct: Number(priorScale) / 100 } as any,
      prior_mean: result.prior_mean,
      prior_variance: result.prior_variance,
      likelihood_mean: result.likelihood_mean,
      likelihood_variance: result.likelihood_variance,
      posterior_mean: result.posterior_mean,
      posterior_variance: result.posterior_variance,
      posterior_ci_low: result.posterior_ci_low,
      posterior_ci_high: result.posterior_ci_high,
      kalman_gain: result.kalman_gain,
      drift_signal: result.drift_signal,
      engine_version: result.engine_version,
      engine_output: result as any,
    };
    insertRow[METRIC_TO_PREV[metric]] = result.prior_mean;
    insertRow[METRIC_TO_UPD[metric]] = result.posterior_mean;
    if (metric === "revenue") insertRow.delta_revenue_pct = result.delta_vs_prior_pct;
    if (metric === "ad_spend") insertRow.delta_spend_pct = result.delta_vs_prior_pct;

    const { error } = await supabase.from("gos_forecast_updates").insert(insertRow);
    if (!error) {
      await supabase.from("model_runs").insert({
        model_name: "forecast_bayesian_v2",
        model_version: "v2.0",
        input_json: { forecast_id: forecastId, metric, n_obs: result.n_observations, observations: snapshots, prior_scale_pct: Number(priorScale) / 100 } as any,
        output_json: result as any,
        formula_used: "normal_normal_conjugate_update",
        generated_by: "gos_forecast_updates_v2",
      } as any);
      toast.success("Mise à jour bayésienne enregistrée");
      onDone();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  return (
    <div className="gos-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sigma size={16} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>Moteur bayésien v2 (Normal-Normal)</div>
        <span style={{ fontSize: 11, color: "var(--tdia-muted)" }}>
          Mélange prior (forecast parent) × vraisemblance (snapshots) → postérieur + IC 95%
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <F label="Forecast parent">
          <select className="gos-input" value={forecastId} onChange={(e) => setForecastId(e.target.value)}>
            {forecasts.map((f) => (
              <option key={f.id} value={f.id}>{f.scenario} · {f.horizon_days}j · {new Date(f.created_at).toLocaleDateString()}</option>
            ))}
          </select>
        </F>
        <F label="Métrique">
          <select className="gos-input" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="revenue">Revenu</option>
            <option value="ad_spend">Ad Spend</option>
            <option value="cac">CAC</option>
          </select>
        </F>
        <F label="N snapshots récents">
          <input className="gos-input" type="number" min={1} max={30} value={nSnaps} onChange={(e) => setNSnaps(e.target.value)} />
        </F>
        <F label="σ prior (% du niveau)">
          <input className="gos-input" type="number" min={5} max={50} value={priorScale} onChange={(e) => setPriorScale(e.target.value)} />
        </F>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="gos-btn-primary" onClick={compute} disabled={!forecastId}>Calculer postérieur</button>
        <button className="gos-btn-secondary" onClick={persist} disabled={!result || saving}>
          {saving ? "..." : "Enregistrer comme mise à jour"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <BKpi label={`Prior (${METRIC_LABEL[metric]})`} value={result.prior_mean.toLocaleString()} />
          <BKpi label="Vraisemblance (moy. obs)" value={result.likelihood_mean.toLocaleString()} sub={`n=${result.n_observations}`} />
          <BKpi label="Postérieur" value={result.posterior_mean.toLocaleString()} sub={`± ${result.posterior_std.toLocaleString()}`} color="#4d9fff" />
          <BKpi label="Δ vs prior" value={`${result.delta_vs_prior_pct > 0 ? "+" : ""}${result.delta_vs_prior_pct}%`} color={Math.abs(result.delta_vs_prior_pct) < 10 ? "#3ddc97" : "#ff6b6b"} />
          <BKpi label="Gain de Kalman" value={`${(result.kalman_gain * 100).toFixed(0)}%`} sub="poids des obs" />
          <BKpi label="IC 95% bas" value={result.posterior_ci_low.toLocaleString()} />
          <BKpi label="IC 95% haut" value={result.posterior_ci_high.toLocaleString()} />
          <BKpi label="Signal de dérive" value={result.drift_signal} color={result.drift_signal === "STABLE" ? "#3ddc97" : result.drift_signal === "MINOR_DRIFT" ? "#f5b74e" : "#ff6b6b"} />
          <div style={{ gridColumn: "span 4", padding: 12, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8, fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommandation</div>
            <div>{result.recommendation}</div>
            {result.risks.length > 0 && <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 12 }}>⚠ {result.risks.join(" · ")}</div>}
            {result.conditions.length > 0 && <div style={{ marginTop: 4, color: "#f5b74e", fontSize: 12 }}>ⓘ {result.conditions.join(" · ")}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--tdia-text)", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

