/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Plus, DollarSign, Sigma, Trash2 } from "lucide-react";
import type { SpendingPowerV2Output } from "@/gos/spendingPowerV2";
import type { ProfitFirstOutput } from "@/gos/profitFirstMediaBuying";
import {
  createSpendingPowerV1Snapshot,
  fetchSpendingPowerData,
  runAndSaveProfitFirstMediaBuyingForSpendingPower,
  runAndSaveSpendEfficiencyFrontierForSpendingPower,
  runAndSaveSpendingPowerV2Snapshot,
  toSpendHistoryPoint,
  type SpendingPowerBasketEconomics,
  type SpendingPowerFinancialInput,
  type SpendingPowerSnapshot,
  type SpendHistoryPoint,
} from "@/gos/spendingPowerController";
import type { SpendEfficiencyFrontierOutput, SpendEfficiencyObjective } from "@/gos/spendEfficiencyFrontier";

const FRONTIER_OBJECTIVES: Array<{ value: SpendEfficiencyObjective; label: string }> = [
  { value: "MAX_FIRST_ORDER_CONTRIBUTION", label: "Max contribution first-order" },
  { value: "MAX_LIFETIME_CONTRIBUTION", label: "Max contribution LTV" },
  { value: "MAX_NEW_CUSTOMER_REVENUE_AT_BREAK_EVEN", label: "Max NCR a break-even" },
  { value: "CUSTOM_SPEND", label: "Spend custom" },
];

export default function SpendingPower() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [fi, setFi] = useState<SpendingPowerFinancialInput | null>(null);
  const [snaps, setSnaps] = useState<SpendingPowerSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    period_label: "", cash_available: "", monthly_burn: "", target_roas: "",
  });

  // Wave 10C — historique et paramètres régression
  const [history, setHistory] = useState<SpendHistoryPoint[]>([]);
  const [newRow, setNewRow] = useState({ spend: "", cac: "", mer: "", new_customer_revenue: "" });
  const [plannedSpend, setPlannedSpend] = useState("");
  const [v2Result, setV2Result] = useState<SpendingPowerV2Output | null>(null);
  const [frontierObjective, setFrontierObjective] = useState<SpendEfficiencyObjective>("MAX_FIRST_ORDER_CONTRIBUTION");
  const [ltvMultiplier, setLtvMultiplier] = useState("1");
  const [minFirstOrderContribution, setMinFirstOrderContribution] = useState("0");
  const [frontierResult, setFrontierResult] = useState<SpendEfficiencyFrontierOutput | null>(null);
  const [basket, setBasket] = useState<SpendingPowerBasketEconomics | null>(null);
  const [pfmb, setPfmb] = useState<ProfitFirstOutput | null>(null);
  const [monthlySessions, setMonthlySessions] = useState("");

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchSpendingPowerData(clientId);
      if (data.client) setSelectedClient(data.client as any);
      setFi(data.financial_input);
      setBasket(data.basket);
      setSnaps(data.snapshots);
      if (data.hydrated_history.length > 0 && history.length === 0) setHistory(data.hydrated_history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de chargement du pouvoir de depense";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const submitV1 = async () => {
    if (!clientId) return;
    try {
      await createSpendingPowerV1Snapshot(clientId, form, fi);
      toast.success("Snapshot v1 cree");
      setForm({ period_label: "", cash_available: "", monthly_burn: "", target_roas: "" });
      setShowForm(false);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de sauvegarde v1";
      toast.error(message);
    }
  };

  const addHistoryRow = () => {
    try {
      setHistory([...history, toSpendHistoryPoint(newRow)]);
      setNewRow({ spend: "", cac: "", mer: "", new_customer_revenue: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ligne d'historique invalide";
      toast.error(message);
    }
  };

  const runV2 = async () => {
    if (!clientId) return;
    try {
      const out = await runAndSaveSpendingPowerV2Snapshot(clientId, history, plannedSpend, fi, snaps[0] ?? null);
      setV2Result(out);
      toast.success(`Modele ${out.model_type} execute`);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur d'execution v2";
      toast.error(message);
    }
  };

  const runFrontier = async () => {
    if (!clientId) return;
    try {
      const out = await runAndSaveSpendEfficiencyFrontierForSpendingPower(clientId, {
        history,
        objective: frontierObjective,
        financialInput: fi,
        basket,
        ltvMultiplier,
        plannedSpend,
        minFirstOrderContribution,
      });
      setFrontierResult(out);
      setPlannedSpend(String(out.recommended_spend));
      toast.success(`Frontier sauvegardee - spend recommande ${out.recommended_spend} $`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de sauvegarde frontier";
      toast.error(message);
    }
  };

  const runPfmb = async () => {
    if (!clientId) return;
    try {
      const out = await runAndSaveProfitFirstMediaBuyingForSpendingPower(clientId, {
        plannedSpend,
        monthlySessions,
        history,
        basket,
        financialInput: fi,
        latestSnapshot: snaps[0] ?? null,
      });
      setPfmb(out);
      toast.success(`PFMB - ${out.recommended_spend} $ (${out.binding_constraint})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur PFMB";
      toast.error(message);
    }
  };
  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  const latest = snaps[0];

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "V1 (seuil cash/marge) + V2 (régression OLS déterministe sur historique spend→CAC/MER, backtest leave-one-out, projections low/base/high).",
          dataSource: "Financial inputs · historique de dépense/CAC/MER · Cash & burn.",
          usedBy: "Objectifs de métriques · Prévisions · Carte d'exécution.",
          requiredInputs: ["Marge brute %", "CAC/MER cibles", "≥4 périodes historiques pour v2"],
          nextStep: "Ajoute des périodes d'historique puis lance v2 pour projeter CAC/MER à un niveau de spend donné.",
          primaryCta: "Lancer la régression v2",
        }}
        title="Pouvoir de dépense"
        subtitle="Wave 10C — Modèle v2 régression OLS avec fallback v1 (seuil)."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouveau snapshot v1
            </button>
          </>
        }
      />

      {!fi && (
        <div className="gos-card" style={{ marginBottom: 20, borderColor: "hsl(43 90% 55% / 0.4)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Marge manquante</div>
          <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>
            Sans <b>Financial Inputs</b> (gross_margin_percent), le calcul se limite au budget cash.
          </div>
        </div>
      )}

      {latest && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <Kpi label="Runway" value={latest.runway_months != null ? `${latest.runway_months} mois` : "—"} />
          <Kpi label="Spend max / mois" value={latest.max_monthly_ad_spend != null ? `${Number(latest.max_monthly_ad_spend).toLocaleString()} $` : "—"} />
          <Kpi label="Spend recommandé" value={latest.recommended_monthly_ad_spend != null ? `${Number(latest.recommended_monthly_ad_spend).toLocaleString()} $` : "—"} accent />
          <Kpi label="Dernier modèle" value={latest.model_type ?? "V1_THRESHOLD"} />
        </div>
      )}

      {/* ---------- Wave 10C : Regression v2 ---------- */}
      <div
        style={{
          background: "hsl(220 45% 16%)",
          border: "1px solid hsl(220 45% 25%)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "none",
          marginBottom: 20,
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: "1px solid hsl(220 45% 25%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sigma size={14} style={{ color: "var(--tdia-blue)" }} />
            <h2 style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--tdia-blue)", margin: 0 }}>
              Moteur : Régression v2 OLS
            </h2>
          </div>
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "3px 10px", borderRadius: 999, background: "hsl(226 100% 60% / 0.12)", color: "var(--tdia-blue)", border: "1px solid hsl(226 100% 60% / 0.2)" }}>
            Active Engine
          </span>
        </div>

        <div style={{ padding: 20 }}>

        <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "hsl(0 0% 40%)", marginBottom: 10 }}>
          Points de données historiques (≥4 pour activer la régression, sinon fallback v1)
        </div>
        <table className="gos-table" style={{ marginBottom: 12 }}>
          <thead><tr><th>#</th><th>Spend ($)</th><th>New Customer Revenue</th><th>CAC</th><th>MER</th><th></th></tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{h.spend}</td>
                <td>{h.new_customer_revenue ?? "—"}</td>
                <td>{h.cac ?? "—"}</td>
                <td>{h.mer ?? "—"}</td>
                <td>
                  <button className="gos-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => setHistory(history.filter((_, j) => j !== i))}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>+</td>
              <td><input className="gos-input" style={{ width: 100, padding: "4px 6px" }} type="number" value={newRow.spend} onChange={(e) => setNewRow({ ...newRow, spend: e.target.value })} /></td>
              <td><input className="gos-input" style={{ width: 140, padding: "4px 6px" }} type="number" value={newRow.new_customer_revenue} onChange={(e) => setNewRow({ ...newRow, new_customer_revenue: e.target.value })} /></td>
              <td><input className="gos-input" style={{ width: 80, padding: "4px 6px" }} type="number" value={newRow.cac} onChange={(e) => setNewRow({ ...newRow, cac: e.target.value })} /></td>
              <td><input className="gos-input" style={{ width: 80, padding: "4px 6px" }} type="number" step="0.01" value={newRow.mer} onChange={(e) => setNewRow({ ...newRow, mer: e.target.value })} /></td>
              <td><button className="gos-btn-secondary" style={{ padding: "2px 8px" }} onClick={addHistoryRow}>Ajouter</button></td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <F label="Planned spend ($)">
            <input className="gos-input" type="number" value={plannedSpend} onChange={(e) => setPlannedSpend(e.target.value)} />
          </F>
          <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>
            Cibles : CAC {fi?.target_cac ?? "—"} · MER {fi?.target_mer ?? "—"}
          </div>
          <button className="gos-btn-primary" onClick={runV2}>
            <Sigma size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Lancer v2
          </button>
        </div>

        {v2Result && (
          <div style={{ marginTop: 16, borderTop: "1px solid hsl(220 45% 16%)", paddingTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              <Kpi label="Modèle" value={v2Result.model_type} accent />
              <Kpi label="Confiance" value={`${v2Result.recommended_model_confidence}/100`} />
              <Kpi label="R² CAC" value={v2Result.fit_cac?.r_squared != null ? String(v2Result.fit_cac.r_squared) : "—"} />
              <Kpi label="Erreur backtest" value={v2Result.backtest_error_percent != null ? `${v2Result.backtest_error_percent}%` : "—"} />
            </div>
            <table className="gos-table">
              <thead><tr><th>Métrique</th><th>Low</th><th>Base</th><th>High</th></tr></thead>
              <tbody>
                <tr><td>Spend recommandé ($)</td><td>{v2Result.recommended_spend.low}</td><td style={{ fontWeight: 600, color: "var(--tdia-blue)" }}>{v2Result.recommended_spend.base}</td><td>{v2Result.recommended_spend.high}</td></tr>
                <tr><td>CAC projeté</td><td>{v2Result.projected_cac.low ?? "—"}</td><td>{v2Result.projected_cac.base ?? "—"}</td><td>{v2Result.projected_cac.high ?? "—"}</td></tr>
                <tr><td>MER projeté</td><td>{v2Result.projected_mer.low ?? "—"}</td><td>{v2Result.projected_mer.base ?? "—"}</td><td>{v2Result.projected_mer.high ?? "—"}</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <RiskChip label="Spend risk" value={v2Result.spend_risk} />
              <RiskChip label="Efficiency risk" value={v2Result.efficiency_risk} />
            </div>
            {v2Result.risks.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", marginBottom: 4 }}>RISQUES</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {v2Result.risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            {v2Result.conditions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", marginBottom: 4 }}>CONDITIONS</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {v2Result.conditions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--tdia-muted)", fontStyle: "italic" }}>
              {v2Result.summary}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ---------- Spend Efficiency Frontier ---------- */}
      <div style={{ background: "hsl(220 45% 16%)", border: "1px solid hsl(220 45% 25%)", borderRadius: 12, overflow: "hidden", boxShadow: "none", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid hsl(220 45% 25%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sigma size={14} style={{ color: "hsl(38 92% 55%)" }} />
            <h2 style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "hsl(38 92% 55%)", margin: 0 }}>
              Moteur : Spend Efficiency Frontier
            </h2>
          </div>
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "3px 10px", borderRadius: 999, background: "hsl(38 92% 55% / 0.12)", color: "hsl(38 92% 55%)", border: "1px solid hsl(38 92% 55% / 0.25)" }}>
            Objectif × AMR × Contribution
          </span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginBottom: 12 }}>
            Utilise <b>new customer revenue</b> par période pour construire une courbe AMR, puis choisit le budget selon l'objectif business. MER reste utile pour v2; NCR est requis pour cette frontier.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <F label="Objectif">
              <select className="gos-select" value={frontierObjective} onChange={(e) => setFrontierObjective(e.target.value as SpendEfficiencyObjective)}>
                {FRONTIER_OBJECTIVES.map((objective) => (
                  <option key={objective.value} value={objective.value}>{objective.label}</option>
                ))}
              </select>
            </F>
            <F label="LTV revenue multiplier">
              <input className="gos-input" type="number" step="0.1" value={ltvMultiplier} onChange={(e) => setLtvMultiplier(e.target.value)} />
            </F>
            <F label="Min contribution 1st-order ($)">
              <input className="gos-input" type="number" value={minFirstOrderContribution} onChange={(e) => setMinFirstOrderContribution(e.target.value)} />
            </F>
            <button className="gos-btn-primary" onClick={runFrontier}>
              <Sigma size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Choisir le spend
            </button>
          </div>

          {frontierResult && (
            <div style={{ borderTop: "1px solid hsl(220 45% 14%)", marginTop: 16, paddingTop: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
                <Kpi label="Spend recommandé" value={`${frontierResult.recommended_spend.toLocaleString()} $`} accent />
                <Kpi label="AMR recommandé" value={String(frontierResult.recommended_amr)} />
                <Kpi label="Break-even AMR" value={frontierResult.break_even_amr != null ? String(frontierResult.break_even_amr) : "—"} />
                <Kpi label="Confiance" value={`${frontierResult.confidence_score}/100`} />
              </div>
              <table className="gos-table">
                <thead><tr><th>Spend</th><th>NCR</th><th>Contribution 1st-order</th><th>Contribution LTV</th><th>Risque extrapolation</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{frontierResult.selected.spend.toLocaleString()} $</td>
                    <td>{frontierResult.selected.new_customer_revenue.toLocaleString()} $</td>
                    <td style={{ fontWeight: 700, color: frontierResult.selected.first_order_contribution >= 0 ? "hsl(142 71% 55%)" : "hsl(0 72% 65%)" }}>
                      {frontierResult.selected.first_order_contribution.toLocaleString()} $
                    </td>
                    <td>{frontierResult.selected.lifetime_contribution.toLocaleString()} $</td>
                    <td><ToneChip value={frontierResult.selected.extrapolation_risk} /></td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--tdia-muted)" }}>
                Fit: {frontierResult.fit.model_type} · sample {frontierResult.fit.sample_size} · R² {frontierResult.fit.r_squared ?? "—"}.
              </div>
              {frontierResult.risks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", marginBottom: 4 }}>RISQUES</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                    {frontierResult.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--tdia-muted)", fontStyle: "italic" }}>{frontierResult.summary}</div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Profit-First Media Buying ---------- */}
      <div style={{ background: "hsl(220 45% 16%)", border: "1px solid hsl(220 45% 25%)", borderRadius: 12, overflow: "hidden", boxShadow: "none", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid hsl(220 45% 25%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sigma size={14} style={{ color: "hsl(142 71% 55%)" }} />
            <h2 style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "hsl(142 71% 55%)", margin: 0 }}>
              Moteur : Profit-First Media Buying (Hemrock × TDIA)
            </h2>
          </div>
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "3px 10px", borderRadius: 999, background: "hsl(142 71% 45% / 0.12)", color: "hsl(142 71% 55%)", border: "1px solid hsl(142 71% 45% / 0.25)" }}>
            v1 · Cash × Funnel × Cohort
          </span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginBottom: 12 }}>
            Combine frontier spend + régression v2 + contrainte cash (stock/payout) + contrainte funnel (sessions × CVR) + LTV par cohorte (new vs repeat). Utilise le <b>planned spend</b> actuellement affiché plus haut.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginBottom: 12 }}>
            <F label="Sessions mensuelles attendues">
              <input className="gos-input" type="number" value={monthlySessions} onChange={(e) => setMonthlySessions(e.target.value)} placeholder="ex: 50000" />
            </F>
            <button className="gos-btn-primary" onClick={runPfmb}>
              <Sigma size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Lancer PFMB
            </button>
          </div>
          {!basket && (
            <div style={{ fontSize: 12, color: "hsl(43 96% 66%)", marginBottom: 12 }}>
              ⚠ Aucun <b>gos_basket_economics</b> pour ce client. Ajoute aov_new, aov_repeat, cac_new, cac_repeat, conversion_rate, repeat_cycle_months, churn_per_cycle, inventory_days, payout_delay_days.
            </div>
          )}
          {pfmb && (
            <div style={{ borderTop: "1px solid hsl(220 45% 14%)", paddingTop: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
                <Kpi label="Spend recommandé" value={`${pfmb.recommended_spend.toLocaleString()} $`} accent />
                <Kpi label="Contrainte active" value={pfmb.binding_constraint} />
                <Kpi label={`LTV new (horizon)`} value={`${pfmb.ltv_new_horizon.toLocaleString()} $`} />
                <Kpi label="Contribution totale" value={`${pfmb.contribution_total.toLocaleString()} $`} />
              </div>
              <table className="gos-table">
                <thead><tr><th>Contrainte</th><th>Valeur</th><th>Détail</th></tr></thead>
                <tbody>
                  <tr><td>Cash effectif</td><td>{pfmb.effective_cash_available.toLocaleString()} $</td><td>Stock: {pfmb.cash_locked_inventory.toLocaleString()} $ · Payout: {pfmb.cash_locked_payout.toLocaleString()} $</td></tr>
                  <tr><td>Cash-capped spend</td><td>{pfmb.cash_capped_spend.toLocaleString()} $</td><td>—</td></tr>
                  <tr><td>Funnel capacity</td><td>{(pfmb.funnel_capacity_ratio * 100).toFixed(0)}%</td><td>Max orders/mois: {pfmb.max_orders_by_funnel} · commandes @ spend: {pfmb.max_orders_by_spend}</td></tr>
                  <tr><td>Payback (mois)</td><td>{pfmb.payback_months_estimate ?? "—"}</td><td>CAC new / (AOV new × marge / cycle)</td></tr>
                </tbody>
              </table>
              {pfmb.risks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", marginBottom: 4 }}>RISQUES</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                    {pfmb.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--tdia-muted)", fontStyle: "italic" }}>{pfmb.summary}</div>
            </div>
          )}
        </div>
      </div>



      {/* ---------- v1 form ---------- */}
      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouveau snapshot v1 (seuil)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <F label="Label période"><input className="gos-input" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="e.g. Nov 2026" /></F>
            <F label="Cash disponible ($)"><input className="gos-input" type="number" value={form.cash_available} onChange={(e) => setForm({ ...form, cash_available: e.target.value })} /></F>
            <F label="Burn mensuel ($)"><input className="gos-input" type="number" value={form.monthly_burn} onChange={(e) => setForm({ ...form, monthly_burn: e.target.value })} /></F>
            <F label="Target ROAS"><input className="gos-input" type="number" step="0.1" value={form.target_roas} onChange={(e) => setForm({ ...form, target_roas: e.target.value })} placeholder={String(fi?.target_mer ?? 2.5)} /></F>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submitV1}>Calculer & sauvegarder</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div
        style={{
          background: "hsl(220 45% 16%)",
          border: "1px solid hsl(220 45% 25%)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 20px", background: "hsl(220 45% 25%)", borderBottom: "1px solid hsl(220 45% 25%)" }}>
          <h3 style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "hsl(0 0% 40%)", margin: 0 }}>
            Historique des simulations
          </h3>
        </div>
        {snaps.length === 0 ? (
          <EmptyState title="Aucun snapshot" hint="Lance la régression v2 ou ajoute un snapshot v1." />
        ) : (
          <table className="gos-table">
            <thead>
              <tr>
                <th>Période</th><th>Modèle</th><th>Runway</th><th>Spend max</th><th>Recommandé</th><th>R² CAC</th><th>Confiance</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.id}>
                  <td><DollarSign size={12} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--tdia-blue)" }} />{s.period_label}</td>
                  <td style={{ ...mono, fontSize: 11 }}>{s.model_type ?? "V1_THRESHOLD"}</td>
                  <td>{s.runway_months ?? "—"}</td>
                  <td style={{ fontStyle: "italic" }}>{s.max_monthly_ad_spend != null ? `${Number(s.max_monthly_ad_spend).toLocaleString()} $` : "—"}</td>
                  <td style={{ fontWeight: 700, color: "var(--tdia-blue)" }}>{s.recommended_monthly_ad_spend != null ? `${Number(s.recommended_monthly_ad_spend).toLocaleString()} $` : "—"}</td>
                  <td style={{ ...mono }}>{s.r_squared_cac ?? "—"}</td>
                  <td>
                    {s.recommended_model_confidence != null ? (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: s.recommended_model_confidence >= 70 ? "hsl(142 71% 45% / 0.12)" : s.recommended_model_confidence >= 40 ? "hsl(43 96% 56% / 0.12)" : "hsl(0 72% 60% / 0.12)",
                          color: s.recommended_model_confidence >= 70 ? "hsl(142 71% 55%)" : s.recommended_model_confidence >= 40 ? "hsl(43 96% 66%)" : "hsl(0 72% 65%)",
                          border: `1px solid ${s.recommended_model_confidence >= 70 ? "hsl(142 71% 45% / 0.25)" : s.recommended_model_confidence >= 40 ? "hsl(43 96% 56% / 0.25)" : "hsl(0 72% 60% / 0.25)"}`,
                        }}
                      >
                        {s.recommended_model_confidence}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--tdia-muted)" }}>
        v1 · max = min((cash − burn × 3) / 3, burn / (marge × ROAS) × 1.5) — recommandé = max × 0.7.
        v2 · régression OLS spend→CAC / spend→MER, projections ± f(R²), backtest leave-one-out.
      </div>
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: "hsl(220 45% 16%)",
        border: "1px solid hsl(220 45% 25%)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "none",
      }}
    >
      <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "hsl(0 0% 40%)", fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? "var(--tdia-blue)" : "hsl(0 0% 20%)", letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}

function RiskChip({ label, value }: { label: string; value: "LOW" | "MEDIUM" | "HIGH" }) {
  const color = value === "HIGH" ? "#c1121f" : value === "MEDIUM" ? "#c98a1b" : "#0f8a44";
  return (
    <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "hsl(220 45% 14%)", border: `1px solid ${color}`, color }}>
      {label}: <b>{value}</b>
    </span>
  );
}

function ToneChip({ value }: { value: "IN_SAMPLE" | "MODERATE" | "HIGH" }) {
  const color = value === "HIGH" ? "#c1121f" : value === "MODERATE" ? "#c98a1b" : "#0f8a44";
  return (
    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "hsl(220 45% 14%)", border: `1px solid ${color}`, color }}>
      {value}
    </span>
  );
}
