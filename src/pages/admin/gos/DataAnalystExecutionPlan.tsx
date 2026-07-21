import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeader } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import {
  fetchDataAnalystDecisionBriefRuns,
  type DataAnalystDecisionBriefModelRunRow,
} from "@/gos/dataAnalystDecisionBriefController";
import {
  fetchDataAnalystExecutionPlanRuns,
  runAndSaveDataAnalystExecutionPlan,
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

function postureColor(value?: string | null): string {
  if (value === "READY_FOR_CONTROLLED_SCALE") return "#0f8a44";
  if (value === "MAINTAIN_WITH_GUARDRAILS") return "#3867b7";
  if (value === "HOLD_AND_INVESTIGATE" || value === "FIX_DATA_FIRST") return "#a8730a";
  return "#c1121f";
}

function postureLabel(value?: string | null): string {
  if (value === "READY_FOR_CONTROLLED_SCALE") return "Controlled scale";
  if (value === "MAINTAIN_WITH_GUARDRAILS") return "Guardrailed execution";
  if (value === "HOLD_AND_INVESTIGATE") return "Investigation";
  if (value === "FIX_DATA_FIRST") return "Fix data";
  if (value === "NO_BRIEF") return "No brief";
  return value || "Blocked";
}

function statusColor(value?: string | null): string {
  if (value === "ready" || value === "active") return "#0f8a44";
  if (value === "watch") return "#a8730a";
  return "#c1121f";
}

function stageColor(value?: string | null): string {
  if (value === "clash") return "#a8730a";
  if (value === "code") return "#3867b7";
  if (value === "confirm") return "#0f8a44";
  return "var(--tdia-text)";
}

function stageLabel(value?: string | null): string {
  if (value === "clash") return "Clash";
  if (value === "code") return "Code";
  if (value === "confirm") return "Confirm";
  return value || "-";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("fr-CA") : value;
}

export default function DataAnalystExecutionPlan() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [briefRuns, setBriefRuns] = useState<DataAnalystDecisionBriefModelRunRow[]>([]);
  const [runs, setRuns] = useState<DataAnalystExecutionPlanModelRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const latestBrief = briefRuns[0]?.output_json ?? null;
  const latestPlan = runs[0]?.output_json ?? null;

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [clientResult, briefRows, planRows] = await Promise.all([
        supabase.from("gos_clients").select("*").eq("id", clientId).single(),
        fetchDataAnalystDecisionBriefRuns(clientId),
        fetchDataAnalystExecutionPlanRuns(clientId),
      ]);

      if (clientResult.error) throw clientResult.error;
      const clientData = clientResult.data as ClientRow;
      setClient(clientData);
      setSelectedClient(clientData);
      setBriefRuns(briefRows);
      setRuns(planRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load analyst execution plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const generatePlan = async () => {
    if (!clientId) return;
    setGenerating(true);
    try {
      const result = await runAndSaveDataAnalystExecutionPlan(clientId);
      setRuns((current) => [result.run, ...current]);
      toast.success(`Execution plan saved - ${postureLabel(result.output.posture)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate execution plan");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;
  }

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Turn the analyst decision brief into dated AM and media-buyer execution work.",
          dataSource: "Latest data_analyst_decision_brief run plus saved execution-plan runs in model_runs.",
          usedBy: "Account manager, media buyer, analyst.",
          requiredInputs: ["Saved Analyst Decision Brief"],
          missingInputs: latestBrief ? [] : ["No Analyst Decision Brief is saved yet"],
          nextStep: "Complete clash-code-confirm for P0/P1 work items, then validate Profit First constraints before budget changes.",
          primaryCta: "Generate plan",
        }}
        title="Analyst Execution Plan"
        subtitle={client ? `${client.company_name} - operational handoff from analysis to controlled action.` : "Operational handoff from analysis to controlled action."}
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Refresh
            </button>
            <button className="gos-btn-primary" onClick={generatePlan} disabled={generating}>
              <ClipboardCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {generating ? "Generating..." : "Generate plan"}
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="gos-card" style={{ borderLeft: `3px solid ${postureColor(latestBrief?.posture)}` }}>
          <CardTitle icon={<ShieldCheck size={16} />} title="Source decision brief" />
          <MetricGrid>
            <Metric label="Posture" value={postureLabel(latestBrief?.posture)} color={postureColor(latestBrief?.posture)} />
            <Metric label="Confidence" value={latestBrief ? `${latestBrief.confidence_score}/100` : "-"} />
            <Metric label="Actions" value={latestBrief?.actions.length ?? "-"} />
            <Metric label="Guardrails" value={latestBrief?.guardrails.length ?? "-"} />
          </MetricGrid>
          {latestBrief && (
            <div style={{ marginTop: 10, color: "var(--tdia-muted)", fontSize: 12, lineHeight: 1.5 }}>
              {latestBrief.primary_decision}
            </div>
          )}
        </div>

        <div className="gos-card" style={{ borderLeft: `3px solid ${postureColor(latestPlan?.posture)}` }}>
          <CardTitle icon={<ClipboardCheck size={16} />} title="Latest execution plan" />
          <MetricGrid>
            <Metric label="Mode" value={latestPlan?.operating_mode ?? "-"} color={postureColor(latestPlan?.posture)} />
            <Metric label="Posture" value={postureLabel(latestPlan?.posture)} color={postureColor(latestPlan?.posture)} />
            <Metric label="Work items" value={latestPlan?.work_items.length ?? "-"} />
            <Metric label="CCC steps" value={latestPlan?.clash_code_confirm?.length ?? "-"} />
            <Metric label="Monitors" value={latestPlan?.guardrail_monitors.length ?? "-"} />
          </MetricGrid>
          {latestPlan && (
            <div style={{ marginTop: 10, color: "var(--tdia-muted)", fontSize: 12, lineHeight: 1.5 }}>
              {latestPlan.summary}
            </div>
          )}
        </div>
      </div>

      {!latestPlan ? (
        <div className="gos-card">
          <EmptyState title="No execution plan saved" hint="Generate a plan after the Decision Brief is available." />
        </div>
      ) : (
        <>
          <div className="gos-card" style={{ marginBottom: 16 }}>
            <CardTitle icon={<CalendarClock size={16} />} title="Work items" />
            <div style={{ display: "grid", gap: 10 }}>
              {latestPlan.work_items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 12,
                    background: "hsl(220 45% 14%)",
                    borderRadius: 6,
                    borderLeft: `3px solid ${statusColor(item.status)}`,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, alignItems: "start" }}>
                    <Badge value={item.priority} color={item.priority === "P0" ? "#c1121f" : item.priority === "P1" ? "#a8730a" : "#3867b7"} />
                    <Badge value={item.owner} />
                    <Badge value={item.phase} />
                    <Badge value={item.status} color={statusColor(item.status)} />
                    <div style={{ color: "var(--tdia-muted)", fontSize: 12, alignSelf: "center" }}>Due {item.due_date}</div>
                  </div>
                  <div style={{ color: "var(--tdia-text)", fontWeight: 700, marginTop: 10, lineHeight: 1.4 }}>{item.task}</div>
                  <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{item.evidence}</div>
                  <ListBlock title="Acceptance criteria" items={item.acceptance_criteria} />
                </div>
              ))}
            </div>
          </div>

          <div className="gos-card" style={{ marginBottom: 16 }}>
            <CardTitle icon={<ClipboardCheck size={16} />} title="Clash-code-confirm" />
            <div style={{ display: "grid", gap: 8 }}>
              {(latestPlan.clash_code_confirm ?? []).length === 0 ? (
                <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>No clash-code-confirm steps generated.</div>
              ) : latestPlan.clash_code_confirm.map((step) => (
                <div
                  key={step.id}
                  style={{
                    padding: 10,
                    background: "hsl(220 45% 14%)",
                    borderRadius: 6,
                    borderLeft: `3px solid ${stageColor(step.stage)}`,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, alignItems: "center" }}>
                    <Badge value={`${step.sequence}. ${stageLabel(step.stage)}`} color={stageColor(step.stage)} />
                    <Badge value={step.owner} />
                    <Badge value={step.status} color={statusColor(step.status)} />
                    <div style={{ color: "var(--tdia-muted)", fontSize: 12 }}>{step.work_item_id}</div>
                  </div>
                  <div style={{ color: "var(--tdia-text)", fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{step.instruction}</div>
                  <ListBlock title="Required evidence" items={step.required_evidence} />
                  <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                    Failure mode: {step.failure_mode}
                  </div>
                  <div style={{ color: "var(--tdia-text)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                    Done when: {step.completion_signal}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div className="gos-card">
              <CardTitle icon={<ShieldCheck size={16} />} title="Guardrail monitors" />
              <div style={{ display: "grid", gap: 8 }}>
                {latestPlan.guardrail_monitors.length === 0 ? (
                  <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>No guardrail monitor generated.</div>
                ) : latestPlan.guardrail_monitors.map((monitor) => (
                  <div key={monitor.id} style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, borderLeft: `3px solid ${statusColor(monitor.status)}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 700 }}>{monitor.label}</div>
                      <Badge value={monitor.check_frequency} color={statusColor(monitor.status)} />
                    </div>
                    <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{monitor.escalation_rule}</div>
                    <div style={{ color: "var(--tdia-text)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{monitor.validation_metric}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gos-card">
              <CardTitle icon={<CheckCircle2 size={16} />} title="Validation checklist" />
              <ListBlock title="Checks" items={latestPlan.validation_checklist} />
              {latestPlan.risks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <CardTitle icon={<AlertTriangle size={16} />} title="Risks" />
                  <ListBlock title="Open risks" items={latestPlan.risks} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {runs.length > 0 && (
        <div className="gos-card">
          <CardTitle icon={<Database size={16} />} title="Run history" />
          <div style={{ display: "grid", gap: 8 }}>
            {runs.slice(0, 10).map((run) => (
              <div
                key={run.id}
                style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}
              >
                <div style={{ fontWeight: 600 }}>{run.output_json.engine_version}</div>
                <div style={{ color: postureColor(run.output_json.posture), fontWeight: 700, fontSize: 12 }}>{postureLabel(run.output_json.posture)}</div>
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
        wordBreak: "break-word",
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
