import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { useCrmDashboardStats } from "@/crm/hooks";
import { TwentyPage, PageHeader } from "@/components/admin-shell";

export default function CrmDashboard() {
  const { stats } = useCrmDashboardStats();

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
    <TwentyPage inLayout>
      <PageHeader
        icon={LayoutDashboard}
        title="CRM Dashboard"
        description="TDIA Intelligence CRM — vue d'ensemble"
      />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((c) => {
            const inner = (
              <div className="border border-border bg-background rounded-md p-4 hover:border-primary/50 hover:bg-muted/40 transition-colors h-full">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</div>
                <div className="text-2xl font-semibold mt-2 tabular-nums">{c.value}</div>
              </div>
            );
            return c.to ? (
              <Link key={c.label} to={c.to} className="block">{inner}</Link>
            ) : (
              <div key={c.label}>{inner}</div>
            );
          })}
        </div>
      </div>
    </TwentyPage>
  );
}
