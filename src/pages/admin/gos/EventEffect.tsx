/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, RefreshCw, BarChart3, Save } from "lucide-react";
import { runEventEffectV2 } from "@/gos/eventEffectV2";
import {
  createPlannedEventEffect,
  parseNumericSeries,
  saveEventEffectAnalysis,
  type EventEffectAnalysisDraft,
} from "@/gos/eventEffectController";

type EventRow = {
  id: string;
  event_name: string;
  event_type: string | null;
  start_date: string | null;
  end_date: string | null;
  expected_lift_pct: number | null;
  expected_revenue_delta: number | null;
  actual_lift_pct: number | null;
  actual_revenue_delta: number | null;
  confidence: string | null;
  status: string | null;
  assumptions: any;
  notes: string | null;
  created_at: string;
};

const EVENT_TYPES = ["PROMO", "LAUNCH", "SEASONAL", "PAID_PUSH", "PR", "INFLUENCER", "OTHER"];
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/* -------- Shared industrial building blocks -------- */

const monoLabel: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  fontWeight: 700,
  color: "hsl(0 0% 40%)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

function ModuleHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "2px solid var(--tdia-blue)", paddingLeft: 16, marginBottom: 20 }}>
      <div>
        <div style={{ ...monoLabel, color: "var(--tdia-blue-light, #60a5fa)", fontSize: 10, marginBottom: 4 }}>{subtitle}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--tdia-text)", letterSpacing: "-0.01em" }}>{title}</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>
    </div>
  );
}

function EnginePulse() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 999,
        background: "hsl(226 100% 60% / 0.1)",
        border: "1px solid hsl(226 100% 60% / 0.25)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--tdia-blue)",
          boxShadow: "none",
          animation: "pulse 2s infinite",
        }}
      />
      <span style={{ ...monoLabel, color: "var(--tdia-blue-light, #60a5fa)" }}>Engine Active</span>
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const s = (status ?? "PLANNED").toUpperCase();
  const map: Record<string, { c: string; b: string }> = {
    PLANNED:   { c: "#60a5fa", b: "hsl(226 100% 60% / 0.25)" },
    MEASURED:  { c: "#0f8a44", b: "hsl(160 84% 45% / 0.35)" },
    ACTIVE:    { c: "#0f8a44", b: "hsl(160 84% 45% / 0.35)" },
    CANCELLED: { c: "#c1121f", b: "hsl(0 84% 65% / 0.35)" },
    DRAFT:     { c: "#a8730a", b: "hsl(43 90% 55% / 0.35)" },
  };
  const t = map[s] ?? map.PLANNED;
  return (
    <span
      style={{
        padding: "3px 10px",
        border: `1px solid ${t.b}`,
        background: `${t.c}1a`,
        color: t.c,
        borderRadius: 4,
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {s}
    </span>
  );
}

export default function EventEffect() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [qb, setQb] = useState<any>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    event_name: "", event_type: "PROMO", start_date: "", end_date: "", notes: "",
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, q, e] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_event_effects").select("*").eq("client_id", clientId).order("start_date", { ascending: false }),
    ]);
    if (c.data) { setClient(c.data); setSelectedClient(c.data as any); }
    setQb(q.data);
    setEvents((e.data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const submit = async () => {
    if (!form.event_name || !form.start_date || !form.end_date) {
      toast.error("Nom, date début et date fin requis"); return;
    }
    const baseline = qb?.revenue_30d ?? 0;
    try {
      await createPlannedEventEffect(clientId!, form, baseline);
      toast.success("Événement ajouté");
      setForm({ event_name: "", event_type: "PROMO", start_date: "", end_date: "", notes: "" });
      setShowForm(false);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de création d'événement";
      toast.error(message);
    }
  };

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;
  void client;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Modélise l'impact attendu d'événements précis (promos, lancements, saisonnalité) sur revenu et dépense.",
          dataSource: "Saisie AM — lifts historiques, calendrier promo planifié.",
          usedBy: "Prévisions · P&L hebdo (ajustements de scénario).",
          requiredInputs: ["Nom de l'événement", "Période", "Lift attendu %"],
          nextStep: "Enregistre les événements à venir avant de générer les scénarios de prévision.",
          primaryCta: "Ajouter un événement",
        }}
        title="Effet d'événement"
        subtitle="Estime l'impact déterministe d'un événement marketing (promo, launch, saisonnier) sur le revenu."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouvel événement
            </button>
          </>
        }
      />

      <ModuleHeader
        subtitle="Module :: Impact_Engine_v2.0"
        title="Registre & moteur causal"
        actions={<EnginePulse />}
      />

      {!qb && (
        <div className="gos-card" style={{ marginBottom: 20, borderColor: "hsl(43 90% 55% / 0.4)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Baseline manquante</div>
          <div style={{ color: "var(--tdia-muted)", fontSize: 13 }}>
            Sans <b>Quantitative Baseline</b>, l'estimation est faite avec revenu = 0. Complète le Growth Model Setup.
          </div>
        </div>
      )}

      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouvel événement</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <Field label="Nom">
              <input className="gos-input" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className="gos-input" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date début">
              <input className="gos-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </Field>
            <Field label="Date fin">
              <input className="gos-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
            <div style={{ gridColumn: "span 2" }}>
              <Field label="Notes">
                <textarea className="gos-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submit}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {/* EVENT LEDGER */}
      <div
        style={{
          background: "hsl(220 45% 16%)",
          border: "1px solid var(--tdia-border)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "none",
          marginBottom: 20,
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--tdia-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...monoLabel, color: "hsl(0 0% 40%)" }}>Registre des événements</span>
          <span style={{ ...monoLabel, color: "hsl(226 100% 60% / 0.7)" }}>{events.length} entries</span>
        </div>
        {events.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState title="Aucun événement" hint="Ajoute un événement pour estimer son effet." />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "hsl(0 0% 98.8% / 0.6)" }}>
                <th style={thStyle}>Événement</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Période</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Lift estimé</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Δ Revenu est.</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Lift réel</th>
                <th style={{ ...thStyle, textAlign: "center", color: "hsl(226 100% 60% / 0.7)" }}>Confiance</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  key={e.id}
                  style={{ transition: "background 0.15s" }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "hsl(226 100% 60% / 0.04)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, color: "var(--tdia-text)", fontWeight: 600 }}>{e.event_name}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 11, color: "hsl(226 100% 60% / 0.85)" }}>{e.event_type ?? "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12 }}>{e.start_date} <span style={{ color: "var(--tdia-blue)" }}>→</span> {e.end_date}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO, color: e.expected_lift_pct != null ? "#0f8a44" : "hsl(0 0% 40%)" }}>
                    {e.expected_lift_pct != null ? `+${e.expected_lift_pct}%` : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO, color: e.expected_revenue_delta != null ? "#0f8a44" : "hsl(0 0% 40%)" }}>
                    {e.expected_revenue_delta != null ? `+${Number(e.expected_revenue_delta).toLocaleString()} $` : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO }}>
                    {e.actual_lift_pct != null ? `${e.actual_lift_pct}%` : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <ConfidenceBar value={e.confidence} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <StatusPill status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginBottom: 16, fontSize: 12, color: "var(--tdia-muted)" }}>
        Conditional forecast, not a guarantee. Basé sur les lifts moyens par type d'événement et la baseline 30j.
      </div>

      <CausalImpactV2Panel clientId={clientId!} events={events} onDone={load} />
    </>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  fontWeight: 700,
  color: "hsl(0 0% 40%)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  padding: "12px 20px",
  textAlign: "left",
  borderBottom: "1px solid var(--tdia-border)",
};
const tdStyle: React.CSSProperties = {
  padding: "14px 20px",
  fontSize: 13,
  color: "var(--tdia-muted)",
  borderBottom: "1px solid hsl(220 45% 16%)",
};

function ConfidenceBar({ value }: { value: string | null | undefined }) {
  const v = (value ?? "").toUpperCase();
  const pct = v === "HIGH" ? 95 : v === "MEDIUM" ? 65 : v === "LOW" ? 30 : 0;
  if (!pct) return <span style={{ fontFamily: MONO, color: "hsl(0 0% 50%)", fontSize: 11 }}>N/A</span>;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 4, background: "hsl(220 45% 25%)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--tdia-blue)" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--tdia-text)" }}>{pct}%</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="gos-label">{label}</div>
      {children}
    </div>
  );
}

/* -------- Causal Engine Panel -------- */

function CausalImpactV2Panel({ clientId, events, onDone }: { clientId: string; events: EventRow[]; onDone: () => void }) {
  const [eventId, setEventId] = useState<string>("");
  const [metric, setMetric] = useState("revenue");
  const [preTxt, setPreTxt] = useState("");
  const [postTxt, setPostTxt] = useState("");
  const [ctrlPreTxt, setCtrlPreTxt] = useState("");
  const [ctrlPostTxt, setCtrlPostTxt] = useState("");
  const [useTrend, setUseTrend] = useState(true);
  const [alpha, setAlpha] = useState("0.05");
  const [result, setResult] = useState<ReturnType<typeof runEventEffectV2> | null>(null);
  const [saving, setSaving] = useState(false);

  const compute = () => {
    const pre = parseNumericSeries(preTxt);
    const post = parseNumericSeries(postTxt);
    const cPre = parseNumericSeries(ctrlPreTxt);
    const cPost = parseNumericSeries(ctrlPostTxt);
    if (pre.length < 2 || post.length < 2) { toast.error("Séries pré/post requises (≥2 pts)"); return; }
    const out = runEventEffectV2({
      metric,
      pre_series: pre,
      post_series: post,
      control_pre_series: cPre.length >= 2 ? cPre : null,
      control_post_series: cPost.length >= 2 ? cPost : null,
      use_linear_trend: useTrend,
      significance_level: Number(alpha) || 0.05,
    });
    setResult(out);
    toast.success(`${out.method} · lift ${out.causal_lift_pct}% · p=${out.p_value.toFixed(3)}`);
  };

  const persist = async () => {
    if (!result || !eventId) { toast.error("Sélectionne un événement et lance l'analyse"); return; }
    setSaving(true);
    const pre = parseNumericSeries(preTxt);
    const post = parseNumericSeries(postTxt);
    const cPre = parseNumericSeries(ctrlPreTxt);
    const cPost = parseNumericSeries(ctrlPostTxt);
    const ev = events.find((e) => e.id === eventId);
    const draft: EventEffectAnalysisDraft = {
      event_id: eventId,
      event_name: ev?.event_name ?? null,
      metric,
      pre_series: pre,
      post_series: post,
      control_pre_series: cPre.length >= 2 ? cPre : null,
      control_post_series: cPost.length >= 2 ? cPost : null,
      use_linear_trend: useTrend,
      significance_level: Number(alpha) || 0.05,
    };
    try {
      await saveEventEffectAnalysis(clientId, draft, result);
      toast.success("Impact causal enregistré sur l'événement");
      onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur d'enregistrement de l'impact causal";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deltaRevenue = result && metric === "revenue" ? Math.round(result.causal_lift_abs * parseNumericSeries(postTxt).length) : null;
  const confidencePct = result ? Math.round(Math.max(0, Math.min(100, (1 - result.p_value) * 100))) : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
      {/* CONFIG PANEL */}
      <div
        style={{
          background: "hsl(220 45% 16%)",
          border: "1px solid var(--tdia-border)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "hsl(226 100% 60% / 0.15)", border: "1px solid hsl(226 100% 60% / 0.25)", borderRadius: 8, display: "flex" }}>
              <BarChart3 size={18} color="var(--tdia-blue-light, #60a5fa)" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tdia-text)" }}>Moteur d'Impact Causal v2</div>
              <div style={{ ...monoLabel, marginTop: 2 }}>ITS · Difference-in-Differences si contrôle</div>
            </div>
          </div>
          <select
            className="gos-input"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            style={{ maxWidth: 240, fontFamily: MONO, fontSize: 12 }}
          >
            <option value="">— sélectionner événement —</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.event_name}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <SeriesColumn accent="var(--tdia-blue-light, #60a5fa)" title="Série traitée">
            <SeriesTextarea label="Pré" value={preTxt} onChange={setPreTxt} placeholder="1000, 1050, 980, 1020, 1010" accent />
            <SeriesTextarea label="Post" value={postTxt} onChange={setPostTxt} placeholder="1200, 1250, 1230, 1210" accent />
          </SeriesColumn>
          <SeriesColumn accent="hsl(0 0% 40%)" title="Série contrôle (optionnel · active DiD)">
            <SeriesTextarea label="Pré" value={ctrlPreTxt} onChange={setCtrlPreTxt} placeholder="800, 810, 795, 820" />
            <SeriesTextarea label="Post" value={ctrlPostTxt} onChange={setCtrlPostTxt} placeholder="820, 830, 825, 815" />
          </SeriesColumn>
        </div>

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr", gap: 12, alignItems: "end" }}>
          <div>
            <div style={{ ...monoLabel, marginBottom: 6 }}>Métrique</div>
            <input className="gos-input" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="revenue" style={{ fontFamily: MONO, fontSize: 12 }} />
          </div>
          <div>
            <div style={{ ...monoLabel, marginBottom: 6 }}>Alpha (α)</div>
            <input className="gos-input" type="number" step="0.01" value={alpha} onChange={(e) => setAlpha(e.target.value)} style={{ fontFamily: MONO, fontSize: 12 }} />
          </div>
          <div>
            <div style={{ ...monoLabel, marginBottom: 6 }}>Tendance</div>
            <select className="gos-input" value={useTrend ? "1" : "0"} onChange={(e) => setUseTrend(e.target.value === "1")} style={{ fontFamily: MONO, fontSize: 12 }}>
              <option value="1">Linear de-trend</option>
              <option value="0">Moyenne plate</option>
            </select>
          </div>
          <button
            onClick={compute}
            style={{
              padding: "10px 16px",
              background: "var(--tdia-blue)",
              color: "var(--tdia-text)",
              border: "none",
              borderRadius: 6,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            Calculer l'impact
          </button>
        </div>
      </div>

      {/* RESULT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Hero result card */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: 24,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--tdia-blue) 0%, hsl(226 100% 68%) 100%)",
            boxShadow: "none",
            color: "var(--tdia-text)",
          }}
        >
          <div style={{ position: "absolute", top: 12, right: 12, opacity: 0.1, fontSize: 90, lineHeight: 1, fontWeight: 900 }}>Σ</div>
          <div style={{ ...monoLabel, color: "hsl(226 100% 60%)", fontWeight: 700 }}>
            {result ? `Lift estimé (${result.method})` : "En attente d'exécution"}
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.03em", marginTop: 8, lineHeight: 1 }}>
            {result ? `${result.causal_lift_pct > 0 ? "+" : ""}${result.causal_lift_pct}` : "—"}
            {result && <span style={{ fontSize: 22, fontWeight: 700, marginLeft: 4 }}>%</span>}
          </div>
          <div style={{ fontSize: 14, marginTop: 6, color: "hsl(226 100% 60%)", fontWeight: 500 }}>
            {result && deltaRevenue != null
              ? `${deltaRevenue > 0 ? "+" : ""}${deltaRevenue.toLocaleString()} $ Revenue`
              : "Colle les séries et calcule"}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid hsl(0 0% 92.2% / 0.3)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ ...monoLabel, color: "hsl(226 100% 60%)" }}>Confiance</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                {result ? `${confidencePct}%` : "—"}
              </div>
            </div>
            <button
              onClick={persist}
              disabled={!result || !eventId || saving}
              style={{
                padding: "8px 14px",
                background: "hsl(0 0% 100% / 0.2)",
                border: "1px solid hsl(0 0% 100% / 0.25)",
                color: "var(--tdia-text)",
                borderRadius: 8,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                cursor: result && eventId && !saving ? "pointer" : "not-allowed",
                opacity: result && eventId && !saving ? 1 : 0.5,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "background 0.15s",
              }}
            >
              <Save size={12} /> {saving ? "..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Model details */}
        <div
          style={{
            background: "hsl(220 45% 16%)",
            border: "1px solid var(--tdia-border)",
            borderRadius: 12,
            padding: 20,
            boxShadow: "none",
          }}
        >
          <div style={{ ...monoLabel, marginBottom: 14 }}>Détails du modèle</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <DetailRow k="Algorithme" v={result?.method ?? "—"} />
            <DetailRow k="n pré / post" v={result ? `${result.n_pre} / ${result.n_post}` : "—"} />
            <DetailRow k="Moyenne pré" v={result ? result.pre_mean.toLocaleString() : "—"} />
            <DetailRow k="Moyenne post" v={result ? result.post_mean.toLocaleString() : "—"} />
            <DetailRow k="Contrefactuel" v={result ? result.counterfactual_mean.toLocaleString() : "—"} />
            <DetailRow k="p-value" v={result ? result.p_value.toFixed(4) : "—"} color={result?.significant ? "#0f8a44" : "#a8730a"} />
            <DetailRow k="IC 95%" v={result ? `[${result.ci_low.toFixed(1)}, ${result.ci_high.toFixed(1)}]` : "—"} />
            <div style={{ paddingTop: 10, borderTop: "1px solid hsl(220 45% 16%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--tdia-muted)", fontSize: 12 }}>Statut p-value</span>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: result?.significant ? "#0f8a44" : "#a8730a" }}>
                {result ? (result.significant ? "SIGNIFICATIF" : "NON SIGNIFICATIF") : "—"}
              </span>
            </div>
          </div>
        </div>

        {result && (
          <div
            style={{
              background: "hsl(220 45% 16%)",
              border: "1px solid var(--tdia-border)",
              borderRadius: 12,
              padding: 16,
              fontSize: 13,
              color: "var(--tdia-muted)",
            }}
          >
            <div style={{ ...monoLabel, marginBottom: 8, color: "var(--tdia-blue-light, #60a5fa)" }}>Recommandation</div>
            <div style={{ color: "hsl(0 0% 25%)" }}>{result.recommendation}</div>
            {result.risks.length > 0 && (
              <div style={{ marginTop: 8, color: "#c1121f", fontSize: 12 }}>⚠ {result.risks.join(" · ")}</div>
            )}
            {result.conditions.length > 0 && (
              <div style={{ marginTop: 4, color: "#a8730a", fontSize: 12 }}>ⓘ {result.conditions.join(" · ")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SeriesColumn({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...monoLabel, color: accent, fontSize: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function SeriesTextarea({ label, value, onChange, placeholder, accent }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ ...monoLabel, fontSize: 9, marginBottom: 4, color: accent ? "hsl(226 100% 60% / 0.7)" : "hsl(0 0% 50%)" }}>{label}</div>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "hsl(220 45% 14%)",
          border: "1px solid var(--tdia-border)",
          borderRadius: 8,
          padding: 12,
          fontFamily: MONO,
          fontSize: 12,
          color: accent ? "hsl(226 100% 60%)" : "hsl(0 0% 40%)",
          resize: "vertical",
          outline: "none",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

function DetailRow({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
      <span style={{ color: "var(--tdia-muted)" }}>{k}</span>
      <span style={{ fontFamily: MONO, color: color ?? "#fff", fontWeight: 600 }}>{v}</span>
    </div>
  );
}
