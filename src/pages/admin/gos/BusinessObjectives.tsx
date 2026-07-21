import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Save, Trash2, Target, Flag } from "lucide-react";
import {
  createBusinessObjective,
  deleteBusinessObjective,
  fetchBusinessObjectives,
  saveBusinessObjective,
  type BusinessObjective as Objective,
} from "@/gos/businessObjectivesController";

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";

const OBJECTIVE_TYPES: { value: string; label: string; kpi_suggestions: string[] }[] = [
  { value: "acquire_new", label: "Acquérir nouveaux clients", kpi_suggestions: ["new_customers", "cac", "cost_per_acquisition"] },
  { value: "increase_aov", label: "Augmenter panier moyen (AOV)", kpi_suggestions: ["aov", "units_per_order", "attach_rate"] },
  { value: "improve_retention", label: "Améliorer rétention", kpi_suggestions: ["repeat_rate", "60d_repeat", "churn_rate"] },
  { value: "clear_inventory", label: "Écouler stock", kpi_suggestions: ["inventory_days", "sell_through_rate", "units_sold"] },
  { value: "launch_product", label: "Lancer nouveau produit", kpi_suggestions: ["units_sold", "awareness_%", "trial_rate"] },
  { value: "defend_share", label: "Défendre part de marché", kpi_suggestions: ["market_share", "brand_search", "share_of_voice"] },
  { value: "reactivate", label: "Réactiver clients dormants", kpi_suggestions: ["reactivated_customers", "win_back_rate"] },
  { value: "other", label: "Autre", kpi_suggestions: [] },
];

const STATUS_COLORS: Record<string, string> = {
  active: GREEN, paused: YELLOW, achieved: BLUE, abandoned: RED,
};

export default function BusinessObjectives() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Objective[]>([]);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      setItems(await fetchBusinessObjectives(clientId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les objectifs");
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const addObjective = async () => {
    if (!clientId) return;
    try {
      await createBusinessObjective(clientId, items.length + 1);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de creer l'objectif");
    }
  };

  const updateItem = (id: string, patch: Partial<Objective>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const saveItem = async (item: Objective) => {
    try {
      await saveBusinessObjective(item);
    toast.success("Objectif enregistré");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer l'objectif");
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Supprimer cet objectif ?")) return;
    try {
      await deleteBusinessObjective(id);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer l'objectif");
    }
  };

  if (!selectedClient) return <EmptyState title="Aucun client sélectionné" hint="Sélectionne un client d'abord." />;

  const activeCount = items.filter(i => i.status === "active").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
      <SectionHeader
        title="Business Objectives"
        subtitle="L'objectif business drive tout : creative brief, campaign priorities, budget allocation. Un client = 1-3 objectifs actifs max, ordonnés par priorité."
      />

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", gap: 20, alignItems: "center" }}>
        <Flag size={28} style={{ color: BLUE }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--tdia-text)", fontWeight: 600 }}>{activeCount} objectif(s) actif(s)</div>
          <div style={{ fontSize: 11, color: MUTED }}>
            Idéalement 1 objectif principal + 1-2 secondaires. Au-delà de 3 actifs, l'équipe se disperse.
          </div>
        </div>
        <button onClick={addObjective}
          style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nouvel objectif
        </button>
      </div>

      {loading && <div style={{ color: MUTED }}>Chargement...</div>}

      {!loading && items.length === 0 && (
        <EmptyState title="Aucun objectif défini" hint="Définis au moins un objectif business pour aligner l'exécution." />
      )}

      {items.map(item => {
        const type = OBJECTIVE_TYPES.find(t => t.value === item.objective_type);
        const progress = item.target_value && item.current_value != null
          ? Math.min(100, (item.current_value / item.target_value) * 100) : null;
        return (
          <div key={item.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${STATUS_COLORS[item.status] ?? MUTED}`, borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 140px auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Priorité</div>
                <input type="number" value={item.priority}
                  onChange={e => updateItem(item.id, { priority: Number(e.target.value) })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Type</div>
                <select value={item.objective_type}
                  onChange={e => updateItem(item.id, { objective_type: e.target.value })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }}>
                  {OBJECTIVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Label</div>
                <input value={item.label}
                  onChange={e => updateItem(item.id, { label: e.target.value })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Statut</div>
                <select value={item.status}
                  onChange={e => updateItem(item.id, { status: e.target.value })}
                  style={{ background: BG_DEEP, color: STATUS_COLORS[item.status], fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }}>
                  <option value="active">Actif</option>
                  <option value="paused">En pause</option>
                  <option value="achieved">Atteint</option>
                  <option value="abandoned">Abandonné</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => saveItem(item)}
                  style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Save size={13} /> Save
                </button>
                <button onClick={() => deleteItem(item.id)}
                  style={{ background: "transparent", color: RED, border: `1px solid ${RED}`, borderRadius: 6, padding: "8px 10px", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 140px 140px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>KPI principal</div>
                <input value={item.primary_kpi} list={`kpi-${item.id}`}
                  onChange={e => updateItem(item.id, { primary_kpi: e.target.value })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
                <datalist id={`kpi-${item.id}`}>
                  {type?.kpi_suggestions.map(k => <option key={k} value={k} />)}
                </datalist>
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Cible</div>
                <input type="number" value={item.target_value ?? ""}
                  onChange={e => updateItem(item.id, { target_value: e.target.value ? Number(e.target.value) : null })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Actuel</div>
                <input type="number" value={item.current_value ?? ""}
                  onChange={e => updateItem(item.id, { current_value: e.target.value ? Number(e.target.value) : null })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Début</div>
                <input type="date" value={item.timeframe_start ?? ""}
                  onChange={e => updateItem(item.id, { timeframe_start: e.target.value || null })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Fin</div>
                <input type="date" value={item.timeframe_end ?? ""}
                  onChange={e => updateItem(item.id, { timeframe_end: e.target.value || null })}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
              </div>
            </div>

            {progress != null && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 4 }}>
                  <span><Target size={11} style={{ display: "inline", marginRight: 4 }} />Progression</span>
                  <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{progress.toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, background: BG_DEEP, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: progress >= 90 ? GREEN : progress >= 50 ? BLUE : YELLOW }} />
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Rationale (pourquoi cet objectif maintenant ?)</div>
                <textarea value={item.rationale ?? ""}
                  onChange={e => updateItem(item.id, { rationale: e.target.value })}
                  rows={3}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Contraintes / risques</div>
                <textarea value={item.constraints_notes ?? ""}
                  onChange={e => updateItem(item.id, { constraints_notes: e.target.value })}
                  rows={3}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
