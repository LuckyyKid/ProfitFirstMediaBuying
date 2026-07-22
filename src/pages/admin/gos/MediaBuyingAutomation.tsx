import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { CheckCircle2, Plus, Power, RefreshCw, Trash2, XCircle, Zap } from "lucide-react";
import {
  createMediaBuyingRule,
  deleteMediaBuyingRule,
  fetchMediaBuyingAutomationData,
  runAndSaveMediaBuyingRuleEvaluation,
  toggleMediaBuyingRule,
  updateMediaBuyingActionStatus,
  type MediaBuyingActionRow,
  type MediaBuyingRuleRow,
} from "@/gos/mediaBuyingRuleController";
import type {
  MediaBuyingCampaignSummary,
  MediaBuyingRuleEvaluationOutput,
} from "@/gos/mediaBuyingRuleEngine";

type Rule = MediaBuyingRuleRow;
type Action = MediaBuyingActionRow;

const CARD = "rgba(255, 255, 255, 0.02)";
const BG_DEEP = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#0f8a44";
const RED = "#c1121f";
const AMBER = "#a8730a";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const METRICS = [
  { value: "roas", label: "ROAS" },
  { value: "cpa", label: "CPA" },
  { value: "cpl", label: "CPL" },
  { value: "spend", label: "Spend" },
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Orders" },
  { value: "leads", label: "Leads" },
];

const OPERATORS = [
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
];

const ACTIONS = [
  { value: "scale_up", label: "Scale +%" },
  { value: "scale_down", label: "Reduce -%" },
  { value: "pause", label: "Pause" },
  { value: "duplicate", label: "Duplicate" },
  { value: "alert_only", label: "Alert only" },
];

const PLATFORMS = ["meta", "google", "tiktok", "youtube"];

const PRESETS: Partial<Rule>[] = [
  { rule_name: "Kill if ROAS < 1.2 (3d)", platform: "meta", scope: "campaign", metric: "roas", operator: "<", threshold_value: 1.2, lookback_days: 3, action_type: "pause", priority: "high" },
  { rule_name: "Scale if ROAS > 3 (3d)", platform: "meta", scope: "campaign", metric: "roas", operator: ">", threshold_value: 3, lookback_days: 3, action_type: "scale_up", action_value: 20, priority: "high" },
  { rule_name: "Reduce if CPA > 60 (3d)", platform: "meta", scope: "campaign", metric: "cpa", operator: ">", threshold_value: 60, lookback_days: 3, action_type: "scale_down", action_value: 30, priority: "medium" },
  { rule_name: "Alert if CPL > 40 (3d)", platform: "meta", scope: "campaign", metric: "cpl", operator: ">", threshold_value: 40, lookback_days: 3, action_type: "alert_only", priority: "low" },
  { rule_name: "Kill if spend > 500 (2d)", platform: "google", scope: "campaign", metric: "spend", operator: ">", threshold_value: 500, lookback_days: 2, action_type: "pause", priority: "high" },
];

const blankDraft: Partial<Rule> = {
  rule_name: "",
  platform: "meta",
  scope: "campaign",
  metric: "roas",
  operator: "<",
  threshold_value: 1.5,
  lookback_days: 3,
  action_type: "pause",
  cooldown_hours: 24,
  priority: "medium",
  is_active: true,
};

const fmt = (n: number | null | undefined, d = 2) => (n == null ? "-" : Number(n).toFixed(d));
const fmtMoney = (n: number | null | undefined) => (n == null ? "-" : `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} $`);

function priorityColor(priority: string) {
  if (priority === "high") return RED;
  if (priority === "low") return "hsl(0 0% 60%)";
  return AMBER;
}

function statusColor(status: string) {
  if (status === "applied") return GREEN;
  if (status === "dismissed") return "hsl(0 0% 60%)";
  return AMBER;
}

function guardrailColor(status: string) {
  if (status === "held_by_compliance") return RED;
  if (status === "requires_gate") return AMBER;
  return GREEN;
}

export default function MediaBuyingAutomation() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [rules, setRules] = useState<Rule[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [perfs, setPerfs] = useState<MediaBuyingCampaignSummary[]>([]);
  const [evaluation, setEvaluation] = useState<MediaBuyingRuleEvaluationOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Partial<Rule>>(blankDraft);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [client, data] = await Promise.all([
        supabase.from("gos_clients").select("*").eq("id", clientId).maybeSingle(),
        fetchMediaBuyingAutomationData(clientId),
      ]);
      if (client.data) setSelectedClient(client.data as Parameters<typeof setSelectedClient>[0]);
      setRules(data.rules);
      setActions(data.actions);
      setPerfs(data.campaign_summaries);
      setEvaluation(data.evaluation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load media buying automation");
    } finally {
      setLoading(false);
    }
  }, [clientId, setSelectedClient]);

  useEffect(() => { void load(); }, [load]);

  const addRule = async (preset?: Partial<Rule>) => {
    if (!clientId) return;
    const payload = preset ?? draft;
    if (!payload.rule_name) {
      toast.error("Rule name required");
      return;
    }
    try {
      await createMediaBuyingRule(clientId, { is_active: true, ...payload });
      toast.success(preset ? `Preset "${preset.rule_name}" added` : "Rule created");
      if (!preset) setDraft(blankDraft);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create rule");
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      await toggleMediaBuyingRule(rule);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update rule");
    }
  };

  const removeRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteMediaBuyingRule(id);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete rule");
    }
  };

  const runEvaluation = async () => {
    if (!clientId) return;
    try {
      const result = await runAndSaveMediaBuyingRuleEvaluation(clientId);
      setEvaluation(result.output);
      if (result.output.suggestion_count === 0) {
        toast.info("No trigger. Evaluation saved to model_runs.");
      } else {
        toast.success(`${result.inserted_actions} suggestion(s) saved`);
      }
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to evaluate rules");
    }
  };

  const setActionStatus = async (id: string, status: "applied" | "dismissed") => {
    if (!clientId) return;
    try {
      const result = await updateMediaBuyingActionStatus(clientId, id, status);
      if (!result.updated && result.guard) {
        toast.error(result.guard.summary);
        return;
      }
      if (status === "applied" && result.guard) {
        toast.success(result.guard.summary);
      }
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update action");
    }
  };

  const suggestions = evaluation?.suggestions ?? [];
  const kpis = useMemo(() => ({
    activeRules: rules.filter((rule) => rule.is_active).length,
    totalRules: rules.length,
    trackedCampaigns: perfs.length,
    pending: actions.filter((action) => action.status === "suggested").length,
    applied: actions.filter((action) => action.status === "applied").length,
    triggersNow: evaluation?.suggestion_count ?? 0,
  }), [rules, perfs, actions, evaluation]);

  if (loading) return <div style={{ height: 300, background: CARD, borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        title="Media Buying Automation"
        subtitle="Rule-based media buying evaluation with auditable model_runs, cooldowns, and budget compliance guardrails."
        guide={{
          purpose: "Evaluate campaign performance against media buying rules without applying platform changes automatically.",
          dataSource: "gos_media_buying_rules + gos_campaign_daily_perf.perf_date + latest budget_compliance_monitor.",
          usedBy: "Media buyer / Growth strategist.",
          requiredInputs: ["Active rules", "Campaign daily performance", "Latest budget compliance monitor"],
          nextStep: "Add presets, review live triggers, then save suggestions for AM/media-buyer action.",
          primaryCta: "Evaluate rules",
        }}
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Refresh
            </button>
            <button onClick={runEvaluation} style={btnPrimary()}>
              <Zap size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Evaluate now
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Kpi label="Active rules" value={`${kpis.activeRules}/${kpis.totalRules}`} />
        <Kpi label="Tracked campaigns" value={String(kpis.trackedCampaigns)} />
        <Kpi label="Live triggers" value={String(kpis.triggersNow)} color={kpis.triggersNow > 0 ? AMBER : GREEN} />
        <Kpi label="Pending suggestions" value={String(kpis.pending)} color={kpis.pending > 0 ? AMBER : "white"} />
        <Kpi label="Applied actions" value={String(kpis.applied)} color={BLUE} />
      </div>

      {evaluation && (
        <Panel title="Evaluation summary">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Kpi label="Engine" value={evaluation.engine_version.replace("media_buying_", "")} />
            <Kpi label="Skipped checks" value={String(evaluation.skipped_count)} color={evaluation.skipped_count > 0 ? AMBER : GREEN} />
            <Kpi label="Cooldown" value={String(evaluation.suppressed_count)} color={evaluation.suppressed_count > 0 ? AMBER : GREEN} />
            <Kpi label="Risks" value={String(evaluation.risks.length)} color={evaluation.risks.length > 0 ? RED : GREEN} />
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 12 }}>{evaluation.summary}</div>
          {evaluation.next_actions.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {evaluation.next_actions.map((action) => (
                <div key={action} style={{ color: "var(--tdia-text)", fontSize: 12, borderLeft: `3px solid ${BLUE}`, paddingLeft: 8 }}>{action}</div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Panel title="Rule presets">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          {PRESETS.map((preset) => (
            <button key={preset.rule_name} onClick={() => addRule(preset)}
              style={{ textAlign: "left", padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG_DEEP, color: "var(--tdia-text)", cursor: "pointer" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>+ {preset.rule_name}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{preset.platform} / {preset.metric} {preset.operator} {preset.threshold_value} / {preset.action_type}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Create custom rule">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(8, minmax(90px, 1fr)) auto", gap: 10, alignItems: "end" }}>
          <Field label="Name">
            <input value={draft.rule_name ?? ""} onChange={(e) => setDraft({ ...draft, rule_name: e.target.value })}
              placeholder="Kill low ROAS Meta" style={inputStyle()} />
          </Field>
          <Field label="Platform">
            <Select value={draft.platform ?? "meta"} onChange={(value) => setDraft({ ...draft, platform: value })} options={PLATFORMS.map((p) => ({ value: p, label: p }))} />
          </Field>
          <Field label="Metric">
            <Select value={draft.metric ?? "roas"} onChange={(value) => setDraft({ ...draft, metric: value })} options={METRICS} />
          </Field>
          <Field label="Op">
            <Select value={draft.operator ?? "<"} onChange={(value) => setDraft({ ...draft, operator: value })} options={OPERATORS} />
          </Field>
          <Field label="Threshold">
            <input value={draft.threshold_value ?? ""} inputMode="decimal"
              onChange={(e) => setDraft({ ...draft, threshold_value: Number(e.target.value) })} style={inputStyle()} />
          </Field>
          <Field label="Lookback">
            <input value={draft.lookback_days ?? 3} inputMode="numeric"
              onChange={(e) => setDraft({ ...draft, lookback_days: Number(e.target.value) })} style={inputStyle()} />
          </Field>
          <Field label="Action">
            <Select value={draft.action_type ?? "pause"} onChange={(value) => setDraft({ ...draft, action_type: value })} options={ACTIONS} />
          </Field>
          <Field label="Value">
            <input value={draft.action_value ?? ""} inputMode="decimal" placeholder="%"
              onChange={(e) => setDraft({ ...draft, action_value: e.target.value === "" ? null : Number(e.target.value) })} style={inputStyle()} />
          </Field>
          <Field label="Priority">
            <Select value={draft.priority ?? "medium"} onChange={(value) => setDraft({ ...draft, priority: value })}
              options={[{ value: "low", label: "low" }, { value: "medium", label: "medium" }, { value: "high", label: "high" }]} />
          </Field>
          <button onClick={() => addRule()} style={btnPrimary()}><Plus size={12} /></button>
        </div>
      </Panel>

      <Panel title={`Rules (${rules.length})`}>
        {rules.length === 0 ? (
          <EmptyState title="No rule" hint="Add a preset or create a custom rule." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Active</Th><Th>Name</Th><Th>Platform</Th><Th>Condition</Th><Th>Lookback</Th><Th>Action</Th><Th>Priority</Th><Th />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: rule.is_active ? 1 : 0.5 }}>
                  <Td><IconButton onClick={() => toggleRule(rule)} title={rule.is_active ? "Deactivate" : "Activate"} color={rule.is_active ? GREEN : MUTED}><Power size={14} /></IconButton></Td>
                  <Td bold>{rule.rule_name}</Td>
                  <Td color={MUTED}>{rule.platform}</Td>
                  <Td>{rule.metric} {rule.operator} {rule.threshold_value}</Td>
                  <Td>{rule.lookback_days}d</Td>
                  <Td>{rule.action_type}{rule.action_value != null ? ` (${rule.action_value})` : ""}</Td>
                  <Td><Chip value={rule.priority} color={priorityColor(rule.priority)} /></Td>
                  <Td align="right"><IconButton onClick={() => removeRule(rule.id)} title="Delete" color={RED}><Trash2 size={14} /></IconButton></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Live evaluation (${suggestions.length})`} borderColor={suggestions.length > 0 ? AMBER : BORDER}>
        {suggestions.length === 0 ? (
          <EmptyState title="No trigger" hint={perfs.length === 0 ? "No campaign performance rows in the active lookback window." : "All active rules are currently satisfied."} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th><Th>Metric</Th><Th align="right">Value</Th><Th align="right">Threshold</Th><Th>Action</Th><Th>Guardrail</Th><Th>Rule notes</Th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td bold>{suggestion.target_name}</Td>
                  <Td color={MUTED}>{suggestion.metric}</Td>
                  <Td align="right" color={AMBER}>{fmt(suggestion.metric_value)}</Td>
                  <Td align="right">{fmt(suggestion.threshold_value)}</Td>
                  <Td color={BLUE}>{suggestion.action_type}{suggestion.action_value != null ? ` (${suggestion.action_value})` : ""}</Td>
                  <Td><Chip value={suggestion.guardrail_status} color={guardrailColor(suggestion.guardrail_status)} /></Td>
                  <Td color={MUTED}>{suggestion.notes}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Campaign performance (${perfs.length})`}>
        {perfs.length === 0 ? (
          <EmptyState title="No campaign performance" hint="Enter daily campaign performance in Buyer Workspace or via integrations." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th><Th>Platform</Th><Th align="right">Spend</Th><Th align="right">Revenue</Th><Th align="right">Orders</Th><Th align="right">Leads</Th><Th align="right">ROAS</Th><Th align="right">CPA</Th><Th align="right">CPL</Th>
              </tr>
            </thead>
            <tbody>
              {perfs.map((perf) => (
                <tr key={perf.campaign_id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td bold>{perf.campaign_name}</Td>
                  <Td color={MUTED}>{perf.platform}</Td>
                  <Td align="right">{fmtMoney(perf.spend)}</Td>
                  <Td align="right">{fmtMoney(perf.revenue)}</Td>
                  <Td align="right">{perf.orders}</Td>
                  <Td align="right">{perf.leads}</Td>
                  <Td align="right">{fmt(perf.roas)}</Td>
                  <Td align="right">{fmtMoney(perf.cpa)}</Td>
                  <Td align="right">{fmtMoney(perf.cpl)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {evaluation && (evaluation.skipped.length > 0 || evaluation.suppressed.length > 0) && (
        <Panel title="Skipped and cooldown checks">
          <div style={{ display: "grid", gap: 8 }}>
            {evaluation.skipped.map((item, index) => (
              <div key={`skip-${item.rule_id}-${item.target_name ?? index}`} style={noticeStyle(AMBER)}>
                <strong>{item.rule_name}</strong>{item.target_name ? ` / ${item.target_name}` : ""}: {item.reason}
              </div>
            ))}
            {evaluation.suppressed.map((item) => (
              <div key={`cooldown-${item.key}`} style={noticeStyle(BLUE)}>
                <strong>{item.target_name}</strong>: suppressed by {item.cooldown_hours}h cooldown since {new Date(item.last_action_at).toLocaleString("fr-FR")}.
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={`Action history (${actions.length})`}>
        {actions.length === 0 ? (
          <EmptyState title="No action logged" hint="Click Evaluate now to save suggestions." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Status</Th><Th>Campaign</Th><Th>Metric</Th><Th align="right">Value</Th><Th align="right">Threshold</Th><Th>Action</Th><Th>Date</Th><Th align="right" />
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td><Chip value={action.status} color={statusColor(action.status)} /></Td>
                  <Td bold>{action.target_name}</Td>
                  <Td color={MUTED}>{action.metric ?? "-"}</Td>
                  <Td align="right">{fmt(action.metric_value)}</Td>
                  <Td align="right">{fmt(action.threshold_value)}</Td>
                  <Td>{action.action_type}{action.action_value != null ? ` (${action.action_value})` : ""}</Td>
                  <Td color={MUTED}>{new Date(action.created_at).toLocaleString("fr-FR")}</Td>
                  <Td align="right">
                    {action.status === "suggested" && (
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <IconButton onClick={() => setActionStatus(action.id, "applied")} title="Mark applied" color={GREEN}><CheckCircle2 size={14} /></IconButton>
                        <IconButton onClick={() => setActionStatus(action.id, "dismissed")} title="Dismiss" color={MUTED}><XCircle size={14} /></IconButton>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(255, 255, 255, 0.02)", border: `1px dashed ${BORDER}`, fontSize: 11, color: MUTED, fontFamily: MONO }}>
        This module records suggestions only. Spend increases still require Budget Change Gate and guarded budget application before campaign budgets are changed.
      </div>
    </>
  );
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    background: BG_DEEP,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: "8px 10px",
    fontFamily: MONO,
    fontSize: 12,
    color: "var(--tdia-text)",
    outline: "none",
    height: 36,
  };
}

function btnPrimary(): CSSProperties {
  return {
    height: 36,
    padding: "0 14px",
    background: BLUE,
    color: "var(--tdia-text)",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: MONO,
    width: "100%",
  };
}

function noticeStyle(color: string): CSSProperties {
  return {
    padding: 10,
    borderRadius: 8,
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color: "var(--tdia-text)",
    fontSize: 12,
    lineHeight: 1.45,
  };
}

function Panel({ title, children, borderColor = BORDER }: { title: string; children: ReactNode; borderColor?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${borderColor}`, background: CARD, marginBottom: 16, overflow: "hidden" }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle()}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function Table({ children }: { children: ReactNode }) {
  return <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>{children}</table>;
}

function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" | "center" }) {
  return <th style={{ padding: "10px 14px", textAlign: align, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, color: MUTED, whiteSpace: "nowrap", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em" }}>{children}</th>;
}

function Td({ children, align = "left", bold, color }: { children: ReactNode; align?: "left" | "right" | "center"; bold?: boolean; color?: string }) {
  return <td style={{ padding: "10px 14px", textAlign: align, color: color ?? "white", fontWeight: bold ? 700 : 400, whiteSpace: "nowrap", verticalAlign: "top" }}>{children}</td>;
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: color ?? "white", overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function Chip({ value, color }: { value: string; color: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 4, background: color, color: "white", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

function IconButton({ children, onClick, title, color }: { children: ReactNode; onClick: () => void; title: string; color: string }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "transparent", border: "none", color, cursor: "pointer", padding: 2 }}>
      {children}
    </button>
  );
}
