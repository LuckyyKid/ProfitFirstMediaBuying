import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { AgentDefinition } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function EngineList() {
  const [defs, setDefs] = useState<AgentDefinition[]>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => { tdia.listAgentDefinitions().then(setDefs).catch(e => setErr(e.message)); }, []);
  const byEngine = new Map<string, AgentDefinition[]>();
  for (const d of defs) {
    const arr = byEngine.get(d.engine) ?? []; arr.push(d); byEngine.set(d.engine, arr);
  }
  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="Engines (catalog)" subtitle="Definitions from /api/agents grouped by engine." />
      <div className="grid md:grid-cols-2 gap-3">
        {[...byEngine.entries()].map(([engine, list]) => (
          <Card key={engine} className="glass-card p-4">
            <div className="font-medium">{engine}</div>
            <div className="text-xs text-muted-foreground mb-2">{list.length} agents</div>
            <div className="flex flex-wrap gap-1.5">{list.map(a => <Badge key={a.id} variant="secondary">{a.name}</Badge>)}</div>
          </Card>
        ))}
      </div>
      <Link to="/admin/ops/workflow" className="text-sm underline text-primary">Open Live Workflow →</Link>
    </div>
  );
}
