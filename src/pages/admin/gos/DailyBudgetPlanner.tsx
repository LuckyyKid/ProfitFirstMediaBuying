import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Calculator, Check, ArrowRight } from "lucide-react";
import {
  applyDailyCampaignBudget,
  applyDailyCategoryIdealBudgets,
  fetchDailyBudgetPlannerData,
} from "@/gos/dailyBudgetPlannerController";
import {
  budgetStatus,
  computeDailyBudgetCategoryPlan,
  computeDailyBudgetTotals,
  groupDailyBudgetCampaigns,
  UNASSIGNED_BUDGET_CATEGORY_ID,
  type BudgetStatus,
  type DailyBudgetCampaign,
  type DailyBudgetCategory,
} from "@/gos/dailyBudgetPlanner";
import type { BudgetApplicationResult } from "@/gos/budgetApplicationController";

const CARD = "rgba(255, 255, 255, 0.02)";
const BG_DEEP = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";
const YELLOW = "#f5b74e";

function statusColor(status: BudgetStatus["status"]): string {
  if (status === "optimal") return GREEN;
  if (status === "below" || status === "above") return YELLOW;
  if (status === "under_invested" || status === "over_invested") return RED;
  return MUTED;
}

function money(value: number | null | undefined): string {
  if (value == null) return "-";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function guardToast(result: BudgetApplicationResult) {
  if (!result.applied) {
    toast.error(`${result.guard.decision}: ${result.guard.risks[0] ?? result.guard.summary}`);
    return;
  }
  toast.success(result.guard.decision === "ALLOW_WITH_CONDITIONS" ? "Budget applied with conditions" : "Budget applied");
}

export default function DailyBudgetPlanner() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<DailyBudgetCategory[]>([]);
  const [campaigns, setCampaigns] = useState<DailyBudgetCampaign[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchDailyBudgetPlannerData(clientId);
      setCategories(data.categories);
      setCampaigns(data.campaigns);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Daily budget planner loading failed");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyBudget = async (campaignId: string, newBudget: number) => {
    if (!clientId) return;
    try {
      const { result } = await applyDailyCampaignBudget(clientId, campaignId, newBudget);
      guardToast(result);
      if (!result.applied) return;
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[campaignId];
        return next;
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Budget application failed");
    }
  };

  const applyAllIdeal = async (category: DailyBudgetCategory, categoryCampaigns: DailyBudgetCampaign[]) => {
    if (!clientId) return;
    try {
      const { result } = await applyDailyCategoryIdealBudgets(clientId, category, categoryCampaigns);
      guardToast(result);
      if (!result.applied) return;
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Budget application failed");
    }
  };

  const campaignsByCategory = useMemo(
    () => groupDailyBudgetCampaigns(categories, campaigns),
    [categories, campaigns],
  );

  const totals = useMemo(
    () => computeDailyBudgetTotals(categories, campaigns),
    [categories, campaigns],
  );

  const unassignedCampaigns = campaignsByCategory[UNASSIGNED_BUDGET_CATEGORY_ID] ?? [];

  if (!selectedClient) {
    return <EmptyState title="Aucun client selectionne" hint="Selectionne un client d'abord." />;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
      <SectionHeader
        title="Daily Budget Planner"
        subtitle="Budget quotidien ideal = CPA cible x 50 / 7. Increases are guarded by Budget Change Gate."
      />

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <Calculator size={32} style={{ color: BLUE }} />
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 14, color: "var(--tdia-text)", fontWeight: 600, marginBottom: 4 }}>
            Budget quotidien ideal = <span style={{ color: BLUE }}>CPA cible x 50 / 7</span>
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>
            The formula keeps enough weekly conversion signal for platform learning. Any increase checks the latest Budget Change Gate before writing campaign budgets.
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 180 }}>
          <div style={{ fontSize: 11, color: MUTED }}>Current daily / ideal daily</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tdia-text)" }}>
            {money(totals.current_daily_total)}/d <span style={{ color: MUTED }}> / </span> <span style={{ color: BLUE }}>{money(totals.ideal_daily_total)}/d</span>
          </div>
        </div>
      </div>

      {loading && <div style={{ color: MUTED }}>Loading...</div>}

      {!loading && categories.length === 0 && (
        <EmptyState title="Aucune categorie" hint="Configure les categories campagnes pour definir les CPA cibles." />
      )}

      {!loading && categories.map((category) => {
        const categoryCampaigns = campaignsByCategory[category.id] ?? [];
        const activeCampaigns = categoryCampaigns.filter((campaign) => campaign.active);
        const plan = computeDailyBudgetCategoryPlan(category, categoryCampaigns);
        const planColor = statusColor(plan.status.status);

        return (
          <section key={category.id} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>{category.name}</div>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>{category.kind}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 20, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
                <SmallMetric label="Target CPA" value={category.target_cpa ? money(category.target_cpa) : "-"} />
                <SmallMetric label="Ideal daily" value={plan.ideal_daily_budget ? `${money(plan.ideal_daily_budget)}/d` : "-"} color={BLUE} />
                <div>
                  <div style={{ color: MUTED, fontSize: 10 }}>Current daily</div>
                  <div style={{ color: planColor, fontWeight: 700 }}>
                    {money(plan.current_daily_budget_total)}/d <span style={{ fontSize: 10 }}> / {plan.status.label}</span>
                  </div>
                </div>
                {plan.ideal_daily_budget && activeCampaigns.length > 0 && (
                  <button
                    onClick={() => void applyAllIdeal(category, categoryCampaigns)}
                    style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}
                  >
                    Align all to ideal
                  </button>
                )}
              </div>
            </div>

            {categoryCampaigns.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED, padding: 12, textAlign: "center" }}>No campaign in this category</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 2fr) repeat(5, minmax(95px, 1fr))", gap: 12, padding: "6px 10px", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <div>Campaign</div>
                  <div>Platform</div>
                  <div>Current</div>
                  <div>Ideal share</div>
                  <div>Adjust</div>
                  <div>Action</div>
                </div>
                {categoryCampaigns.map((campaign) => {
                  const share = campaign.active ? plan.ideal_per_campaign_budget : null;
                  const current = campaign.current_daily_budget ?? 0;
                  const campaignStatus = budgetStatus(current, share);
                  const draftVal = drafts[campaign.id] ?? share ?? current;
                  const changed = draftVal !== current;

                  return (
                    <div key={campaign.id} style={{ display: "grid", gridTemplateColumns: "minmax(160px, 2fr) repeat(5, minmax(95px, 1fr))", gap: 12, padding: "8px 10px", background: BG_DEEP, borderRadius: 6, alignItems: "center", fontSize: 12, overflowX: "auto" }}>
                      <div style={{ color: "var(--tdia-text)" }}>
                        {campaign.name}
                        {!campaign.active && <span style={{ marginLeft: 8, fontSize: 10, color: MUTED }}>(inactive)</span>}
                      </div>
                      <div style={{ color: MUTED }}>{campaign.platform}</div>
                      <div style={{ color: statusColor(campaignStatus.status), fontWeight: 600 }}>{money(current)}/d</div>
                      <div style={{ color: BLUE, fontWeight: 600 }}>{share ? `${money(share)}/d` : "-"}</div>
                      <input
                        type="number"
                        value={draftVal}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [campaign.id]: Number(event.target.value) }))}
                        style={{ background: CARD, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", width: "100%", minHeight: 30 }}
                      />
                      <button
                        onClick={() => void applyBudget(campaign.id, draftVal)}
                        disabled={!changed}
                        style={{ background: changed ? GREEN : BORDER, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: changed ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, minHeight: 30 }}
                      >
                        {changed ? <><ArrowRight size={12} /> Apply</> : <><Check size={12} /> Current</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {unassignedCampaigns.length > 0 && (
        <section style={{ border: `1px dashed ${YELLOW}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: YELLOW, marginBottom: 8 }}>
            {unassignedCampaigns.length} campaign(s) without category
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>
            Assign them to a campaign category to use the ideal daily budget calculation.
          </div>
        </section>
      )}
    </div>
  );
}

function SmallMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ color: MUTED, fontSize: 10 }}>{label}</div>
      <div style={{ color: color ?? "#fff", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
