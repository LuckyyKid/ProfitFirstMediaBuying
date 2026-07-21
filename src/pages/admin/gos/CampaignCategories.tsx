import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Trash2, Layers } from "lucide-react";
import {
  createCampaignCategory,
  createCampaignConfigCampaign,
  deleteCampaignCategory,
  deleteCampaignConfigCampaign,
  fetchCampaignConfigurationData,
  updateCampaignCategory,
  updateCampaignConfigCampaign,
} from "@/gos/campaignConfigurationController";
import {
  computeCategoryBudgetTotals,
  EMPTY_CAMPAIGN_DRAFT,
  EMPTY_CATEGORY_DRAFT,
  groupCampaignConfigByCategory,
  KIND_OPTIONS,
  parseOptionalNumberInput,
  PLATFORM_OPTIONS,
  UNASSIGNED_CAMPAIGN_CATEGORY_ID,
  type CampaignCategory,
  type CampaignCategoryDraft,
  type CampaignConfigCampaign,
  type CampaignDraft,
  type CategoryBudgetTotals,
} from "@/gos/campaignConfiguration";
import type { BudgetApplicationResult } from "@/gos/budgetApplicationController";

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";

const inputStyle: CSSProperties = {
  padding: "6px 10px",
  background: BG_DEEP,
  border: `1px solid ${BORDER}`,
  color: "var(--tdia-text)",
  borderRadius: 6,
  fontSize: 12,
  width: "100%",
  minHeight: 32,
};

function formatNumber(value: number | null | undefined): string {
  return value == null ? "-" : Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function budgetPctColor(status: CategoryBudgetTotals["status"]): string {
  if (status === "in_band") return GREEN;
  if (status === "under") return YELLOW;
  if (status === "over") return RED;
  return MUTED;
}

function guardToast(result: BudgetApplicationResult | null) {
  if (!result) return;
  if (!result.applied) {
    toast.error(`${result.guard.decision}: ${result.guard.risks[0] ?? result.guard.summary}`);
    return;
  }
  toast.success(result.guard.decision === "ALLOW_WITH_CONDITIONS" ? "Budget applied with conditions" : "Budget applied");
}

export default function CampaignCategories() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [categories, setCategories] = useState<CampaignCategory[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignConfigCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState<CampaignCategoryDraft>(EMPTY_CATEGORY_DRAFT);
  const [newCampaign, setNewCampaign] = useState<CampaignDraft>(EMPTY_CAMPAIGN_DRAFT);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchCampaignConfigurationData(clientId);
      if (data.client) setSelectedClient(data.client);
      setCategories(data.categories);
      setCampaigns(data.campaigns);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Campaign configuration loading failed");
    } finally {
      setLoading(false);
    }
  }, [clientId, setSelectedClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCategory = async () => {
    if (!clientId) return;
    try {
      await createCampaignCategory(clientId, newCategory, categories.length);
      setNewCategory(EMPTY_CATEGORY_DRAFT);
      toast.success("Category added");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category creation failed");
    }
  };

  const patchCategory = async (category: CampaignCategory, patch: Partial<CampaignCategory>) => {
    try {
      await updateCampaignCategory(category.id, patch);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category update failed");
    }
  };

  const removeCategory = async (categoryId: string) => {
    if (!confirm("Supprimer cette categorie ? Les campagnes seront detachees.")) return;
    try {
      await deleteCampaignCategory(categoryId);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category deletion failed");
    }
  };

  const addCampaign = async () => {
    if (!clientId) return;
    try {
      const result = await createCampaignConfigCampaign(clientId, newCampaign);
      setNewCampaign(EMPTY_CAMPAIGN_DRAFT);
      guardToast(result.budget_application);
      if (!result.budget_application || result.budget_application.applied) toast.success("Campaign added");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Campaign creation failed");
    }
  };

  const patchCampaign = async (campaign: CampaignConfigCampaign, patch: Partial<CampaignConfigCampaign>) => {
    if (!clientId) return;
    try {
      const result = await updateCampaignConfigCampaign(clientId, campaign, patch);
      guardToast(result.budget_application);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Campaign update failed");
    }
  };

  const removeCampaign = async (campaignId: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    try {
      await deleteCampaignConfigCampaign(campaignId);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Campaign deletion failed");
    }
  };

  const campaignsByCategory = useMemo(
    () => groupCampaignConfigByCategory(categories, campaigns),
    [categories, campaigns],
  );
  const unassigned = campaignsByCategory[UNASSIGNED_CAMPAIGN_CATEGORY_ID] ?? [];

  if (loading) return <div style={{ padding: 24, color: MUTED }}>Chargement...</div>;

  return (
    <div style={{ padding: 24 }}>
      <SectionHeader
        title="Categories de campagnes"
        subtitle="Fondation du Media Buyer Workspace : groupez les campagnes par intention, fixez un CPA cible et gardez les budgets courants sous controle."
      />

      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.03em", color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Ajouter une categorie
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <input placeholder="Nom" value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} style={inputStyle} />
          <select value={newCategory.kind} onChange={(event) => setNewCategory({ ...newCategory, kind: event.target.value })} style={inputStyle}>
            {KIND_OPTIONS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Target CPA" value={newCategory.target_cpa} onChange={(event) => setNewCategory({ ...newCategory, target_cpa: event.target.value })} style={inputStyle} />
          <input type="number" step="0.01" placeholder="Budget/jour cible" value={newCategory.target_daily_budget} onChange={(event) => setNewCategory({ ...newCategory, target_daily_budget: event.target.value })} style={inputStyle} />
          <button onClick={() => void addCategory()} style={{ padding: "6px 14px", background: BLUE, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 32 }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>
      </section>

      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.03em", color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Ajouter une campagne
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <input placeholder="Nom de la campagne" value={newCampaign.name} onChange={(event) => setNewCampaign({ ...newCampaign, name: event.target.value })} style={inputStyle} />
          <select value={newCampaign.platform} onChange={(event) => setNewCampaign({ ...newCampaign, platform: event.target.value })} style={inputStyle}>
            {PLATFORM_OPTIONS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
          </select>
          <select value={newCampaign.category_id} onChange={(event) => setNewCampaign({ ...newCampaign, category_id: event.target.value })} style={inputStyle}>
            <option value="">- sans categorie -</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Budget/jour" value={newCampaign.current_daily_budget} onChange={(event) => setNewCampaign({ ...newCampaign, current_daily_budget: event.target.value })} style={inputStyle} />
          <input placeholder="ID externe" value={newCampaign.external_id} onChange={(event) => setNewCampaign({ ...newCampaign, external_id: event.target.value })} style={inputStyle} />
          <button onClick={() => void addCampaign()} style={{ padding: "6px 14px", background: BLUE, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 32 }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>
      </section>

      {categories.length === 0 && unassigned.length === 0 ? (
        <div style={{ marginTop: 16 }}><EmptyState title="Aucune categorie ni campagne configuree." /></div>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {categories.map((category) => {
            const list = campaignsByCategory[category.id] ?? [];
            const totals = computeCategoryBudgetTotals(category, list);
            const budgetPctColorValue = budgetPctColor(totals.status);

            return (
              <article key={category.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", background: "hsl(220 45% 25%)", display: "grid", gridTemplateColumns: "auto minmax(160px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(140px, 1fr) minmax(95px, auto) minmax(70px, auto) 34px", gap: 10, alignItems: "center", overflowX: "auto" }}>
                  <Layers size={16} color={BLUE} />
                  <input
                    defaultValue={category.name}
                    onBlur={(event) => event.target.value !== category.name && void patchCategory(category, { name: event.target.value })}
                    style={{ ...inputStyle, fontSize: 14, fontWeight: 700, background: "transparent", border: "none" }}
                  />
                  <select defaultValue={category.kind} onChange={(event) => void patchCategory(category, { kind: event.target.value })} style={inputStyle}>
                    {KIND_OPTIONS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                  <div>
                    <label style={{ color: MUTED, fontSize: 10, letterSpacing: "0.03em" }}>TARGET CPA</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={category.target_cpa ?? ""}
                      onBlur={(event) => void patchCategory(category, { target_cpa: parseOptionalNumberInput(event.target.value) })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ color: MUTED, fontSize: 10, letterSpacing: "0.03em" }}>TARGET BUDGET/J</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={category.target_daily_budget ?? ""}
                      onBlur={(event) => void patchCategory(category, { target_daily_budget: parseOptionalNumberInput(event.target.value) })}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, textAlign: "right" }}>
                    {totals.active_campaign_count} camp<br />
                    <span style={{ color: "var(--tdia-text)", fontWeight: 700 }}>{formatNumber(totals.daily_budget_total)}$/j</span>
                    {totals.budget_target_pct != null && (
                      <div style={{ color: budgetPctColorValue, fontWeight: 700 }}>
                        {totals.budget_target_pct.toFixed(0)}% du cible
                      </div>
                    )}
                  </div>
                  <button onClick={() => void patchCategory(category, { active: !category.active })} style={{ background: category.active ? GREEN : MUTED, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    {category.active ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => void removeCategory(category.id)} style={{ background: "transparent", color: RED, border: "none", cursor: "pointer" }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {list.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: MUTED, fontSize: 12 }}>Aucune campagne dans cette categorie.</div>
                ) : (
                  <CampaignTable
                    campaigns={list}
                    categories={categories}
                    onUpdate={patchCampaign}
                    onRemove={removeCampaign}
                  />
                )}
              </article>
            );
          })}

          {unassigned.length > 0 && (
            <section style={{ border: `1px dashed ${RED}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "hsl(0 84% 96%)", color: "hsl(0 72% 42%)", fontSize: 12, fontWeight: 700, letterSpacing: "0.03em" }}>
                {unassigned.length} CAMPAGNE(S) SANS CATEGORIE
              </div>
              <CampaignTable campaigns={unassigned} categories={categories} onUpdate={patchCampaign} onRemove={removeCampaign} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignTable({
  campaigns,
  categories,
  onUpdate,
  onRemove,
}: {
  campaigns: CampaignConfigCampaign[];
  categories: CampaignCategory[];
  onUpdate: (campaign: CampaignConfigCampaign, patch: Partial<CampaignConfigCampaign>) => Promise<void>;
  onRemove: (campaignId: string) => Promise<void>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: BG_DEEP }}>
            <Th>Campagne</Th>
            <Th>Plateforme</Th>
            <Th align="right">Budget/J</Th>
            <Th>Categorie</Th>
            <Th align="center">Actif</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              categories={categories}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignRow({
  campaign,
  categories,
  onUpdate,
  onRemove,
}: {
  campaign: CampaignConfigCampaign;
  categories: CampaignCategory[];
  onUpdate: (campaign: CampaignConfigCampaign, patch: Partial<CampaignConfigCampaign>) => Promise<void>;
  onRemove: (campaignId: string) => Promise<void>;
}) {
  return (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
      <td style={{ padding: 8 }}>
        <input
          defaultValue={campaign.name}
          onBlur={(event) => event.target.value !== campaign.name && void onUpdate(campaign, { name: event.target.value })}
          style={{ ...inputStyle, background: "transparent", border: "none", fontSize: 13, color: "var(--tdia-text)" }}
        />
      </td>
      <td style={{ padding: 8 }}>
        <select defaultValue={campaign.platform} onChange={(event) => void onUpdate(campaign, { platform: event.target.value })} style={inputStyle}>
          {PLATFORM_OPTIONS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
      </td>
      <td style={{ padding: 8, width: 130 }}>
        <input
          type="number"
          step="0.01"
          defaultValue={campaign.current_daily_budget ?? ""}
          onBlur={(event) => void onUpdate(campaign, { current_daily_budget: parseOptionalNumberInput(event.target.value) })}
          style={{ ...inputStyle, textAlign: "right" }}
        />
      </td>
      <td style={{ padding: 8, width: 220 }}>
        <select defaultValue={campaign.category_id ?? ""} onChange={(event) => void onUpdate(campaign, { category_id: event.target.value || null })} style={inputStyle}>
          <option value="">- sans -</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </td>
      <td style={{ padding: 8, textAlign: "center", width: 70 }}>
        <button onClick={() => void onUpdate(campaign, { active: !campaign.active })} style={{ background: campaign.active ? GREEN : MUTED, color: "var(--tdia-text)", border: "none", padding: "3px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
          {campaign.active ? "ON" : "OFF"}
        </button>
      </td>
      <td style={{ padding: 8, width: 40, textAlign: "right" }}>
        <button onClick={() => void onRemove(campaign.id)} style={{ background: "transparent", color: RED, border: "none", cursor: "pointer" }}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: CSSProperties["textAlign"] }) {
  return (
    <th style={{ padding: 8, textAlign: align, color: MUTED, fontSize: 10, letterSpacing: "0.03em", fontWeight: 700, textTransform: "uppercase" }}>
      {children}
    </th>
  );
}
