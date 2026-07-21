import { useEffect, useState } from "react";
import { tdia } from "@/agentOps/service";
import type { HumanReview } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";

export default function ReviewQueue() {
  const [reviews, setReviews] = useState<HumanReview[]>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    (async () => {
      try {
        const clients = await tdia.listClients();
        const all: HumanReview[] = [];
        for (const c of clients) {
          const runs = await tdia.listClientRuns(c.id).catch(() => []);
          for (const r of runs) {
            const rev = await tdia.listReviews(r.id).catch(() => []);
            all.push(...rev);
          }
        }
        setReviews(all);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);
  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="Human Review Queue" subtitle="Reviews flagged by supervisors." />
      <Card className="glass-card p-5">
        {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No open reviews.</p> : (
          <div className="space-y-2">{reviews.map(r => (
            <div key={r.id} className="rounded-md border border-border/40 bg-card/40 px-4 py-3 text-sm">
              <div className="font-medium">{r.id}</div>
              <div className="text-xs text-muted-foreground">Run {r.workflow_run_id} · {r.status}</div>
              {r.reason && <div className="text-xs mt-1">{r.reason}</div>}
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
}
