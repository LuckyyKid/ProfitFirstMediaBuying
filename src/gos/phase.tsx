// src/gos/phase.tsx
//
// "Client lifecycle phase" toggle — orthogonal to pageLibrary's workflow
// phases. Two states:
//   - "new"    : onboarding / plan 30 jours. Setup, forecast, target-setting.
//   - "active" : campaigns are live. Daily execution + review dominates.
//
// The toggle *does not hide* anything — it dims (opacity 0.45) items whose
// declared lifecyclePhase doesn't match, so the sidebar still reads as a
// roadmap. Persisted per client in localStorage so switching clients
// remembers where each one stands.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LifecyclePhase = "new" | "active";

type PhaseCtx = {
  phase: LifecyclePhase;
  setPhase: (p: LifecyclePhase) => void;
};

const Ctx = createContext<PhaseCtx | null>(null);

const STORAGE_KEY = (clientId: string | null) =>
  clientId ? `gos:phase:${clientId}` : "gos:phase:__none__";

function readInitial(clientId: string | null): LifecyclePhase {
  try {
    const v = localStorage.getItem(STORAGE_KEY(clientId));
    return v === "active" ? "active" : "new";
  } catch {
    return "new";
  }
}

export function PhaseProvider({ clientId, children }: { clientId: string | null; children: ReactNode }) {
  const [phase, setPhaseState] = useState<LifecyclePhase>(() => readInitial(clientId));

  // Re-read when the selected client changes so each client keeps its own state.
  useEffect(() => {
    setPhaseState(readInitial(clientId));
  }, [clientId]);

  const setPhase = (p: LifecyclePhase) => {
    setPhaseState(p);
    try { localStorage.setItem(STORAGE_KEY(clientId), p); } catch { /* quota / private mode — ignore */ }
  };

  const value = useMemo(() => ({ phase, setPhase }), [phase, clientId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePhase(): PhaseCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePhase must be used inside <PhaseProvider>");
  return ctx;
}

// Small helper the sidebar uses to decide dimming.
export function phaseMatches(itemPhase: LifecyclePhase | "both", selected: LifecyclePhase): boolean {
  return itemPhase === "both" || itemPhase === selected;
}
