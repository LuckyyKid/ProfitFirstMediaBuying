import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCrmSingle<T = any>(table: string, clientId?: string) {
  const [row, setRow] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from(table as any)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow(data as T);
    setLoading(false);
  }, [table, clientId]);
  useEffect(() => { load(); }, [load]);
  return { row, loading, reload: load, setRow };
}

export async function upsertCrmSingle(table: string, clientId: string, existing: any, values: any) {
  const payload = { ...values, client_id: clientId };
  if (existing?.id) {
    const { error } = await supabase.from(table as any).update(payload).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase.from(table as any).insert(payload).select("id").single();
  if (error) throw error;
  return (data as any)?.id;
}
