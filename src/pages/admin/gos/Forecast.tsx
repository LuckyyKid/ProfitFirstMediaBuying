import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { MarkBlockDoneButton } from "@/gos/workflow";
import { toast } from "sonner";
import { Play, RefreshCw, AlertTriangle } from "lucide-react";
import { DATA_MODE_META, forecastWarning, type DataMode } from "@/gos/dataMode";
import { projectGrowthScenario, type ForecastProjection } from "@/gos/forecastProjection";

type ClientRecord = Record<string, unknown> & {
  id?: string;
  client_code?: string | null;
  company_name?: string | null;
  name?: string | null;
  business_type?: string | null;
  current_phase?: string | null;
  risk_level?: string | null;
  industry?: string | null;
  am_owner?: string | null;
  launch_target_date?: string | null;
  data_mode?: string | null;
  data_quality_score?: number | null;
};

type SelectedClientRecord = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  industry?: string | null;
  am_owner?: string | null;
  launch_target_date?: string | null;
};

type InputRecord = Record<string, unknown> | null;

type Forecast = {
  id: string;
  scenario: string;
  horizon_days: number;
  projected_revenue: number | null;
  projected_orders: number | null;
  projected_leads: number | null;
  projected_ad_spend: number | null;
  projected_cac: number | null;
  projected_mer: number | null;
  projected_roas: number | null;
  projected_gross_profit: number | null;
  confidence: number | null;
  assumptions: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
};

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
const BG = "rgba(255, 255, 255, 0.02)";
const CARD = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";
const AMBER = "#f5b74e";

function toSelectedClient(row: ClientRecord): SelectedClientRecord {
  return {
    id: String(row.id ?? ""),
    client_code: String(row.client_code ?? ""),
    company_name: String(row.company_name ?? row.name ?? ""),
    business_type: String(row.business_type ?? ""),
    current_phase: String(row.current_phase ?? ""),
    risk_level: String(row.risk_level ?? ""),
    industry: row.industry ?? null,
    am_owner: row.am_owner ?? null,
    launch_target_date: row.launch_target_date ?? null,
  };
}

function project(client: ClientRecord, fi: InputRecord, qb: InputRecord, scenario: string, horizonDays: number) {
  return projectGrowthScenario({ client, financialInputs: fi, quantitativeBaseline: qb, scenario, horizonDays });
}

const fmtMoney = (n: number | null | undefined) => n == null ? "—" : `${Number(n).toLocaleString()} $`;
const fmtNum = (n: number | null | undefined) => n == null ? "—" : Number(n).toLocaleString();
const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const scColor = (sc: string) => sc === "UPSIDE" ? GREEN : sc === "DOWNSIDE" ? RED : BLUE;
const confColor = (c: number) => c >= 70 ? GREEN : c >= 40 ? AMBER : RED;

export default function Forecast() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [fi, setFi] = useState<InputRecord>(null);
  const [qb, setQb] = useState<InputRecord>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [horizon, setHorizon] = useState(30);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, f, q, r] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_forecasts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) {
      const row = c.data as ClientRecord;
      setClient(row);
      setSelectedClient(toSelectedClient(row));
    }
    setFi(f.data as InputRecord); setQb(q.data as InputRecord);
    setForecasts((r.data ?? []) as Forecast[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [clientId]);

  const runAll = async () => {
    if (!client) return;
    setRunning(true);
    const dataMode: DataMode = (client.data_mode || "DEMO_DATA") as DataMode;
    const cap = DATA_MODE_META[dataMode].confidenceCap / 100;
    const rawConf = qb && fi ? 0.7 : 0.35;
    const capped = Math.min(rawConf, cap);
    const rows = ["BASE", "UPSIDE", "DOWNSIDE"].map((sc) => {
      const p = project(client, fi, qb, sc, horizon);
      return {
        client_id: clientId!,
        scenario: sc,
        horizon_days: horizon,
        ...p,
        confidence: capped,
        inputs_snapshot: { business_type: client.business_type, data_mode: dataMode, dqs: client.data_quality_score, fi, qb },
        formula_used: p.assumptions?.formula,
        status: "DRAFT",
      };
    });
    const { error } = await supabase.from("gos_forecasts").insert(rows as never);
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    toast.success("3 scénarios générés");
    load();
  };

  const dm = (client?.data_mode || "DEMO_DATA") as DataMode;
  const dmMeta = DATA_MODE_META[dm];
  const warn = forecastWarning(dm);
  const dqs = client?.data_quality_score ?? null;

  // KPI ribbon values (from latest run of each scenario, else preview from current inputs)
  const latestBySc = useMemo(() => {
    const m: Record<string, Forecast | undefined> = {};
    for (const sc of ["BASE","UPSIDE","DOWNSIDE"]) {
      m[sc] = forecasts.find((f) => f.scenario === sc);
    }
    return m;
  }, [forecasts]);

  const previewBySc = useMemo(() => {
    if (!client) return {} as Record<string, ForecastProjection | undefined>;
    const m: Record<string, ForecastProjection> = {};
    for (const sc of ["BASE","UPSIDE","DOWNSIDE"]) {
      m[sc] = project(client, fi, qb, sc, horizon);
    }
    return m;
  }, [client, fi, qb, horizon]);

  const baseRev = latestBySc.BASE?.projected_revenue ?? previewBySc.BASE?.projected_revenue ?? 0;
  const upRev = latestBySc.UPSIDE?.projected_revenue ?? previewBySc.UPSIDE?.projected_revenue ?? 0;
  const downRev = latestBySc.DOWNSIDE?.projected_revenue ?? previewBySc.DOWNSIDE?.projected_revenue ?? 0;
  const upDelta = upRev - baseRev;
  const downDelta = downRev - baseRev;
  const upPct = baseRev > 0 ? (upDelta / baseRev) * 100 : 0;
  const downPct = baseRev > 0 ? (downDelta / baseRev) * 100 : 0;

  const globalConf = dmMeta.confidenceCap;
  const confBars = Math.round((globalConf / 100) * 4);

  if (loading) return <div style={{ height: 300, background: CARD, borderRadius: 8 }} />;

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "none", overflow: "hidden" }}>
      {/* Terminal Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, background: CARD, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <h1 style={{ ...MONO, color: "#eef2fa", fontSize: 13, letterSpacing: "0.03em", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>PRÉVISIONS</h1>
          <div style={{ height: 16, width: 1, background: BORDER }} />
          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: 4, borderRadius: 6, gap: 2 }} data-tour="forecast-horizon">
            {[7, 30, 90, 180].map((d) => {
              const active = horizon === d;
              return (
                <button
                  key={d}
                  onClick={() => setHorizon(d)}
                  style={{
                    ...MONO,
                    padding: "5px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? BLUE : "#8b97ad",
                    background: active ? "rgba(77, 159, 255, 0.15)" : "transparent",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                  }}
                >
                  {d}J
                </button>
              );
            })}
          </div>
          <div style={{ ...MONO, fontSize: 10, color: "#8b97ad", letterSpacing: "0.03em" }}>
            CLIENT · {client?.name?.toUpperCase() ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MarkBlockDoneButton clientId={clientId} blockKey="planning" label="Marquer planification terminée" />
          <button
            onClick={load}
            style={{ ...MONO, padding: "8px 14px", border: `1px solid ${BORDER}`, background: "transparent", color: "#8b97ad", fontSize: 11, fontWeight: 700, textTransform: "uppercase", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={12} /> Actualiser
          </button>
          <button
            onClick={runAll}
            disabled={running}
            data-tour="forecast-run"
            style={{ ...MONO, padding: "8px 16px", background: BLUE, color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", border: "none", borderRadius: 6, cursor: running ? "wait" : "pointer", boxShadow: "none", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Play size={12} /> {running ? "Génération..." : "Générer les 3 scénarios"}
          </button>
        </div>
      </div>

      {/* Data Source Banner */}
      <div style={{ padding: "10px 20px", background: `${AMBER}15`, borderBottom: `1px solid ${AMBER}40`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }} data-tour="forecast-datamode">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: "0.03em", textTransform: "uppercase" }}>SOURCE DES DONNÉES</span>
          <span style={{ ...MONO, padding: "3px 8px", background: AMBER, color: "#000", fontSize: 9, fontWeight: 700, borderRadius: 3, letterSpacing: "0.03em" }}>{dm}</span>
          {warn && <span style={{ fontSize: 11, color: "#8b97ad" }}>{warn}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...MONO, fontSize: 10, color: "#8b97ad", fontWeight: 700, textTransform: "uppercase" }}>DQS</span>
            <div style={{ width: 64, height: 4, background: "rgba(148, 170, 215, 0.12)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${dqs ?? 0}%`, height: "100%", background: (dqs ?? 0) >= 70 ? GREEN : (dqs ?? 0) >= 40 ? AMBER : RED }} />
            </div>
            <span style={{ ...MONO, fontSize: 10, color: "#eef2fa", fontWeight: 700 }}>{dqs ?? "—"}%</span>
          </div>
          <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "#eef2fa", letterSpacing: "0.03em" }}>
            CONFIANCE PLAFONNÉE À {dmMeta.confidenceCap}%
          </span>
        </div>
      </div>

      {/* Bloomberg Ribbon KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${BORDER}` }} data-tour="forecast-scenarios">
        <KpiCell label="REVENU BASE (PROJECTED)" value={fmtMoney(baseRev)} valueColor={BLUE} />
        <KpiCell
          label="ÉCART UPSIDE (DELTA)"
          value={`${upDelta >= 0 ? "+" : ""}${fmtMoney(Math.abs(upDelta)).replace(" $","")} $`}
          valueColor={GREEN}
          tint={`${GREEN}0d`}
          badge={{ text: `${upPct >= 0 ? "+" : ""}${upPct.toFixed(1)}%`, color: GREEN }}
        />
        <KpiCell
          label="RISQUE DOWNSIDE (GAP)"
          value={`${downDelta >= 0 ? "+" : ""}${fmtMoney(Math.abs(downDelta)).replace(" $","")} $`}
          valueColor={RED}
          tint={`${RED}0d`}
          badge={{ text: `${downPct >= 0 ? "+" : ""}${downPct.toFixed(1)}%`, color: RED }}
        />
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 6, borderLeft: `1px solid ${BORDER}` }}>
          <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "#8b97ad", letterSpacing: "0.03em", textTransform: "uppercase" }}>INDICE DE CONFIANCE</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ ...MONO, fontSize: 22, fontWeight: 700, color: "#eef2fa", letterSpacing: "-0.02em" }}>{globalConf.toFixed(1)}%</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 4, height: 12, background: i < confBars ? confColor(globalConf) : "rgba(148, 170, 215, 0.12)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Config incomplete inline warning */}
      {(!fi || !qb) && (
        <div style={{ padding: "10px 20px", background: `${AMBER}10`, borderBottom: `1px solid ${AMBER}30`, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={14} color={AMBER} />
          <span style={{ ...MONO, fontSize: 11, color: AMBER, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
            Configuration incomplète — {!fi && "Données financières"}{!fi && !qb && " · "}{!qb && "Baseline quantitative"} — projections non fiables
          </span>
        </div>
      )}

      {/* Dense Ledger Table */}
      <div style={{ overflowX: "auto" }}>
        {forecasts.length === 0 ? (
          <div style={{ padding: 40 }}>
            <EmptyState title="Aucun run enregistré" hint="Génère un premier jeu de scénarios avec le bouton ci-dessus." />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${BORDER}` }}>
                <Th first>DATE RUN</Th>
                <Th>SCÉNARIO</Th>
                <Th>HORIZON</Th>
                <Th>REVENU</Th>
                <Th>DÉPENSE</Th>
                <Th>CMD/LEADS</Th>
                <Th>CAC/CPL</Th>
                <Th>MER</Th>
                <Th>MB</Th>
                <Th>CONFIANCE</Th>
                <Th>TREND</Th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 12, fontWeight: 500 }}>
              {forecasts.map((f, idx) => {
                const c = scColor(f.scenario);
                const confPct = f.confidence != null ? Math.round(f.confidence <= 1 ? f.confidence * 100 : f.confidence) : 0;
                const trendColor = f.scenario === "UPSIDE" ? GREEN : f.scenario === "DOWNSIDE" ? RED : BLUE;
                const path = f.scenario === "UPSIDE"
                  ? "M0 18 L10 15 L20 12 L30 10 L40 6 L50 8 L60 3 L70 5 L80 1 L90 0 L100 2"
                  : f.scenario === "DOWNSIDE"
                  ? "M0 5 L10 8 L20 10 L30 14 L40 12 L50 16 L60 14 L70 18 L80 15 L90 19 L100 17"
                  : "M0 15 L10 12 L20 14 L30 8 L40 10 L50 4 L60 7 L70 2 L80 5 L90 1 L100 3";
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 1 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                    <Td first muted>{fmtDate(f.created_at)}</Td>
                    <Td>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
                        <span style={{ ...MONO, textTransform: "uppercase", fontWeight: 700, fontSize: 11, color: c }}>{f.scenario}</span>
                      </span>
                    </Td>
                    <Td muted>{f.horizon_days} Jours</Td>
                    <Td strong>{fmtMoney(f.projected_revenue)}</Td>
                    <Td muted>{fmtMoney(f.projected_ad_spend)}</Td>
                    <Td>{fmtNum(f.projected_orders ?? f.projected_leads)}</Td>
                    <Td>{f.projected_cac ?? "—"}</Td>
                    <Td style={{ color: GREEN, fontWeight: 700 }}>{f.projected_mer != null ? `${f.projected_mer}x` : "—"}</Td>
                    <Td strong>{fmtMoney(f.projected_gross_profit)}</Td>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: confColor(confPct), ...MONO, fontWeight: 700 }}>{confPct}%</span>
                        <div style={{ height: 4, width: 48, background: "rgba(148, 170, 215, 0.12)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${confPct}%`, background: confColor(confPct) }} />
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <svg viewBox="0 0 100 20" style={{ width: 80, height: 20, stroke: trendColor, fill: "none", strokeWidth: 1.5 }}>
                        <path d={path} />
                      </svg>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Simulation Controls */}
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "rgba(255, 255, 255, 0.02)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...MONO, fontSize: 9, fontWeight: 700, color: "#8b97ad", letterSpacing: "0.03em", textTransform: "uppercase" }}>
            FACTEURS DÉTERMINISTES
          </span>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <FactorDot color={BLUE} label="BASE = 1.0" />
            <FactorDot color={GREEN} label="UPSIDE = 1.2" />
            <FactorDot color={RED} label="DOWNSIDE = 0.8" />
          </div>
        </div>
        <span style={{ ...MONO, fontSize: 10, color: "#8b97ad", fontStyle: "italic" }}>
          Prévision conditionnelle, pas une garantie
        </span>
      </div>
    </div>
  );
}

function KpiCell({ label, value, valueColor, tint, badge }: { label: string; value: string; valueColor: string; tint?: string; badge?: { text: string; color: string } }) {
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 6, borderLeft: `1px solid ${BORDER}`, background: tint ?? "transparent" }}>
      <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "#8b97ad", letterSpacing: "0.03em", textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...MONO, fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: "-0.02em" }}>{value}</span>
        {badge && (
          <span style={{ ...MONO, fontSize: 10, padding: "2px 6px", background: `${badge.color}33`, borderRadius: 3, color: badge.color, fontWeight: 700 }}>{badge.text}</span>
        )}
      </div>
    </div>
  );
}

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th style={{ ...MONO, padding: "12px 14px", fontSize: 10, fontWeight: 700, color: "#8b97ad", textTransform: "uppercase", letterSpacing: "0.03em", borderRight: `1px solid ${BORDER}`, borderLeft: first ? "none" : undefined }}>
      {children}
    </th>
  );
}

function Td({ children, muted, strong, first, style }: { children: React.ReactNode; muted?: boolean; strong?: boolean; first?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "10px 14px", color: muted ? "#8b97ad" : "#eef2fa", fontWeight: strong ? 700 : 500, borderRight: first ? `1px solid ${BORDER}` : undefined, ...style }}>
      {children}
    </td>
  );
}

function FactorDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span style={{ ...MONO, fontSize: 11, color: "#8b97ad", fontWeight: 500 }}>{label}</span>
    </div>
  );
}
