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
    case "completed": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "running": return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "queued": return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    case "human_review": return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    case "failed": return "bg-red-500/15 text-red-300 border-red-500/30";
    case "warning": return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    default: return "bg-secondary text-foreground/80 border-border/40";
  }
}

export function toneDotClass(tone: Tone): string {
  switch (tone) {
    case "completed": return "bg-emerald-400";
    case "running": return "bg-sky-400 animate-pulse";
    case "queued": return "bg-slate-400";
    case "human_review": return "bg-orange-400";
    case "failed": return "bg-red-400";
    case "warning": return "bg-yellow-400";
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
