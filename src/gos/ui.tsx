import { ReactNode } from "react";
import { DATA_MODE_META, type DataMode } from "./dataMode";
import { useRegisterHelp } from "./help";


export function DataModeBadge({ mode }: { mode?: string | null }) {
  const key = ((mode as DataMode) || "DEMO_DATA") as DataMode;
  const m = DATA_MODE_META[key] || DATA_MODE_META.DEMO_DATA;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999,
      background: m.bg, color: m.color,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
    }} title={m.usage}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color }} />
      {m.label.toUpperCase()}
    </span>
  );
}

export function DataQualityBadge({ score }: { score?: number | null }) {
  if (score == null) return (
    <span style={{ padding: "3px 10px", borderRadius: 999, background: "#eef1f5", color: "#6C7F93", fontSize: 11, fontWeight: 600 }}>
      DQS —
    </span>
  );
  const color = score >= 75 ? "#0f8a44" : score >= 50 ? "#a8730a" : "#c1121f";
  const bg    = score >= 75 ? "#e3f7ec" : score >= 50 ? "#fff4d9" : "#ffe3e3";
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em" }} title="Data Quality Score">
      DQS {score}/100
    </span>
  );
}


export const PHASES = [
  "ONBOARDING","AUDIT_STRATEGY","CREATIVE","CREATIVE_PRODUCTION",
  "CLIENT_REVIEW_APPROVAL","CAMPAIGN_BUILD","LAUNCH_PREP","LIVE","REPORTING","AT_RISK",
] as const;

export const BUSINESS_TYPES = ["ECOMMERCE","LOCAL_SERVICE","SAAS","AGENCE","HYBRID","OTHER"] as const;
export type BusinessType = typeof BUSINESS_TYPES[number];
export const RISK_LEVELS = ["UNKNOWN","LOW","MEDIUM","HIGH","CRITICAL"] as const;
export const SETUP_STATUSES = ["NOT_STARTED","MISSING_INPUTS","READY","APPROVED","ERROR"] as const;
export type SetupStatus = typeof SETUP_STATUSES[number];

const RISK_STYLE: Record<string, { bg: string; fg: string }> = {
  UNKNOWN:  { bg: "#eef1f5", fg: "#6C7F93" },
  LOW:      { bg: "#e3f7ec", fg: "#0f8a44" },
  MEDIUM:   { bg: "#fff4d9", fg: "#a8730a" },
  HIGH:     { bg: "#ffe3e3", fg: "#c1121f" },
  CRITICAL: { bg: "hsl(0 84% 96%)", fg: "#c1121f" },
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  NOT_STARTED:    { bg: "#eef1f5", fg: "#6C7F93" },
  MISSING_INPUTS: { bg: "#fff4d9", fg: "#a8730a" },
  READY:          { bg: "#e0edff", fg: "#006AFF" },
  APPROVED:       { bg: "#e3f7ec", fg: "#0f8a44" },
  ERROR:          { bg: "#ffe3e3", fg: "#c1121f" },
};

function pill(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.03em",
  };
}

export function RiskBadge({ level }: { level?: string | null }) {
  const key = (level || "UNKNOWN").toUpperCase();
  const s = RISK_STYLE[key] || RISK_STYLE.UNKNOWN;
  return <span style={pill(s.bg, s.fg)}>{key}</span>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const key = (status || "NOT_STARTED").toUpperCase();
  const s = STATUS_STYLE[key] || STATUS_STYLE.NOT_STARTED;
  return <span style={pill(s.bg, s.fg)}>{key.replace(/_/g, " ")}</span>;
}

export function PhaseBadge({ phase }: { phase?: string | null }) {
  return <span style={pill("hsl(0 0% 94.5%)", "hsl(0 0% 20%)")}>{(phase || "—").replace(/_/g, " ")}</span>;
}

export type PageGuideProps = {
  purpose: string;
  dataSource?: string;
  usedBy?: string;
  requiredInputs?: string[];
  missingInputs?: string[];
  nextStep?: string;
  primaryCta?: string;
  isForecast?: boolean;
  riskWarning?: string | null;
};

export function SectionHeader({
  title, subtitle, actions, guide,
}: { title: string; subtitle?: string; actions?: ReactNode; guide?: PageGuideProps }) {
  // Publish page help to the global drawer (lazy import to avoid circular deps)
  useRegisterHelp(guide ? {
    title,
    purpose: guide.purpose,
    dataSource: guide.dataSource,
    usedBy: guide.usedBy,
    requiredInputs: guide.requiredInputs,
    missingInputs: guide.missingInputs,
    nextStep: guide.nextStep,
    primaryCta: guide.primaryCta,
  } : null);


  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "10px 0",
          marginBottom: guide ? 8 : 12,
          borderBottom: "1px solid var(--tdia-border)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: 0,
              color: "var(--tdia-text)",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                color: "var(--tdia-muted)",
                marginTop: 2,
                marginBottom: 0,
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>{actions}</div>}
      </div>
      {guide && <PageGuide {...guide} />}
    </>
  );
}

export function PageGuide(g: PageGuideProps) {
  const hasMissing = g.missingInputs && g.missingInputs.length > 0;
  return (
    <div style={{ marginBottom: 20, display: "grid", gap: 8 }}>
      {g.riskWarning && (
        <div className="gos-card" style={{ padding: 12, borderLeft: "3px solid #c1121f", background: "hsl(0 84% 96%)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#c1121f", letterSpacing: "0.03em", marginBottom: 4 }}>⚠ ALERTE RISQUE</div>
          <div style={{ fontSize: 13, color: "var(--tdia-text)" }}>{g.riskWarning}</div>
        </div>
      )}
    </div>
  );
}


function GuideCell({ label, value, tone }: { label: string; value: string; tone?: "danger" | "accent" }) {
  const color = tone === "danger" ? "#c1121f" : tone === "accent" ? "var(--tdia-blue)" : "var(--tdia-text)";
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--tdia-muted)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

export function KpiCard({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const inner = (
    <div className="gos-card" style={{ height: "100%", padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--tdia-muted)", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: "var(--tdia-text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
  return to ? <a href={to} style={{ textDecoration: "none", display: "block" }}>{inner}</a> : inner;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--tdia-muted)" }}>
      <div style={{ fontWeight: 500, color: "var(--tdia-text)" }}>{title}</div>
      {hint && <div style={{ marginTop: 6, fontSize: 13 }}>{hint}</div>}
    </div>
  );
}

/** Compute overall Growth Model Setup status from block statuses. */
export function overallSetupStatus(statuses: (SetupStatus | null | undefined)[]) {
  const present = statuses.filter(Boolean) as SetupStatus[];
  if (present.length === 0) return "INCOMPLETE";
  const allApproved = present.length === statuses.length && present.every((s) => s === "APPROVED" || s === "READY");
  return allApproved ? "READY_FOR_DIAGNOSIS" : "INCOMPLETE";
}
