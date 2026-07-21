import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sanitizeRunId } from "@/agentOps/runId";
import { tdia } from "@/agentOps/service";
import type { EngineRun } from "@/agentOps/types";
import { ENGINE_LABELS, ENGINE_ORDER } from "@/agentOps/types";
import { StatusBadge } from "@/components/agentOps/StatusBadge";
import { runStatusClass } from "@/agentOps/statusColors";
import { cn } from "@/lib/utils";
import { PulseDot, ScanlineOverlay, ThinkingIndicator } from "@/components/agentOps/LiveActivity";
import { ChevronRight } from "lucide-react";

export function WorkflowGraph({ workflowRunId, engines: initialEngines }: { workflowRunId: string; engines?: EngineRun[] }) {
  const runId = sanitizeRunId(workflowRunId);
  const { data: queriedEngines = [] } = useQuery({
    queryKey: ["engines", runId],
    queryFn: async () => {
      try {
        return await tdia.listEngines(runId);
      } catch {
        return [] as EngineRun[];
      }
    },
    enabled: Boolean(runId) && !initialEngines,
    refetchInterval: 4000,
    retry: false,
  });
  const engines = initialEngines ?? queriedEngines;
  const byName = new Map(engines.map((e) => [e.name, e]));

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {ENGINE_ORDER.map((name, i) => {
        const eng = byName.get(name);
        const status = (eng?.status ?? "queued").toLowerCase();
        const running = status === "running" || status === "in_progress";
        const completed = status === "completed" || status === "succeeded";
        return (
          <div key={name} className="flex items-stretch gap-2 flex-1 min-w-[150px]">
            <Link
              to={eng ? `/admin/ops/engines/${eng.id}` : "#"}
              className={cn(
                "relative flex-1 rounded-lg border p-3 transition overflow-hidden",
                runStatusClass(eng?.status),
                running && "animate-pulse-glow border-primary/60",
                "hover:border-primary/60",
              )}
            >
              <ScanlineOverlay active={running} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider opacity-70">Engine {i + 1}</div>
                  <PulseDot active={running} />
                </div>
                <div className="font-medium text-sm mt-1">{ENGINE_LABELS[name]}</div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={eng?.status ?? "queued"} />
                  {running && <ThinkingIndicator label="Working" className="text-[10px]" />}
                </div>
                {completed && (
                  <div className="absolute top-2 right-2 text-emerald-300 text-[10px] font-mono">✓</div>
                )}
              </div>
            </Link>
            {i < ENGINE_ORDER.length - 1 && (
              <ChevronRight className={cn("h-4 w-4 self-center shrink-0", running ? "text-primary animate-pulse" : "text-muted-foreground/40")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WorkflowGraph;
