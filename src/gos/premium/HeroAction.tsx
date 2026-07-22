// PROCHAINE ACTION hero card — the one-and-only CTA of the home screen.
// Reference: 2a-ma-journee-premium.png (top block).

import { HeroCard, MicroLabel, ButtonPrimary } from "./primitives";

export type HeroActionMeta = {
  duration?: string;   // e.g. "~10 MIN"
  step?: string;       // e.g. "ETAPE 2/6"
  synced?: string;     // e.g. "SYNCHRO IL Y A 12 MIN"
  extra?: string;      // e.g. "2 BRANCHES ROUGES"
};

export function HeroAction({
  title,
  clientAccent,
  reason,
  ctaLabel = "Commencer",
  onCta,
  meta,
}: {
  title: string;               // "Walkdown métriques —"
  clientAccent?: string;       // "NordicSkin" (rendered in serif italic)
  reason: string;              // 1-sentence why
  ctaLabel?: string;
  onCta?: () => void;
  meta?: HeroActionMeta;
}) {
  return (
    <HeroCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#4d9fff", boxShadow: "0 0 8px #4d9fffcc",
            }} />
            <MicroLabel color="#9ec8ff">PROCHAINE ACTION</MicroLabel>
          </div>

          <h2 style={{
            fontSize: 26, fontWeight: 500, margin: 0, marginBottom: 12,
            letterSpacing: "-0.02em", color: "#eef2fa", lineHeight: 1.2,
          }}>
            {title}
            {clientAccent && <> <span className="font-accent" style={{ fontWeight: 400 }}>{clientAccent}</span></>}
          </h2>

          <p style={{
            color: "#c8d2e4", fontSize: 14, lineHeight: 1.55,
            margin: 0, marginBottom: 18, maxWidth: 640,
          }}>
            {reason}
          </p>

          {meta && (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              {meta.duration && <MicroLabel>{meta.duration}</MicroLabel>}
              {meta.step && <MicroLabel>{meta.step}</MicroLabel>}
              {meta.synced && <MicroLabel>{meta.synced}</MicroLabel>}
              {meta.extra && <MicroLabel color="#ff6b6b">{meta.extra}</MicroLabel>}
            </div>
          )}
        </div>

        <ButtonPrimary onClick={onCta} style={{ padding: "14px 28px", fontSize: 14, flexShrink: 0 }}>
          {ctaLabel}
        </ButtonPrimary>
      </div>
    </HeroCard>
  );
}
