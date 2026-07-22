import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, BarChart3, Brain, Clipboard, Database, Download, FileText, RefreshCw, Save, ShieldCheck, Sigma } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeader } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { fetchDataAnalystFoundationRuns } from "@/gos/dataAnalystFoundationController";
import type { DataAnalystFoundationModelRunRow } from "@/gos/dataAnalystFoundationController";
import {
  buildDataAnalystStatisticalBatchInputForClient,
  fetchDataAnalystStatisticalRuns,
  parseDataAnalystStatisticalOutput,
  saveDataAnalystStatisticalRun,
  type DataAnalystStatisticalBatchInput,
  type DataAnalystStatisticalModelRunRow,
  type DataAnalystStatisticalOutput,
} from "@/gos/dataAnalystStatisticalController";
import {
  fetchDataAnalystDecisionBriefRuns,
  runAndSaveDataAnalystDecisionBrief,
  type DataAnalystDecisionBriefModelRunRow,
} from "@/gos/dataAnalystDecisionBriefController";

type ClientRow = {
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

function readinessColor(value?: string | null): string {
  if (value === "READY_FOR_ADVANCED_ANALYSIS") return "#0f8a44";
  if (value === "READY_FOR_BASIC_ANALYSIS") return "#3867b7";
  if (value === "NEEDS_WORK") return "#a8730a";
  return "#c1121f";
}

function readinessLabel(value?: string | null): string {
  if (value === "READY_FOR_ADVANCED_ANALYSIS") return "Advanced ready";
  if (value === "READY_FOR_BASIC_ANALYSIS") return "Basic ready";
  if (value === "NEEDS_WORK") return "Needs work";
  return value || "Blocked";
}

function postureColor(value?: string | null): string {
  if (value === "READY_FOR_CONTROLLED_SCALE") return "#0f8a44";
  if (value === "MAINTAIN_WITH_GUARDRAILS") return "#3867b7";
  if (value === "HOLD_AND_INVESTIGATE" || value === "FIX_DATA_FIRST") return "#a8730a";
  return "#c1121f";
}

function postureLabel(value?: string | null): string {
  if (value === "READY_FOR_CONTROLLED_SCALE") return "Controlled scale";
  if (value === "MAINTAIN_WITH_GUARDRAILS") return "Maintain";
  if (value === "HOLD_AND_INVESTIGATE") return "Hold";
  if (value === "FIX_DATA_FIRST") return "Fix data";
  return value || "Blocked";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("fr-CA") : value;
}

function pct(value?: number | null): string {
  return value == null ? "-" : `${Math.round(value * 100) / 100}%`;
}

function ratioPct(value?: number | null): string {
  return value == null ? "-" : `${Math.round(value * 1000) / 10}%`;
}

export default function DataAnalystStatistical() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [foundationRuns, setFoundationRuns] = useState<DataAnalystFoundationModelRunRow[]>([]);
  const [runs, setRuns] = useState<DataAnalystStatisticalModelRunRow[]>([]);
  const [briefRuns, setBriefRuns] = useState<DataAnalystDecisionBriefModelRunRow[]>([]);
  const [batchInput, setBatchInput] = useState<DataAnalystStatisticalBatchInput | null>(null);
  const [rawOutput, setRawOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const [buildingInput, setBuildingInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);

  const latest = runs[0]?.output_json ?? null;
  const latestFoundation = foundationRuns[0]?.output_json ?? null;
  const latestBrief = briefRuns[0]?.output_json ?? null;

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [clientResult, statisticalRows, foundationRows, briefRows] = await Promise.all([
        supabase.from("gos_clients").select("*").eq("id", clientId).single(),
        fetchDataAnalystStatisticalRuns(clientId),
        fetchDataAnalystFoundationRuns(clientId),
        fetchDataAnalystDecisionBriefRuns(clientId),
      ]);

      if (clientResult.error) throw clientResult.error;
      const clientData = clientResult.data as ClientRow;
      setClient(clientData);
      setSelectedClient(clientData);
      setRuns(statisticalRows);
      setFoundationRuns(foundationRows);
      setBriefRuns(briefRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load statistical analyst runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const parsedPreview = useMemo(() => {
    if (!rawOutput.trim()) return null;
    try {
      return parseDataAnalystStatisticalOutput(rawOutput);
    } catch {
      return null;
    }
  }, [rawOutput]);

  const batchInputJson = useMemo(
    () => batchInput ? JSON.stringify(batchInput, null, 2) : "",
    [batchInput],
  );

  const buildBatchInput = async () => {
    if (!clientId) return;
    setBuildingInput(true);
    try {
      const input = await buildDataAnalystStatisticalBatchInputForClient(clientId);
      setBatchInput(input);
      toast.success(`Batch input ready - ${input.source_summary.transaction_count} transactions, ${input.source_summary.daily_pnl_count} daily rows, ${input.source_summary.channel_daily_count} channel rows`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to build batch input");
    } finally {
      setBuildingInput(false);
    }
  };

  const copyBatchInput = async () => {
    if (!batchInputJson) return;
    try {
      await navigator.clipboard.writeText(batchInputJson);
      toast.success("Batch input copied");
    } catch {
      toast.error("Clipboard unavailable. Select the JSON manually.");
    }
  };

  const downloadBatchInput = () => {
    if (!batchInputJson || !clientId) return;
    const blob = new Blob([batchInputJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gos-analyst-input-${clientId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveOutput = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      const output = parseDataAnalystStatisticalOutput(rawOutput);
      const run = await saveDataAnalystStatisticalRun(clientId, output, {
        source: "manual_batch_output",
        saved_at: new Date().toISOString(),
      });
      setRuns((current) => [run, ...current]);
      setRawOutput("");
      toast.success(`Statistical run saved - ${readinessLabel(output.readiness)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save statistical output");
    } finally {
      setSaving(false);
    }
  };

  const generateBrief = async () => {
    if (!clientId) return;
    setGeneratingBrief(true);
    try {
      const result = await runAndSaveDataAnalystDecisionBrief(clientId);
      setBriefRuns((current) => [result.run, ...current]);
      toast.success(`Decision brief saved - ${result.output.posture}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate decision brief");
    } finally {
      setGeneratingBrief(false);
    }
  };

  if (loading) {
    return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;
  }

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Batch statistical analyst layer for retention curve fitting, P&L anomaly detection, spend-efficiency regression, and lightweight MMM incrementality context.",
          dataSource: "Python batch output persisted to model_runs.",
          usedBy: "Data analyst, account manager, media buyer.",
          requiredInputs: ["Data Analyst Foundation run", "transactions", "daily_pnl", "spend_history optional", "campaign daily performance optional"],
          missingInputs: latestFoundation && latestFoundation.readiness !== "READY_FOR_ADVANCED_ANALYSIS"
            ? ["Foundation is not advanced-ready yet"]
            : [],
          nextStep: "Use this output as statistical context beside deterministic spend frontier, channel allocation, and AM review.",
          primaryCta: "Save batch output",
        }}
        title="Statistical Analyst"
        subtitle="Python batch outputs for retention, anomalies, spend diagnostics, and MMM context."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Refresh
            </button>
            <button className="gos-btn-secondary" onClick={buildBatchInput} disabled={buildingInput}>
              <FileText size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {buildingInput ? "Building..." : "Build input"}
            </button>
            <button className="gos-btn-secondary" onClick={generateBrief} disabled={generatingBrief}>
              <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {generatingBrief ? "Generating..." : "Generate brief"}
            </button>
            <button className="gos-btn-primary" onClick={saveOutput} disabled={saving || !parsedPreview}>
              <Save size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {saving ? "Saving..." : "Save output"}
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="gos-card" style={{ borderLeft: `3px solid ${readinessColor(latestFoundation?.readiness)}` }}>
          <CardTitle icon={<Brain size={16} />} title="Foundation gate" />
          <MetricGrid>
            <Metric label="Readiness" value={readinessLabel(latestFoundation?.readiness)} color={readinessColor(latestFoundation?.readiness)} />
            <Metric label="Score" value={latestFoundation ? `${latestFoundation.score}/100` : "-"} />
            <Metric label="Transactions" value={latestFoundation?.coverage.valid_transactions ?? "-"} />
            <Metric label="Daily rows" value={latestFoundation?.coverage.daily_rows ?? "-"} />
          </MetricGrid>
          <div style={{ marginTop: 10, fontSize: 12 }}>
            <Link to={`/admin/gos/clients/${clientId}/data-analyst`} style={{ color: "var(--tdia-blue)" }}>
              Open foundation run
            </Link>
          </div>
        </div>

        <div className="gos-card" style={{ borderLeft: `3px solid ${readinessColor(latest?.readiness)}` }}>
          <CardTitle icon={<Sigma size={16} />} title="Latest statistical run" />
          <MetricGrid>
            <Metric label="Readiness" value={readinessLabel(latest?.readiness)} color={readinessColor(latest?.readiness)} />
            <Metric label="Generated" value={formatDate(latest?.generated_at)} />
            <Metric label="Python" value={latest?.libraries?.python ?? "-"} />
            <Metric label="SciPy" value={latest?.libraries?.scipy ?? "-"} />
            <Metric label="MMM" value={latest?.mmm_incrementality?.status ?? "-"} />
          </MetricGrid>
        </div>
      </div>

      {latestBrief && (
        <div className="gos-card" style={{ marginBottom: 16, borderLeft: `3px solid ${postureColor(latestBrief.posture)}` }}>
          <CardTitle icon={<ShieldCheck size={16} />} title="Decision brief" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
            <MetricGrid>
              <Metric label="Posture" value={postureLabel(latestBrief.posture)} color={postureColor(latestBrief.posture)} />
              <Metric label="Confidence" value={`${latestBrief.confidence_score}/100`} />
              <Metric label="Actions" value={latestBrief.actions.length} />
              <Metric label="Guardrails" value={latestBrief.guardrails.length} />
            </MetricGrid>
            <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 6 }}>
                Primary decision
              </div>
              <div style={{ color: "var(--tdia-text)", lineHeight: 1.45 }}>{latestBrief.primary_decision}</div>
              <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 8 }}>{latestBrief.summary}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <BriefList title="Actions" items={latestBrief.actions.map((action) => `${action.priority} ${action.owner}: ${action.action}`)} />
            <BriefList title="Guardrails" items={latestBrief.guardrails.map((guardrail) => `${guardrail.status.toUpperCase()}: ${guardrail.label} - ${guardrail.rule}`)} />
            <BriefList title="Risks" items={latestBrief.risks.length ? latestBrief.risks : ["No additional brief risk flagged."]} />
          </div>
        </div>
      )}

      <div className="gos-card" style={{ marginBottom: 16 }}>
        <CardTitle icon={<FileText size={16} />} title="Batch input" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <textarea
            className="gos-input"
            value={batchInputJson}
            readOnly
            placeholder="Click Build input to generate the JSON file for the Python batch."
            style={{ minHeight: 210, fontFamily: "monospace", resize: "vertical" }}
          />
          <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6, display: "grid", gap: 8, alignContent: "start" }}>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Export contract
            </div>
            <MetricGrid>
              <Metric label="Transactions" value={batchInput?.source_summary.transaction_count ?? "-"} />
              <Metric label="Daily rows" value={batchInput?.source_summary.daily_pnl_count ?? "-"} />
              <Metric label="Spend history" value={batchInput?.source_summary.spend_history_count ?? "-"} />
              <Metric label="Channel rows" value={batchInput?.source_summary.channel_daily_count ?? "-"} />
              <Metric label="Generated" value={batchInput ? formatDate(batchInput.generated_at) : "-"} />
            </MetricGrid>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button className="gos-btn-secondary" onClick={copyBatchInput} disabled={!batchInputJson}>
                <Clipboard size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Copy JSON
              </button>
              <button className="gos-btn-secondary" onClick={downloadBatchInput} disabled={!batchInputJson}>
                <Download size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Download JSON
              </button>
            </div>
            <div style={{ height: 1, background: "rgba(148, 170, 215, 0.12)", margin: "4px 0" }} />
            <code style={{ fontSize: 12, color: "var(--tdia-text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              python scripts\data_analyst_statistical_upgrade.py --input C:\tmp\gos-analyst-input.json --output C:\tmp\gos-analyst-output.json
            </code>
          </div>
        </div>
      </div>

      <div className="gos-card" style={{ marginBottom: 16 }}>
        <CardTitle icon={<FileText size={16} />} title="Batch output" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <textarea
            className="gos-input"
            value={rawOutput}
            onChange={(event) => setRawOutput(event.target.value)}
            placeholder="Paste data_analyst_statistical_upgrade_v1 JSON output"
            style={{ minHeight: 210, fontFamily: "monospace", resize: "vertical" }}
          />
          <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6, display: "grid", gap: 8, alignContent: "start" }}>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Output contract
            </div>
            {parsedPreview ? (
              <MetricGrid>
                <Metric label="Engine" value={parsedPreview.engine_version} />
                <Metric label="Readiness" value={readinessLabel(parsedPreview.readiness)} color={readinessColor(parsedPreview.readiness)} />
                <Metric label="Anomalies" value={parsedPreview.pnl_anomalies?.anomalies?.length ?? 0} />
                <Metric label="Spend R2" value={parsedPreview.spend_efficiency_regression?.r_squared ?? "-"} />
                <Metric label="MMM R2" value={parsedPreview.mmm_incrementality?.portfolio?.r_squared ?? "-"} />
              </MetricGrid>
            ) : (
              <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>
                No valid batch output loaded.
              </div>
            )}
          </div>
        </div>
      </div>

      {!latest ? (
        <div className="gos-card">
          <EmptyState title="No statistical run saved" hint="Save a batch output after the foundation layer is ready." />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <RetentionCard output={latest} />
          <SpendRegressionCard output={latest} />
          <MmmIncrementalityCard output={latest} />
          <AnomalyCard output={latest} />
          <ModelCard output={latest} />
        </div>
      )}

      {runs.length > 0 && (
        <div className="gos-card">
          <CardTitle icon={<Database size={16} />} title="Run history" />
          <div style={{ display: "grid", gap: 8 }}>
            {runs.slice(0, 10).map((run) => (
              <div key={run.id} style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr 150px 140px", gap: 10 }}>
                <div style={{ fontWeight: 600 }}>{run.output_json.engine_version}</div>
                <div style={{ color: readinessColor(run.output_json.readiness), fontWeight: 700, fontSize: 12 }}>
                  {readinessLabel(run.output_json.readiness)}
                </div>
                <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{formatDate(run.generated_at ?? run.output_json.generated_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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

function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
      {children}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: 9, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color: color ?? "var(--tdia-text)", fontWeight: 700, fontSize: 16, marginTop: 3, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function RetentionCard({ output }: { output: DataAnalystStatisticalOutput }) {
  const retention = output.retention_curve;
  return (
    <div className="gos-card">
      <CardTitle icon={<BarChart3 size={16} />} title="Retention curve" />
      <MetricGrid>
        <Metric label="Status" value={retention?.status ?? "-"} />
        <Metric label="Cohorts" value={retention?.cohorts ?? "-"} />
        <Metric label="Age periods" value={retention?.age_periods ?? "-"} />
        <Metric label="R2" value={retention?.r_squared ?? "-"} />
        <Metric label="Half-life" value={retention?.half_life_months ? `${retention.half_life_months} mo` : "-"} />
        <Metric label="Backtest" value={pct(retention?.backtest_mape_pct)} />
      </MetricGrid>
      <Diagnostics items={retention?.diagnostics ?? []} />
    </div>
  );
}

function SpendRegressionCard({ output }: { output: DataAnalystStatisticalOutput }) {
  const regression = output.spend_efficiency_regression;
  return (
    <div className="gos-card">
      <CardTitle icon={<Sigma size={16} />} title="Spend regression" />
      <MetricGrid>
        <Metric label="Status" value={regression?.status ?? "-"} />
        <Metric label="Obs" value={regression?.observations ?? "-"} />
        <Metric label="Elasticity" value={regression?.elasticity ?? "-"} />
        <Metric label="R2" value={regression?.r_squared ?? "-"} />
        <Metric label="p-value" value={regression?.p_value ?? "-"} />
        <Metric label="Std err" value={regression?.standard_error ?? "-"} />
      </MetricGrid>
      <Diagnostics items={regression?.diagnostics ?? []} />
    </div>
  );
}

function MmmIncrementalityCard({ output }: { output: DataAnalystStatisticalOutput }) {
  const mmm = output.mmm_incrementality;
  const portfolio = mmm?.portfolio;
  const channels = mmm?.channels ?? [];
  return (
    <div className="gos-card">
      <CardTitle icon={<BarChart3 size={16} />} title="MMM incrementality" />
      <MetricGrid>
        <Metric label="Status" value={mmm?.status ?? "-"} />
        <Metric label="Obs" value={mmm?.observations ?? "-"} />
        <Metric label="Channels" value={channels.length} />
        <Metric label="Incr ROAS" value={portfolio?.weighted_incremental_roas ?? "-"} />
        <Metric label="Incr factor" value={ratioPct(portfolio?.weighted_incrementality_factor)} />
        <Metric label="R2" value={portfolio?.r_squared ?? "-"} />
      </MetricGrid>
      {channels.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {channels.slice(0, 4).map((channel) => (
            <div key={channel.channel ?? "unknown"} style={{ padding: 9, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span>{channel.channel ?? "unknown"}</span>
                <span>{channel.incremental_roas ?? "-"} incr ROAS</span>
              </div>
              <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 3 }}>
                spend {channel.spend ?? "-"} / incremental revenue {channel.estimated_incremental_revenue ?? "-"} / factor {ratioPct(channel.incrementality_factor)}
              </div>
            </div>
          ))}
        </div>
      )}
      <Diagnostics items={mmm?.diagnostics ?? []} />
      <Diagnostics items={mmm?.limitations ?? []} />
    </div>
  );
}

function AnomalyCard({ output }: { output: DataAnalystStatisticalOutput }) {
  const anomalies = output.pnl_anomalies?.anomalies ?? [];
  return (
    <div className="gos-card">
      <CardTitle icon={<AlertTriangle size={16} />} title="P&L anomalies" />
      <MetricGrid>
        <Metric label="Rows" value={output.pnl_anomalies?.rows_analyzed ?? "-"} />
        <Metric label="Anomalies" value={anomalies.length} color={anomalies.length ? "#c1121f" : "#0f8a44"} />
      </MetricGrid>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {anomalies.length === 0 ? (
          <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>No anomaly flagged.</div>
        ) : anomalies.slice(0, 6).map((row, index) => (
          <div key={`${row.date}-${row.metric}-${index}`} style={{ padding: 9, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6, borderLeft: `3px solid ${row.severity === "critical" ? "#c1121f" : "#a8730a"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <span>{row.date} - {row.metric}</span>
              <span style={{ color: row.severity === "critical" ? "#c1121f" : "#a8730a" }}>{pct(row.delta_pct)}</span>
            </div>
            <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 3 }}>
              actual {row.actual ?? "-"} / expected {row.expected ?? "-"} / z {row.robust_z ?? "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelCard({ output }: { output: DataAnalystStatisticalOutput }) {
  return (
    <div className="gos-card">
      <CardTitle icon={<FileText size={16} />} title="Model card" />
      <ListBlock title="Recommendations" items={output.recommendations ?? []} />
      <ListBlock title="Governance" items={output.model_card?.governance_checks ?? []} />
      <ListBlock title="Limitations" items={output.model_card?.limitations ?? []} />
    </div>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 5, fontSize: 12, lineHeight: 1.4 }}>
        {items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Diagnostics({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return <ListBlock title="Diagnostics" items={items} />;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 10, padding: 10, background: "rgba(255, 255, 255, 0.02)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4, fontSize: 12, color: "var(--tdia-text)", lineHeight: 1.4 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
