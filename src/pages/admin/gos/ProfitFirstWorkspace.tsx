import { useState, type Dispatch, type SetStateAction } from "react";
import { Link, useParams } from "react-router-dom";

import { useSelectedClient } from "@/gos/context";
import {
  Activity, Zap,
  ShoppingBag, BarChart3, LineChart, Wallet, Target, Package, Image as ImageIcon,
  CheckCircle2, AlertTriangle, XCircle, Clock, Hand, Database,
} from "lucide-react";

// Section 1 — Executive Overview (Tactical HUD design)
// Sections 2-9 are placeholders that will be designed one by one with the user.

type HealthStatus = "ON_TRACK" | "WATCH" | "AT_RISK" | "CRISIS";
type ProblemType = "VOLUME" | "EFFICIENCY" | "TRACKING" | "CONSTRAINT" | "MIXED" | "ON_TRACK";
type BindingConstraint = "CASH" | "FUNNEL" | "REGRESSION" | "INVENTORY" | "PLANNED" | "UNKNOWN";

type OverviewData = {
  clientName: string;
  businessType: string;
  currentRevenue: number;
  revenueTarget: number;
  dataReadinessScore: number; // 0-100
  healthStatus: HealthStatus;
  problemType: ProblemType;
  recommendedSpend: number;
  bindingConstraint: BindingConstraint;
  confidenceScore: number; // 0-100
  p0Action: { title: string; detail: string };
  p1Action?: { title: string; detail: string };
};

const HEALTH_META: Record<HealthStatus, { label: string; color: string; ring: string }> = {
  ON_TRACK: { label: "ON TRACK", color: "text-emerald-400", ring: "shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
  WATCH:    { label: "WATCH",    color: "text-cyan-400",    ring: "shadow-[0_0_8px_rgba(34,211,238,0.6)]" },
  AT_RISK:  { label: "AT RISK",  color: "text-amber-400",   ring: "shadow-[0_0_8px_rgba(251,191,36,0.6)]" },
  CRISIS:   { label: "CRISIS",   color: "text-red-400",     ring: "shadow-[0_0_10px_rgba(248,113,113,0.7)]" },
};

const PROBLEM_LABEL: Record<ProblemType, string> = {
  VOLUME:      "PROBLÈME VOLUME",
  EFFICIENCY:  "PROBLÈME EFFICACITÉ",
  TRACKING:    "PROBLÈME TRACKING",
  CONSTRAINT:  "CONTRAINTE STRUCTURELLE",
  MIXED:       "PROBLÈMES MIXTES",
  ON_TRACK:    "AUCUN PROBLÈME MAJEUR",
};

const CONSTRAINT_LABEL: Record<BindingConstraint, string> = {
  CASH:       "CASH",
  FUNNEL:     "FUNNEL",
  REGRESSION: "REGRESSION",
  INVENTORY:  "INVENTORY",
  PLANNED:    "PLANNED",
  UNKNOWN:    "INCONNU",
};

function fmtMoney(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function useDemoOverview(clientName: string | undefined): OverviewData {
  return {
    clientName: clientName ?? "NordicSkin",
    businessType: "E-COMMERCE / DTC",
    currentRevenue: 182_450,
    revenueTarget: 400_000,
    dataReadinessScore: 72,
    healthStatus: "WATCH",
    problemType: "EFFICIENCY",
    recommendedSpend: 52_000,
    bindingConstraint: "FUNNEL",
    confidenceScore: 68,
    p0Action: {
      title: "ACTION P0 — Corriger l'écart CAC",
      detail: "CAC actuel 68$ vs cible 45$. Rediriger 30% du spend vers créatifs top-3 ROAS avant scale.",
    },
    p1Action: {
      title: "P1 — Débloquer la contrainte funnel",
      detail: "CVR 1.1% vs benchmark 2.4%. Lancer test PDP + review social proof cette semaine.",
    },
  };
}

// ============================================================
// SECTION 1 — Executive Overview (Tactical HUD)
// ============================================================
function ExecutiveOverview({ d }: { d: OverviewData }) {
  const health = HEALTH_META[d.healthStatus];
  const revenuePct = Math.min(100, Math.round((d.currentRevenue / d.revenueTarget) * 100));

  return (
    <div className="w-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl relative overflow-hidden rounded-sm"
         style={{ color: "#e0e0e0", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
      {/* Scanner */}
      <div className="absolute inset-0 pointer-events-none opacity-5"
           style={{
             background: "linear-gradient(transparent 0%, rgba(34,211,238,0.1) 50%, transparent 100%)",
             backgroundSize: "100% 4px",
           }} />

      {/* Header strip */}
      <div className="border-b border-zinc-800 px-4 py-3 flex justify-between items-center bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-cyan-500 uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            System Live
          </span>
        </div>
        <span className="text-[9px] text-zinc-500 uppercase tracking-widest">
          Session · Profit-First Workspace
        </span>
      </div>

      {/* Content */}
      <div className="p-5 space-y-6">
        {/* Section label + client */}
        <div className="flex justify-between items-end gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-zinc-500 uppercase tracking-widest mb-1">Section 01 — Executive Overview</div>
            <h1 className="text-2xl font-bold tracking-tight text-white truncate" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              {d.clientName.toUpperCase()}
            </h1>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{d.businessType}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-zinc-500 uppercase mb-1">Health</div>
            <div className={`text-base font-bold ${health.color}`} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              {health.label}
            </div>
          </div>
        </div>

        {/* Primary diagnostic — revenue vs target */}
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-sm blur opacity-50" />
          <div className="relative bg-zinc-950 border border-zinc-800 p-4 rounded-sm">
            <div className="text-[10px] text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <Activity className="w-3 h-3 text-cyan-500" />
              Revenu mensuel actuel vs objectif
            </div>
            <div className="flex justify-between items-baseline">
              <div className="text-3xl font-bold text-white tabular-nums">{fmtMoney(d.currentRevenue)}</div>
              <div className="text-xs text-zinc-400 font-bold tabular-nums">
                cible <span className="text-cyan-300">{fmtMoney(d.revenueTarget)}</span>
              </div>
            </div>
            <div className="mt-4 h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style={{ width: `${revenuePct}%` }} />
            </div>
            <div className="mt-1.5 text-[9px] text-zinc-500 uppercase tracking-widest">
              {revenuePct}% de la cible atteinte
            </div>
          </div>
        </div>

        {/* Telemetry grid */}
        <div className="grid grid-cols-2 gap-2">
          <TelemetryCell label="Data Readiness"    value={`${d.dataReadinessScore}`} suffix="/100" tone={d.dataReadinessScore >= 75 ? "good" : d.dataReadinessScore >= 50 ? "warn" : "bad"} />
          <TelemetryCell label="Confidence"        value={`${d.confidenceScore}`}     suffix="/100" tone={d.confidenceScore >= 70 ? "good" : d.confidenceScore >= 50 ? "warn" : "bad"} />
          <TelemetryCell label="Problem Type"      value={PROBLEM_LABEL[d.problemType]} tone="warn" />
          <TelemetryCell label="Binding Constraint" value={CONSTRAINT_LABEL[d.bindingConstraint]} tone="warn" />
          <TelemetryCell label="Spend Recommandé"  value={fmtMoney(d.recommendedSpend)} suffix="/mois" tone="good" wide />
        </div>

        {/* Priority Directives */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-[1px] flex-grow bg-zinc-800" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Priority Directives</span>
            <div className="h-[1px] flex-grow bg-zinc-800" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3 p-3 bg-zinc-950/60 border-l-2 border-amber-500">
              <div className="flex-shrink-0 mt-1">
                <div className="w-4 h-4 rounded-full border border-amber-500/50 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse rounded-full" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white uppercase mb-0.5 tracking-wide" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  {d.p0Action.title}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{d.p0Action.detail}</p>
              </div>
            </div>

            {d.p1Action && (
              <div className="flex items-start gap-3 p-3 bg-zinc-950/30 border-l-2 border-zinc-700">
                <div className="flex-shrink-0 mt-1 text-zinc-500">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-zinc-300 uppercase mb-0.5 tracking-wide" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    {d.p1Action.title}
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{d.p1Action.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer decor */}
      <div className="px-5 pb-4 flex justify-between items-center opacity-40">
        <div className="flex gap-1">
          <div className="w-1 h-3 bg-cyan-600" />
          <div className="w-1 h-3 bg-zinc-700" />
          <div className="w-1 h-3 bg-zinc-800" />
          <div className="w-1 h-3 bg-zinc-800" />
        </div>
        <div className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase">
          TDIA-PF-WORKSPACE · 01/09
        </div>
      </div>
    </div>
  );
}

function TelemetryCell({
  label, value, suffix, tone = "neutral", wide = false,
}: {
  label: string; value: string; suffix?: string; tone?: "good" | "warn" | "bad" | "neutral"; wide?: boolean;
}) {
  const toneClass =
    tone === "good" ? "text-emerald-400" :
    tone === "warn" ? "text-amber-400" :
    tone === "bad"  ? "text-red-400"    :
                      "text-zinc-100";
  return (
    <div className={`bg-zinc-950/70 border border-zinc-800 p-3 rounded-sm ${wide ? "col-span-2" : ""}`}>
      <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5">{label}</div>
      <div className="flex items-baseline gap-1">
        <div className={`text-sm font-bold tabular-nums ${toneClass}`} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          {value}
        </div>
        {suffix && <div className="text-[9px] text-zinc-500 uppercase">{suffix}</div>}
      </div>
    </div>
  );
}

// ============================================================
// SECTION 2 — Data Readiness (Tactical HUD, source cards)
// ============================================================

type SourceStatus = "CONNECTED" | "MISSING" | "STALE" | "MANUAL" | "PARTIAL";

type DataSource = {
  key: string;
  name: string;
  kind: "INTEGRATION" | "MANUAL";
  icon: React.ComponentType<{ className?: string }>;
  status: SourceStatus;
  lastUpdated: string; // human-readable
  dataPoints: { label: string; value: string }[];
  modelsImpacted: string[];
  note?: string;
};

const STATUS_META: Record<SourceStatus, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
  CONNECTED: { label: "CONNECTED", color: "text-emerald-400", bg: "bg-emerald-500/5",  border: "border-emerald-500/40", dot: "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7)]", icon: CheckCircle2 },
  PARTIAL:   { label: "PARTIAL",   color: "text-cyan-300",    bg: "bg-cyan-500/5",     border: "border-cyan-500/30",    dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",     icon: AlertTriangle },
  STALE:     { label: "STALE",     color: "text-amber-400",   bg: "bg-amber-500/5",    border: "border-amber-500/40",   dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",    icon: Clock },
  MANUAL:    { label: "MANUAL",    color: "text-violet-300",  bg: "bg-violet-500/5",   border: "border-violet-500/30",  dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]",  icon: Hand },
  MISSING:   { label: "MISSING",   color: "text-red-400",     bg: "bg-red-500/5",      border: "border-red-500/40",     dot: "bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.7)]",    icon: XCircle },
};

function useDemoDataSources(): DataSource[] {
  return [
    {
      key: "shopify",
      name: "Shopify",
      kind: "INTEGRATION",
      icon: ShoppingBag,
      status: "CONNECTED",
      lastUpdated: "il y a 12 min",
      dataPoints: [
        { label: "Orders 30j",  value: "1,284" },
        { label: "GMV 30j",     value: "$182,450" },
        { label: "AOV",         value: "$142.10" },
        { label: "Refund rate", value: "2.4%" },
      ],
      modelsImpacted: ["Revenue Actuals", "Cohort LTV", "Forecast"],
    },
    {
      key: "meta",
      name: "Meta Ads",
      kind: "INTEGRATION",
      icon: BarChart3,
      status: "CONNECTED",
      lastUpdated: "il y a 32 min",
      dataPoints: [
        { label: "Spend 30j",   value: "$41,220" },
        { label: "ROAS blended", value: "3.1x" },
        { label: "CAC",         value: "$68" },
        { label: "Campaigns actives", value: "18" },
      ],
      modelsImpacted: ["Spend Decision", "Creative Fatigue", "MER Guardrail"],
    },
    {
      key: "ga4",
      name: "GA4",
      kind: "INTEGRATION",
      icon: LineChart,
      status: "STALE",
      lastUpdated: "il y a 3j 4h",
      dataPoints: [
        { label: "Sessions 7j",  value: "48,120" },
        { label: "CVR site",     value: "1.1%" },
        { label: "Bounce rate",  value: "62%" },
        { label: "Attribution",  value: "data-driven" },
      ],
      modelsImpacted: ["Funnel Diagnosis", "Growth Diagnosis"],
      note: "Feed API n'a pas répondu depuis 72h — relancer la sync.",
    },
    {
      key: "manual-finance",
      name: "Manual Finance",
      kind: "MANUAL",
      icon: Wallet,
      status: "MANUAL",
      lastUpdated: "saisi le 04/07",
      dataPoints: [
        { label: "Cash disponible", value: "$120,000" },
        { label: "Burn mensuel",    value: "$38,000" },
        { label: "Safety months",   value: "3" },
        { label: "GM %",            value: "62%" },
      ],
      modelsImpacted: ["Financial Foundation", "Spend Decision", "Runway"],
    },
    {
      key: "manual-strategy",
      name: "Manual Strategy",
      kind: "MANUAL",
      icon: Target,
      status: "PARTIAL",
      lastUpdated: "saisi le 28/06",
      dataPoints: [
        { label: "Revenue goal",  value: "$400,000" },
        { label: "CAC target",    value: "$45" },
        { label: "MER target",    value: "3.5x" },
        { label: "Events / promos", value: "manquant" },
      ],
      modelsImpacted: ["Forecast & Targets", "Execution Plan"],
      note: "Events & hypothèses de forecast à compléter.",
    },
    {
      key: "inventory",
      name: "Inventory",
      kind: "MANUAL",
      icon: Package,
      status: "MISSING",
      lastUpdated: "—",
      dataPoints: [
        { label: "Inventory days", value: "n/a" },
        { label: "Payout delay",   value: "n/a" },
        { label: "Stock-out SKUs", value: "n/a" },
      ],
      modelsImpacted: ["Cash Cycle", "Spend Decision"],
      note: "Aucune donnée — bloque le calcul du cash cycle.",
    },
    {
      key: "creative",
      name: "Creative Metadata",
      kind: "MANUAL",
      icon: ImageIcon,
      status: "PARTIAL",
      lastUpdated: "il y a 5j",
      dataPoints: [
        { label: "Assets taggés",   value: "42 / 118" },
        { label: "WIN tags",        value: "9" },
        { label: "LOSS tags",       value: "6" },
        { label: "Coverage",        value: "36%" },
      ],
      modelsImpacted: ["Creative Fatigue", "Measurement & Learning"],
      note: "Coverage < 60% — insight créatif peu fiable.",
    },
  ];
}

function DataReadiness({ sources }: { sources: DataSource[] }) {
  const counts = sources.reduce<Record<SourceStatus, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, { CONNECTED: 0, PARTIAL: 0, STALE: 0, MANUAL: 0, MISSING: 0 });

  const score = Math.round(
    (counts.CONNECTED * 100 + counts.MANUAL * 80 + counts.PARTIAL * 55 + counts.STALE * 40) /
      Math.max(1, sources.length)
  );

  return (
    <div className="w-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl relative overflow-hidden rounded-sm"
         style={{ color: "#e0e0e0", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
      {/* Header strip */}
      <div className="border-b border-zinc-800 px-4 py-3 flex justify-between items-center bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <Database className="w-3 h-3 text-cyan-500" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-cyan-500 uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Data Pipeline
          </span>
        </div>
        <span className="text-[9px] text-zinc-500 uppercase tracking-widest">
          {sources.length} sources · readiness {score}/100
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Section label */}
        <div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest mb-1">Section 02 — Data Readiness</div>
          <h2 className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            LES MODÈLES SONT-ILS HYDRATÉS ?
          </h2>
        </div>

        {/* Status summary bar */}
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(STATUS_META) as SourceStatus[]).map((k) => {
            const meta = STATUS_META[k];
            return (
              <div key={k} className={`border ${meta.border} ${meta.bg} p-2 rounded-sm`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <div className={`text-[8px] font-bold tracking-widest ${meta.color}`}>{meta.label}</div>
                </div>
                <div className="text-sm font-bold text-white tabular-nums" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  {counts[k]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Source cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {sources.map((s) => (
            <SourceCard key={s.key} source={s} />
          ))}
        </div>
      </div>

      {/* Footer decor */}
      <div className="px-5 pb-4 flex justify-between items-center opacity-40">
        <div className="flex gap-1">
          <div className="w-1 h-3 bg-cyan-600" />
          <div className="w-1 h-3 bg-cyan-600" />
          <div className="w-1 h-3 bg-zinc-700" />
          <div className="w-1 h-3 bg-zinc-800" />
        </div>
        <div className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase">
          TDIA-PF-WORKSPACE · 02/09
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  const meta = STATUS_META[source.status];
  const StatusIcon = meta.icon;
  const SourceIcon = source.icon;

  return (
    <div className={`relative border ${meta.border} ${meta.bg} rounded-sm p-3`}>
      {/* Head */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-sm bg-zinc-950 border border-zinc-800 flex items-center justify-center flex-shrink-0">
            <SourceIcon className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white truncate" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              {source.name.toUpperCase()}
            </div>
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest">
              {source.kind === "INTEGRATION" ? "Intégration" : "Saisie manuelle"} · {source.lastUpdated}
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1 border ${meta.border} px-1.5 py-0.5 rounded-sm flex-shrink-0`}>
          <StatusIcon className={`w-2.5 h-2.5 ${meta.color}`} />
          <span className={`text-[8px] font-bold tracking-widest ${meta.color}`}>{meta.label}</span>
        </div>
      </div>

      {/* Data points */}
      <div className="grid grid-cols-2 gap-1 mb-2.5">
        {source.dataPoints.map((dp) => (
          <div key={dp.label} className="bg-zinc-950/60 border border-zinc-800/70 px-2 py-1.5 rounded-sm">
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5 truncate">{dp.label}</div>
            <div className="text-[11px] font-bold text-zinc-100 tabular-nums truncate" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              {dp.value}
            </div>
          </div>
        ))}
      </div>

      {/* Models impacted */}
      <div className="border-t border-zinc-800/70 pt-2">
        <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">Models impacted</div>
        <div className="flex flex-wrap gap-1">
          {source.modelsImpacted.map((m) => (
            <span key={m} className="text-[9px] px-1.5 py-0.5 border border-zinc-800 bg-zinc-950/70 text-zinc-300 rounded-sm uppercase tracking-wider">
              {m}
            </span>
          ))}
        </div>
      </div>

      {source.note && (
        <div className={`mt-2 flex items-start gap-1.5 text-[10px] ${meta.color} border-l-2 ${meta.border} pl-2 py-1`}>
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
          <span className="leading-snug text-zinc-300">{source.note}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION 3 — Financial Foundation (Hardened tactical command)
// ============================================================

type Verdict = "VIABLE" | "MARGINAL" | "NON_VIABLE";

type FinancialFoundation = {
  cashAvailable: number;
  monthlyBurn: number;
  runwayMonths: number;
  grossMarginPct: number;
  contribMarginPct: number;
  paybackMonths: number;
  safetySpendCap: number;
  maxAllowedCac: number;
  verdict: Verdict;
  reason: string;
  missing?: string[];
};

const VERDICT_META: Record<Verdict, { label: string; pill: string; accent: string; border: string; bg: string; text: string; dot: string; diamond: string }> = {
  VIABLE:     { label: "VIABLE",     pill: "bg-emerald-500 text-[#050506]", accent: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-950/20", text: "text-emerald-500/80", dot: "bg-emerald-500", diamond: "border-emerald-500" },
  MARGINAL:   { label: "MARGINAL",   pill: "bg-amber-500 text-[#050506]",   accent: "text-amber-400",   border: "border-amber-500/30",   bg: "bg-amber-950/20",   text: "text-amber-500/80",   dot: "bg-amber-500",   diamond: "border-amber-500" },
  NON_VIABLE: { label: "NON-VIABLE", pill: "bg-red-500 text-[#050506]",     accent: "text-red-400",     border: "border-red-500/30",     bg: "bg-red-950/20",     text: "text-red-500/80",     dot: "bg-red-500",     diamond: "border-red-500" },
};

function useDemoFinancialFoundation(): FinancialFoundation {
  const cash = 142_500;
  const burn = 12_000;
  return {
    cashAvailable: cash,
    monthlyBurn: burn,
    runwayMonths: cash / burn,
    grossMarginPct: 68,
    contribMarginPct: 22,
    paybackMonths: 4.2,
    safetySpendCap: 3_500,
    maxAllowedCac: 85,
    verdict: "VIABLE",
    reason: "Marge brute saine et runway > 10 mois autorisant un investissement offensif sur les canaux d'acquisition.",
  };
}

function fmtEuro(n: number) {
  return n.toLocaleString("fr-FR");
}

function FinancialFoundationSection({ d }: { d: FinancialFoundation }) {
  const v = VERDICT_META[d.verdict];
  const runwaySlots = 10;
  const filledSlots = Math.min(runwaySlots, Math.floor(d.runwayMonths));
  const partialSlot = d.runwayMonths - filledSlots > 0 && filledSlots < runwaySlots;
  const runwayTone =
    d.runwayMonths >= 9 ? "text-emerald-400" :
    d.runwayMonths >= 4 ? "text-amber-400" :
                          "text-red-400";
  const runwayFill =
    d.runwayMonths >= 9 ? "bg-emerald-600/80" :
    d.runwayMonths >= 4 ? "bg-amber-500/80" :
                          "bg-red-500/80";

  return (
    <div className="w-full bg-[#050506] border border-zinc-800 relative overflow-hidden rounded-sm"
         style={{ color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-10"
           style={{
             background:
               "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.02), rgba(0,255,0,0.01), rgba(0,0,255,0.02))",
             backgroundSize: "100% 2px, 3px 100%",
           }} />

      {/* Header strip */}
      <div className="flex items-center justify-between bg-zinc-900/50 border-b border-zinc-800 px-3 py-1.5 relative z-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-zinc-500 tracking-tighter uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            SEC_03 // FIN_FOUNDATION
          </span>
        </div>
        <span className="text-[10px] text-zinc-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          V2.4.0_SYS
        </span>
      </div>

      <div className="p-4 relative z-20">
        <h2 className="text-zinc-400 text-xs font-semibold tracking-[0.2em] mb-1 uppercase">Business Intelligence</h2>
        <p className="text-xl font-bold text-white tracking-tight mb-6 leading-none uppercase">
          L'acquisition est-elle financièrement viable ?
        </p>

        {/* High-level metrics */}
        <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 mb-6">
          <div className="bg-[#08080a] p-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Cash Disponible</p>
            <p className="text-lg font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {fmtEuro(d.cashAvailable)}<span className="text-zinc-600 ml-1">€</span>
            </p>
          </div>
          <div className="bg-[#08080a] p-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Burn Mensuel</p>
            <p className="text-lg font-bold text-red-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              -{fmtEuro(d.monthlyBurn)}<span className="text-red-900 ml-1">€</span>
            </p>
          </div>
        </div>

        {/* Runway visualizer */}
        <div className="mb-6">
          <div className="flex justify-between items-end mb-2">
            <p className="text-[10px] text-zinc-500 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Runway Projection
            </p>
            <p className={`text-xl font-bold ${runwayTone}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {d.runwayMonths.toFixed(1)} <span className="text-xs font-normal text-zinc-500">MOIS</span>
            </p>
          </div>
          <div className="h-2 bg-zinc-900 flex gap-0.5 p-0.5 border border-zinc-800">
            {Array.from({ length: runwaySlots }).map((_, i) => {
              const filled = i < filledSlots;
              const partial = !filled && i === filledSlots && partialSlot;
              return (
                <div key={i}
                     className={`h-full flex-1 ${filled ? runwayFill : partial ? `${runwayFill} opacity-50` : "bg-zinc-800"}`} />
              );
            })}
          </div>
        </div>

        {/* Detailed metrics grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>GROSS MARGIN</p>
              <p className="text-md font-bold text-zinc-200">{d.grossMarginPct}%</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>CONTRIB. MARGIN</p>
              <p className="text-md font-bold text-zinc-200">{d.contribMarginPct}%</p>
            </div>
          </div>
          <div className="space-y-3 border-l border-zinc-800 pl-4">
            <div>
              <p className="text-[10px] text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>PAYBACK PERIOD</p>
              <p className="text-md font-bold text-zinc-200">{d.paybackMonths.toFixed(1)} MOIS</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SAFETY SPEND CAP</p>
              <p className="text-md font-bold text-cyan-400">{fmtEuro(d.safetySpendCap)}€/MO</p>
            </div>
          </div>
        </div>

        {/* Verdict card */}
        <div className={`${v.bg} border ${v.border} p-4 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-1">
            <div className={`w-1 h-1 ${v.dot}`} />
          </div>

          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-0.5 ${v.pill} font-bold text-[10px] tracking-widest`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {v.label}
            </span>
            <p className={`text-[10px] ${v.text} uppercase tracking-wider`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Maximum CAC Autorisé
            </p>
          </div>

          <p className={`text-3xl font-bold ${v.accent} mb-2`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {d.maxAllowedCac.toFixed(2)}<span className="text-lg ml-1">€</span>
          </p>

          <div className={`flex items-start gap-2 pt-3 border-t ${v.border}`}>
            <div className={`mt-1 w-1.5 h-1.5 border ${v.diamond} rotate-45 flex-shrink-0`} />
            <p className="text-[11px] leading-relaxed text-zinc-400 font-medium">
              {d.reason}
            </p>
          </div>
        </div>

        {d.missing && d.missing.length > 0 && (
          <div className="mt-3 flex items-start gap-2 border-l-2 border-amber-500/60 pl-2 py-1">
            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-px" />
            <div className="text-[10px] text-zinc-300 leading-snug">
              Saisies manquantes : <span className="text-amber-300">{d.missing.join(" · ")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex justify-between items-center bg-[#08080a] border-t border-zinc-800 relative z-20">
        <div className="flex gap-1">
          <div className="w-1 h-3 bg-zinc-800" />
          <div className="w-1 h-3 bg-zinc-700" />
          <div className="w-1 h-3 bg-zinc-600" />
        </div>
        <p className="text-[9px] text-zinc-600 tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Profit-First Analytics Engine · 03/09
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Placeholder for sections 4–9 (à designer un par un avec l'user)
// ============================================================
function SectionPlaceholder({
  n, title, question,
}: { n: string; title: string; question: string }) {
  return (
    <div className="w-full border border-dashed border-zinc-800 bg-zinc-900/30 rounded-sm p-5"
         style={{ color: "#e0e0e0", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
      <div className="flex justify-between items-start gap-4 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Section {n}</div>
          <h2 className="text-lg font-bold text-white truncate" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            {title.toUpperCase()}
          </h2>
        </div>
        <div className="text-[9px] text-zinc-600 uppercase tracking-widest border border-zinc-800 px-2 py-1 rounded-sm flex-shrink-0">
          À designer
        </div>
      </div>
      <div className="text-[11px] text-zinc-500 italic mt-2">
        Question business : {question}
      </div>
      <div className="mt-3 text-[10px] text-zinc-600 uppercase tracking-widest">
        En attente de validation du design →
      </div>
    </div>
  );
}

// ============================================================
// SECTION 04 — Growth Diagnosis (Bottleneck Spotlight)
// ============================================================
type DiagSeverity = "HIGH" | "MEDIUM" | "LOW";
type DiagMetric = { key: string; label: string; value: string; target: string; deltaPct: number; tone: "bad" | "warn" | "ok" };
type DiagFactor = { label: string; weight: number; tone: "bad" | "warn" | "ok" };
type GrowthDiagnosis = {
  problemType: string;
  severity: DiagSeverity;
  confidencePct: number;
  bottleneckHeadline: string;
  bottleneckSubtitle: string;
  metrics: DiagMetric[];
  factors: DiagFactor[];
  recommendedFocus: string;
};

const SEV_META: Record<DiagSeverity, { ring: string; text: string; glow: string; radial: string; label: string }> = {
  HIGH:   { ring: "border-red-400",    text: "text-red-400",    glow: "shadow-[0_0_30px_rgba(248,113,113,0.25)]", radial: "radial-gradient(ellipse at top left, rgba(127,29,29,0.35), transparent 60%)", label: "HIGH" },
  MEDIUM: { ring: "border-amber-400",  text: "text-amber-400",  glow: "shadow-[0_0_30px_rgba(251,191,36,0.22)]",  radial: "radial-gradient(ellipse at top left, rgba(120,53,15,0.35), transparent 60%)",  label: "MED" },
  LOW:    { ring: "border-emerald-400",text: "text-emerald-400",glow: "shadow-[0_0_30px_rgba(52,211,153,0.22)]",  radial: "radial-gradient(ellipse at top left, rgba(6,78,59,0.35), transparent 60%)",    label: "LOW" },
};

const TONE_TEXT: Record<"bad"|"warn"|"ok", string> = { bad: "text-red-400", warn: "text-amber-400", ok: "text-emerald-400" };
const TONE_BAR: Record<"bad"|"warn"|"ok", string> = {
  bad:  "bg-gradient-to-r from-amber-500 to-red-400",
  warn: "bg-gradient-to-r from-amber-500 to-amber-300",
  ok:   "bg-gradient-to-r from-emerald-600 to-emerald-400",
};

function useDemoGrowthDiagnosis(): GrowthDiagnosis {
  return {
    problemType: "CONVERSION_RATE_TOO_LOW",
    severity: "HIGH",
    confidencePct: 80,
    bottleneckHeadline: "CONVERSION_RATE_TOO_LOW",
    bottleneckSubtitle: "Le funnel casse entre le trafic et le checkout. Le CAC dérive en conséquence.",
    metrics: [
      { key: "CVR", label: "CVR",  value: "1.24%",  target: "2.10%", deltaPct: -41, tone: "bad" },
      { key: "CAC", label: "CAC",  value: "68 $",   target: "45 $",  deltaPct: +51, tone: "bad" },
      { key: "MER", label: "MER",  value: "2.14x",  target: "2.30",  deltaPct: -7,  tone: "warn" },
    ],
    factors: [
      { label: "Conversion drop",  weight: 0.88, tone: "bad" },
      { label: "CAC overshoot",    weight: 0.64, tone: "warn" },
      { label: "Margin pressure",  weight: 0.22, tone: "ok" },
    ],
    recommendedFocus: "Prioriser CRO : audit landing, offer test, checkout friction.",
  };
}

function GrowthDiagnosisSection({ d }: { d: GrowthDiagnosis }) {
  const sev = SEV_META[d.severity];
  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Section strip */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg,#0b0b0f,#050506)", borderLeft: "3px solid #f87171" }}>
        <span className="text-[10px] tracking-[0.18em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>04</span>
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Growth Diagnosis</span>
        <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· Where is growth breaking?</span>
      </div>

      {/* Hero — bottleneck spotlight */}
      <div className="flex items-center gap-5 p-6 border-b border-zinc-800" style={{ background: sev.radial }}>
        <div className={`w-20 h-20 rounded-full border-2 ${sev.ring} ${sev.glow} flex flex-col items-center justify-center flex-shrink-0`}
             style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className={`text-[11px] font-bold tracking-[0.1em] ${sev.text}`}>{sev.label}</span>
          <span className={`text-[13px] font-bold ${sev.text}`}>{d.confidencePct}%</span>
        </div>
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Primary bottleneck detected
          </div>
          <div className="text-[22px] font-bold text-white leading-tight break-words" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>
            {d.bottleneckHeadline}
          </div>
          <div className="text-[13px] text-zinc-400 mt-1.5">{d.bottleneckSubtitle}</div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3">
        {d.metrics.map((m, i) => (
          <div key={m.key} className={`p-5 ${i < d.metrics.length - 1 ? "border-r border-zinc-800" : ""}`}>
            <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {m.label}
            </div>
            <div className="text-[20px] font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {m.value}
            </div>
            <div className={`text-[11px] mt-1 ${TONE_TEXT[m.tone]}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {m.deltaPct > 0 ? "+" : ""}{m.deltaPct}% vs {m.target}
            </div>
          </div>
        ))}
      </div>

      {/* Contributing factors weighted */}
      <div className="px-6 py-5 border-t border-zinc-800" style={{ background: "#07070c" }}>
        <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Contributing factors · weighted
        </div>
        <div className="space-y-2">
          {d.factors.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <div className="w-40 text-[12px] text-zinc-300 flex-shrink-0">{f.label}</div>
              <div className="flex-1 h-1 bg-zinc-800 rounded-sm overflow-hidden">
                <div className={`h-full ${TONE_BAR[f.tone]}`} style={{ width: `${Math.round(f.weight * 100)}%` }} />
              </div>
              <div className={`w-12 text-right text-[11px] font-bold ${TONE_TEXT[f.tone]}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {f.weight.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800"
           style={{ background: "#0a0f1c" }}>
        <div className="text-[13px] font-semibold text-blue-300 min-w-0 truncate">
          ▸ {d.recommendedFocus}
        </div>
        <button className="px-4 py-2 rounded-sm text-[11px] font-bold tracking-[0.12em] uppercase flex-shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: "#60a5fa", color: "#050506" }}>
          Set focus
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 05 — Profit-First Spend Decision (Traffic-light panel)
// ============================================================
type SpendDecision = "SCALE" | "HOLD" | "CUT";
type ScaleBlocker = { label: string; tone: "bad" | "warn" };
type SpendPlan = {
  decision: SpendDecision;
  headline: string;
  subtitle: string;
  safetyCapDaily: number;
  currentDaily: number;
  maxAllowedCac: number;
  paybackMonths: number;
  blockers: ScaleBlocker[];
};

const DECISION_META: Record<SpendDecision, { label: string; light: 0 | 1 | 2; accent: string; ring: string; dot: string; radial: string }> = {
  SCALE: { label: "SCALE — SAFELY", light: 2, accent: "text-emerald-400", ring: "border-emerald-500/40", dot: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]", radial: "radial-gradient(ellipse at right, rgba(6,78,59,0.35), transparent 55%)" },
  HOLD:  { label: "HOLD — STABILIZE", light: 1, accent: "text-amber-400",  ring: "border-amber-500/40",   dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]",  radial: "radial-gradient(ellipse at right, rgba(120,53,15,0.35), transparent 55%)" },
  CUT:   { label: "CUT — PROTECT",    light: 0, accent: "text-red-400",    ring: "border-red-500/40",     dot: "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]",   radial: "radial-gradient(ellipse at right, rgba(127,29,29,0.35), transparent 55%)" },
};

function useDemoSpendPlan(): SpendPlan {
  return {
    decision: "SCALE",
    headline: "SCALE — SAFELY",
    subtitle: "Runway et marges autorisent +18% de spend quotidien, sous contrainte de CAC.",
    safetyCapDaily: 3500,
    currentDaily: 2170,
    maxAllowedCac: 85,
    paybackMonths: 4.2,
    blockers: [
      { label: "CVR sous cible · funnel casse au checkout (−41%)", tone: "bad" },
      { label: "CAC en dérive vs cible (+51%)",                    tone: "bad" },
      { label: "Fatigue créative détectée · 3 sets à renouveler",  tone: "warn" },
    ],
  };
}

function SpendDecisionSection({ d }: { d: SpendPlan }) {
  const m = DECISION_META[d.decision];
  const headroom = d.safetyCapDaily - d.currentDaily;
  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Section strip */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg,#0b0b0f,#050506)", borderLeft: "3px solid #34d399" }}>
        <span className="text-[10px] tracking-[0.18em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>05</span>
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Profit-First Spend Decision</span>
        <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· Combien peut-on dépenser en sécurité ?</span>
      </div>

      {/* Hero */}
      <div className="flex items-center gap-5 p-6 border-b border-zinc-800" style={{ background: m.radial }}>
        <div className={`flex flex-col gap-1.5 p-2.5 rounded-sm border ${m.ring} flex-shrink-0`}>
          {[2, 1, 0].map((slot) => (
            <span key={slot}
                  className={`w-3.5 h-3.5 rounded-full border border-zinc-800 ${m.light === slot ? m.dot : "bg-zinc-900"}`} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Spend decision · engine
          </div>
          <div className={`text-[22px] font-bold ${m.accent}`} style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>
            {m.label}
          </div>
          <div className="text-[13px] text-zinc-400 mt-1.5">{d.subtitle}</div>
        </div>
      </div>

      {/* Body : cap+guardrails / blockers */}
      <div className="grid md:grid-cols-[1.15fr_1fr]">
        <div className="p-5 md:border-r border-zinc-800">
          <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Safety spend cap
          </div>
          <div className={`text-[32px] font-bold ${m.accent}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            ${fmtEuro(d.safetyCapDaily)}<span className="text-[14px] text-zinc-500 ml-2">/ day</span>
          </div>
          <div className="mt-4 space-y-0">
            {[
              { k: "Current daily", v: `$${fmtEuro(d.currentDaily)}`, tone: "text-white" },
              { k: "Headroom",      v: `+$${fmtEuro(headroom)}`,      tone: "text-emerald-400" },
              { k: "Max allowed CAC", v: `$${d.maxAllowedCac}`,       tone: "text-white" },
              { k: "Payback (mois)",  v: d.paybackMonths.toFixed(1),  tone: "text-white" },
            ].map((r) => (
              <div key={r.k} className="flex justify-between items-center py-2 border-b border-dashed border-zinc-800 text-[13px] text-zinc-300">
                <span>{r.k}</span>
                <span className={`font-bold ${r.tone}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 border-t md:border-t-0 border-zinc-800" style={{ background: "#07070c" }}>
          <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Scale blockers
          </div>
          <div className="space-y-2">
            {d.blockers.map((b, i) => {
              const bad = b.tone === "bad";
              return (
                <div key={i}
                     className="px-3 py-2 text-[12px]"
                     style={{
                       background: bad ? "#170a0a" : "#1a1408",
                       borderLeft: `2px solid ${bad ? "#f87171" : "#fbbf24"}`,
                       color: bad ? "#fecaca" : "#fde68a",
                     }}>
                  ▸ {b.label}
                </div>
              );
            })}
            {d.blockers.length === 0 && (
              <div className="text-[12px] text-zinc-500 italic">Aucun blocker détecté.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// SECTION 06 — Forecast & Targets (Trajectory Chart)
// ============================================================
type ForecastPoint = { t: number; actual?: number; p10?: number; p50?: number; p90?: number };
type ForecastData = {
  expectedRevenue: number;
  targetRevenue: number;
  confidencePct: number;
  p10: number;
  p50: number;
  p90: number;
  hitProbPct: number;
  points: ForecastPoint[]; // ordered, first N have `actual`, rest have p10/p50/p90
};

function useDemoForecast(): ForecastData {
  const points: ForecastPoint[] = [
    { t: 0,  actual: 120 },
    { t: 1,  actual: 132 },
    { t: 2,  actual: 138 },
    { t: 3,  actual: 150 },
    { t: 4,  actual: 158, p10: 158, p50: 158, p90: 158 },
    { t: 5,               p10: 172, p50: 195, p90: 218 },
    { t: 6,               p10: 195, p50: 235, p90: 275 },
    { t: 7,               p10: 220, p50: 275, p90: 330 },
    { t: 8,               p10: 248, p50: 320, p90: 392 },
    { t: 9,               p10: 278, p50: 365, p90: 452 },
    { t: 10,              p10: 305, p50: 405, p90: 498 },
    { t: 11,              p10: 328, p50: 412, p90: 498 },
  ];
  return {
    expectedRevenue: 412_000,
    targetRevenue: 410_000,
    confidencePct: 74,
    p10: 328_000, p50: 412_000, p90: 498_000,
    hitProbPct: 62,
    points,
  };
}

function ForecastSection({ d }: { d: ForecastData }) {
  const W = 600, H = 160, PAD = 8;
  const allVals = d.points.flatMap((p) => [p.actual, p.p10, p.p50, p.p90].filter((x): x is number => typeof x === "number"));
  const maxV = Math.max(...allVals) * 1.05;
  const minV = 0;
  const xs = (t: number) => (t / (d.points.length - 1)) * (W - PAD * 2) + PAD;
  const ys = (v: number) => H - PAD - ((v - minV) / (maxV - minV)) * (H - PAD * 2);
  const targetY = ys((d.targetRevenue / 1000) / 3.4); // scaled for demo — keep proportional-ish
  const targetYReal = ys(105); // ~$410k mapped to points scale (kk axis); pick close to top band

  const toPath = (key: "actual" | "p50") =>
    d.points
      .map((p) => (typeof p[key] === "number" ? `${xs(p.t)},${ys(p[key]!)}` : null))
      .filter(Boolean)
      .join(" ");

  const bandPath = (() => {
    const upper = d.points.filter((p) => typeof p.p90 === "number").map((p) => `${xs(p.t)},${ys(p.p90!)}`);
    const lower = d.points.filter((p) => typeof p.p10 === "number").map((p) => `${xs(p.t)},${ys(p.p10!)}`).reverse();
    if (upper.length === 0) return "";
    return `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`;
  })();

  const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;

  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Section strip */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg,#0b0b0f,#050506)", borderLeft: "3px solid #22d3ee" }}>
        <span className="text-[10px] tracking-[0.18em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>06</span>
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Forecast &amp; Targets</span>
        <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· Que doit-il se passer si le plan est exécuté ?</span>
      </div>

      <div className="p-5">
        {/* Headline */}
        <div className="flex justify-between items-end mb-3 gap-4">
          <div>
            <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Revenue projection · 90 days
            </div>
            <div className="text-[28px] font-bold text-cyan-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ${d.expectedRevenue.toLocaleString("fr-FR")} <span className="text-[14px] text-zinc-500">expected</span>
            </div>
          </div>
          <span className="text-[10px] tracking-[0.14em] uppercase px-2 py-1 rounded-sm border"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(14,116,144,0.2)", color: "#22d3ee", borderColor: "rgba(34,211,238,0.35)" }}>
            CONF {d.confidencePct}%
          </span>
        </div>

        {/* Chart */}
        <div className="relative border border-zinc-800 rounded-sm p-2.5"
             style={{ background: "linear-gradient(180deg,#07070c,#0a0a10)" }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[180px]">
            <defs>
              <linearGradient id="area6" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* grid */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="#14141c" strokeWidth="1" />
            ))}
            {/* confidence band */}
            {bandPath && <path d={bandPath} fill="url(#area6)" />}
            {/* target line */}
            <line x1="0" y1={targetYReal} x2={W} y2={targetYReal} stroke="#34d399" strokeWidth="1.5" strokeDasharray="2 3" />
            <text x="8" y={targetYReal - 4} fill="#34d399" fontSize="10" fontFamily="'JetBrains Mono', monospace">
              tgt {fmtK(d.targetRevenue)}
            </text>
            {/* actuals */}
            <polyline fill="none" stroke="#94a3b8" strokeWidth="2" points={toPath("actual")} />
            {/* forecast p50 */}
            <polyline fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="4 4" points={toPath("p50")} />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex gap-4 flex-wrap mt-3 text-[10px] text-zinc-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {[
            { c: "#94a3b8", l: "Actuals" },
            { c: "#22d3ee", l: "Forecast (P50)" },
            { c: "rgba(34,211,238,0.4)", l: "Confidence band" },
            { c: "#34d399", l: "Target" },
          ].map((x) => (
            <span key={x.l} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-[3px]" style={{ background: x.c }} />{x.l}
            </span>
          ))}
        </div>

        {/* Percentile cells */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
          {[
            { k: "P10 · pessimist", v: fmtK(d.p10), tone: "text-white" },
            { k: "P50 · expected",  v: fmtK(d.p50), tone: "text-cyan-400" },
            { k: "P90 · optimist",  v: fmtK(d.p90), tone: "text-white" },
            { k: "Hit target prob", v: `${d.hitProbPct}%`, tone: "text-emerald-400" },
          ].map((c) => (
            <div key={c.k} className="border border-zinc-800 rounded-sm p-3" style={{ background: "#07070c" }}>
              <div className="text-[9px] tracking-[0.14em] uppercase text-zinc-500 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.k}</div>
              <div className={`text-[16px] font-bold ${c.tone}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 07 — Execution Plan (Mission Stack)
// ============================================================
type MissionPriority = "P0" | "P1" | "P2";
type MissionStatus = "TODO" | "DOING" | "DONE";
type Mission = { id: string; priority: MissionPriority; title: string; impact: string; owner: string; status: MissionStatus };
type ExecutionPlan = { cycleLabel: string; focusLine: string; missions: Mission[] };

const PRIO_META: Record<MissionPriority, { bg: string; text: string; border: string }> = {
  P0: { bg: "bg-red-950/40",    text: "text-red-400",    border: "border-red-500/40" },
  P1: { bg: "bg-amber-950/40",  text: "text-amber-400",  border: "border-amber-500/40" },
  P2: { bg: "bg-slate-800",     text: "text-blue-300",   border: "border-blue-500/40" },
};
const MISSION_STATUS_META: Record<MissionStatus, { label: string; bg: string; text: string; border: string }> = {
  TODO:  { label: "Todo",  bg: "bg-slate-800",       text: "text-blue-300",    border: "border-blue-500/40" },
  DOING: { label: "Doing", bg: "bg-amber-950/40",    text: "text-amber-400",   border: "border-amber-500/40" },
  DONE:  { label: "Done",  bg: "bg-emerald-950/40",  text: "text-emerald-400", border: "border-emerald-500/40" },
};

function useDemoExecutionPlan(): ExecutionPlan {
  return {
    cycleLabel: "CYCLE W28",
    focusLine: "Focus = CRO + créatif · aligné diagnostic 04",
    missions: [
      { id: "m1", priority: "P0", title: "Refonte checkout · retirer friction paiement", impact: "Impact CVR · unblock scale cap 05", owner: "@marc", status: "DOING" },
      { id: "m2", priority: "P0", title: "4 nouveaux angles créatifs · offre bundle",     impact: "Impact CAC · fatigue 3 sets détectée", owner: "@lea",  status: "TODO" },
      { id: "m3", priority: "P1", title: "Landing dédiée bestseller · A/B copy",          impact: "Impact CVR & AOV",                     owner: "@marc", status: "TODO" },
      { id: "m4", priority: "P1", title: "Retargeting 7j add-to-cart · fenêtre courte",   impact: "Impact ROAS",                          owner: "@sam",  status: "DOING" },
      { id: "m5", priority: "P2", title: "Documenter learning cycle W27",                 impact: "Alimente Section 09",                  owner: "@lea",  status: "DONE" },
    ],
  };
}

function ExecutionPlanSection({ d }: { d: ExecutionPlan }) {
  const total = d.missions.length;
  const done = d.missions.filter((m) => m.status === "DONE").length;
  const pct = Math.round((done / total) * 100);
  const counts: Record<MissionPriority, number> = { P0: 0, P1: 0, P2: 0 };
  d.missions.forEach((m) => (counts[m.priority] += 1));

  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg,#0b0b0f,#050506)", borderLeft: "3px solid #a78bfa" }}>
        <span className="text-[10px] tracking-[0.18em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>07</span>
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Execution Plan</span>
        <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· Que doit faire l'engineer cette semaine ?</span>
      </div>

      <div className="flex justify-between items-baseline gap-4 px-5 py-4 border-b border-zinc-800">
        <div className="text-[16px] font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          This week · {total} missions
          <span className="text-[12px] text-violet-400 ml-2">· {counts.P0} P0 · {counts.P1} P1 · {counts.P2} P2</span>
        </div>
        <span className="text-[10px] tracking-[0.14em] uppercase px-2 py-1 rounded-sm border"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(30,16,48,1)", color: "#a78bfa", borderColor: "rgba(167,139,250,0.35)" }}>
          {d.cycleLabel}
        </span>
      </div>

      <div>
        {d.missions.map((m) => {
          const p = PRIO_META[m.priority];
          const s = MISSION_STATUS_META[m.status];
          return (
            <div key={m.id}
                 className="grid gap-3 items-center px-5 py-3.5 border-b border-zinc-900"
                 style={{ gridTemplateColumns: "44px 1fr auto auto" }}>
              <div className={`w-9 h-9 rounded-md border flex items-center justify-center font-bold text-[13px] ${p.bg} ${p.text} ${p.border}`}
                   style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {m.priority}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] text-white font-semibold truncate">{m.title}</div>
                <div className="text-[12px] text-zinc-400 mt-0.5">▸ {m.impact}</div>
              </div>
              <div className="text-[11px] text-zinc-300 hidden sm:block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{m.owner}</div>
              <div className={`text-[10px] px-2 py-1 rounded-sm border ${s.bg} ${s.text} ${s.border} tracking-[0.1em] uppercase text-center`}
                   style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center gap-3 px-5 py-3 border-t border-zinc-800"
           style={{ background: "#0a0f1c" }}>
        <div className="text-[13px] font-semibold text-blue-300 min-w-0 truncate">▸ {d.focusLine}</div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-24 h-1 bg-zinc-800 rounded-sm overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{pct}% complete</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 08 — Live Control (Vital Signs Monitor)
// ============================================================
type VitalTrend = "up" | "down" | "warn" | "flat";
type Vital = {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: VitalTrend;
  spark: number[];
};
type LiveAlert = { id: string; severity: "HIGH" | "MED"; text: string; time: string };
type LiveControl = {
  updatedLabel: string;
  windowLabel: string;
  vitals: Vital[];
  alerts: LiveAlert[];
};

const TREND_META: Record<VitalTrend, { color: string; glyph: string; bg: string; border: string }> = {
  up:   { color: "#34d399", glyph: "▲", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)" },
  down: { color: "#f87171", glyph: "▼", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
  warn: { color: "#fbbf24", glyph: "▲", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)" },
  flat: { color: "#94a3b8", glyph: "▬", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.2)" },
};

function useDemoLiveControl(): LiveControl {
  return {
    updatedLabel: "LIVE · updated 12s ago",
    windowLabel: "TODAY · 00:00 → NOW",
    vitals: [
      { id: "rev",  label: "Revenue",  value: "$4 820", delta: "+8.4% vs pace", trend: "up",   spark: [12,14,13,16,18,17,22,24,23,26,28,30] },
      { id: "spd",  label: "Spend",    value: "$1 640", delta: "on target",     trend: "flat", spark: [10,11,10,12,12,13,12,13,14,14,15,15] },
      { id: "cac",  label: "CAC",      value: "$68",    delta: "+12% drift",    trend: "warn", spark: [20,22,21,24,26,25,28,27,29,32,30,33] },
      { id: "roas", label: "ROAS",     value: "2.94x",  delta: "-4% vs plan",   trend: "down", spark: [30,29,28,28,27,26,26,25,24,25,24,23] },
      { id: "cvr",  label: "CVR",      value: "2.6%",   delta: "-0.3 pt",       trend: "down", spark: [28,27,26,27,26,25,24,25,24,23,23,22] },
      { id: "ord",  label: "Orders",   value: "24",     delta: "+6 vs pace",    trend: "up",   spark: [4,6,5,8,10,12,14,15,18,20,22,24] },
      { id: "aov",  label: "AOV",      value: "$201",   delta: "+$8",           trend: "up",   spark: [18,19,18,20,21,20,22,22,23,24,23,25] },
      { id: "cpm",  label: "Meta CPM", value: "$18.40", delta: "+18% today",    trend: "warn", spark: [10,11,11,13,14,15,17,18,20,22,24,25] },
    ],
    alerts: [
      { id: "a1", severity: "HIGH", text: "Meta CPM spike +18% · audience US-broad · vérifier fatigue créative", time: "14:32" },
      { id: "a2", severity: "MED",  text: "CAC drift au-dessus de la cible (68 vs 60) depuis 3h",                time: "13:05" },
    ],
  };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const step = w / Math.max(1, data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LiveControlSection({ d }: { d: LiveControl }) {
  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg,#0b0b0f,#050506)", borderLeft: "3px solid #34d399" }}>
        <span className="text-[10px] tracking-[0.18em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>08</span>
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Live Control</span>
        <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· Est-ce que le plan fonctionne aujourd'hui ?</span>
      </div>

      <div className="flex justify-between items-baseline gap-4 px-5 py-4 border-b border-zinc-800">
        <div className="text-[16px] font-bold text-white flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Vital Signs
          <span className="text-[12px] text-emerald-400 ml-1">· {d.updatedLabel}</span>
        </div>
        <span className="text-[10px] tracking-[0.14em] uppercase px-2 py-1 rounded-sm border"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(6,44,32,1)", color: "#34d399", borderColor: "rgba(52,211,153,0.35)" }}>
          {d.windowLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-900">
        {d.vitals.map((v) => {
          const t = TREND_META[v.trend];
          return (
            <div key={v.id} className="p-3 flex flex-col gap-1.5" style={{ background: "#0a0a10" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm border" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.color, background: t.bg, borderColor: t.border }}>
                  {t.glyph}
                </span>
              </div>
              <div className="text-[18px] font-bold text-white leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.value}</div>
              <Sparkline data={v.spark} color={t.color} />
              <div className="text-[10px]" style={{ color: t.color, fontFamily: "'JetBrains Mono', monospace" }}>{v.delta}</div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-800">
        <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-900"
             style={{ background: "#140a0a" }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] tracking-[0.18em] uppercase font-bold text-red-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Alerts · {d.alerts.length}</span>
        </div>
        {d.alerts.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-5 py-2.5 border-b border-zinc-900">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm border tracking-[0.1em] ${a.severity === "HIGH" ? "text-red-400 border-red-500/40 bg-red-950/40" : "text-amber-400 border-amber-500/40 bg-amber-950/30"}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {a.severity}
            </span>
            <div className="flex-1 min-w-0 text-[13px] text-zinc-200">▸ {a.text}</div>
            <span className="text-[10px] text-zinc-500 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SECTION 09 — MEASUREMENT & LEARNING (Learning Log + Scorecard)
// ============================================================
type ScoreTrend = "up" | "down" | "flat";
type Score = { id: string; label: string; value: string; delta: string; trend: ScoreTrend };
type Insight = { id: string; tag: string; text: string; confidence: "HIGH" | "MED" | "LOW"; reuse: string };
type Learning = {
  cycleLabel: string;
  windowLabel: string;
  scores: Score[];
  insights: Insight[];
};

const SCORE_META: Record<ScoreTrend, { color: string; glyph: string; bg: string; border: string }> = {
  up:   { color: "#34d399", glyph: "▲", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)" },
  down: { color: "#f87171", glyph: "▼", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
  flat: { color: "#94a3b8", glyph: "▬", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.2)" },
};

const CONF_META: Record<Insight["confidence"], { color: string; bg: string; border: string }> = {
  HIGH: { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.35)" },
  MED:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.35)" },
  LOW:  { color: "#94a3b8", bg: "rgba(148,163,184,0.08)",border: "rgba(148,163,184,0.3)" },
};

function useDemoLearning(): Learning {
  return {
    cycleLabel: "CYCLE W28 · 8 → 14 juil.",
    windowLabel: "vs W27",
    scores: [
      { id: "rev",  label: "Revenue",  value: "+18%",  delta: "$28.4k → $33.5k", trend: "up"   },
      { id: "cac",  label: "CAC",      value: "-6%",   delta: "$72 → $68",       trend: "up"   },
      { id: "cvr",  label: "CVR",      value: "+0.5pt",delta: "2.4% → 2.9%",     trend: "up"   },
      { id: "roas", label: "ROAS",     value: "-4%",   delta: "3.08x → 2.94x",   trend: "down" },
    ],
    insights: [
      { id: "i1", tag: "CREATIVE",  text: "Les hooks UGC \"témoignage 15s\" surperforment les hooks studio (+34% CTR, -22% CPA). Angle réutilisable sur les prochains lots.", confidence: "HIGH", reuse: "→ Section 07 (Creative Brief W29)" },
      { id: "i2", tag: "AUDIENCE",  text: "Broad US mature (30-45 F) surperforme l'audience jeune (18-29). Shifter 60% du budget prospection sur cette tranche.",         confidence: "HIGH", reuse: "→ Section 05 (Spend Plan W29)" },
      { id: "i3", tag: "OFFER",     text: "Bundle 2+1 fait +$8 AOV vs single unit mais réduit CVR de 0.4pt. Trade-off net positif sur la marge unitaire.",                confidence: "MED",  reuse: "→ Section 06 (Forecast AOV)" },
      { id: "i4", tag: "FUNNEL",    text: "PDP loading > 3s corrèle avec -40% CVR mobile. Fix technique nécessaire avant scale.",                                         confidence: "MED",  reuse: "→ Section 02 (Data Readiness)" },
    ],
  };
}

function MeasurementLearningSection({ d }: { d: Learning }) {
  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", color: "#e0e0e0", fontFamily: "'Rajdhani', sans-serif" }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg,#0b0b0f,#050506)", borderLeft: "3px solid #34d399" }}>
        <span className="text-[10px] tracking-[0.18em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>09</span>
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Measurement & Learning</span>
        <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· Qu'a-t-on appris ?</span>
      </div>

      <div className="flex justify-between items-baseline gap-4 px-5 py-4 border-b border-zinc-800">
        <div className="text-[16px] font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Scorecard
          <span className="text-[12px] text-zinc-500 ml-2 font-normal">· {d.cycleLabel}</span>
        </div>
        <span className="text-[10px] tracking-[0.14em] uppercase px-2 py-1 rounded-sm border"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(6,44,32,1)", color: "#34d399", borderColor: "rgba(52,211,153,0.35)" }}>
          {d.windowLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-900">
        {d.scores.map((s) => {
          const t = SCORE_META[s.trend];
          return (
            <div key={s.id} className="p-3 flex flex-col gap-1.5" style={{ background: "#0a0a10" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm border" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.color, background: t.bg, borderColor: t.border }}>
                  {t.glyph}
                </span>
              </div>
              <div className="text-[22px] font-bold leading-none" style={{ color: t.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              <div className="text-[10px] text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.delta}</div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-800">
        <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-900"
             style={{ background: "#0a1414" }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] tracking-[0.18em] uppercase font-bold text-emerald-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Learning Log · {d.insights.length}</span>
          <span className="text-[10px] tracking-[0.14em] uppercase text-zinc-500 ml-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>· insights réutilisables</span>
        </div>
        {d.insights.map((i) => {
          const c = CONF_META[i.confidence];
          return (
            <div key={i.id} className="px-5 py-3 border-b border-zinc-900 last:border-b-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm border tracking-[0.1em] text-zinc-300 border-zinc-700 bg-zinc-900"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {i.tag}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm border tracking-[0.1em]"
                      style={{ fontFamily: "'JetBrains Mono', monospace", color: c.color, background: c.bg, borderColor: c.border }}>
                  CONF {i.confidence}
                </span>
              </div>
              <div className="text-[13px] text-zinc-200 leading-snug mb-1">▸ {i.text}</div>
              <div className="text-[10px] text-emerald-400/80" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{i.reuse}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ADAPTIVE OPERATING VIEW
// ============================================================

type ProfitWorkspaceMode = "new-client" | "active-client" | "model-reliability";

type WorkflowItem = {
  section: string;
  action: string;
  reason: string;
  to?: string;
  badge?: string;
};

type WorkflowGroup = {
  title: string;
  description: string;
  items: WorkflowItem[];
};

type OutcomeCard = {
  label: string;
  value: string;
  source: string;
  to?: string;
};

const MODE_META: Record<ProfitWorkspaceMode, { label: string; eyebrow: string; description: string }> = {
  "new-client": {
    label: "Nouveau client",
    eyebrow: "Setup + plan 30 jours",
    description: "Affiche les sections utiles pour construire le plan initial et expliquer au client la cible de rentabilite, le spend, les commandes attendues, les cibles CAC/MER, le plafond de risque, les besoins creatifs et les SKU a surveiller.",
  },
  "active-client": {
    label: "Client actif",
    eyebrow: "Routine AM",
    description: "Affiche la routine quotidienne, hebdomadaire et mensuelle pour reagir vite quand les campagnes tournent deja.",
  },
  "model-reliability": {
    label: "Fiabilite & modeles",
    eyebrow: "Audit data/model",
    description: "Affiche les sections qui servent a verifier la qualite des donnees, la fiabilite statistique et les limites des modeles avant d'agir.",
  },
};

function buildNewClientOutcomes(clientRoute: (path: string) => string): OutcomeCard[] {
  return [
    { label: "Rentabilite visee", value: "Cible contribution / marge", source: "Objectifs business + Configuration du modele", to: clientRoute("business-objectives") },
    { label: "Spend approximatif", value: "Budget safe-to-spend", source: "Pouvoir de depense + PFMB", to: clientRoute("spending-power") },
    { label: "Commandes attendues", value: "Volume 30 jours", source: "Previsions + P&L journalier", to: clientRoute("forecast") },
    { label: "CAC/MER cible", value: "Cible officielle 30 jours", source: "Objectifs de metriques", to: clientRoute("metric-targets") },
    { label: "Plafond de risque", value: "Max spend avant gate", source: "Budget Change Gate", to: clientRoute("budget-change-gate") },
    { label: "Volume creatif requis", value: "Creatifs / semaine", source: "Besoin en creatifs", to: clientRoute("creative-demand") },
    { label: "SKU a surveiller", value: "Stock vs demande", source: "Plan de demande SKU", to: clientRoute("sku-demand-plan") },
  ];
}

function buildWorkflowGroups(mode: ProfitWorkspaceMode, clientRoute: (path: string) => string): WorkflowGroup[] {
  if (mode === "new-client") {
    return [
      {
        title: "Sequence nouveau client",
        description: "A utiliser de l'activation client jusqu'au premier plan media executable.",
        items: [
          { badge: "1", section: "Clients", action: "Creer / activer la fiche client", reason: "Point d'entree obligatoire.", to: "/admin/gos/clients" },
          { badge: "2", section: "Integrations + Checklist donnees manuelles", action: "Connecter les sources ou cocher ce qui est saisi manuellement", reason: "Sans donnees, aucun calcul n'est fiable.", to: "/admin/gos/data-sources" },
          { badge: "3", section: "Espace client", action: "Verifier le hub de navigation du client", reason: "Confirme que tout est bien lie au bon client.", to: clientRoute("workspace") },
          { badge: "4", section: "Configuration du modele", action: "Remplir contexte, finance, produits, stock/capacite, baseline et panier", reason: "Fondation de tous les moteurs de calcul. Rien n'est fiable tant que ce n'est pas READY.", to: clientRoute("growth-model-setup") },
          { badge: "5", section: "Objectifs business", action: "Clarifier rentabilite, croissance, sortie et timeline", reason: "Determine quel scenario viser plus tard.", to: clientRoute("business-objectives") },
          { badge: "6", section: "Diagnostic de croissance", action: "Identifier le probleme principal avec severite et confiance", reason: "Oriente toute la strategie qui suit.", to: clientRoute("growth-diagnosis") },
          { badge: "7", section: "Effet d'evenement", action: "Modeliser Black Friday, saisonnalite, lancement ou promo", reason: "Input du forecast.", to: clientRoute("event-effect") },
          { badge: "8", section: "Retention", action: "Lire les cohortes mensuelles, quick ratio et rachat reel", reason: "Input du forecast pour la partie previsible du revenu.", to: clientRoute("retention") },
          { badge: "9", section: "Pouvoir de depense", action: "Calculer le maximum de depense sans casser la marge", reason: "Input du risk management.", to: clientRoute("spending-power") },
          { badge: "10", section: "Previsions", action: "Generer regulier / upside / downside", reason: "Forecast global: revenu, spend, leads, CAC, MER.", to: clientRoute("forecast") },
          { badge: "11", section: "Objectifs de metriques", action: "Figer le scenario retenu", reason: "Cible officielle suivie au quotidien.", to: clientRoute("metric-targets") },
          { badge: "12", section: "P&L hebdomadaire", action: "Decouper le forecast sur 4 semaines", reason: "Granularite semaine.", to: clientRoute("weekly-pnl") },
          { badge: "13", section: "P&L journalier", action: "Decouper chaque semaine jour par jour", reason: "Ce qu'on compare a la realite chaque matin.", to: clientRoute("daily-pnl") },
          { badge: "14", section: "Besoin en creatifs", action: "Estimer les nouveaux creatifs par semaine", reason: "Soutenir le spend sans fatigue publicitaire.", to: clientRoute("creative-demand") },
          { badge: "15", section: "Plan de demande SKU", action: "Aligner forecast, stock et achat media par SKU", reason: "Evite de pousser un produit en rupture.", to: clientRoute("sku-demand-plan") },
          { badge: "16", section: "Offer Lab -> Concept Log -> Ultimate Brief", action: "Structurer les offres, concepts et briefs si necessaire", reason: "Fondation creative quand le diagnostic le demande.", to: clientRoute("offer-lab") },
          { badge: "17", section: "Categories de campagnes", action: "Regrouper les campagnes par intention et fixer les CPA cibles", reason: "Base du Buyer Workspace.", to: clientRoute("campaign-categories") },
          { badge: "18", section: "Buyer Workspace", action: "Construire la structure de depart des campagnes", reason: "Point de bascule vers la routine client actif.", to: clientRoute("buyer-workspace") },
        ],
      },
    ];
  }

  if (mode === "active-client") {
    return [
      {
        title: "Tous les jours",
        description: "Routine AM/media buyer pour trouver ou ca deraille et agir vite.",
        items: [
          { section: "Tableau de bord / Portefeuille executif", action: "Voir qui a besoin d'attention en premier", reason: "Priorisation portefeuille.", to: "/admin/gos/portfolio" },
          { section: "Walkdown metriques", action: "Descendre contribution -> volume/efficacite -> canal -> campagne", reason: "Trouver ou ca deraille.", to: clientRoute("walkdown") },
          { section: "Buyer Workspace", action: "Decider scale / hold / reduire / pause", reason: "Decision media quotidienne.", to: clientRoute("buyer-workspace") },
          { section: "Daily Budget Planner", action: "Ajuster un budget si necessaire", reason: "Traduction budgetaire par campagne.", to: clientRoute("daily-budget-planner") },
          { section: "Media Buying Automation", action: "Lire les suggestions basees sur les regles", reason: "Detection automatique avec cooldown anti-spam.", to: clientRoute("media-buying-automation") },
          { section: "Budget Change Gate", action: "Valider toute hausse importante", reason: "Approval avant application.", to: clientRoute("budget-change-gate") },
          { section: "Optimisation live", action: "Journaliser les decisions prises", reason: "Trace operationnelle.", to: clientRoute("live-optimization") },
          { section: "Map Notes", action: "Ecrire quoi / pourquoi / quoi faire maintenant", reason: "Narratif quotidien par changement.", to: clientRoute("map-notes") },
          { section: "Daily Digest", action: "Resume auto du matin: MTD vs cible", reason: "Communication client quotidienne.", to: clientRoute("daily-digest") },
        ],
      },
      {
        title: "Chaque semaine",
        description: "Rituel de review pour recalibrer media, creatif et forecast.",
        items: [
          { section: "Wayfinder Wednesday", action: "Decider quoi garder, scaler, couper ou tester", reason: "Creative + media ensemble.", to: clientRoute("wayfinder-wednesday") },
          { section: "Mesure", action: "Verifier si les resultats sont reels ou seulement attribues", reason: "Controle incrementality/attribution.", to: clientRoute("measurement") },
          { section: "Mises a jour previsions", action: "Recalibrer le forecast si la realite devie", reason: "Conserver target, projection et actual separes.", to: clientRoute("forecast-updates") },
          { section: "Weekly Executive Report", action: "Produire la version client de la semaine", reason: "Reporting executif.", to: clientRoute("weekly-executive-report") },
        ],
      },
      {
        title: "Fin de cycle",
        description: "Rituel mensuel avant le prochain plan.",
        items: [
          { section: "Boucle d'apprentissage", action: "Archiver les gagnants, perdants et pourquoi", reason: "Memoire du systeme.", to: clientRoute("learning-loop") },
          { section: "Planification prochain cycle", action: "Fixer objectifs, hypotheses, budget et risques du mois suivant", reason: "Ancre aux apprentissages.", to: clientRoute("next-cycle-planning") },
        ],
      },
      {
        title: "Au besoin",
        description: "A ouvrir quand le diagnostic pointe vers creatif, offre ou execution.",
        items: [
          { section: "Concept Log / Testing Roadmap / Offer Lab / Angle Matrix / Ultimate Brief", action: "Lancer ou structurer de nouveaux tests", reason: "CAC haut, fatigue publicitaire, conversion faible ou manque de tests.", to: clientRoute("concept-log") },
          { section: "Carte d'execution", action: "Transformer le diagnostic en plan d'actions concret", reason: "Actions rattachees aux cibles et diagnostics.", to: clientRoute("growth-execution-map") },
        ],
      },
    ];
  }

  return [
    {
      title: "Fiabilite des donnees et modeles",
      description: "Ces sections verifient la fiabilite. Elles ne servent pas a agir sur un compte au jour le jour.",
      items: [
        { section: "Data Analyst Foundation", action: "Verifier si les donnees sont assez propres", reason: "Condition pour faire confiance aux modeles.", to: clientRoute("data-analyst") },
        { section: "Statistical Analyst", action: "Lire les sorties Python: retention, anomalies, spend, MMM", reason: "Couche statistique et limites du modele.", to: clientRoute("data-analyst/statistical") },
        { section: "Analyst Execution", action: "Transformer l'analyse statistique en plan controle", reason: "Clash-code-confirm avant action.", to: clientRoute("data-analyst/execution") },
        { section: "Intelligence client", action: "Lire sante, momentum, forces, alertes et recommandations", reason: "Contexte qualitatif du compte.", to: clientRoute("intelligence") },
        { section: "Finance consolidee", action: "Voir la finance globale avancee", reason: "Controle finance hors routine quotidienne.", to: clientRoute("financial-consolidated") },
        { section: "Agents IA & automations", action: "Monitorer les automatisations IA", reason: "Controle des systemes automatiques.", to: clientRoute("ai-automations") },
        { section: "Modele financier e-commerce", action: "Auditer le modele financier detaille", reason: "Reserve aux clients e-commerce.", to: clientRoute("ecommerce-financial-model") },
      ],
    },
  ];
}

function AdaptiveWorkflowHub({
  clientId,
  mode,
  setMode,
}: {
  clientId?: string;
  mode: ProfitWorkspaceMode;
  setMode: Dispatch<SetStateAction<ProfitWorkspaceMode>>;
}) {
  const clientRoute = (path: string) => clientId ? `/admin/gos/clients/${clientId}/${path}` : "/admin/gos/clients";
  const active = MODE_META[mode];
  const groups = buildWorkflowGroups(mode, clientRoute);
  const outcomes = buildNewClientOutcomes(clientRoute);

  return (
    <section className="border border-zinc-800 rounded-sm overflow-hidden" style={{ background: "#08080d", color: "#e5e7eb", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
      <div className="px-4 py-3 border-b border-zinc-800 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" style={{ background: "#0d0d15" }}>
        <div>
          <div className="text-[10px] text-cyan-400 tracking-[0.18em] uppercase font-bold">Vue adaptive Profit-First</div>
          <h2 className="mt-1 text-xl text-white font-bold" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{active.label}</h2>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed max-w-4xl">{active.description}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-full lg:min-w-[520px]">
          {(Object.keys(MODE_META) as ProfitWorkspaceMode[]).map((key) => {
            const isActive = key === mode;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className="px-3 py-2 rounded-sm border text-left transition-colors"
                style={{
                  background: isActive ? "rgba(6,182,212,0.16)" : "#050506",
                  borderColor: isActive ? "rgba(34,211,238,0.55)" : "#27272a",
                  color: isActive ? "#67e8f9" : "#d4d4d8",
                }}
              >
                <div className="text-[9px] tracking-[0.16em] uppercase text-zinc-500">{MODE_META[key].eyebrow}</div>
                <div className="mt-1 text-[12px] font-bold">{MODE_META[key].label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {mode === "new-client" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-zinc-900">
          {outcomes.map((card) => (
            <Link key={card.label} to={card.to ?? "#"} className="p-4 no-underline block" style={{ background: "#0a0a10", color: "inherit" }}>
              <div className="text-[9px] tracking-[0.14em] uppercase text-zinc-500">{card.label}</div>
              <div className="mt-2 text-[16px] font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{card.value}</div>
              <div className="mt-1 text-[11px] text-cyan-300/80 leading-snug">{card.source}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="p-4 md:p-5 space-y-4">
        {groups.map((group) => (
          <div key={group.title} className="border border-zinc-800 rounded-sm overflow-hidden" style={{ background: "#050506" }}>
            <div className="px-4 py-3 border-b border-zinc-800">
              <div className="text-[14px] font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{group.title}</div>
              <div className="mt-1 text-[11px] text-zinc-500">{group.description}</div>
            </div>
            <div className="divide-y divide-zinc-900">
              {group.items.map((item, index) => (
                <Link
                  key={`${group.title}-${item.section}-${index}`}
                  to={item.to ?? "#"}
                  className="grid grid-cols-1 lg:grid-cols-[56px_minmax(180px,260px)_1fr_1fr_auto] gap-3 px-4 py-3 no-underline items-start hover:bg-zinc-900/50"
                  style={{ color: "inherit" }}
                >
                  <div className="text-[10px] text-zinc-500 tracking-[0.16em] uppercase">{item.badge ?? String(index + 1).padStart(2, "0")}</div>
                  <div className="text-[13px] font-bold text-zinc-100">{item.section}</div>
                  <div className="text-[12px] text-zinc-300 leading-snug">{item.action}</div>
                  <div className="text-[12px] text-zinc-500 leading-snug">{item.reason}</div>
                  <div className="text-[10px] text-cyan-300 tracking-[0.12em] uppercase whitespace-nowrap">Ouvrir</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// PAGE
// ============================================================
export default function ProfitFirstWorkspace() {
  const { clientId } = useParams();
  const [mode, setMode] = useState<ProfitWorkspaceMode>("new-client");
  const { selectedClient } = useSelectedClient();
  const overview = useDemoOverview(selectedClient?.company_name);
  const sources = useDemoDataSources();
  const financial = useDemoFinancialFoundation();
  const diagnosis = useDemoGrowthDiagnosis();
  const spendPlan = useDemoSpendPlan();
  const forecast = useDemoForecast();
  const execution = useDemoExecutionPlan();
  const liveControl = useDemoLiveControl();
  const learning = useDemoLearning();

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />

      <div className="min-h-screen -m-8 p-4 md:p-8"
           style={{ background: "#050506" }}>
        <div className="max-w-6xl mx-auto space-y-4">
          <WorkspaceProgress highlight={9} />
          <AdaptiveWorkflowHub clientId={clientId} mode={mode} setMode={setMode} />
          <ExecutiveOverview d={overview} />
          <DataReadiness sources={sources} />
          <FinancialFoundationSection d={financial} />
          <GrowthDiagnosisSection d={diagnosis} />
          <SpendDecisionSection d={spendPlan} />
          <ForecastSection d={forecast} />
          <ExecutionPlanSection d={execution} />
          <LiveControlSection d={liveControl} />
          <MeasurementLearningSection d={learning} />
        </div>
      </div>
    </>
  );
}

// ============= WORKSPACE PROGRESS INDICATOR =============
const WORKSPACE_SECTIONS: { n: number; label: string }[] = [
  { n: 1, label: "Executive Overview" },
  { n: 2, label: "Data Readiness" },
  { n: 3, label: "Financial Foundation" },
  { n: 4, label: "Growth Diagnosis" },
  { n: 5, label: "Spend Decision" },
  { n: 6, label: "Forecast & Targets" },
  { n: 7, label: "Execution Plan" },
  { n: 8, label: "Live Control" },
  { n: 9, label: "Learning Log + Scorecard" },
];

function WorkspaceProgress({ highlight }: { highlight: number }) {
  const total = WORKSPACE_SECTIONS.length;
  const done = total; // all 9 complete
  const pct = Math.round((done / total) * 100);

  return (
    <div className="w-full border border-zinc-800 rounded-sm overflow-hidden"
         style={{ background: "#0a0a10", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800"
           style={{ background: "linear-gradient(90deg, #10101a 0%, #0a0a10 100%)" }}>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <div className="text-[10px] text-emerald-400 tracking-[0.2em] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          WORKSPACE PROGRESS
        </div>
        <div className="flex-1" />
        <div className="text-[10px] text-zinc-500 tracking-[0.15em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          CYCLE W28
        </div>
      </div>

      {/* Title + counter */}
      <div className="flex justify-between items-baseline gap-4 px-5 py-4 border-b border-zinc-800">
        <div>
          <div className="text-[16px] font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {done}/{total} SECTIONS COMPLETE
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Cycle bouclé · Prêt pour le prochain cycle</div>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-bold text-emerald-400 leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {pct}%
          </div>
          <div className="text-[9px] text-zinc-500 tracking-[0.15em] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            COMPLETION
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-3 border-b border-zinc-800">
        <div className="w-full h-1.5 bg-zinc-900 rounded-sm overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Section stepper */}
      <div className="grid grid-cols-3 sm:grid-cols-9 gap-px bg-zinc-900">
        {WORKSPACE_SECTIONS.map((s) => {
          const isHighlight = s.n === highlight;
          return (
            <div
              key={s.n}
              className="p-2.5 flex flex-col items-center gap-1.5 relative"
              style={{
                background: isHighlight ? "rgba(52,211,153,0.08)" : "#0a0a10",
              }}
            >
              {isHighlight && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-400" />
              )}
              <div
                className={`w-7 h-7 rounded-sm border flex items-center justify-center font-bold text-[11px] ${
                  isHighlight
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60"
                    : "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/30"
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {String(s.n).padStart(2, "0")}
              </div>
              <div
                className={`text-[9px] text-center leading-tight tracking-wide uppercase ${
                  isHighlight ? "text-emerald-300 font-bold" : "text-zinc-500"
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {isHighlight ? "▸ " : ""}✓
              </div>
            </div>
          );
        })}
      </div>

      {/* Highlight footer */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-zinc-800"
           style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 100%)" }}>
        <div className="text-[10px] text-emerald-400 font-bold tracking-[0.15em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          NEW ▸
        </div>
        <div className="text-[13px] text-white font-semibold flex-1 truncate">
          Section 09 — Learning Log + Scorecard
        </div>
        <div className="text-[10px] text-emerald-400/80 tracking-[0.1em] hidden sm:block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          CYCLE CLOSED → NEXT CYCLE
        </div>
      </div>
    </div>
  );
}
