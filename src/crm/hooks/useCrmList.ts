import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCrmList<T = any>(table: string, clientId?: string, orderBy = "created_at") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from(table as any).select("*").order(orderBy, { ascending: false });
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) toast.error(`Erreur ${table}: ${error.message}`);
    setRows((data as T[]) ?? []);
    setLoading(false);
  }, [table, clientId, orderBy]);
  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load, setRows };
}
