import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { SelectedClientProvider, useSelectedClient } from "./context";
import { HelpProvider, HelpDrawer, HelpButton } from "./help";
import { Sidebar } from "./Sidebar";
import { CommandPalette, useCommandPaletteHotkey } from "./CommandPalette";
import { RoutineBanner, RoutineBannerProvider } from "./RoutineBanner";
import { PhaseProvider } from "./phase";
import "./tokens.css";

function LayoutInner() {
  const { selectedClient } = useSelectedClient();
  const { session, logout } = useAdminAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteHotkey(setPaletteOpen);

  const userEmail = session?.user?.email ?? null;
  const userName = userEmail ? userEmail.split("@")[0] : null;

  return (
    <PhaseProvider clientId={selectedClient?.id ?? null}>
      <div className="gos-root" style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          clientId={selectedClient?.id ?? null}
          hasClient={!!selectedClient}
          clientName={selectedClient?.company_name}
          clientCode={selectedClient?.client_code}
          userName={userName}
          onLogout={logout}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px", width: "100%" }}>
          <RoutineBannerProvider>
            <RoutineBanner />
            <Outlet />
          </RoutineBannerProvider>
        </main>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <HelpDrawer />
        <HelpButton />
      </div>
    </PhaseProvider>
  );
}

export default function GosLayout() {
  const { isAuthed } = useAdminAuth();
  const loc = useLocation();
  if (!isAuthed) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  return (
    <SelectedClientProvider>
      <HelpProvider>
        <LayoutInner />
      </HelpProvider>
    </SelectedClientProvider>
  );
}
