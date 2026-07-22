import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/crm/ui";
import { Link } from "react-router-dom";

export default function CrmDashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    inAudit: 0,
    needingReview: 0,
    forecastsAtRisk: 0,
    recentHypotheses: 0,
    recentReviews: 0,
    recentLearnings: 0,
  });

  useEffect(() => {
    (async () => {
      const [{ count: totalClients }, { count: inAudit }, { data: syntheses }, { data: forecasts }, { count: recentHypotheses }, { count: recentReviews }, { count: recentLearnings }] = await Promise.all([
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
    })();
  }, []);

  const cards = [
    { label: "Active Clients", value: stats.totalClients, to: "/admin/crm/clients" },
    { label: "In Audit / Strategy", value: stats.inAudit },
    { label: "Needing AM Review", value: stats.needingReview },
    { label: "Forecasts at Risk", value: stats.forecastsAtRisk, to: "/admin/crm/forecasts" },
    { label: "Approved Hypotheses", value: stats.recentHypotheses, to: "/admin/crm/hypotheses" },
    { label: "Live Reviews", value: stats.recentReviews, to: "/admin/crm/live-optimization" },
    { label: "Learnings Logged", value: stats.recentLearnings, to: "/admin/crm/learning" },
  ];

  return (
    <div>
      <SectionHeader title="Dashboard" description="TDIA Intelligence CRM — vue d'ensemble" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => {
          const inner = (
            <Card className="p-5 hover:border-primary/40 transition h-full">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
              <div className="text-3xl font-semibold mt-2">{c.value}</div>
            </Card>
          );
          return c.to ? <Link key={c.label} to={c.to}>{inner}</Link> : <div key={c.label}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
