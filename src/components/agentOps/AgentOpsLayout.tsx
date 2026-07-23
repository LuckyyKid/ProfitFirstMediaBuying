// Mission-control layout — top bar unique (pas de sidebar). Fond premium
// (#04060b + halo radial bleu centré) + badge santé API mesurée en live.
// Voir 5a-admin-ops-jarvis.png.

import { Link, Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogOut } from "lucide-react";
import { tdia } from "@/agentOps/service";

const BG       = "#04060b";
const HALO     = "radial-gradient(1200px 700px at 50% 20%, rgba(47,107,255,0.16), transparent 65%)";
const BLUE     = "#4d9fff";
const BLUE_DK  = "#2f6bff";
const GOOD     = "#3ddc97";
const BAD      = "#ff6b6b";
const HAIRLINE = "rgba(148,170,215,0.10)";
const FAINT    = "rgba(148,170,215,0.70)";

function useApiLatency() {
  return useQuery({
    queryKey: ["tdia-health"],
    queryFn: async () => {
      const t0 = performance.now();
      try {
        await tdia.health();
        return { ok: true, ms: Math.round(performance.now() - t0) };
      } catch {
        return { ok: false, ms: Math.round(performance.now() - t0) };
      }
    },
    refetchInterval: 15_000,
  });
}

function HeaderBar({ onLogout }: { onLogout: () => void }) {
  const health = useApiLatency();
  const ok = health.data?.ok !== false;
  const ms = health.data?.ms ?? 0;

  const navItem = (to: string, label: string, end?: boolean) => (
    <NavLink
      to={to}
      end={end}
      className="px-3 py-1.5 rounded-md text-[12px] transition-colors"
      style={({ isActive }) => ({
        color: isActive ? "#e0ecff" : FAINT,
        background: isActive ? "rgba(77,159,255,0.10)" : "transparent",
        border: `1px solid ${isActive ? "rgba(77,159,255,0.28)" : "transparent"}`,
      })}
    >
      {label}
    </NavLink>
  );

  return (
    <header
      className="flex items-center justify-between px-10 py-4 sticky top-0 z-20 backdrop-blur"
      style={{ background: "rgba(4,6,11,0.72)", borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors shrink-0 hover:bg-white/[0.04]"
          style={{ color: FAINT, border: `1px solid ${HAIRLINE}` }}
          title="Retour à l'admin"
        >
          <ArrowLeft className="h-3 w-3" />
          Admin
        </Link>
        <span className="h-4 w-px shrink-0" style={{ background: HAIRLINE }} />
        <span className="font-mono uppercase shrink-0" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>
          TDIA · AUDIT ENGINE
        </span>
        <span className="h-4 w-px shrink-0" style={{ background: HAIRLINE }} />
        <nav className="flex items-center gap-1">
          {navItem("/admin/ops", "Audits", true)}
          {navItem("/admin/ops/clients", "Clients")}
          {navItem("/admin/ops/pipeline", "Pipeline")}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full"
            style={{
              width: 5, height: 5,
              background: ok ? GOOD : BAD,
              boxShadow: ok ? `0 0 8px ${GOOD}` : `0 0 8px ${BAD}`,
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              color: ok ? "rgba(180,220,200,0.85)" : "rgba(230,180,180,0.85)",
            }}
          >
            {ok ? "SYSTÈME LIVE" : "SYSTÈME HS"} · {ms} MS
          </span>
        </div>
        <NavLink
          to="/admin/ops/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12.5px] font-medium"
          style={{
            color: "#f0f6ff",
            background: `linear-gradient(180deg, ${BLUE}, ${BLUE_DK})`,
            boxShadow: `0 0 22px rgba(77,159,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)`,
            border: `1px solid rgba(77,159,255,0.55)`,
          }}
        >
          + Nouvel audit
        </NavLink>
        <button
          onClick={onLogout}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors"
          style={{ color: FAINT, border: `1px solid transparent` }}
          title="Se déconnecter"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

export default function AgentOpsLayout() {
  const { isAuthed, logout } = useAdminAuth();
  const navigate = useNavigate();
  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div
      className="min-h-screen w-full relative"
      style={{ background: BG, color: "#f2f4fb" }}
    >
      {/* halo radial centré — un seul */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: HALO }} />

      <div className="relative">
        <HeaderBar onLogout={() => { logout(); navigate("/admin/login"); }} />
        <main className="relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
