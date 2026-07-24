import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import Index from "./pages/Index";
import ClientOnboarding from "./pages/ClientOnboarding";
import Step2 from "./pages/Step2";
import Step3 from "./pages/Step3";
import VoiceOnboarding from "./pages/VoiceOnboarding";
import Step4 from "./pages/Step4";
import Step5 from "./pages/Step5";
import Step6 from "./pages/Step6";
import Step7 from "./pages/Step7";
import Step8 from "./pages/Step8";
import Step9 from "./pages/Step9";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ClientDetail from "./pages/admin/ClientDetail";
import ClosedDeals from "./pages/admin/ClosedDeals";
import ContractCreator from "./pages/admin/ContractCreator";
import FollowUps from "./pages/admin/FollowUps";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AgentOpsLayout from "./components/agentOps/AgentOpsLayout";
import OpsDashboard from "./pages/agentOps/Dashboard";
import OpsClients from "./pages/agentOps/Clients";
import OpsNewAudit from "./pages/agentOps/NewAudit";
import OpsClientProfile from "./pages/agentOps/ClientProfile";
import OpsRunMonitor from "./pages/agentOps/RunMonitor";
import OpsPdfViewer from "./pages/agentOps/PdfViewer";
import OpsPipeline from "./pages/agentOps/Pipeline";
import CrmLayout from "./crm/CrmLayout";
import CrmDashboard from "./pages/admin/crm/Dashboard";
import CrmClients from "./pages/admin/crm/Clients";
import CrmClientProfile from "./pages/admin/crm/ClientProfile";
import CrmHypotheses from "./pages/admin/crm/HypothesesGlobal";
import CrmForecasts from "./pages/admin/crm/ForecastsGlobal";
import CrmLiveOpt from "./pages/admin/crm/LiveOptimizationGlobal";
import CrmLearning from "./pages/admin/crm/LearningLibrary";
import CrmMethodology from "./pages/admin/crm/Methodology";
import CrmSettings from "./pages/admin/crm/Settings";
import CrmModelRuns from "./pages/admin/crm/ModelRuns";
import GosLayout from "./gos/GosLayout";
import GosDashboard from "./pages/admin/gos/Dashboard";
import GosClients from "./pages/admin/gos/Clients";
import GosNewClient from "./pages/admin/gos/NewClient";
import GosWorkspace from "./pages/admin/gos/Workspace";
import GrowthModelSetup from "./pages/admin/gos/GrowthModelSetup";
import GrowthDiagnosis from "./pages/admin/gos/GrowthDiagnosis";
import PlanningPrediction from "./pages/admin/gos/PlanningPrediction";
import EventEffect from "./pages/admin/gos/EventEffect";
import Retention from "./pages/admin/gos/Retention";
import MrrRetention from "./pages/admin/gos/MrrRetention";
import SpendingPower from "./pages/admin/gos/SpendingPower";
import Forecast from "./pages/admin/gos/Forecast";
import MetricTargets from "./pages/admin/gos/MetricTargets";
import WeeklyPnl from "./pages/admin/gos/WeeklyPnl";
import DailyPnl from "./pages/admin/gos/DailyPnl";
import CreativeDemand from "./pages/admin/gos/CreativeDemand";
import GrowthExecutionMap from "./pages/admin/gos/GrowthExecutionMap";
import LiveOptimization from "./pages/admin/gos/LiveOptimization";
import Measurement from "./pages/admin/gos/Measurement";
import ForecastUpdates from "./pages/admin/gos/ForecastUpdates";
import LearningLoop from "./pages/admin/gos/LearningLoop";
import NextCyclePlanning from "./pages/admin/gos/NextCyclePlanning";
import DataAnalystFoundation from "./pages/admin/gos/DataAnalystFoundation";
import DataAnalystStatistical from "./pages/admin/gos/DataAnalystStatistical";
import DataAnalystExecutionPlan from "./pages/admin/gos/DataAnalystExecutionPlan";
import ClientIntelligence from "./pages/admin/gos/ClientIntelligence";
import ManualChecklist from "./pages/admin/gos/ManualChecklist";
import GosSettings from "./pages/admin/gos/Settings";
import GosClientMembers from "./pages/admin/gos/ClientMembers";
import GosDataSources from "./pages/admin/gos/DataSources";
import EcommerceFinancialModel from "./pages/admin/gos/EcommerceFinancialModel";
import SkuDemandPlan from "./pages/admin/gos/SkuDemandPlan";
import GosPlaceholder from "./pages/admin/gos/Placeholder";
import MapNotes from "./pages/admin/gos/MapNotes";
import DailyDigest from "./pages/admin/gos/DailyDigest";
import Walkdown from "./pages/admin/gos/Walkdown";
import CampaignCategories from "./pages/admin/gos/CampaignCategories";
import BuyerWorkspace from "./pages/admin/gos/BuyerWorkspace";
import DailyBudgetPlanner from "./pages/admin/gos/DailyBudgetPlanner";
import BudgetChangeGate from "./pages/admin/gos/BudgetChangeGate";
import BusinessObjectives from "./pages/admin/gos/BusinessObjectives";
import ConceptLog from "./pages/admin/gos/ConceptLog";
import CreativeBrief from "./pages/admin/gos/CreativeBrief";
import WayfinderWednesday from "./pages/admin/gos/WayfinderWednesday";
import CreativeTestingRoadmap from "./pages/admin/gos/CreativeTestingRoadmap";
import OfferLab from "./pages/admin/gos/OfferLab";
import AngleAudienceMatrix from "./pages/admin/gos/AngleAudienceMatrix";
import WeeklyExecutiveReport from "./pages/admin/gos/WeeklyExecutiveReport";
import PortfolioExecutive from "./pages/admin/gos/PortfolioExecutive";
import ProfitFirstWorkspace from "./pages/admin/gos/ProfitFirstWorkspace";
import AiAutomationHub from "./pages/admin/gos/AiAutomationHub";
import RetentionLtvWorkspace from "./pages/admin/gos/RetentionLtvWorkspace";
import MediaBuyingAutomation from "./pages/admin/gos/MediaBuyingAutomation";
import FinancialConsolidated from "./pages/admin/gos/FinancialConsolidated";

const queryClient = new QueryClient();

// Redirect legacy ?id=X workflow URL to /run/:id
function LegacyWorkflowRedirect() {
  const [sp] = useSearchParams();
  const id = sp.get("id");
  return <Navigate to={id ? `/admin/ops/run/${id}` : "/admin/ops"} replace />;
}

function LegacyClientRunRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/admin/ops/run/${id}` : "/admin/ops"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="stars-bg" />
      <BrowserRouter>
       <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/client" element={<ClientOnboarding />} />
          <Route path="/step2" element={<Step2 />} />
          <Route path="/voice" element={<VoiceOnboarding />} />
          <Route path="/step3" element={<Step3 />} />
          <Route path="/step4" element={<Step4 />} />
          <Route path="/step5" element={<Step5 />} />
          <Route path="/step6" element={<Step6 />} />
          <Route path="/step7" element={<Step7 />} />
          <Route path="/step8" element={<Step8 />} />
          <Route path="/step9" element={<Step9 />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/deals" element={<ClosedDeals />} />
          <Route path="/admin/contract-creator" element={<ContractCreator />} />
          <Route path="/admin/followups" element={<FollowUps />} />
          <Route path="/admin/clients/:clientCode" element={<ClientDetail />} />
          <Route path="/admin/ops" element={<AgentOpsLayout />}>
            <Route index element={<OpsDashboard />} />
            <Route path="pipeline" element={<OpsPipeline />} />
            <Route path="new" element={<OpsNewAudit />} />
            <Route path="clients" element={<OpsClients />} />
            <Route path="clients/new" element={<OpsNewAudit />} />
            <Route path="clients/:clientId" element={<OpsClientProfile />} />
            <Route path="run/:id" element={<OpsRunMonitor />} />
            <Route path="workflow" element={<LegacyWorkflowRedirect />} />
            <Route path="runs/:id" element={<LegacyClientRunRedirect />} />
            <Route path="pdf" element={<OpsPdfViewer />} />
          </Route>
          <Route path="/admin/crm" element={<CrmLayout />}>
            <Route index element={<CrmDashboard />} />
            <Route path="clients" element={<CrmClients />} />
            <Route path="clients/:id" element={<CrmClientProfile />} />
            <Route path="hypotheses" element={<CrmHypotheses />} />
            <Route path="forecasts" element={<CrmForecasts />} />
            <Route path="live-optimization" element={<CrmLiveOpt />} />
            <Route path="model-runs" element={<CrmModelRuns />} />
            <Route path="learning" element={<CrmLearning />} />
            <Route path="methodology" element={<CrmMethodology />} />
            <Route path="settings" element={<CrmSettings />} />
          </Route>
          <Route path="/admin/gos" element={<GosLayout />}>
            <Route index element={<GosDashboard />} />
            <Route path="clients" element={<GosClients />} />
            <Route path="portfolio" element={<PortfolioExecutive />} />
            <Route path="clients/new" element={<GosNewClient />} />
            <Route path="clients/:clientId/workspace" element={<GosWorkspace />} />
            <Route path="clients/:clientId/profit-first-workspace" element={<ProfitFirstWorkspace />} />
            <Route path="clients/:clientId/growth-model-setup" element={<GrowthModelSetup />} />
            <Route path="clients/:clientId/business-context" element={<GrowthModelSetup />} />
            <Route path="clients/:clientId/financial-inputs" element={<GrowthModelSetup />} />
            <Route path="clients/:clientId/products" element={<GrowthModelSetup />} />
            <Route path="clients/:clientId/inventory" element={<GrowthModelSetup />} />
            <Route path="clients/:clientId/quantitative-baseline" element={<GrowthModelSetup />} />
            <Route path="clients/:clientId/growth-diagnosis" element={<GrowthDiagnosis />} />
            <Route path="clients/:clientId/planning-prediction" element={<PlanningPrediction />} />
            <Route path="clients/:clientId/event-effect" element={<EventEffect />} />
            <Route path="clients/:clientId/retention" element={<Retention />} />
            <Route path="clients/:clientId/mrr-retention" element={<MrrRetention />} />
            <Route path="clients/:clientId/spending-power" element={<SpendingPower />} />
            <Route path="clients/:clientId/forecast" element={<Forecast />} />
            <Route path="clients/:clientId/metric-targets" element={<MetricTargets />} />
            <Route path="clients/:clientId/weekly-pnl" element={<WeeklyPnl />} />
            <Route path="clients/:clientId/daily-pnl" element={<DailyPnl />} />
            <Route path="clients/:clientId/map-notes" element={<MapNotes />} />
            <Route path="clients/:clientId/daily-digest" element={<DailyDigest />} />
            <Route path="clients/:clientId/walkdown" element={<Walkdown />} />
            <Route path="clients/:clientId/campaign-categories" element={<CampaignCategories />} />
            <Route path="clients/:clientId/buyer-workspace" element={<BuyerWorkspace />} />
            <Route path="clients/:clientId/daily-budget-planner" element={<DailyBudgetPlanner />} />
            <Route path="clients/:clientId/budget-change-gate" element={<BudgetChangeGate />} />
            <Route path="clients/:clientId/business-objectives" element={<BusinessObjectives />} />
            <Route path="clients/:clientId/concept-log" element={<ConceptLog />} />
            <Route path="clients/:clientId/creative-brief" element={<CreativeBrief />} />
            <Route path="clients/:clientId/wayfinder-wednesday" element={<WayfinderWednesday />} />
            <Route path="clients/:clientId/testing-roadmap" element={<CreativeTestingRoadmap />} />
            <Route path="clients/:clientId/offer-lab" element={<OfferLab />} />
            <Route path="clients/:clientId/angle-audience-matrix" element={<AngleAudienceMatrix />} />
            <Route path="clients/:clientId/weekly-executive-report" element={<WeeklyExecutiveReport />} />
            <Route path="clients/:clientId/creative-demand" element={<CreativeDemand />} />
            <Route path="clients/:clientId/growth-execution-map" element={<GrowthExecutionMap />} />
            <Route path="clients/:clientId/live-optimization" element={<LiveOptimization />} />
            <Route path="clients/:clientId/measurement" element={<Measurement />} />
            <Route path="clients/:clientId/forecast-updates" element={<ForecastUpdates />} />
            <Route path="clients/:clientId/learning-loop" element={<LearningLoop />} />
            <Route path="clients/:clientId/next-cycle-planning" element={<NextCyclePlanning />} />
            <Route path="clients/:clientId/data-analyst" element={<DataAnalystFoundation />} />
            <Route path="clients/:clientId/data-analyst/statistical" element={<DataAnalystStatistical />} />
            <Route path="clients/:clientId/data-analyst/execution" element={<DataAnalystExecutionPlan />} />
            <Route path="clients/:clientId/intelligence" element={<ClientIntelligence />} />
            <Route path="clients/:clientId/manual-checklist" element={<ManualChecklist />} />
            <Route path="clients/:clientId/members" element={<GosClientMembers />} />
            <Route path="data-sources" element={<GosDataSources />} />
            <Route path="ecommerce-financial-model" element={<EcommerceFinancialModel />} />
            <Route path="clients/:clientId/ecommerce-financial-model" element={<EcommerceFinancialModel />} />
            <Route path="sku-demand-plan" element={<SkuDemandPlan />} />
            <Route path="clients/:clientId/sku-demand-plan" element={<SkuDemandPlan />} />
            <Route path="clients/:clientId/ai-automations" element={<AiAutomationHub />} />
            <Route path="clients/:clientId/retention-ltv" element={<RetentionLtvWorkspace />} />
            <Route path="clients/:clientId/media-buying-automation" element={<MediaBuyingAutomation />} />
            <Route path="clients/:clientId/financial-consolidated" element={<FinancialConsolidated />} />
            <Route path="settings" element={<GosSettings />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
       </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
