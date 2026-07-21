import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { pickRunId, sanitizeRunId } from "@/agentOps/runId";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { tdia } from "@/agentOps/service";
import { subscribeRunEvents } from "@/agentOps/api";
import type { AgentRun, EngineRun, RunEvent, SupervisorRun, WorkflowRun } from "@/agentOps/types";
import { ENGINE_LABELS } from "@/agentOps/types";
import { BackendErrorBanner, PlaceholderBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { WorkflowGraph } from "@/components/agentOps/WorkflowGraph";
import { StatusBadge, DecisionBadge } from "@/components/agentOps/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LiveEventFeed, LiveFrame, PulseDot, ThinkingIndicator } from "@/components/agentOps/LiveActivity";
import { Progress } from "@/components/ui/progress";

export default function LiveWorkflow() {
  const [params] = useSearchParams();
  const id = sanitizeRunId(params.get("id"));
  const [run, setRun] = useState<WorkflowRun>();
  const [engines, setEngines] = useState<EngineRun[]>([]);
  const [agents, setAgents] = useState<AgentRun[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRun[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [sseStatus, setSseStatus] = useState<"connecting" | "open" | "error">("connecting");
  const [err, setErr] = useState<string>();
  const liveEventsRef = useRef<{ id: string; type: string; data: unknown }[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    if (!id) return;
    import("@/agentOps/trackedRuns").then(m => m.trackRun(id));

    let cancelled = false;
    async function load() {
      const [r, e, a, s, ev] = await Promise.allSettled([
        tdia.getRun(id), tdia.listEngines(id), tdia.listAgents(id),
        tdia.listSupervisors(id), tdia.listEvents(id),
      ]);
      if (cancelled) return;
      const errs: string[] = [];
      if (r.status === "fulfilled") setRun(r.value); else errs.push(`run: ${r.reason?.message ?? r.reason}`);
      if (e.status === "fulfilled") setEngines(e.value); else errs.push(`engines: ${e.reason?.message ?? e.reason}`);
      if (a.status === "fulfilled") setAgents(a.value); else errs.push(`agents: ${a.reason?.message ?? a.reason}`);
      if (s.status === "fulfilled") setSupervisors(s.value); else errs.push(`supervisors: ${s.reason?.message ?? s.reason}`);
      if (ev.status === "fulfilled") setEvents(ev.value); else errs.push(`events: ${ev.reason?.message ?? ev.reason}`);
      setErr(errs.length ? `Backend transient errors (will retry): ${errs.join(" · ")}` : undefined);
    }
    load();
    const stop = subscribeRunEvents(id, {
      onOpen: () => setSseStatus("open"),
      onError: () => setSseStatus("error"),
      onEvent: (ev) => {
        if (!ev.id) return;
        if (liveEventsRef.current.some(x => x.id === ev.id)) return;
        liveEventsRef.current = [...liveEventsRef.current, { id: ev.id, type: ev.type, data: ev.data }].slice(-200);
        force(n => n + 1);
        // Refresh structural data on key events
        if (["engine_started","engine_completed","agent_started","agent_completed","supervisor_decision","artifact_created","workflow_completed","workflow_failed"].includes(ev.type)) {
          load();
        }
      },
    });
    return () => { cancelled = true; stop(); };
  }, [id]);

  if (!id) return <NoRunSelected />;

  const runStatus = (run?.status ?? "").toLowerCase();
  const anyAgentRunning = agents.some(a => (a.status ?? "").toLowerCase() === "running");
  const anyEngineRunning = engines.some(e => (e.status ?? "").toLowerCase() === "running");
  // "Active" only when work is *actually* happening: an engine or agent is running.
  // We deliberately ignore a stale "running"/"queued" run status with no live workers.
  const runActive = anyAgentRunning || anyEngineRunning;
  const runQueued = !runActive && (runStatus === "queued" || runStatus === "pending");
  const allFeedEvents = [
    ...events.map(e => ({ id: String(e.id), type: e.event_type, data: e.data, at: e.created_at })),
    ...liveEventsRef.current.filter(le => !events.some(e => String(e.id) === le.id)).map(le => ({ ...le, at: "" })),
  ];

  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <PlaceholderBanner>This run's agent outputs and PDF are validation placeholders, not a substantive client strategy audit.</PlaceholderBanner>
      <SectionHeader
        title={`Run ${id.slice(0, 8)}…`}
        subtitle={run ? `Client ${run.client_id} · ${run.status} · ${run.progress ?? 0}% · launched ${formatLaunched(run.started_at || run.created_at)}` : "Loading…"}
        right={
          <div className="flex items-center gap-3">
            {runActive
              ? <ThinkingIndicator label={`Agents online (${agents.filter(a => (a.status ?? "").toLowerCase() === "running").length})`} />
              : runQueued
                ? <Badge variant="outline" className="text-[10px] uppercase">Queued · idle</Badge>
                : <Badge variant="outline" className="text-[10px] uppercase">Idle</Badge>}
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              <PulseDot active={sseStatus === "open"} className="mr-1.5" /> SSE {sseStatus}
            </Badge>
          </div>
        }
      />

      {run && typeof run.progress === "number" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>Workflow Progress</span><span>{run.progress}%</span>
          </div>
          <Progress value={run.progress} className="h-1.5" />
        </div>
      )}

      <LiveFrame active={runActive}>
        <Card className="glass-card p-5"><WorkflowGraph workflowRunId={id} engines={engines} /></Card>
      </LiveFrame>

      <LiveEventFeed events={allFeedEvents} sseStatus={sseStatus} />

      <Tabs defaultValue="engines">
        <TabsList><TabsTrigger value="engines">Engines</TabsTrigger><TabsTrigger value="agents">Agents</TabsTrigger><TabsTrigger value="supervisors">Supervisors</TabsTrigger><TabsTrigger value="events">Events</TabsTrigger></TabsList>

        <TabsContent value="engines" className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {engines.map(e => {
            const running = (e.status ?? "").toLowerCase() === "running";
            return (
              <LiveFrame key={e.id} active={running}>
                <Link to={`/admin/ops/engines/${e.id}`} className="block rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/40">
                  <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1.5"><PulseDot active={running} />Engine</span><StatusBadge status={e.status} /></div>
                  <div className="font-medium mt-1.5">{ENGINE_LABELS[e.name] ?? e.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{agents.filter(a => a.engine_run_id === e.id).length} agents</div>
                  {running && <ThinkingIndicator label="Engine active" className="mt-2 text-[10px]" />}
                </Link>
              </LiveFrame>
            );
          })}
        </TabsContent>

        <TabsContent value="agents" className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {agents.map(a => {
            const running = (a.status ?? "").toLowerCase() === "running";
            return (
              <LiveFrame key={a.id} active={running}>
                <Link to={`/admin/ops/agents/${a.id}`} className="block rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/40">
                  <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1.5"><PulseDot active={running} />{a.agent_definition_id}</span><StatusBadge status={a.status} /></div>
                  <div className="text-sm mt-1">{a.safe_summary ?? (running ? "…thinking" : "—")}</div>
                  {running && typeof a.progress === "number" && <Progress value={a.progress} className="h-1 mt-2" />}
                  <div className="text-xs text-muted-foreground mt-1">attempt {a.attempt} · {a.duration_ms ?? 0}ms</div>
                  {running && <ThinkingIndicator label="Processing" className="mt-2 text-[10px]" />}
                </Link>
              </LiveFrame>
            );
          })}
        </TabsContent>

        <TabsContent value="supervisors" className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {supervisors.map(s => (
            <Link key={s.id} to={`/admin/ops/supervisors/${s.id}`} className="block rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/40">
              <div className="flex justify-between"><span className="text-[10px] uppercase text-muted-foreground">{s.rubric_name}</span><DecisionBadge decision={s.decision} /></div>
              <div className="font-medium mt-1.5">{s.name}</div>
              <div className="text-xs text-muted-foreground mt-1">score {s.score ?? "—"} · attempt {s.attempt}</div>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <LiveEventFeed events={allFeedEvents} sseStatus={sseStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoRunSelected() {
  const navigate = useNavigate();
  const [runId, setRunId] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [recent, setRecent] = useState<WorkflowRun[]>([]);
  const [err, setErr] = useState<string>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    tdia.listClients().then((cs) => setClients(cs.map(c => ({ id: c.id, name: c.name })))).catch((e) => setErr((e as Error).message));
    (async () => {
      const { getTrackedRuns, untrackRun } = await import("@/agentOps/trackedRuns");
      const ids = getTrackedRuns();
      const results = await Promise.all(ids.map(async (rid) => {
        try { return await tdia.getRun(rid); } catch { untrackRun(rid); return null; }
      }));
      setRecent(results.filter((r): r is WorkflowRun => !!r)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    })();
  }, []);

  async function startRun(clientId: string) {
    setCreating(true); setErr(undefined);
    try {
      const r = await tdia.createRun(clientId, { workflow: "full-prelaunch", mode: "test", test_mode: "validation" });
      const newId = pickRunId(r);
      if (!newId) throw new Error(`Backend did not return a valid run id (got: ${JSON.stringify(r)})`);
      navigate(`/admin/ops/workflow?id=${newId}`);
    } catch (e) { setErr((e as Error).message); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Live Workflow" subtitle="Select a run or start a new one to see agents in action" />
      {err && <BackendErrorBanner message={err} />}

      {recent.length > 0 && (
        <Card className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent runs</h2>
          <div className="space-y-2">
            {recent.map(r => (
              <Link key={r.id} to={`/admin/ops/workflow?id=${r.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/40 px-4 py-3 hover:border-primary/40">
                <div className="min-w-0">
                  <div className="font-mono text-xs truncate">{r.id}</div>
                  <div className="text-xs text-muted-foreground">
                    Client {r.client_id} · {formatLaunched(r.started_at || r.created_at)}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card className="glass-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Open a run by ID</h2>
        <div className="flex gap-2">
          <Input placeholder="Run ID (uuid)" value={runId} onChange={(e) => setRunId(e.target.value)} />
          <Button onClick={() => runId && navigate(`/admin/ops/workflow?id=${runId.trim()}`)} disabled={!runId.trim()}>Open</Button>
        </div>
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Start a new run for a client</h2>
        {clients.length === 0 && <p className="text-sm text-muted-foreground">No clients available. <Link to="/admin/ops/clients/new" className="text-primary hover:underline">Create one →</Link></p>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
          {clients.map(c => (
            <button key={c.id} onClick={() => startRun(c.id)} disabled={creating} className="text-left rounded-md border border-border/40 bg-card/40 px-4 py-3 hover:border-primary/60 disabled:opacity-50">
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{c.id}</div>
            </button>
          ))}
        </div>
        {creating && <p className="text-xs text-muted-foreground">Creating run…</p>}
      </Card>
    </div>
  );
}

function formatLaunched(iso?: string | null): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "unknown date";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleString();
}



