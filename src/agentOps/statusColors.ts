// Color tokens for backend statuses. Backend uses lowercase for run/engine/agent
// statuses (queued/running/completed/failed) and UPPERCASE for supervisor
// decisions (PASS/RETRY/HUMAN_REVIEW/FAIL).

const GOOD = "bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))] border-[rgba(122,232,180,0.3)]";
const INFO = "bg-[rgba(77,159,255,0.08)] text-[#9ec8ff] border-[rgba(77,159,255,0.3)]";
const MUTED = "bg-[rgba(148,170,215,0.06)] text-[#c8d2e4] border-[rgba(148,170,215,0.15)]";
const WATCH = "bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))] border-[rgba(255,184,77,0.3)]";
const BAD = "bg-[rgba(255,107,107,0.08)] text-[hsl(var(--bad))] border-[rgba(255,107,107,0.3)]";
const NEUTRAL = "bg-secondary text-foreground/80 border-border/40";

export function runStatusClass(status?: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "succeeded") return GOOD;
  if (s === "running" || s === "in_progress") return INFO;
  if (s === "queued" || s === "pending" || s === "waiting") return MUTED;
  if (s === "retry" || s === "retrying") return WATCH;
  if (s === "human_review" || s === "needs_review") return WATCH;
  if (s === "failed" || s === "error") return BAD;
  return NEUTRAL;
}

export function decisionClass(decision?: string | null): string {
  const d = (decision ?? "").toUpperCase();
  if (d === "PASS" || d === "APPROVED") return GOOD;
  if (d === "RETRY") return WATCH;
  if (d === "HUMAN_REVIEW") return WATCH;
  if (d === "FAIL" || d === "FAILED" || d === "REJECTED") return BAD;
  return NEUTRAL;
}
