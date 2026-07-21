import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import { proxyUrl } from "@/agentOps/api";
import { trackRun } from "@/agentOps/trackedRuns";
import type { AgentRun, Artifact, EngineRun, RunEvent, SupervisorRun, WorkflowRun } from "@/agentOps/types";
import { ENGINE_ORDER, ENGINE_LABELS } from "@/agentOps/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { EnginesCanvas, EngineDetailsPanel } from "@/components/agentOps/EnginesCanvas";
import {
  durationSince,
  formatDuration,
  humanStatusLabel,
  isTerminal,
  shortStatusLabel,
  statusTone,
  timeAgo,
  toneClasses,
  toneDotClass,
} from "@/agentOps/humanStatus";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  RefreshCw,
  Target,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function RunMonitor() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);

  useEffect(() => { if (id) trackRun(id); }, [id]);

  const safeFetch = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const runQ = useQuery({
    queryKey: ["run", id],
    queryFn: async () => {
      const r = await tdia.getRun(id);
      setLastUpdate(Date.now());
      return r;
    },
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const status = (q.state.data as WorkflowRun | undefined)?.status;
      return isTerminal(status) ? false : 3000;
    },
    retry: 1,
  });

  const polling = !isTerminal(runQ.data?.status);

  const enginesQ = useQuery({
    queryKey: ["engines", id],
    queryFn: () => safeFetch(() => tdia.listEngines(id), [] as EngineRun[]),
    enabled: Boolean(id),
    refetchInterval: polling ? 4000 : false,
  });
  const agentsQ = useQuery({
    queryKey: ["agents", id],
    queryFn: () => safeFetch(() => tdia.listAgents(id), [] as AgentRun[]),
    enabled: Boolean(id),
    refetchInterval: polling ? 4000 : false,
  });
  const supsQ = useQuery({
    queryKey: ["supervisors", id],
    queryFn: () => safeFetch(() => tdia.listSupervisors(id), [] as SupervisorRun[]),
    enabled: Boolean(id),
    refetchInterval: polling ? 4000 : false,
  });
  const eventsQ = useQuery({
    queryKey: ["events", id],
    queryFn: () => safeFetch(() => tdia.listEvents(id), [] as RunEvent[]),
    enabled: Boolean(id),
    refetchInterval: polling ? 5000 : false,
  });
  const artifactsQ = useQuery({
    queryKey: ["artifacts", id],
    queryFn: () => safeFetch(() => tdia.listArtifacts(id), [] as Artifact[]),
    enabled: Boolean(id),
    refetchInterval: polling ? 8000 : 30_000,
  });

  const run = runQ.data;
  const engines = enginesQ.data ?? [];
  const agents = agentsQ.data ?? [];
  const supervisors = supsQ.data ?? [];
  const events = eventsQ.data ?? [];
  const artifacts = artifactsQ.data ?? [];

  // Ticker for "updated X seconds ago"
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["run", id] });
    qc.invalidateQueries({ queryKey: ["engines", id] });
    qc.invalidateQueries({ queryKey: ["agents", id] });
    qc.invalidateQueries({ queryKey: ["supervisors", id] });
    qc.invalidateQueries({ queryKey: ["events", id] });
    qc.invalidateQueries({ queryKey: ["artifacts", id] });
  }

  if (runQ.isLoading && !run) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-2/3 rounded bg-card/40 animate-pulse" />
        <div className="h-24 rounded bg-card/40 animate-pulse" />
        <div className="h-64 rounded bg-card/40 animate-pulse" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => nav("/admin/ops")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
        </Button>
        <BackendErrorBanner message={runQ.error instanceof Error ? runQ.error.message : "Run introuvable."} />
      </div>
    );
  }

  const tone = statusTone(run.status);
  const elapsed = durationSince(run.started_at ?? run.created_at, run.completed_at ?? undefined);

  const pdfHref = proxyUrl(`/api/v1/runs/${run.id}/final-pdf`);
  const htmlArtifact = artifacts.find(a =>
    /final.*(html|pack)/i.test(`${a.kind} ${a.title}`) && (a.media_type?.includes("html") || /\.html$/i.test(a.path ?? ""))
  );
  const htmlHref = htmlArtifact ? proxyUrl(`/api/artifacts/${htmlArtifact.id}/download`) : proxyUrl(`/api/v1/runs/${run.id}/final-html`);

  return (
    <div className="space-y-5">
      {/* === Mission Header === */}
      <div className="relative rounded-2xl border border-white/5 bg-[#0a1226]/60 backdrop-blur-xl overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.1),transparent_60%)] pointer-events-none" />
        <div className="relative px-5 py-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={() => nav("/admin/ops")}
            className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-cyan-300">
              <span className={cn("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
              {humanStatusLabel(run.status)}
            </div>
            <div className="text-lg md:text-xl font-semibold text-slate-100 mt-0.5 tracking-tight truncate">
              Audit {run.client_id}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
              <span>{run.id.slice(0, 8)}…</span>
              <button onClick={() => navigator.clipboard.writeText(run.id)} className="hover:text-cyan-300" title="Copier le Run ID">
                <Copy className="h-3 w-3" />
              </button>
              <span>·</span>
              <span>{timeAgo(run.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {typeof run.progress === "number" && (
              <div className="px-4 py-2 rounded-xl border border-white/5 bg-white/[0.02] min-w-[14rem]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Progression globale</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 transition-[width] duration-700"
                      style={{ width: `${run.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-cyan-300">{Math.round(run.progress)}%</span>
                </div>
              </div>
            )}
            <div className="px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Durée</div>
              <div className="text-sm font-mono text-slate-100 mt-0.5">{elapsed}</div>
            </div>
            <div className="px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1"><Target className="h-3 w-3" /> MAJ</div>
              <div className="text-sm font-mono text-slate-100 mt-0.5">il y a {Math.floor((Date.now() - lastUpdate) / 1000)}s</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
            >
              <RefreshCw className={cn("h-4 w-4 mr-1.5", runQ.isFetching && "animate-spin")} />
              Rafraîchir
            </Button>
          </div>
        </div>
      </div>

      {/* Completed CTA */}
      {tone === "completed" && (
        <Card className="glass-card p-5 border-emerald-500/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Audit terminé</div>
              <div className="text-sm text-muted-foreground mt-0.5">Les livrables sont disponibles.</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button asChild>
                  <a href={pdfHref} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4 mr-1.5" /> Ouvrir le PDF
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={htmlHref} target="_blank" rel="noreferrer">
                    <Globe className="h-4 w-4 mr-1.5" /> Ouvrir le HTML
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={pdfHref} download>
                    <Download className="h-4 w-4 mr-1.5" /> Télécharger le PDF
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Human review */}
      {tone === "human_review" && (
        <HumanReviewCard run={run} engines={engines} supervisors={supervisors} />
      )}

      {/* Failed */}
      {tone === "failed" && (
        <FailureCard run={run} engines={engines} agents={agents} events={events} />
      )}

      {/* ====== Pipeline (futuristic canvas) ====== */}
      <PipelineSection
        engines={engines}
        agents={agents}
        supervisors={supervisors}
        events={events}
        tone={tone}
        selectedEngine={selectedEngine}
        setSelectedEngine={setSelectedEngine}
      />


      {/* ====== STATISTIQUES & LIVRABLES (zone séparée) ====== */}
      <section className="space-y-4">
        <SectionDivider label="Statistiques & livrables" sub="Synthèse non-live · agents, superviseurs, fichiers produits" />
        <StatsStrip agents={agents} supervisors={supervisors} artifacts={artifacts} />
        <Card className="glass-card p-5">
          <Tabs defaultValue="agents">
            <TabsList>
              <TabsTrigger value="agents">Agents ({agents.length})</TabsTrigger>
              <TabsTrigger value="supervisors">Superviseurs ({supervisors.length})</TabsTrigger>
              <TabsTrigger value="artifacts">Livrables</TabsTrigger>
            </TabsList>
            <TabsContent value="agents" className="mt-4">
              <AgentsTable agents={agents} engines={engines} />
            </TabsContent>
            <TabsContent value="supervisors" className="mt-4">
              <SupervisorsTable supervisors={supervisors} />
            </TabsContent>
            <TabsContent value="artifacts" className="mt-4">
              <ArtifactsPanel artifacts={artifacts} runId={run.id} />
            </TabsContent>
          </Tabs>
        </Card>
      </section>

      {/* Technical details */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
          Détails techniques
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <Card className="glass-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Run (JSON)</div>
            <pre className="text-[11px] overflow-x-auto bg-background/40 rounded p-3 max-h-64">{JSON.stringify(run, null, 2)}</pre>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Events ({events.length})</div>
            <div className="space-y-1 max-h-64 overflow-y-auto text-[11px] font-mono">
              {events.slice(-50).reverse().map(e => (
                <div key={e.id} className="flex gap-2 border-b border-border/20 py-1">
                  <span className="text-muted-foreground shrink-0">{timeAgo(e.created_at)}</span>
                  <span className="text-primary">{e.event_type}</span>
                  <span className="truncate text-foreground/70">{JSON.stringify(e.data).slice(0, 200)}</span>
                </div>
              ))}
              {events.length === 0 && <div className="text-muted-foreground">Aucun event.</div>}
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ============================== Pipeline Section ============================== */

function PipelineSection({
  engines,
  agents,
  supervisors,
  events,
  tone,
  selectedEngine,
  setSelectedEngine,
}: {
  engines: EngineRun[];
  agents: AgentRun[];
  supervisors: SupervisorRun[];
  events: RunEvent[];
  tone: ReturnType<typeof statusTone>;
  selectedEngine: string | null;
  setSelectedEngine: (fn: (cur: string | null) => string | null) => void;
}) {
  const isLive = tone === "running" || tone === "queued";
  const [showAll, setShowAll] = useState(!isLive);

  useEffect(() => {
    setShowAll(!isLive);
  }, [isLive]);

  // Active engine = first running, else first queued
  const activeEngine =
    engines.find((e) => statusTone(e.status) === "running") ??
    engines.find((e) => statusTone(e.status) === "queued");

  const visibleNames = isLive && !showAll && activeEngine ? [activeEngine.name] : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inset-0 rounded-full bg-sky-400/70 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_hsl(200_90%_60%)]" />
              </span>
            )}
            <h2 className={cn("text-xs font-semibold uppercase tracking-[0.25em]", isLive ? "text-sky-300" : "text-muted-foreground")}>
              {isLive ? (showAll ? "Pipeline · vue complète" : "Pipeline en cours") : "Pipeline"}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isLive
              ? showAll
                ? "Tous les moteurs du workflow TDIA."
                : `Focus sur le moteur actuellement en exécution${activeEngine ? ` · ${activeEngine.name}` : ""}.`
              : "Workflow orchestré par 7 moteurs spécialisés."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && activeEngine && (
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
      </div>

      {isLive && (
        <NowWorkingPanel engines={engines} agents={agents} supervisors={supervisors} events={events} />
      )}

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
            onClose={() => setSelectedEngine(() => null)}
          />
        )}
      </div>
    </section>
  );
}



function NowWorkingPanel({ engines, agents, supervisors, events }: { engines: EngineRun[]; agents: AgentRun[]; supervisors: SupervisorRun[]; events: RunEvent[] }) {
  const currentEngine = engines.find(e => statusTone(e.status) === "running")
    ?? engines.find(e => statusTone(e.status) === "queued");
  const currentAgent = agents.find(a => statusTone(a.status) === "running");
  const currentSup = supervisors.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
  const lastEvent = events.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];

  return (
    <Card className="glass-card p-5 border-sky-500/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">En cours maintenant</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <Field label="Engine" value={currentEngine ? ENGINE_LABELS[currentEngine.name] ?? currentEngine.name : "—"} />
        <Field label="Agent" value={currentAgent?.agent_definition_id ?? "—"} />
        <Field
          label="Activité agent"
          value={currentAgent?.safe_summary ?? (currentAgent ? "…en cours" : "—")}
          progress={currentAgent?.progress ?? undefined}
        />
        <Field label="Superviseur" value={currentSup ? `${currentSup.name} · ${currentSup.decision}` : "—"} />
      </div>
      {lastEvent && (
        <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
          <span className="text-foreground/80">Dernier event :</span>{" "}
          <span className="font-mono text-primary">{lastEvent.event_type}</span>
          <span className="ml-2">{timeAgo(lastEvent.created_at)}</span>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
      {typeof progress === "number" && <Progress value={progress} className="h-1 mt-1.5" />}
    </div>
  );
}

function SectionDivider({ label, sub, live }: { label: string; sub?: string; live?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2">
      <div>
        <div className="flex items-center gap-2">
          {live && (
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-sky-400/70 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_hsl(200_90%_60%)]" />
            </span>
          )}
          <h2 className={cn("text-xs font-semibold uppercase tracking-[0.25em]", live ? "text-sky-300" : "text-muted-foreground")}>{label}</h2>
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-4 mb-2" />
    </div>
  );
}

function StatsStrip({ agents, supervisors, artifacts }: { agents: AgentRun[]; supervisors: SupervisorRun[]; artifacts: Artifact[] }) {
  const running = agents.filter(a => statusTone(a.status) === "running").length;
  const done = agents.filter(a => statusTone(a.status) === "completed").length;
  const pass = supervisors.filter(s => s.decision === "PASS").length;
  const fail = supervisors.filter(s => s.decision === "FAIL").length;
  const hr = supervisors.filter(s => s.decision === "HUMAN_REVIEW").length;
  const deliverables = artifacts.filter(a => USEFUL_ARTIFACT_PATTERNS.some(rx => rx.test(`${a.kind} ${a.title} ${a.path ?? ""}`))).length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Agents" main={`${agents.length}`} hint={`${running} en cours · ${done} terminés`} />
      <StatCard label="Superviseurs" main={`${supervisors.length}`} hint={`${pass} PASS · ${fail} FAIL${hr ? ` · ${hr} HR` : ""}`} />
      <StatCard label="Livrables clés" main={`${deliverables}`} hint={`${artifacts.length} artifacts au total`} />
      <StatCard label="Engines" main={`7`} hint="Pipeline standard TDIA" />
    </div>
  );
}

function StatCard({ label, main, hint }: { label: string; main: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-0.5 tabular-nums">{main}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

function AgentEntity({ a }: { a: AgentRun }) {
  const initials = (a.agent_definition_id ?? "??").split(/[-_ ]/).map(s => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative flex items-center gap-3 rounded-md border border-sky-500/40 bg-gradient-to-br from-sky-500/[0.08] via-card/40 to-purple-500/[0.06] p-3 overflow-hidden animate-pulse-glow">
      {/* scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -inset-x-1/2 w-1/2 bg-gradient-to-r from-transparent via-sky-400/20 to-transparent blur-md animate-scan-line" />
      </div>
      {/* orbiting avatar */}
      <div className="relative h-10 w-10 shrink-0">
        <span className="absolute inset-0 rounded-full border border-sky-400/30" />
        <span className="absolute inset-0 rounded-full border-t-2 border-sky-400 animate-orbit" />
        <span className="absolute inset-1 rounded-full bg-sky-500/20 backdrop-blur flex items-center justify-center font-mono text-[10px] text-sky-200 tracking-wider">
          {initials}
        </span>
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-sky-200 truncate">{a.agent_definition_id}</span>
          <span className="text-[9px] uppercase font-mono text-sky-300/80 animate-blink">● live</span>
        </div>
        <div className="text-xs text-foreground/85 truncate mt-0.5">{a.safe_summary ?? "…analyse en cours"}</div>
        {typeof a.progress === "number" && <Progress value={a.progress} className="h-0.5 mt-1.5" />}
      </div>
    </div>
  );
}

function EnginesTimeline({ engines, agents, supervisors, live }: { engines: EngineRun[]; agents: AgentRun[]; supervisors: SupervisorRun[]; live?: boolean }) {
  const byName = useMemo(() => {
    const map = new Map<string, EngineRun>();
    for (const e of engines) map.set(e.name, e);
    return map;
  }, [engines]);

  return (
    <div className="space-y-2">
      {ENGINE_ORDER.map((name, idx) => {
        const e = byName.get(name);
        const status = e?.status ?? "queued";
        const tone = statusTone(status);
        const isRunning = tone === "running";
        const engineAgents = e ? agents.filter(a => a.engine_run_id === e.id) : [];
        const runningAgents = engineAgents.filter(a => statusTone(a.status) === "running");
        const engineSups = e ? supervisors.filter(s => s.target_stage === name) : [];
        const lastSup = engineSups[0];
        const duration = e?.started_at ? durationSince(e.started_at, e.completed_at ?? undefined) : "—";

        return (
          <Collapsible key={name} defaultOpen={live && isRunning}>
            <div className={cn(
              "rounded-md border bg-card/40 relative overflow-hidden",
              isRunning ? "border-sky-500/50 animate-pulse-glow" : "border-border/40"
            )}>
              {isRunning && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute inset-y-0 -inset-x-1/2 w-1/2 bg-gradient-to-r from-transparent via-sky-400/15 to-transparent blur-md animate-scan-line" />
                </div>
              )}
              <CollapsibleTrigger className="relative w-full flex items-center gap-3 p-3 hover:bg-card/60 transition text-left">
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-90 shrink-0" />
                <span className="text-[10px] text-muted-foreground font-mono w-6">{String(idx + 1).padStart(2, "0")}</span>
                <span className={cn("h-2 w-2 rounded-full shrink-0", toneDotClass(tone), isRunning && "animate-pulse shadow-[0_0_10px_hsl(200_90%_60%)]")} />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-medium text-sm truncate", isRunning && "text-sky-200")}>{ENGINE_LABELS[name] ?? name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>{shortStatusLabel(status)}</span>
                    {e?.started_at && <span>· démarré {timeAgo(e.started_at)}</span>}
                    {duration !== "—" && <span>· {duration}</span>}
                    {lastSup?.decision && <span>· verdict {lastSup.decision}{lastSup.score != null ? ` (${lastSup.score})` : ""}</span>}
                    {isRunning && runningAgents.length > 0 && <span className="text-sky-300">· {runningAgents.length} agent(s) en activité</span>}
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-[10px] uppercase shrink-0", toneClasses(tone))}>{shortStatusLabel(status)}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="relative px-4 pb-3 pt-1 text-xs space-y-2 border-t border-border/30">
                  {/* Live agent entities first */}
                  {live && runningAgents.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {runningAgents.map(a => <AgentEntity key={a.id} a={a} />)}
                    </div>
                  )}
                  {/* Other agents compact list */}
                  {engineAgents.filter(a => !runningAgents.includes(a)).map(a => {
                    const at = statusTone(a.status);
                    return (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", toneDotClass(at))} />
                        <span className="font-mono text-[11px] text-muted-foreground w-32 truncate">{a.agent_definition_id}</span>
                        <span className="flex-1 truncate">{a.safe_summary ?? "—"}</span>
                        <Badge variant="outline" className={cn("text-[9px]", toneClasses(at))}>{shortStatusLabel(a.status)}</Badge>
                      </div>
                    );
                  })}
                  {engineAgents.length === 0 && <div className="text-muted-foreground">Aucun agent associé.</div>}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

function AgentsTable({ agents, engines }: { agents: AgentRun[]; engines: EngineRun[] }) {
  const byId = useMemo(() => new Map(engines.map(e => [e.id, e.name])), [engines]);
  if (agents.length === 0) return <div className="text-sm text-muted-foreground py-6 text-center">Aucun agent.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
          <tr>
            <th className="text-left py-2 pr-3">Agent</th>
            <th className="text-left py-2 pr-3">Engine</th>
            <th className="text-left py-2 pr-3">Statut</th>
            <th className="text-left py-2 pr-3">Prog.</th>
            <th className="text-left py-2 pr-3">Activité</th>
            <th className="text-left py-2 pr-3">Try</th>
            <th className="text-left py-2 pr-3">Durée</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(a => {
            const tone = statusTone(a.status);
            return (
              <tr key={a.id} className="border-b border-border/20 hover:bg-card/40">
                <td className="py-2 pr-3 font-mono text-[11px]">{a.agent_definition_id}</td>
                <td className="py-2 pr-3 text-muted-foreground">{byId.get(a.engine_run_id) ?? "—"}</td>
                <td className="py-2 pr-3"><Badge variant="outline" className={cn("text-[9px] uppercase", toneClasses(tone))}>{shortStatusLabel(a.status)}</Badge></td>
                <td className="py-2 pr-3">{a.progress != null ? `${Math.round(a.progress)}%` : "—"}</td>
                <td className="py-2 pr-3 max-w-[280px] truncate">{a.safe_summary ?? "—"}</td>
                <td className="py-2 pr-3">{a.attempt}</td>
                <td className="py-2 pr-3">{a.duration_ms != null ? formatDuration(a.duration_ms) : (a.started_at ? durationSince(a.started_at, a.completed_at ?? undefined) : "—")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SupervisorsTable({ supervisors }: { supervisors: SupervisorRun[] }) {
  if (supervisors.length === 0) return <div className="text-sm text-muted-foreground py-6 text-center">Aucun superviseur.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
          <tr>
            <th className="text-left py-2 pr-3">Superviseur</th>
            <th className="text-left py-2 pr-3">Stage</th>
            <th className="text-left py-2 pr-3">Décision</th>
            <th className="text-left py-2 pr-3">Score</th>
            <th className="text-left py-2 pr-3">Try</th>
            <th className="text-left py-2 pr-3">Mis à jour</th>
          </tr>
        </thead>
        <tbody>
          {supervisors.map(s => {
            const isHR = s.decision === "HUMAN_REVIEW";
            const isFail = s.decision === "FAIL";
            return (
              <tr key={s.id} className="border-b border-border/20 hover:bg-card/40">
                <td className="py-2 pr-3 font-medium">{s.name}</td>
                <td className="py-2 pr-3 text-muted-foreground">{s.target_stage ?? "—"}</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className={cn(
                    "text-[9px] uppercase",
                    isHR ? "bg-orange-500/15 text-orange-300 border-orange-500/30" :
                    isFail ? "bg-red-500/15 text-red-300 border-red-500/30" :
                    s.decision === "PASS" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
                    "bg-secondary text-foreground/80 border-border/40"
                  )}>{s.decision}</Badge>
                </td>
                <td className="py-2 pr-3">{s.score != null ? s.score.toFixed(2) : "—"}</td>
                <td className="py-2 pr-3">{s.attempt}</td>
                <td className="py-2 pr-3 text-muted-foreground">{timeAgo(s.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const USEFUL_ARTIFACT_PATTERNS = [
  /final.*pack.*pdf/i,
  /final.*pack.*html/i,
  /final.*pack.*json/i,
  /execution.*depth/i,
  /real.*content.*integrity/i,
  /pdf.*design.*qa/i,
  /editorial.*qa/i,
];

function ArtifactsPanel({ artifacts, runId }: { artifacts: Artifact[]; runId: string }) {
  const [showAll, setShowAll] = useState(false);
  const useful = artifacts.filter(a =>
    USEFUL_ARTIFACT_PATTERNS.some(rx => rx.test(`${a.kind} ${a.title} ${a.path ?? ""}`))
  );
  const list = showAll ? artifacts : useful;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">{useful.length} livrable(s) clé(s) · {artifacts.length} total</div>
        <Button variant="ghost" size="sm" onClick={() => setShowAll(s => !s)}>
          {showAll ? "Masquer artifacts techniques" : "Afficher artifacts techniques"}
        </Button>
      </div>
      {list.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Aucun livrable encore.</div>}
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map(a => (
          <a
            key={a.id}
            href={proxyUrl(`/api/artifacts/${a.id}/download`)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2 hover:border-primary/40 transition"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{a.title || a.kind}</div>
              <div className="text-[11px] text-muted-foreground truncate">{a.kind}{a.media_type ? ` · ${a.media_type}` : ""}</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>
      <div className="pt-2 text-xs">
        <Link to={`/admin/ops/pdf?id=${runId}`} className="text-primary hover:underline">Ouvrir le PDF Viewer →</Link>
      </div>
    </div>
  );
}

function HumanReviewCard({ run, engines, supervisors }: { run: WorkflowRun; engines: EngineRun[]; supervisors: SupervisorRun[] }) {
  const hrSup = supervisors.find(s => s.decision === "HUMAN_REVIEW") ?? supervisors[0];
  const blockingEngine = engines.find(e => statusTone(e.status) === "human_review")
    ?? engines.find(e => e.name === hrSup?.target_stage);
  return (
    <Card className="glass-card p-5 border-orange-500/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-orange-200">Intervention humaine requise</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            Le run est en pause en attente d'une décision humaine.
          </div>
          <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Engine bloquant" value={blockingEngine ? (ENGINE_LABELS[blockingEngine.name] ?? blockingEngine.name) : "—"} />
            <Field label="Superviseur" value={hrSup?.name ?? "—"} />
          </div>
          {hrSup?.evidence && hrSup.evidence.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Raisons / evidence</div>
              <ul className="list-disc ml-5 space-y-0.5 text-foreground/80">
                {hrSup.evidence.slice(0, 6).map((ev, i) => <li key={i} className="truncate">{String(ev)}</li>)}
              </ul>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground mt-3 font-mono">Run {run.id}</div>
        </div>
      </div>
    </Card>
  );
}

function FailureCard({ run, engines, agents, events }: { run: WorkflowRun; engines: EngineRun[]; agents: AgentRun[]; events: RunEvent[] }) {
  const failedEngine = engines.find(e => statusTone(e.status) === "failed");
  const failedAgent = agents.find(a => statusTone(a.status) === "failed");
  const lastEvents = events.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 5);
  const errMsg = (lastEvents.find(e => /fail|error/i.test(e.event_type))?.data as { message?: string } | undefined)?.message
    ?? failedAgent?.safe_summary
    ?? "Erreur non spécifiée.";
  return (
    <Card className="glass-card p-5 border-red-500/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-red-200">Le run a échoué</div>
          <div className="text-sm text-muted-foreground mt-0.5 break-words">{errMsg}</div>
          <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Engine concerné" value={failedEngine ? (ENGINE_LABELS[failedEngine.name] ?? failedEngine.name) : "—"} />
            <Field label="Agent concerné" value={failedAgent?.agent_definition_id ?? "—"} />
          </div>
          {lastEvents.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Derniers events</div>
              <div className="space-y-1 font-mono text-[11px]">
                {lastEvents.map(e => (
                  <div key={e.id} className="flex gap-2">
                    <span className="text-muted-foreground">{timeAgo(e.created_at)}</span>
                    <span className="text-primary">{e.event_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground mt-3 font-mono">Run {run.id}</div>
        </div>
      </div>
    </Card>
  );
}
