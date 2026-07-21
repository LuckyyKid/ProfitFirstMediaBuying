import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sanitizeRunId } from "@/agentOps/runId";
import { tdia } from "@/agentOps/service";
import type { Source, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SourcesEvidence() {
  const [params, setParams] = useSearchParams();
  const id = sanitizeRunId(params.get("id")) || "306fe571-9b50-4246-b0bb-f0f672501ca2";
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    (async () => {
      try {
        const cs = await tdia.listClients();
        const all: WorkflowRun[] = [];
        for (const c of cs) all.push(...await tdia.listClientRuns(c.id).catch(() => []));
        setRuns(all);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);
  useEffect(() => { if (id) tdia.listSources(id).then(setSources).catch(e => setErr(e.message)); }, [id]);
  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="Sources & Evidence" subtitle={id} right={
        <Select value={id} onValueChange={(v) => setParams({ id: v })}><SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger><SelectContent>{runs.map(r => <SelectItem key={r.id} value={r.id}>{r.id.slice(0,8)}… · {r.client_id}</SelectItem>)}</SelectContent></Select>
      } />
      <div className="space-y-2">
        {sources.map(s => (
          <Card key={s.id} className="glass-card p-3">
            <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline">{s.title ?? s.url}</a>
            <div className="text-xs text-muted-foreground">{s.url}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{s.source_type}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
