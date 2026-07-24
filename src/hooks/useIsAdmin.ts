import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Wrapper around the SECURITY DEFINER RPC `is_global_admin()`. The RPC reads
// user_roles for the current session, so a stale client-side cache of the
// role would never leak — it always round-trips through Postgres.
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("is_global_admin");
      if (cancelled) return;
      setIsAdmin(!error && !!data);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, ready };
}
