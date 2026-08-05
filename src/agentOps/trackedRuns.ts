// Historique local des runs consultes (le backend n'a pas d'endpoint global).
// Chaque entree est {slug, auditId} — cf. URL /admin/ops/run/:slug/:auditId.

const KEY = "tdia.tracked_runs";

export interface TrackedRun {
  slug: string;
  auditId: string;
}

function isValid(r: unknown): r is TrackedRun {
  return !!r && typeof r === "object"
    && typeof (r as TrackedRun).slug === "string"
    && typeof (r as TrackedRun).auditId === "string"
    && !!(r as TrackedRun).slug
    && !!(r as TrackedRun).auditId;
}

export function getTrackedRuns(): TrackedRun[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown[];
    const cleaned = raw.filter(isValid).slice(0, 25);
    localStorage.setItem(KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return [];
  }
}

export function trackRun(slug: string, auditId: string) {
  if (!slug || !auditId) return;
  const cur = getTrackedRuns().filter(r => !(r.slug === slug && r.auditId === auditId));
  cur.unshift({ slug, auditId });
  localStorage.setItem(KEY, JSON.stringify(cur.slice(0, 25)));
}

export function untrackRun(slug: string, auditId: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(getTrackedRuns().filter(r => !(r.slug === slug && r.auditId === auditId))),
  );
}
