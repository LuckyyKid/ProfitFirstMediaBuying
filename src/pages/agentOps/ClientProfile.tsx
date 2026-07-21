import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { pickRunId } from "@/agentOps/runId";
import { tdia } from "@/agentOps/service";
import type { Client, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/agentOps/StatusBadge";
import { Button } from "@/components/ui/button";

export default function ClientProfile() {
  const { clientId = "" } = useParams();
  const [client, setClient] = useState<Client>();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const cs = await tdia.listClients();
        setClient(cs.find(c => c.id === clientId));
        setRuns(await tdia.listClientRuns(clientId));
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [clientId]);

  async function launch() {
    try {
      const r = await tdia.createRun(clientId, { workflow: "full-prelaunch", mode: "production" });
      const runId = pickRunId(r);
      if (!runId) throw new Error(`Backend did not return a valid run id (got: ${JSON.stringify(r)})`);
      window.location.href = `/admin/ops/workflow?id=${runId}`;
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader
        title={client?.name ?? clientId}
        subtitle={client?.website ?? undefined}
        right={<Button onClick={launch}>Launch full-prelaunch</Button>}
      />
      <Card className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-3">Runs</h2>
        <div className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
          {runs.map(r => (
            <Link key={r.id} to={`/admin/ops/workflow?id=${r.id}`} className="flex justify-between rounded-md border border-border/40 bg-card/40 px-4 py-3 hover:border-primary/40">
              <div><div className="text-sm font-medium">{r.id}</div><div className="text-xs text-muted-foreground">{r.created_at}</div></div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
