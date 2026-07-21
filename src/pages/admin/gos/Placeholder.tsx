import { SectionHeader } from "@/gos/ui";

export default function GosPlaceholder({ title, wave }: { title: string; wave: number }) {
  return (
    <div>
      <SectionHeader title={title} subtitle={`Available in Wave ${wave} of the TDIA Profit First Media Buying build.`} />
      <div className="gos-card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontWeight: 500, color: "var(--tdia-text)" }}>Coming soon — Wave {wave}</div>
        <div style={{ color: "var(--tdia-muted)", marginTop: 6, fontSize: 13 }}>
          The deterministic engine and UI for this page are scheduled for the next build wave.
        </div>
      </div>
    </div>
  );
}
