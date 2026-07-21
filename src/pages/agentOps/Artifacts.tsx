import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sanitizeRunId } from "@/agentOps/runId";
import { tdia } from "@/agentOps/service";
import type { Artifact, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

export default function Artifacts() {
  const [params, setParams] = useSearchParams();
  const id = sanitizeRunId(params.get("id")) || "306fe571-9b50-4246-b0bb-f0f672501ca2";
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [arts, setArts] = useState<Artifact[]>([]);
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
  useEffect(() => { if (id) tdia.listArtifacts(id).then(setArts).catch(e => setErr(e.message)); }, [id]);

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="Artifacts" subtitle={id} right={
        <Select value={id} onValueChange={(v) => setParams({ id: v })}><SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger><SelectContent>{runs.map(r => <SelectItem key={r.id} value={r.id}>{r.id.slice(0,8)}… · {r.client_id}</SelectItem>)}</SelectContent></Select>
      } />
      <div className="space-y-2">
        {arts.map(a => (
          <Card key={a.id} className="glass-card p-3 flex items-center justify-between gap-3">
            <div><div className="font-medium text-sm">{a.title}</div><div className="text-xs text-muted-foreground">{a.kind} · {a.created_at}</div></div>
            <Button asChild variant="outline" size="sm"><a href={tdia.artifactDownloadUrl(a.id)} target="_blank" rel="noreferrer"><Download className="h-3 w-3 mr-1" />Download</a></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
