// Mode Guidé — top-level layout for any client sequence (Walkdown, Buyer,
// Créa, Budget, Debrief, Digest…).
// Reference: 2b-mode-guide-premium.png.
//
// Composition:
//   ┌───────────────────────────────────────────────────────────────┐
//   │ TopBar: TDIA·GOS · client·code · status · routine progress    │
//   ├────────────┬──────────────────────────────────────────────────┤
//   │            │                                                  │
//   │ RailStepper│ children (page content, ideally starting with    │
//   │            │ LectureSysteme + MetricColumns + Table)          │
//   │            │                                                  │
//   ├────────────┴──────────────────────────────────────────────────┤
//   │ ExitCriteriaBar (sticky)                                      │
//   └───────────────────────────────────────────────────────────────┘

import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RailStepper, type RailStep } from "./RailStepper";
import { ExitCriteriaBar, type CriteriaItem } from "./ExitCriteriaBar";
import { StatusDot, MicroLabel, type Status } from "./primitives";

export type ModeGuideProps = {
  clientName: string;
  clientCode: string;
  clientStatus?: Status;
  routineProgress?: { done: number; total: number };
  routineTitle?: string;              // e.g. "ROUTINE DU JOUR"
  stepTitle: string;                  // "Walkdown métriques"
  stepSubtitle?: ReactNode;           // "Digest 7h → Walkdown"
  steps: RailStep[];
  railTitle?: string;                 // e.g. "ROUTINE"
  railFooter?: ReactNode;             // "Pourquoi cet ordre ?" paragraph
  exitCriteria: CriteriaItem[];
  nextStepLabel: string;
  onNextStep?: () => void;
  nextDisabled?: boolean;
  onAskLead?: () => void;
  onBack?: () => void;                // defaults to nav(/admin/gos)
  children: ReactNode;
};

export function ModeGuide({
  clientName,
  clientCode,
  clientStatus = "good",
  routineProgress,
  routineTitle = "ROUTINE",
  stepTitle,
  stepSubtitle,
  steps,
  railTitle = "ROUTINE DU JOUR",
  railFooter,
  exitCriteria,
  nextStepLabel,
  onNextStep,
  nextDisabled,
  onAskLead,
  onBack,
  children,
}: ModeGuideProps) {
  const nav = useNavigate();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 64px)", margin: -32 }}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "18px 32px",
          borderBottom: "1px solid rgba(148, 170, 215, 0.10)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          background: "linear-gradient(180deg, rgba(11, 19, 34, 0.4), transparent)",
        }}
      >
        <button
          className="gos-btn-secondary"
          onClick={() => (onBack ? onBack() : nav("/admin/gos"))}
          style={{ padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={12} /> Ma journée
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <MicroLabel color="#5f6b82">TDIA · GOS</MicroLabel>
          <span style={{ color: "#3a4358" }}>·</span>
          <span style={{ color: "#eef2fa", fontSize: 13, fontWeight: 600 }}>{clientName}</span>
          <span className="font-data" style={{ color: "#5f6b82", fontSize: 11, letterSpacing: "0.04em" }}>
            {clientCode}
          </span>
          <StatusDot status={clientStatus} />
        </div>

        <div style={{ flex: 1 }} />

        {routineProgress && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MicroLabel color="#5f6b82">{routineTitle}</MicroLabel>
            <span className="font-data" style={{ color: "#eef2fa", fontSize: 14, fontWeight: 300 }}>
              {routineProgress.done}<span style={{ color: "#5f6b82" }}>/{routineProgress.total}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Body: rail + content ────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ borderRight: "1px solid rgba(148, 170, 215, 0.10)" }}>
          <RailStepper title={railTitle} steps={steps} footerNote={railFooter} />
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: "32px 40px", overflow: "hidden" }}>
          {/* Step header */}
          <div style={{ marginBottom: 24 }}>
            {stepSubtitle && (
              <MicroLabel style={{ display: "block", marginBottom: 10 }}>
                {stepSubtitle}
              </MicroLabel>
            )}
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 500,
                color: "#eef2fa",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {stepTitle}
            </h1>
          </div>

          {/* Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 32 }}>
            {children}
          </div>
        </div>
      </div>

      {/* ── Sticky exit criteria bar ────────────────────────────────── */}
      <ExitCriteriaBar
        criteria={exitCriteria}
        nextStepLabel={nextStepLabel}
        onNextStep={onNextStep}
        nextDisabled={nextDisabled}
        onAskLead={onAskLead}
      />
    </div>
  );
}
