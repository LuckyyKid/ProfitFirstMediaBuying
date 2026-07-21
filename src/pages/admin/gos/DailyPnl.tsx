/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeader } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { WEIGHT_PRESETS, type DayWeights } from "@/gos/dailyTargets";
import {
  fetchDailyPnlWorkspace,
  regenerateDailyPnlTargets,
  updateDailyPnlActuals,
  type DailyPnlActualPatch,
  type DailyPnlTargetRow,
} from "@/gos/dailyPnlController";
import {
  buildCumulativeRevenueSparkline,
  buildSparkPath,
  computeDailyPnlSummary,
} from "@/gos/dailyPnlSummary";
import {
  fetchProjectionUpdates,
  updateDailyProjection,
  type ProjectionUpdateRow,
} from "@/gos/projectionAuditController";
import {
  computeActualVsProjectionPct,
  effectiveProjectionValue,
  type DailyProjectionPatch,
} from "@/gos/projectionAudit";
import type { WeeklyPnlTargetRow } from "@/gos/weeklyPnlController";

type SelectedClient = {
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

const PRESET_OPTIONS = ["uniform", "ecom_b2c", "b2b_weekday"] as const;
type WeightPresetKey = typeof PRESET_OPTIONS[number];

const PRESET_LABELS: Record<WeightPresetKey, string> = {
  uniform: "UNIFORM",
  ecom_b2c: "ECOM B2C",
  b2b_weekday: "B2B",
};

const MONO: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const BORDER_SOFT = "hsl(220 45% 12%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#0f8a44";
const RED = "#c1121f";
const DOW_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const fmt = (n: number | null | undefined) => (
  n == null ? "-" : Number(n).toLocaleString("fr-FR")
);

const shortDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const months = ["JAN", "FEV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOU", "SEP", "OCT", "NOV", "DEC"];
  return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]}`;
};

function varColor(value: number | null, invert = false) {
  if (value == null) return MUTED;
  const positive = invert ? value <= 0 : value >= 0;
  return positive ? GREEN : RED;
}

function varBg(value: number | null, invert = false) {
  if (value == null) return "transparent";
  const positive = invert ? value <= 0 : value >= 0;
  const alpha = Math.round((0.08 + Math.min(1, Math.abs(value) / 15) * 0.22) * 100);
  return positive ? `${GREEN}${alpha}` : `${RED}${alpha}`;
}

function formatVariance(value: number | null) {
  if (value == null) return "-";
  return `${value > 0 ? "+" : ""}${value}%`;
}

export default function DailyPnl() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [weeks, setWeeks] = useState<WeeklyPnlTargetRow[]>([]);
  const [days, setDays] = useState<DailyPnlTargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [preset, setPreset] = useState<WeightPresetKey>("uniform");
  const [auditRows, setAuditRows] = useState<ProjectionUpdateRow[]>([]);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [clientResult, workspace, projectionUpdates] = await Promise.all([
        supabase.from("gos_clients").select("*").eq("id", clientId).single(),
        fetchDailyPnlWorkspace(clientId),
        fetchProjectionUpdates(clientId, { scope: "daily", limit: 50 }),
      ]);

      if (clientResult.data) {
        setSelectedClient(clientResult.data as SelectedClient);
      }

      setWeeks(workspace.weeks);
      setDays(workspace.days);
      setAuditRows(projectionUpdates);
      setSelectedWeek((current) => current || workspace.weeks[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement daily P&L impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const generate = async () => {
    if (!clientId) return;
    const week = weeks.find((row) => row.id === selectedWeek);
    if (!week) {
      toast.error("Selectionne une semaine parente");
      return;
    }

    try {
      await regenerateDailyPnlTargets(week, WEIGHT_PRESETS[preset] as DayWeights, clientId);
      toast.success(`7 jours generes (${PRESET_LABELS[preset]})`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation daily P&L impossible");
    }
  };

  const updateActuals = async (id: string, patch: DailyPnlActualPatch) => {
    const day = days.find((row) => row.id === id);
    if (!day) return;

    try {
      await updateDailyPnlActuals(day, patch);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde des reels impossible");
    }
  };

  const updateProjection = async (id: string, patch: DailyProjectionPatch) => {
    try {
      await updateDailyProjection(id, patch);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde projection impossible");
    }
  };

  if (loading) {
    return <div style={{ height: 300, background: CARD, borderRadius: 12 }} />;
  }

  const filteredDays = selectedWeek
    ? days.filter((day) => day.parent_weekly_id === selectedWeek)
    : days;
  const currentWeek = weeks.find((week) => week.id === selectedWeek);
  const filteredDayIds = new Set(filteredDays.map((day) => day.id));
  const visibleAuditRows = auditRows
    .filter((row) => filteredDayIds.has(row.target_row_id))
    .slice(0, 8);
  const summary = computeDailyPnlSummary(filteredDays);
  const sparkPoints = buildCumulativeRevenueSparkline(filteredDays);
  const sparkPath = buildSparkPath(sparkPoints);

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Decompose une semaine cible en 7 objectifs journaliers avec pacing. Suit les reels vs cible et calcule la variance quotidienne.",
          dataSource: "Objectifs P&L hebdomadaires.",
          usedBy: "Pilotage intraweek, micro-ajustements media buying, suivi execution.",
          requiredInputs: ["Semaine parente", "Preset de pacing"],
          missingInputs: weeks.length === 0 ? ["Aucune semaine parente disponible"] : [],
          nextStep: "Generer les jours, puis saisir chaque matin les reels de la veille.",
          primaryCta: "Generer les 7 jours",
        }}
        title="Objectifs P&L journaliers"
        subtitle="Decoupage quotidien avec pacing pondere et suivi variance."
        actions={
          <button className="gos-btn-secondary" onClick={load}>
            <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Actualiser
          </button>
        }
      />

      <div style={{ ...MONO, display: "flex", gap: 20, alignItems: "stretch", flexWrap: "wrap" }}>
        <aside style={{ width: 320, flexShrink: 0 }}>
          <div style={panelStyle}>
            <div>
              <Label>Daily generator</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                <div>
                  <SubLabel>Semaine parente</SubLabel>
                  <select
                    value={selectedWeek}
                    onChange={(event) => setSelectedWeek(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Choisir</option>
                    {weeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        S{week.week_number} | {shortDate(week.week_start)} - {shortDate(week.week_end)}
                      </option>
                    ))}
                  </select>
                </div>

                {currentWeek && (
                  <div style={weekCardStyle}>
                    <div style={smallMuted}>Revenu cible semaine</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 25%)" }}>
                      {fmt(currentWeek.target_revenue)}
                      <span style={{ fontSize: 10, color: MUTED, marginLeft: 6 }}>EUR</span>
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <MiniMetric label="Spend" value={fmt(currentWeek.target_ad_spend)} />
                      <MiniMetric label="Orders" value={fmt(currentWeek.target_orders)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Pacing weights</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                {PRESET_OPTIONS.map((key) => {
                  const active = preset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setPreset(key)}
                      style={{
                        ...presetButtonStyle,
                        background: active ? BLUE : BG_DEEP,
                        borderColor: active ? BLUE : BORDER,
                        color: active ? "#fff" : MUTED,
                      }}
                    >
                      {PRESET_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={generate}
              disabled={weeks.length === 0 || !selectedWeek}
              style={{
                ...primaryButtonStyle,
                opacity: weeks.length === 0 || !selectedWeek ? 0.45 : 1,
                marginTop: "auto",
              }}
            >
              <Play size={13} style={{ verticalAlign: "middle", marginRight: 8 }} />
              Recalculer le ledger
            </button>
          </div>
        </aside>

        <main style={ledgerStyle}>
          {filteredDays.length === 0 ? (
            <div style={{ padding: 40 }}>
              <EmptyState title="Aucun jour" hint="Genere un decoupage depuis une semaine P&L." />
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 1240, borderCollapse: "collapse", ...MONO }}>
                  <thead>
                    <tr style={{ background: BG_DEEP }}>
                      <th style={{ ...thBase, borderBottom: `1px solid ${BORDER}` }} />
                      <ThGroup>Revenue</ThGroup>
                      <ThGroup>Spend</ThGroup>
                      <ThGroup>Orders</ThGroup>
                      <ThGroup last>Leads</ThGroup>
                    </tr>
                    <tr style={{ background: BG_DEEP }}>
                      <th style={{ ...thBase, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>
                        Date
                      </th>
                      <ThSub>Plan</ThSub><ThSub>Proj</ThSub><ThSub>Reel</ThSub><ThSub delta>vs Proj</ThSub>
                      <ThSub>Plan</ThSub><ThSub>Proj</ThSub><ThSub>Reel</ThSub><ThSub delta>vs Proj</ThSub>
                      <ThSub>Plan</ThSub><ThSub>Proj</ThSub><ThSub>Reel</ThSub><ThSub delta>vs Proj</ThSub>
                      <ThSub>Plan</ThSub><ThSub>Proj</ThSub><ThSub>Reel</ThSub><ThSub delta last>vs Proj</ThSub>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: 13 }}>
                    {filteredDays.map((day) => {
                      const projectionRevenue = effectiveProjectionValue(day.projection_revenue, day.target_revenue);
                      const projectionSpend = effectiveProjectionValue(day.projection_ad_spend, day.target_ad_spend);
                      const projectionOrders = effectiveProjectionValue(day.projection_orders, day.target_orders);
                      const projectionLeads = effectiveProjectionValue(day.projection_leads, day.target_leads);
                      const revenueVariance = computeActualVsProjectionPct(day.projection_revenue, day.target_revenue, day.actual_revenue);
                      const spendVariance = computeActualVsProjectionPct(day.projection_ad_spend, day.target_ad_spend, day.actual_ad_spend);
                      const orderVariance = computeActualVsProjectionPct(day.projection_orders, day.target_orders, day.actual_orders);
                      const leadVariance = computeActualVsProjectionPct(day.projection_leads, day.target_leads, day.actual_leads);

                      return (
                        <tr key={day.id} style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}>
                          <td style={dateCellStyle}>
                            <div style={{ color: "hsl(0 0% 25%)", fontSize: 13, fontWeight: 600 }}>
                              {DOW_LABELS[day.day_of_week] ?? `Jour ${day.day_index}`}
                            </div>
                            <div style={{ color: MUTED, fontSize: 10 }}>
                              {shortDate(day.target_date)} | {(day.pacing_weight * 100).toFixed(0)}%
                            </div>
                          </td>

                          <Td right muted>{fmt(day.target_revenue)}</Td>
                          <TdInput value={projectionRevenue} onCommit={(value) => updateProjection(day.id, { projection_revenue: value })} />
                          <TdInput value={day.actual_revenue} onCommit={(value) => updateActuals(day.id, { actual_revenue: value })} />
                          <TdVar value={revenueVariance} />

                          <Td right muted>{fmt(day.target_ad_spend)}</Td>
                          <TdInput value={projectionSpend} onCommit={(value) => updateProjection(day.id, { projection_ad_spend: value })} />
                          <TdInput value={day.actual_ad_spend} onCommit={(value) => updateActuals(day.id, { actual_ad_spend: value })} />
                          <TdVar value={spendVariance} invert />

                          <Td right muted>{fmt(day.target_orders)}</Td>
                          <TdInput value={projectionOrders} onCommit={(value) => updateProjection(day.id, { projection_orders: value })} />
                          <TdInput value={day.actual_orders} onCommit={(value) => updateActuals(day.id, { actual_orders: value })} />
                          <TdVar value={orderVariance} />

                          <Td right muted>{fmt(day.target_leads)}</Td>
                          <TdInput value={projectionLeads} onCommit={(value) => updateProjection(day.id, { projection_leads: value })} />
                          <TdInput value={day.actual_leads} onCommit={(value) => updateActuals(day.id, { actual_leads: value })} />
                          <TdVar value={leadVariance} last />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <footer style={footerStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  <div>
                    <div style={smallMuted}>Week pace status</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: varColor(summary.paceDeltaPct),
                        boxShadow: `0 0 8px ${varColor(summary.paceDeltaPct)}`,
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: varColor(summary.paceDeltaPct) }}>
                        {formatVariance(summary.paceDeltaPct)}
                      </span>
                      <span style={{ fontSize: 12, color: "hsl(0 0% 25%)", fontWeight: 700 }}>
                        {summary.paceDeltaPct == null
                          ? "PENDING"
                          : Math.abs(summary.paceDeltaPct) < 3
                            ? "ON TARGET"
                            : summary.paceDeltaPct > 0
                              ? "ABOVE"
                              : "BELOW"}
                      </span>
                    </div>
                  </div>

                  <div style={{ height: 32, width: 1, background: BORDER }} />

                  <div>
                    <div style={smallMuted}>Revenue cumulative</div>
                    <svg width={128} height={24} viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="dpnl-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={BLUE} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      {sparkPoints.length > 1 && (
                        <>
                          <path d={`${sparkPath} L100 30 L0 30 Z`} fill="url(#dpnl-grad)" />
                          <path d={sparkPath} fill="none" stroke={BLUE} strokeWidth={1.5} />
                        </>
                      )}
                    </svg>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={smallMuted}>Projected week end</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: BLUE }}>
                    {fmt(summary.projectedRevenue)}
                    <span style={{ fontSize: 10, color: MUTED, marginLeft: 6 }}>EUR</span>
                  </div>
                </div>
              </footer>

              <ProjectionAuditPanel rows={visibleAuditRows} />
            </>
          )}
        </main>
      </div>
    </>
  );
}

const panelStyle: CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 24,
  minHeight: 460,
  boxShadow: "none",
};

const ledgerStyle: CSSProperties = {
  flex: 1,
  minWidth: 620,
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow: "none",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: BG_DEEP,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: "hsl(0 0% 25%)",
  ...MONO,
};

const presetButtonStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0,
  cursor: "pointer",
  ...MONO,
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  background: BLUE,
  color: "var(--tdia-text)",
  padding: "12px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
  border: "none",
  cursor: "pointer",
  ...MONO,
  boxShadow: "none",
};

const weekCardStyle: CSSProperties = {
  background: BG_DEEP,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "10px 12px",
};

const footerStyle: CSSProperties = {
  marginTop: "auto",
  borderTop: `1px solid ${BORDER}`,
  background: BG_DEEP,
  padding: "14px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  flexWrap: "wrap",
};

const smallMuted: CSSProperties = {
  color: MUTED,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  marginBottom: 4,
};

const thBase: CSSProperties = {
  padding: "10px 12px",
  fontSize: 10,
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  fontWeight: 600,
};

const dateCellStyle: CSSProperties = {
  padding: "10px 12px",
  borderRight: `1px solid ${BORDER_SOFT}`,
  fontFamily: "Inter, system-ui, sans-serif",
};

const auditPanelStyle: CSSProperties = {
  borderTop: `1px solid ${BORDER}`,
  background: "hsl(220 45% 14%)",
  padding: "14px 20px",
};

const auditRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr 100px",
  gap: 12,
  alignItems: "center",
  background: BG_DEEP,
  border: `1px solid ${BORDER_SOFT}`,
  borderRadius: 6,
  padding: "8px 10px",
};

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase", fontWeight: 800, ...MONO }}>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, fontFamily: "Inter, system-ui, sans-serif" }}>
      {children}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...smallMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "hsl(0 0% 25%)", fontWeight: 800, fontSize: 12 }}>{value}</div>
    </div>
  );
}

function ProjectionAuditPanel({ rows }: { rows: ProjectionUpdateRow[] }) {
  return (
    <section style={auditPanelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ ...smallMuted, marginBottom: 2 }}>Projection audit</div>
          <div style={{ color: "hsl(0 0% 25%)", fontSize: 13, fontWeight: 800 }}>
            Derniers changements AM sur la semaine selectionnee
          </div>
        </div>
        <span style={{ color: MUTED, fontSize: 11 }}>{rows.length} log(s)</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 12 }}>
          Aucun changement de projection pour cette semaine.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {rows.map((row) => (
            <div key={row.id} style={auditRowStyle}>
              <div style={{ color: "hsl(0 0% 25%)", fontSize: 12, fontWeight: 700 }}>
                {row.metric_name.replace("projection_", "")}
              </div>
              <div style={{ color: MUTED, fontSize: 12 }}>
                {formatAuditValue(row.old_value)} {"->"} {formatAuditValue(row.new_value)}
              </div>
              <div style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>
                {row.period_date ?? row.created_at.slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return fmt(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? fmt(n) : value;
  }
  return JSON.stringify(value);
}

function ThGroup({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <th colSpan={4} style={{
      ...thBase,
      textAlign: "center",
      borderBottom: `1px solid ${BORDER}`,
      borderLeft: `1px solid ${BORDER}`,
      borderRight: last ? `1px solid ${BORDER}` : undefined,
    }}>
      {children}
    </th>
  );
}

function ThSub({ children, delta, last }: { children: ReactNode; delta?: boolean; last?: boolean }) {
  return (
    <th style={{
      padding: "6px 8px",
      fontSize: 10,
      color: MUTED,
      fontWeight: 600,
      textAlign: delta ? "center" : "right",
      borderBottom: `1px solid ${BORDER_SOFT}`,
      borderLeft: `1px solid ${BORDER_SOFT}`,
      borderRight: last ? `1px solid ${BORDER}` : undefined,
      width: delta ? 64 : undefined,
    }}>
      {children}
    </th>
  );
}

function Td({ children, right, muted }: { children: ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <td style={{
      padding: "8px 10px",
      textAlign: right ? "right" : "left",
      color: muted ? MUTED : "hsl(0 0% 25%)",
    }}>
      {children}
    </td>
  );
}

function TdInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  return (
    <td style={{ padding: "6px 8px", textAlign: "right" }}>
      <input
        type="number"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft.trim() === "" ? null : Number(draft))}
        style={actualInputStyle}
      />
    </td>
  );
}

function TdVar({ value, invert, last }: { value: number | null; invert?: boolean; last?: boolean }) {
  return (
    <td style={{
      padding: "8px 6px",
      textAlign: "center",
      fontWeight: 800,
      fontSize: 12,
      background: varBg(value, invert),
      color: varColor(value, invert),
      borderRight: last ? `1px solid ${BORDER_SOFT}` : undefined,
    }}>
      {formatVariance(value)}
    </td>
  );
}

const actualInputStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: `1px solid ${BORDER_SOFT}`,
  color: "var(--tdia-text)",
  fontWeight: 700,
  fontSize: 13,
  textAlign: "right",
  padding: "5px 6px",
  borderRadius: 4,
  outline: "none",
  ...MONO,
};
