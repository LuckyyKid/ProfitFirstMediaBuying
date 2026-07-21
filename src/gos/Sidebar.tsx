// src/gos/Sidebar.tsx
//
// Replaces the inline Sidebar() function in GosLayout.tsx.
//
// Two behavioral changes from the current sidebar:
//
// 1. Phase toggle. Instead of one flat list of ~45 links, the AM picks
//    "Nouveau client" or "Client actif" and everything not relevant to that
//    phase is dimmed (not hidden -- nothing disappears, so nothing feels
//    "lost"). Phase state is local to the sidebar and does not affect
//    routing; it is purely a visual filter.
//
// 2. Inline help. Each nav item carries a HelpContent object (see
//    navConfig.ts). Clicking an item's info icon dispatches that content into
//    the *existing* HelpProvider/HelpDrawer (help.tsx) instead of navigating.
//    This is the fast path to populate a help system that already exists in
//    the codebase but that no page currently feeds -- one wiring point here
//    instead of useRegisterHelp() calls scattered across ~45 page files.

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Info, ArrowLeft, LogOut } from "lucide-react";
import { buildNav, type NavItem, type NavPhase } from "./navConfig";
import { useHelpDispatch } from "./help";

type SidebarProps = {
  clientId: string | null;
  hasClient: boolean;
  clientName?: string | null;
  clientCode?: string | null;
  onLogout: () => void;
};

export function Sidebar({ clientId, hasClient, clientName, clientCode, onLogout }: SidebarProps) {
  const [phase, setPhase] = useState<NavPhase>("new");
  const { showHelp } = useHelpDispatch();
  const groups = buildNav(clientId);

  return (
    <aside className="gos-sidebar">
      <div style={{ padding: "0 12px 8px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--tdia-muted)", fontWeight: 600 }}>TDIA</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--tdia-text)", marginTop: 2 }}>Profit First Media Buying</div>
      </div>

      {hasClient && (
        <div className="gos-card" style={{ margin: "12px 8px", padding: 12 }}>
          <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>CLIENT ACTIF</div>
          <div style={{ fontWeight: 600, marginTop: 4, fontSize: 14, color: "var(--tdia-text)" }}>{clientName}</div>
          <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontFamily: "monospace" }}>{clientCode}</div>
        </div>
      )}

      <PhaseToggle phase={phase} onChange={setPhase} />

      {groups.map((group) => (
        <div key={group.group} className="gos-sidebar-group">
          <div className="gos-sidebar-group-label">{group.group}</div>
          {group.items.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              phase={phase}
              disabled={Boolean(item.needsClient) && !hasClient}
              onInfoClick={() => showHelp(item.help)}
            />
          ))}
        </div>
      ))}

      <div style={{ marginTop: 24, padding: "0 8px", display: "grid", gap: 8 }}>
        <NavLink to="/admin" className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Retour a l'admin
        </NavLink>
        <button className="gos-btn-secondary" onClick={onLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <LogOut size={14} /> Deconnexion
        </button>
      </div>
    </aside>
  );
}

function PhaseToggle({ phase, onChange }: { phase: NavPhase; onChange: (p: NavPhase) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, margin: "0 8px 12px", background: "hsl(220 45% 10%)", borderRadius: 8, padding: 3 }}>
      {(["new", "active"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
            cursor: "pointer",
            background: phase === p ? "var(--tdia-blue)" : "transparent",
            color: phase === p ? "#fff" : "var(--tdia-muted)",
          }}
        >
          {p === "new" ? "Nouveau client" : "Client actif"}
        </button>
      ))}
    </div>
  );
}

function NavRow({
  item, phase, disabled, onInfoClick,
}: {
  item: NavItem;
  phase: NavPhase;
  disabled: boolean;
  onInfoClick: () => void;
}) {
  const relevant = item.phase === "both" || item.phase === phase;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        opacity: disabled ? 0.4 : relevant ? 1 : 0.45,
      }}
    >
      <NavLink
        to={disabled ? "#" : item.to}
        end={item.end}
        title={disabled ? "Selectionne d'abord un client" : item.label}
        className={({ isActive }) => `gos-nav-link ${isActive && !disabled ? "active" : ""} ${disabled ? "disabled" : ""}`}
        onClick={(e) => { if (disabled) e.preventDefault(); }}
        style={{ flex: 1, minWidth: 0 }}
      >
        <item.icon size={16} />
        <span>{item.label}</span>
      </NavLink>
      <button
        aria-label={`Aide -- ${item.label}`}
        title="A quoi sert cette section ?"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfoClick(); }}
        style={{
          background: "transparent", border: "none", color: "var(--tdia-muted)",
          cursor: "pointer", padding: 4, display: "flex", flexShrink: 0,
        }}
      >
        <Info size={13} />
      </button>
    </div>
  );
}
