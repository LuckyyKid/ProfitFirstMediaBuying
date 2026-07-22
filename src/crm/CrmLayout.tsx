import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Microscope, Lightbulb, TrendingUp, Activity,
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
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border/60 bg-card/40 backdrop-blur px-3 py-4 flex flex-col gap-1 sticky top-0 h-screen">
        <div className="px-2 pb-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">TDIA</div>
          <div className="text-lg font-semibold">Intelligence CRM</div>
        </div>
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`
            }
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
        <div className="mt-auto pt-4">
          <Button asChild variant="outline" size="sm" className="w-full">
            <NavLink to="/admin"><ArrowLeft className="h-3 w-3 mr-1" /> Retour Admin</NavLink>
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6">
        <Outlet />
      </main>
    </div>
  );
}
