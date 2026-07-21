import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  FileText,
  Hexagon,
  Layers,
  LayoutDashboard,
  LogOut,
  Plug,
  Plus,
  Settings,
  Shield,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTrackedRuns } from "@/agentOps/trackedRuns";

const NAV = [
  { to: "/admin/ops", label: "Vue d'ensemble", icon: LayoutDashboard, end: true },
  { to: "/admin/ops/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/admin/ops/new", label: "Nouvel audit", icon: Plus },
  { to: "/admin/ops/clients", label: "Clients", icon: Users },
  { to: "/admin/ops/pdf", label: "PDFs", icon: FileText },
];

const SECONDARY = [
  { label: "Connaissances", icon: Layers },
  { label: "Données", icon: Database },
  { label: "Intégrations", icon: Plug },
  { label: "Paramètres", icon: Settings },
];

export default function AgentOpsLayout() {
  const { isAuthed, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [tracked, setTracked] = useState<string[]>([]);
  useEffect(() => {
    const update = () => setTracked(getTrackedRuns().slice(0, 4));
    update();
    const t = setInterval(update, 3000);
    return () => clearInterval(t);
  }, []);
  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen flex w-full relative z-10 bg-[#050a1a] text-slate-200">
      <aside className="w-60 shrink-0 border-r border-white/5 bg-[#0a1226]/70 backdrop-blur-xl hidden md:flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400/30 to-sky-600/20 border border-cyan-400/30 flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-cyan-300" />
            <div className="absolute inset-0 rounded-lg ring-2 ring-cyan-400/20 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide text-slate-100">TDIA</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500">Agent Command</div>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="p-2 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-200 border border-cyan-400/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Secondary (placeholder) */}
        <div className="px-2 pt-2 pb-1">
          <div className="px-3 text-[9px] uppercase tracking-[0.25em] text-slate-600 mb-1">Bientôt</div>
          {SECONDARY.map((s) => (
            <button
              key={s.label}
              disabled
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 cursor-not-allowed"
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Recent runs */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
            <Workflow className="h-3 w-3" /> Runs récents
          </div>
          <div className="space-y-1">
            {tracked.length === 0 && (
              <div className="text-[11px] text-slate-600">Aucun run suivi.</div>
            )}
            {tracked.map((id) => (
              <NavLink
                key={id}
                to={`/admin/ops/run/${id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-md font-mono",
                    isActive
                      ? "bg-cyan-500/10 text-cyan-200"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                  )
                }
              >
                <span className="truncate">{id.slice(0, 8)}…</span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              </NavLink>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="m-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
            <Shield className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Sécurité</div>
            <div className="text-xs text-emerald-300 font-medium">Niveau maximal</div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300/90 flex-1">
            <Activity className="h-3 w-3" /> Connecté
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400" onClick={() => navigate("/admin")}>
            Classic
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400" onClick={() => { logout(); navigate("/admin/login"); }}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden relative">
        {/* subtle backdrop */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.25) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_-10%,rgba(34,211,238,0.08),transparent_50%),radial-gradient(circle_at_-10%_80%,rgba(167,139,250,0.06),transparent_50%)] pointer-events-none" />
        <div className="relative p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
