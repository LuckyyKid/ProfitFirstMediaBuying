// Walkdown — Premium Dark + Mode Guidé wrapper.
//
// Reference page for the design system: it puts everything together
//  - top bar with client + routine progress
//  - left rail (numbered steps + "Pourquoi cet ordre ?")
//  - Lecture du système callout (rule #5)
//  - MetricColumns (KPI row without boxes)
//  - PremiumTable with alert-row tinting (rule #6, no bare zeros)
//  - Sticky exit-criteria bar (rule #3)

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
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

import { ModeGuide } from "@/gos/premium/ModeGuide";
import { LectureSysteme } from "@/gos/premium/LectureSysteme";
import { MetricColumns, type MetricCell } from "@/gos/premium/MetricColumns";
import { MissingDataCard } from "@/gos/premium/MissingDataCard";
import {
  MicroLabel,
  StatusDot,
  CardPremium,
  type Status,
} from "@/gos/premium/primitives";
import type { RailStep } from "@/gos/premium/RailStepper";
import type { CriteriaItem } from "@/gos/premium/ExitCriteriaBar";

const SCOPES: DailyGrowthMapScope[] = ["mtd", "wtd", "last7", "all"];

function scopeLabel(scope: DailyGrowthMapScope): string {
  if (scope === "mtd") return "MTD";
  if (scope === "wtd") return "WTD";
  if (scope === "last7") return "7 derniers jours";
  return "Tout";
}

function toPremiumStatus(s: DailyGrowthMapMetricStatus): Status {
  if (s === "GOOD") return "good";
  if (s === "WATCH") return "watch";
  if (s === "BAD") return "bad";
  return "missing";
}

function formatValue(metric: DailyGrowthMapMetricNode, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (metric.unit === "money") return `${Math.round(value).toLocaleString("fr-FR")} $`;
  if (metric.unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (metric.unit === "ratio") return `${value.toFixed(2)}x`;
  if (metric.unit === "days") return `${Math.round(value)} j`;
  return Number(value.toFixed(2)).toLocaleString("fr-FR");
}

function formatVariance(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default function Walkdown() {
  const { clientId } = useParams();
  const nav = useNavigate();
  const { selectedClient, setSelectedClient } = useSelectedClient();
  const [workspace, setWorkspace] = useState<DailyGrowthMapWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<DailyGrowthMapScope>("mtd");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["contribution_margin", "revenue", "ad_spend"]),
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

  const rootMetric = output?.metrics.find((m) => m.level === 0);
  const revenueMetric = output?.metrics.find((m) => m.key === "revenue");
  const adSpendMetric = output?.metrics.find((m) => m.key === "ad_spend");
  const coverageRate = output?.portfolio.actual_coverage_rate ?? null;

  const kpis: MetricCell[] = [
    rootMetric && {
      label: "CONTRIBUTION",
      value: formatValue(rootMetric, rootMetric.actual),
      delta: formatVariance(rootMetric.variance_vs_target_pct),
      status: toPremiumStatus(rootMetric.status),
    },
    revenueMetric && {
      label: "REVENUE",
      value: formatValue(revenueMetric, revenueMetric.actual),
      delta: formatVariance(revenueMetric.variance_vs_target_pct),
      status: toPremiumStatus(revenueMetric.status),
    },
    adSpendMetric && {
      label: "AD SPEND",
      value: formatValue(adSpendMetric, adSpendMetric.actual),
      delta: formatVariance(adSpendMetric.variance_vs_target_pct),
      status: toPremiumStatus(adSpendMetric.status),
      valueColor: adSpendMetric.status === "BAD" ? "#ff6b6b" : undefined,
    },
    coverageRate !== null && {
      label: "COUVERTURE",
      value: `${Math.round(coverageRate * 100)}%`,
      delta: coverageRate >= 0.9 ? "COMPLET" : "PARTIEL",
      status: coverageRate >= 0.9 ? "good" : ("watch" as Status),
    },
  ].filter(Boolean) as MetricCell[];

  const badBranches = (output?.metrics ?? []).filter(
    (m) => m.level <= 1 && m.status === "BAD",
  );
  const missingCount = output?.portfolio.missing_metric_count ?? 0;

  // Lecture du système sentence — dynamic
  const lectureSentence: string = (() => {
    if (!output) return "En attente du digest.";
    if (badBranches.length === 0 && missingCount === 0) {
      return "Toutes les branches sont dans la cible. Aucune action corrective aujourd'hui — passe au Buyer Workspace pour la revue de campagnes.";
    }
    if (badBranches.length > 0) {
      const names = badBranches.slice(0, 2).map((b) => b.label).join(", ");
      return `${badBranches.length} branche${badBranches.length > 1 ? "s" : ""} rouge${badBranches.length > 1 ? "s" : ""} (${names}) explique${badBranches.length > 1 ? "nt" : ""} l'écart au plan. Ouvre-les ci-dessous, note la cause probable, puis ajuste au Buyer.`;
    }
    return `${missingCount} métrique${missingCount > 1 ? "s" : ""} manquante${missingCount > 1 ? "s" : ""}. La routine peut avancer, mais la lecture est partielle — relance la sync avant la revue.`;
  })();

  // Rail steps (routine du jour) — Walkdown is step 2
  const railSteps: RailStep[] = [
    { id: "digest", label: "Digest 7h", state: "done", hint: "FAIT · 07:12" },
    { id: "walkdown", label: "Walkdown métriques", state: "active", hint: "EN COURS · ~10 MIN" },
    { id: "buyer", label: "Buyer Workspace", state: "future", hint: "REQUIERT WALKDOWN" },
    { id: "crea", label: "Créa & Offres", state: "future" },
    { id: "budget", label: "Budget & Décisions", state: "future" },
    { id: "debrief", label: "Debrief 18h", state: "locked", hint: "OUVRE À 17:30" },
  ];

  // Exit criteria for Walkdown
  const branchesReviewed = badBranches.length === 0;
  const dataComplete = missingCount === 0;
  const exitCriteria: CriteriaItem[] = [
    { label: "Les 6 branches lues", done: branchesReviewed || (output?.metrics.length ?? 0) > 0 },
    { label: "Notes sur les rouges", done: branchesReviewed },
    { label: "Sync données complète", done: dataComplete },
  ];

  const nextDisabled = !exitCriteria.every((c) => c.done);

  const clientName = workspace?.client?.company_name ?? selectedClient?.company_name ?? "Client";
  const clientCode = workspace?.client?.client_code ?? selectedClient?.client_code ?? "—";
  const clientStatus: Status = badBranches.length > 0 ? "bad" : missingCount > 0 ? "watch" : "good";

  const openBuyer = () => {
    if (!clientId) return;
    nav(`/admin/gos/clients/${clientId}/buyer-workspace`);
  };

  return (
    <ModeGuide
      clientName={clientName}
      clientCode={clientCode}
      clientStatus={clientStatus}
      routineProgress={{ done: 1, total: 6 }}
      stepTitle="Walkdown métriques"
      stepSubtitle="ÉTAPE 2/6 · ROUTINE DU JOUR"
      steps={railSteps}
      railTitle="ROUTINE"
      railFooter={
        <>
          Pourquoi cet ordre ? Le digest te donne les signaux ; le walkdown les
          traduit en cause probable ; le Buyer applique l'ajustement ; la créa
          et le budget suivent. Chaque étape a besoin de la précédente pour
          décider — c'est pour ça qu'on ne peut pas les faire dans le désordre.
        </>
      }
      exitCriteria={exitCriteria}
      nextStepLabel="Buyer Workspace"
      onNextStep={openBuyer}
      nextDisabled={nextDisabled}
      onAskLead={() => window.alert("Message envoyé au Lead.")}
    >
      {/* Lecture du système — rule #5 */}
      <LectureSysteme>{lectureSentence}</LectureSysteme>

      {/* KPI row — hairline columns, no boxes */}
      {kpis.length > 0 && (
        <CardPremium padding="20px 0">
          <MetricColumns cells={kpis} />
        </CardPremium>
      )}

      {/* Scope selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <MicroLabel>PÉRIODE</MicroLabel>
        {SCOPES.map((item) => {
          const active = scope === item;
          return (
            <button
              key={item}
              onClick={() => setScope(item)}
              style={{
                padding: "6px 14px",
                background: active ? "linear-gradient(135deg, rgba(77,159,255,0.16), rgba(47,107,255,0.06))" : "transparent",
                color: active ? "#9ec8ff" : "#8b97ad",
                border: `1px solid ${active ? "rgba(77,159,255,0.30)" : "rgba(148,170,215,0.15)"}`,
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {scopeLabel(item)}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto" }}>
          <MicroLabel color="#5f6b82">
            AS OF {asOfDate}
          </MicroLabel>
        </div>
      </div>

      {/* Error / loading / empty */}
      {loading && (
        <div style={{ color: "#5f6b82", fontSize: 13, padding: 24 }}>Chargement du digest…</div>
      )}
      {error && (
        <MissingDataCard reason={error} actionLabel="Réessayer" onAction={load} />
      )}

      {/* Metric tree */}
      {output && output.metrics.length > 0 && (
        <CardPremium padding={0} className="hairline-table-wrap">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px,2fr) repeat(3, minmax(96px, 1fr)) 100px 100px",
              gap: 12,
              padding: "14px 20px",
              borderBottom: "1px solid rgba(148, 170, 215, 0.12)",
            }}
          >
            {[
              { label: "MÉTRIQUE", align: "left" as const },
              { label: "ACTUEL", align: "right" as const },
              { label: "CIBLE", align: "right" as const },
              { label: "PROJECTION", align: "right" as const },
              { label: "ÉCART", align: "right" as const },
              { label: "STATUT", align: "right" as const },
            ].map((h) => (
              <MicroLabel key={h.label} color="#5f6b82" style={{ fontSize: 9, letterSpacing: "0.28em", textAlign: h.align }}>
                {h.label}
              </MicroLabel>
            ))}
          </div>
          {renderMetricRows("__root__")}
        </CardPremium>
      )}

      {output && output.metrics.length === 0 && (
        <MissingDataCard
          reason="Aucune métrique n'a pu être calculée pour cette période — le plan ou les données actuelles manquent."
          actionLabel="Voir la source de données"
          onAction={() => nav("/admin/gos/data-sources")}
        />
      )}

      {/* Risks / Conditions strip */}
      {output && (output.risks.length > 0 || output.missing_data.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {output.missing_data.length > 0 && (
            <CardPremium>
              <MicroLabel color="#f5b74e" style={{ display: "block", marginBottom: 10 }}>
                DONNÉES MANQUANTES
              </MicroLabel>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {output.missing_data.slice(0, 6).map((m) => (
                  <li key={m} style={{ color: "#c8d2e4", fontSize: 12.5 }}>
                    <StatusDot status="missing" size={5} showLabel={false} /> <span style={{ marginLeft: 4 }}>{m}</span>
                  </li>
                ))}
              </ul>
            </CardPremium>
          )}
          {output.risks.length > 0 && (
            <CardPremium>
              <MicroLabel color="#ff6b6b" style={{ display: "block", marginBottom: 10 }}>
                RISQUES
              </MicroLabel>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {output.risks.slice(0, 6).map((m) => (
                  <li key={m} style={{ color: "#c8d2e4", fontSize: 12.5 }}>
                    <StatusDot status="bad" size={5} showLabel={false} /> <span style={{ marginLeft: 4 }}>{m}</span>
                  </li>
                ))}
              </ul>
            </CardPremium>
          )}
        </div>
      )}
    </ModeGuide>
  );

  function renderMetricRows(parentKey: string): JSX.Element[] {
    return (metricsByParent.get(parentKey) ?? []).flatMap((metric) => {
      const hasChildren = metric.children_count > 0;
      const isOpen = expanded.has(metric.key);
      const status = toPremiumStatus(metric.status);
      const color =
        status === "good" ? "#3ddc97" :
        status === "watch" ? "#f5b74e" :
        status === "bad" ? "#ff6b6b" : "#8b97ad";
      const tint =
        status === "bad" ? "linear-gradient(90deg, rgba(255, 107, 107, 0.05), transparent 60%)" :
        status === "watch" ? "linear-gradient(90deg, rgba(245, 183, 78, 0.04), transparent 60%)" :
        undefined;

      const row = (
        <div key={metric.key}>
          <div
            onClick={() => hasChildren && toggle(metric.key)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px,2fr) repeat(3, minmax(96px, 1fr)) 100px 100px",
              gap: 12,
              padding: "14px 20px",
              paddingLeft: 20 + metric.level * 20,
              borderTop: "1px solid rgba(148, 170, 215, 0.08)",
              cursor: hasChildren ? "pointer" : "default",
              alignItems: "center",
              background: tint,
              transition: "background 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {hasChildren ? (isOpen ? <ChevronDown size={13} color="#8b97ad" /> : <ChevronRight size={13} color="#8b97ad" />) : <span style={{ width: 13 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: metric.level === 0 ? "#eef2fa" : "#c8d2e4",
                  fontSize: 13,
                  fontWeight: metric.level === 0 ? 600 : 500,
                  letterSpacing: "-0.01em",
                }}>
                  {metric.label}
                </div>
                {metric.formula && (
                  <div className="microlabel" style={{
                    fontSize: 9, marginTop: 3, color: "#5f6b82", letterSpacing: "0.10em",
                    textTransform: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {metric.formula}
                  </div>
                )}
              </div>
            </div>
            <div className="font-data" style={{ textAlign: "right", color: "#eef2fa", fontSize: 13 }}>
              {formatValue(metric, metric.actual)}
            </div>
            <div className="font-data" style={{ textAlign: "right", color: "#8b97ad", fontSize: 12 }}>
              {formatValue(metric, metric.target)}
            </div>
            <div className="font-data" style={{ textAlign: "right", color: "#8b97ad", fontSize: 12 }}>
              {formatValue(metric, metric.projection)}
            </div>
            <div className="font-data" style={{ textAlign: "right", color, fontSize: 12, fontWeight: 500 }}>
              {formatVariance(metric.variance_vs_target_pct)}
            </div>
            <div style={{ textAlign: "right" }}>
              <StatusDot status={status} showLabel={true} />
            </div>
          </div>
          {isOpen && renderMetricRows(metric.key)}
        </div>
      );
      return [row];
    });
  }
}
