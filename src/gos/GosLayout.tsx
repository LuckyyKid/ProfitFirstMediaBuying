import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { SelectedClientProvider, useSelectedClient, type GosWorkflowMode } from "./context";
import { HelpProvider, HelpDrawer, HelpButton } from "./help";
import {
  LayoutDashboard, Users, UserPlus, Briefcase, Settings2, Activity, Target,
  Boxes, BarChart3, CalendarClock, Wand2, Map, Zap, RefreshCw, GraduationCap,
  Rocket, LogOut, ArrowLeft, FileText, Sparkles, DollarSign, Database, Flag, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import "./tokens.css";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; needsClient?: boolean };
type NavGroup = { group: string; items: NavItem[] };

function buildNav(clientId: string | null, workflowMode: GosWorkflowMode): NavGroup[] {
  const cid = clientId ?? "__none__";
  const portfolio: NavGroup = {
    group: "Portfolio",
    items: workflowMode === "new-client" ? [
      { to: "/admin/gos", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/admin/gos/clients", label: "Clients", icon: Users },
      { to: "/admin/gos/clients/new", label: "Nouveau client", icon: UserPlus },
    ] : [
      { to: "/admin/gos", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/admin/gos/portfolio", label: "Portefeuille exécutif", icon: BarChart3 },
      { to: "/admin/gos/clients", label: "Clients", icon: Users },
    ],
  };

  if (workflowMode === "new-client") {
    return [
      portfolio,
      { group: "Setup Client", items: [
      { to: `/admin/gos/clients/${cid}/workspace`, label: "Espace client", icon: Briefcase, needsClient: true },
      { to: `/admin/gos/clients/${cid}/growth-model-setup`, label: "Configuration du modèle", icon: Settings2, needsClient: true },
      { to: `/admin/gos/clients/${cid}/business-objectives`, label: "Objectifs business", icon: Flag, needsClient: true },
      { to: "/admin/gos/data-sources", label: "Intégrations", icon: Database, needsClient: true },
      { to: `/admin/gos/clients/${cid}/manual-checklist`, label: "Checklist données manuelles", icon: FileText, needsClient: true },
      ]},
      { group: "Plan 30 jours", items: [
      { to: `/admin/gos/clients/${cid}/profit-first-workspace`, label: "Profit-First Workspace", icon: Rocket, needsClient: true },
      { to: `/admin/gos/clients/${cid}/growth-diagnosis`, label: "Diagnostic de croissance", icon: Activity, needsClient: true },
      { to: `/admin/gos/clients/${cid}/event-effect`, label: "Effet d'événement", icon: Target, needsClient: true },
      { to: `/admin/gos/clients/${cid}/retention`, label: "Rétention", icon: Users, needsClient: true },
      { to: `/admin/gos/clients/${cid}/spending-power`, label: "Pouvoir de dépense", icon: DollarSign, needsClient: true },
      { to: `/admin/gos/clients/${cid}/forecast`, label: "Prévisions", icon: CalendarClock, needsClient: true },
      { to: `/admin/gos/clients/${cid}/metric-targets`, label: "Objectifs de métriques", icon: Target, needsClient: true },
      { to: `/admin/gos/clients/${cid}/weekly-pnl`, label: "P&L hebdomadaire", icon: CalendarClock, needsClient: true },
      { to: `/admin/gos/clients/${cid}/daily-pnl`, label: "P&L journalier", icon: CalendarClock, needsClient: true },
      { to: `/admin/gos/clients/${cid}/creative-demand`, label: "Besoin en créatifs", icon: Wand2, needsClient: true },
      { to: `/admin/gos/clients/${cid}/sku-demand-plan`, label: "Plan de demande SKU", icon: Boxes, needsClient: true },
      ]},
      { group: "Creative Foundation", items: [
      { to: `/admin/gos/clients/${cid}/offer-lab`, label: "Offer Lab", icon: DollarSign, needsClient: true },
      { to: `/admin/gos/clients/${cid}/concept-log`, label: "Concept Log", icon: Sparkles, needsClient: true },
      { to: `/admin/gos/clients/${cid}/creative-brief`, label: "Ultimate Brief", icon: Wand2, needsClient: true },
      ]},
      { group: "Campaign Setup", items: [
      { to: `/admin/gos/clients/${cid}/campaign-categories`, label: "Catégories de campagnes", icon: FileText, needsClient: true },
      { to: `/admin/gos/clients/${cid}/buyer-workspace`, label: "Buyer Workspace", icon: Briefcase, needsClient: true },
      ]},
    ];
  }

  return [
    portfolio,
    { group: "Daily Execution", items: [
      { to: `/admin/gos/clients/${cid}/walkdown`, label: "Walkdown métriques", icon: BarChart3, needsClient: true },
      { to: `/admin/gos/clients/${cid}/buyer-workspace`, label: "Buyer Workspace", icon: Briefcase, needsClient: true },
      { to: `/admin/gos/clients/${cid}/daily-budget-planner`, label: "Daily Budget Planner", icon: DollarSign, needsClient: true },
      { to: `/admin/gos/clients/${cid}/media-buying-automation`, label: "Media Buying Automation", icon: Zap, needsClient: true },
      { to: `/admin/gos/clients/${cid}/budget-change-gate`, label: "Budget Change Gate", icon: ShieldCheck, needsClient: true },
      { to: `/admin/gos/clients/${cid}/live-optimization`, label: "Optimisation live", icon: Zap, needsClient: true },
      { to: `/admin/gos/clients/${cid}/map-notes`, label: "Map Notes (daily)", icon: FileText, needsClient: true },
      { to: `/admin/gos/clients/${cid}/daily-digest`, label: "Daily Digest 7h", icon: FileText, needsClient: true },
    ]},
    { group: "Review", items: [
      { to: `/admin/gos/clients/${cid}/wayfinder-wednesday`, label: "Wayfinder Wednesday", icon: CalendarClock, needsClient: true },
      { to: `/admin/gos/clients/${cid}/measurement`, label: "Mesure", icon: BarChart3, needsClient: true },
      { to: `/admin/gos/clients/${cid}/forecast-updates`, label: "Mises à jour prévisions", icon: RefreshCw, needsClient: true },
      { to: `/admin/gos/clients/${cid}/weekly-executive-report`, label: "Weekly Executive Report", icon: FileText, needsClient: true },
    ]},
    { group: "Fin de cycle", items: [
      { to: `/admin/gos/clients/${cid}/learning-loop`, label: "Boucle d'apprentissage", icon: GraduationCap, needsClient: true },
      { to: `/admin/gos/clients/${cid}/next-cycle-planning`, label: "Planification prochain cycle", icon: Rocket, needsClient: true },
    ]},
    { group: "Creative Rescue", items: [
      { to: `/admin/gos/clients/${cid}/concept-log`, label: "Concept Log", icon: Sparkles, needsClient: true },
      { to: `/admin/gos/clients/${cid}/testing-roadmap`, label: "Testing Roadmap", icon: Rocket, needsClient: true },
      { to: `/admin/gos/clients/${cid}/offer-lab`, label: "Offer Lab", icon: DollarSign, needsClient: true },
      { to: `/admin/gos/clients/${cid}/angle-audience-matrix`, label: "Angle × Audience Matrix", icon: Map, needsClient: true },
      { to: `/admin/gos/clients/${cid}/creative-brief`, label: "Ultimate Brief", icon: Wand2, needsClient: true },
      { to: `/admin/gos/clients/${cid}/growth-execution-map`, label: "Carte d'exécution", icon: Map, needsClient: true },
    ]},
  ];
}

function Sidebar() {
  const { selectedClient, workflowMode, setWorkflowMode } = useSelectedClient();
  const { logout } = useAdminAuth();
  const nav = buildNav(selectedClient?.id ?? null, workflowMode);
  const hasClient = !!selectedClient;
  const workflowModes: { key: GosWorkflowMode; label: string; hint: string }[] = [
    { key: "new-client", label: "Nouveau client", hint: "Setup + plan" },
    { key: "active-client", label: "Client actif", hint: "Routine AM" },
  ];

  return (
    <aside className="gos-sidebar">
      <div style={{ padding: "0 12px 8px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--tdia-muted)", fontWeight: 600 }}>TDIA</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--tdia-text)", marginTop: 2 }}>Profit First Media Buying</div>
      </div>

      {selectedClient && (
        <div className="gos-card" style={{ margin: "12px 8px", padding: 12 }}>
          <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>CLIENT ACTIF</div>
          <div style={{ fontWeight: 600, marginTop: 4, fontSize: 14, color: "var(--tdia-text)" }}>{selectedClient.company_name}</div>
          <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontFamily: "monospace" }}>{selectedClient.client_code}</div>
        </div>
      )}

      <div className="gos-card" style={{ margin: "12px 8px", padding: 8 }}>
        <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Mode sidebar
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {workflowModes.map((mode) => {
            const active = workflowMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => setWorkflowMode(mode.key)}
                className={active ? "gos-btn-primary" : "gos-btn-secondary"}
                style={{ textAlign: "left", padding: "8px 10px" }}
              >
                <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>{mode.label}</span>
                <span style={{ display: "block", fontSize: 10, opacity: 0.72, marginTop: 2 }}>{mode.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {nav.map((group) => (
        <div key={group.group} className="gos-sidebar-group">
          <div className="gos-sidebar-group-label">{group.group}</div>
          {group.items.map((it) => {
            const disabled = it.needsClient && !hasClient;
            return (
              <NavLink
                key={it.to}
                to={disabled ? "#" : it.to}
                end={it.end}
                title={disabled ? "Sélectionne d'abord un client" : it.label}
                className={({ isActive }) =>
                  `gos-nav-link ${isActive && !disabled ? "active" : ""} ${disabled ? "disabled" : ""}`
                }
                onClick={(e) => { if (disabled) e.preventDefault(); }}
              >
                <it.icon size={16} />
                <span>{it.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: 24, padding: "0 8px", display: "grid", gap: 8 }}>
        <NavLink to="/admin" className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Retour à l'admin
        </NavLink>
        <button className="gos-btn-secondary" onClick={logout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </aside>
  );
}

export default function GosLayout() {
  const { isAuthed } = useAdminAuth();
  const loc = useLocation();
  if (!isAuthed) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  return (
    <SelectedClientProvider>
      <HelpProvider>
        <div className="gos-root twenty-theme" style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column" }}>
            <Outlet />
          </main>
          <HelpDrawer />
          <HelpButton />
        </div>
      </HelpProvider>
    </SelectedClientProvider>
  );
}
