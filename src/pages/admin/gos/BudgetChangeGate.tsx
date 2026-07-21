import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Calculator, CheckCircle2, Database, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeader } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import {
  fetchActiveCampaignBudgetTotals,
  fetchLatestProfitFirstMediaBuyingRun,
  fetchProfitFirstBudgetChangeGateRuns,
  runAndSaveProfitFirstBudgetChangeGate,
  type ActiveCampaignBudgetTotals,
  type ProfitFirstBudgetChangeGateModelRunRow,
  type ProfitFirstMediaBuyingModelRunRow,
} from "@/gos/profitFirstBudgetChangeGateController";
import {
  fetchBudgetApplicationGuardRuns,
  type BudgetApplicationGuardModelRunRow,
} from "@/gos/budgetApplicationController";
import {
  fetchBudgetComplianceMonitorRuns,
  runAndSaveBudgetComplianceMonitor,
  type BudgetComplianceMonitorModelRunRow,
} from "@/gos/budgetComplianceMonitorController";
import {
  fetchDataAnalystExecutionPlanRuns,
  type DataAnalystExecutionPlanModelRunRow,
} from "@/gos/dataAnalystExecutionPlanController";

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

function decisionColor(value?: string | null): string {
  if (value === "APPROVED") return "#0f8a44";
  if (value === "APPROVED_WITH_CONDITIONS") return "#3867b7";
  if (value === "HOLD") return "#a8730a";
  return "#c1121f";
}

function checkColor(value?: string | null): string {
  if (value === "pass") return "#0f8a44";
  if (value === "warn") return "#a8730a";
  return "#c1121f";
}

function complianceColor(value?: string | null): string {
  if (value === "COMPLIANT") return "#0f8a44";
  if (value === "WATCH") return "#a8730a";
  return "#c1121f";
}

function postureColor(value?: string | null): string {
  if (value === "READY_FOR_CONTROLLED_SCALE") return "#0f8a44";
  if (value === "MAINTAIN_WITH_GUARDRAILS") return "#3867b7";
  if (value === "HOLD_AND_INVESTIGATE" || value === "FIX_DATA_FIRST") return "#a8730a";
  return "#c1121f";
}

function money(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("fr-FR")} $`;
}

function pct(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("fr-CA") : value;
}

export default function BudgetChangeGate() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [budgetTotals, setBudgetTotals] = useState<ActiveCampaignBudgetTotals | null>(null);
  const [profitFirstRun, setProfitFirstRun] = useState<ProfitFirstMediaBuyingModelRunRow | null>(null);
  const [executionPlanRun, setExecutionPlanRun] = useState<DataAnalystExecutionPlanModelRunRow | null>(null);
  const [runs, setRuns] = useState<ProfitFirstBudgetChangeGateModelRunRow[]>([]);
  const [applicationRuns, setApplicationRuns] = useState<BudgetApplicationGuardModelRunRow[]>([]);
  const [complianceRuns, setComplianceRuns] = useState<BudgetComplianceMonitorModelRunRow[]>([]);
  const [currentMonthlySpend, setCurrentMonthlySpend] = useState("");
  const [proposedMonthlySpend, setProposedMonthlySpend] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [runningCompliance, setRunningCompliance] = useState(false);

  const latestGate = runs[0]?.output_json ?? null;
  const latestCompliance = complianceRuns[0]?.output_json ?? null;

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [clientResult, totals, pfmbRun, executionRuns, gateRuns, appRuns, complianceRows] = await Promise.all([
        supabase.from("gos_clients").select("*").eq("id", clientId).single(),
        fetchActiveCampaignBudgetTotals(clientId),
        fetchLatestProfitFirstMediaBuyingRun(clientId),
        fetchDataAnalystExecutionPlanRuns(clientId),
        fetchProfitFirstBudgetChangeGateRuns(clientId),
        fetchBudgetApplicationGuardRuns(clientId),
        fetchBudgetComplianceMonitorRuns(clientId),
      ]);

      if (clientResult.error) throw clientResult.error;
      const clientData = clientResult.data as ClientRow;
      setClient(clientData);
      setSelectedClient(clientData);
      setBudgetTotals(totals);
      setProfitFirstRun(pfmbRun);
      setExecutionPlanRun(executionRuns[0] ?? null);
      setRuns(gateRuns);
      setApplicationRuns(appRuns);
      setComplianceRuns(complianceRows);
      setCurrentMonthlySpend(String(totals.current_monthly_spend));
      if (!proposedMonthlySpend) {
        setProposedMonthlySpend(String(pfmbRun?.output_json.recommended_spend ?? totals.current_monthly_spend));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load budget gate");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const evaluate = async () => {
    if (!clientId) return;
    const proposed = Number(proposedMonthlySpend);
    if (!Number.isFinite(proposed) || proposed <= 0) {
      toast.error("Proposed monthly spend is required");
      return;
    }
    const current = currentMonthlySpend.trim() ? Number(currentMonthlySpend) : null;
    setEvaluating(true);
    try {
      const result = await runAndSaveProfitFirstBudgetChangeGate(clientId, {
        current_monthly_spend: current,
        proposed_monthly_spend: proposed,
        proposal_source: "manual_gate",
        reason,
      });
      setRuns((existing) => [result.run, ...existing]);
      setBudgetTotals(result.budget_totals);
      setProfitFirstRun(result.profit_first_run);
      setExecutionPlanRun(result.execution_plan_run);
      toast.success(`Budget gate saved - ${result.output.decision}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to evaluate budget gate");
    } finally {
      setEvaluating(false);
    }
  };

  const runCompliance = async () => {
    if (!clientId) return;
    setRunningCompliance(true);
    try {
      const result = await runAndSaveBudgetComplianceMonitor(clientId);
      setComplianceRuns((existing) => [result.run, ...existing]);
      toast.success(`Budget compliance saved - ${result.output.status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run budget compliance");
    } finally {
      setRunningCompliance(false);
    }
  };

  if (loading) {
    return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;
  }

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Gate every material media-budget change with Profit First constraints before execution.",
          dataSource: "Latest profit_first_media_buying run, latest Analyst Execution Plan, active campaign budgets, application audit.",
          usedBy: "Account manager, media buyer, finance lead.",
          requiredInputs: ["Profit First Media Buying run", "Analyst Execution Plan", "Proposed monthly spend"],
          missingInputs: [
            ...(!profitFirstRun ? ["No Profit First Media Buying run"] : []),
            ...(!executionPlanRun ? ["No Analyst Execution Plan run"] : []),
          ],
          nextStep: "Only apply campaign budget changes when the gate is approved or approved with explicit conditions.",
          primaryCta: "Evaluate gate",
        }}
        title="Budget Change Gate"
        subtitle={client ? `${client.company_name} - Profit First approval gate before media-budget changes.` : "Profit First approval gate before media-budget changes."}
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Refresh
            </button>
            <button className="gos-btn-primary" onClick={evaluate} disabled={evaluating}>
              <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {evaluating ? "Evaluating..." : "Evaluate gate"}
            </button>
            <button className="gos-btn-secondary" onClick={runCompliance} disabled={runningCompliance}>
              <CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {runningCompliance ? "Checking..." : "Run compliance"}
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="gos-card">
          <CardTitle icon={<Calculator size={16} />} title="Campaign budget source" />
          <MetricGrid>
            <Metric label="Active campaigns" value={budgetTotals?.active_campaign_count ?? "-"} />
            <Metric label="Current daily" value={money(budgetTotals?.current_daily_spend)} />
            <Metric label="Current monthly" value={money(budgetTotals?.current_monthly_spend)} />
          </MetricGrid>
        </div>

        <div className="gos-card" style={{ borderLeft: `3px solid ${profitFirstRun ? "#0f8a44" : "#c1121f"}` }}>
          <CardTitle icon={<Lock size={16} />} title="Profit First source" />
          <MetricGrid>
            <Metric label="Recommended" value={money(profitFirstRun?.output_json.recommended_spend)} />
            <Metric label="Cash cap" value={money(profitFirstRun?.output_json.cash_capped_spend)} />
            <Metric label="Funnel cap" value={money(profitFirstRun?.output_json.max_spend_by_funnel)} />
            <Metric label="Generated" value={formatDate(profitFirstRun?.generated_at)} />
          </MetricGrid>
        </div>

        <div className="gos-card" style={{ borderLeft: `3px solid ${postureColor(executionPlanRun?.output_json.posture)}` }}>
          <CardTitle icon={<ShieldCheck size={16} />} title="Execution source" />
          <MetricGrid>
            <Metric label="Posture" value={executionPlanRun?.output_json.posture ?? "-"} color={postureColor(executionPlanRun?.output_json.posture)} />
            <Metric label="Mode" value={executionPlanRun?.output_json.operating_mode ?? "-"} />
            <Metric label="Work items" value={executionPlanRun?.output_json.work_items.length ?? "-"} />
            <Metric label="Generated" value={formatDate(executionPlanRun?.generated_at ?? executionPlanRun?.output_json.generated_at)} />
          </MetricGrid>
        </div>
      </div>

      {latestCompliance && (
        <div className="gos-card" style={{ marginBottom: 16, borderLeft: `3px solid ${complianceColor(latestCompliance.status)}` }}>
          <CardTitle icon={<CheckCircle2 size={16} />} title="Budget compliance monitor" />
          <MetricGrid>
            <Metric label="Status" value={latestCompliance.status} color={complianceColor(latestCompliance.status)} />
            <Metric label="Current monthly" value={money(latestCompliance.current_monthly_total)} />
            <Metric label="Gated monthly" value={money(latestCompliance.gated_monthly_spend)} />
            <Metric label="Max safe" value={money(latestCompliance.max_safe_monthly_spend)} />
            <Metric label="Drift vs gate" value={money(latestCompliance.drift_from_gate)} />
            <Metric label="Drift vs app" value={money(latestCompliance.drift_from_application)} />
          </MetricGrid>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginTop: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {latestCompliance.checks.map((item) => (
                <div key={item.id} style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, borderLeft: `3px solid ${checkColor(item.status)}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <Badge value={item.status} color={checkColor(item.status)} />
                  </div>
                  <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{item.evidence}</div>
                </div>
              ))}
            </div>
            <div>
              <ListBlock title="Next actions" items={latestCompliance.next_actions} />
              <ListBlock title="Risks" items={latestCompliance.risks.length ? latestCompliance.risks : ["No compliance risk."]} />
            </div>
          </div>
          <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{latestCompliance.summary}</div>
        </div>
      )}

      <div className="gos-card" style={{ marginBottom: 16 }}>
        <CardTitle icon={<ShieldCheck size={16} />} title="Budget proposal" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
          <Field label="Current monthly spend">
            <input
              className="gos-input"
              type="number"
              value={currentMonthlySpend}
              onChange={(event) => setCurrentMonthlySpend(event.target.value)}
            />
          </Field>
          <Field label="Proposed monthly spend">
            <input
              className="gos-input"
              type="number"
              value={proposedMonthlySpend}
              onChange={(event) => setProposedMonthlySpend(event.target.value)}
            />
          </Field>
          <Field label="Reason">
            <input
              className="gos-input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Controlled scale, risk reduction, campaign reallocation..."
            />
          </Field>
          <button className="gos-btn-primary" onClick={evaluate} disabled={evaluating}>
            <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {evaluating ? "Evaluating..." : "Evaluate"}
          </button>
        </div>
      </div>

      {!latestGate ? (
        <div className="gos-card">
          <EmptyState title="No budget gate run" hint="Evaluate a proposed monthly spend before applying campaign budget changes." />
        </div>
      ) : (
        <>
          <div className="gos-card" style={{ marginBottom: 16, borderLeft: `3px solid ${decisionColor(latestGate.decision)}` }}>
            <CardTitle icon={<ShieldCheck size={16} />} title="Latest gate decision" />
            <MetricGrid>
              <Metric label="Decision" value={latestGate.decision} color={decisionColor(latestGate.decision)} />
              <Metric label="Change type" value={latestGate.change_type} />
              <Metric label="Required approval" value={latestGate.required_approval} />
              <Metric label="Delta" value={`${money(latestGate.delta_monthly_spend)} (${pct(latestGate.delta_pct)})`} />
              <Metric label="Proposed daily" value={money(latestGate.proposed_daily_spend)} />
              <Metric label="Max safe monthly" value={money(latestGate.max_safe_monthly_spend)} />
            </MetricGrid>
            <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{latestGate.summary}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div className="gos-card">
              <CardTitle icon={<CheckCircle2 size={16} />} title="Gate checks" />
              <div style={{ display: "grid", gap: 8 }}>
                {latestGate.checks.map((item) => (
                  <div key={item.id} style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, borderLeft: `3px solid ${checkColor(item.status)}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 700 }}>{item.label}</div>
                      <Badge value={item.status} color={checkColor(item.status)} />
                    </div>
                    <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{item.evidence}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gos-card">
              <CardTitle icon={<AlertTriangle size={16} />} title="Conditions and risks" />
              <ListBlock title="Conditions" items={latestGate.conditions.length ? latestGate.conditions : ["No conditions."]} />
              <ListBlock title="Risks" items={latestGate.risks.length ? latestGate.risks : ["No blocking risk."]} />
            </div>
          </div>
        </>
      )}

      {applicationRuns.length > 0 && (
        <div className="gos-card" style={{ marginBottom: 16 }}>
          <CardTitle icon={<Database size={16} />} title="Budget application audit" />
          <div style={{ display: "grid", gap: 8 }}>
            {applicationRuns.slice(0, 10).map((run) => (
              <div key={run.id} style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                <div style={{ fontWeight: 600 }}>{run.output_json.application.source ?? "unknown"}</div>
                <div style={{ color: run.output_json.application.applied ? "#0f8a44" : "#c1121f", fontWeight: 700, fontSize: 12 }}>
                  {run.output_json.application.applied ? "APPLIED" : "NOT APPLIED"}
                </div>
                <div style={{ color: decisionColor(run.output_json.decision), fontWeight: 700, fontSize: 12 }}>{run.output_json.decision}</div>
                <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{money(run.output_json.proposed_monthly_total)}</div>
                <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{formatDate(run.generated_at ?? run.output_json.generated_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {complianceRuns.length > 0 && (
        <div className="gos-card" style={{ marginBottom: 16 }}>
          <CardTitle icon={<Database size={16} />} title="Compliance history" />
          <div style={{ display: "grid", gap: 8 }}>
            {complianceRuns.slice(0, 10).map((run) => (
              <div key={run.id} style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                <div style={{ fontWeight: 600 }}>{run.output_json.engine_version}</div>
                <div style={{ color: complianceColor(run.output_json.status), fontWeight: 700, fontSize: 12 }}>{run.output_json.status}</div>
                <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{money(run.output_json.current_monthly_total)}</div>
                <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{formatDate(run.generated_at ?? run.output_json.generated_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {runs.length > 0 && (
        <div className="gos-card">
          <CardTitle icon={<Database size={16} />} title="Run history" />
          <div style={{ display: "grid", gap: 8 }}>
            {runs.slice(0, 10).map((run) => (
              <div key={run.id} style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <div style={{ fontWeight: 600 }}>{run.output_json.engine_version}</div>
                <div style={{ color: decisionColor(run.output_json.decision), fontWeight: 700, fontSize: 12 }}>{run.output_json.decision}</div>
                <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{money(run.output_json.proposed_monthly_spend)}</div>
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
    <div style={{ padding: 9, background: "hsl(220 45% 14%)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color: color ?? "var(--tdia-text)", fontWeight: 700, fontSize: 16, marginTop: 3, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="gos-label">{label}</div>
      {children}
    </div>
  );
}

function Badge({ value, color }: { value: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 24,
        padding: "3px 8px",
        borderRadius: 6,
        background: "hsl(220 45% 16%)",
        color: color ?? "var(--tdia-text)",
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        lineHeight: 1.2,
      }}
    >
      {value}
    </span>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 10, padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4, fontSize: 12, color: "var(--tdia-text)", lineHeight: 1.4 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
