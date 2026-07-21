import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sanitizeRunId } from "@/agentOps/runId";
import { tdia } from "@/agentOps/service";
import type { BenchmarkReport, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, PlaceholderBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { DecisionBadge } from "@/components/agentOps/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Benchmark() {
  const [params, setParams] = useSearchParams();
  const id = sanitizeRunId(params.get("id")) || "306fe571-9b50-4246-b0bb-f0f672501ca2";
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [b, setB] = useState<BenchmarkReport>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const clients = await tdia.listClients();
        const all: WorkflowRun[] = [];
        for (const c of clients) all.push(...await tdia.listClientRuns(c.id).catch(() => []));
        setRuns(all);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);
  useEffect(() => { if (id) tdia.getBenchmark(id).then(setB).catch(e => setErr(e.message)); }, [id]);

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <PlaceholderBanner>Technical validation output — not a substantive client strategy assessment.</PlaceholderBanner>
      <SectionHeader
        title="Benchmark Quality"
        subtitle={id}
        right={<Select value={id} onValueChange={(v) => setParams({ id: v })}><SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger><SelectContent>{runs.map(r => <SelectItem key={r.id} value={r.id}>{r.id.slice(0,8)}… · {r.client_id}</SelectItem>)}</SelectContent></Select>}
      />
      {b && (
        <>
          <Card className="glass-card p-5 flex items-center justify-between">
            <div><div className="text-[11px] uppercase text-muted-foreground">Overall score</div><div className="text-3xl font-semibold mt-1">{b.overall_score}</div></div>
            <DecisionBadge decision={b.verdict} />
          </Card>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {b.supervisors.map(s => (
              <Card key={s.id} className="glass-card p-4">
                <div className="flex justify-between"><div className="font-medium">{s.name}</div><DecisionBadge decision={s.decision} /></div>
                <div className="text-xs text-muted-foreground mt-1">{s.rubric_name}</div>
                <div className="text-xl mt-2">{s.score ?? "—"}</div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
