// src/gos/CommandPalette.tsx
//
// Design system rule #10 (b) — ⌘K palette. Overlay accessible partout dans
// l'espace GOS, présente les pages (groupées par phase) et à terme des actions
// (P0/P1/P2). Pour ce Slice: pages only; les actions viendront quand la file
// d'actions générées sera branchée.
//
// Keyboard model: ↑/↓ navigate, ↵ open, ESC close, ⌘K/Ctrl+K toggle.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { PAGE_LIBRARY, PHASES, searchPages, type PageEntry, type PhaseKey } from "./pageLibrary";
import { useSelectedClient } from "./context";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PHASE_LABEL: Record<PhaseKey, string> = Object.fromEntries(
  PHASES.map((p) => [p.key, p.label]),
) as Record<PhaseKey, string>;

export function CommandPalette({ open, onOpenChange }: Props) {
  const nav = useNavigate();
  const { selectedClient } = useSelectedClient();
  const clientId = selectedClient?.id ?? null;
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchPages(q).slice(0, 40), [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  const openEntry = useCallback((entry: PageEntry) => {
    const href = entry.buildHref(clientId);
    if (!href) return;
    onOpenChange(false);
    nav(href);
  }, [clientId, nav, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0))); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const entry = results[cursor];
        if (entry) openEntry(entry);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, openEntry, onOpenChange]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cursor="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const grouped: Array<[PhaseKey, PageEntry[]]> = PHASES.map(
    (p) => [p.key, results.filter((r) => r.phase === p.key)],
  );
  let runningIdx = 0;

  return (
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(6, 9, 16, 0.72)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 92vw)",
          background: "linear-gradient(135deg, rgba(77, 159, 255, 0.45), rgba(77, 159, 255, 0.05) 40%, rgba(148, 170, 215, 0.1))",
          borderRadius: 18,
          padding: 1,
          boxShadow: "0 40px 100px rgba(0, 0, 0, 0.6), 0 0 80px rgba(47, 107, 255, 0.18)",
        }}
      >
        <div style={{
          background: "linear-gradient(135deg, #0b1322, #080d18)",
          borderRadius: 17,
          overflow: "hidden",
        }}>
          {/* Search bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "16px 18px", borderBottom: "1px solid rgba(148, 170, 215, 0.12)",
          }}>
            <Search size={16} style={{ color: "#8b97ad", flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une page…"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#eef2fa", fontSize: 15, fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: "-0.005em",
              }}
            />
            {selectedClient && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 999,
                background: "linear-gradient(135deg, rgba(77, 159, 255, 0.14), rgba(47, 107, 255, 0.05))",
                border: "1px solid rgba(77, 159, 255, 0.25)",
                color: "#9ec8ff", fontSize: 11, fontWeight: 600,
                whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {selectedClient.company_name}
              </span>
            )}
          </div>

          {/* Results */}
          <div ref={listRef} style={{ maxHeight: "52vh", overflowY: "auto", padding: "6px 0" }}>
            {results.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#8b97ad", fontSize: 13 }}>
                Aucune page ne correspond à « {q} ».
              </div>
            ) : (
              grouped.map(([phaseKey, entries]) => {
                if (entries.length === 0) return null;
                return (
                  <div key={phaseKey} style={{ padding: "8px 6px" }}>
                    <div style={{
                      padding: "6px 14px",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase",
                      color: "#5f6b82",
                    }}>
                      {PHASE_LABEL[phaseKey]}
                    </div>
                    {entries.map((entry) => {
                      const idx = runningIdx++;
                      const active = idx === cursor;
                      const disabled = entry.needsClient && !clientId;
                      return (
                        <button
                          key={entry.key}
                          data-cursor={idx}
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => !disabled && openEntry(entry)}
                          disabled={disabled}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                            width: "100%", padding: "8px 14px", borderRadius: 8, margin: "1px 6px",
                            border: active ? "1px solid rgba(77, 159, 255, 0.22)" : "1px solid transparent",
                            background: active
                              ? "linear-gradient(135deg, rgba(77, 159, 255, 0.14), rgba(47, 107, 255, 0.05))"
                              : "transparent",
                            color: disabled ? "#5f6b82" : (active ? "#9ec8ff" : "#c8d2e4"),
                            fontSize: 13, fontWeight: 500, textAlign: "left",
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.5 : 1,
                            width: "calc(100% - 12px)",
                          }}
                          title={disabled ? "Sélectionne un client d'abord" : undefined}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.label}
                          </span>
                          {active && <ArrowRight size={13} style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer shortcuts */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 18px", borderTop: "1px solid rgba(148, 170, 215, 0.12)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 9, letterSpacing: "0.2em", color: "#5f6b82",
          }}>
            <span>↑↓ NAVIGUER · ↵ OUVRIR · ESC FERMER</span>
            <span style={{ color: "#8b97ad" }}>{results.length} résultat{results.length > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Convenience hook — installs ⌘K / Ctrl+K global toggle.
export function useCommandPaletteHotkey(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
