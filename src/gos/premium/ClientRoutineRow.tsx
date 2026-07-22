// One row of "ROUTINE DU JOUR" on Ma Journée.
// Reference 2a: client badge + name + code + status dot + inline stepper + progress.
// If blocked (missing_data), render a MissingDataCard-like inner block instead of the stepper.

import { ReactNode } from "react";
import { Check } from "lucide-react";
import { CardPremium, StatusDot, Status } from "./primitives";

export type RoutineStep = {
  id: string;
  label: string;       // "Digest 7h"
  state: "done" | "active" | "future";
};

export function ClientRoutineRow({
  clientInitial,
  clientName,
  clientCode,
  status,
  progress,          // { done: 1, total: 6 }
  steps,             // 6 steps for the stepper
  onClick,
  blocked,           // { reason, actionLabel, onAction } — replaces stepper if present
}: {
  clientInitial: string;
  clientName: string;
  clientCode: string;
  status: Status;
  progress: { done: number; total: number };
  steps?: RoutineStep[];
  onClick?: () => void;
  blocked?: { reason: ReactNode; actionLabel?: string; onAction?: () => void };
}) {
  const isBlocked = !!blocked;

  return (
    <CardPremium
      style={{
        padding: "16px 20px",
        cursor: onClick && !isBlocked ? "pointer" : "default",
        borderColor: isBlocked ? "rgba(255, 107, 107, 0.25)" : undefined,
        background: isBlocked
          ? "linear-gradient(135deg, rgba(255, 107, 107, 0.05), rgba(255, 255, 255, 0.015))"
          : undefined,
      }}
      className="client-routine-row"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ClientBadge letter={clientInitial} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#eef2fa" }}>{clientName}</span>
            <span className="font-data" style={{ fontSize: 11, color: "#5f6b82", letterSpacing: "0.06em" }}>
              {clientCode}
            </span>
            <StatusDot status={status} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {!isBlocked && steps && <MiniStepper steps={steps} />}
          {!isBlocked && !steps && (
            <div style={{ width: 260 }}>
              <ProgressBar done={progress.done} total={progress.total} />
            </div>
          )}
          <div className="font-data" style={{
            fontSize: 12, color: "#8b97ad", minWidth: 40, textAlign: "right",
          }}>
            {progress.done}/{progress.total}
          </div>
        </div>
      </div>

      {isBlocked && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: "1px solid rgba(255, 107, 107, 0.15)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ color: "#ff6b6b", fontSize: 14 }}>△</span>
          <div style={{ flex: 1, color: "#c8d2e4", fontSize: 13, lineHeight: 1.5 }}>
            {blocked!.reason}
          </div>
          {blocked!.actionLabel && (
            <button
              onClick={blocked!.onAction}
              className="gos-btn-secondary"
              style={{ flexShrink: 0 }}
            >
              {blocked!.actionLabel}
            </button>
          )}
        </div>
      )}
    </CardPremium>
  );
}

function ClientBadge({ letter }: { letter: string }) {
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: "linear-gradient(135deg, #0b1322, #080d18)",
        border: "1px solid rgba(148, 170, 215, 0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13, fontWeight: 500, color: "#c8d2e4",
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}

function MiniStepper({ steps }: { steps: RoutineStep[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: 500 }}>
      {steps.map((s, i) => (
        <MiniStep key={s.id} step={s} index={i + 1} isLast={i === steps.length - 1} nextDone={steps[i + 1]?.state === "done"} />
      ))}
    </div>
  );
}

function MiniStep({
  step, index, isLast, nextDone,
}: {
  step: RoutineStep; index: number; isLast: boolean; nextDone: boolean;
}) {
  const isDone = step.state === "done";
  const isActive = step.state === "active";
  const nodeColor = isActive ? "#4d9fff" : isDone ? "#3ddc97" : "rgba(148, 170, 215, 0.25)";
  const nodeBg = isActive ? "linear-gradient(135deg, #4d9fff, #2f6bff)" : "transparent";

  return (
    <div style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: isActive ? 22 : 18, height: isActive ? 22 : 18,
            borderRadius: "50%",
            background: nodeBg,
            border: isActive ? "none" : `1.5px solid ${nodeColor}`,
            boxShadow: isActive ? "0 0 14px rgba(47, 107, 255, 0.5)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, fontWeight: 500,
            color: isActive ? "#fff" : isDone ? "#3ddc97" : "#8b97ad",
          }}
        >
          {isDone ? <Check size={10} /> : index}
        </div>
        <div style={{
          fontSize: 10, color: isActive ? "#eef2fa" : "#8b97ad",
          fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap",
        }}>
          {step.label}
        </div>
      </div>
      {!isLast && (
        <div style={{
          height: 1, flex: 1, minWidth: 24,
          background: isDone && nextDone
            ? "linear-gradient(90deg, #3ddc97, #3ddc97)"
            : isDone
            ? "linear-gradient(90deg, #3ddc97, rgba(148, 170, 215, 0.20))"
            : "rgba(148, 170, 215, 0.15)",
          margin: "0 8px",
          marginTop: -14,
        }} />
      )}
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div style={{
      height: 3, background: "rgba(148, 170, 215, 0.12)",
      borderRadius: 99, overflow: "hidden",
    }}>
      <div style={{
        width: `${pct}%`, height: "100%",
        background: "linear-gradient(90deg, #3ddc97, #4d9fff)",
        borderRadius: 99, boxShadow: "0 0 8px rgba(77, 159, 255, 0.4)",
      }} />
    </div>
  );
}
