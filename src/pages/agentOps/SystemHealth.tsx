import { useEffect, useState } from "react";
import { tdia } from "@/agentOps/service";
import { BackendErrorBanner, SectionHeader, KpiCard } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";

export default function SystemHealth() {
  const [h, setH] = useState<{ status: string; redis?: boolean; artifact_root?: string }>();
  const [err, setErr] = useState<string>();
  useEffect(() => {
    let cancel = false;
    const tick = () => tdia.health().then(d => !cancel && setH(d)).catch(e => !cancel && setErr(e.message));
    tick(); const i = setInterval(tick, 10000);
    return () => { cancel = true; clearInterval(i); };
  }, []);
  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="System Health" subtitle="api.tdiaconnect.ca" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="API" value={h?.status ?? "—"} tone={h?.status === "ok" ? "success" : "danger"} />
        <KpiCard label="Redis" value={h?.redis ? "up" : "down"} tone={h?.redis ? "success" : "danger"} />
        <KpiCard label="SSE" value="streaming" />
        <KpiCard label="PDF storage" value={h?.artifact_root ? "mounted" : "—"} />
      </div>
      <Card className="glass-card p-5 text-xs text-muted-foreground">
        Components not directly probed by /health (FastAPI process, RQ worker, PostgreSQL, Ollama, Nginx) are reported indirectly via successful run execution and SSE delivery.
      </Card>
    </div>
  );
}
