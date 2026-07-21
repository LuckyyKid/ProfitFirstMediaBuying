import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import type { Client, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Activity, AlertTriangle, CheckCircle2, Users, Hexagon } from "lucide-react";
import { getTrackedRuns, untrackRun } from "@/agentOps/trackedRuns";
import { humanStatusLabel, shortStatusLabel, statusTone, timeAgo, type Tone } from "@/agentOps/humanStatus";
import { cn } from "@/lib/utils";

interface RunWithClient { run: WorkflowRun; client?: Client }

const TONE_TEXT: Record<Tone, string> = {
  completed: "text-emerald-300",
  running: "text-cyan-300",
  queued: "text-slate-300",
  human_review: "text-fuchsia-300",
  failed: "text-rose-300",
  warning: "text-amber-300",
  neutral: "text-slate-400",
};
const TONE_DOT: Record<Tone, string> = {
  completed: "bg-emerald-400",
  running: "bg-cyan-400 animate-pulse",
  queued: "bg-slate-400",
  human_review: "bg-fuchsia-400 animate-pulse",
  failed: "bg-rose-400",
  warning: "bg-amber-400",
  neutral: "bg-slate-500",
};

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  pulse,
}: {
  label: string;
  value: number;
  hint?: string;
  accent: "cyan" | "amber" | "rose" | "emerald";
  icon: React.ElementType;
  pulse?: boolean;
}) {
  const tokens =
    accent === "cyan"
      ? { stroke: "#22d3ee", border: "border-cyan-400/20", glow: "shadow-[0_0_50px_-20px_rgba(34,211,238,0.6)]", text: "text-cyan-200" }
      : accent === "amber"
      ? { stroke: "#fbbf24", border: "border-amber-400/20", glow: "shadow-[0_0_50px_-20px_rgba(251,191,36,0.5)]", text: "text-amber-200" }
      : accent === "rose"
      ? { stroke: "#fb7185", border: "border-rose-400/20", glow: "shadow-[0_0_50px_-20px_rgba(251,113,133,0.5)]", text: "text-rose-200" }
      : { stroke: "#34d399", border: "border-emerald-400/20", glow: "shadow-[0_0_50px_-20px_rgba(52,211,153,0.5)]", text: "text-emerald-200" };

  return (
    <div className={cn("relative rounded-2xl border bg-[#0a1226]/70 backdrop-blur-xl p-4 overflow-hidden", tokens.border, tokens.glow)}>
      <div
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
        style={{ background: tokens.stroke }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className={cn("text-3xl font-semibold mt-1 tabular-nums", tokens.text)}>{value}</div>
          {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
        </div>
        <div
          className="h-9 w-9 rounded-lg border flex items-center justify-center shrink-0"
          style={{ borderColor: tokens.stroke + "55", background: `radial-gradient(circle at 30% 30%, ${tokens.stroke}22, transparent 70%)` }}
        >
          <Icon className="h-4 w-4" style={{ color: tokens.stroke }} />
        </div>
      </div>
      {pulse && (
        <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
          <div className="h-px w-1/3 animate-[scan-line_3s_linear_infinite]" style={{ background: `linear-gradient(90deg, transparent, ${tokens.stroke}, transparent)` }} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [trackedIds, setTrackedIds] = useState<string[]>(() => getTrackedRuns());

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: async () => { try { return await tdia.listClients(); } catch { return [] as Client[]; } },
    refetchInterval: 30_000,
  });

  const runsQ = useQuery({
    queryKey: ["tracked-runs", trackedIds],
    queryFn: async () => {
      const out: RunWithClient[] = [];
      for (const id of trackedIds) {
        try { const run = await tdia.getRun(id); out.push({ run }); }
        catch { untrackRun(id); }
      }
      setTrackedIds(getTrackedRuns());
      return out;
    },
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!runsQ.data || !clientsQ.data) return;
    const byId = new Map(clientsQ.data.map(c => [c.id, c]));
    for (const r of runsQ.data) r.client = byId.get(r.run.client_id);
  }, [runsQ.data, clientsQ.data]);

  const runs = runsQ.data ?? [];
  const active = runs.filter(r => statusTone(r.run.status) === "running" || statusTone(r.run.status) === "queued").length;
  const review = runs.filter(r => statusTone(r.run.status) === "human_review").length;
  const failed = runs.filter(r => statusTone(r.run.status) === "failed").length;
  const completed = runs.filter(r => statusTone(r.run.status) === "completed").length;

  const err = clientsQ.error instanceof Error ? clientsQ.error.message : undefined;

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}

      {/* Mission header */}
      <div className="relative rounded-2xl border border-white/5 bg-[#0a1226]/60 backdrop-blur-xl px-6 py-5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.1),transparent_60%)] pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Hexagon className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Centre de commandes
              </div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-100 mt-0.5 tracking-tight">Pilotage des audits TDIA</h1>
              <p className="text-xs text-slate-400 mt-0.5">Lancer, surveiller et ouvrir les livrables sans toucher au VPS.</p>
            </div>
          </div>
          <Button asChild className="bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-100">
            <Link to="/admin/ops/new"><Plus className="h-4 w-4 mr-1.5" /> Nouvel audit</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Audits en cours" value={active} accent="cyan" icon={Activity} hint="Run actifs / en file" pulse={active > 0} />
        <KpiCard label="Revue humaine" value={review} accent="amber" icon={AlertTriangle} hint="Décision requise" />
        <KpiCard label="Échecs" value={failed} accent="rose" icon={AlertTriangle} hint="À investiguer" />
        <KpiCard label="Terminés" value={completed} accent="emerald" icon={CheckCircle2} hint="Livrables prêts" />
      </div>

      {/* Runs */}
      <div className="rounded-2xl border border-white/5 bg-[#0a1226]/60 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Runs récents</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">{runs.length} suivi(s)</span>
        </div>
        {runs.length === 0 && (
          <div className="text-sm text-slate-500 py-8 text-center">
            Aucun audit suivi. <Link to="/admin/ops/new" className="text-cyan-300 hover:text-cyan-200 underline">Lancer un audit</Link> pour commencer.
          </div>
        )}
        <div className="space-y-2">
          {runs.map(({ run, client }) => {
            const tone = statusTone(run.status);
            return (
              <Link
                key={run.id}
                to={`/admin/ops/run/${run.id}`}
                className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-400/30 px-4 py-3 transition gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("h-2 w-2 rounded-full", TONE_DOT[tone])} />
                    <span className="font-medium text-sm text-slate-100 truncate">{client?.name ?? run.client_id}</span>
                    <span className={cn("text-[10px] uppercase tracking-wider font-mono", TONE_TEXT[tone])}>
                      {shortStatusLabel(run.status)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">{run.id.slice(0, 8)}… · {timeAgo(run.created_at)}</div>
                  {typeof run.progress === "number" && tone === "running" && (
                    <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden max-w-md">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: `${run.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className={cn("text-xs hidden sm:block max-w-[200px] truncate text-right", TONE_TEXT[tone])}>
                  {humanStatusLabel(run.status)}
                </div>
                <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-cyan-300 shrink-0 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Clients */}
      <div className="rounded-2xl border border-white/5 bg-[#0a1226]/60 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">Clients</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">{(clientsQ.data ?? []).length}</span>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
          {(clientsQ.data ?? []).slice(0, 9).map(c => (
            <Link
              key={c.id}
              to={`/admin/ops/clients/${c.id}`}
              className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-400/30 px-3 py-2.5 transition"
            >
              <div className="font-medium text-sm text-slate-100 truncate">{c.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{c.website ?? c.id}</div>
            </Link>
          ))}
          {(clientsQ.data ?? []).length === 0 && (
            <div className="text-sm text-slate-500 col-span-full py-6 text-center">Aucun client.</div>
          )}
        </div>
      </div>
    </div>
  );
}
