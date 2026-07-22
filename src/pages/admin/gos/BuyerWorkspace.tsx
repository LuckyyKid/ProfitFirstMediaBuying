import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Save, TrendingUp, TrendingDown, Pause, Play, Skull, Minus, Target, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import { runBuyerAssistant, idealDailyBudget } from "@/gos/buyerAssistant";
import {
  fetchBuyerWorkspaceData,
  logBuyerDecisionWithBudgetGuard,
  saveBuyerCampaignPerformance,
} from "@/gos/buyerWorkspaceController";
import {
  computeBuyerCampaignMetrics,
  computeBuyerCategorySummary,
  groupCampaignsByCategory,
  ORPHAN_CATEGORY_ID,
  todayISO,
  yesterdayISO,
  type BuyerCampaignMetrics,
  type BuyerDecisionDraft,
  type BuyerWorkspaceCampaign,
  type BuyerWorkspaceCategory,
  type BuyerWorkspaceDecision,
  type BuyerWorkspacePerformance,
} from "@/gos/buyerWorkspace";

const CARD = "rgba(255, 255, 255, 0.02)";
const BG_DEEP = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";
const YELLOW = "#f5b74e";

const EMPTY_DRAFT: BuyerDecisionDraft = { type: "", newBudget: "", reasoning: "", expected: "" };

const DECISION_TYPES: { value: string; label: string; icon: LucideIcon; color: string }[] = [
  { value: "scale", label: "Scale +20%", icon: TrendingUp, color: GREEN },
  { value: "increase", label: "Increase", icon: TrendingUp, color: GREEN },
  { value: "hold", label: "Hold", icon: Minus, color: MUTED },
  { value: "decrease", label: "Reduce", icon: TrendingDown, color: YELLOW },
  { value: "pause", label: "Pause", icon: Pause, color: YELLOW },
  { value: "resume", label: "Resume", icon: Play, color: BLUE },
  { value: "kill", label: "Kill", icon: Skull, color: RED },
];

function bandColorFromStatus(status: BuyerCampaignMetrics["cpa_band"]): string {
  if (status === "good") return GREEN;
  if (status === "bad") return RED;
  if (status === "warn") return YELLOW;
  return MUTED;
}

function money(value: number | null | undefined, decimals = 0): string {
  if (value == null) return "-";
  return `$${value.toFixed(decimals)}`;
}

function metric(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "-";
  return value.toFixed(decimals);
}

function nextDraft(current: BuyerDecisionDraft | undefined, campaign: BuyerWorkspaceCampaign): BuyerDecisionDraft {
  return current ?? { ...EMPTY_DRAFT, newBudget: String(campaign.current_daily_budget ?? "") };
}

export default function BuyerWorkspace() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => yesterdayISO());
  const [categories, setCategories] = useState<BuyerWorkspaceCategory[]>([]);
  const [campaigns, setCampaigns] = useState<BuyerWorkspaceCampaign[]>([]);
  const [perfs, setPerfs] = useState<Record<string, BuyerWorkspacePerformance>>({});
  const [decisions, setDecisions] = useState<BuyerWorkspaceDecision[]>([]);
  const [decisionDraft, setDecisionDraft] = useState<Record<string, BuyerDecisionDraft>>({});

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchBuyerWorkspaceData(clientId, date);
      setCategories(data.categories);
      setCampaigns(data.campaigns);
      setPerfs(data.performance_by_campaign);
      setDecisions(data.decisions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Buyer workspace loading failed");
    } finally {
      setLoading(false);
    }
  }, [clientId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePerf = async (campaignId: string) => {
    if (!clientId) return;
    const performance = perfs[campaignId];
    if (!performance) return toast.error("Performance row not found");

    setSaving(true);
    try {
      await saveBuyerCampaignPerformance(clientId, date, campaignId, performance);
      toast.success("Performance saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Performance save failed");
    } finally {
      setSaving(false);
    }
  };

  const logDecision = async (campaignId: string) => {
    if (!clientId) return;
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return toast.error("Campaign not found");

    const draft = nextDraft(decisionDraft[campaignId], campaign);
    if (!draft.type) return toast.error("Choose a decision type");

    const category = categories.find((item) => item.id === campaign.category_id) ?? null;
    const performance = perfs[campaignId] ?? null;

    try {
      const result = await logBuyerDecisionWithBudgetGuard(clientId, {
        campaign,
        category,
        performance,
        draft,
        decision_date: todayISO(),
      });

      if (!result.logged) {
        const guard = result.budget_application?.guard;
        toast.error(`${guard?.decision ?? "BLOCKED"}: ${guard?.risks[0] ?? guard?.summary ?? "Budget guard blocked the decision"}`);
        return;
      }

      toast.success("Decision logged");
      setDecisionDraft((prev) => ({ ...prev, [campaignId]: EMPTY_DRAFT }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decision logging failed");
    }
  };

  const byCategory = useMemo(
    () => groupCampaignsByCategory(categories, campaigns),
    [categories, campaigns],
  );

  if (!selectedClient) {
    return <EmptyState title="Aucun client selectionne" hint="Selectionne un client d'abord." />;
  }

  const visibleCategories: BuyerWorkspaceCategory[] = [
    ...categories,
    { id: ORPHAN_CATEGORY_ID, name: "Sans categorie", kind: "orphan", target_cpa: null, target_daily_budget: null },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
      <SectionHeader
        title="Buyer Workspace"
        subtitle="Vue quotidienne du media buyer : performance par campagne, decisions tracables (What / So What / Now What)."
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
        <label style={{ fontSize: 12, color: MUTED }}>Date de performance</label>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px" }}
        />
        <div style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>
          {campaigns.length} campagnes actives | {categories.length} categories
        </div>
      </div>

      {loading && <div style={{ color: MUTED }}>Chargement...</div>}

      {!loading && categories.length === 0 && campaigns.length === 0 && (
        <EmptyState title="Aucune campagne" hint="Configure d'abord des categories et campagnes dans Categories campagnes." />
      )}

      {!loading && visibleCategories.map((category) => {
        const categoryCampaigns = byCategory[category.id] ?? [];
        if (categoryCampaigns.length === 0) return null;

        const summary = computeBuyerCategorySummary(category, categoryCampaigns, perfs);
        const summaryColor = bandColorFromStatus(summary.cpa_band);

        return (
          <section key={category.id} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--tdia-text)" }}>{category.name}</div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>{category.kind}</div>
              <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12 }}>
                <div style={{ color: MUTED }}>Spend: <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{money(summary.total_spend)}</span></div>
                <div style={{ color: MUTED }}>Orders: <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{summary.total_orders}</span></div>
                {category.target_cpa && summary.cpa && (
                  <div style={{ color: MUTED }}>
                    <Target size={11} style={{ display: "inline", marginRight: 4 }} />
                    CPA: <span style={{ color: summaryColor, fontWeight: 600 }}>{money(summary.cpa, 2)}</span>
                    <span style={{ color: MUTED }}> / ${category.target_cpa}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {categoryCampaigns.map((campaign) => {
                const performance = perfs[campaign.id];
                if (!performance) return null;

                const targetCpa = category.target_cpa;
                const metrics = computeBuyerCampaignMetrics(performance, targetCpa);
                const cpaColor = bandColorFromStatus(metrics.cpa_band);
                const draft = nextDraft(decisionDraft[campaign.id], campaign);
                const recentDecisions = decisions.filter((decision) => decision.campaign_id === campaign.id).slice(0, 3);

                return (
                  <div key={campaign.id} style={{ background: BG_DEEP, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, color: "var(--tdia-text)" }}>{campaign.name}</div>
                      <div style={{ fontSize: 10, color: MUTED, padding: "2px 6px", background: CARD, borderRadius: 4 }}>{campaign.platform}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>
                        Budget actuel: <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{money(campaign.current_daily_budget)}/j</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
                      {(["spend", "orders", "leads", "revenue"] as const).map((key) => (
                        <div key={key}>
                          <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>{key}</div>
                          <input
                            type="number"
                            value={performance[key] ?? 0}
                            onChange={(event) => setPerfs((prev) => ({
                              ...prev,
                              [campaign.id]: { ...performance, [key]: Number(event.target.value) },
                            }))}
                            style={{ width: "100%", background: CARD, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px" }}
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => void savePerf(campaign.id)}
                        disabled={saving}
                        style={{ alignSelf: "end", minHeight: 34, background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                      >
                        <Save size={14} /> Perf
                      </button>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, marginBottom: 10, padding: "8px 10px", background: CARD, borderRadius: 6 }}>
                      <div style={{ color: MUTED }}>CPA: <span style={{ color: cpaColor, fontWeight: 600 }}>{money(metrics.cpa, 2)}</span>{targetCpa && <span style={{ color: MUTED }}> / ${targetCpa}</span>}</div>
                      <div style={{ color: MUTED }}>ROAS: <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{metric(metrics.roas)}</span></div>
                      <div style={{ color: MUTED }}>AOV: <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{money(metrics.aov)}</span></div>
                    </div>

                    {(() => {
                      const advice = runBuyerAssistant({
                        campaign_name: campaign.name,
                        platform: campaign.platform,
                        current_daily_budget: campaign.current_daily_budget ?? 0,
                        target_cpa: targetCpa,
                        target_daily_budget: category.target_daily_budget,
                        spend: performance.spend,
                        orders: performance.orders,
                        revenue: performance.revenue,
                      });
                      const ideal = idealDailyBudget(targetCpa);
                      const adviceColor = DECISION_TYPES.find((type) => type.value === advice.decision_type)?.color ?? BLUE;
                      const applyAdvice = () => {
                        setDecisionDraft((prev) => ({
                          ...prev,
                          [campaign.id]: {
                            type: advice.decision_type,
                            newBudget: advice.new_budget != null ? String(advice.new_budget) : String(campaign.current_daily_budget ?? ""),
                            reasoning: `${advice.what} ${advice.so_what}`,
                            expected: advice.now_what,
                          },
                        }));
                        toast.success("Recommandation appliquee au formulaire");
                      };

                      return (
                        <div style={{ marginBottom: 10, padding: 10, background: "rgba(59,130,246,0.08)", border: `1px dashed ${adviceColor}`, borderRadius: 6 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <Sparkles size={13} style={{ color: adviceColor }} />
                            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: adviceColor, fontWeight: 700 }}>
                              Assistant | {advice.decision_type} ({advice.confidence})
                            </div>
                            {ideal && (
                              <div style={{ marginLeft: "auto", fontSize: 10, color: MUTED }}>
                                Budget ideal (CPA x 50 / 7): <span style={{ color: "var(--tdia-text)" }}>${ideal}/j</span>
                              </div>
                            )}
                            <button
                              onClick={applyAdvice}
                              style={{ background: adviceColor, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
                            >
                              <Wand2 size={11} /> Appliquer
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: "#e5e7eb", display: "grid", gap: 2 }}>
                            <div><span style={{ color: MUTED, fontWeight: 600 }}>What:</span> {advice.what}</div>
                            <div><span style={{ color: MUTED, fontWeight: 600 }}>So What:</span> {advice.so_what}</div>
                            <div><span style={{ color: MUTED, fontWeight: 600 }}>Now What:</span> {advice.now_what}</div>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "center" }}>
                      <select
                        value={draft.type}
                        onChange={(event) => setDecisionDraft((prev) => ({ ...prev, [campaign.id]: { ...draft, type: event.target.value } }))}
                        style={{ background: CARD, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px" }}
                      >
                        <option value="">Decision...</option>
                        {DECISION_TYPES.map((decisionType) => <option key={decisionType.value} value={decisionType.value}>{decisionType.label}</option>)}
                      </select>
                      <input
                        type="number"
                        placeholder="New budget"
                        value={draft.newBudget}
                        onChange={(event) => setDecisionDraft((prev) => ({ ...prev, [campaign.id]: { ...draft, newBudget: event.target.value } }))}
                        style={{ background: CARD, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px" }}
                      />
                      <input
                        placeholder="Reasoning (So What?)"
                        value={draft.reasoning}
                        onChange={(event) => setDecisionDraft((prev) => ({ ...prev, [campaign.id]: { ...draft, reasoning: event.target.value } }))}
                        style={{ background: CARD, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px" }}
                      />
                      <input
                        placeholder="Expected impact (Now What?)"
                        value={draft.expected}
                        onChange={(event) => setDecisionDraft((prev) => ({ ...prev, [campaign.id]: { ...draft, expected: event.target.value } }))}
                        style={{ background: CARD, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px" }}
                      />
                      <button
                        onClick={() => void logDecision(campaign.id)}
                        style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", minHeight: 34 }}
                      >
                        Logger
                      </button>
                    </div>

                    {recentDecisions.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${BORDER}`, display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>Decisions recentes</div>
                        {recentDecisions.map((decision) => (
                          <div key={decision.id} style={{ fontSize: 11, color: MUTED, display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <span style={{ color: "var(--tdia-text)", minWidth: 78 }}>{decision.decision_date}</span>
                            <span style={{ color: DECISION_TYPES.find((type) => type.value === decision.decision_type)?.color ?? MUTED, fontWeight: 600, minWidth: 80 }}>
                              {DECISION_TYPES.find((type) => type.value === decision.decision_type)?.label ?? decision.decision_type}
                            </span>
                            {decision.previous_budget != null && decision.new_budget != null && (
                              <span>${decision.previous_budget} to ${decision.new_budget}</span>
                            )}
                            {decision.reasoning && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>| {decision.reasoning}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
