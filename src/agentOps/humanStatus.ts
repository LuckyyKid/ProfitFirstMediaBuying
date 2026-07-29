// Human-friendly status labels + tone classes for TDIA run/engine/agent statuses.

export type Tone = "completed" | "running" | "queued" | "human_review" | "failed" | "warning" | "neutral";

export function statusTone(status?: string | null): Tone {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "succeeded") return "completed";
  if (s === "running" || s === "in_progress") return "running";
  if (s === "queued" || s === "pending" || s === "waiting") return "queued";
  if (s === "human_review" || s === "needs_review") return "human_review";
  if (s === "failed" || s === "error") return "failed";
  if (s === "retry" || s === "retrying") return "warning";
  return "neutral";
}

export function humanStatusLabel(status?: string | null): string {
  switch (statusTone(status)) {
    case "completed": return "Audit terminé";
    case "running": return "Audit en cours";
    case "queued": return "En file d'attente";
    case "human_review": return "Intervention humaine requise";
    case "failed": return "Échec";
    case "warning": return "Nouvelle tentative";
    default: return status ?? "—";
  }
}

export function shortStatusLabel(status?: string | null): string {
  switch (statusTone(status)) {
    case "completed": return "Terminé";
    case "running": return "En cours";
    case "queued": return "En attente";
    case "human_review": return "Revue humaine";
    case "failed": return "Échec";
    case "warning": return "Retry";
    default: return status ?? "—";
  }
}

export function toneClasses(tone: Tone): string {
  switch (tone) {
    case "completed": return "bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))] border-[rgba(122,232,180,0.3)]";
    case "running": return "bg-[rgba(77,159,255,0.08)] text-[#9ec8ff] border-[rgba(77,159,255,0.3)]";
    case "queued": return "bg-[rgba(148,170,215,0.06)] text-[#c8d2e4] border-[rgba(148,170,215,0.15)]";
    case "human_review": return "bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))] border-[rgba(255,184,77,0.3)]";
    case "failed": return "bg-[rgba(255,107,107,0.08)] text-[hsl(var(--bad))] border-[rgba(255,107,107,0.3)]";
    case "warning": return "bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))] border-[rgba(255,184,77,0.3)]";
    default: return "bg-secondary text-foreground/80 border-border/40";
  }
}

export function toneDotClass(tone: Tone): string {
  switch (tone) {
    case "completed": return "bg-[hsl(var(--good))] shadow-[0_0_6px_rgba(122,232,180,0.5)]";
    case "running": return "bg-[#4d9fff] animate-pulse shadow-[0_0_6px_rgba(77,159,255,0.6)]";
    case "queued": return "bg-[rgba(148,170,215,0.3)]";
    case "human_review": return "bg-[hsl(var(--watch))] shadow-[0_0_6px_rgba(255,184,77,0.5)]";
    case "failed": return "bg-[hsl(var(--bad))] shadow-[0_0_6px_rgba(255,107,107,0.5)]";
    case "warning": return "bg-[hsl(var(--watch))]";
    default: return "bg-muted-foreground";
  }
}

export function isTerminal(status?: string | null): boolean {
  const t = statusTone(status);
  return t === "completed" || t === "failed" || t === "human_review";
}

export function isActive(status?: string | null): boolean {
  const t = statusTone(status);
  return t === "running" || t === "queued";
}

export function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (!d) return "—";
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  return `il y a ${days}j`;
}

export function durationSince(iso?: string | null, until?: string | null): string {
  if (!iso) return "—";
  const start = new Date(iso).getTime();
  const end = until ? new Date(until).getTime() : Date.now();
  if (!start || !end) return "—";
  return formatDuration(end - start);
}
