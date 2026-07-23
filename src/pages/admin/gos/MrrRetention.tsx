// src/pages/admin/gos/MrrRetention.tsx
//
// MRR & rétention — Wave 12C. Écran dédié aux clients SaaS + Agence pour
// lire d'un coup d'œil : MRR courant, rétention nette, LTV/CAC récurrent,
// et un mini-forecast 3 mois basé sur le net-new MRR observé.
//
// La saisie reste manuelle pour l'instant : les intégrations SaaS
// (Stripe/Chargebee) et Agence (CRM/facturation) arriveront plus tard.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeader } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { labelsFor } from "@/gos/labels";
import { computeMrrWaterfall, computeRecurringLtvCac } from "@/gos/ltvCac";

type BaselineRow = {
  id: string;
  mrr_current: number | null;
  new_mrr_30d: number | null;
  churned_mrr_30d: number | null;
  expansion_mrr_30d: number | null;
  active_subscriptions: number | null;
  net_revenue_retention_pct: number | null;
  ad_spend_30d: number | null;
};

type FinancialRow = {
  arpa: number | null;
  gross_margin_recurring_pct: number | null;
  churn_monthly_pct: number | null;
  retainer_monthly: number | null;
  onboarding_cost: number | null;
};

export default function MrrRetention() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const businessType = selectedClient?.business_type ?? null;
  const labels = labelsFor(businessType);
  const isSaas = businessType === "SAAS";
  const isAgence = businessType === "AGENCE";

  const [baseline, setBaseline] = useState<BaselineRow | null>(null);
  const [fin, setFin] = useState<FinancialRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(3);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      const [{ data: qb }, { data: fi }] = await Promise.all([
        supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      setBaseline((qb ?? null) as BaselineRow | null);
      setFin((fi ?? null) as FinancialRow | null);
      setLoading(false);
    })();
  }, [clientId]);

  const startingMrr = baseline?.mrr_current ?? 0;
  const newMrr = baseline?.new_mrr_30d ?? 0;
  const churnedMrr = baseline?.churned_mrr_30d ?? 0;
  const expansionMrr = baseline?.expansion_mrr_30d ?? 0;
  const netNewMrr = newMrr - churnedMrr + expansionMrr;

  const waterfall = useMemo(
    () => computeMrrWaterfall({ starting_mrr: startingMrr, net_new_mrr_monthly: netNewMrr, months: horizon }),
    [startingMrr, netNewMrr, horizon],
  );

  // Recurring LTV/CAC — uses ARPA for SaaS, retainer for Agence.
  const arpaForLtv = isSaas ? (fin?.arpa ?? null) : (fin?.retainer_monthly ?? null);
  const recurring = useMemo(
    () => computeRecurringLtvCac({
      arpa: arpaForLtv,
      gross_margin_pct: fin?.gross_margin_recurring_pct ?? null,
      churn_monthly_pct: fin?.churn_monthly_pct ?? null,
      ad_spend: baseline?.ad_spend_30d ?? null,
      new_customers: baseline?.active_subscriptions && startingMrr && arpaForLtv
        ? Math.round(newMrr / arpaForLtv)
        : null,
      onboarding_cost: fin?.onboarding_cost ?? null,
      horizon_months: 36,
    }),
    [arpaForLtv, fin, baseline, newMrr, startingMrr],
  );

  if (loading) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  if (!isSaas && !isAgence) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--tdia-muted)" }}>
        Ce module est réservé aux clients SaaS et Agence.
      </div>
    );
  }

  const hasBaseline = baseline?.mrr_current != null;
  const trigger = () => toast.info("Saisis d'abord le MRR et la rétention dans la baseline quantitative.");

  return (
    <div>
      <SectionHeader
        title={isSaas ? "MRR & rétention (SaaS)" : "MRR & rétention (Agence)"}
        subtitle={`${selectedClient?.company_name ?? ""} — pilotage de la ${labels.recurring_revenue.toLowerCase()} et projection 3 mois.`}
      />

      {!hasBaseline && (
        <div className="gos-card" style={{ marginBottom: 20, background: "rgba(168, 115, 10, 0.08)", borderColor: "rgba(168, 115, 10, 0.3)" }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#e0a63a" }}>Baseline incomplète</div>
          <div style={{ fontSize: 13, color: "var(--tdia-muted)" }}>
            Renseigne MRR, abonnements actifs et churn dans <em>Configuration du modèle → Baseline quantitative</em> pour activer les KPIs et le forecast.
          </div>
          <button className="gos-btn-secondary" style={{ marginTop: 10 }} onClick={trigger}>OK</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Kpi label="MRR actuel" value={money(startingMrr)} />
        <Kpi label="Net-new MRR / mois" value={money(netNewMrr)} tone={netNewMrr >= 0 ? "positive" : "negative"} />
        <Kpi label={isSaas ? "Abonnés actifs" : "Mandats actifs"} value={baseline?.active_subscriptions ?? "—"} />
        <Kpi label="NRR" value={baseline?.net_revenue_retention_pct != null ? `${baseline.net_revenue_retention_pct}%` : "—"} />
      </div>

      <div className="gos-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--tdia-text)" }}>Mini-forecast MRR</h3>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--tdia-muted)" }}>
            Horizon
            <select className="gos-select" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value={3}>3 mois</option>
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
          <table className="gos-table" style={{ margin: 0 }}>
            <thead><tr><th>Mois</th><th style={{ textAlign: "right" }}>MRR projeté</th></tr></thead>
            <tbody>
              {waterfall.timeline.map((t) => (
                <tr key={t.month}>
                  <td>M+{t.month}</td>
                  <td style={{ textAlign: "right" }}>{money(t.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Δ cumulée</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: waterfall.cumulative_delta >= 0 ? "#0f8a44" : "#c1121f", marginTop: 4 }}>
              {waterfall.cumulative_delta >= 0 ? "+" : ""}{money(waterfall.cumulative_delta)}
            </div>
            <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginTop: 12 }}>
              Base : net-new MRR mensuel = {money(netNewMrr)} <br/>
              (new {money(newMrr)} − churn {money(churnedMrr)} + expansion {money(expansionMrr)})
            </div>
          </div>
        </div>
      </div>

      <div className="gos-card">
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "var(--tdia-text)" }}>LTV / CAC récurrent</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Kpi label="LTV prédit" value={recurring.predicted_ltv != null ? money(recurring.predicted_ltv) : "—"} />
          <Kpi label="CAC" value={recurring.cac != null ? money(recurring.cac) : "—"} />
          <Kpi label="LTV : CAC" value={recurring.ltv_cac_ratio != null ? `${recurring.ltv_cac_ratio}×` : "—"} />
          <Kpi label="Payback" value={recurring.payback_months != null ? `${recurring.payback_months} mois` : "—"} />
          <Kpi label="Durée vie client" value={recurring.average_customer_lifetime_months != null ? `${recurring.average_customer_lifetime_months} mois` : "—"} />
        </div>
        {recurring.warnings.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#a8730a" }}>
            {recurring.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
        {recurring.missing_data.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--tdia-muted)" }}>
            Manquant pour un LTV robuste : {recurring.missing_data.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "#0f8a44" : tone === "negative" ? "#c1121f" : "var(--tdia-text)";
  return (
    <div className="gos-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function money(n: number | string): string {
  if (typeof n === "string") return n;
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}
