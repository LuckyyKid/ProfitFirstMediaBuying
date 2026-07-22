// src/gos/RoutineBanner.tsx
//
// Design system rule #10 (task 4) — "ÉTAPE X/N" banner.
//
// Displays a compact indicator at the top of any GOS page that belongs to a
// known routine (see routines.ts), with a shortcut to jump into Mode Guidé.
// Purpose: even when the AM arrived via the sidebar library or ⌘K palette,
// they see where the current page fits in the guided sequence.
//
// Suppression: Mode Guidé pages already render a RailStepper + top progress,
// so they call <ModeGuideActiveMarker /> which flips a context flag to hide
// this banner and avoid duplication.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { useSelectedClient } from "./context";
import { findPageByPath, PAGE_LIBRARY } from "./pageLibrary";
import { findRoutineForPage } from "./routines";

// -- Suppression context (Mode Guidé pages set this) ------------------------

type ModeGuideCtx = { count: number; setCount: (fn: (n: number) => number) => void };
const ModeGuideActiveCtx = createContext<ModeGuideCtx | null>(null);

export function RoutineBannerProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const value = useMemo<ModeGuideCtx>(() => ({
    count,
    setCount: (fn) => setCount(fn),
  }), [count]);
  return <ModeGuideActiveCtx.Provider value={value}>{children}</ModeGuideActiveCtx.Provider>;
}

/** Rendered inside Mode Guidé to suppress the routine banner. */
export function ModeGuideActiveMarker() {
  const ctx = useContext(ModeGuideActiveCtx);
  useEffect(() => {
    if (!ctx) return;
    ctx.setCount((n) => n + 1);
    return () => ctx.setCount((n) => n - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// -- Banner ------------------------------------------------------------------

export function RoutineBanner() {
  const loc = useLocation();
  const nav = useNavigate();
  const { selectedClient } = useSelectedClient();
  const clientId = selectedClient?.id ?? null;
  const ctx = useContext(ModeGuideActiveCtx);
  const suppressed = (ctx?.count ?? 0) > 0;

  const match = useMemo(() => {
    const page = findPageByPath(loc.pathname, clientId);
    if (!page) return null;
    const r = findRoutineForPage(page.key);
    if (!r) return null;
    return { page, ...r };
  }, [loc.pathname, clientId]);

  if (suppressed || !match) return null;

  const entryPage = PAGE_LIBRARY.find((p) => p.key === match.routine.entryPageKey);
  const entryHref = entryPage?.buildHref(clientId) ?? null;

  return (
    <div
      style={{
        margin: "0 0 20px 0",
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid rgba(77, 159, 255, 0.22)",
        background: "linear-gradient(135deg, rgba(77, 159, 255, 0.10), rgba(47, 107, 255, 0.03))",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <Compass size={14} style={{ color: "#9ec8ff", flexShrink: 0 }} />

      <span
        className="font-data"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#9ec8ff",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        Étape {match.stepIndex}/{match.total}
      </span>

      <span style={{ color: "#3a4358" }}>·</span>

      <span
        className="font-data"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#8b97ad",
          flexShrink: 0,
        }}
      >
        {match.routine.label}
      </span>

      <span style={{ color: "#5f6b82", fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {match.step.label}
      </span>

      <div style={{ flex: 1 }} />

      {entryHref && (
        <button
          onClick={() => nav(entryHref)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(77, 159, 255, 0.28)",
            background: "linear-gradient(135deg, rgba(77, 159, 255, 0.14), rgba(47, 107, 255, 0.05))",
            color: "#9ec8ff",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Ouvrir en Mode Guidé
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
