import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { SelectedClientProvider, useSelectedClient } from "./context";
import { HelpProvider, HelpDrawer, HelpButton } from "./help";
import { Sidebar } from "./Sidebar";
import "./tokens.css";

function LayoutInner() {
  const { selectedClient } = useSelectedClient();
  const { session, logout } = useAdminAuth();

  const userEmail = session?.user?.email ?? null;
  const userName = userEmail ? userEmail.split("@")[0] : null;

  return (
    <div className="gos-root" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        clientId={selectedClient?.id ?? null}
        hasClient={!!selectedClient}
        clientName={selectedClient?.company_name}
        clientCode={selectedClient?.client_code}
        userName={userName}
        onLogout={logout}
      />
      <main style={{ flex: 1, minWidth: 0, padding: "32px 40px", width: "100%" }}>
        <Outlet />
      </main>
      <HelpDrawer />
      <HelpButton />
    </div>
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
