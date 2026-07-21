import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CrmDashboardStats = {
  totalClients: number;
  inAudit: number;
  needingReview: number;
  forecastsAtRisk: number;
  recentHypotheses: number;
  recentReviews: number;
  recentLearnings: number;
};

const EMPTY: CrmDashboardStats = {
  totalClients: 0,
  inAudit: 0,
  needingReview: 0,
  forecastsAtRisk: 0,
  recentHypotheses: 0,
  recentReviews: 0,
  recentLearnings: 0,
};

export function useCrmDashboardStats() {
  const [stats, setStats] = useState<CrmDashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { count: totalClients },
        { count: inAudit },
        { data: syntheses },
        { data: forecasts },
        { count: recentHypotheses },
        { count: recentReviews },
        { count: recentLearnings },
      ] = await Promise.all([
        supabase.from("crm_clients").select("*", { count: "exact", head: true }),
        supabase.from("crm_clients").select("*", { count: "exact", head: true }).eq("current_phase", "Audit"),
        supabase.from("crm_audit_syntheses").select("client_id").eq("am_approved", false),
        supabase.from("crm_forecasts").select("confidence_label").in("confidence_label", ["Low"]),
        supabase.from("crm_hypotheses").select("*", { count: "exact", head: true }).eq("status", "Approved"),
        supabase.from("crm_live_optimization_reviews").select("*", { count: "exact", head: true }),
        supabase.from("crm_learning_library").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalClients: totalClients ?? 0,
        inAudit: inAudit ?? 0,
        needingReview: syntheses?.length ?? 0,
        forecastsAtRisk: forecasts?.length ?? 0,
        recentHypotheses: recentHypotheses ?? 0,
        recentReviews: recentReviews ?? 0,
        recentLearnings: recentLearnings ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  return { stats, loading };
}
