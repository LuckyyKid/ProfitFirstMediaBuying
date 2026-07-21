import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState, DataModeBadge, DataQualityBadge } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Brain, Sparkles, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { DATA_MODE_META, computeDataQualityScore, checklistFor, type DataMode, forecastWarning } from "@/gos/dataMode";
import { computeSourceHealth, type DataSource } from "@/gos/dataSources";

type Snapshot = {
  id: string;
  snapshot_date: string;
  health_score: number | null;
  health_grade: string | null;
  momentum: string | null;
  key_metrics: any;
  strengths: any;
  weaknesses: any;
  alerts: any;
  recommendations: any;
  learning_count: number | null;
  summary: string | null;
  created_at: string;
};

const gradeFromScore = (s: number) => s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F";
const gradeColor = (g: string | null) => g === "A" ? "#0f8a44" : g === "B" ? "#7dc242" : g === "C" ? "#f2b13a" : g === "D" ? "#e07a2b" : "#c1121f";

export default function ClientIntelligence() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [fi, setFi] = useState<any>(null);
  const [qb, setQb] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, s, f, q, ds] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_client_intelligence_snapshots").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_data_sources").select("*").eq("client_id", clientId),
    ]);
    if (c.data) { setClient(c.data); setSelectedClient(c.data as any); }
    setFi(f.data); setQb(q.data);
    setSnapshots((s.data ?? []) as Snapshot[]);
    setDataSources((ds.data ?? []) as DataSource[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const sourceHealth = useMemo(
    () => client ? computeSourceHealth(dataSources, client.business_type) : null,
    [dataSources, client]
  );

  const dqsInfo = useMemo(() => {
    if (!client) return null;
    const bt = client.business_type;
    const filled: Record<string, unknown> = bt === "LOCAL_SERVICE" ? {
      leads_30d: qb?.leads_30d, qualified_leads_30d: qb?.qualified_leads_30d,
      booked_appts_30d: qb?.booked_appointments_30d, jobs_closed_30d: qb?.jobs_closed_30d,
      revenue_30d: qb?.revenue_30d, ad_spend_30d: qb?.ad_spend_30d,
      avg_job_value: fi?.avg_job_value ?? fi?.aov, gross_margin_percent: fi?.gross_margin_percent,
      close_rate: fi?.target_close_rate, capacity_per_week: fi?.capacity_per_week,
    } : {
      revenue_30d: qb?.revenue_30d, ad_spend_30d: qb?.ad_spend_30d, orders_30d: qb?.orders_30d,
      aov: fi?.aov, cac_or_new_customers: qb?.new_customers_30d,
      mer_or_roas: qb?.mer_30d ?? qb?.roas_30d,
      gross_margin_percent: fi?.gross_margin_percent, target_cac: fi?.target_cac,
      product_to_push: fi?.product_to_push, product_to_avoid: fi?.product_to_avoid,
      inventory_risk: fi?.inventory_risk_notes,
    };
    return computeDataQualityScore({
      businessType: bt,
      mode: (client.data_mode || "DEMO_DATA") as DataMode,
      filled,
      baselineUpdatedAt: qb?.updated_at,
      sources: sourceHealth ? { ...sourceHealth, missingCore: sourceHealth.missingCore as string[] } : null,
    });
  }, [client, fi, qb, sourceHealth]);


  const compute = async () => {
    if (!clientId) return;
    setComputing(true);
    try {
      // Fetch all signals in parallel
      const [diag, targets, reviews, meas, learnings, plans, updates] = await Promise.all([
        supabase.from("gos_diagnoses").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
        supabase.from("gos_metric_targets").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
        supabase.from("gos_live_optimization_reviews").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
        supabase.from("gos_measurement_snapshots").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
        supabase.from("gos_learning_entries").select("*").eq("client_id", clientId).eq("status", "ACTIVE"),
        supabase.from("gos_next_cycle_plans").select("*").eq("client_id", clientId).eq("status", "ACTIVE").limit(1),
        supabase.from("gos_forecast_updates").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(3),
      ]);

      // Deterministic health scoring
      let score = 60;
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const alerts: any[] = [];
      const recommendations: string[] = [];

      // Reviews health
      const rReviews = reviews.data ?? [];
      const onTrackCount = rReviews.filter((r: any) => r.health_verdict === "ON_TRACK" || r.health_verdict === "AHEAD").length;
      const crisisCount = rReviews.filter((r: any) => r.health_verdict === "CRISIS" || r.health_verdict === "OFF_TRACK").length;
      if (rReviews.length > 0) {
        score += (onTrackCount / rReviews.length) * 20;
        score -= (crisisCount / rReviews.length) * 25;
        if (onTrackCount >= 3) strengths.push(`${onTrackCount} reviews récentes ON_TRACK/AHEAD`);
        if (crisisCount >= 2) {
          weaknesses.push(`${crisisCount} reviews en CRISIS/OFF_TRACK`);
          alerts.push({ level: "HIGH", message: "Multiples reviews en crise — intervention immédiate requise" });
        }
      } else {
        weaknesses.push("Aucune Live Optimization Review");
        recommendations.push("Lancer un rythme de reviews hebdomadaires");
      }

      // Measurements
      const rMeas = meas.data ?? [];
      const alertMeas = rMeas.filter((m: any) => m.alert_level === "RED" || m.alert_level === "AMBER").length;
      if (alertMeas > 0) {
        weaknesses.push(`${alertMeas} snapshot(s) de mesure en alerte`);
        score -= alertMeas * 4;
      }

      // Learnings velocity
      const learningCount = (learnings.data ?? []).length;
      if (learningCount >= 10) { strengths.push(`${learningCount} apprentissages actifs`); score += 8; }
      else if (learningCount >= 3) { score += 4; }
      else { weaknesses.push("Peu d'apprentissages capturés"); recommendations.push("Capturer plus de learnings pour nourrir le prochain cycle"); }

      // Active plan
      if ((plans.data ?? []).length > 0) { strengths.push("Plan de cycle actif"); score += 5; }
      else { recommendations.push("Créer un plan de cycle pour cadrer les prochaines semaines"); }

      // Diagnosis
      if (!diag.data?.[0]) { weaknesses.push("Aucun diagnostic récent"); recommendations.push("Lancer un Growth Diagnosis"); score -= 5; }

      // Targets
      if ((targets.data ?? []).length === 0) { weaknesses.push("Aucun metric target défini"); score -= 5; }
      else strengths.push(`${targets.data!.length} metric target(s) suivis`);

      // Momentum from forecast updates
      let momentum = "STABLE";
      const rUpdates = updates.data ?? [];
      if (rUpdates.length > 0) {
        const avgDelta = rUpdates.reduce((s: number, u: any) => s + (Number(u.delta_revenue_pct) || 0), 0) / rUpdates.length;
        if (avgDelta > 5) momentum = "ACCELERATING";
        else if (avgDelta < -5) momentum = "SLOWING";
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      const grade = gradeFromScore(score);

      const key_metrics = {
        reviews_total: rReviews.length,
        reviews_on_track: onTrackCount,
        reviews_crisis: crisisCount,
        measurements_alert: alertMeas,
        active_learnings: learningCount,
        active_plans: (plans.data ?? []).length,
        metric_targets: (targets.data ?? []).length,
        recent_forecast_updates: rUpdates.length,
      };

      const summary = `Score ${score}/100 (${grade}) · Momentum ${momentum} · ${learningCount} learnings · ${rReviews.length} reviews (${onTrackCount} on-track, ${crisisCount} crisis).`;

      const activeCycle = plans.data?.[0]?.id ?? null;

      const { error } = await supabase.from("gos_client_intelligence_snapshots").insert({
        client_id: clientId,
        health_score: score,
        health_grade: grade,
        momentum,
        key_metrics,
        strengths,
        weaknesses,
        alerts,
        recommendations,
        learning_count: learningCount,
        active_cycle_id: activeCycle,
        summary,
        computed_by: "DETERMINISTIC",
      });
      if (error) throw error;
      toast.success(`Snapshot généré — Score ${score} (${grade})`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de calcul");
    } finally {
      setComputing(false);
    }
  };

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  const latest = snapshots[0];

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Snapshot de santé en langage clair : sommes-nous dans les temps, quel est le problème actuel, le P0, ce qui a changé, la suite.",
          dataSource: "Diagnostic · Objectifs · Revues · Mesure · Apprentissages · Plans · Mises à jour prévisions.",
          usedBy: "Point client hebdo AM · Revues de statut leadership.",
          nextStep: "Génère un snapshot avant chaque point de statut client.",
          primaryCta: "Générer un snapshot",
        }}
        title="Client Intelligence"
        subtitle="Synthèse déterministe de la santé du compte : score, momentum, forces, alertes et recommandations."
        actions={
          <>
            <DataModeBadge mode={client?.data_mode} />
            <DataQualityBadge score={dqsInfo?.score ?? client?.data_quality_score ?? null} />
            <button className="gos-btn-secondary" onClick={load}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser</button>
            <button className="gos-btn-primary" onClick={compute} disabled={computing}>
              <Sparkles size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> {computing ? "Calcul…" : "Générer un snapshot"}
            </button>
          </>
        }
      />

      {client && (() => {
        const dm = (client.data_mode || "DEMO_DATA") as DataMode;
        const meta = DATA_MODE_META[dm];
        const warn = forecastWarning(dm);
        return (
          <div className="gos-card" style={{ marginBottom: 16, borderLeft: `3px solid ${meta.color}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em" }}>DATA SOURCING</div>
              <DataModeBadge mode={dm} />
              <DataQualityBadge score={dqsInfo?.score ?? null} />
              <span style={{ fontSize: 11, color: "var(--tdia-muted)" }}>Forecast confidence cap: {meta.confidenceCap}%</span>
              <Link to={`/admin/gos/clients/${clientId}/manual-checklist`} style={{ marginLeft: "auto", fontSize: 12, color: "var(--tdia-blue)" }}>Open Manual Checklist →</Link>
            </div>
            {warn && (
              <div style={{ fontSize: 12, color: "#a8730a", background: "#fff4d9", padding: "8px 10px", borderRadius: 6, marginBottom: 8 }}>
                ⚠ {warn}
              </div>
            )}
            {dqsInfo && dqsInfo.missing.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>
                <b style={{ color: "#c1121f" }}>Missing data blocking better prediction:</b> {dqsInfo.missing.join(" · ")}
              </div>
            )}
          </div>
        );
      })()}

      {client && sourceHealth && (
        <div className="gos-card" style={{ marginBottom: 16, borderLeft: "3px solid var(--tdia-blue)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em" }}>DATA SOURCE HEALTH</div>
            <Link to="/admin/gos/data-sources" style={{ marginLeft: "auto", fontSize: 12, color: "var(--tdia-blue)" }}>Ouvrir Sources de données →</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, fontSize: 12 }}>
            <MiniStat label="Sources" value={sourceHealth.total} />
            <MiniStat label="API" value={sourceHealth.api} tone={sourceHealth.api > 0 ? "ok" : undefined} />
            <MiniStat label="Manuelles" value={sourceHealth.manual} />
            <MiniStat label="Stale" value={sourceHealth.stale} tone={sourceHealth.stale > 0 ? "warn" : undefined} />
            <MiniStat label="Manquantes" value={sourceHealth.missing} tone={sourceHealth.missing > 0 ? "danger" : undefined} />
            <MiniStat label="Fiabilité moy." value={`${sourceHealth.avgReliability}%`} />
          </div>
          {sourceHealth.missingCore.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#c1121f" }}>
              <b>Sources critiques manquantes :</b> {sourceHealth.missingCore.join(" · ")}
              <span style={{ color: "var(--tdia-muted)", marginLeft: 6 }}>
                → limite la fiabilité des forecasts.
              </span>
            </div>
          )}
          {sourceHealth.total === 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--tdia-muted)" }}>
              Aucune source enregistrée. Ajoute-les depuis <b>Sources de données</b> pour améliorer le Data Quality Score.
            </div>
          )}
        </div>
      )}


      {!latest ? (
        <div className="gos-card"><EmptyState title="Aucun snapshot" hint="Génère ta première synthèse — elle agrège reviews, mesures, learnings, plans et mises à jour de forecast." /></div>
      ) : (
        <>
          <div className="gos-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{
                width: 110, height: 110, borderRadius: "50%",
                background: `conic-gradient(${gradeColor(latest.health_grade)} ${(latest.health_score ?? 0) * 3.6}deg, hsl(220 45% 16%) 0)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 92, height: 92, borderRadius: "50%", background: "hsl(220 45% 14%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: gradeColor(latest.health_grade) }}>{latest.health_grade}</div>
                  <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>{latest.health_score}/100</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Brain size={18} />
                  <div style={{ fontSize: 18, fontWeight: 600 }}>Snapshot du {new Date(latest.snapshot_date).toLocaleDateString()}</div>
                  <MomentumBadge m={latest.momentum} />
                </div>
                <div style={{ fontSize: 14, color: "var(--tdia-muted)", marginBottom: 12 }}>{latest.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {latest.key_metrics && Object.entries(latest.key_metrics).map(([k, v]) => (
                    <div key={k} style={{ padding: 8, background: "hsl(220 45% 14%)", borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600 }}>{k.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="gos-card" style={{ marginBottom: 16, borderLeft: "3px solid var(--tdia-blue)" }}>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 8 }}>
              Plain-language read — for the AM
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 13 }}>
              <PlainCell label="Sommes-nous dans les temps ?" value={
                (latest.health_score ?? 0) >= 70 ? "Oui — dans les temps." :
                (latest.health_score ?? 0) >= 55 ? "Partiellement — dérive." : "Non — sous le plan."
              } tone={(latest.health_score ?? 0) >= 70 ? "good" : (latest.health_score ?? 0) >= 55 ? "warn" : "bad"} />
              <PlainCell label="Problème actuel" value={(Array.isArray(latest.weaknesses) && latest.weaknesses[0]) || "Aucun signalé"} />
              <PlainCell label="Focus P0" value={(Array.isArray(latest.recommendations) && latest.recommendations[0]) || "Maintenir le rythme actuel"} tone="accent" />
              <PlainCell label="Action requise" value={
                Array.isArray(latest.alerts) && latest.alerts.length > 0
                  ? `${latest.alerts.length} alert${latest.alerts.length > 1 ? "s" : ""} — see below`
                  : "Aucune alerte urgente"
              } tone={Array.isArray(latest.alerts) && latest.alerts.length > 0 ? "bad" : "good"} />
              <PlainCell label="Ce qui a changé" value={
                latest.momentum === "ACCELERATING" ? "Momentum en accélération vs cycle précédent." :
                latest.momentum === "SLOWING" ? "Momentum en ralentissement vs cycle précédent." : "Stable vs cycle précédent."
              } />
              <PlainCell label="Prochaine étape" value={
                (Array.isArray(latest.recommendations) && latest.recommendations[1])
                  || "Lancer la prochaine revue Optimisation live."
              } />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            <SignalCard title="Forces" icon={<TrendingUp size={14} />} items={Array.isArray(latest.strengths) ? latest.strengths : []} color="#0f8a44" />
            <SignalCard title="Faiblesses" icon={<TrendingDown size={14} />} items={Array.isArray(latest.weaknesses) ? latest.weaknesses : []} color="#e07a2b" />
            <SignalCard title="Recommandations" icon={<Sparkles size={14} />} items={Array.isArray(latest.recommendations) ? latest.recommendations : []} color="#5b8def" />
          </div>

          {Array.isArray(latest.alerts) && latest.alerts.length > 0 && (
            <div className="gos-card" style={{ marginBottom: 16, borderColor: "hsl(0 72% 60%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#c1121f" />
                <div style={{ fontWeight: 600 }}>Alertes</div>
              </div>
              {latest.alerts.map((a: any, i: number) => (
                <div key={i} style={{ padding: 8, background: "hsl(0 84% 96%)", borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, marginRight: 6 }}>[{a.level}]</span>{a.message}
                </div>
              ))}
            </div>
          )}

          {snapshots.length > 1 && (
            <div className="gos-card">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Historique</div>
              <div style={{ display: "grid", gap: 6 }}>
                {snapshots.slice(1).map(s => (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "120px 60px 120px 1fr", gap: 12, padding: 8, background: "hsl(220 45% 14%)", borderRadius: 6, fontSize: 13 }}>
                    <div>{new Date(s.snapshot_date).toLocaleDateString()}</div>
                    <div style={{ fontWeight: 700, color: gradeColor(s.health_grade) }}>{s.health_grade} · {s.health_score}</div>
                    <div style={{ color: "var(--tdia-muted)" }}>{s.momentum}</div>
                    <div style={{ color: "var(--tdia-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--tdia-muted)" }}>
        Score déterministe — agrège reviews Live Optimization, snapshots de Measurement, learnings actifs, plans de cycle et mises à jour de forecast.
      </div>
    </>
  );
}

function SignalCard({ title, icon, items, color }: { title: string; icon: React.ReactNode; items: string[]; color: string }) {
  return (
    <div className="gos-card">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color }}>{icon}<div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div></div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>—</div> : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 4 }}>
          {items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}
function MomentumBadge({ m }: { m: string | null }) {
  if (!m) return null;
  const color = m === "ACCELERATING" ? "#0f8a44" : m === "SLOWING" ? "#c1121f" : "hsl(0 0% 40%)";
  return <span style={{ padding: "2px 10px", background: `${color}30`, color, borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em" }}>{m}</span>;
}

function PlainCell({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" | "accent" }) {
  const color = tone === "good" ? "#0f8a44" : tone === "warn" ? "#a8730a" : tone === "bad" ? "#c1121f" : tone === "accent" ? "var(--tdia-blue)" : "var(--tdia-text)";
  return (
    <div style={{ padding: 8, background: "hsl(220 45% 14%)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ color, fontWeight: 500, lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "#0f8a44" : tone === "warn" ? "#a8730a" : tone === "danger" ? "#c1121f" : "var(--tdia-text)";
  return (
    <div style={{ padding: 8, background: "hsl(220 45% 14%)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ color, fontWeight: 600, fontSize: 16 }}>{value}</div>
    </div>
  );
}
