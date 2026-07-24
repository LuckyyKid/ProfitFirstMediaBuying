// src/gos/Sidebar.tsx
//
// Design system rule #10 — Sidebar HYBRIDE.
// - Section AUJOURD'HUI en haut : 3–5 entrées top-level (Ma journée, Clients, Portefeuille).
// - Section BIBLIOTHÈQUE : toutes les pages GOS groupées par phase en accordéons repliés.
// - Footer : champ "Rechercher une page…" qui ouvre la palette ⌘K.
//
// La routine guidée (Ma journée → Mode Guidé) reste le chemin par défaut ;
// la bibliothèque est l'accès libre "rangé" que la règle #10 exige.

import { useMemo, useState, type CSSProperties } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Info, LogOut, ArrowLeft, Calendar, Users, LineChart,
  Search, ChevronRight, Building2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useHelpDispatch, type HelpContent } from "./help";
import {
  PAGE_LIBRARY,
  PHASES,
  filterPagesByBusinessType,
  groupPagesByPhase,
  lifecyclePhaseOf,
  type LifecyclePhase,
  type PageEntry,
  type PhaseKey,
} from "./pageLibrary";
import { usePhase, phaseMatches } from "./phase";
import { useSelectedClient } from "./context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useInternalAgency } from "./internalAgency";

type SidebarProps = {
  clientId: string | null;
  hasClient: boolean;
  clientName?: string | null;
  clientCode?: string | null;
  userName?: string | null;
  clientCount?: number;
  onLogout: () => void;
  onOpenPalette: () => void;
};

type TopEntry = {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  end?: boolean;
  help: HelpContent;
  lifecyclePhase: LifecyclePhase;
};

const TOP_ENTRIES: TopEntry[] = [
  {
    to: "/admin/gos",
    label: "Ma journée",
    icon: Calendar,
    end: true,
    lifecyclePhase: "active",
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
    lifecyclePhase: "both",
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
    lifecyclePhase: "both",
    help: {
      title: "Portefeuille exécutif",
      what: "Vue consolidée : contribution, ad spend, rentabilité par client, statut des routines.",
      why: "Pour le lead : où on gagne, où on perd, qui déborde. Pas d'action ici — c'est de la lecture.",
    },
  },
];

const DIM_STYLE: CSSProperties = {
  opacity: 0.45,
  transition: "opacity 0.15s ease",
};

export function Sidebar({
  clientId,
  hasClient,
  clientName,
  clientCode,
  userName,
  clientCount,
  onLogout,
  onOpenPalette,
}: SidebarProps) {
  const { showHelp } = useHelpDispatch();
  const { phase, setPhase } = usePhase();
  const { selectedClient, setSelectedClient } = useSelectedClient();
  const businessType = selectedClient?.business_type ?? null;
  const { isAdmin } = useIsAdmin();
  const { agency } = useInternalAgency();
  const navigate = useNavigate();

  const library = useMemo(
    () => groupPagesByPhase(filterPagesByBusinessType(PAGE_LIBRARY, businessType)),
    [businessType],
  );

  const openInternalAgency = () => {
    if (!agency) return;
    setSelectedClient(agency as any);
    navigate(`/admin/gos/clients/${agency.id}/workspace`);
  };
  const isAgencyActive = !!agency && selectedClient?.id === agency.id;

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

      {/* TDIA pinned workspace — admin-only shortcut to our own agency's GOS.
          Sits above the client chip because it's a workspace switcher, not a
          per-client action. */}
      {isAdmin && agency && (
        <button
          onClick={openInternalAgency}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "10px 12px",
            marginBottom: 12,
            background: isAgencyActive
              ? "linear-gradient(135deg, rgba(180, 130, 40, 0.20), rgba(180, 130, 40, 0.06))"
              : "linear-gradient(135deg, rgba(180, 130, 40, 0.10), rgba(255, 255, 255, 0.02))",
            border: isAgencyActive
              ? "1px solid rgba(210, 160, 60, 0.45)"
              : "1px solid rgba(180, 130, 40, 0.25)",
            borderRadius: 10,
            color: isAgencyActive ? "#f0d089" : "var(--tdia-text)",
            cursor: "pointer", textAlign: "left",
            transition: "all 0.15s ease",
          }}
          title="Ouvrir le workspace TDIA — nos propres métriques d'agence"
        >
          <Building2 size={15} style={{ flexShrink: 0, color: "#e0a63a" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="microlabel" style={{ fontSize: 9, color: "#e0a63a", letterSpacing: "0.20em" }}>
              NOTRE AGENCE
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, letterSpacing: "-0.01em" }}>
              {agency.company_name}
            </div>
          </div>
        </button>
      )}

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

      {/* Phase toggle — "Nouveau client" vs "Client actif". Dims (doesn't hide)
          items whose lifecycle phase doesn't match, so the sidebar stays a
          full roadmap regardless of where the client currently is. */}
      <PhaseToggle phase={phase} onChange={setPhase} />

      {/* AUJOURD'HUI — routine guidée */}
      <div className="microlabel" style={{ padding: "0 6px 8px", fontSize: 9, color: "var(--tdia-muted)" }}>
        AUJOURD'HUI
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOP_ENTRIES.map((entry) => (
          <TopNavRow
            key={entry.to}
            entry={entry}
            dimmed={!phaseMatches(entry.lifecyclePhase, phase)}
            onInfo={() => showHelp(entry.help)}
          />
        ))}
      </nav>

      {/* Hairline dégradée */}
      <div style={{
        height: 1,
        margin: "18px 6px",
        background: "linear-gradient(90deg, rgba(148, 170, 215, 0.15), transparent)",
      }} />

      {/* BIBLIOTHÈQUE — accès libre */}
      <div className="microlabel" style={{ padding: "0 6px 8px", fontSize: 9, color: "var(--tdia-muted)" }}>
        BIBLIOTHÈQUE · ACCÈS LIBRE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {PHASES.map((section) => (
          <PhaseAccordion
            key={section.key}
            phaseKey={section.key}
            phaseLabel={section.label}
            entries={library[section.key]}
            clientId={clientId}
            lifecyclePhase={phase}
          />
        ))}
      </div>

      {/* Spacer pushes footer down */}
      <div style={{ flex: 1, minHeight: 20 }} />

      {/* Search field → opens ⌘K palette */}
      <button
        onClick={onOpenPalette}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "9px 12px",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(148, 170, 215, 0.12)",
          borderRadius: 10, color: "var(--tdia-muted)",
          fontSize: 12, cursor: "pointer", textAlign: "left",
          marginBottom: 14,
        }}
      >
        <Search size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Rechercher une page…</span>
        <span className="font-data" style={{
          fontSize: 10, color: "var(--tdia-faint)",
          padding: "2px 6px", borderRadius: 4,
          border: "1px solid rgba(148, 170, 215, 0.15)",
        }}>
          ⌘K
        </span>
      </button>

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

function TopNavRow({ entry, dimmed, onInfo }: { entry: TopEntry; dimmed: boolean; onInfo: () => void }) {
  const Icon = entry.icon;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 2,
        ...(dimmed ? DIM_STYLE : { transition: "opacity 0.15s ease" }),
      }}
      title={dimmed ? "Non prioritaire dans la phase courante" : undefined}
    >
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

function PhaseToggle({ phase, onChange }: { phase: LifecyclePhase; onChange: (p: LifecyclePhase) => void }) {
  const options: Array<{ key: LifecyclePhase; label: string }> = [
    { key: "new",    label: "Nouveau" },
    { key: "active", label: "Actif" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Phase du client"
      style={{
        display: "flex", padding: 3, marginBottom: 18,
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(148, 170, 215, 0.12)",
        borderRadius: 10, gap: 3,
      }}
    >
      {options.map((opt) => {
        const selected = opt.key === phase;
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1, padding: "7px 8px", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.02em",
              background: selected
                ? "linear-gradient(135deg, rgba(77, 159, 255, 0.18), rgba(47, 107, 255, 0.06))"
                : "transparent",
              color: selected ? "#eef2fa" : "var(--tdia-muted)",
              border: selected ? "1px solid rgba(77, 159, 255, 0.28)" : "1px solid transparent",
              borderRadius: 7, cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PhaseAccordion({
  phaseKey,
  phaseLabel,
  entries,
  clientId,
  lifecyclePhase,
}: {
  phaseKey: PhaseKey;
  phaseLabel: string;
  entries: PageEntry[];
  clientId: string | null;
  lifecyclePhase: LifecyclePhase;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const loc = useLocation();

  const activeEntry = entries.find((entry) => {
    const href = entry.buildHref(clientId);
    return href && (loc.pathname === href || loc.pathname.startsWith(href + "/"));
  });

  // Dim the whole section header if none of its entries match the current
  // lifecycle phase (e.g. Review section during "Nouveau client").
  const sectionMatches = entries.some((e) => phaseMatches(lifecyclePhaseOf(e), lifecyclePhase));

  const shouldOpen = open || !!activeEntry;
  const visible = shouldOpen ? (showAll ? entries : entries.slice(0, 4)) : [];
  const overflow = entries.length - 4;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "8px 12px",
          background: "transparent", border: "1px solid transparent",
          borderRadius: 8, color: "var(--tdia-text-2)",
          fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "left",
          ...(sectionMatches ? { transition: "opacity 0.15s ease" } : DIM_STYLE),
        }}
      >
        <ChevronRight
          size={12}
          style={{
            color: "var(--tdia-faint)", flexShrink: 0,
            transition: "transform .15s ease",
            transform: shouldOpen ? "rotate(90deg)" : "none",
          }}
        />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {phaseLabel}
        </span>
        <span className="font-data" style={{ fontSize: 10, color: "var(--tdia-faint)" }}>
          {entries.length}
        </span>
      </button>

      {shouldOpen && (
        <div style={{
          position: "relative", marginLeft: 12, paddingLeft: 12,
          borderLeft: "1px solid rgba(148, 170, 215, 0.12)",
          display: "flex", flexDirection: "column", gap: 1,
          padding: "4px 0 6px 12px",
        }}>
          {visible.map((entry) => {
            const href = entry.buildHref(clientId);
            const disabled = !href;
            const isActive = activeEntry?.key === entry.key;
            const matches = phaseMatches(lifecyclePhaseOf(entry), lifecyclePhase);
            // If both disabled and phase-mismatched, keep the stronger fade
            // (disabled 0.5) — never stack opacities below ~0.35 legibility.
            const opacity = disabled ? 0.5 : matches ? 1 : 0.45;
            return (
              <NavLink
                key={entry.key}
                to={href ?? "#"}
                onClick={(e) => { if (disabled) e.preventDefault(); }}
                title={
                  disabled
                    ? "Sélectionne un client d'abord"
                    : matches
                      ? undefined
                      : "Non prioritaire dans la phase courante"
                }
                style={{
                  display: "block", padding: "6px 10px", borderRadius: 6,
                  fontSize: 12,
                  color: disabled ? "var(--tdia-faint)" : (isActive ? "#9ec8ff" : "var(--tdia-text-2)"),
                  textDecoration: "none",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(77, 159, 255, 0.10), rgba(47, 107, 255, 0.03))"
                    : "transparent",
                  border: isActive ? "1px solid rgba(77, 159, 255, 0.22)" : "1px solid transparent",
                  opacity,
                  transition: "opacity 0.15s ease",
                  cursor: disabled ? "not-allowed" : "pointer",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {entry.label}
              </NavLink>
            );
          })}
          {!showAll && overflow > 0 && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                padding: "6px 10px", background: "transparent", border: "none",
                textAlign: "left", color: "var(--tdia-muted)",
                fontSize: 11, cursor: "pointer",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                letterSpacing: "0.03em",
              }}
            >
              + {overflow} autre{overflow > 1 ? "s" : ""}…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
