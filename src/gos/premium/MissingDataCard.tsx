// missing_data blocker card — design rule #8.
// Says the cause AND the unblock action. Never a silent zero.

import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ButtonSecondary } from "./primitives";

export function MissingDataCard({
  reason,        // "GA4 muet depuis 72 h — la routine ne peut pas démarrer sans CVR."
  actionLabel,   // "Relancer la sync"
  onAction,
  extraLeft,     // e.g. an avatar / client badge
}: {
  reason: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  extraLeft?: ReactNode;
}) {
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 107, 107, 0.06), rgba(255, 255, 255, 0.015))",
        border: "1px solid rgba(255, 107, 107, 0.25)",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      {extraLeft}
      <AlertTriangle size={16} color="#ff6b6b" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, color: "#c8d2e4", fontSize: 13.5, lineHeight: 1.5 }}>
        {reason}
      </div>
      {actionLabel && onAction && (
        <ButtonSecondary onClick={onAction} style={{ flexShrink: 0 }}>
          {actionLabel}
        </ButtonSecondary>
      )}
    </div>
  );
}
