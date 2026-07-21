import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  LayoutDashboard, Users, Lightbulb, TrendingUp, Activity,
  BookOpen, ScrollText, Settings as SettingsIcon, ArrowLeft, Cpu
} from "lucide-react";

const navItems = [
  { to: "/admin/crm", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/crm/clients", label: "Clients", icon: Users },
  { to: "/admin/crm/hypotheses", label: "Hypotheses", icon: Lightbulb },
  { to: "/admin/crm/forecasts", label: "Forecasts", icon: TrendingUp },
  { to: "/admin/crm/live-optimization", label: "Live Optimization", icon: Activity },
  { to: "/admin/crm/model-runs", label: "Model Runs", icon: Cpu },
  { to: "/admin/crm/learning", label: "Learning Library", icon: BookOpen },
  { to: "/admin/crm/methodology", label: "Methodology", icon: ScrollText },
  { to: "/admin/crm/settings", label: "Settings", icon: SettingsIcon },
];

export default function CrmLayout() {
  const { isAuthed } = useAdminAuth();
  const loc = useLocation();
  if (!isAuthed) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  return (
    <div className="twenty-theme h-screen flex bg-background text-foreground overflow-hidden">
      <aside className="w-56 border-r border-border bg-secondary/40 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">TDIA</div>
          <div className="text-sm font-semibold text-foreground">Intelligence CRM</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <it.icon className="h-3.5 w-3.5" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <NavLink
            to="/admin"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour Admin
          </NavLink>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
