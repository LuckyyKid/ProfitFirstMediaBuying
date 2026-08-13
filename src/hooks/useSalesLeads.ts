import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
export type BusinessType = "saas" | "ecom" | "service" | "other";

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  proposal: "Proposition",
  won: "Gagné",
  lost: "Perdu",
};

export const LEAD_STATUS_CLASS: Record<LeadStatus, string> = {
  new: "border-[rgba(148,170,215,0.4)] bg-[rgba(148,170,215,0.08)] text-[#c8d5f2]",
  contacted: "border-[rgba(77,159,255,0.4)] bg-[rgba(77,159,255,0.08)] text-[#9ec8ff]",
  qualified: "border-[rgba(200,120,255,0.4)] bg-[rgba(200,120,255,0.08)] text-[#e0b3ff]",
  proposal: "border-[rgba(255,184,77,0.4)] bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))]",
  won: "border-[rgba(122,232,180,0.4)] bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))]",
  lost: "border-[rgba(255,110,110,0.4)] bg-[rgba(255,110,110,0.08)] text-[hsl(var(--bad))]",
};

export async function updateLeadStatus(
  leadCode: string,
  status: LeadStatus,
  currentConvertedAt: string | null,
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = { status };
  if (status === "won" && !currentConvertedAt) {
    payload.converted_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("sales_leads" as any)
    .update(payload)
    .eq("lead_code", leadCode);
  return { error: error?.message ?? null };
}

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
  responded_at: string | null;
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
