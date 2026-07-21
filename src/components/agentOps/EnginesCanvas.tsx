import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Code2,
  Compass,
  Globe,
  Lightbulb,
  Map as MapIcon,
  Package,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  durationSince,
  formatDuration,
  shortStatusLabel,
  statusTone,
  type Tone,
} from "@/agentOps/humanStatus";
import {
  ENGINE_LABELS,
  ENGINE_ORDER,
  type AgentRun,
  type EngineRun,
  type SupervisorRun,
} from "@/agentOps/types";

type Accent = "emerald" | "cyan" | "violet" | "amber" | "sky" | "rose" | "fuchsia";

const ENGINE_META: Record<string, { icon: LucideIcon; accent: Accent }> = {
  website_audit: { icon: Globe, accent: "emerald" },
  competitor_intelligence: { icon: Search, accent: "cyan" },
  market_research: { icon: BarChart3, accent: "violet" },
  offer_positioning: { icon: Compass, accent: "amber" },
  creative_strategy: { icon: Lightbulb, accent: "sky" },
  strategic_roadmap: { icon: MapIcon, accent: "rose" },
  final_strategy_pack: { icon: Package, accent: "fuchsia" },
};

const ACCENT: Record<Accent, { stroke: string; glow: string }> = {
  emerald: { stroke: "#34d399", glow: "shadow-[0_0_40px_-10px_rgba(52,211,153,0.6)]" },
  cyan: { stroke: "#22d3ee", glow: "shadow-[0_0_50px_-8px_rgba(34,211,238,0.65)]" },
  violet: { stroke: "#a78bfa", glow: "shadow-[0_0_40px_-10px_rgba(167,139,250,0.55)]" },
  amber: { stroke: "#fbbf24", glow: "shadow-[0_0_40px_-12px_rgba(251,191,36,0.45)]" },
  sky: { stroke: "#38bdf8", glow: "shadow-[0_0_40px_-12px_rgba(56,189,248,0.45)]" },
  rose: { stroke: "#fb7185", glow: "shadow-[0_0_40px_-12px_rgba(251,113,133,0.5)]" },
  fuchsia: { stroke: "#e879f9", glow: "shadow-[0_0_40px_-10px_rgba(232,121,249,0.55)]" },
};

function toneText(tone: Tone) {
  switch (tone) {
    case "completed": return "text-emerald-300";
    case "running": return "text-cyan-300";
    case "human_review": return "text-fuchsia-300";
    case "failed": return "text-rose-300";
    case "warning": return "text-amber-300";
    default: return "text-slate-400";
  }
}
function toneDot(tone: Tone) {
  switch (tone) {
    case "completed": return "bg-emerald-400";
    case "running": return "bg-cyan-400 animate-pulse";
    case "human_review": return "bg-fuchsia-400 animate-pulse";
    case "failed": return "bg-rose-400";
    case "warning": return "bg-amber-400 animate-pulse";
    default: return "bg-slate-500";
  }
}

interface NodeData {
  name: string;
  label: string;
  order: number;
  engine?: EngineRun;
  tone: Tone;
  runningAgents: AgentRun[];
  totalAgents: number;
  lastSupervisor?: SupervisorRun;
  accent: Accent;
  icon: LucideIcon;
}

interface NodeRect { x: number; y: number; w: number; h: number }

function EngineNode({
  data,
  selected,
  onSelect,
}: {
  data: NodeData;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const tokens = ACCENT[data.accent];
  const Icon = data.icon;
  const active = data.tone === "running";
  const completed = data.tone === "completed";
  const pending = data.tone === "queued" || data.tone === "neutral";
  const review = data.tone === "human_review";
  const failed = data.tone === "failed";

  const progress = data.engine && data.totalAgents > 0
    ? Math.round((data.runningAgents.filter((a) => statusTone(a.status) === "completed").length /
        Math.max(1, data.totalAgents)) * 100)
    : undefined;

  const runningAgent = data.runningAgents[0];

  return (
    <motion.button
      data-engine-name={data.name}
      onClick={() => onSelect(data.name)}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: data.order * 0.05 }}
      className={cn(
        "group relative w-[170px] shrink-0 rounded-2xl border bg-[#0c1530]/80 backdrop-blur-xl text-left p-3.5 transition-all",
        "border-white/5",
        active && "border-cyan-400/40 ring-1 ring-cyan-400/30",
        review && "border-fuchsia-400/40 ring-1 ring-fuchsia-400/30",
        failed && "border-rose-400/40 ring-1 ring-rose-400/30",
        completed && "border-emerald-400/20",
        pending && "opacity-70",
        selected && "ring-2 ring-cyan-300/60 border-cyan-400/60",
        (active || review) && tokens.glow,
      )}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#0a1226] border border-white/10 text-[10px] font-mono text-slate-400">
        {String(data.order).padStart(2, "0")}
      </div>

      <div className="text-center mt-0.5">
        <div className="text-[13px] font-medium text-slate-100 leading-tight">{data.label}</div>
      </div>

      <div className="relative mx-auto my-3 h-14 w-14 rounded-full flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border" style={{ borderColor: tokens.stroke + "55" }} />
        {(active || review) && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 24px 2px ${tokens.stroke}55, inset 0 0 16px ${tokens.stroke}33` }}
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-[-5px] rounded-full border"
              style={{ borderColor: tokens.stroke + "33" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            />
          </>
        )}
        <div
          className="relative h-10 w-10 rounded-full flex items-center justify-center"
          style={{ background: `radial-gradient(circle at 50% 40%, ${tokens.stroke}33, transparent 70%)` }}
        >
          <Icon className="h-5 w-5" style={{ color: tokens.stroke }} />
        </div>
      </div>

      <div className="text-center">
        <div className={cn("flex items-center justify-center gap-1.5 text-[11px] font-medium", toneText(data.tone))}>
          <span className={cn("h-1.5 w-1.5 rounded-full", toneDot(data.tone))} />
          {shortStatusLabel(data.engine?.status ?? "queued")}
        </div>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-white/5 min-h-[34px]">
        <div className="text-[11px] text-slate-400 text-center truncate">
          {runningAgent?.safe_summary ??
            (completed
              ? data.lastSupervisor?.decision === "PASS"
                ? "Validé"
                : "Terminé"
              : pending
              ? "En attente"
              : review
              ? "Revue humaine"
              : failed
              ? "Échec"
              : "…")}
        </div>
        {typeof progress === "number" && progress > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full"
                style={{ background: tokens.stroke }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1 }}
              />
            </div>
            <span className="text-[10px] font-mono" style={{ color: tokens.stroke }}>{progress}%</span>
          </div>
        )}
      </div>

      {active && (
        <motion.div
          className="pointer-events-none absolute inset-x-2 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${tokens.stroke}, transparent)` }}
          initial={{ top: "10%", opacity: 0 }}
          animate={{ top: ["10%", "90%", "10%"], opacity: [0, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}

function ConnectionLayer({ rects, nodes }: { rects: NodeRect[]; nodes: NodeData[] }) {
  if (rects.length < 2) return null;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="ec-flow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      {rects.slice(0, -1).map((a, i) => {
        const b = rects[i + 1];
        const nextNode = nodes[i + 1];
        if (!a || !b || !nextNode) return null;
        const startX = a.x + a.w;
        const startY = a.y + a.h / 2;
        const endX = b.x;
        const endY = b.y + b.h / 2;
        const midX = (startX + endX) / 2;
        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
        const toTone = nextNode.tone;
        const active = toTone === "running";
        const completed = toTone === "completed";
        const review = toTone === "human_review";
        const baseColor = review
          ? "rgba(232,121,249,0.4)"
          : active
          ? "rgba(34,211,238,0.35)"
          : completed
          ? "rgba(52,211,153,0.3)"
          : "rgba(148,163,184,0.18)";
        return (
          <g key={i}>
            <path d={path} stroke={baseColor} strokeWidth={1.2} fill="none" strokeDasharray={active || review ? "4 4" : undefined} />
            {active && (
              <>
                <path d={path} stroke="url(#ec-flow)" strokeWidth={2.5} fill="none" />
                <motion.circle r={3} fill="#22d3ee" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
                </motion.circle>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface EnginesCanvasProps {
  engines: EngineRun[];
  agents: AgentRun[];
  supervisors: SupervisorRun[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  visibleNames?: string[];
}

export function EnginesCanvas({ engines, agents, supervisors, selectedName, onSelect, visibleNames }: EnginesCanvasProps) {
  const byName = new Map(engines.map((e) => [e.name, e]));

  const orderedNames = visibleNames && visibleNames.length > 0
    ? ENGINE_ORDER.filter((n) => visibleNames.includes(n))
    : ENGINE_ORDER;

  const nodes: NodeData[] = orderedNames.map((name) => {
    const eng = byName.get(name);
    const tone = statusTone(eng?.status);
    const engineAgents = eng ? agents.filter((a) => a.engine_run_id === eng.id) : [];
    const runningAgents = engineAgents.filter((a) => statusTone(a.status) === "running");
    const meta = ENGINE_META[name] ?? { icon: Sparkles, accent: "cyan" as Accent };
    return {
      name,
      label: ENGINE_LABELS[name] ?? name,
      order: ENGINE_ORDER.indexOf(name) + 1,
      engine: eng,
      tone,
      runningAgents,
      totalAgents: engineAgents.length,
      lastSupervisor: supervisors.find((s) => s.target_stage === name),
      accent: meta.accent,
      icon: meta.icon,
    };
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<NodeRect[]>([]);

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const next: NodeRect[] = [];
      el.querySelectorAll<HTMLElement>("[data-engine-name]").forEach((n) => {
        const r = n.getBoundingClientRect();
        next.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
      });
      setRects(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [engines.length, nodes.length]);

  return (
    <div className="relative rounded-2xl border border-white/5 bg-[#070e22]/60 backdrop-blur-xl overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.25) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.08),transparent_60%)] pointer-events-none" />

      <div ref={containerRef} className="relative px-6 py-8 overflow-x-auto">
        <ConnectionLayer rects={rects} nodes={nodes} />
        <div className="relative flex items-start gap-3 min-w-max">
          {nodes.map((n) => (
            <EngineNode key={n.name} data={n} selected={selectedName === n.name} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Side details panel for a selected engine */
export function EngineDetailsPanel({
  engineName,
  engines,
  agents,
  supervisors,
  onClose,
}: {
  engineName: string;
  engines: EngineRun[];
  agents: AgentRun[];
  supervisors: SupervisorRun[];
  onClose: () => void;
}) {
  const engine = engines.find((e) => e.name === engineName);
  const tone = statusTone(engine?.status);
  const engineAgents = engine ? agents.filter((a) => a.engine_run_id === engine.id) : [];
  const lastSup = supervisors.find((s) => s.target_stage === engineName);
  const meta = ENGINE_META[engineName] ?? { icon: Sparkles, accent: "cyan" as Accent };
  const tokens = ACCENT[meta.accent];
  const Icon = meta.icon;
  const duration = engine?.started_at ? durationSince(engine.started_at, engine.completed_at ?? undefined) : "—";

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a1226]/70 backdrop-blur-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Engine sélectionné</div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xs">Fermer</button>
      </div>
      <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5">
        <div
          className="h-12 w-12 rounded-xl border flex items-center justify-center"
          style={{ borderColor: tokens.stroke + "55", background: `radial-gradient(circle at 30% 30%, ${tokens.stroke}22, transparent 70%)` }}
        >
          <Icon className="h-5 w-5" style={{ color: tokens.stroke }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-100 truncate">{ENGINE_LABELS[engineName] ?? engineName}</div>
          <div className={cn("text-[11px] flex items-center gap-1.5 mt-0.5", toneText(tone))}>
            <span className={cn("h-1.5 w-1.5 rounded-full", toneDot(tone))} />
            {shortStatusLabel(engine?.status ?? "queued")} · {duration}
          </div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Agents ({engineAgents.length})
          </div>
          {engineAgents.length === 0 && <div className="text-slate-500">Aucun agent associé.</div>}
          <div className="space-y-1.5">
            {engineAgents.slice(0, 8).map((a) => {
              const t = statusTone(a.status);
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", toneDot(t))} />
                  <span className="font-mono text-[11px] text-slate-300 truncate">{a.agent_definition_id}</span>
                  {typeof a.progress === "number" && (
                    <span className="ml-auto text-[10px] font-mono text-cyan-300">{Math.round(a.progress)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {lastSup && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Code2 className="h-3 w-3" /> Superviseur
            </div>
            <div className="text-slate-300">
              {lastSup.name} · <span className="font-mono">{lastSup.decision}</span>
              {lastSup.score != null && <span className="ml-1 text-slate-500">({lastSup.score.toFixed(2)})</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
