import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Filter, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSelectedClient } from "@/gos/context";
import { EmptyState, SectionHeader } from "@/gos/ui";
import {
  computeConceptDerivedMetrics,
  computeConceptStats,
  createConceptLogEntry,
  deleteConceptLogEntry,
  evaluateConceptOperationalReadiness,
  fetchConceptLogData,
  updateConceptLogEntry,
  type ConceptLogEntry,
  type ConceptObjective,
} from "@/gos/conceptLogController";

type Concept = ConceptLogEntry;
type Objective = ConceptObjective;

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";
const PURPLE = "#a855f7";

const ANGLES = [
  "problem-agitate-solve",
  "social-proof",
  "ugc-testimonial",
  "demo-product",
  "founder-story",
  "before-after",
  "comparison",
  "listicle",
  "unboxing",
  "authority-expert",
  "meme-culture",
];
const FORMATS = ["video-short", "video-long", "static", "carousel", "ugc", "stop-motion", "gif"];
const PLATFORMS = ["meta", "tiktok", "youtube", "google", "pinterest", "snapchat"];
const STATUS_LIST = ["draft", "in_review", "live", "paused", "winner", "loser", "archived"];
const BID_STRATEGIES = ["lowest-cost", "cost-cap", "bid-cap", "target-cpa", "target-roas"];
const METRIC_FIELDS = ["spend", "impressions", "clicks", "orders", "revenue"] as const;
type MetricField = typeof METRIC_FIELDS[number];
const STATUS_COLOR: Record<string, string> = {
  draft: MUTED,
  in_review: YELLOW,
  live: BLUE,
  paused: YELLOW,
  winner: GREEN,
  loser: RED,
  archived: MUTED,
};

function optionalNumberFromInput(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function requiredNumberFromInput(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function metricPatch(field: MetricField, value: number): Partial<Concept> {
  if (field === "spend") return { spend: value };
  if (field === "impressions") return { impressions: value };
  if (field === "clicks") return { clicks: value };
  if (field === "orders") return { orders: value };
  return { revenue: value };
}

export default function ConceptLog() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchConceptLogData(clientId);
      setConcepts(data.concepts);
      setObjectives(data.objectives);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur Concept Log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const addConcept = async () => {
    if (!clientId) return;
    try {
      await createConceptLogEntry(clientId);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur creation concept");
    }
  };

  const update = (id: string, patch: Partial<Concept>) => {
    setConcepts((prev) => prev.map((concept) => (concept.id === id ? { ...concept, ...patch } : concept)));
  };

  const save = async (concept: Concept) => {
    try {
      await updateConceptLogEntry(concept);
      toast.success("Concept enregistre");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur sauvegarde concept");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce concept ?")) return;
    try {
      await deleteConceptLogEntry(id);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur suppression concept");
    }
  };

  const filtered = useMemo(
    () => (filter === "all" ? concepts : concepts.filter((concept) => concept.status === filter)),
    [concepts, filter],
  );
  const stats = useMemo(() => computeConceptStats(concepts), [concepts]);

  if (!selectedClient) {
    return <EmptyState title="Aucun client selectionne" hint="Selectionne un client d'abord." />;
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
      <SectionHeader
        title="Concept Log"
        subtitle="Journal des concepts creatifs testes. Chaque concept doit maintenant porter son offre, sa landing page, son copy, son spend attendu, son lien campagne, et son nombre d'ads."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Total concepts", value: concepts.length, color: "var(--tdia-text)" },
          { label: "En live", value: stats.live, color: BLUE },
          { label: "Winners", value: stats.winners, color: GREEN },
          { label: "Losers", value: stats.losers, color: RED },
          { label: "Win rate", value: `${stats.winRate.toFixed(0)}%`, color: PURPLE },
        ].map((stat) => (
          <div key={stat.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, marginTop: 4 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={14} style={{ color: MUTED }} />
        <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>Filtrer</span>
        {["all", ...STATUS_LIST].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              background: filter === status ? BLUE : "transparent",
              color: filter === status ? "#fff" : MUTED,
              border: `1px solid ${filter === status ? BLUE : BORDER}`,
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {status === "all" ? "Tous" : status}
          </button>
        ))}
        <button
          onClick={addConcept}
          style={{ marginLeft: "auto", background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={13} /> Nouveau concept
        </button>
      </div>

      {loading && <div style={{ color: MUTED }}>Chargement...</div>}
      {!loading && filtered.length === 0 && (
        <EmptyState title="Aucun concept" hint="Documente le prochain concept avant de le mettre dans le plan media." />
      )}

      {filtered.map((concept) => {
        const metrics = computeConceptDerivedMetrics(concept);
        const readiness = evaluateConceptOperationalReadiness(concept);

        return (
          <div
            key={concept.id}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${STATUS_COLOR[concept.status] ?? MUTED}`, borderRadius: 8, padding: 16, display: "grid", gap: 12 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "center" }}>
              <Field label="Concept">
                <input value={concept.concept_name} onChange={(event) => update(concept.id, { concept_name: event.target.value })} style={inputStyle(true)} />
              </Field>
              <Field label="Objectif lie">
                <select value={concept.objective_id ?? ""} onChange={(event) => update(concept.id, { objective_id: event.target.value || null })} style={inputStyle()}>
                  <option value="">-</option>
                  {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.label}</option>)}
                </select>
              </Field>
              <Field label="Statut">
                <select value={concept.status} onChange={(event) => update(concept.id, { status: event.target.value })} style={{ ...inputStyle(), color: STATUS_COLOR[concept.status], fontWeight: 700 }}>
                  {STATUS_LIST.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Verdict">
                <select value={concept.verdict ?? ""} onChange={(event) => update(concept.id, { verdict: event.target.value || null })} style={inputStyle()}>
                  <option value="">-</option>
                  <option value="winner">Winner</option>
                  <option value="loser">Loser</option>
                  <option value="inconclusive">Inconclusif</option>
                  <option value="iterate">Iterer</option>
                </select>
              </Field>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => save(concept)} style={buttonStyle(GREEN)}>
                  <Save size={13} /> Save
                </button>
                <button onClick={() => del(concept.id)} style={{ background: "transparent", color: RED, border: `1px solid ${RED}`, borderRadius: 6, padding: "8px 10px", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
              <Field label="Angle">
                <input value={concept.angle ?? ""} list={`angles-${concept.id}`} onChange={(event) => update(concept.id, { angle: event.target.value })} style={inputStyle()} />
                <datalist id={`angles-${concept.id}`}>{ANGLES.map((angle) => <option key={angle} value={angle} />)}</datalist>
              </Field>
              <Field label="Format">
                <input value={concept.format ?? ""} list={`fmt-${concept.id}`} onChange={(event) => update(concept.id, { format: event.target.value })} style={inputStyle()} />
                <datalist id={`fmt-${concept.id}`}>{FORMATS.map((format) => <option key={format} value={format} />)}</datalist>
              </Field>
              <Field label="Plateforme">
                <input value={concept.platform ?? ""} list={`plat-${concept.id}`} onChange={(event) => update(concept.id, { platform: event.target.value })} style={inputStyle()} />
                <datalist id={`plat-${concept.id}`}>{PLATFORMS.map((platform) => <option key={platform} value={platform} />)}</datalist>
              </Field>
              <Field label="Audience">
                <input value={concept.audience ?? ""} onChange={(event) => update(concept.id, { audience: event.target.value })} style={inputStyle()} />
              </Field>
              <Field label="Lancement">
                <input type="date" value={concept.launch_date ?? ""} onChange={(event) => update(concept.id, { launch_date: event.target.value || null })} style={inputStyle()} />
              </Field>
              <Field label="Fin">
                <input type="date" value={concept.end_date ?? ""} onChange={(event) => update(concept.id, { end_date: event.target.value || null })} style={inputStyle()} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1fr", gap: 12 }}>
              <Field label="Offre">
                <input value={concept.offer ?? ""} onChange={(event) => update(concept.id, { offer: event.target.value })} style={inputStyle()} />
              </Field>
              <Field label="Landing page">
                <input type="url" value={concept.landing_page_url ?? ""} onChange={(event) => update(concept.id, { landing_page_url: event.target.value })} style={inputStyle()} />
              </Field>
              <Field label="Spend attendu / jour">
                <input type="number" value={concept.expected_daily_spend ?? ""} onChange={(event) => update(concept.id, { expected_daily_spend: optionalNumberFromInput(event.target.value) })} style={inputStyle()} />
              </Field>
              <Field label="Ads / concept">
                <input type="number" min={0} value={concept.ads_per_concept ?? ""} onChange={(event) => update(concept.id, { ads_per_concept: optionalNumberFromInput(event.target.value) })} style={inputStyle()} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", gap: 12 }}>
              <Field label="Copy principal">
                <textarea value={concept.primary_copy ?? ""} onChange={(event) => update(concept.id, { primary_copy: event.target.value })} rows={2} style={textareaStyle()} />
              </Field>
              <Field label="Bid strategy">
                <input value={concept.bid_strategy ?? ""} list={`bid-${concept.id}`} onChange={(event) => update(concept.id, { bid_strategy: event.target.value })} style={inputStyle()} />
                <datalist id={`bid-${concept.id}`}>{BID_STRATEGIES.map((bid) => <option key={bid} value={bid} />)}</datalist>
              </Field>
              <Field label="Cost cap">
                <input type="number" value={concept.cost_cap ?? ""} onChange={(event) => update(concept.id, { cost_cap: optionalNumberFromInput(event.target.value) })} style={inputStyle()} />
              </Field>
              <Field label="Campaign link">
                <input type="url" value={concept.campaign_link_url ?? ""} onChange={(event) => update(concept.id, { campaign_link_url: event.target.value })} style={inputStyle()} />
              </Field>
            </div>

            <Field label="Hypothese">
              <textarea value={concept.hypothesis ?? ""} onChange={(event) => update(concept.id, { hypothesis: event.target.value })} rows={2} style={textareaStyle()} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {METRIC_FIELDS.map((field) => (
                <Field key={field} label={field}>
                  <input type="number" value={concept[field] ?? 0} onChange={(event) => update(concept.id, metricPatch(field, requiredNumberFromInput(event.target.value)))} style={inputStyle()} />
                </Field>
              ))}
            </div>

            <div style={{ display: "flex", gap: 20, padding: "8px 12px", background: BG_DEEP, borderRadius: 6, fontSize: 12, flexWrap: "wrap" }}>
              <Metric label="CPA" value={metrics.cpa ? `$${metrics.cpa.toFixed(2)}` : "-"} />
              <Metric label="CTR" value={metrics.ctr ? `${metrics.ctr.toFixed(2)}%` : "-"} />
              <Metric label="ROAS" value={metrics.roas ? metrics.roas.toFixed(2) : "-"} />
              <Metric label="AOV" value={metrics.aov ? `$${metrics.aov.toFixed(0)}` : "-"} />
              <div style={{ color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
                {readiness.ready_for_campaign_plan ? <CheckCircle2 size={13} color={GREEN} /> : <AlertTriangle size={13} color={YELLOW} />}
                Readiness <span style={{ color: readiness.ready_for_campaign_plan ? GREEN : YELLOW, fontWeight: 700 }}>{readiness.readiness_score}/100</span>
              </div>
              {readiness.missing_fields.length > 0 && (
                <div style={{ color: YELLOW }}>Missing: <span style={{ color: "var(--tdia-text)" }}>{readiness.missing_fields.join(", ")}</span></div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Apprentissage">
                <textarea value={concept.learning ?? ""} onChange={(event) => update(concept.id, { learning: event.target.value })} rows={3} placeholder="Ce que ce test nous apprend." style={textareaStyle()} />
              </Field>
              <Field label="Prochaine action">
                <textarea value={concept.next_action ?? ""} onChange={(event) => update(concept.id, { next_action: event.target.value })} rows={3} placeholder="Iterer, scaler, tuer, decliner." style={textareaStyle()} />
              </Field>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ color: MUTED }}>
      {label}: <span style={{ color: "var(--tdia-text)", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function inputStyle(bold = false): CSSProperties {
  return {
    background: BG_DEEP,
    color: "var(--tdia-text)",
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    padding: "6px 8px",
    width: "100%",
    fontWeight: bold ? 700 : 400,
  };
}

function textareaStyle(): CSSProperties {
  return {
    ...inputStyle(),
    resize: "vertical",
    fontFamily: "inherit",
  };
}

function buttonStyle(background: string): CSSProperties {
  return {
    background,
    color: "var(--tdia-text)",
    border: "none",
    borderRadius: 6,
    padding: "8px 12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };
}
