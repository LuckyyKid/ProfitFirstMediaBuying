import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, Activity } from "lucide-react";
import { runRetentionCohortV2, type ActivityDerived } from "@/gos/retentionCohort";
import { buildCustomerCohortAnalysis } from "@/gos/customerCohorts";
import {
  createManualCustomerTransaction,
  type CustomerTransactionDraft,
  type CustomerTransactionRow,
} from "@/gos/customerCohortController";
import {
  createActivitySnapshot,
  createRetentionSnapshot,
  deleteActivitySnapshot,
  fetchRetentionPageData,
  runAndSaveRetentionCohortEngine,
  type CustomerActivitySnapshot,
  type RetentionFinancialInput,
  type RetentionSnapshot,
} from "@/gos/retentionController";

type ActivityFormKey = "new_customers" | "reactivated_customers" | "active_customers" | "lapsed_customers";

// ── industrial helpers ──────────────────────────────────────────
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

function heatBg(value: number, max: number): string {
  if (!value || value <= 0 || max <= 0) return "hsl(220 45% 25%)";
  const r = Math.min(1, value / max);
  // blue-900 → blue-300 gradient via opacity + hue lightness
  const alpha = 0.15 + r * 0.55;
  const light = 25 + r * 45; // 25% → 70%
  return `hsl(226 100% ${light}% / ${alpha})`;
}

function heatText(value: number, max: number): string {
  if (!value || max <= 0) return "hsl(0 0% 40%)";
  const r = value / max;
  return r > 0.55 ? "hsl(0 0% 20%)" : "hsl(0 0% 40%)";
}

function pct(n?: number | null) {
  return n != null ? `${n}%` : "—";
}

// ────────────────────────────────────────────────────────────────

export default function Retention() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [fi, setFi] = useState<RetentionFinancialInput | null>(null);
  const [snaps, setSnaps] = useState<RetentionSnapshot[]>([]);
  const [activity, setActivity] = useState<CustomerActivitySnapshot[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    period_label: "", period_start: "", period_end: "",
    new_customers: "", returning_customers: "", avg_orders_per_customer: "",
  });
  const [act, setAct] = useState({
    snapshot_month: "", new_customers: "", reactivated_customers: "",
    active_customers: "", lapsed_customers: "",
  });
  const [txForm, setTxForm] = useState({
    customer_id: "",
    transaction_date: "",
    order_id: "",
    revenue: "",
    gross_profit: "",
    acquisition_channel: "",
    product_key: "",
  });

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchRetentionPageData(clientId);
      if (data.client) setSelectedClient(data.client as any);
      setFi(data.financial_input);
      setSnaps(data.snapshots);
      setActivity(data.activity);
      setTransactions(data.transactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de chargement retention");
    } finally {
      setLoading(false);
    }
  }, [clientId, setSelectedClient]);

  useEffect(() => { load(); }, [load]);

  const cohort = useMemo(() => {
    const latest = snaps[0];
    const lifts = latest ? {
      lift30: (latest.ltv_30d ?? 0) > 0 ? 0 : 0,
      lift60: latest.ltv_30d && latest.ltv_60d ? ((latest.ltv_60d - latest.ltv_30d) / latest.ltv_30d) * 100 : 0,
      lift90: latest.ltv_30d && latest.ltv_90d ? ((latest.ltv_90d - latest.ltv_30d) / latest.ltv_30d) * 100 : 0,
      lift180: latest.ltv_30d && latest.ltv_365d ? ((latest.ltv_365d - latest.ltv_30d) / latest.ltv_30d) * 100 : 0,
    } : undefined;
    return runRetentionCohortV2(
      activity.map(({ id: _id, ...rest }) => rest),
      lifts,
    );
  }, [activity, snaps]);

  const transactionCohort = useMemo(
    () => buildCustomerCohortAnalysis(transactions, { cadence: "month", metric: "customers" }),
    [transactions],
  );

  // Column max for heatmap normalization
  const maxes = useMemo(() => {
    const cols = ["new_customers", "reactivated_customers", "active_customers", "lapsed_customers"] as const;
    const m: Record<string, number> = {};
    cols.forEach((k) => { m[k] = Math.max(1, ...cohort.rows.map((r) => r[k] ?? 0)); });
    return m;
  }, [cohort]);

  const submitLtv = async () => {
    if (!clientId) return;
    try {
      await createRetentionSnapshot(clientId, form, fi);
      toast.success("Snapshot retention cree");
      setForm({ period_label: "", period_start: "", period_end: "", new_customers: "", returning_customers: "", avg_orders_per_customer: "" });
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur snapshot retention");
    }
  };

  const addActivity = async () => {
    if (!clientId) return;
    try {
      await createActivitySnapshot(clientId, act);
      toast.success("Activite mensuelle ajoutee");
      setAct({ snapshot_month: "", new_customers: "", reactivated_customers: "", active_customers: "", lapsed_customers: "" });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur activite mensuelle");
    }
  };

  const addTransaction = async () => {
    if (!clientId) return;
    if (!txForm.customer_id.trim() || !txForm.transaction_date) {
      toast.error("Customer ID et date transaction requis");
      return;
    }

    const draft: CustomerTransactionDraft = {
      customer_id: txForm.customer_id,
      transaction_date: txForm.transaction_date,
      order_id: txForm.order_id || null,
      revenue: txForm.revenue === "" ? null : Number(txForm.revenue),
      gross_profit: txForm.gross_profit === "" ? null : Number(txForm.gross_profit),
      acquisition_channel: txForm.acquisition_channel || null,
      product_key: txForm.product_key || null,
      source: "manual",
    };

    try {
      await createManualCustomerTransaction(clientId, draft);
      toast.success("Transaction cohort ajoutee");
      setTxForm({
        customer_id: "",
        transaction_date: "",
        order_id: "",
        revenue: "",
        gross_profit: "",
        acquisition_channel: "",
        product_key: "",
      });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur transaction cohort");
    }
  };

  const runCohortEngine = async () => {
    if (!clientId) return;
    try {
      await runAndSaveRetentionCohortEngine(clientId, activity, cohort);
      toast.success(`Cohort v2 - qualite ${cohort.quality}`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur Cohort v2");
    }
  };

  const removeActivity = async (id: string) => {
    try {
      await deleteActivitySnapshot(id);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur suppression activite");
    }
  };

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  const latest = snaps[0];
  const qualityColor =
    cohort.quality === "HIGH" ? "hsl(142 71% 55%)" :
    cohort.quality === "LOW" ? "hsl(0 72% 65%)" :
    cohort.quality === "MEDIUM" ? "hsl(38 92% 60%)" : "hsl(0 0% 40%)";
  const riskColor = cohort.risks.length === 0 ? "hsl(142 71% 55%)" : cohort.risks.length > 2 ? "hsl(0 72% 65%)" : "hsl(38 92% 60%)";
  const txMetricMax = Math.max(
    1,
    ...transactionCohort.acquisition_cohorts.flatMap((row) =>
      transactionCohort.age_columns.map((age) => transactionCohort.metric_matrix[row.acquisition_cohort]?.[age] ?? 0),
    ),
  );
  const recentTransactions = transactions.slice(-5).reverse();

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Rétention v2 (CTC-like) : cohortes mensuelles, quick ratio, net_active_change, backtest et implications CAC/payback.",
          dataSource: "Snapshots LTV + saisie mensuelle d'activité (new / reactivated / active / lapsed).",
          usedBy: "Pouvoir de dépense · Prévisions · Métriques cibles.",
          requiredInputs: ["≥3 mois d'activité pour la tendance", "≥6 mois pour le backtest"],
          nextStep: "Ajoute chaque mois new/reactivated/active/lapsed, puis lance Cohort v2.",
          primaryCta: "Lancer Cohort v2",
        }}
        title="Rétention"
        subtitle="Wave 10D — Cohortes actives/perdues, quick ratio, backtest de rétention."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Snapshot LTV
            </button>
          </>
        }
      />

      {/* ─── KPI BANNER ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiTile label="Repeat rate" value={latest?.repeat_rate_pct != null ? `${latest.repeat_rate_pct}` : "—"} suffix="%" progress={latest?.repeat_rate_pct ?? 0} />
        <KpiTile label="LTV 30j" value={latest?.ltv_30d != null ? `${latest.ltv_30d}` : "—"} suffix=" $" />
        <KpiTile label="LTV 90j" value={latest?.ltv_90d != null ? `${latest.ltv_90d}` : "—"} suffix=" $" />
        <KpiTile label="LTV 365j" value={latest?.ltv_365d != null ? `${latest.ltv_365d}` : "—"} suffix=" $" tone="stable" />
      </div>

      {/* ─── COHORT ENGINE V2 — split cockpit ──────────────────── */}
      <div className="gos-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 20%)", margin: 0 }}>
              Customer Cohort Chart
            </h2>
            <p style={{ ...mono, fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", margin: "4px 0 0" }}>
              Acquisition month x months since first purchase
            </p>
          </div>
          <div style={{ ...mono, fontSize: 10, color: "var(--tdia-muted)", textAlign: "right" }}>
            {transactionCohort.summary}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 18 }}>
          <div style={{ overflowX: "auto" }}>
            {transactionCohort.acquisition_cohorts.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--tdia-muted)", border: "1px dashed hsl(220 45% 12%)", borderRadius: 4 }}>
                Aucune transaction valide. Ajoute customer_id + transaction_date ou laisse une integration alimenter la table.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(220 45% 25%)" }}>
                    <Th>Cohort</Th>
                    <Th center>Acq.</Th>
                    {transactionCohort.age_columns.map((age) => <Th key={age} center>M{age}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {transactionCohort.acquisition_cohorts.map((row) => (
                    <tr key={row.acquisition_cohort} style={{ borderBottom: "1px solid hsl(220 45% 25%)" }}>
                      <td style={{ padding: "10px 8px", color: "hsl(0 0% 40%)", fontWeight: 700 }}>
                        {row.acquisition_cohort}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center", color: "var(--tdia-blue)", fontWeight: 700 }}>
                        {row.acquisition_size}
                      </td>
                      {transactionCohort.age_columns.map((age) => {
                        const value = transactionCohort.metric_matrix[row.acquisition_cohort]?.[age] ?? 0;
                        const survival = transactionCohort.survival_matrix[row.acquisition_cohort]?.[age];
                        return (
                          <td
                            key={age}
                            style={{
                              padding: "10px 8px",
                              textAlign: "center",
                              background: heatBg(value, txMetricMax),
                              color: heatText(value, txMetricMax),
                              fontWeight: value / txMetricMax > 0.55 ? 700 : 400,
                            }}
                            title={survival == null ? undefined : `${survival}% survival`}
                          >
                            {value}
                            {survival != null && <span style={{ color: "hsl(0 0% 35%)", fontSize: 10, marginLeft: 4 }}>{survival}%</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {(transactionCohort.conditions.length > 0 || transactionCohort.risks.length > 0) && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11, color: "hsl(0 0% 40%)" }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {transactionCohort.conditions.map((condition) => <li key={condition}>{condition}</li>)}
                </ul>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {transactionCohort.risks.map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ borderLeft: "1px solid hsl(220 45% 25%)", paddingLeft: 18 }}>
            <div style={{ ...mono, fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>
              Manual transaction
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <input className="gos-input" placeholder="Customer ID" value={txForm.customer_id} onChange={(e) => setTxForm({ ...txForm, customer_id: e.target.value })} />
              <input className="gos-input" type="date" value={txForm.transaction_date} onChange={(e) => setTxForm({ ...txForm, transaction_date: e.target.value })} />
              <input className="gos-input" placeholder="Order ID" value={txForm.order_id} onChange={(e) => setTxForm({ ...txForm, order_id: e.target.value })} />
              <input className="gos-input" inputMode="decimal" placeholder="Revenue" value={txForm.revenue} onChange={(e) => setTxForm({ ...txForm, revenue: e.target.value })} />
              <input className="gos-input" inputMode="decimal" placeholder="Gross profit" value={txForm.gross_profit} onChange={(e) => setTxForm({ ...txForm, gross_profit: e.target.value })} />
              <input className="gos-input" placeholder="Channel" value={txForm.acquisition_channel} onChange={(e) => setTxForm({ ...txForm, acquisition_channel: e.target.value })} />
              <input className="gos-input" placeholder="Product key" value={txForm.product_key} onChange={(e) => setTxForm({ ...txForm, product_key: e.target.value })} />
              <button className="gos-btn-primary" onClick={addTransaction}>
                <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Ajouter transaction
              </button>
            </div>

            {recentTransactions.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...mono, fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>
                  Dernieres lignes
                </div>
                <div style={{ display: "grid", gap: 5 }}>
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, ...mono, fontSize: 10, color: "hsl(0 0% 40%)" }}>
                      <span>{tx.customer_id}</span>
                      <span>{tx.transaction_date}</span>
                      <span>{tx.revenue ?? "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginBottom: 20 }}>

        {/* LEFT RAIL — controls + snapshots list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "hsl(220 45% 25%)",
              borderLeft: "2px solid var(--tdia-blue)",
              padding: 18,
              borderRadius: "0 4px 4px 0",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={12} style={{ color: "var(--tdia-blue)" }} /> Configuration Moteur v2
            </div>

            <button
              className="gos-btn-primary"
              onClick={runCohortEngine}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                boxShadow: "none",
                marginBottom: 14,
              }}
            >
              Lancer Analyse
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, ...mono, fontSize: 10 }}>
              <StatCell label="QUALITÉ" value={cohort.quality || "—"} color={qualityColor} />
              <StatCell label="RISQUES" value={cohort.risks.length ? `${cohort.risks.length}` : "0"} color={riskColor} />
              <StatCell label="BACKTEST" value={cohort.backtest_error_percent != null ? `${cohort.backtest_error_percent}%` : "V2.1"} color="var(--tdia-blue)" />
              <StatCell label="COND" value={cohort.conditions.length ? `${cohort.conditions.length}` : "AUTO"} color="hsl(0 0% 40%)" />
            </div>
          </div>

          {/* SNAPSHOTS HISTORIQUES */}
          <div>
            <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: "hsl(0 0% 50%)", textTransform: "uppercase", letterSpacing: "0.03em", padding: "0 4px 8px" }}>
              Snapshots LTV historiques
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
              {snaps.length === 0 ? (
                <div style={{ padding: 12, fontSize: 11, color: "var(--tdia-muted)", border: "1px dashed hsl(220 45% 25%)", borderRadius: 4, textAlign: "center" }}>
                  Aucun snapshot
                </div>
              ) : snaps.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "hsl(220 45% 25%)",
                    border: "1px solid hsl(220 45% 25%)",
                    borderRadius: 3,
                    cursor: "default",
                  }}
                >
                  <div>
                    <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", color: "hsl(0 0% 20%)", letterSpacing: "0.03em" }}>
                      {s.period_label}
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: "var(--tdia-muted)", marginTop: 2 }}>
                      LTV90 {s.ltv_90d ?? "—"} · RR {pct(s.repeat_rate_pct)}
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: "var(--tdia-blue)" }}>
                    ${s.ltv_365d ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — MAIN HEATMAP */}
        <div
          style={{
            position: "relative",
            background: "hsl(220 45% 25%)",
            border: "1px solid hsl(220 45% 25%)",
            padding: 24,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 20%)", margin: 0, letterSpacing: "-0.01em" }}>
                Monthly Activity Cohorts
              </h2>
              <p style={{ ...mono, fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", margin: "4px 0 0" }}>
                Operational flow metrics per vintage
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, ...mono, fontSize: 10, color: "var(--tdia-muted)" }}>
              <LegendSwatch color="hsl(226 100% 25% / 0.4)" label="LOW" />
              <LegendSwatch color="hsl(226 100% 45% / 0.5)" label="MED" />
              <LegendSwatch color="hsl(226 100% 60% / 0.65)" label="HIGH" />
              <LegendSwatch color="hsl(226 100% 70% / 0.75)" label="PEAK" />
            </div>
          </div>

          <div style={{ overflowX: "auto", position: "relative", zIndex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(220 45% 25%)" }}>
                  <Th>Cohort</Th>
                  <Th center>New</Th>
                  <Th center>Active</Th>
                  <Th center>Reactiv.</Th>
                  <Th center>Lapsed</Th>
                  <Th center leftBorder>Net Δ</Th>
                  <Th center>QR</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {cohort.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--tdia-muted)", fontSize: 11 }}>
                      Aucune activité mensuelle · ajoute une ligne ci-dessous
                    </td>
                  </tr>
                )}
                {cohort.rows.map((r: ActivityDerived, i: number) => (
                  <tr key={activity[i]?.id ?? i} style={{ borderBottom: "1px solid hsl(220 45% 25%)" }}>
                    <td style={{ padding: "10px 8px", color: "hsl(0 0% 40%)", fontWeight: 700, textTransform: "uppercase" }}>
                      {String(r.snapshot_month).slice(0, 7)}
                    </td>
                    <HeatCell v={r.new_customers} max={maxes.new_customers} />
                    <HeatCell v={r.active_customers} max={maxes.active_customers} />
                    <HeatCell v={r.reactivated_customers} max={maxes.reactivated_customers} />
                    <td style={{ padding: "10px 8px", textAlign: "center", background: "hsl(220 45% 25%)", color: "hsl(0 0% 40%)" }}>
                      {r.lapsed_customers}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", borderLeft: "1px solid hsl(220 45% 25%)", fontWeight: 700, color: r.net_active_customer_change >= 0 ? "hsl(142 71% 55%)" : "hsl(0 72% 65%)" }}>
                      {r.net_active_customer_change >= 0 ? "+" : ""}{r.net_active_customer_change}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", color: "var(--tdia-blue)" }}>
                      {r.quick_ratio}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <button className="gos-btn-secondary" style={{ padding: "2px 6px" }} onClick={() => removeActivity(activity[i].id)}>
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Inline add row */}
                <tr style={{ background: "hsl(226 100% 60% / 0.04)" }}>
                  <td style={{ padding: "8px" }}>
                    <input className="gos-input" style={{ width: "100%", padding: "4px 6px", ...mono, fontSize: 11 }} type="date" value={act.snapshot_month} onChange={(e) => setAct({ ...act, snapshot_month: e.target.value })} />
                  </td>
                  {(["new_customers","active_customers","reactivated_customers","lapsed_customers"] as ActivityFormKey[]).map((k) => (
                    <td key={k} style={{ padding: "8px", textAlign: "center" }}>
                      <input className="gos-input" style={{ width: 70, padding: "4px 6px", ...mono, fontSize: 11, textAlign: "center" }} type="number" value={act[k]} onChange={(e) => setAct({ ...act, [k]: e.target.value })} />
                    </td>
                  ))}
                  <td colSpan={2}></td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <button className="gos-btn-primary" style={{ padding: "4px 10px", fontSize: 10, letterSpacing: "0.03em" }} onClick={addActivity}>
                      <Plus size={11} style={{ verticalAlign: "middle" }} />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {activity.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid hsl(220 45% 25%)", display: "grid", gridTemplateColumns: cohort.risks.length || cohort.conditions.length ? "1fr 1fr" : "1fr", gap: 16, position: "relative", zIndex: 1 }}>
              <div>
                <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>
                  Diagnostic
                </div>
                <div style={{ fontSize: 12, color: "hsl(0 0% 40%)" }}>{cohort.quality_reason}</div>
                {cohort.summary && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--tdia-muted)", fontStyle: "italic" }}>{cohort.summary}</div>
                )}
              </div>
              {(cohort.risks.length > 0 || cohort.conditions.length > 0) && (
                <div>
                  {cohort.risks.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: "hsl(0 72% 65%)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Risques
                      </div>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 11, color: "hsl(0 0% 40%)" }}>
                        {cohort.risks.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {cohort.conditions.length > 0 && (
                    <div>
                      <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: "hsl(38 92% 60%)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Conditions
                      </div>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 11, color: "hsl(0 0% 40%)" }}>
                        {cohort.conditions.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Industrial dot overlay */}
          <div
            style={{
              position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
              backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>
      </div>

      {/* ─── NEW SNAPSHOT FORM (collapsible) ───────────────────── */}
      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20, borderColor: "var(--tdia-blue)" }}>
          <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: "var(--tdia-blue)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 14 }}>
            Nouveau snapshot LTV
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <F label="Label période"><input className="gos-input" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="e.g. Q1 2026" /></F>
            <F label="Début"><input className="gos-input" type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></F>
            <F label="Fin"><input className="gos-input" type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></F>
            <F label="Nouveaux clients"><input className="gos-input" type="number" value={form.new_customers} onChange={(e) => setForm({ ...form, new_customers: e.target.value })} /></F>
            <F label="Clients récurrents"><input className="gos-input" type="number" value={form.returning_customers} onChange={(e) => setForm({ ...form, returning_customers: e.target.value })} /></F>
            <F label="Commandes moy. / client"><input className="gos-input" type="number" step="0.1" value={form.avg_orders_per_customer} onChange={(e) => setForm({ ...form, avg_orders_per_customer: e.target.value })} /></F>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submitLtv}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: "var(--tdia-muted)", ...mono }}>
        v1 · LTV = AOV × commandes × (1 + repeat × facteur). v2 · quick_ratio = (new + reactiv + active) / max(lapsed, 1). Backtest = |moyenne(N−1) − dernier| / |dernier|.
      </div>
    </>
  );
}

// ─── sub-components ─────────────────────────────────────────────

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}

function KpiTile({ label, value, suffix, progress, tone }: { label: string; value: string; suffix?: string; progress?: number; tone?: "stable" }) {
  return (
    <div
      style={{
        background: "hsl(220 45% 25%)",
        border: "1px solid hsl(220 45% 25%)",
        padding: 16,
        borderRadius: 3,
        boxShadow: "inset 0 1px 0 hsl(220 45% 25%)",
      }}
    >
      <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: "var(--tdia-blue)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 300, color: "hsl(0 0% 20%)", lineHeight: 1 }}>
        {value}{suffix && <span style={{ fontSize: 13, color: "hsl(0 0% 40%)", marginLeft: 3 }}>{suffix}</span>}
      </div>
      {progress != null && progress > 0 && (
        <div style={{ marginTop: 10, height: 3, background: "hsl(220 45% 25%)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "var(--tdia-blue)", width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {tone === "stable" && progress == null && (
        <div style={{ ...mono, fontSize: 10, color: "hsl(0 0% 50%)", marginTop: 6 }}>STABLE</div>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: "6px 8px", background: "hsl(220 45% 25%)", border: "1px solid hsl(220 45% 25%)" }}>
      <div style={{ color: "hsl(0 0% 50%)", fontSize: 9 }}>{label}</div>
      <div style={{ color, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Th({ children, center, leftBorder }: { children?: React.ReactNode; center?: boolean; leftBorder?: boolean }) {
  return (
    <th
      style={{
        ...mono,
        padding: "10px 8px",
        fontSize: 10,
        fontWeight: 700,
        color: "hsl(0 0% 50%)",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        textAlign: center ? "center" : "left",
        borderLeft: leftBorder ? "1px solid hsl(220 45% 25%)" : undefined,
      }}
    >
      {children}
    </th>
  );
}

function HeatCell({ v, max }: { v: number; max: number }) {
  return (
    <td
      style={{
        padding: "10px 8px",
        textAlign: "center",
        background: heatBg(v, max),
        color: heatText(v, max),
        fontWeight: v / max > 0.55 ? 700 : 400,
        transition: "background 0.2s ease",
      }}
    >
      {v?.toLocaleString?.() ?? v ?? "—"}
    </td>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 10, height: 10, background: color, border: "1px solid hsl(220 45% 25%)" }} />
      <span>{label}</span>
    </div>
  );
}
