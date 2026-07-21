import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, RiskBadge, PhaseBadge, EmptyState } from "@/gos/ui";
import {
  TrendingUp, TrendingDown, AlertTriangle, Users, DollarSign, Target,
  Activity, Calendar, ArrowRight, Sparkles, Flame,
} from "lucide-react";

type Client = {
  id: string; client_code: string; company_name: string;
  business_type: string; current_phase: string; risk_level: string;
  industry: string | null; am_owner: string | null;
};

type Report = {
  id: string; client_id: string;
  week_start: string; week_end: string; status: string;
  metrics_snapshot: Record<string, any>;
  sent_at: string | null;
};

type Roadmap = { client_id: string; status: string };
type Wayfinder = { client_id: string; session_date: string };

const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";
const MUTED = "hsl(0 0% 40%)";
const CARD = "hsl(220 45% 16%)";
const BORDER = "hsl(220 45% 25%)";

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null ? n : null;
}
function fmt(v: number | null, unit = "", digits = 2): string {
  if (v === null) return "—";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: digits })}${unit}`;
}
function daysSince(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

/** Health score 0-100 based on: latest report freshness, ROAS vs target, active tests, wayfinder cadence */
function healthScore(opts: {
  lastReport?: Report;
  activeTests: number;
  lastWayfinder?: string;
}): { score: number; label: string; color: string } {
  let score = 100;
  const rDays = daysSince(opts.lastReport?.week_end ?? null);
  if (rDays === null) score -= 40;
  else if (rDays > 14) score -= 30;
  else if (rDays > 7) score -= 15;

  const m = opts.lastReport?.metrics_snapshot ?? {};
  const roas = num(m.roas);
  const roasT = num(m.roas_target);
  if (roas !== null && roasT !== null) {
    const ratio = roas / roasT;
    if (ratio < 0.7) score -= 25;
    else if (ratio < 0.9) score -= 12;
    else if (ratio >= 1) score += 0;
  } else if (roas === null) score -= 10;

  if (opts.activeTests === 0) score -= 15;
  else if (opts.activeTests >= 3) score += 0;

  const wDays = daysSince(opts.lastWayfinder ?? null);
  if (wDays === null) score -= 10;
  else if (wDays > 14) score -= 10;

  score = Math.max(0, Math.min(100, score));
  const color = score >= 75 ? GREEN : score >= 50 ? YELLOW : RED;
  const label = score >= 75 ? "Sain" : score >= 50 ? "À surveiller" : "Critique";
  return { score, label, color };
}

export default function PortfolioExecutive() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [wayfinders, setWayfinders] = useState<Wayfinder[]>([]);
  const [sort, setSort] = useState<"health" | "revenue" | "risk" | "name">("health");
  const [filterRisk, setFilterRisk] = useState<string>("ALL");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, r, rm, w] = await Promise.all([
        supabase.from("gos_clients").select("id,client_code,company_name,business_type,current_phase,risk_level,industry,am_owner"),
        (supabase as any).from("gos_weekly_executive_reports").select("id,client_id,week_start,week_end,status,metrics_snapshot,sent_at").order("week_start", { ascending: false }),
        (supabase as any).from("gos_creative_testing_roadmap").select("client_id,status"),
        (supabase as any).from("gos_wayfinder_sessions").select("client_id,session_date").order("session_date", { ascending: false }),
      ]);
      setClients((c.data ?? []) as Client[]);
      setReports((r.data ?? []) as Report[]);
      setRoadmaps((rm.data ?? []) as Roadmap[]);
      setWayfinders((w.data ?? []) as Wayfinder[]);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    return clients.map(c => {
      const lastReport = reports.find(r => r.client_id === c.id);
      const activeTests = roadmaps.filter(r => r.client_id === c.id && ["planned", "in_progress", "live", "running"].includes((r.status ?? "").toLowerCase())).length;
      const lastWayfinder = wayfinders.find(w => w.client_id === c.id)?.session_date;
      const health = healthScore({ lastReport, activeTests, lastWayfinder });
      const m = lastReport?.metrics_snapshot ?? {};
      return {
        client: c,
        lastReport,
        activeTests,
        lastWayfinder,
        health,
        revenue: num(m.revenue),
        adSpend: num(m.ad_spend),
        roas: num(m.roas),
        mer: num(m.mer),
        cac: num(m.cac),
        roasTarget: num(m.roas_target),
      };
    });
  }, [clients, reports, roadmaps, wayfinders]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterRisk !== "ALL") list = list.filter(r => r.client.risk_level === filterRisk);
    const RISK_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    list = [...list].sort((a, b) => {
      if (sort === "health") return a.health.score - b.health.score;
      if (sort === "revenue") return (b.revenue ?? -1) - (a.revenue ?? -1);
      if (sort === "risk") return (RISK_ORDER[a.client.risk_level] ?? 9) - (RISK_ORDER[b.client.risk_level] ?? 9);
      return a.client.company_name.localeCompare(b.client.company_name);
    });
    return list;
  }, [rows, sort, filterRisk]);

  const kpis = useMemo(() => {
    const totalRev = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const totalSpend = rows.reduce((s, r) => s + (r.adSpend ?? 0), 0);
    const blendedMer = totalSpend > 0 ? totalRev / totalSpend : null;
    const critical = rows.filter(r => r.health.score < 50).length;
    const noRecent = rows.filter(r => (daysSince(r.lastReport?.week_end ?? null) ?? 999) > 7).length;
    const activeTests = rows.reduce((s, r) => s + r.activeTests, 0);
    return { totalRev, totalSpend, blendedMer, critical, noRecent, activeTests, count: rows.length };
  }, [rows]);

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  return (
    <div>
      <SectionHeader
        title="Dashboard exécutif portefeuille"
        subtitle="Vue agrégée sur tous les clients — santé, performance et alertes."
        guide={{
          purpose: "Piloter la performance agrégée du portefeuille et identifier les clients à risque en un coup d'œil.",
          dataSource: "Rapports hebdo, testing roadmap, sessions Wayfinder, fiches clients.",
          usedBy: "Direction et Head of AM pour revue portefeuille et allocation ressources.",
        }}
      />

      {/* KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <Kpi icon={<Users size={16} />} label="Clients" value={String(kpis.count)} color={BLUE} />
        <Kpi icon={<DollarSign size={16} />} label="Revenue (dernière semaine)" value={fmt(kpis.totalRev, "€", 0)} color={GREEN} />
        <Kpi icon={<Target size={16} />} label="Ad Spend" value={fmt(kpis.totalSpend, "€", 0)} color={YELLOW} />
        <Kpi icon={<TrendingUp size={16} />} label="MER agrégé" value={fmt(kpis.blendedMer, "x")} color={BLUE} />
        <Kpi icon={<AlertTriangle size={16} />} label="Clients critiques" value={String(kpis.critical)} color={RED} />
        <Kpi icon={<Flame size={16} />} label="Tests actifs" value={String(kpis.activeTests)} color={"#a855f7"} />
      </div>

      {/* Alerts */}
      {(kpis.critical > 0 || kpis.noRecent > 0) && (
        <div style={{ marginBottom: 20, padding: 14, background: "hsl(0 84% 96%)", border: `1px solid ${RED}`, borderRadius: 12, display: "flex", gap: 16, alignItems: "center" }}>
          <AlertTriangle size={20} style={{ color: RED }} />
          <div style={{ flex: 1, fontSize: 13, color: "var(--tdia-text)" }}>
            {kpis.critical > 0 && <><strong>{kpis.critical}</strong> client{kpis.critical > 1 ? "s" : ""} en état critique. </>}
            {kpis.noRecent > 0 && <><strong>{kpis.noRecent}</strong> client{kpis.noRecent > 1 ? "s" : ""} sans rapport récent ({">"}7j).</>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: MUTED }}>Trier par</span>
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="gos-input" style={{ padding: "6px 10px" }}>
          <option value="health">Santé (croissant)</option>
          <option value="revenue">Revenue (décroissant)</option>
          <option value="risk">Risque</option>
          <option value="name">Nom</option>
        </select>
        <span style={{ fontSize: 12, color: MUTED, marginLeft: 12 }}>Risque</span>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="gos-input" style={{ padding: "6px 10px" }}>
          <option value="ALL">Tous</option>
          <option value="CRITICAL">Critique</option>
          <option value="HIGH">Élevé</option>
          <option value="MEDIUM">Moyen</option>
          <option value="LOW">Faible</option>
          <option value="UNKNOWN">Inconnu</option>
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>{filtered.length} client{filtered.length > 1 ? "s" : ""}</div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="Aucun client ne correspond au filtre." />
      ) : (
        <div className="gos-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "hsl(220 45% 14%)", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <Th>Client</Th>
                <Th>Santé</Th>
                <Th>Phase</Th>
                <Th>Risque</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Spend</Th>
                <Th align="right">ROAS</Th>
                <Th align="right">MER</Th>
                <Th align="right">CAC</Th>
                <Th align="center">Tests</Th>
                <Th align="center">Rapport</Th>
                <Th align="center">Wayfinder</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const rDays = daysSince(r.lastReport?.week_end ?? null);
                const wDays = daysSince(r.lastWayfinder ?? null);
                const roasVsTarget = r.roas !== null && r.roasTarget !== null
                  ? r.roas >= r.roasTarget ? GREEN : r.roas >= r.roasTarget * 0.9 ? YELLOW : RED
                  : null;
                return (
                  <tr key={r.client.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Td>
                      <div style={{ fontWeight: 600, color: "var(--tdia-text)" }}>{r.client.company_name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{r.client.client_code} · {r.client.industry ?? "—"}</div>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 40, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${r.health.score}%`, height: "100%", background: r.health.color, transition: "width .3s" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: r.health.color, minWidth: 30 }}>{r.health.score}</span>
                      </div>
                      <div style={{ fontSize: 10, color: r.health.color, marginTop: 2 }}>{r.health.label}</div>
                    </Td>
                    <Td><PhaseBadge phase={r.client.current_phase} /></Td>
                    <Td><RiskBadge level={r.client.risk_level} /></Td>
                    <Td align="right">{fmt(r.revenue, "€", 0)}</Td>
                    <Td align="right">{fmt(r.adSpend, "€", 0)}</Td>
                    <Td align="right">
                      <span style={{ color: roasVsTarget ?? "var(--tdia-text)", fontWeight: roasVsTarget ? 600 : 400 }}>
                        {fmt(r.roas, "x")}
                      </span>
                      {r.roasTarget !== null && <div style={{ fontSize: 10, color: MUTED }}>c: {fmt(r.roasTarget, "x")}</div>}
                    </Td>
                    <Td align="right">{fmt(r.mer, "x")}</Td>
                    <Td align="right">{fmt(r.cac, "€", 0)}</Td>
                    <Td align="center">
                      <span style={{ padding: "2px 8px", borderRadius: 10, background: r.activeTests > 0 ? "hsl(226 100% 60% / 0.15)" : "transparent", color: r.activeTests > 0 ? BLUE : MUTED, fontWeight: 600 }}>
                        {r.activeTests}
                      </span>
                    </Td>
                    <Td align="center">
                      {rDays === null ? <span style={{ color: RED }}>—</span>
                        : <span style={{ color: rDays > 14 ? RED : rDays > 7 ? YELLOW : GREEN, fontSize: 11 }}>{rDays}j</span>}
                    </Td>
                    <Td align="center">
                      {wDays === null ? <span style={{ color: MUTED }}>—</span>
                        : <span style={{ color: wDays > 14 ? YELLOW : GREEN, fontSize: 11 }}>{wDays}j</span>}
                    </Td>
                    <Td>
                      <Link to={`/admin/gos/clients/${r.client.id}/workspace`} style={{ color: BLUE, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        Ouvrir <ArrowRight size={12} />
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, padding: 14, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 12, color: MUTED }}>
        <Sparkles size={14} style={{ display: "inline", marginRight: 6, color: BLUE }} />
        Le score de santé combine fraîcheur du dernier rapport hebdo, ROAS vs cible, nombre de tests actifs, et cadence Wayfinder. Un score {"<"} 50 signale un client nécessitant une attention immédiate.
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="gos-card" style={{ padding: 14, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 11, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--tdia-text)" }}>{value}</div>
    </div>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  return <th style={{ padding: "10px 12px", textAlign: align ?? "left", fontWeight: 600 }}>{children}</th>;
}
function Td({ children, align }: { children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  return <td style={{ padding: "12px", textAlign: align ?? "left", color: "var(--tdia-text)", verticalAlign: "middle" }}>{children}</td>;
}
