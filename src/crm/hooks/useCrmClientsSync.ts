import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type CrmClient = Tables<"crm_clients">;

async function syncFromClosedDeals(): Promise<number> {
  const { data: deals, error } = await supabase
    .from("client_progress")
    .select("client_code, company_name, client_name, deal_value, created_at")
    .not("client_code", "is", null);
  if (error) throw error;

  const { data: existing } = await supabase.from("crm_clients").select("client_code");
  const known = new Set((existing ?? []).map((r) => r.client_code));

  const toInsert = (deals ?? [])
    .filter((d) => d.client_code && !known.has(d.client_code))
    .map((d) => ({
      client_code: d.client_code as string,
      company_name: d.company_name || d.client_name || d.client_code!,
      main_contact_name: d.client_name ?? null,
      deal_value: d.deal_value ?? null,
      closing_date: d.created_at ? new Date(d.created_at).toISOString().slice(0, 10) : null,
      current_phase: "Onboarding",
      risk_level: "Low",
    }));

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("crm_clients").insert(toInsert);
    if (insErr) throw insErr;
  }
  return toInsert.length;
}

export function useCrmClientsSync() {
  const [rows, setRows] = useState<CrmClient[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("crm_clients")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as CrmClient[]);
  }, []);

  const runSync = useCallback(
    async (verbose: boolean) => {
      setSyncing(true);
      try {
        const n = await syncFromClosedDeals();
        await load();
        if (verbose) {
          toast.success(n > 0 ? `${n} client(s) importé(s) depuis les deals` : "Portefeuille à jour");
        }
      } catch (e: any) {
        if (verbose) toast.error(e.message);
      } finally {
        setSyncing(false);
      }
    },
    [load],
  );

  useEffect(() => {
    runSync(false);
    const channel = supabase
      .channel("crm_clients_sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_progress" },
        () => runSync(false),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [runSync]);

  return { rows, syncing, runSync };
}
