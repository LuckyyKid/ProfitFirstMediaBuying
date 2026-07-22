// src/gos/Sidebar.tsx
//
// Premium Dark — slim sidebar (3-5 entries).
// Rule #10: the ~45 GOS pages are NOT listed here. They are reachable only
// as steps of a guided sequence (Ma Journée → Mode Guidé). This sidebar
// exposes only the top-level "où je suis dans mon travail" navigation.
//
// The ⓘ help affordance from the previous phase-toggle sidebar is preserved
// per-entry — clicking dispatches HelpContent to the existing HelpDrawer.

import { NavLink } from "react-router-dom";
import { Info, LogOut, ArrowLeft, Calendar, Users, LineChart } from "lucide-react";
import type { ComponentType } from "react";
import { useHelpDispatch, type HelpContent } from "./help";

type SidebarProps = {
  clientId: string | null;
  hasClient: boolean;
  clientName?: string | null;
  clientCode?: string | null;
  userName?: string | null;
  clientCount?: number;
  onLogout: () => void;
};

type TopEntry = {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  end?: boolean;
  help: HelpContent;
};

const TOP_ENTRIES: TopEntry[] = [
  {
    to: "/admin/gos",
    label: "Ma journée",
    icon: Calendar,
    end: true,
    help: {
      title: "Ma journée",
      what: "Ton écran d'atterrissage : la PROCHAINE ACTION à faire maintenant, et la ROUTINE DU JOUR par client.",
      why: "Une seule décision à la fois. Le système te dit quoi ouvrir, tu ouvres, tu fais, tu reviens.",
    },
  },
  {
    to: "/admin/gos/clients",
    label: "Clients",
    icon: Users,
    help: {
      title: "Clients",
      what: "Liste de tous les clients du portefeuille, avec leur statut et leur avancement.",
      why: "Pour ouvrir un client précis quand tu ne suis pas la routine — ex : demande spontanée d'un lead.",
    },
  },
  {
    to: "/admin/gos/portfolio",
    label: "Portefeuille exécutif",
    icon: LineChart,
    help: {
      title: "Portefeuille exécutif",
      what: "Vue consolidée : contribution, ad spend, rentabilité par client, statut des routines.",
      why: "Pour le lead : où on gagne, où on perd, qui déborde. Pas d'action ici — c'est de la lecture.",
    },
  },
];

export function Sidebar({
  hasClient,
  clientName,
  clientCode,
  userName,
  clientCount,
  onLogout,
}: SidebarProps) {
  const { showHelp } = useHelpDispatch();

  return (
    <aside className="gos-sidebar">
      {/* Header — TDIA / product name */}
      <div style={{ padding: "0 6px 20px", borderBottom: "1px solid var(--tdia-hairline)", marginBottom: 20 }}>
        <div className="microlabel" style={{ fontSize: 10, letterSpacing: "0.28em", color: "var(--tdia-muted)" }}>
          TDIA · GOS
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tdia-text)", marginTop: 6, letterSpacing: "-0.01em" }}>
          Profit First
        </div>
        <div className="font-accent" style={{ fontSize: 14, color: "var(--tdia-text-2)", marginTop: -2 }}>
          Media Buying
        </div>
      </div>

      {/* Active client chip (only if one is selected) */}
      {hasClient && (
        <div
          className="card-premium"
          style={{
            padding: "12px 14px",
            marginBottom: 20,
            background: "linear-gradient(135deg, rgba(77, 159, 255, 0.06), rgba(255, 255, 255, 0.02))",
            borderColor: "rgba(77, 159, 255, 0.18)",
          }}
        >
          <div className="microlabel" style={{ fontSize: 9, color: "#9ec8ff" }}>CLIENT ACTIF</div>
          <div style={{ fontWeight: 600, marginTop: 6, fontSize: 13, color: "var(--tdia-text)" }}>
            {clientName}
          </div>
          <div className="font-data" style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 2 }}>
            {clientCode}
          </div>
        </div>
      )}

      {/* Top-level nav — 3 entries, on purpose. */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOP_ENTRIES.map((entry) => (
          <TopNavRow key={entry.to} entry={entry} onInfo={() => showHelp(entry.help)} />
        ))}
      </nav>

      {/* Spacer pushes footer down */}
      <div style={{ flex: 1 }} />

      {/* Footer: user + admin/logout */}
      <div style={{ paddingTop: 16, borderTop: "1px solid var(--tdia-hairline)" }}>
        {userName && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px 14px" }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, #4d9fff, #2f6bff)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 600, fontSize: 12,
                boxShadow: "0 0 12px rgba(47, 107, 255, 0.35)",
                flexShrink: 0,
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName}
              </div>
              {typeof clientCount === "number" && (
                <div className="font-data" style={{ fontSize: 10, color: "var(--tdia-muted)" }}>
                  {clientCount} client{clientCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 6 }}>
          <NavLink
            to="/admin"
            className="gos-btn-secondary"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", fontSize: 11, padding: "8px 12px" }}
          >
            <ArrowLeft size={13} /> Retour admin
          </NavLink>
          <button
            className="gos-btn-secondary"
            onClick={onLogout}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, padding: "8px 12px" }}
          >
            <LogOut size={13} /> Déconnexion
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopNavRow({ entry, onInfo }: { entry: TopEntry; onInfo: () => void }) {
  const Icon = entry.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <NavLink
        to={entry.to}
        end={entry.end}
        className={({ isActive }) => `gos-nav-link ${isActive ? "active" : ""}`}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Icon size={16} />
        <span>{entry.label}</span>
      </NavLink>
      <button
        aria-label={`Aide — ${entry.label}`}
        title="À quoi sert cette section ?"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfo(); }}
        style={{
          background: "transparent", border: "none", color: "var(--tdia-faint)",
          cursor: "pointer", padding: 6, display: "flex", flexShrink: 0,
          borderRadius: 6,
        }}
      >
        <Info size={13} />
      </button>
    </div>
  );
}
