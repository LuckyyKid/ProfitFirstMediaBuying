import { useEffect, useState } from "react";

// ------------------------------------------------------------------
// Portal data types — mirror the shapes rendered by PortalClient.
// These are populated by a per-client aggregation pipeline that reads
// Meta, Google, Shopify and TDIA's own analytics (not wired yet).
// ------------------------------------------------------------------
export type Period = "7j" | "30j";
export type Platform = "all" | "meta" | "google";
export type Tone = "good" | "watch" | "bad" | "neutral";

export type Kpi = { label: string; value: string; delta: string; tone: Tone; note: string; big?: boolean };
export type WaterfallItem = { label: string; amount: string; pct: string; w: number; color: string; bold?: boolean };
export type ShopifyStat = { label: string; value: string; delta: string; tone: Tone };
export type Campaign = {
  name: string;
  platform: "meta" | "google";
  status: string;
  tone: Tone;
  spend: string;
  revenue: string;
  roas: string;
  roasTone: Tone;
  cac: string;
  cacTone: Tone;
  orders: string;
};
export type Totals = { spend: string; revenue: string; roas: string; cac: string; orders: string };
export type PeriodData = {
  kpis: Kpi[];
  waterfall: WaterfallItem[];
  waterfallReading: string;
  shopify: ShopifyStat[];
  campaigns: Campaign[];
  totals: Record<Platform, Totals>;
  amReading: string;
};
export type DocItem = { kind: string; title: string; meta: string };
export type PortalData = {
  period: PeriodData;
  reports: DocItem[];
  docs: DocItem[];
};

type State = { data: PortalData | null; loading: boolean; error: string | null };

/**
 * Fetches the client-facing portal data for a given clientCode and period.
 *
 * NOTE: the aggregation pipeline (Meta / Google Ads / Shopify → per-client
 * snapshots) is not wired yet. Until then this hook returns null so the
 * portal renders a clear empty state instead of any placeholder / mock
 * numbers. Wiring is tracked as a follow-up.
 */
export function useClientPortalData(clientCode: string, period: Period): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    // Placeholder for the real fetch (edge function or supabase select).
    // We intentionally resolve to null — no mock data.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setState({ data: null, loading: false, error: null });
    });
    return () => { cancelled = true; };
  }, [clientCode, period]);

  return state;
}
