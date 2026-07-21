import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { SupervisorDefinition, SupervisorRun, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DecisionBadge } from "@/components/agentOps/StatusBadge";
import { PulseDot } from "@/components/agentOps/LiveActivity";
import { getTrackedRuns, untrackRun } from "@/agentOps/trackedRuns";

const HIGHLIGHTED = new Set(["OfferPositioningSupervisor","MarketResearchSupervisor","CreativeStrategySupervisor","FinalStrategyPackSupervisor"]);

interface ActiveSupervisorRow { sv: SupervisorRun; run: WorkflowRun; }

export default function SupervisorList() {
  const [defs, setDefs] = useState<SupervisorDefinition[]>([]);
  const [active, setActive] = useState<ActiveSupervisorRow[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => { tdia.listSupervisorDefinitions().then(setDefs).catch(e => setErr(e.message)); }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const ids = getTrackedRuns();
      const groups = await Promise.all(ids.map(async (id) => {
        try {
          const run = await tdia.getRun(id);
          try {
            const svs = await tdia.listSupervisors(id);
            return svs.map((sv) => ({ sv, run }));
          } catch {
            return [] as ActiveSupervisorRow[];
          }
        } catch {
          untrackRun(id);
          return [] as ActiveSupervisorRow[];
        }
      }));
      const rows = groups.flat();
      if (!cancelled) setActive(rows);
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const pending = active.filter(r => (r.sv.decision ?? "").toUpperCase() === "PENDING").length;

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader
        title="Supervisors"
        subtitle="Live decisions across recent runs · full catalog below"
        right={<Badge variant="outline" className="font-mono text-[10px]"><PulseDot active={pending > 0} className="mr-1.5" />{pending} pending</Badge>}
      />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent decisions</h2>
        {active.length === 0 && <p className="text-sm text-muted-foreground">No tracked runs yet. Start a run from <Link to="/admin/ops/workflow" className="text-primary hover:underline">Live Workflow</Link>.</p>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {active.map(({ sv, run }) => (
            <Link key={sv.id} to={`/admin/ops/supervisors/${sv.id}`} className="block rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/40">
              <div className="flex justify-between"><span className="text-[10px] uppercase text-muted-foreground">{sv.rubric_name}</span><DecisionBadge decision={sv.decision} /></div>
              <div className="font-medium mt-1.5">{sv.name}</div>
              <div className="text-xs text-muted-foreground mt-1">score {sv.score ?? "—"} · attempt {sv.attempt}</div>
              <div className="text-[11px] text-muted-foreground mt-2 font-mono">run {run.id.slice(0,8)}…</div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Catalog</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {defs.map(s => (
            <Card key={s.name} className={`glass-card p-4 ${HIGHLIGHTED.has(s.name) ? "border-primary/40" : ""}`}>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground mt-1">Rubric: {s.rubric}</div>
              {HIGHLIGHTED.has(s.name) && <div className="text-[10px] uppercase tracking-wider text-primary mt-2">Highlighted</div>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
