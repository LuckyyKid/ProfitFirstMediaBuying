/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

type Client = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  industry?: string | null;
  am_owner?: string | null;
  launch_target_date?: string | null;
};

type Ctx = {
  selectedClient: Client | null;
  setSelectedClient: (c: Client | null) => void;
  workflowMode: GosWorkflowMode;
  setWorkflowMode: (mode: GosWorkflowMode) => void;
};

export type GosWorkflowMode = "new-client" | "active-client";

const SelectedClientCtx = createContext<Ctx>({
  selectedClient: null,
  setSelectedClient: () => {},
  workflowMode: "new-client",
  setWorkflowMode: () => {},
});

const KEY = "gos_selected_client";
const WORKFLOW_MODE_KEY = "gos_workflow_mode";

export function SelectedClientProvider({ children }: { children: ReactNode }) {
  const [selectedClient, setSelectedClientState] = useState<Client | null>(() => {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [workflowMode, setWorkflowModeState] = useState<GosWorkflowMode>(() => {
    const raw = sessionStorage.getItem(WORKFLOW_MODE_KEY);
    return raw === "active-client" ? "active-client" : "new-client";
  });

  const setSelectedClient = useCallback((c: Client | null) => {
    if (c) sessionStorage.setItem(KEY, JSON.stringify(c));
    else sessionStorage.removeItem(KEY);
    setSelectedClientState(c);
  }, []);

  const setWorkflowMode = useCallback((mode: GosWorkflowMode) => {
    sessionStorage.setItem(WORKFLOW_MODE_KEY, mode);
    setWorkflowModeState(mode);
  }, []);

  return (
    <SelectedClientCtx.Provider value={{ selectedClient, setSelectedClient, workflowMode, setWorkflowMode }}>
      {children}
    </SelectedClientCtx.Provider>
  );
}

export function useSelectedClient() {
  return useContext(SelectedClientCtx);
}

/** Sync selection from URL :clientId params. */
export function useSyncClientFromUrl(loader: (id: string) => Promise<Client | null>) {
  const { clientId } = useParams();
  const { selectedClient, setSelectedClient } = useSelectedClient();
  useEffect(() => {
    if (!clientId) return;
    if (selectedClient?.id === clientId) return;
    loader(clientId).then((c) => c && setSelectedClient(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
}
