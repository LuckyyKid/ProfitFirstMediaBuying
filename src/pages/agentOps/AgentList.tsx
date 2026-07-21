import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { AgentDefinition, AgentRun, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/agentOps/StatusBadge";
import { LiveFrame, PulseDot, ThinkingIndicator } from "@/components/agentOps/LiveActivity";
import { Progress } from "@/components/ui/progress";
import { getTrackedRuns, untrackRun } from "@/agentOps/trackedRuns";

interface ActiveAgentRow {
  agent: AgentRun;
  run: WorkflowRun;
}

export default function AgentList() {
  const [defs, setDefs] = useState<AgentDefinition[]>([]);
  const [active, setActive] = useState<ActiveAgentRow[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    tdia.listAgentDefinitions().then(setDefs).catch(e => setErr(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const ids = getTrackedRuns();
      const groups = await Promise.all(ids.map(async (id) => {
        try {
          const run = await tdia.getRun(id);
          try {
            const agents = await tdia.listAgents(id);
            return agents.map((agent) => ({ agent, run }));
          } catch {
            return [] as ActiveAgentRow[];
          }
        } catch {
          untrackRun(id);
          return [] as ActiveAgentRow[];
        }
      }));
      const rows = groups.flat();
      if (!cancelled) setActive(rows);
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const running = active.filter(r => ["running","in_progress","queued"].includes((r.agent.status ?? "").toLowerCase()));

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader
        title="Agents"
        subtitle="Live status across recent runs · full catalog below"
        right={<Badge variant="outline" className="font-mono text-[10px]"><PulseDot active={running.length > 0} className="mr-1.5" />{running.length} active</Badge>}
      />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Currently working</h2>
        {active.length === 0 && <p className="text-sm text-muted-foreground">No tracked runs yet. Start a run from <Link to="/admin/ops/workflow" className="text-primary hover:underline">Live Workflow</Link>.</p>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {active.map(({ agent: a, run }) => {
            const isRunning = ["running","in_progress"].includes((a.status ?? "").toLowerCase());
            return (
              <LiveFrame key={a.id} active={isRunning}>
                <Link to={`/admin/ops/agents/${a.id}`} className="block rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1.5"><PulseDot active={isRunning} />{a.agent_definition_id}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-sm mt-1.5 line-clamp-2">{a.safe_summary ?? (isRunning ? "…thinking" : "—")}</div>
                  {isRunning && typeof a.progress === "number" && <Progress value={a.progress} className="h-1 mt-2" />}
                  <div className="text-[11px] text-muted-foreground mt-2 font-mono">run {run.id.slice(0,8)}… · attempt {a.attempt}</div>
                  {isRunning && <ThinkingIndicator label="Processing" className="mt-2 text-[10px]" />}
                </Link>
              </LiveFrame>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Catalog</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {defs.sort((a, b) => a.display_order - b.display_order).map(a => (
            <Card key={a.id} className="glass-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.engine}</div>
              <div className="font-medium mt-1">{a.name}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-3 min-h-[3rem]">{a.mission}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{a.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
              <div className="text-[11px] text-muted-foreground mt-2">{a.model_provider}/{a.model_name}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
