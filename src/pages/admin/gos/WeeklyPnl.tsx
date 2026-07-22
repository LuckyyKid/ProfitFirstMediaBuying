/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Play } from "lucide-react";
import { computeVariancePct } from "@/gos/weeklyPnlTargets";
import {
  createWeeklyPnlTargets,
  fetchWeeklyPnlTargets,
  updateWeeklyPnlActuals,
  type WeeklyPnlActualPatch,
  type WeeklyPnlTargetRow,
} from "@/gos/weeklyPnlController";

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
const BG = "rgba(255, 255, 255, 0.02)";
const CARD = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";

const fmt = (n: number | null | undefined) => n == null ? "—" : Number(n).toLocaleString();
const shortDate = (s: string) => {
  const d = new Date(s);
  const months = ["JAN","FÉV","MAR","AVR","MAI","JUN","JUL","AOÛ","SEP","OCT","NOV","DÉC"];
  return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]}`;
};

function varColor(v: number | null, invert = false) {
  if (v == null) return "#8b97ad";
  const positive = invert ? v <= 0 : v >= 0;
  return positive ? GREEN : RED;
}

function varBg(v: number | null, invert = false) {
  if (v == null) return "transparent";
  const positive = invert ? v <= 0 : v >= 0;
  return positive ? `${GREEN}15` : `${RED}15`;
}

export default function WeeklyPnl() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [_client, setClient] = useState<any>(null);
  const [weeks, setWeeks] = useState<WeeklyPnlTargetRow[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [numWeeks, setNumWeeks] = useState(4);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, w, t] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      fetchWeeklyPnlTargets(clientId),
      supabase.from("gos_metric_targets").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) { setClient(c.data); setSelectedClient(c.data as any); }
    setWeeks(w);
    setTargets(t.data ?? []);
    if (t.data?.[0] && !selectedTarget) setSelectedTarget(t.data[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const generate = async () => {
    const target = targets.find((t) => t.id === selectedTarget);
    if (!target) { toast.error("Sélectionne une cible parente"); return; }
    if (!startDate) { toast.error("Sélectionne une date de début"); return; }
    try {
      await createWeeklyPnlTargets(clientId!, target, numWeeks, startDate);
      toast.success(`${numWeeks} semaines créées`);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de génération hebdo";
      toast.error(message);
    }
  };

  const updateActuals = async (id: string, patch: WeeklyPnlActualPatch) => {
    const week = weeks.find((w) => w.id === id);
    if (!week) return;
    try {
      await updateWeeklyPnlActuals(week, patch);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de sauvegarde des réels hebdo";
      toast.error(message);
    }
  };

  if (loading) return <div style={{ height: 300, background: CARD, borderRadius: 8 }} />;

  return (
    <div style={{ ...MONO, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* LEFT RAIL: Generator */}
      <aside style={{ width: 320, flexShrink: 0 }}>
        <div style={{
          background: CARD,
          borderLeft: `3px solid ${BLUE}`,
          borderTop: `1px solid ${BORDER}`,
          borderRight: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 24,
          boxShadow: "none",
        }}>
          <h2 style={{ fontSize: 11, letterSpacing: "0.03em", fontWeight: 700, color: "#8b97ad", textTransform: "uppercase", margin: "0 0 24px 0" }}>
            Générateur de semaines
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 10, color: "#8b97ad", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>Cible parente</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Choisir —</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.period_label}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 10, color: "#8b97ad", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>Semaines</label>
                <input type="number" min={1} max={26} value={numWeeks} onChange={(e) => setNumWeeks(Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 10, color: "#8b97ad", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>Début</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <button
              onClick={generate}
              disabled={targets.length === 0}
              style={{
                width: "100%",
                padding: "12px",
                background: BLUE,
                color: "var(--tdia-text)",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                border: "none",
                cursor: targets.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "none",
                opacity: targets.length === 0 ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                ...MONO,
              }}
            >
              <Play size={12} /> Générer la période
            </button>

            {targets.length === 0 && (
              <div style={{ padding: 10, background: `${RED}10`, border: `1px solid ${RED}30`, borderRadius: 6, fontSize: 10, color: RED, lineHeight: 1.5 }}>
                Aucune cible parente disponible. Crée-en une dans « Objectifs de métriques » avant de générer les semaines.
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN: Ledger */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: CARD,
          borderLeft: `3px solid ${BLUE}`,
          borderTop: `1px solid ${BORDER}`,
          borderRight: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "none",
        }}>
          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: "#eef2fa", margin: 0, letterSpacing: "0.02em" }}>Objectifs P&L hebdo</h1>
              <div style={{ fontSize: 10, color: "#8b97ad", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4, fontWeight: 700 }}>
                {weeks.length} semaines · planifié vs réel
              </div>
            </div>
            <button
              onClick={load}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px",
                background: "rgba(51,65,85,0.3)",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                color: "#8b97ad",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                cursor: "pointer",
                ...MONO,
              }}
            >
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            {weeks.length === 0 ? (
              <div style={{ padding: 40 }}>
                <EmptyState title="Aucune semaine générée" hint="Utilise le rail à gauche pour découper une cible parente en semaines." />
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, ...MONO }}>
                <thead>
                  <tr style={{ background: "rgba(30,41,59,0.3)", borderBottom: `1px solid ${BORDER}` }}>
                    <ThGroup rowSpan={2} width={64}>SEM.</ThGroup>
                    <ThGroup rowSpan={2}>PÉRIODE</ThGroup>
                    <ThGroup colSpan={3} center>REVENUE ($)</ThGroup>
                    <ThGroup colSpan={3} center>SPEND ($)</ThGroup>
                    <ThGroup colSpan={3} center>ORDERS</ThGroup>
                    <ThGroup rowSpan={2} center>STATUS</ThGroup>
                  </tr>
                  <tr style={{ background: "rgba(30,41,59,0.1)", borderBottom: `1px solid ${BORDER}` }}>
                    <ThSub>PLAN</ThSub><ThSub>RÉEL</ThSub><ThSub border>Δ%</ThSub>
                    <ThSub>PLAN</ThSub><ThSub>RÉEL</ThSub><ThSub border>Δ%</ThSub>
                    <ThSub>PLAN</ThSub><ThSub>RÉEL</ThSub><ThSub border>Δ%</ThSub>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => {
                    const now = new Date();
                    const wEnd = new Date(w.week_end);
                    const isPast = wEnd < now;
                    const hasReal = w.actual_revenue != null || w.actual_ad_spend != null || w.actual_orders != null;
                    const revVar = computeVariancePct(w.target_revenue, w.actual_revenue);
                    // For spend: under = good (invert)
                    const spendVar = computeVariancePct(w.target_ad_spend, w.actual_ad_spend);
                    const ordVar = computeVariancePct(w.target_orders, w.actual_orders);

                    return (
                      <tr key={w.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <Td bold color={BLUE} border>S{w.week_number}</Td>
                        <Td muted border style={{ whiteSpace: "nowrap" }}>{shortDate(w.week_start)} — {shortDate(w.week_end)}</Td>

                        {/* Revenue */}
                        <Td right>{fmt(w.target_revenue)}</Td>
                        <Td right compact>
                          <NumInput
                            defaultValue={w.actual_revenue ?? ""}
                            onBlur={(v) => updateActuals(w.id, { actual_revenue: v })}
                          />
                        </Td>
                        <Td right border style={{ background: varBg(revVar), color: varColor(revVar), fontWeight: 700 }}>
                          {revVar != null ? `${revVar > 0 ? "+" : ""}${revVar}%` : "—"}
                        </Td>

                        {/* Spend */}
                        <Td right>{fmt(w.target_ad_spend)}</Td>
                        <Td right compact>
                          <NumInput
                            defaultValue={w.actual_ad_spend ?? ""}
                            onBlur={(v) => updateActuals(w.id, { actual_ad_spend: v })}
                          />
                        </Td>
                        <Td right border style={{ background: varBg(spendVar, true), color: varColor(spendVar, true), fontWeight: 700 }}>
                          {spendVar != null ? `${spendVar > 0 ? "+" : ""}${spendVar}%` : "—"}
                        </Td>

                        {/* Orders */}
                        <Td right>{fmt(w.target_orders)}</Td>
                        <Td right compact>
                          <NumInput
                            defaultValue={w.actual_orders ?? ""}
                            onBlur={(v) => updateActuals(w.id, { actual_orders: v })}
                            width={56}
                          />
                        </Td>
                        <Td right border style={{ background: varBg(ordVar), color: varColor(ordVar), fontWeight: 700 }}>
                          {ordVar != null ? `${ordVar > 0 ? "+" : ""}${ordVar}%` : "—"}
                        </Td>

                        {/* Status */}
                        <Td center>
                          {hasReal ? (
                            <Badge color={GREEN}>RÉEL</Badge>
                          ) : isPast ? (
                            <Badge color={RED}>MANQUANT</Badge>
                          ) : (
                            <span style={{ color: "#8b97ad", fontStyle: "italic", fontSize: 10 }}>À venir</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 24px", background: "rgba(30,41,59,0.1)", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 10, color: "#8b97ad", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Δ% Revenue/Orders : vert = au-dessus · Δ% Spend : vert = sous-budget
            </div>
            <div style={{ fontSize: 10, color: "#8b97ad", fontStyle: "italic" }}>
              Saisie sauvegardée automatiquement au blur
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  ...MONO,
  width: "100%",
  background: BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#eef2fa",
  outline: "none",
};

function ThGroup({ children, rowSpan, colSpan, center, width }: { children: React.ReactNode; rowSpan?: number; colSpan?: number; center?: boolean; width?: number }) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      style={{
        padding: colSpan ? "8px 16px" : "12px 16px",
        textAlign: center ? "center" : "left",
        fontSize: 10,
        fontWeight: 700,
        color: "#8b97ad",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        borderRight: `1px solid ${BORDER}`,
        width,
        ...MONO,
      }}
    >
      {children}
    </th>
  );
}

function ThSub({ children, border }: { children: React.ReactNode; border?: boolean }) {
  return (
    <th style={{
      padding: "8px 12px",
      textAlign: "right",
      fontSize: 9,
      fontWeight: 400,
      color: "#8b97ad",
      textTransform: "uppercase",
      letterSpacing: "0.03em",
      borderRight: border ? `1px solid ${BORDER}` : undefined,
      ...MONO,
    }}>
      {children}
    </th>
  );
}

function Td({ children, bold, muted, right, center, border, color, compact, style }: {
  children: React.ReactNode; bold?: boolean; muted?: boolean; right?: boolean; center?: boolean; border?: boolean; color?: string; compact?: boolean; style?: React.CSSProperties;
}) {
  return (
    <td style={{
      padding: compact ? "8px 8px" : "14px 12px",
      textAlign: right ? "right" : center ? "center" : "left",
      fontWeight: bold ? 700 : 400,
      color: color ?? (muted ? "#8b97ad" : "#eef2fa"),
      borderRight: border ? `1px solid ${BORDER}` : undefined,
      ...style,
    }}>
      {children}
    </td>
  );
}

function NumInput({ defaultValue, onBlur, width = 72 }: { defaultValue: number | string; onBlur: (v: number | null) => void; width?: number }) {
  return (
    <input
      type="number"
      defaultValue={defaultValue}
      placeholder="—"
      onBlur={(e) => onBlur(e.target.value === "" ? null : Number(e.target.value))}
      style={{
        ...MONO,
        width,
        background: BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 12,
        textAlign: "right",
        color: "#eef2fa",
        outline: "none",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = BLUE; }}
      onBlurCapture={(e) => { e.currentTarget.style.borderColor = BORDER; }}
    />
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      ...MONO,
      padding: "3px 10px",
      borderRadius: 999,
      background: `${color}20`,
      color,
      fontSize: 10,
      fontWeight: 700,
      border: `1px solid ${color}40`,
      letterSpacing: "0.03em",
    }}>
      {children}
    </span>
  );
}
