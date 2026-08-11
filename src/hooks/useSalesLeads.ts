import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
export type BusinessType = "saas" | "ecom" | "service" | "other";

export interface SalesRep {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface SalesLead {
  lead_code: string;
  created_at: string;
  updated_at: string;
  first_contact_at: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  industry: string | null;
  business_type: BusinessType | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  qualification_score: number | null;
  onboarding_booked_at: string | null;
  owner_id: string | null;
  next_followup_at: string | null;
  last_followup_at: string | null;
  followup_count: number;
  notes: string | null;
  converted_client_code: string | null;
  converted_at: string | null;
}

export function useSalesLeads() {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [leadsRes, repsRes] = await Promise.all([
      supabase
        .from("sales_leads" as any)
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("sales_reps" as any)
        .select("*")
        .order("name", { ascending: true }),
    ]);
    setLeads(((leadsRes.data as unknown) as SalesLead[] | null) ?? []);
    setReps(((repsRes.data as unknown) as SalesRep[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { leads, reps, loading, reload: load };
}
