import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Plus, BarChart3, FlaskConical, Sigma } from "lucide-react";
import { runIncrementalityV2, type MetricType } from "@/gos/incrementalityV2";
import {
  createMeasurementSnapshot,
  createMeasurementTest,
  fetchMeasurementData,
  runAndSaveIncrementalityForTest,
  updateMeasurementTest,
  type MeasurementSnapshot,
  type MeasurementTarget,
  type MeasurementTest,
} from "@/gos/measurementController";


type Snap = MeasurementSnapshot;
type Test = MeasurementTest;

const ALERT_COLOR: Record<string, string> = { GREEN: "#0f8a44", YELLOW: "#a8730a", ORANGE: "#c1121f", RED: "#c1121f" };
const TEST_STATUSES = ["PLANNED", "RUNNING", "COMPLETED", "CANCELLED"];

export default function Measurement() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [targets, setTargets] = useState<MeasurementTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"snapshots" | "tests">("snapshots");
  const [showSnap, setShowSnap] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [snapForm, setSnapForm] = useState({
    period_label: "", period_start: "", period_end: "", linked_target_id: "",
    actual_revenue: "", actual_orders: "", actual_leads: "", actual_ad_spend: "",
    actual_cac: "", actual_cpl: "", actual_mer: "", actual_gross_profit: "",
  });
  const [testForm, setTestForm] = useState({
    test_name: "", test_type: "AB", hypothesis: "", variant_a: "", variant_b: "",
    primary_metric: "", start_date: "", end_date: "",
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchMeasurementData(clientId);
      if (data.client) { setClient(data.client); setSelectedClient(data.client as any); }
      setSnaps(data.snapshots);
      setTests(data.tests);
      setTargets(data.targets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de chargement mesure");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const submitSnap = async () => {
    if (!clientId) return;
    try {
      const payload = await createMeasurementSnapshot(clientId, snapForm, targets);
      toast.success(`Snapshot cree - Alerte: ${payload.alert_level}`);
      setSnapForm({ period_label: "", period_start: "", period_end: "", linked_target_id: "", actual_revenue: "", actual_orders: "", actual_leads: "", actual_ad_spend: "", actual_cac: "", actual_cpl: "", actual_mer: "", actual_gross_profit: "" });
      setShowSnap(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur snapshot mesure");
    }
  };

  const submitTest = async () => {
    if (!clientId) return;
    try {
      await createMeasurementTest(clientId, testForm);
      toast.success("Test cree");
      setTestForm({ test_name: "", test_type: "AB", hypothesis: "", variant_a: "", variant_b: "", primary_metric: "", start_date: "", end_date: "" });
      setShowTest(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur test mesure");
    }
  };

  const updateTest = async (id: string, patch: Partial<Test>) => {
    try {
      await updateMeasurementTest(id, patch);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur mise a jour test");
    }
  };

  if (loading) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Couche de vérité terrain : capture le réel mesuré + tests A/B structurés. Variance et niveau d'alerte calculés automatiquement.",
          dataSource: "Objectifs de métriques (liés) + snapshots saisis par l'AM + résultats de tests.",
          usedBy: "Intelligence client · Boucle d'apprentissage · Mises à jour prévisions.",
          requiredInputs: ["Libellé de période", "Revenu/dépense réel", "Cible liée (pour la variance)"],
          nextStep: "Enregistre un snapshot hebdo ; si alerte ORANGE/ROUGE, escalade en Optimisation live.",
          primaryCta: "Nouveau snapshot",
          riskWarning: snaps.some(s => s.alert_level === "RED" || s.alert_level === "ORANGE")
            ? "Risque de tracking détecté : snapshots récents en ORANGE/ROUGE. Ne te fie PAS uniquement au ROAS plateforme — recoupe avec GA4/revenu backend et marge brute avant toute décision budget."
            : null,
        }}
        title="Mesure"
        subtitle="Mesure de la réalité vs cibles + tests structurés. Variance et niveau d'alerte calculés automatiquement."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            {tab === "snapshots" ? (
              <button className="gos-btn-primary" onClick={() => setShowSnap((v) => !v)}>
                <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Snapshot
              </button>
            ) : (
              <button className="gos-btn-primary" onClick={() => setShowTest((v) => !v)}>
                <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Test
              </button>
            )}
          </>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={tab === "snapshots" ? "gos-btn-primary" : "gos-btn-secondary"} onClick={() => setTab("snapshots")}>
          <BarChart3 size={12} style={{ marginRight: 6, verticalAlign: "middle" }} /> Snapshots ({snaps.length})
        </button>
        <button className={tab === "tests" ? "gos-btn-primary" : "gos-btn-secondary"} onClick={() => setTab("tests")}>
          <FlaskConical size={12} style={{ marginRight: 6, verticalAlign: "middle" }} /> Tests ({tests.length})
        </button>
      </div>

      {tab === "snapshots" && (
        <>
          {showSnap && (
            <div className="gos-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouveau snapshot</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                <F label="Label"><input className="gos-input" value={snapForm.period_label} onChange={(e) => setSnapForm({ ...snapForm, period_label: e.target.value })} /></F>
                <F label="Début"><input className="gos-input" type="date" value={snapForm.period_start} onChange={(e) => setSnapForm({ ...snapForm, period_start: e.target.value })} /></F>
                <F label="Fin"><input className="gos-input" type="date" value={snapForm.period_end} onChange={(e) => setSnapForm({ ...snapForm, period_end: e.target.value })} /></F>
                <F label="Cible liée">
                  <select className="gos-input" value={snapForm.linked_target_id} onChange={(e) => setSnapForm({ ...snapForm, linked_target_id: e.target.value })}>
                    <option value="">—</option>
                    {targets.map((t) => <option key={t.id} value={t.id}>{t.period_label}</option>)}
                  </select>
                </F>
                <F label="Revenu réel"><input className="gos-input" type="number" value={snapForm.actual_revenue} onChange={(e) => setSnapForm({ ...snapForm, actual_revenue: e.target.value })} /></F>
                <F label="Spend réel"><input className="gos-input" type="number" value={snapForm.actual_ad_spend} onChange={(e) => setSnapForm({ ...snapForm, actual_ad_spend: e.target.value })} /></F>
                <F label="Orders"><input className="gos-input" type="number" value={snapForm.actual_orders} onChange={(e) => setSnapForm({ ...snapForm, actual_orders: e.target.value })} /></F>
                <F label="Leads"><input className="gos-input" type="number" value={snapForm.actual_leads} onChange={(e) => setSnapForm({ ...snapForm, actual_leads: e.target.value })} /></F>
                <F label="CAC"><input className="gos-input" type="number" value={snapForm.actual_cac} onChange={(e) => setSnapForm({ ...snapForm, actual_cac: e.target.value })} /></F>
                <F label="CPL"><input className="gos-input" type="number" value={snapForm.actual_cpl} onChange={(e) => setSnapForm({ ...snapForm, actual_cpl: e.target.value })} /></F>
                <F label="MER"><input className="gos-input" type="number" step="0.1" value={snapForm.actual_mer} onChange={(e) => setSnapForm({ ...snapForm, actual_mer: e.target.value })} /></F>
                <F label="Gross Profit"><input className="gos-input" type="number" value={snapForm.actual_gross_profit} onChange={(e) => setSnapForm({ ...snapForm, actual_gross_profit: e.target.value })} /></F>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button className="gos-btn-primary" onClick={submitSnap}>Créer</button>
                <button className="gos-btn-secondary" onClick={() => setShowSnap(false)}>Annuler</button>
              </div>
            </div>
          )}

          <div className="gos-card" style={{ padding: 0, overflow: "hidden" }}>
            {snaps.length === 0 ? (
              <EmptyState title="Aucun snapshot" hint="Ajoute un snapshot de mesure." />
            ) : (
              <table className="gos-table">
                <thead><tr><th>Période</th><th>Alerte</th><th>Revenu</th><th>Δ Rev</th><th>Spend</th><th>Δ Spend</th><th>CAC</th><th>Δ CAC</th><th>MER</th><th>GP</th></tr></thead>
                <tbody>
                  {snaps.map((s) => {
                    const v = (s.variance_pct ?? {}) as any;
                    const cls = (n: any) => n == null ? "" : n < 0 ? "#c1121f" : "#0f8a44";
                    return (
                      <tr key={s.id}>
                        <td>{s.period_label}<div style={{ fontSize: 11, color: "var(--tdia-muted)" }}>{s.period_start} → {s.period_end}</div></td>
                        <td><span style={{ padding: "2px 8px", borderRadius: 999, background: (ALERT_COLOR[s.alert_level ?? "GREEN"]) + "33", color: ALERT_COLOR[s.alert_level ?? "GREEN"], fontSize: 11, fontWeight: 600 }}>{s.alert_level}</span></td>
                        <td>{s.actual_revenue != null ? `${Number(s.actual_revenue).toLocaleString()} $` : "—"}</td>
                        <td style={{ color: cls(v.revenue), fontWeight: 600 }}>{v.revenue != null ? `${v.revenue > 0 ? "+" : ""}${v.revenue}%` : "—"}</td>
                        <td>{s.actual_ad_spend != null ? `${Number(s.actual_ad_spend).toLocaleString()} $` : "—"}</td>
                        <td style={{ color: cls(-v.ad_spend), fontWeight: 600 }}>{v.ad_spend != null ? `${v.ad_spend > 0 ? "+" : ""}${v.ad_spend}%` : "—"}</td>
                        <td>{s.actual_cac ?? "—"}</td>
                        <td style={{ color: cls(-v.cac), fontWeight: 600 }}>{v.cac != null ? `${v.cac > 0 ? "+" : ""}${v.cac}%` : "—"}</td>
                        <td>{s.actual_mer != null ? `${s.actual_mer}x` : "—"}</td>
                        <td>{s.actual_gross_profit != null ? `${Number(s.actual_gross_profit).toLocaleString()} $` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "tests" && (
        <>
          {showTest && (
            <div className="gos-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouveau test</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <F label="Nom"><input className="gos-input" value={testForm.test_name} onChange={(e) => setTestForm({ ...testForm, test_name: e.target.value })} /></F>
                <F label="Type"><input className="gos-input" value={testForm.test_type} onChange={(e) => setTestForm({ ...testForm, test_type: e.target.value })} /></F>
                <F label="Métrique primaire"><input className="gos-input" value={testForm.primary_metric} onChange={(e) => setTestForm({ ...testForm, primary_metric: e.target.value })} placeholder="e.g. CVR" /></F>
                <div style={{ gridColumn: "span 3" }}><F label="Hypothèse"><textarea className="gos-input" rows={2} value={testForm.hypothesis} onChange={(e) => setTestForm({ ...testForm, hypothesis: e.target.value })} /></F></div>
                <F label="Variante A"><input className="gos-input" value={testForm.variant_a} onChange={(e) => setTestForm({ ...testForm, variant_a: e.target.value })} /></F>
                <F label="Variante B"><input className="gos-input" value={testForm.variant_b} onChange={(e) => setTestForm({ ...testForm, variant_b: e.target.value })} /></F>
                <div />
                <F label="Début"><input className="gos-input" type="date" value={testForm.start_date} onChange={(e) => setTestForm({ ...testForm, start_date: e.target.value })} /></F>
                <F label="Fin"><input className="gos-input" type="date" value={testForm.end_date} onChange={(e) => setTestForm({ ...testForm, end_date: e.target.value })} /></F>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button className="gos-btn-primary" onClick={submitTest}>Créer</button>
                <button className="gos-btn-secondary" onClick={() => setShowTest(false)}>Annuler</button>
              </div>
            </div>
          )}

          <div className="gos-card" style={{ padding: 0, overflow: "hidden" }}>
            {tests.length === 0 ? (
              <EmptyState title="Aucun test" hint="Structure tes tests A/B ici." />
            ) : (
              <table className="gos-table">
                <thead><tr><th>Test</th><th>Type</th><th>Métrique</th><th>Période</th><th>Statut</th><th>Winner</th><th>Lift %</th><th>Apprentissage</th></tr></thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.test_name}</div>
                        {t.hypothesis && <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 2 }}>{t.hypothesis}</div>}
                      </td>
                      <td>{t.test_type ?? "—"}</td>
                      <td>{t.primary_metric ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{t.start_date ?? "—"} → {t.end_date ?? "—"}</td>
                      <td>
                        <select className="gos-input" style={{ padding: "4px 6px", fontSize: 12 }} value={t.status ?? "PLANNED"} onChange={(e) => updateTest(t.id, { status: e.target.value })}>
                          {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <input className="gos-input" style={{ padding: "4px 6px", fontSize: 12, width: 80 }} defaultValue={t.winner ?? ""} onBlur={(e) => updateTest(t.id, { winner: e.target.value || null })} />
                      </td>
                      <td>
                        <input className="gos-input" style={{ padding: "4px 6px", fontSize: 12, width: 80 }} type="number" step="0.1" defaultValue={t.lift_pct ?? ""} onBlur={(e) => updateTest(t.id, { lift_pct: e.target.value === "" ? null : Number(e.target.value) })} />
                      </td>
                      <td>
                        <input className="gos-input" style={{ padding: "4px 6px", fontSize: 12 }} defaultValue={t.learning ?? ""} onBlur={(e) => updateTest(t.id, { learning: e.target.value || null })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <IncrementalityV2Panel clientId={clientId!} tests={tests} onDone={load} />
        </>
      )}
    </>
  );
}


function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}

function IncrementalityV2Panel({ clientId, tests, onDone }: { clientId: string; tests: Test[]; onDone: () => void }) {
  const [testId, setTestId] = useState<string>("");
  const [metricType, setMetricType] = useState<MetricType>("BINARY");
  const [alpha, setAlpha] = useState("0.05");
  const [nC, setNC] = useState(""); const [nV, setNV] = useState("");
  const [xC, setXC] = useState(""); const [xV, setXV] = useState("");
  const [mC, setMC] = useState(""); const [mV, setMV] = useState("");
  const [sC, setSC] = useState(""); const [sV, setSV] = useState("");
  const [result, setResult] = useState<ReturnType<typeof runIncrementalityV2> | null>(null);
  const [saving, setSaving] = useState(false);

  const num = (v: string) => v === "" ? null : Number(v);

  const compute = () => {
    if (!nC || !nV) { toast.error("Tailles d'échantillon requises"); return; }
    const out = runIncrementalityV2({
      metric_type: metricType,
      control_sample_size: Number(nC),
      variant_sample_size: Number(nV),
      control_conversions: num(xC), variant_conversions: num(xV),
      control_mean: num(mC), variant_mean: num(mV),
      control_std: num(sC), variant_std: num(sV),
      significance_level: Number(alpha) || 0.05,
    });
    setResult(out);
    if (out.missing_data.length) toast.error("Données manquantes: " + out.missing_data.join(", "));
    else toast.success(`Engine v2 · ${out.recommendation.slice(0, 60)}…`);
  };

  const persist = async () => {
    if (!result || !testId) { toast.error("Selectionne un test et lance l'engine"); return; }
    setSaving(true);
    try {
      const test = tests.find((item) => item.id === testId);
      await runAndSaveIncrementalityForTest(clientId, {
        test_id: testId,
        test_name: test?.test_name ?? null,
        metric_type: metricType,
        control_sample_size: nC,
        variant_sample_size: nV,
        control_conversions: xC,
        variant_conversions: xV,
        control_mean: mC,
        variant_mean: mV,
        control_std: sC,
        variant_std: sV,
        significance_level: alpha,
      });
      toast.success("Test mis a jour avec resultats statistiques");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur incrementality");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gos-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sigma size={16} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>Moteur d'incrémentalité v2</div>
        <span style={{ fontSize: 11, color: "var(--tdia-muted)" }}>
          Test de proportions (binaire) ou Welch (continu) · IC 95% · MDE · puissance
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <F label="Test lié">
          <select className="gos-input" value={testId} onChange={(e) => setTestId(e.target.value)}>
            <option value="">— sélectionner —</option>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.test_name}</option>)}
          </select>
        </F>
        <F label="Type de métrique">
          <select className="gos-input" value={metricType} onChange={(e) => setMetricType(e.target.value as MetricType)}>
            <option value="BINARY">Binaire (CVR)</option>
            <option value="CONTINUOUS">Continue (AOV, RPU)</option>
          </select>
        </F>
        <F label="α (seuil)">
          <input className="gos-input" type="number" step="0.01" value={alpha} onChange={(e) => setAlpha(e.target.value)} />
        </F>
        <div />
        <F label="n Contrôle"><input className="gos-input" type="number" value={nC} onChange={(e) => setNC(e.target.value)} /></F>
        <F label="n Variante"><input className="gos-input" type="number" value={nV} onChange={(e) => setNV(e.target.value)} /></F>
        {metricType === "BINARY" ? (
          <>
            <F label="Conversions C"><input className="gos-input" type="number" value={xC} onChange={(e) => setXC(e.target.value)} /></F>
            <F label="Conversions V"><input className="gos-input" type="number" value={xV} onChange={(e) => setXV(e.target.value)} /></F>
          </>
        ) : (
          <>
            <F label="Moyenne C"><input className="gos-input" type="number" step="0.01" value={mC} onChange={(e) => setMC(e.target.value)} /></F>
            <F label="Moyenne V"><input className="gos-input" type="number" step="0.01" value={mV} onChange={(e) => setMV(e.target.value)} /></F>
            <F label="Écart-type C"><input className="gos-input" type="number" step="0.01" value={sC} onChange={(e) => setSC(e.target.value)} /></F>
            <F label="Écart-type V"><input className="gos-input" type="number" step="0.01" value={sV} onChange={(e) => setSV(e.target.value)} /></F>
          </>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="gos-btn-primary" onClick={compute}>Calculer</button>
        <button className="gos-btn-secondary" onClick={persist} disabled={!result || !testId || saving}>
          {saving ? "..." : "Enregistrer sur le test"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Lift relatif" value={`${result.relative_lift_pct > 0 ? "+" : ""}${result.relative_lift_pct}%`} color={result.relative_lift_pct >= 0 ? "#0f8a44" : "#c1121f"} />
          <Kpi label="p-value" value={result.p_value.toFixed(4)} color={result.significant ? "#0f8a44" : "#a8730a"} />
          <Kpi label="Puissance" value={`${(result.statistical_power * 100).toFixed(0)}%`} color={result.statistical_power >= 0.8 ? "#0f8a44" : "#a8730a"} />
          <Kpi label="MDE atteignable" value={`${result.mde_relative}%`} />
          <Kpi label="IC 95% bas" value={result.ci_low.toFixed(4)} />
          <Kpi label="IC 95% haut" value={result.ci_high.toFixed(4)} />
          <Kpi label="Statistique" value={result.test_statistic.toFixed(3)} />
          <Kpi label="Décision" value={result.winner} color={result.winner === "VARIANT" ? "#0f8a44" : result.winner === "CONTROL" ? "#c1121f" : "#a8730a"} />
          <div style={{ gridColumn: "span 4", padding: 12, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8, fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommandation</div>
            <div>{result.recommendation}</div>
            {result.risks.length > 0 && <div style={{ marginTop: 8, color: "#c1121f", fontSize: 12 }}>⚠ {result.risks.join(" · ")}</div>}
            {result.conditions.length > 0 && <div style={{ marginTop: 4, color: "#a8730a", fontSize: 12 }}>ⓘ {result.conditions.join(" · ")}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--tdia-text)", marginTop: 2 }}>{value}</div>
    </div>
  );
}
