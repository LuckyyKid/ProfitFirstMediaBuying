import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientInfo {
  client: Record<string, any> & {
    stripe_link?: string;
    docusign_link?: string;
    name?: string;
    deal_value?: number;
  };
  lead?: Record<string, any>;
  caller_name?: string;
}

const STORAGE_KEY = "tdia_client_info";
const ENDPOINT =
  "https://ytnrkpabzskqwpozqato.supabase.co/functions/v1/get-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MASTER_CODES: Record<string, string> = {
  isaacboss: "Isaac",
  bafingboss: "Bafing",
  mahdiboss: "Mahdi",
};

async function fetchLocalClient(identifier: string): Promise<ClientInfo | null> {
  const isUuid = UUID_RE.test(identifier);
  const query = supabase.from("client_progress").select("*");
  const { data, error } = isUuid
    ? await query.or(`client_id.eq.${identifier},client_code.eq.${identifier}`).maybeSingle()
    : await query.eq("client_code", identifier).maybeSingle();
  if (error || !data) return null;
  return {
    client: {
      ...data,
      id: data.client_id && UUID_RE.test(data.client_id) ? data.client_id : null,
      name: data.client_name || data.company_name,
      deal_value: data.deal_value || 0,
    },
    caller_name: data.client_name || data.company_name || undefined,
  };
}

export async function fetchClient(identifier: string): Promise<ClientInfo> {
  const trimmed = identifier.trim();
  const lower = trimmed.toLowerCase();

  if (MASTER_CODES[lower]) {
    return {
      client: {
        id: `master-${lower}`,
        client_code: trimmed,
        name: `${MASTER_CODES[lower]} (Master)`,
        deal_value: 0,
      },
      caller_name: MASTER_CODES[lower],
    } as ClientInfo;
  }

  const body = UUID_RE.test(trimmed)
    ? { client_id: trimmed }
    : { client_code: trimmed };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) return data as ClientInfo;
  } catch {
    // ignore — try local fallback
  }

  // Fallback: lookup in local client_progress (deals created locally)
  const local = await fetchLocalClient(trimmed);
  if (local) return local;

  throw new Error("Client introuvable");
}

export function saveClient(info: ClientInfo) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

export function useClient() {
  const [info, setInfo] = useState<ClientInfo | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ClientInfo) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        setInfo(raw ? JSON.parse(raw) : null);
      } catch {
        setInfo(null);
      }
    };
    window.addEventListener("tdia-client-updated", handler);
    return () => window.removeEventListener("tdia-client-updated", handler);
  }, []);

  const update = useCallback((next: ClientInfo) => {
    saveClient(next);
    setInfo(next);
    window.dispatchEvent(new Event("tdia-client-updated"));
  }, []);

  return { info, setClient: update };
}
