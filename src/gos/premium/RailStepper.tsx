// Vertical numbered rail — left column of the Mode Guidé wrapper.
// Reference: 2b-mode-guide-premium.png (left side).
//
// Nodes: done (green check) → active (blue with glow) → future (hairline) →
// locked (dashed border + 🔒, opacity .5, requires-hint).

import { ReactNode } from "react";
import { Check, Lock } from "lucide-react";

export type StepState = "done" | "active" | "future" | "locked";

export type RailStep = {
  id: string;
  label: string;
  state: StepState;
  hint?: string;      // "FAIT · 07:12", "EN COURS · ~10 MIN", "requiert l'étape 4"
  onClick?: () => void;
};

export function RailStepper({
  title,
  steps,
  footerNote,
}: {
  title?: string;
  steps: RailStep[];
  footerNote?: ReactNode;   // "Pourquoi cet ordre ?" italic paragraph
}) {
  return (
    <aside style={{
      width: 240, flexShrink: 0, padding: "24px 8px 24px 24px",
      display: "flex", flexDirection: "column", minHeight: "100%",
    }}>
      {title && (
        <div className="microlabel" style={{ marginBottom: 20 }}>{title}</div>
      )}

      <ol style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
        {steps.map((step, idx) => (
          <RailNode key={step.id} step={step} index={idx + 1} isLast={idx === steps.length - 1} />
        ))}
      </ol>

      {footerNote && (
        <div
          className="font-accent"
          style={{
            marginTop: 24,
            padding: "14px 16px",
            borderTop: "1px solid rgba(148, 170, 215, 0.10)",
            color: "#8b97ad",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {footerNote}
        </div>
      )}
    </aside>
  );
}

function RailNode({ step, index, isLast }: { step: RailStep; index: number; isLast: boolean }) {
  const { state, label, hint, onClick } = step;

  const isDone = state === "done";
  const isActive = state === "active";
  const isLocked = state === "locked";

  const nodeSize = isActive ? 26 : 20;
  const nodeBg =
    isActive ? "linear-gradient(135deg, #4d9fff, #2f6bff)" :
    isDone ? "transparent" :
    "transparent";
  const nodeBorder =
    isActive ? "none" :
    isDone ? "1.5px solid #3ddc97" :
    isLocked ? "1.5px dashed rgba(148, 170, 215, 0.30)" :
    "1.5px solid rgba(148, 170, 215, 0.20)";
  const nodeShadow = isActive ? "0 0 20px rgba(47, 107, 255, 0.55)" : "none";
  const nodeColor = isActive ? "#fff" : isDone ? "#3ddc97" : "#8b97ad";

  const labelWeight = isActive ? 600 : 500;
  const labelColor =
    isActive ? "#eef2fa" :
    isDone ? "#c8d2e4" :
    isLocked ? "#5f6b82" :
    "#c8d2e4";

  return (
    <li
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr",
        gap: 12,
        alignItems: "flex-start",
        padding: isActive ? "10px 12px" : "10px 12px",
        cursor: onClick && !isLocked ? "pointer" : "default",
        borderRadius: 10,
        background: isActive
          ? "linear-gradient(135deg, rgba(77, 159, 255, 0.14), rgba(47, 107, 255, 0.05))"
          : "transparent",
        border: isActive ? "1px solid rgba(77, 159, 255, 0.25)" : "1px solid transparent",
        boxShadow: isActive ? "0 0 24px rgba(47, 107, 255, 0.10)" : "none",
        marginBottom: 4,
        opacity: isLocked ? 0.6 : 1,
        position: "relative",
      }}
    >
      {/* connector line to next step */}
      {!isLast && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 12 + 36 / 2,
            top: 10 + nodeSize + 4,
            bottom: -4,
            width: 1,
            background: "rgba(148, 170, 215, 0.15)",
          }}
        />
      )}

      <span
        style={{
          width: nodeSize, height: nodeSize, borderRadius: "50%",
          background: nodeBg, border: nodeBorder, boxShadow: nodeShadow,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: isActive ? 12 : 11, fontWeight: 500, color: nodeColor,
          justifySelf: "center", flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isDone ? <Check size={12} /> :
         isLocked ? <Lock size={10} /> :
         index}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: labelWeight, color: labelColor,
          letterSpacing: "-0.01em", lineHeight: 1.35,
        }}>
          {label}
        </div>
        {hint && (
          <div className="microlabel" style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.20em" }}>
            {hint}
          </div>
        )}
      </div>
    </li>
  );
}
