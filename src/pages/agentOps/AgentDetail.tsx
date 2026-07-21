import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { AgentRun, Artifact } from "@/agentOps/types";
import { BackendErrorBanner, PlaceholderBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/agentOps/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function AgentDetail() {
  const { agentId = "" } = useParams();
  const [agent, setAgent] = useState<AgentRun>();
  const [outputs, setOutputs] = useState<{ artifact: Artifact; content: unknown }[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const clients = await tdia.listClients();
        outer: for (const c of clients) {
          const runs = await tdia.listClientRuns(c.id).catch(() => []);
          for (const r of runs) {
            const ags = await tdia.listAgents(r.id).catch(() => []);
            const found = ags.find(a => a.id === agentId);
            if (found) {
              setAgent(found);
              const arts = await tdia.listArtifacts(r.id).catch(() => [] as Artifact[]);
              const mine = arts.filter(a => found.output_artifacts.includes(a.id));
              const enriched = await Promise.all(mine.map(async (a) => {
                try { return { artifact: a, content: await tdia.getArtifactContent(a.id) }; }
                catch { return { artifact: a, content: null }; }
              }));
              setOutputs(enriched);
              break outer;
            }
          }
        }
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [agentId]);

  if (!agent) return <div className="text-sm text-muted-foreground">{err ? <BackendErrorBanner message={err} /> : "Loading…"}</div>;

  return (
    <div className="space-y-6">
      <PlaceholderBanner />
      <SectionHeader title={agent.agent_definition_id} subtitle={agent.safe_summary ?? undefined} right={<StatusBadge status={agent.status} />} />

      <div className="grid md:grid-cols-4 gap-3">
        <Card className="glass-card p-4"><div className="text-[11px] uppercase text-muted-foreground">Attempt</div><div className="text-xl mt-1">{agent.attempt}</div></Card>
        <Card className="glass-card p-4"><div className="text-[11px] uppercase text-muted-foreground">Duration</div><div className="text-xl mt-1">{agent.duration_ms ?? 0}ms</div></Card>
        <Card className="glass-card p-4"><div className="text-[11px] uppercase text-muted-foreground">Started</div><div className="text-sm mt-1">{agent.started_at}</div></Card>
        <Card className="glass-card p-4"><div className="text-[11px] uppercase text-muted-foreground">Artifacts</div><div className="text-xl mt-1">{agent.output_artifacts.length}</div></Card>
      </div>

      <Tabs defaultValue="results">
        <TabsList><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="raw">Raw JSON</TabsTrigger></TabsList>
        <TabsContent value="results" className="mt-4 space-y-3">
          {outputs.length === 0 && <p className="text-sm text-muted-foreground">No outputs.</p>}
          {outputs.map(({ artifact, content }) => {
            const c = (content && typeof content === "object") ? content as Record<string, unknown> : null;
            return (
              <Card key={artifact.id} className="glass-card p-5 space-y-3">
                <div className="flex justify-between"><div className="font-medium">{artifact.title}</div><Badge variant="outline">{artifact.kind}</Badge></div>
                {c && (
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(c).map(([k, v]) => (
                      <div key={k}>
                        <div className="text-[11px] uppercase text-muted-foreground">{k}</div>
                        <div className="mt-0.5">{Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>
        <TabsContent value="raw" className="mt-4">
          <Card className="glass-card p-5"><pre className="text-xs overflow-auto">{JSON.stringify(outputs, null, 2)}</pre></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
