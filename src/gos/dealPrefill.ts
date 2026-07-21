import { supabase } from "@/integrations/supabase/client";

export function mapBusinessType(bt: string | null | undefined): string {
  if (!bt) return "ECOMMERCE";
  const up = String(bt).toUpperCase().replace(/[\s-]/g, "_");
  if (["ECOMMERCE", "LOCAL_SERVICE", "HYBRID", "OTHER"].includes(up)) return up;
  if (up.includes("LOCAL")) return "LOCAL_SERVICE";
  if (up.includes("ECOM") || up.includes("SHOP")) return "ECOMMERCE";
  return "OTHER";
}

export function buildGosClientPayload(deal: any | null, progress: any | null) {
  const d = deal ?? {};
  const p = progress ?? {};
  const first = (...vals: any[]) => vals.find((v) => v != null && v !== "") ?? null;
  const dateOnly = (v: any) => (v ? String(v).slice(0, 10) : null);

  return {
    client_code: first(d.client_code, p.client_code),
    company_name: first(d.company_name, p.company_name, p.brand_name, "(sans nom)"),
    website_url: null,
    industry: first(d.offers_sold),
    business_type: mapBusinessType(first(d.business_type, p.business_type)),
    current_phase: "ONBOARDING",
    am_owner: first(d.closer_name, p.closer_name, p.sales_supervisor),
    main_contact_name: first(d.contact_name, d.owner_name, p.client_name),
    main_contact_email: first(d.owner_email, p.email),
    main_contact_phone: first(d.phone, d.owner_phone, p.phone),
    offer_sold: first(d.offers_sold),
    platforms_managed: first(d.platforms_to_manage),
    lead_source: first(d.lead_source, p.lead_source),
    deal_value: first(d.contract_value, p.deal_value) != null ? Number(first(d.contract_value, p.deal_value)) : null,
    monthly_retainer: d.monthly_amount != null ? Number(d.monthly_amount) : null,
    closing_date: dateOnly(first(d.closing_date, p.closing_date)),
    launch_target_date: dateOnly(d.target_launch_date),
    slack_channel: first(p.slack_channel_name),
    drive_folder_url: first(p.drive_folder_url),
  };
}

/** Load closed_deals + client_progress merged by client_code, plus existing gos_client codes. */
export async function loadDealSources() {
  const [deals, progs, gos] = await Promise.all([
    supabase.from("closed_deals").select("*").order("closing_date", { ascending: false }),
    supabase.from("client_progress").select("*").order("created_at", { ascending: false }),
    supabase.from("gos_clients").select("client_code"),
  ]);
  const map = new Map<string, { key: string; label: string; deal: any | null; progress: any | null }>();
  (progs.data ?? []).forEach((p: any) => {
    const key = p.client_code || p.email || p.id;
    map.set(key, {
      key,
      label: p.company_name || p.brand_name || p.client_name || "(sans nom)",
      deal: null,
      progress: p,
    });
  });
  (deals.data ?? []).forEach((d: any) => {
    const key = d.client_code || d.company_name || d.id;
    const existing = map.get(key);
    if (existing) existing.deal = d;
    else map.set(key, { key, label: d.company_name || "(sans nom)", deal: d, progress: null });
  });
  return {
    sources: Array.from(map.values()),
    existingCodes: new Set((gos.data ?? []).map((g: any) => g.client_code).filter(Boolean)),
  };
}
