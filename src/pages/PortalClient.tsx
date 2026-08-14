import { useState, CSSProperties } from "react";
import { MetaAdsDashboard } from "@/components/portal/MetaAdsDashboard";

// ============================================================
// Portail Client TDIA — Performance uniquement
// Le portail montre les canaux publicitaires connectés côté admin.
// Pour l'instant : Meta Ads. Google Ads viendra quand l'intégration
// admin (config Sheet Porter Google) sera en place.
// ============================================================

type ChannelId = "meta";

const CHANNELS: { id: ChannelId; label: string }[] = [
  { id: "meta", label: "Meta Ads" },
  // { id: "google", label: "Google Ads" }, // activer quand l'admin aura la config Google
];

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SERIF = "'Instrument Serif', ui-serif, Georgia, serif";

type PortalClientProps = {
  clientCode: string;
  onLogout?: () => Promise<void> | void;
};

export default function PortalClient({ clientCode, onLogout }: PortalClientProps) {
  const [channel, setChannel] = useState<ChannelId>("meta");

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1100px 480px at 50% -10%,rgba(47,107,255,.13),transparent 60%),#060910",
        color: "#eef2fa",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <PulseKeyframes />
      <Header onLogout={onLogout} />
      <ChannelSelector channel={channel} setChannel={setChannel} />
      {channel === "meta" && <MetaAdsDashboard clientCode={clientCode} />}
    </div>
  );
}

function PulseKeyframes() {
  return <style>{`@keyframes ompulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>;
}

function Header({ onLogout }: { onLogout?: () => Promise<void> | void }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "18px 48px",
        borderBottom: "1px solid rgba(148,170,215,.1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "linear-gradient(135deg,#4d9fff,#2f6bff)",
          }}
        />
        <span style={{ fontFamily: SERIF, fontSize: 20, color: "#eef2fa" }}>TDIA</span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: ".22em",
            color: "#5f6b82",
            fontFamily: MONO,
            marginLeft: 4,
          }}
        >
          PORTAIL CLIENT · PERFORMANCE
        </span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: "#3ddc97",
              boxShadow: "0 0 8px rgba(61,220,151,.8)",
              animation: "ompulse 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 9.5,
              letterSpacing: ".14em",
              color: "#3ddc97",
              fontFamily: MONO,
            }}
          >
            SYNCHRO QUOTIDIENNE — 08:00
          </span>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            style={{
              padding: "7px 14px",
              borderRadius: 99,
              border: "1px solid rgba(148,170,215,.16)",
              background: "rgba(255,255,255,.02)",
              color: "#c8d2e4",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Se déconnecter
          </button>
        )}
      </div>
    </header>
  );
}

function ChannelSelector({
  channel,
  setChannel,
}: {
  channel: ChannelId;
  setChannel: (c: ChannelId) => void;
}) {
  if (CHANNELS.length <= 1) return null;
  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "24px auto 0",
        padding: "0 48px",
        display: "flex",
        gap: 8,
      }}
    >
      {CHANNELS.map((c) => {
        const active = c.id === channel;
        const style: CSSProperties = active
          ? {
              padding: "7px 15px",
              borderRadius: 9,
              background: "linear-gradient(135deg,rgba(77,159,255,.14),rgba(47,107,255,.05))",
              border: "1px solid rgba(77,159,255,.28)",
              color: "#9ec8ff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }
          : {
              padding: "7px 15px",
              borderRadius: 9,
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(148,170,215,.12)",
              color: "#8b97ad",
              fontSize: 12,
              cursor: "pointer",
            };
        return (
          <span key={c.id} style={style} onClick={() => setChannel(c.id)}>
            {c.label}
          </span>
        );
      })}
    </div>
  );
}
