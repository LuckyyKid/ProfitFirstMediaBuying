import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { Client, Incident, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner, KpiCard, PlaceholderBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { StatusBadge } from "@/components/agentOps/StatusBadge";
import { Card } from "@/components/ui/card";

export default function OverviewPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const cs = await tdia.listClients();
        setClients(cs);
        setIncidents(await tdia.listIncidents());
        const all: WorkflowRun[] = [];
        for (const c of cs) {
          try { all.push(...await tdia.listClientRuns(c.id)); } catch { /* skip */ }
        }
        setRuns(all);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);

  const running = runs.filter(r => r.status === "running").length;
  const completed = runs.filter(r => r.status === "completed").length;
  const failed = runs.filter(r => r.status === "failed").length;

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <PlaceholderBanner>The current validation run contains placeholder agent outputs. Substantive audit results will replace them later without a frontend redesign.</PlaceholderBanner>
      <SectionHeader title="Operations Overview" subtitle="Connected to api.tdiaconnect.ca" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Clients" value={clients.length} />
        <KpiCard label="Running" value={running} tone="warn" />
        <KpiCard label="Completed" value={completed} tone="success" />
        <KpiCard label="Failed" value={failed} tone="danger" />
        <KpiCard label="Incidents" value={incidents.length} />
      </div>

      <Card className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-3">Recent runs</h2>
        <div className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
          {runs.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 20).map((r) => (
            <Link key={r.id} to={`/admin/ops/workflow?id=${r.id}`} className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-4 py-3 hover:border-primary/40">
              <div>
                <div className="font-medium text-sm">{r.id}</div>
                <div className="text-xs text-muted-foreground">Client {r.client_id} · {r.progress ?? 0}%</div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
