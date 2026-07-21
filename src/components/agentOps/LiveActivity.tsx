import { cn } from "@/lib/utils";
import { Activity, Cpu, Radio, Sparkles } from "lucide-react";

/** A glowing dot that pulses when an agent/engine is actively running. */
export function PulseDot({ active, className }: { active?: boolean; className?: string }) {
  if (!active) {
    return <span className={cn("inline-block h-2 w-2 rounded-full bg-muted-foreground/40", className)} />;
  }
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)}>
      <span className="absolute inset-0 rounded-full bg-sky-400/70 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_hsl(200_90%_60%)]" />
    </span>
  );
}

/** Shimmering scan-line overlay for cards that represent a running agent. */
export function ScanlineOverlay({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-y-0 -inset-x-1/2 w-1/2 bg-gradient-to-r from-transparent via-primary/25 to-transparent blur-md animate-scan-line" />
    </div>
  );
}

/** Wrap a card to give it a "live" Jarvis-style glowing border when running. */
export function LiveFrame({ active, children, className }: { active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-xl", active && "animate-pulse-glow border border-primary/40", className)}>
      {children}
      <ScanlineOverlay active={active} />
    </div>
  );
}

interface FeedItem { id: string; type: string; data: unknown; at?: string }

/** Jarvis-style live event ticker that streams agent telemetry. */
export function LiveEventFeed({ events, sseStatus }: { events: FeedItem[]; sseStatus?: "connecting" | "open" | "error" }) {
  const recent = events.slice(-40).reverse();
  return (
    <div className="relative rounded-xl border border-primary/30 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur p-4 overflow-hidden">
      <ScanlineOverlay active={sseStatus === "open"} />
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <Radio className={cn("h-4 w-4", sseStatus === "open" ? "text-sky-400 animate-pulse" : "text-muted-foreground")} />
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary/90">Live Telemetry</span>
          <PulseDot active={sseStatus === "open"} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {sseStatus === "open" ? "STREAMING" : sseStatus === "error" ? "OFFLINE" : "CONNECTING…"}
        </span>
      </div>
      <div className="relative max-h-72 overflow-auto space-y-1.5 font-mono text-xs">
        {recent.length === 0 && (
          <div className="text-muted-foreground/70 italic flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 animate-blink" /> Awaiting agent activity…
          </div>
        )}
        {recent.map((e, idx) => (
          <div key={`${e.id}-${idx}`} className="flex gap-2 items-start animate-ticker-in">
            <Sparkles className="h-3 w-3 mt-0.5 text-primary/70 shrink-0" />
            <span className="text-primary/80 shrink-0 min-w-[10rem]">{e.type}</span>
            <span className="opacity-75 truncate">{typeof e.data === "object" ? JSON.stringify(e.data) : String(e.data)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline "agent is working" widget — Jarvis style. */
export function ThinkingIndicator({ label = "Processing", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-300", className)}>
      <span className="relative inline-flex h-4 w-4">
        <span className="absolute inset-0 rounded-full border border-sky-400/40" />
        <span className="absolute inset-0 rounded-full border-t border-sky-400 animate-orbit" />
        <span className="absolute inset-1 rounded-full bg-sky-400/30" />
      </span>
      <Activity className="h-3 w-3 animate-blink" />
      <span>{label}</span>
      <span className="animate-blink">▍</span>
    </div>
  );
}
