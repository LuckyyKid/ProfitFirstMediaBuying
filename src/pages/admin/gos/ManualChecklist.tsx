import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState, DataModeBadge, DataQualityBadge } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Save, ClipboardCheck } from "lucide-react";
import {
  DATA_MODES, DATA_MODE_META, type DataMode,
  checklistFor, computeDataQualityScore,
} from "@/gos/dataMode";

export default function ManualChecklist() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [fi, setFi] = useState<any>(null);
  const [qb, setQb] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<DataMode>("DEMO_DATA");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, f, q] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
    ]);
    if (c.data) {
      setClient(c.data);
      setSelectedClient(c.data as any);
      setMode(((c.data as any).data_mode || "DEMO_DATA") as DataMode);
      setNotes((c.data as any).data_mode_notes || "");
    }
    setFi(f.data); setQb(q.data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const filled = useMemo(() => {
    if (!client) return {};
    const bt = client.business_type;
    if (bt === "LOCAL_SERVICE") {
      return {
        leads_30d: qb?.leads_30d,
        qualified_leads_30d: qb?.qualified_leads_30d,
        booked_appts_30d: qb?.booked_appointments_30d ?? qb?.booked_appts_30d,
        jobs_closed_30d: qb?.jobs_closed_30d,
        revenue_30d: qb?.revenue_30d,
        ad_spend_30d: qb?.ad_spend_30d,
        avg_job_value: fi?.avg_job_value ?? fi?.aov,
        gross_margin_percent: fi?.gross_margin_percent,
        close_rate: fi?.target_close_rate,
        capacity_per_week: fi?.capacity_per_week,
        response_time: fi?.response_time_minutes,
      } as Record<string, unknown>;
    }
    return {
      revenue_30d: qb?.revenue_30d,
      ad_spend_30d: qb?.ad_spend_30d,
      orders_30d: qb?.orders_30d,
      aov: fi?.aov,
      cac_or_new_customers: qb?.new_customers_30d ?? (qb?.ad_spend_30d && qb?.orders_30d ? qb.ad_spend_30d / qb.orders_30d : null),
      mer_or_roas: qb?.mer_30d ?? qb?.roas_30d ?? (qb?.revenue_30d && qb?.ad_spend_30d ? qb.revenue_30d / qb.ad_spend_30d : null),
      gross_margin_percent: fi?.gross_margin_percent,
      target_cac: fi?.target_cac,
      product_to_push: fi?.product_to_push ?? client?.notes_product_push,
      product_to_avoid: fi?.product_to_avoid ?? client?.notes_product_avoid,
      inventory_risk: fi?.inventory_risk_notes ?? client?.notes_inventory,
      creative_signals: fi?.creative_signals_notes,
    } as Record<string, unknown>;
  }, [client, fi, qb]);

  const dqs = useMemo(() => {
    if (!client) return null;
    return computeDataQualityScore({
      businessType: client.business_type,
      mode,
      filled,
      baselineUpdatedAt: qb?.updated_at ?? null,
    });
  }, [client, mode, filled, qb]);

  const save = async () => {
    if (!client) return;
    setSaving(true);
    const { error } = await supabase.from("gos_clients")
      .update({
        data_mode: mode,
        data_mode_notes: notes,
        data_quality_score: dqs?.score ?? null,
      } as any)
      .eq("id", client.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mode de données enregistré");
    load();
  };

  if (loading || !client) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  const list = checklistFor(client.business_type);
  const meta = DATA_MODE_META[mode];

  return (
    <>
      <SectionHeader
        title="Checklist de données manuelles"
        subtitle="Dry run sans accès API — déclare la source des données et complète la checklist minimale."
        guide={{
          purpose: "Tracer comment les données ont été obtenues (Démo / Proxy / Manuel / API) et scorer leur qualité.",
          dataSource: "Données financières · Baseline quantitative · notes manuelles.",
          usedBy: "Prévisions · Intelligence client · Optimisation live — toutes les engines calent leur confiance sur ce score.",
          nextStep: "Choisis le mode de données, complète les champs manquants dans la Configuration du modèle, puis enregistre.",
          primaryCta: "Enregistrer le mode + DQS",
          riskWarning: mode !== "API_CONNECTED"
            ? "Pas connecté à l'API. Toutes les prévisions doivent rester marquées conditionnelles et pour usage interne uniquement."
            : null,
        }}
        actions={
          <>
            <DataModeBadge mode={mode} />
            <DataQualityBadge score={dqs?.score ?? null} />
            <button className="gos-btn-primary" onClick={save} disabled={saving}>
              <Save size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </>
        }
      />

      <div className="gos-card" style={{ marginBottom: 16 }} data-tour="checklist-mode">
        <div style={{ fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardCheck size={16} /> Mode de données
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
          {DATA_MODES.map((m) => {
            const info = DATA_MODE_META[m];
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="gos-card"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: active ? info.color : "var(--tdia-border)",
                  outline: active ? `2px solid ${info.color}` : "none",
                  background: active ? `${info.bg}22` : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: info.color, fontSize: 13 }}>{info.label}</div>
                  <span style={{ fontSize: 10, color: "var(--tdia-muted)" }}>plafond {info.confidenceCap}%</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--tdia-muted)", lineHeight: 1.4 }}>{info.usage}</div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginBottom: 4 }}>Notes sur l'origine des données</div>
        <textarea
          className="gos-input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ex. Données anonymisées d'un client Shopify similaire, T3 2025. Split organique manquant."
        />
      </div>

      {dqs && (
        <div className="gos-card" style={{ marginBottom: 16 }} data-tour="checklist-dqs">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Score de qualité des données (DQS)</div>
            <DataQualityBadge score={dqs.score} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, fontSize: 12 }}>
            <Metric label="Complétude (70%)" value={`${dqs.completeness}%`} />
            <Metric label="Fiabilité source (15%)" value={`${dqs.source}%`} />
            <Metric label="Récence (15%)" value={`${dqs.recency}%`} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--tdia-muted)" }}>
            {meta.usage}
          </div>
        </div>
      )}

      <div className="gos-card" data-tour="checklist-fields">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Checklist minimale — {client.business_type === "LOCAL_SERVICE" ? "Service local" : "E-commerce"}
        </div>
        {list.length === 0 ? (
          <EmptyState title="Pas de checklist pour ce type d'activité" />
        ) : (
          <table className="gos-table">
            <thead><tr><th>Champ</th><th>Obligatoire</th><th>Statut</th><th>Valeur actuelle</th></tr></thead>
            <tbody>
              {list.map((f) => {
                const v = (filled as any)[f.key];
                const ok = v !== undefined && v !== null && v !== "";
                return (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>{f.required ? "Oui" : "Optionnel"}</td>
                    <td>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: ok ? "#e3f7ec" : (f.required ? "#ffe3e3" : "#eef1f5"),
                        color: ok ? "#0f8a44" : (f.required ? "#c1121f" : "#6C7F93"),
                      }}>
                        {ok ? "REMPLI" : (f.required ? "MANQUANT" : "—")}
                      </span>
                    </td>
                    <td style={{ color: ok ? "var(--tdia-text)" : "var(--tdia-muted)" }}>
                      {ok ? String(v) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--tdia-muted)" }}>
          Complète les champs manquants dans Configuration du modèle → Données financières / Baseline quantitative.
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
