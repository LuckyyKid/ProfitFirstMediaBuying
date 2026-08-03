import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auth + client_code resolution for the client portal.
 * Uses SECURITY DEFINER RPC `current_portal_client_code` to fetch the
 * client_code bound to the currently authenticated user.
 */
export function usePortalAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [clientCode, setClientCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve(s: Session | null) {
      setSession(s);
      if (!s) {
        setClientCode(null);
        setError(null);
        setReady(true);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase as any).rpc("current_portal_client_code");
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setClientCode(null);
      } else {
        setClientCode((data as string | null) ?? null);
        setError(null);
      }
      setReady(true);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => { resolve(s); });
    supabase.auth.getSession().then(({ data }) => { resolve(data.session); });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setClientCode(null);
  }

  return {
    session,
    clientCode,
    isAuthed: !!session,
    ready,
    error,
    logout,
  };
}
