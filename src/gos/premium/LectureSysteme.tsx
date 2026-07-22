// "Lecture du système" callout — the 1-sentence translation of numbers
// into a conclusion + instruction. Design rule #5 (SOP guidé).
// Reference: 2b-mode-guide-premium.png (blue-bordered callout).

import { ReactNode } from "react";

export function LectureSysteme({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(77, 159, 255, 0.08), rgba(47, 107, 255, 0.02))",
        border: "1px solid rgba(77, 159, 255, 0.20)",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
      }}
    >
      <span
        aria-hidden
        style={{
          color: "#4d9fff",
          fontSize: 14,
          lineHeight: "22px",
          flexShrink: 0,
          textShadow: "0 0 12px rgba(77, 159, 255, 0.5)",
        }}
      >
        ◆
      </span>
      <div style={{ color: "#c8d2e4", fontSize: 13.5, lineHeight: 1.6 }}>
        <span className="font-accent" style={{ color: "#eef2fa", marginRight: 6 }}>
          Lecture du système.
        </span>
        {children}
      </div>
    </div>
  );
}
