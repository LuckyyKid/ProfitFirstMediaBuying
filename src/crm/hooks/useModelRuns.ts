import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type ModelRun = {
  id: string;
  client_id: string | null;
  model_name: string;
  model_version: string;
  input_json: any;
  output_json: any;
  formula_used: any;
  generated_at: string;
  generated_by: string | null;
  am_approved: boolean;
  am_override: boolean;
  override_reason: string | null;
};

export type CrmClientBrief = Pick<Tables<"crm_clients">, "id" | "company_name" | "main_contact_name">;

export function useCrmClientBriefs() {
  const [clients, setClients] = useState<CrmClientBrief[]>([]);

  useEffect(() => {
    supabase
      .from("crm_clients")
      .select("id, company_name, main_contact_name")
      .order("company_name")
      .then(({ data }) => setClients(((data ?? []) as unknown) as CrmClientBrief[]));
  }, []);

  return clients;
}

export function useModelRuns(clientId: string) {
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("model_runs" as any).select("*").order("generated_at", { ascending: false }).limit(200);
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRuns(((data as unknown) as ModelRun[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const setApproval = async (id: string, am_approved: boolean) => {
    const { error } = await supabase.from("model_runs" as any).update({ am_approved }).eq("id", id);
    if (error) return toast.error(error.message);
    setRuns((r) => r.map((x) => (x.id === id ? { ...x, am_approved } : x)));
  };

  const setOverride = async (id: string, override_reason: string) => {
    const am_override = override_reason.trim().length > 0;
    const { error } = await supabase
      .from("model_runs" as any)
      .update({ am_override, override_reason: am_override ? override_reason : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRuns((r) =>
      r.map((x) =>
        x.id === id ? { ...x, am_override, override_reason: am_override ? override_reason : null } : x,
      ),
    );
  };

  return { runs, loading, reload: load, setApproval, setOverride };
}
