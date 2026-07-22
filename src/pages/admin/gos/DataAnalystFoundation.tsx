import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Brain, CheckCircle2, Database, FileText, Play, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeader, DataQualityBadge } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import {
  fetchDataAnalystFoundationRuns,
  runAndSaveDataAnalystFoundation,
  type DataAnalystFoundationModelRunRow,
} from "@/gos/dataAnalystFoundationController";
import type { AnalystSeverity, AnalystReadiness, DataAnalystFoundationOutput } from "@/gos/dataAnalystFoundation";

type ClientRow = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  data_quality_score?: number | null;
  industry?: string | null;
  am_owner?: string | null;
  launch_target_date?: string | null;
};

const severityStyle: Record<AnalystSeverity, { color: string; bg: string; icon: ReactNode }> = {
  success: { color: "#0f8a44", bg: "#e3f7ec", icon: <CheckCircle2 size={14} /> },
  info: { color: "#3867b7", bg: "#e0edff", icon: <Brain size={14} /> },
  warning: { color: "#a8730a", bg: "#fff4d9", icon: <AlertTriangle size={14} /> },
  critical: { color: "#c1121f", bg: "#ffe3e3", icon: <XCircle size={14} /> },
};

function readinessLabel(value: AnalystReadiness): string {
  if (value === "READY_FOR_ADVANCED_ANALYSIS") return "Advanced ready";
  if (value === "READY_FOR_BASIC_ANALYSIS") return "Basic ready";
  if (value === "NEEDS_WORK") return "Needs work";
  return "Blocked";
}

function readinessColor(value: AnalystReadiness): string {
  if (value === "READY_FOR_ADVANCED_ANALYSIS") return "#0f8a44";
  if (value === "READY_FOR_BASIC_ANALYSIS") return "#3867b7";
  if (value === "NEEDS_WORK") return "#a8730a";
  return "#c1121f";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("fr-CA") : value;
}

export default function DataAnalystFoundation() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [runs, setRuns] = useState<DataAnalystFoundationModelRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const latest = runs[0]?.output_json ?? null;

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [clientResult, runRows] = await Promise.all([
        supabase.from("gos_clients").select("*").eq("id", clientId).single(),
        fetchDataAnalystFoundationRuns(clientId),
      ]);

      if (clientResult.error) throw clientResult.error;
      const clientData = clientResult.data as ClientRow;
      setClient(clientData);
      setSelectedClient(clientData);
      setRuns(runRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load analyst foundation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const blockingChecks = useMemo(
    () => latest?.checks.filter((check) => check.status === "fail") ?? [],
    [latest],
  );

  const runAnalysis = async () => {
    if (!clientId) return;
    setRunning(true);
    try {
      const result = await runAndSaveDataAnalystFoundation(clientId);
      setRuns((current) => [result.run, ...current]);
      toast.success(`Analyst run saved - ${readinessLabel(result.output.readiness)} (${result.output.score}/100)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run analyst foundation");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;
  }

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Readiness layer before statistical analysis. It checks whether customer transactions, daily P&L, projections, and projection audit trail are usable.",
          dataSource: "gos_customer_transactions, gos_daily_pnl_targets, gos_projection_updates, model_runs.",
          usedBy: "Account manager, media buyer, data analyst.",
          requiredInputs: ["customer_id", "transaction_date", "daily target/projection/actual rows", "projection update trail"],
          missingInputs: blockingChecks.map((check) => check.label),
          nextStep: "Fix blocking data gaps, then move to statistical analysis and backtesting.",
          primaryCta: "Run analyst foundation",
        }}
        title="Data Analyst Foundation"
        subtitle="Deterministic readiness layer for cohorts, daily P&L, projections, and analyst model cards."
        actions={
          <>
            <DataQualityBadge score={latest?.score ?? client?.data_quality_score ?? null} />
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Refresh
            </button>
            <button className="gos-btn-primary" onClick={runAnalysis} disabled={running}>
              <Play size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {running ? "Running..." : "Run analysis"}
            </button>
          </>
        }
      />

      {!latest ? (
        <div className="gos-card">
          <EmptyState
            title="No analyst run yet"
            hint="Run the foundation check after customer transactions and daily P&L rows exist."
          />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: 12, marginBottom: 16 }}>
            <div className="gos-card" style={{ borderLeft: `3px solid ${readinessColor(latest.readiness)}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Brain size={18} />
                <div style={{ fontWeight: 600 }}>Readiness</div>
              </div>
              <div style={{ fontSize: 38, fontWeight: 700, color: readinessColor(latest.readiness) }}>
                {latest.score}/100
              </div>
              <div style={{ marginTop: 4, color: "var(--tdia-text)", fontWeight: 600 }}>
                {readinessLabel(latest.readiness)}
              </div>
              <div style={{ marginTop: 8, color: "var(--tdia-muted)", fontSize: 13, lineHeight: 1.45 }}>
                {latest.summary}
              </div>
            </div>

            <div className="gos-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Database size={18} />
                <div style={{ fontWeight: 600 }}>Data coverage</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                <Metric label="Transactions" value={`${latest.coverage.valid_transactions}/${latest.coverage.transactions}`} />
                <Metric label="Customers" value={latest.coverage.unique_customers} />
                <Metric label="Cohorts" value={latest.coverage.acquisition_cohorts} />
                <Metric label="Age cols" value={latest.coverage.cohort_age_columns} />
                <Metric label="Revenue cover" value={`${latest.coverage.revenue_coverage_pct}%`} />
                <Metric label="GP cover" value={`${latest.coverage.gross_profit_coverage_pct}%`} />
                <Metric label="Daily rows" value={latest.coverage.daily_rows} />
                <Metric label="Actual cover" value={`${latest.coverage.daily_actual_coverage_pct}%`} />
                <Metric label="Projection cover" value={`${latest.coverage.daily_projection_coverage_pct}%`} />
                <Metric label="Audit 14d" value={latest.coverage.projection_updates_14d} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div className="gos-card">
              <CardTitle icon={<CheckCircle2 size={16} />} title="Checks" />
              <div style={{ display: "grid", gap: 8 }}>
                {latest.checks.map((check) => (
                  <SignalRow
                    key={check.id}
                    severity={check.severity}
                    title={check.label}
                    value={check.status.toUpperCase()}
                    body={check.detail}
                    footer={check.recommendation}
                  />
                ))}
              </div>
            </div>

            <div className="gos-card">
              <CardTitle icon={<AlertTriangle size={16} />} title="Signals" />
              <div style={{ display: "grid", gap: 8 }}>
                {latest.signals.map((signal) => (
                  <SignalRow
                    key={signal.id}
                    severity={signal.severity}
                    title={signal.label}
                    value={signal.value}
                    body={signal.interpretation}
                    footer={signal.next_action}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
            <ModelCard output={latest} />
            <div className="gos-card">
              <CardTitle icon={<FileText size={16} />} title="Run history" />
              {runs.length === 0 ? (
                <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>No saved run.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {runs.slice(0, 8).map((run) => (
                    <div key={run.id} style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>{run.output_json.score}/100</div>
                        <div style={{ color: readinessColor(run.output_json.readiness), fontSize: 12, fontWeight: 700 }}>
                          {readinessLabel(run.output_json.readiness)}
                        </div>
                      </div>
                      <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 4 }}>
                        {formatDate(run.generated_at ?? run.output_json.generated_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 16, color: "var(--tdia-muted)", fontSize: 12 }}>
        Next layer: statistical analyst upgrade only after this page is ready enough. Python/R belongs there for batch modeling, not inside this React runtime.
        <span> </span>
        <Link to={`/admin/gos/clients/${clientId}/data-analyst/statistical`} style={{ color: "var(--tdia-blue)" }}>
          Open Statistical Analyst
        </Link>
      </div>
    </>
  );
}

function CardTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontWeight: 600 }}>
      {icon}
      {title}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color: "var(--tdia-text)", fontWeight: 700, fontSize: 18, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function SignalRow({
  severity,
  title,
  value,
  body,
  footer,
}: {
  severity: AnalystSeverity;
  title: string;
  value: string;
  body: string;
  footer: string;
}) {
  const style = severityStyle[severity];
  return (
    <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6, borderLeft: `3px solid ${style.color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ color: style.color, display: "inline-flex" }}>{style.icon}</span>
        <div style={{ fontWeight: 600, flex: 1 }}>{title}</div>
        <span style={{ background: style.bg, color: style.color, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
          {value}
        </span>
      </div>
      <div style={{ color: "var(--tdia-muted)", fontSize: 12, lineHeight: 1.45 }}>{body}</div>
      <div style={{ color: "var(--tdia-text)", fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>{footer}</div>
    </div>
  );
}

function ModelCard({ output }: { output: DataAnalystFoundationOutput }) {
  return (
    <div className="gos-card">
      <CardTitle icon={<FileText size={16} />} title="Model card" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <ListBlock title="Purpose" items={[output.model_card.purpose]} />
        <ListBlock title="Inputs" items={output.model_card.inputs} />
        <ListBlock title="Assumptions" items={output.model_card.assumptions} />
        <ListBlock title="Limitations" items={output.model_card.limitations} />
        <ListBlock title="Next statistical upgrade" items={output.model_card.next_statistical_upgrade} />
      </div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4, fontSize: 12, color: "var(--tdia-text)", lineHeight: 1.4 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
