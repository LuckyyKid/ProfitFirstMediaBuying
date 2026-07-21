// Color tokens for backend statuses. Backend uses lowercase for run/engine/agent
// statuses (queued/running/completed/failed) and UPPERCASE for supervisor
// decisions (PASS/RETRY/HUMAN_REVIEW/FAIL).

export function runStatusClass(status?: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "succeeded") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (s === "running" || s === "in_progress") return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  if (s === "queued" || s === "pending" || s === "waiting") return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  if (s === "retry" || s === "retrying") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (s === "human_review" || s === "needs_review") return "bg-purple-500/15 text-purple-300 border-purple-500/30";
  if (s === "failed" || s === "error") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-secondary text-foreground/80 border-border/40";
}

export function decisionClass(decision?: string | null): string {
  const d = (decision ?? "").toUpperCase();
  if (d === "PASS" || d === "APPROVED") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (d === "RETRY") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (d === "HUMAN_REVIEW") return "bg-purple-500/15 text-purple-300 border-purple-500/30";
  if (d === "FAIL" || d === "FAILED" || d === "REJECTED") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-secondary text-foreground/80 border-border/40";
}
