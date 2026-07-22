// Sticky footer bar for Mode Guidé pages. Design rule #3:
// left side = "Pour terminer : …" checklist (✓ / — à faire)
// right side = primary CTA "Étape terminée → [next step]" + secondary "Demander au Lead"
// Reference: 2b-mode-guide-premium.png bottom.

import { ReactNode } from "react";
import { ButtonPrimary, ButtonSecondary } from "./primitives";

export type CriteriaItem = { label: string; done: boolean };

export function ExitCriteriaBar({
  criteria,
  nextStepLabel,
  onNextStep,
  nextDisabled,
  onAskLead,
}: {
  criteria: CriteriaItem[];
  nextStepLabel: string;         // "Buyer Workspace"
  onNextStep?: () => void;
  nextDisabled?: boolean;
  onAskLead?: () => void;
}) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, left: 0, right: 0,
        marginTop: 32,
        padding: "18px 28px",
        borderTop: "1px solid rgba(148, 170, 215, 0.15)",
        background: "linear-gradient(180deg, rgba(6, 9, 16, 0.75), rgba(6, 9, 16, 0.95))",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        gap: 24,
        flexWrap: "wrap",
        zIndex: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 280, color: "#c8d2e4", fontSize: 13, lineHeight: 1.55 }}>
        <span style={{ color: "#eef2fa", fontWeight: 600, marginRight: 6 }}>Pour terminer :</span>
        {criteria.map((c, i) => (
          <CriteriaChunk key={i} item={c} isLast={i === criteria.length - 1} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        {onAskLead && <ButtonSecondary onClick={onAskLead}>Demander au Lead</ButtonSecondary>}
        <ButtonPrimary onClick={onNextStep} disabled={nextDisabled}>
          Étape terminée <ArrowRight /> {nextStepLabel}
        </ButtonPrimary>
      </div>
    </div>
  );
}

function CriteriaChunk({ item, isLast }: { item: CriteriaItem; isLast: boolean }) {
  return (
    <>
      <span style={{ color: item.done ? "#3ddc97" : "#c8d2e4" }}>
        {item.label}{" "}
        <span style={{ color: item.done ? "#3ddc97" : "#8b97ad" }}>
          {item.done ? "✓" : "— à faire"}
        </span>
      </span>
      {!isLast && <span style={{ color: "#5f6b82", margin: "0 8px" }}>·</span>}
    </>
  );
}

function ArrowRight() {
  return (
    <span aria-hidden style={{ margin: "0 4px" }}>→</span>
  );
}
