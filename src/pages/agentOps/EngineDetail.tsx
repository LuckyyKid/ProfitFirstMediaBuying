import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { AgentRun, EngineRun, SupervisorRun } from "@/agentOps/types";
import { ENGINE_LABELS } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { DecisionBadge, StatusBadge } from "@/components/agentOps/StatusBadge";

export default function EngineDetail() {
  const { engineId = "" } = useParams();
  const [eng, setEng] = useState<EngineRun>();
  const [agents, setAgents] = useState<AgentRun[]>([]);
  const [sup, setSup] = useState<SupervisorRun>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        // We don't have a direct GET; fetch by parent run via /api/runs/{run_id}/engines is run-scoped.
        // Strategy: scan clients→runs→engines. Light enough for V1.
        const clients = await tdia.listClients();
        for (const c of clients) {
          const runs = await tdia.listClientRuns(c.id).catch(() => []);
          for (const r of runs) {
            const engs = await tdia.listEngines(r.id).catch(() => []);
            const found = engs.find(e => e.id === engineId);
            if (found) {
              setEng(found);
              const ags = await tdia.listAgents(r.id);
              setAgents(ags.filter(a => a.engine_run_id === engineId));
              const sups = await tdia.listSupervisors(r.id);
              setSup(sups.find(s => ags.some(a => a.engine_run_id === engineId && a.supervisor_run_id === s.id)));
              return;
            }
          }
        }
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [engineId]);

  if (!eng) return <div className="text-sm text-muted-foreground">{err ? <BackendErrorBanner message={err} /> : "Loading…"}</div>;

  return (
    <div className="space-y-6">
      <SectionHeader title={ENGINE_LABELS[eng.name] ?? eng.name} subtitle={eng.id} right={<StatusBadge status={eng.status} />} />
      {sup && (
        <Card className="glass-card p-5">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">Supervisor</div>
              <div className="font-medium mt-1">{sup.name}</div>
              <div className="text-xs text-muted-foreground">score {sup.score ?? "—"} · rubric {sup.rubric_name}</div>
            </div>
            <DecisionBadge decision={sup.decision} />
          </div>
        </Card>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map(a => (
          <Link key={a.id} to={`/admin/ops/agents/${a.id}`} className="block rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/40">
            <div className="flex justify-between"><span className="text-[10px] uppercase text-muted-foreground">{a.agent_definition_id}</span><StatusBadge status={a.status} /></div>
            <div className="text-sm mt-1">{a.safe_summary ?? "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">attempt {a.attempt} · {a.duration_ms ?? 0}ms · {a.output_artifacts.length} artifacts</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
