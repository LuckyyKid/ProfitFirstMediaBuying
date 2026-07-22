import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { MarkBlockDoneButton } from "@/gos/workflow";
import { toast } from "sonner";
import { Activity, Play, RefreshCw } from "lucide-react";

type Diagnosis = {
  id: string;
  problem_type: string | null;
  severity: string | null;
  primary_bottleneck: string | null;
  bottleneck_details: any;
  contributing_factors: any;
  recommended_focus: string | null;
  confidence_score: number | null;
  inputs_snapshot: any;
  status: string | null;
  notes: string | null;
  created_at: string;
};

/**
 * Deterministic diagnosis engine.
 * Reads client + baseline + financial inputs and classifies the growth problem.
 * No LLM. Pure rules.
 */
function runDiagnosis(client: any, fi: any, qb: any) {
  const isEcom = client.business_type === "ECOMMERCE" || client.business_type === "HYBRID";
  const isLocal = client.business_type === "LOCAL_SERVICE" || client.business_type === "HYBRID";
  const factors: string[] = [];
  let bottleneck = "UNKNOWN";
  let bottleneckDetails: Record<string, any> = {};
  let problemType = "INSUFFICIENT_DATA";
  let severity = "UNKNOWN";
  let confidence = 0.3;
  let focus = "Complete Growth Model Setup to enable full diagnosis.";

  if (isEcom && fi && qb) {
    const cac = qb.ad_spend_30d && qb.orders_30d ? qb.ad_spend_30d / qb.orders_30d : null;
    const mer = qb.revenue_30d && qb.ad_spend_30d ? qb.revenue_30d / qb.ad_spend_30d : null;
    const cvr = qb.orders_30d && qb.sessions_30d ? (qb.orders_30d / qb.sessions_30d) * 100 : null;
    bottleneckDetails = { cac, mer, cvr, target_cac: fi.target_cac, target_mer: fi.target_mer, target_cvr: fi.target_cvr };

    if (cac != null && fi.target_cac && cac > fi.target_cac * 1.25) {
      factors.push(`CAC actuel (${cac.toFixed(2)}) dépasse la cible (${fi.target_cac}) de plus de 25%`);
    }
    if (mer != null && fi.target_mer && mer < fi.target_mer * 0.85) {
      factors.push(`MER actuel (${mer.toFixed(2)}) sous la cible (${fi.target_mer})`);
    }
    if (cvr != null && fi.target_cvr && cvr < fi.target_cvr * 0.85) {
      factors.push(`Taux de conversion (${cvr.toFixed(2)}%) sous la cible (${fi.target_cvr}%)`);
    }

    // Classification
    if (cvr != null && fi.target_cvr && cvr < fi.target_cvr * 0.7) {
      bottleneck = "CONVERSION";
      problemType = "CONVERSION_RATE_TOO_LOW";
      severity = "HIGH";
      focus = "Prioriser CRO: audit landing, offer test, checkout friction.";
      confidence = 0.8;
    } else if (cac != null && fi.target_cac && cac > fi.target_cac * 1.5) {
      bottleneck = "ACQUISITION_COST";
      problemType = "CAC_TOO_HIGH";
      severity = "HIGH";
      focus = "Refonte créative + audience: nouveaux angles, ICP fit, retargeting.";
      confidence = 0.75;
    } else if (mer != null && fi.target_mer && mer < fi.target_mer) {
      bottleneck = "PROFITABILITY";
      problemType = "MARGIN_PRESSURE";
      severity = "MEDIUM";
      focus = "Améliorer AOV/marge: bundles, upsell, prix, mix produit.";
      confidence = 0.7;
    } else if (qb.revenue_30d && fi.target_monthly_revenue && qb.revenue_30d < fi.target_monthly_revenue * 0.7) {
      bottleneck = "SCALE";
      problemType = "UNDER_SCALED_SPEND";
      severity = "MEDIUM";
      focus = "Augmenter spend graduellement en gardant CAC sous cible.";
      confidence = 0.65;
    } else {
      bottleneck = "OPTIMIZATION";
      problemType = "HEALTHY_OPTIMIZE";
      severity = "LOW";
      focus = "Système sain — tester incréments (créatifs, offres, LTV).";
      confidence = 0.7;
    }
  } else if (isLocal && fi && qb) {
    const cpl = qb.ad_spend_30d && qb.leads_30d ? qb.ad_spend_30d / qb.leads_30d : null;
    const closeRate = qb.leads_30d && qb.jobs_closed_30d ? (qb.jobs_closed_30d / qb.leads_30d) * 100 : null;
    bottleneckDetails = { cpl, close_rate: closeRate, target_cpl: fi.target_cpl, target_close_rate: fi.target_close_rate };

    if (cpl != null && fi.target_cpl && cpl > fi.target_cpl * 1.25) {
      factors.push(`CPL (${cpl.toFixed(2)}) dépasse la cible (${fi.target_cpl})`);
    }
    if (closeRate != null && fi.target_close_rate && closeRate < fi.target_close_rate * 0.85) {
      factors.push(`Taux de closing (${closeRate.toFixed(1)}%) sous la cible (${fi.target_close_rate}%)`);
    }

    if (closeRate != null && fi.target_close_rate && closeRate < fi.target_close_rate * 0.7) {
      bottleneck = "SALES_CLOSING";
      problemType = "LOW_CLOSE_RATE";
      severity = "HIGH";
      focus = "Vente & suivi: scripts, vitesse de rappel, qualification.";
      confidence = 0.8;
    } else if (cpl != null && fi.target_cpl && cpl > fi.target_cpl * 1.5) {
      bottleneck = "LEAD_COST";
      problemType = "CPL_TOO_HIGH";
      severity = "HIGH";
      focus = "Créatifs + audience locale + landing spécifique service.";
      confidence = 0.75;
    } else {
      bottleneck = "OPTIMIZATION";
      problemType = "HEALTHY_OPTIMIZE";
      severity = "LOW";
      focus = "Système sain — augmenter capacité et volume de leads.";
      confidence = 0.7;
    }
  }

  return {
    problem_type: problemType,
    severity,
    primary_bottleneck: bottleneck,
    bottleneck_details: bottleneckDetails,
    contributing_factors: factors,
    recommended_focus: focus,
    confidence_score: confidence,
    inputs_snapshot: {
      business_type: client.business_type,
      financial_inputs: fi,
      quantitative_baseline: qb,
    },
    status: "DRAFT",
  };
}

export default function GrowthDiagnosis() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [fi, setFi] = useState<any>(null);
  const [qb, setQb] = useState<any>(null);
  const [current, setCurrent] = useState<Diagnosis | null>(null);
  const [history, setHistory] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, f, q, d] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_diagnoses").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) { setClient(c.data); setSelectedClient(c.data as any); }
    setFi(f.data); setQb(q.data);
    const list = (d.data ?? []) as Diagnosis[];
    setHistory(list);
    setCurrent(list[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const runNew = async () => {
    if (!client) return;
    setRunning(true);
    const started = Date.now();
    const payload = runDiagnosis(client, fi, qb);
    const { data, error } = await supabase
      .from("gos_diagnoses")
      .insert({ client_id: clientId!, ...payload })
      .select()
      .single();
    // best-effort model_runs log
    await supabase.from("model_runs").insert({
      run_type: "gos_growth_diagnosis",
      status: error ? "error" : "success",
      duration_ms: Date.now() - started,
      input_payload: { client_id: clientId, business_type: client.business_type },
      output_payload: payload as any,
      error_message: error?.message ?? null,
    } as any);
    setRunning(false);
    if (error) { toast.error("Diagnostic échoué: " + error.message); return; }
    toast.success("Diagnostic généré");
    setCurrent(data as any);
    load();
  };

  if (loading || !client) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  const ready = !!(fi && qb);
  const factors: string[] = Array.isArray(current?.contributing_factors) ? current!.contributing_factors : [];
  const details: Record<string, any> = current?.bottleneck_details && typeof current.bottleneck_details === "object" ? current.bottleneck_details : {};

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Classifie le problème de croissance (Conversion, CAC, Marge, Scale…) et verrouille le focus P0 pour le prochain cycle.",
          dataSource: "Configuration du modèle — Données financières + Baseline quantitative (métriques 30 jours).",
          usedBy: "Objectifs de métriques · Prévisions · Carte d'exécution · Intelligence client.",
          requiredInputs: ["Données financières (PRÊT)", "Baseline quantitative (PRÊT)"],
          missingInputs: [!fi && "Financial Inputs", !qb && "Quantitative Baseline"].filter(Boolean) as string[],
          nextStep: "Lance le diagnostic, revois les signaux déclenchés, puis définis les Objectifs alignés au focus recommandé.",
          primaryCta: "Lancer le diagnostic",
        }}
        title="Diagnostic de croissance"
        subtitle="Classification déterministe du problème de croissance à partir des inputs du client."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={runNew} disabled={running || !ready}>
              <Play size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {running ? "Analyse..." : "Lancer le diagnostic"}
            </button>
            <MarkBlockDoneButton clientId={clientId} blockKey="diagnosis" disabled={!current} />
          </>
        }
      />

      {!ready && (
        <div className="gos-card" style={{ marginBottom: 20, borderColor: "rgba(245, 183, 78, 0.4)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Setup incomplet</div>
          <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>
            Il manque les <b>Financial Inputs</b> et/ou la <b>Quantitative Baseline</b>. Complète le Growth Model Setup pour un diagnostic complet.
          </div>
        </div>
      )}

      {!current ? (
        <div className="gos-card">
          <EmptyState title="Aucun diagnostic" hint="Lance le premier diagnostic pour ce client." />
        </div>
      ) : (
        <section
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--tdia-border)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "none",
          }}
        >
          {/* Cockpit header bar */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--tdia-border)",
              background: "rgba(255, 255, 255, 0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: severityColor(current.severity),
                  boxShadow: `0 0 10px ${severityColor(current.severity)}`,
                  animation: "pulse 2s infinite",
                }}
              />
              <div
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  color: "#eef2fa",
                }}
              >
                Diagnostic de croissance · {new Date(current.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}>
            {/* MAIN PANEL */}
            <div style={{ padding: 24, borderRight: "1px solid var(--tdia-border)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
                <div>
                  <div style={cockpitLabel}>Verdict du moteur</div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 24,
                      fontWeight: 700,
                      color: severityColor(current.severity),
                    }}
                  >
                    {current.problem_type ?? "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={cockpitLabel}>Sévérité</div>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: `${severityColor(current.severity)}1a`,
                        color: severityColor(current.severity),
                        border: `1px solid ${severityColor(current.severity)}55`,
                      }}
                    >
                      {current.severity ?? "—"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={cockpitLabel}>Confiance</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 18, fontWeight: 700, color: "var(--tdia-text)" }}>
                        {current.confidence_score != null ? `${Math.round(current.confidence_score <= 1 ? current.confidence_score * 100 : current.confidence_score)}%` : "—"}
                      </span>
                      <div style={{ width: 48, height: 6, background: "var(--tdia-border)", borderRadius: 999, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${current.confidence_score != null ? Math.round(current.confidence_score <= 1 ? current.confidence_score * 100 : current.confidence_score) : 0}%`,
                            background: "var(--tdia-blue)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottleneck */}
              <div
                style={{
                  marginBottom: 28,
                  padding: 16,
                  background: "rgba(77, 159, 255, 0.06)",
                  borderLeft: "2px solid var(--tdia-blue)",
                  borderRadius: "0 8px 8px 0",
                }}
              >
                <div style={{ ...cockpitLabel, color: "var(--tdia-blue)", marginBottom: 6 }}>Bottleneck principal</div>
                <div style={{ fontSize: 14, color: "var(--tdia-muted)", lineHeight: 1.55 }}>
                  {current.primary_bottleneck ?? "—"}
                </div>
              </div>

              {/* Two-column: factors + focus */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ ...cockpitLabel, color: "#eef2fa", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 3, height: 12, background: "var(--tdia-blue)" }} />
                    Facteurs contributifs
                  </div>
                  {factors.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--tdia-muted)" }}>—</div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                      {factors.map((f, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--tdia-muted)", lineHeight: 1.5 }}>
                          <span style={{ marginTop: 6, width: 6, height: 6, borderRadius: 999, background: "rgba(77, 159, 255, 0.5)", flexShrink: 0 }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid var(--tdia-border)",
                  }}
                >
                  <div style={{ ...cockpitLabel, color: "#eef2fa", marginBottom: 10 }}>Focus recommandé</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#eef2fa", lineHeight: 1.55 }}>
                    {current.recommended_focus ?? "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div style={{ background: "rgba(11, 19, 34, 0.6)" }}>
              <div style={{ padding: 24, borderBottom: "1px solid var(--tdia-border)" }}>
                <div style={cockpitLabel}>Métriques clés</div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.entries(details).length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--tdia-muted)" }}>Aucune métrique</div>
                  )}
                  {renderMetrics(details)}
                </div>
              </div>

              <div style={{ padding: 24 }}>
                <div style={cockpitLabel}>Historique</div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.length <= 1 && (
                    <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>Aucun historique</div>
                  )}
                  {history.slice(0, 6).map((h) => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, gap: 8 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "var(--tdia-muted)" }}>
                        {new Date(h.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      </span>
                      <span style={{ color: "#eef2fa", fontWeight: 500, textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.problem_type ?? "—"}
                      </span>
                      <span style={{ fontWeight: 700, color: severityColor(h.severity) }}>
                        {shortSev(h.severity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

const cockpitLabel: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "#8b97ad",
};

function severityColor(sev: string | null | undefined): string {
  switch ((sev ?? "").toUpperCase()) {
    case "HIGH": return "#ff6b6b";
    case "MEDIUM":
    case "MED": return "#f5b74e";
    case "LOW": return "#3ddc97";
    default: return "#8b97ad";
  }
}

function shortSev(sev: string | null | undefined): string {
  const s = (sev ?? "—").toUpperCase();
  if (s === "MEDIUM") return "MED";
  return s.slice(0, 4);
}

function renderMetrics(details: Record<string, any>) {
  // Pair actual → target where possible (target_*)
  const targetKeys = new Set(Object.keys(details).filter((k) => k.startsWith("target_")));
  const primaryKeys = Object.keys(details).filter((k) => !k.startsWith("target_"));
  return primaryKeys.map((k) => {
    const v = details[k];
    const tKey = `target_${k}`;
    const t = targetKeys.has(tKey) ? details[tKey] : null;
    const nv = typeof v === "number" ? v : null;
    const nt = typeof t === "number" ? t : null;
    let delta: number | null = null;
    if (nv != null && nt != null && nt !== 0) delta = ((nv - nt) / nt) * 100;
    // Direction: for cost metrics (cac, cpl, cpm) higher = worse; else higher = better
    const costMetric = /^(cac|cpl|cpm|cpc)$/i.test(k);
    const isBad = delta != null && (costMetric ? delta > 0 : delta < 0);
    const isGood = delta != null && (costMetric ? delta < 0 : delta > 0);
    const color = delta == null ? "#8b97ad" : isBad ? "#ff6b6b" : isGood ? "#3ddc97" : "#8b97ad";
    return (
      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 12, borderBottom: "1px solid rgba(255, 255, 255, 0.02)" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>{k}</div>
          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 18, fontWeight: 700, color: "var(--tdia-text)" }}>
            {v == null ? "—" : typeof v === "number" ? v.toFixed(2) : String(v)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {delta != null && (
            <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4 }}>
              {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
            </div>
          )}
          {nt != null && (
            <div style={{ fontSize: 10, color: "#8b97ad" }}>Cible: {nt.toFixed(2)}</div>
          )}
        </div>
      </div>
    );
  });
}

