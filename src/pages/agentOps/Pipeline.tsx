import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import type { AgentRun, EngineRun, SupervisorRun, WorkflowRun } from "@/agentOps/types";
import { getTrackedRuns } from "@/agentOps/trackedRuns";
import { EnginesCanvas, EngineDetailsPanel } from "@/components/agentOps/EnginesCanvas";
import { isTerminal, statusTone, timeAgo, humanStatusLabel, toneDotClass } from "@/agentOps/humanStatus";
import { Button } from "@/components/ui/button";
import { Workflow, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

export default function Pipeline() {
  const [trackedIds, setTrackedIds] = useState<string[]>(() => getTrackedRuns());

  useEffect(() => {
    const t = setInterval(() => setTrackedIds(getTrackedRuns()), 4000);
    return () => clearInterval(t);
  }, []);

  // Fetch all tracked runs and pick the active one (running/queued)
  const runsQ = useQuery({
    queryKey: ["pipeline-runs", trackedIds],
    queryFn: async () => {
      const out: WorkflowRun[] = [];
      for (const id of trackedIds) {
        const r = await safe(() => tdia.getRun(id), null as WorkflowRun | null);
        if (r) out.push(r);
      }
      return out;
    },
    refetchInterval: 4000,
  });

  const runs = runsQ.data ?? [];
  const activeRun =
    runs.find((r) => statusTone(r.status) === "running") ??
    runs.find((r) => statusTone(r.status) === "queued") ??
    null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative rounded-2xl border border-white/5 bg-[#0a1226]/60 backdrop-blur-xl px-6 py-5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.1),transparent_60%)] pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Workflow className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-cyan-300">
                <span className={cn("h-1.5 w-1.5 rounded-full", activeRun ? "bg-cyan-400 animate-pulse" : "bg-slate-500")} />
                {activeRun ? "Pipeline en cours" : "Pipeline"}
              </div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-100 mt-0.5 tracking-tight">
                {activeRun ? `Audit ${activeRun.client_id}` : "Aucun run en cours"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeRun
                  ? `${humanStatusLabel(activeRun.status)} · démarré ${timeAgo(activeRun.started_at ?? activeRun.created_at)}`
                  : "Aucun audit n'est actuellement en cours d'exécution."}
              </p>
            </div>
          </div>
          {activeRun ? (
            <Button asChild variant="outline" className="border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100">
              <Link to={`/admin/ops/run/${activeRun.id}`}>
                <ExternalLink className="h-4 w-4 mr-1.5" /> Ouvrir le run
              </Link>
            </Button>
          ) : (
            <Button asChild className="bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-100">
              <Link to="/admin/ops/new"><Plus className="h-4 w-4 mr-1.5" /> Lancer un audit</Link>
            </Button>
          )}
        </div>
      </div>

      {activeRun ? (
        <ActivePipeline runId={activeRun.id} />
      ) : (
        <EmptyPipeline runs={runs} loading={runsQ.isLoading} />
      )}
    </div>
  );
}

function EmptyPipeline({ runs, loading }: { runs: WorkflowRun[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a1226]/60 backdrop-blur-xl p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-4">
        <Workflow className="h-6 w-6 text-slate-500" />
      </div>
      <div className="text-base font-medium text-slate-200">
        {loading ? "Chargement…" : "Aucun pipeline actif"}
      </div>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
        Lancez un nouvel audit pour visualiser le pipeline en temps réel ici. Aucune donnée n'est affichée tant qu'aucun run n'est en cours.
      </p>
      {runs.length > 0 && (
        <div className="mt-6 max-w-md mx-auto text-left">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-2">Runs suivis</div>
          <div className="space-y-1.5">
            {runs.slice(0, 5).map((r) => {
              const tone = statusTone(r.status);
              return (
                <Link
                  key={r.id}
                  to={`/admin/ops/run/${r.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", toneDotClass(tone))} />
                    <span className="font-mono text-slate-300 truncate">{r.id.slice(0, 8)}…</span>
                  </span>
                  <span className="text-slate-500">{humanStatusLabel(r.status)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivePipeline({ runId }: { runId: string }) {
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const runQ = useQuery({
    queryKey: ["run", runId],
    queryFn: () => tdia.getRun(runId),
    refetchInterval: (q) => (isTerminal((q.state.data as WorkflowRun | undefined)?.status) ? false : 3000),
  });
  const polling = !isTerminal(runQ.data?.status);
  const enginesQ = useQuery({
    queryKey: ["engines", runId],
    queryFn: () => safe(() => tdia.listEngines(runId), [] as EngineRun[]),
    refetchInterval: polling ? 4000 : false,
  });
  const agentsQ = useQuery({
    queryKey: ["agents", runId],
    queryFn: () => safe(() => tdia.listAgents(runId), [] as AgentRun[]),
    refetchInterval: polling ? 4000 : false,
  });
  const supsQ = useQuery({
    queryKey: ["supervisors", runId],
    queryFn: () => safe(() => tdia.listSupervisors(runId), [] as SupervisorRun[]),
    refetchInterval: polling ? 4000 : false,
  });

  const engines = enginesQ.data ?? [];
  const agents = agentsQ.data ?? [];
  const supervisors = supsQ.data ?? [];

  const activeEngine =
    engines.find((e) => statusTone(e.status) === "running") ??
    engines.find((e) => statusTone(e.status) === "queued");
  const visibleNames = !showAll && activeEngine ? [activeEngine.name] : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-slate-500">
          {showAll
            ? "Vue complète du workflow TDIA."
            : `Focus sur le moteur actuellement en exécution${activeEngine ? ` · ${activeEngine.name}` : ""}.`}
        </p>
        {activeEngine && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 h-8 text-xs"
          >
            {showAll ? "Focus pipeline actif" : "Voir tout le pipeline"}
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <EnginesCanvas
          engines={engines}
          agents={agents}
          supervisors={supervisors}
          selectedName={selectedEngine}
          onSelect={(name) => setSelectedEngine((cur) => (cur === name ? null : name))}
          visibleNames={visibleNames}
        />
        {selectedEngine && (
          <EngineDetailsPanel
            engineName={selectedEngine}
            engines={engines}
            agents={agents}
            supervisors={supervisors}
            onClose={() => setSelectedEngine(null)}
          />
        )}
      </div>
    </section>
  );
}
