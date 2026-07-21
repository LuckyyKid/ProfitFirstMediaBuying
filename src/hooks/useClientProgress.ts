import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientProgress {
  client_code: string;
  email: string | null;
  brand_name: string | null;
  client_id: string | null;
  welcome_form_submitted: boolean;
  founder_scan_submitted: boolean;
  business_deep_dive_submitted: boolean;
  video_watched: boolean;
  paid: boolean;
  contract_signed: boolean;
  kickoff_scheduled: boolean;
}

export function useClientProgress(clientCode: string | null | undefined) {
  const [progress, setProgress] = useState<ClientProgress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientCode) {
      setProgress(null);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchRow = async () => {
      const { data, error } = await supabase
        .from("client_progress")
        .select("*")
        .eq("client_code", clientCode)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("client_progress fetch error:", error);
      } else {
        setProgress((data as ClientProgress) ?? null);
      }
      setLoading(false);
    };

    fetchRow();

    // Realtime subscription on this row
    const channel = supabase
      .channel(`client_progress_${clientCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_progress",
          filter: `client_code=eq.${clientCode}`,
        },
        (payload) => {
          if (!active) return;
          if (payload.new) setProgress(payload.new as ClientProgress);
        }
      )
      .subscribe();

    // Safety fallback: poll every 5s in case realtime drops
    const interval = window.setInterval(fetchRow, 5000);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [clientCode]);

  return { progress, loading };
}

export async function upsertClientProgress(input: {
  client_code: string;
  email: string;
  brand_name: string;
  client_id?: string | null;
}) {
  const now = new Date().toISOString();
  const payload = {
    client_code: input.client_code,
    email: input.email.trim().toLowerCase(),
    brand_name: input.brand_name.trim(),
    company_name: input.brand_name.trim(),
    client_id: input.client_id ?? null,
    welcome_completed_at: now,
    last_activity_at: now,
    current_step: 2,
    updated_at: now,
  };
  const { error } = await supabase
    .from("client_progress")
    .upsert(payload, { onConflict: "client_code" });
  if (error) throw error;

  await supabase.from("client_activity_log").insert({
    client_code: input.client_code,
    event_type: "onboarding_started",
    status: "ok",
    details: { email: input.email, brand_name: input.brand_name },
  });
}
