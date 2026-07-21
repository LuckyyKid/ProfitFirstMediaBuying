import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Building2 } from "lucide-react";
import { StatusBadge, RiskBadge } from "@/crm/ui";
import { TwentyPage, PageHeader, NavPill, NavDivider } from "@/components/admin-shell";
import {
  OverviewTab,
  BusinessContextTab,
  FinancialTab,
  MarketResearchTab,
  QuantBaselineTab,
  ExperimentalTab,
  CroAuditTab,
  AuditSynthesisTab,
  HypothesesTab,
  DecisionScoringTab,
  ForecastTab,
  MetricTargetsTab,
  CreativeDemandTab,
  GrowthMapTab,
  LiveOptTab,
  LearningLogTab,
  ClickUpTab,
} from "./client-profile";

const TABS = [
  { v: "overview", l: "Overview" },
  { v: "business", l: "Business Context" },
  { v: "financial", l: "Financial" },
  { v: "market", l: "Market Research" },
  { v: "baseline", l: "Quant Baseline" },
  { v: "experimental", l: "Experimental" },
  { v: "cro", l: "CRO / Offer" },
  { v: "synthesis", l: "Audit Synthesis" },
  { v: "hypotheses", l: "Hypotheses" },
  { v: "scoring", l: "Decision Scoring" },
  { v: "forecast", l: "Forecast" },
  { v: "targets", l: "Metric Targets" },
  { v: "creative", l: "Creative Demand" },
  { v: "growth", l: "Growth Map" },
  { v: "live", l: "Live Optim." },
  { v: "learning", l: "Learning Log" },
  { v: "clickup", l: "ClickUp" },
];

export default function ClientProfile() {
  const { id } = useParams();
  const [client, setClient] = useState<any | null>(null);
  const [tab, setTab] = useState("overview");

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("crm_clients").select("*").eq("id", id).maybeSingle();
    setClient(data);
  };
  useEffect(() => { load(); }, [id]);

  if (!id) return null;
  if (!client) {
    return (
      <TwentyPage inLayout>
        <PageHeader icon={Building2} title="Chargement…" />
      </TwentyPage>
    );
  }

  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Building2}
        title={client.company_name}
        description={`${client.client_code ?? ""} · ${client.industry ?? "—"} · AM: ${client.am_owner_name ?? "—"}`}
        actions={
          <>
            <NavPill to="/admin/crm/clients" icon={ArrowLeft}>Retour</NavPill>
            <NavDivider />
            <StatusBadge status={client.current_phase} />
            <RiskBadge level={client.risk_level} />
          </>
        }
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto justify-start bg-transparent p-0 gap-1 mb-4 border-b border-border rounded-none">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="h-7 px-2 text-xs data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md"
              >
                {t.l}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview"><OverviewTab client={client} reload={load} /></TabsContent>
          <TabsContent value="business"><BusinessContextTab clientId={id} /></TabsContent>
          <TabsContent value="financial"><FinancialTab clientId={id} /></TabsContent>
          <TabsContent value="market"><MarketResearchTab clientId={id} /></TabsContent>
          <TabsContent value="baseline"><QuantBaselineTab clientId={id} /></TabsContent>
          <TabsContent value="experimental"><ExperimentalTab clientId={id} /></TabsContent>
          <TabsContent value="cro"><CroAuditTab clientId={id} /></TabsContent>
          <TabsContent value="synthesis"><AuditSynthesisTab clientId={id} /></TabsContent>
          <TabsContent value="hypotheses"><HypothesesTab clientId={id} /></TabsContent>
          <TabsContent value="scoring"><DecisionScoringTab clientId={id} /></TabsContent>
          <TabsContent value="forecast"><ForecastTab clientId={id} /></TabsContent>
          <TabsContent value="targets"><MetricTargetsTab clientId={id} /></TabsContent>
          <TabsContent value="creative"><CreativeDemandTab clientId={id} /></TabsContent>
          <TabsContent value="growth"><GrowthMapTab clientId={id} /></TabsContent>
          <TabsContent value="live"><LiveOptTab clientId={id} /></TabsContent>
          <TabsContent value="learning"><LearningLogTab clientId={id} /></TabsContent>
          <TabsContent value="clickup"><ClickUpTab client={client} reload={load} /></TabsContent>
        </Tabs>
      </div>
    </TwentyPage>
  );
}
