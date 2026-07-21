import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ClientJoin = { crm_clients: Pick<Tables<"crm_clients">, "id" | "company_name"> | null };

type CrmTable =
  | "crm_forecasts"
  | "crm_hypotheses"
  | "crm_live_optimization_reviews"
  | "crm_learning_library";

export function useCrmGlobalList<T extends CrmTable>(table: T) {
  type Row = Tables<T> & ClientJoin;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*, crm_clients(company_name, id)")
        .order("created_at", { ascending: false });
      if (error) toast.error(`Erreur ${table}: ${error.message}`);
      setRows(((data ?? []) as unknown) as Row[]);
      setLoading(false);
    })();
  }, [table]);

  return { rows, loading };
}
