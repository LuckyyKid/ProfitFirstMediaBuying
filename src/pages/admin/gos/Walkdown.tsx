import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { EmptyState, SectionHeader } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import {
  buildDailyGrowthMap,
  type DailyGrowthMapMetricNode,
  type DailyGrowthMapMetricStatus,
  type DailyGrowthMapScope,
} from "@/gos/dailyGrowthMap";
import {
  fetchDailyGrowthMapWorkspace,
  type DailyGrowthMapWorkspace,
} from "@/gos/dailyGrowthMapController";

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#f59e0b";

const MONO: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
const SCOPES: DailyGrowthMapScope[] = ["mtd", "wtd", "last7", "all"];

function statusColor(status: DailyGrowthMapMetricStatus): string {
  if (status === "GOOD") return GREEN;
  if (status === "WATCH") return YELLOW;
  if (status === "BAD") return RED;
  return MUTED;
}

function statusLabel(status: DailyGrowthMapMetricStatus): string {
  if (status === "GOOD") return "OK";
  if (status === "WATCH") return "Watch";
  if (status === "BAD") return "Bad";
  return "Missing";
}

function scopeLabel(scope: DailyGrowthMapScope): string {
  if (scope === "mtd") return "MTD";
  if (scope === "wtd") return "WTD";
  if (scope === "last7") return "7 derniers jours";
  if (scope === "all") return "Tout";
  return "Custom";
}

function formatValue(metric: DailyGrowthMapMetricNode, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  if (metric.unit === "money") return `${Math.round(value).toLocaleString("fr-FR")} $`;
  if (metric.unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (metric.unit === "ratio") return `${value.toFixed(2)}x`;
  if (metric.unit === "days") return `${Math.round(value)} j`;
  return Number(value.toFixed(2)).toLocaleString("fr-FR");
}

function formatVariance(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(0)}%`;
}

export default function Walkdown() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [workspace, setWorkspace] = useState<DailyGrowthMapWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<DailyGrowthMapScope>("mtd");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["contribution_margin", "revenue", "ad_spend", "actual_coverage_rate", "channel_campaign_execution"]),
  );

  const asOfDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchDailyGrowthMapWorkspace(clientId);
      setWorkspace(next);
      if (next.client) setSelectedClient(next.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le Growth Map.");
    } finally {
      setLoading(false);
    }
  }, [clientId, setSelectedClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const output = useMemo(() => {
    if (!clientId || !workspace) return null;
    return buildDailyGrowthMap({
      client_id: clientId,
      days: workspace.days,
      campaign_days: workspace.campaign_days,
      scope,
      as_of_date: asOfDate,
    });
  }, [asOfDate, clientId, scope, workspace]);

  const metricsByParent = useMemo(() => {
    const map = new Map<string, DailyGrowthMapMetricNode[]>();
    for (const metric of output?.metrics ?? []) {
      const parent = metric.parent_key ?? "__root__";
      map.set(parent, [...(map.get(parent) ?? []), metric]);
    }
    return map;
  }, [output]);

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  const renderMetricRows = (parentKey = "__root__"): JSX.Element[] => (
    (metricsByParent.get(parentKey) ?? []).flatMap((metric) => {
      const hasChildren = metric.children_count > 0;
      const isOpen = expanded.has(metric.key);
      const color = statusColor(metric.status);
      const row = (
        <div key={metric.key}>
          <div
            onClick={() => hasChildren && toggle(metric.key)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px,2fr) repeat(3, minmax(96px, 1fr)) 100px 96px",
              gap: 12,
              padding: "12px 14px",
              paddingLeft: 14 + metric.level * 22,
              background: metric.level === 0 ? "hsl(220 45% 25%)" : metric.level === 1 ? BG_DEEP : "hsl(220 45% 14%)",
              borderTop: `1px solid ${BORDER}`,
              cursor: hasChildren ? "pointer" : "default",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {hasChildren ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: metric.level === 0 ? "#fff" : "var(--tdia-text)", fontSize: 13, fontWeight: metric.level === 0 ? 700 : 600 }}>
                  {metric.label}
                </div>
                <div style={{ color: MUTED, fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {metric.formula}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", color: "var(--tdia-text)", ...MONO, fontSize: 12 }}>{formatValue(metric, metric.actual)}</div>
            <div style={{ textAlign: "right", color: MUTED, ...MONO, fontSize: 12 }}>{formatValue(metric, metric.target)}</div>
            <div style={{ textAlign: "right", color: MUTED, ...MONO, fontSize: 12 }}>{formatValue(metric, metric.projection)}</div>
            <div style={{ textAlign: "right", color, ...MONO, fontSize: 12, fontWeight: 700 }}>{formatVariance(metric.variance_vs_target_pct)}</div>
            <div style={{ textAlign: "right" }}>
              <span style={{ padding: "3px 7px", borderRadius: 6, border: `1px solid ${color}55`, color, background: `${color}18`, fontSize: 10, fontWeight: 700 }}>
                {statusLabel(metric.status)}
              </span>
            </div>
          </div>
          {isOpen && renderMetricRows(metric.key)}
        </div>
      );
      return [row];
    })
  );

  if (loading) return <div style={{ padding: 24, color: MUTED }}>Chargement...</div>;

  return (
    <div style={{ padding: 24 }}>
      <SectionHeader
        guide={{
          purpose: "Le Daily Growth Map traduit le Profit Plan en arbre de pilotage quotidien: contribution, revenue, spend, AMR, volume, channel et campaign.",
          dataSource: "Lovable/Supabase Cloud: gos_daily_pnl_targets, dernier gos_profit_plans, gos_campaign_daily_perf.",
          usedBy: "AM et media buyer pour verifier chaque jour quel driver explique l'ecart au plan.",
          requiredInputs: ["Daily P&L targets", "Actual revenue/spend/orders/leads", "Profit Plan pour new vs returning/channel/campaign"],
          nextStep: "Mettre a jour les actuals chaque jour, puis ouvrir les branches rouges ou manquantes.",
        }}
        title="Daily Growth Map"
        subtitle="Hierarchie 35+ metrics: contribution margin -> revenue/spend/gross profit -> volume/efficiency/pacing -> channel -> campaign."
        actions={
          <button className="gos-btn-secondary" onClick={load}>
            <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Actualiser
          </button>
        }
      />

      {error && (
        <div className="gos-card" style={{ marginBottom: 16, borderLeft: `3px solid ${RED}`, color: "var(--tdia-text)" }}>
          <AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 6, color: RED }} />
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {SCOPES.map((item) => (
          <button
            key={item}
            onClick={() => setScope(item)}
            style={{
              padding: "7px 14px",
              background: scope === item ? BLUE : CARD,
              color: "var(--tdia-text)",
              border: `1px solid ${scope === item ? BLUE : BORDER}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {scopeLabel(item)}
          </button>
        ))}
        <div style={{ marginLeft: "auto", color: MUTED, fontSize: 11, alignSelf: "center" }}>
          as of {asOfDate} | backend Lovable Cloud
        </div>
      </div>

      {!output ? (
        <div className="gos-card"><EmptyState title="Aucune donnee chargee." /></div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <SummaryCard label="Metrics" value={output.portfolio.metric_count.toLocaleString("fr-FR")} />
            <SummaryCard label="Actual coverage" value={pct(output.portfolio.actual_coverage_rate)} />
            <SummaryCard label="Root status" value={statusLabel(output.portfolio.root_status)} color={statusColor(output.portfolio.root_status)} />
            <SummaryCard label="Missing" value={output.portfolio.missing_metric_count.toLocaleString("fr-FR")} color={output.portfolio.missing_metric_count > 0 ? YELLOW : GREEN} />
            <SummaryCard label="Plan source" value={workspace?.latest_profit_plan?.plan_name || "No plan"} />
          </div>

          {output.window.period_start && output.window.period_end && (
            <div style={{ marginBottom: 12, color: MUTED, fontSize: 12 }}>
              Periode: <span style={{ color: "var(--tdia-text)", ...MONO }}>{output.window.period_start}{" -> "}{output.window.period_end}</span>
              {" "} | calendar days: <span style={{ color: "var(--tdia-text)", ...MONO }}>{output.window.day_count}</span>
              {" "} | campaign nodes: <span style={{ color: "var(--tdia-text)", ...MONO }}>{output.portfolio.campaign_metric_count}</span>
            </div>
          )}

          {output.metrics.length === 0 ? (
            <div className="gos-card"><EmptyState title="Aucune metrique pour cette periode." /></div>
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(280px,2fr) repeat(3, minmax(96px, 1fr)) 100px 96px",
                  gap: 12,
                  padding: "10px 14px",
                  background: "hsl(220 45% 25%)",
                }}
              >
                {["Metric", "Actual", "Target", "Projection", "vs Target", "Status"].map((label) => (
                  <div key={label} style={{ color: MUTED, fontSize: 10, letterSpacing: "0.03em", fontWeight: 800, textAlign: label === "Metric" ? "left" : "right" }}>
                    {label.toUpperCase()}
                  </div>
                ))}
              </div>
              {renderMetricRows()}
            </div>
          )}

          {(output.missing_data.length > 0 || output.risks.length > 0 || output.conditions.length > 0) && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <InfoPanel title="Missing data" items={output.missing_data} empty="Aucun manque critique." />
              <InfoPanel title="Risks" items={output.risks} empty="Aucun risque majeur." />
              <InfoPanel title="Conditions" items={output.conditions} empty="Aucune condition." />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color = "var(--tdia-text)" }: { label: string; value: string; color?: string }) {
  return (
    <div className="gos-card" style={{ padding: 14, minHeight: 78 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: MUTED, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ marginTop: 8, color, fontSize: 20, fontWeight: 700, ...MONO }}>
        {value}
      </div>
    </div>
  );
}

function InfoPanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="gos-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: MUTED, fontWeight: 800, marginBottom: 8 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 12 }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {items.slice(0, 8).map((item) => (
            <div key={item} style={{ color: "var(--tdia-text)", fontSize: 12, lineHeight: 1.4 }}>
              {item}
            </div>
          ))}
          {items.length > 8 && <div style={{ color: MUTED, fontSize: 11 }}>+{items.length - 8} more</div>}
        </div>
      )}
    </div>
  );
}
