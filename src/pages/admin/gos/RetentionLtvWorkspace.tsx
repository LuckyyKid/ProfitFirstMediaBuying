import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, RefreshCw, Users, TrendingDown, Trash2, Save } from "lucide-react";

type Cohort = {
  id: string;
  cohort_month: string;
  cohort_size: number;
  m1_retained: number | null;
  m2_retained: number | null;
  m3_retained: number | null;
  m6_retained: number | null;
  m12_retained: number | null;
  arpu_month: number | null;
  gross_margin_pct: number | null;
  ltv_predicted: number | null;
  ltv_actual: number | null;
  notes: string | null;
};

type Segment = {
  id: string;
  segment_name: string;
  segment_type: string;
  criteria: string | null;
  customer_count: number;
  arpu: number | null;
  aov: number | null;
  frequency_days: number | null;
  churn_risk_pct: number | null;
  recommended_channel: string | null;
  recommended_action: string | null;
  priority: string;
};

const CARD = "hsl(220 45% 16%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#0f8a44";
const RED = "#c1121f";
const AMBER = "#a8730a";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const PRESET_SEGMENTS = [
  { name: "Nouveaux clients", type: "new", criteria: "1re commande < 30j", channel: "Email + SMS onboarding", action: "Séquence bienvenue + upsell soft", priority: "high" },
  { name: "Actifs récents", type: "active", criteria: "Commande < 60j", channel: "Email", action: "Cross-sell + programme fidélité", priority: "medium" },
  { name: "À risque", type: "at_risk", criteria: "Aucune commande 60-120j", channel: "Email + Meta retarget", action: "Winback -15% + rappel produits favoris", priority: "high" },
  { name: "Dormants", type: "dormant", criteria: "Aucune commande > 180j", channel: "Email + Meta lookalike", action: "Réactivation agressive -25%", priority: "medium" },
  { name: "VIP", type: "vip", criteria: "Top 10% LTV", channel: "Email + SMS + concierge", action: "Access early launch + programme ambassadeur", priority: "high" },
];

const fmtMoney = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} $`);
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
const fmtInt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("fr-FR"));

function predictLtv(c: Partial<Cohort>): number | null {
  if (!c.cohort_size || !c.arpu_month) return null;
  // Simple heuristic: sum of retention months × arpu × margin
  const size = c.cohort_size;
  const m1 = (c.m1_retained ?? size * 0.4) / size;
  const m2 = (c.m2_retained ?? size * 0.25) / size;
  const m3 = (c.m3_retained ?? size * 0.18) / size;
  const m6 = (c.m6_retained ?? size * 0.12) / size;
  const m12 = (c.m12_retained ?? size * 0.08) / size;
  // Approximate area under retention curve over 12 months (rough)
  const orders = 1 + m1 + m2 + m3 + m3 + m3 + m6 + m6 + m6 + m6 + m6 + m12;
  const gm = (c.gross_margin_pct ?? 45) / 100;
  return orders * Number(c.arpu_month) * gm;
}

function retentionColor(pct: number) {
  if (pct >= 30) return GREEN;
  if (pct >= 15) return AMBER;
  return RED;
}

export default function RetentionLtvWorkspace() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  const [draftCohort, setDraftCohort] = useState<Partial<Cohort>>({
    cohort_month: new Date().toISOString().slice(0, 7) + "-01",
    cohort_size: 100,
    arpu_month: 60,
    gross_margin_pct: 45,
  });

  const [draftSegment, setDraftSegment] = useState<Partial<Segment>>({
    segment_name: "",
    segment_type: "custom",
    customer_count: 0,
    priority: "medium",
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, coh, seg] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).maybeSingle(),
      supabase.from("gos_retention_cohorts" as any).select("*").eq("client_id", clientId).order("cohort_month", { ascending: false }),
      supabase.from("gos_lifecycle_segments" as any).select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    setCohorts(((coh.data as any[]) ?? []) as Cohort[]);
    setSegments(((seg.data as any[]) ?? []) as Segment[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const addCohort = async () => {
    if (!clientId || !draftCohort.cohort_month || !draftCohort.cohort_size) {
      toast.error("Mois et taille cohorte requis");
      return;
    }
    const ltv = predictLtv(draftCohort);
    const { error } = await supabase.from("gos_retention_cohorts" as any).insert({
      client_id: clientId,
      cohort_month: draftCohort.cohort_month,
      cohort_size: draftCohort.cohort_size,
      m1_retained: draftCohort.m1_retained ?? null,
      m2_retained: draftCohort.m2_retained ?? null,
      m3_retained: draftCohort.m3_retained ?? null,
      m6_retained: draftCohort.m6_retained ?? null,
      m12_retained: draftCohort.m12_retained ?? null,
      arpu_month: draftCohort.arpu_month ?? null,
      gross_margin_pct: draftCohort.gross_margin_pct ?? null,
      ltv_predicted: ltv,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cohorte ajoutée");
    setDraftCohort({ cohort_month: draftCohort.cohort_month, cohort_size: 100, arpu_month: 60, gross_margin_pct: 45 });
    load();
  };

  const removeCohort = async (id: string) => {
    const { error } = await supabase.from("gos_retention_cohorts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cohorte supprimée");
    load();
  };

  const addSegment = async (preset?: typeof PRESET_SEGMENTS[number]) => {
    if (!clientId) return;
    const payload = preset ? {
      client_id: clientId,
      segment_name: preset.name,
      segment_type: preset.type,
      criteria: preset.criteria,
      customer_count: 0,
      recommended_channel: preset.channel,
      recommended_action: preset.action,
      priority: preset.priority,
    } : {
      client_id: clientId,
      segment_name: draftSegment.segment_name,
      segment_type: draftSegment.segment_type ?? "custom",
      criteria: draftSegment.criteria ?? null,
      customer_count: draftSegment.customer_count ?? 0,
      arpu: draftSegment.arpu ?? null,
      aov: draftSegment.aov ?? null,
      frequency_days: draftSegment.frequency_days ?? null,
      churn_risk_pct: draftSegment.churn_risk_pct ?? null,
      recommended_channel: draftSegment.recommended_channel ?? null,
      recommended_action: draftSegment.recommended_action ?? null,
      priority: draftSegment.priority ?? "medium",
    };
    if (!preset && !payload.segment_name) { toast.error("Nom de segment requis"); return; }
    const { error } = await supabase.from("gos_lifecycle_segments" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(preset ? `Segment "${preset.name}" ajouté` : "Segment ajouté");
    setDraftSegment({ segment_name: "", segment_type: "custom", customer_count: 0, priority: "medium" });
    load();
  };

  const removeSegment = async (id: string) => {
    const { error } = await supabase.from("gos_lifecycle_segments" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Segment supprimé");
    load();
  };

  const kpis = useMemo(() => {
    const totalCustomers = segments.reduce((s, x) => s + (x.customer_count || 0), 0);
    const totalCohortSize = cohorts.reduce((s, x) => s + (x.cohort_size || 0), 0);
    const avgLtv = cohorts.length ? cohorts.reduce((s, x) => s + (x.ltv_predicted || 0), 0) / cohorts.length : 0;
    const avgM3 = (() => {
      const rows = cohorts.filter((c) => c.m3_retained != null && c.cohort_size > 0);
      if (!rows.length) return 0;
      return rows.reduce((s, c) => s + ((c.m3_retained || 0) / c.cohort_size) * 100, 0) / rows.length;
    })();
    const atRiskCount = segments.filter((s) => s.segment_type === "at_risk" || s.segment_type === "dormant").reduce((s, x) => s + (x.customer_count || 0), 0);
    return { totalCustomers, totalCohortSize, avgLtv, avgM3, atRiskCount };
  }, [cohorts, segments]);

  if (loading) return <div style={{ height: 300, background: CARD, borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        title="Retention & LTV Workspace"
        subtitle="Cohortes mensuelles, courbe de rétention, LTV prédite et segments lifecycle avec actions recommandées."
        guide={{
          purpose: "Gouverner la rétention client comme un actif financier : mesurer la courbe cohorte par cohorte et brancher chaque segment sur une action marketing.",
          dataSource: "Saisie manuelle (ou dérivé Shopify orders quand mappé).",
          usedBy: "AM · Growth Strategist · Directeur retention.",
          requiredInputs: ["Cohortes mensuelles", "ARPU", "Marge brute", "Segments lifecycle"],
          nextStep: "Ajoute les 3 dernières cohortes, puis instancie les 5 segments presets et attribue une action.",
          primaryCta: "Nouvelle cohorte / segment",
        }}
        actions={
          <button className="gos-btn-secondary" onClick={load}>
            <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
          </button>
        }
      />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Kpi icon={Users} label="Clients segmentés" value={fmtInt(kpis.totalCustomers)} />
        <Kpi icon={Users} label="Taille cohortes" value={fmtInt(kpis.totalCohortSize)} />
        <Kpi icon={TrendingDown} label="Rétention M3 moy." value={fmtPct(kpis.avgM3)} color={retentionColor(kpis.avgM3)} />
        <Kpi label="LTV prédite moy." value={fmtMoney(kpis.avgLtv)} color={BLUE} />
        <Kpi icon={TrendingDown} label="Clients à risque" value={fmtInt(kpis.atRiskCount)} color={kpis.atRiskCount > 0 ? AMBER : GREEN} />
      </div>

      {/* Cohort input */}
      <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 12 }}>
          Ajouter une cohorte
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          <Field label="Mois cohorte">
            <input type="month" value={(draftCohort.cohort_month ?? "").slice(0, 7)}
              onChange={(e) => setDraftCohort({ ...draftCohort, cohort_month: e.target.value + "-01" })}
              style={inputStyle()} />
          </Field>
          <Field label="Taille"><NumInput value={draftCohort.cohort_size} onChange={(v) => setDraftCohort({ ...draftCohort, cohort_size: v })} /></Field>
          <Field label="M1"><NumInput value={draftCohort.m1_retained} onChange={(v) => setDraftCohort({ ...draftCohort, m1_retained: v })} /></Field>
          <Field label="M2"><NumInput value={draftCohort.m2_retained} onChange={(v) => setDraftCohort({ ...draftCohort, m2_retained: v })} /></Field>
          <Field label="M3"><NumInput value={draftCohort.m3_retained} onChange={(v) => setDraftCohort({ ...draftCohort, m3_retained: v })} /></Field>
          <Field label="M6"><NumInput value={draftCohort.m6_retained} onChange={(v) => setDraftCohort({ ...draftCohort, m6_retained: v })} /></Field>
          <Field label="M12"><NumInput value={draftCohort.m12_retained} onChange={(v) => setDraftCohort({ ...draftCohort, m12_retained: v })} /></Field>
          <Field label="ARPU / mois"><NumInput value={draftCohort.arpu_month} onChange={(v) => setDraftCohort({ ...draftCohort, arpu_month: v })} /></Field>
          <Field label="Marge %"><NumInput value={draftCohort.gross_margin_pct} onChange={(v) => setDraftCohort({ ...draftCohort, gross_margin_pct: v })} /></Field>
          <Field label="LTV estimée">
            <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: BLUE, fontWeight: 700 }}>
              {fmtMoney(predictLtv(draftCohort))}
            </div>
          </Field>
          <Field label="&nbsp;">
            <button onClick={addCohort} style={btnPrimaryStyle()}><Plus size={12} style={{ verticalAlign: "middle" }} /> Ajouter</button>
          </Field>
        </div>
      </div>

      {/* Cohorts table */}
      <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "12px 20px", background: "hsl(220 45% 12%)", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>Cohortes</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{cohorts.length} cohortes</span>
        </div>
        {cohorts.length === 0 ? (
          <EmptyState title="Aucune cohorte" hint="Ajoute au moins 3 mois pour voir la tendance de rétention." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
              <thead>
                <tr style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                  <Th>Mois</Th><Th align="right">Taille</Th>
                  <Th align="right">M1</Th><Th align="right">M2</Th><Th align="right">M3</Th><Th align="right">M6</Th><Th align="right">M12</Th>
                  <Th align="right">ARPU</Th><Th align="right">Marge</Th><Th align="right" color={BLUE}>LTV pred</Th><Th />
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => {
                  const pct = (n: number | null) => n != null && c.cohort_size > 0 ? (n / c.cohort_size) * 100 : null;
                  return (
                    <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <Td>{c.cohort_month.slice(0, 7)}</Td>
                      <Td align="right">{fmtInt(c.cohort_size)}</Td>
                      <RetTd n={c.m1_retained} p={pct(c.m1_retained)} />
                      <RetTd n={c.m2_retained} p={pct(c.m2_retained)} />
                      <RetTd n={c.m3_retained} p={pct(c.m3_retained)} />
                      <RetTd n={c.m6_retained} p={pct(c.m6_retained)} />
                      <RetTd n={c.m12_retained} p={pct(c.m12_retained)} />
                      <Td align="right">{fmtMoney(c.arpu_month)}</Td>
                      <Td align="right">{fmtPct(c.gross_margin_pct)}</Td>
                      <Td align="right" bold color={BLUE}>{fmtMoney(c.ltv_predicted)}</Td>
                      <Td align="right">
                        <button onClick={() => removeCohort(c.id)} title="Supprimer"
                          style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Segments */}
      <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Segments lifecycle — presets
          </h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 16 }}>
          {PRESET_SEGMENTS.map((p) => (
            <button key={p.name} onClick={() => addSegment(p)}
              style={{ textAlign: "left", padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`,
                background: "hsl(220 45% 14%)", color: "var(--tdia-text)", cursor: "pointer" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>+ {p.name}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{p.criteria}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <Field label="Nom segment custom">
            <input value={draftSegment.segment_name ?? ""} onChange={(e) => setDraftSegment({ ...draftSegment, segment_name: e.target.value })}
              placeholder="Ex. Repeat buyers Q4" style={inputStyle()} />
          </Field>
          <Field label="Clients"><NumInput value={draftSegment.customer_count} onChange={(v) => setDraftSegment({ ...draftSegment, customer_count: v })} /></Field>
          <Field label="ARPU"><NumInput value={draftSegment.arpu} onChange={(v) => setDraftSegment({ ...draftSegment, arpu: v })} /></Field>
          <Field label="AOV"><NumInput value={draftSegment.aov} onChange={(v) => setDraftSegment({ ...draftSegment, aov: v })} /></Field>
          <Field label="Fréq. (j)"><NumInput value={draftSegment.frequency_days} onChange={(v) => setDraftSegment({ ...draftSegment, frequency_days: v })} /></Field>
          <Field label="Risque churn %"><NumInput value={draftSegment.churn_risk_pct} onChange={(v) => setDraftSegment({ ...draftSegment, churn_risk_pct: v })} /></Field>
          <Field label="Action">
            <input value={draftSegment.recommended_action ?? ""} onChange={(e) => setDraftSegment({ ...draftSegment, recommended_action: e.target.value })} style={inputStyle()} />
          </Field>
          <Field label="&nbsp;">
            <button onClick={() => addSegment()} style={btnPrimaryStyle()}><Save size={12} style={{ verticalAlign: "middle" }} /> Ajouter</button>
          </Field>
        </div>
      </div>

      {/* Segments table */}
      <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", background: "hsl(220 45% 12%)", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>Segments actifs</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{segments.length} segments</span>
        </div>
        {segments.length === 0 ? (
          <EmptyState title="Aucun segment" hint="Ajoute un preset ci-dessus pour démarrer." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                  <Th>Segment</Th><Th>Type</Th><Th>Critère</Th>
                  <Th align="right">Clients</Th><Th align="right">ARPU</Th>
                  <Th align="right">Churn %</Th><Th>Canal</Th><Th>Action</Th><Th>Priorité</Th><Th />
                </tr>
              </thead>
              <tbody style={{ fontFamily: MONO }}>
                {segments.map((s) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Td bold>{s.segment_name}</Td>
                    <Td color={MUTED}>{s.segment_type}</Td>
                    <Td color={MUTED}>{s.criteria ?? "—"}</Td>
                    <Td align="right">{fmtInt(s.customer_count)}</Td>
                    <Td align="right">{fmtMoney(s.arpu)}</Td>
                    <Td align="right" color={s.churn_risk_pct && s.churn_risk_pct > 40 ? RED : "white"}>{fmtPct(s.churn_risk_pct)}</Td>
                    <Td color={MUTED}>{s.recommended_channel ?? "—"}</Td>
                    <Td>{s.recommended_action ?? "—"}</Td>
                    <Td><PriorityChip p={s.priority} /></Td>
                    <Td align="right">
                      <button onClick={() => removeSegment(s.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function inputStyle(): React.CSSProperties {
  return { width: "100%", background: "hsl(220 45% 14%)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontFamily: MONO, fontSize: 12, color: "var(--tdia-text)", outline: "none", height: 36 };
}
function btnPrimaryStyle(): React.CSSProperties {
  return { height: 36, padding: "0 14px", background: BLUE, color: "white", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase", cursor: "pointer", fontFamily: MONO, width: "100%" };
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }} dangerouslySetInnerHTML={{ __html: label }} />
      {children}
    </div>
  );
}
function NumInput({ value, onChange }: { value: any; onChange: (n: number | null) => void }) {
  return (
    <input value={value ?? ""} inputMode="decimal"
      onChange={(e) => { const v = e.target.value; onChange(v === "" ? null : Number(v)); }}
      style={inputStyle()} />
  );
}
function Th({ children, align = "left", color }: { children?: React.ReactNode; align?: "left" | "right" | "center"; color?: string }) {
  return <th style={{ padding: "10px 14px", textAlign: align, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, color: color ?? MUTED, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, align = "left", bold, color }: { children: React.ReactNode; align?: "left" | "right" | "center"; bold?: boolean; color?: string }) {
  return <td style={{ padding: "10px 14px", textAlign: align, color: color ?? "white", fontWeight: bold ? 700 : 400, whiteSpace: "nowrap" }}>{children}</td>;
}
function RetTd({ n, p }: { n: number | null; p: number | null }) {
  if (n == null) return <Td align="right" color={MUTED}>—</Td>;
  const color = p != null ? retentionColor(p) : "white";
  return <Td align="right" color={color}>{fmtInt(n)} <span style={{ color: MUTED, fontSize: 10 }}>({p!.toFixed(0)}%)</span></Td>;
}
function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon?: any; color?: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={12} color={MUTED} />}
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: color ?? "white" }}>{value}</div>
    </div>
  );
}
function PriorityChip({ p }: { p: string }) {
  const bg = p === "high" ? RED : p === "low" ? "hsl(0 0% 60%)" : AMBER;
  return <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 4, background: bg, color: "white", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>{p}</span>;
}
