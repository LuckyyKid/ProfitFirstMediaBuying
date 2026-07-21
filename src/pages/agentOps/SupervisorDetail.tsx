import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { SupervisorRun } from "@/agentOps/types";
import { BackendErrorBanner, PlaceholderBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { DecisionBadge } from "@/components/agentOps/StatusBadge";
import { Badge } from "@/components/ui/badge";

export default function SupervisorDetail() {
  const { supervisorId = "" } = useParams();
  const [sup, setSup] = useState<SupervisorRun>();
  const [err, setErr] = useState<string>();
  useEffect(() => {
    (async () => {
      try {
        const clients = await tdia.listClients();
        outer: for (const c of clients) {
          const runs = await tdia.listClientRuns(c.id).catch(() => []);
          for (const r of runs) {
            const sups = await tdia.listSupervisors(r.id).catch(() => []);
            const found = sups.find(s => s.id === supervisorId);
            if (found) { setSup(found); break outer; }
          }
        }
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [supervisorId]);

  if (!sup) return <div className="text-sm text-muted-foreground">{err ? <BackendErrorBanner message={err} /> : "Loading…"}</div>;

  return (
    <div className="space-y-6">
      <PlaceholderBanner />
      <SectionHeader title={sup.name} subtitle={`Rubric: ${sup.rubric_name}`} right={<DecisionBadge decision={sup.decision} />} />
      <Card className="glass-card p-5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div><div className="text-[11px] uppercase text-muted-foreground">Score</div><div className="text-xl mt-1">{sup.score ?? "—"}</div></div>
          <div><div className="text-[11px] uppercase text-muted-foreground">Attempt</div><div className="text-xl mt-1">{sup.attempt}</div></div>
          <div><div className="text-[11px] uppercase text-muted-foreground">Target stage</div><div className="text-sm mt-1">{sup.target_stage ?? "—"}</div></div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-muted-foreground mb-1">Skills</div>
          <div className="flex flex-wrap gap-1.5">{sup.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-muted-foreground mb-1">Evidence artifact IDs</div>
          <div className="flex flex-wrap gap-1.5">{sup.evidence.map(e => <Badge key={e} variant="outline" className="font-mono text-[10px]">{e}</Badge>)}</div>
        </div>
      </Card>
    </div>
  );
}
