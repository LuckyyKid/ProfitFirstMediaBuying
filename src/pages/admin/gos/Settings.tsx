import { SectionHeader } from "@/gos/ui";

export default function GosSettings() {
  return (
    <div>
      <SectionHeader title="Paramètres" subtitle="TDIA Profit First Media Buying — configuration." />
      <div className="gos-card">
        <p style={{ color: "var(--tdia-muted)", margin: 0 }}>
          V1 uses the existing admin password auth. Roles (ADMIN / AM) and per-user permissions arrive in V2.
        </p>
      </div>
    </div>
  );
}
