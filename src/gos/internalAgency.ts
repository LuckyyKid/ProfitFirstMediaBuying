// The TDIA workspace is a phantom gos_clients row that lets us run our own
// agency metrics through the same GOS pipeline as our clients — instead of
// forking every AGENCE screen. The DB migration flags the row with
// is_internal_agency=true; here we key off client_code, which is stable and
// covered by the migration's partial unique index.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const INTERNAL_AGENCY_CLIENT_CODE = "TDIA-INTERNAL";

export type InternalAgencyRow = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  is_internal_agency?: boolean;
};

export function isInternalAgency(row: { client_code?: string | null; is_internal_agency?: boolean } | null | undefined): boolean {
  if (!row) return false;
  if (row.is_internal_agency === true) return true;
  return row.client_code === INTERNAL_AGENCY_CLIENT_CODE;
}

export function useInternalAgency() {
  const [agency, setAgency] = useState<InternalAgencyRow | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("gos_clients")
        .select("*")
        .eq("client_code", INTERNAL_AGENCY_CLIENT_CODE)
        .maybeSingle();
      if (cancelled) return;
      setAgency((data ?? null) as InternalAgencyRow | null);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return { agency, ready };
}
