import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Supabase v2 persiste la session dans localStorage sous cette clé.
const STORAGE_KEY = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // v2 shape: { access_token, refresh_token, expires_at, user, ... }
    if (parsed?.access_token && parsed?.expires_at && parsed.expires_at * 1000 > Date.now()) {
      return parsed as Session;
    }
    return null;
  } catch { return null; }
}

type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Admin auth backed by Supabase Auth.
 * `isAuthed` est initialisé **synchronement** depuis localStorage pour
 * éviter le race condition entre les gardes <Navigate/> et getSession().
 */
export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(a: string, b?: string): Promise<LoginResult> {
    setAuthError(null);
    const email = b !== undefined ? a : (localStorage.getItem("tdia_admin_identifier") ?? "").trim();
    const password = b !== undefined ? b : a;
    if (!email || !password) {
      const message = "Email et mot de passe requis.";
      setAuthError(message);
      return { ok: false, error: message };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const message = error?.message ?? "Aucune session Supabase n'a ete retournee.";
      setAuthError(message);
      return { ok: false, error: message };
    }
    setSession(data.session);
    return { ok: true };
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    try { sessionStorage.removeItem("tdia_admin_token"); } catch { /* ignore storage errors */ }
  }

  return {
    session,
    token: session?.access_token ?? null,
    isAuthed: !!session,
    ready,
    authError,
    login,
    logout,
  };
}
