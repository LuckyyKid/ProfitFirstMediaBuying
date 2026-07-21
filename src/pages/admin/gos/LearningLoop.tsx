import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { MarkBlockDoneButton } from "@/gos/workflow";
import { toast } from "sonner";
import { RefreshCw, Plus, GraduationCap, Trash2 } from "lucide-react";

type Entry = {
  id: string;
  source_type: string;
  category: string;
  title: string;
  hypothesis: string | null;
  result: string | null;
  insight: string;
  recommendation: string | null;
  confidence: number | null;
  impact_level: string | null;
  tags: string[] | null;
  status: string;
  captured_by: string | null;
  created_at: string;
};

const CATEGORIES = ["CREATIVE", "AUDIENCE", "OFFER", "FUNNEL", "RETENTION", "PRICING", "OPERATIONS", "GENERAL"];
const SOURCES = ["MANUAL", "AB_TEST", "MEASUREMENT", "REVIEW", "EVENT", "CLIENT_FEEDBACK"];
const IMPACTS = ["LOW", "MEDIUM", "HIGH"];
const STATUSES = ["ACTIVE", "ARCHIVED"];

export default function LearningLoop() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const [form, setForm] = useState({
    source_type: "MANUAL", category: "GENERAL", title: "",
    hypothesis: "", result: "", insight: "", recommendation: "",
    confidence: "0.7", impact_level: "MEDIUM", tags: "", captured_by: "",
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, e] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_learning_entries").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    setEntries((e.data ?? []) as Entry[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const submit = async () => {
    if (!form.title.trim() || !form.insight.trim()) { toast.error("Titre et insight requis"); return; }
    const { error } = await supabase.from("gos_learning_entries").insert({
      client_id: clientId!,
      source_type: form.source_type,
      category: form.category,
      title: form.title,
      hypothesis: form.hypothesis || null,
      result: form.result || null,
      insight: form.insight,
      recommendation: form.recommendation || null,
      confidence: form.confidence === "" ? null : Number(form.confidence),
      impact_level: form.impact_level,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      captured_by: form.captured_by || null,
      status: "ACTIVE",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Apprentissage capturé");
    setForm({ ...form, title: "", hypothesis: "", result: "", insight: "", recommendation: "", tags: "" });
    setShowForm(false);
    load();
  };

  const archive = async (id: string, status: string) => {
    const { error } = await supabase.from("gos_learning_entries").update({ status: status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cet apprentissage ?")) return;
    const { error } = await supabase.from("gos_learning_entries").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const filtered = filter === "ALL" ? entries : entries.filter(e => e.category === filter);

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Capture ce que nous avons appris ce cycle — angles créatifs, insights audience, mécaniques d'offre, échecs.",
          dataSource: "Revues Optimisation live · Tests de Mesure · observations AM.",
          usedBy: "Planification prochain cycle · Intelligence client (signal vélocité).",
          requiredInputs: ["Énoncé de l'apprentissage", "Catégorie", "Confiance"],
          nextStep: "Capture au moins 3-5 apprentissages/semaine pour nourrir le prochain plan.",
          primaryCta: "Ajouter un apprentissage",
        }}
        title="Boucle d'apprentissage"
        subtitle="Bibliothèque d'apprentissages : capture chaque insight testé, mesuré ou observé pour éclairer le prochain cycle."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser</button>
            <button className="gos-btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouvel apprentissage</button>
            <MarkBlockDoneButton clientId={clientId} blockKey="learning" disabled={entries.length === 0} />
          </>
        }
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {["ALL", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={filter === c ? "gos-btn-primary" : "gos-btn-secondary"}
            style={{ padding: "4px 10px", fontSize: 12 }}>
            {c} {c !== "ALL" && `(${entries.filter(e => e.category === c).length})`}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Capturer un apprentissage</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <F label="Titre *"><input className="gos-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: UGC style testimonial > studio" /></F>
            <F label="Catégorie"><select className="gos-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></F>
            <F label="Source"><select className="gos-input" value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></F>
            <F label="Impact"><select className="gos-input" value={form.impact_level} onChange={e => setForm({ ...form, impact_level: e.target.value })}>{IMPACTS.map(i => <option key={i}>{i}</option>)}</select></F>
            <F label="Confiance (0-1)"><input className="gos-input" type="number" step="0.05" min={0} max={1} value={form.confidence} onChange={e => setForm({ ...form, confidence: e.target.value })} /></F>
            <F label="Capturé par"><input className="gos-input" value={form.captured_by} onChange={e => setForm({ ...form, captured_by: e.target.value })} placeholder="AM / Analyste" /></F>
            <div style={{ gridColumn: "span 3" }}><F label="Hypothèse testée"><textarea className="gos-input" rows={2} value={form.hypothesis} onChange={e => setForm({ ...form, hypothesis: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Résultat observé"><textarea className="gos-input" rows={2} value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Insight * (leçon retenue)"><textarea className="gos-input" rows={2} value={form.insight} onChange={e => setForm({ ...form, insight: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Recommandation pour le prochain cycle"><textarea className="gos-input" rows={2} value={form.recommendation} onChange={e => setForm({ ...form, recommendation: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Tags (séparés par virgule)"><input className="gos-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="ugc, hook, prospection" /></F></div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submit}>Enregistrer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="gos-card"><EmptyState title="Aucun apprentissage" hint="Capture ton premier insight pour bâtir la mémoire du compte." /></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map(e => (
            <div key={e.id} className="gos-card" style={{ opacity: e.status === "ARCHIVED" ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <GraduationCap size={16} />
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{e.title}</div>
                    <Tag>{e.category}</Tag>
                    <Tag>{e.source_type}</Tag>
                    {e.impact_level && <Tag tone={e.impact_level === "HIGH" ? "success" : e.impact_level === "LOW" ? "muted" : "default"}>{e.impact_level}</Tag>}
                    {e.confidence != null && <Tag>Conf {Math.round(e.confidence <= 1 ? e.confidence * 100 : e.confidence)}%</Tag>}
                    {e.status === "ARCHIVED" && <Tag tone="muted">ARCHIVED</Tag>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 4 }}>
                    {new Date(e.created_at).toLocaleString()} · {e.captured_by ?? "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="gos-btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => archive(e.id, e.status)}>
                    {e.status === "ACTIVE" ? "Archiver" : "Restaurer"}
                  </button>
                  <button className="gos-btn-secondary" style={{ padding: "4px 8px" }} onClick={() => remove(e.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                {e.hypothesis && <Row label="Hypothèse" value={e.hypothesis} />}
                {e.result && <Row label="Résultat" value={e.result} />}
                <Row label="Insight" value={e.insight} strong />
                {e.recommendation && <Row label="Reco" value={e.recommendation} />}
                {e.tags && e.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {e.tags.map(t => <Tag key={t}>#{t}</Tag>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
      <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontWeight: strong ? 600 : 400 }}>{value}</div>
    </div>
  );
}
function Tag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "muted" }) {
  const bg = tone === "success" ? "hsl(140 45% 30% / 0.35)" : tone === "muted" ? "hsl(220 45% 20%)" : "hsl(220 45% 25%)";
  return <span style={{ background: bg, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, letterSpacing: "0.03em" }}>{children}</span>;
}
