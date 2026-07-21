import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Save, Trash2, Rocket, Filter, ArrowUp, ArrowDown, Calendar } from "lucide-react";

type Test = {
  id: string; client_id: string;
  objective_id: string | null; brief_id: string | null; resulting_concept_id: string | null;
  title: string; hypothesis: string | null;
  angle: string | null; format: string | null; platform: string | null;
  target_audience: string | null;
  planned_budget: number | null;
  planned_start_date: string | null; planned_end_date: string | null;
  priority: number;
  impact_score: number | null; effort_score: number | null;
  status: string;
  expected_outcome: string | null; success_criteria: string | null;
  learnings_expected: string | null; owner: string | null;
  tags: string[]; notes: string | null;
};
type Objective = { id: string; label: string };
type Brief = { id: string; title: string };
type Concept = { id: string; concept_name: string };

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";
const PURPLE = "#a855f7";

const STATUSES = ["backlog", "planned", "in_progress", "live", "done", "cancelled"];
const STATUS_COLOR: Record<string, string> = {
  backlog: MUTED, planned: YELLOW, in_progress: BLUE, live: PURPLE, done: GREEN, cancelled: RED,
};
const ANGLES = ["problem-agitate-solve","social-proof","ugc-testimonial","demo-product","founder-story","before-after","comparison","listicle","unboxing","authority-expert","meme-culture"];
const FORMATS = ["video-short","video-long","static","carousel","ugc","stop-motion","gif"];
const PLATFORMS = ["meta","tiktok","youtube","google","pinterest","snapchat"];

export default function CreativeTestingRoadmap() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<Test[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "date" | "ice">("priority");

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [t, o, b, c] = await Promise.all([
      (supabase as any).from("gos_creative_testing_roadmap").select("*").eq("client_id", clientId),
      supabase.from("gos_business_objectives").select("id,label").eq("client_id", clientId).eq("status", "active"),
      supabase.from("gos_creative_briefs").select("id,title").eq("client_id", clientId),
      supabase.from("gos_concept_log").select("id,concept_name").eq("client_id", clientId),
    ]);
    setTests((t.data ?? []) as Test[]);
    setObjectives((o.data ?? []) as Objective[]);
    setBriefs((b.data ?? []) as Brief[]);
    setConcepts((c.data ?? []) as Concept[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const addTest = async () => {
    if (!clientId) return;
    const { error } = await (supabase as any).from("gos_creative_testing_roadmap").insert({
      client_id: clientId,
      title: "Nouveau test",
      status: "backlog",
      priority: 3,
      tags: [],
    });
    if (error) return toast.error(error.message);
    toast.success("Test ajouté au backlog");
    load();
  };

  const update = (id: string, patch: Partial<Test>) =>
    setTests(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const save = async (t: Test) => {
    const { id, client_id, ...rest } = t;
    const { error } = await (supabase as any).from("gos_creative_testing_roadmap").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sauvegardé");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce test ?")) return;
    const { error } = await (supabase as any).from("gos_creative_testing_roadmap").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTests(prev => prev.filter(t => t.id !== id));
    toast.success("Supprimé");
  };

  const shifted = (id: string, dir: -1 | 1) => {
    const t = tests.find(x => x.id === id);
    if (!t) return;
    const p = Math.min(5, Math.max(1, t.priority + dir));
    update(id, { priority: p });
    save({ ...t, priority: p });
  };

  const view = useMemo(() => {
    let arr = filter === "all" ? tests : tests.filter(t => t.status === filter);
    arr = [...arr].sort((a, b) => {
      if (sortBy === "priority") return a.priority - b.priority;
      if (sortBy === "date") {
        const da = a.planned_start_date ?? "9999";
        const db = b.planned_start_date ?? "9999";
        return da.localeCompare(db);
      }
      const iceA = (a.impact_score ?? 0) / Math.max(1, a.effort_score ?? 1);
      const iceB = (b.impact_score ?? 0) / Math.max(1, b.effort_score ?? 1);
      return iceB - iceA;
    });
    return arr;
  }, [tests, filter, sortBy]);

  const stats = useMemo(() => ({
    total: tests.length,
    backlog: tests.filter(t => t.status === "backlog").length,
    planned: tests.filter(t => t.status === "planned").length,
    live: tests.filter(t => t.status === "live" || t.status === "in_progress").length,
    done: tests.filter(t => t.status === "done").length,
    budgetPlanned: tests.filter(t => ["planned","in_progress","live"].includes(t.status)).reduce((s, t) => s + (Number(t.planned_budget) || 0), 0),
  }), [tests]);

  if (!selectedClient) {
    return <EmptyState title="Aucun client sélectionné" hint="Choisis un client pour accéder à la roadmap de tests créatifs." />;
  }

  const inputStyle: React.CSSProperties = {
    background: BG_DEEP, border: `1px solid ${BORDER}`, color: "var(--tdia-text)",
    padding: "8px 10px", borderRadius: 6, fontSize: 13, width: "100%",
  };
  const label: React.CSSProperties = { fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 4, display: "block" };

  return (
    <div>
      <SectionHeader title="Creative Testing Roadmap" subtitle="Backlog priorisé des tests créatifs à venir" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: BLUE },
          { label: "Backlog", value: stats.backlog, color: MUTED },
          { label: "Planifiés", value: stats.planned, color: YELLOW },
          { label: "En cours / Live", value: stats.live, color: PURPLE },
          { label: "Terminés", value: stats.done, color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={14} color={MUTED} />
          <select style={{ ...inputStyle, width: "auto" }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={{ ...inputStyle, width: "auto" }} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
            <option value="priority">Trier par priorité</option>
            <option value="date">Trier par date de lancement</option>
            <option value="ice">Trier par ICE (Impact/Effort)</option>
          </select>
          <span style={{ fontSize: 12, color: MUTED }}>
            Budget planifié : <strong style={{ color: "var(--tdia-text)" }}>{stats.budgetPlanned.toLocaleString("fr-FR")} €</strong>
          </span>
        </div>
        <button onClick={addTest} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nouveau test
        </button>
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Chargement…</div>
      ) : view.length === 0 ? (
        <EmptyState title="Aucun test dans la roadmap" hint="Ajoute ton premier test créatif à partir d'une hypothèse issue du Concept Log ou de l'Ultimate Brief." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {view.map(t => {
            const ice = t.impact_score && t.effort_score ? (t.impact_score / t.effort_score).toFixed(2) : "—";
            return (
              <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 12, alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <button onClick={() => shifted(t.id, -1)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 0 }}><ArrowUp size={14} /></button>
                    <div style={{ fontSize: 18, fontWeight: 700, color: BLUE, width: 28, textAlign: "center" }}>P{t.priority}</div>
                    <button onClick={() => shifted(t.id, 1)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 0 }}><ArrowDown size={14} /></button>
                  </div>
                  <input style={{ ...inputStyle, fontSize: 15, fontWeight: 600 }} value={t.title} onChange={e => update(t.id, { title: e.target.value })} />
                  <div style={{ fontSize: 11, color: MUTED, textAlign: "center", minWidth: 60 }}>
                    ICE
                    <div style={{ fontSize: 15, color: "var(--tdia-text)", fontWeight: 700 }}>{ice}</div>
                  </div>
                  <select style={{ ...inputStyle, width: "auto", color: STATUS_COLOR[t.status], fontWeight: 700 }}
                    value={t.status} onChange={e => update(t.id, { status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                  <button onClick={() => del(t.id)} style={{ background: "transparent", border: "none", color: RED, cursor: "pointer" }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>Objectif business</label>
                    <select style={inputStyle} value={t.objective_id ?? ""} onChange={e => update(t.id, { objective_id: e.target.value || null })}>
                      <option value="">—</option>
                      {objectives.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Brief lié</label>
                    <select style={inputStyle} value={t.brief_id ?? ""} onChange={e => update(t.id, { brief_id: e.target.value || null })}>
                      <option value="">—</option>
                      {briefs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Concept résultant</label>
                    <select style={inputStyle} value={t.resulting_concept_id ?? ""} onChange={e => update(t.id, { resulting_concept_id: e.target.value || null })}>
                      <option value="">—</option>
                      {concepts.map(c => <option key={c.id} value={c.id}>{c.concept_name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>Angle</label>
                    <input list={`angles-${t.id}`} style={inputStyle} value={t.angle ?? ""} onChange={e => update(t.id, { angle: e.target.value })} />
                    <datalist id={`angles-${t.id}`}>{ANGLES.map(a => <option key={a} value={a} />)}</datalist>
                  </div>
                  <div>
                    <label style={label}>Format</label>
                    <input list={`fmt-${t.id}`} style={inputStyle} value={t.format ?? ""} onChange={e => update(t.id, { format: e.target.value })} />
                    <datalist id={`fmt-${t.id}`}>{FORMATS.map(a => <option key={a} value={a} />)}</datalist>
                  </div>
                  <div>
                    <label style={label}>Plateforme</label>
                    <input list={`pl-${t.id}`} style={inputStyle} value={t.platform ?? ""} onChange={e => update(t.id, { platform: e.target.value })} />
                    <datalist id={`pl-${t.id}`}>{PLATFORMS.map(a => <option key={a} value={a} />)}</datalist>
                  </div>
                  <div>
                    <label style={label}>Audience cible</label>
                    <input style={inputStyle} value={t.target_audience ?? ""} onChange={e => update(t.id, { target_audience: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}><Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Start</label>
                    <input type="date" style={inputStyle} value={t.planned_start_date ?? ""} onChange={e => update(t.id, { planned_start_date: e.target.value || null })} />
                  </div>
                  <div>
                    <label style={label}>End</label>
                    <input type="date" style={inputStyle} value={t.planned_end_date ?? ""} onChange={e => update(t.id, { planned_end_date: e.target.value || null })} />
                  </div>
                  <div>
                    <label style={label}>Budget (€)</label>
                    <input type="number" style={inputStyle} value={t.planned_budget ?? ""} onChange={e => update(t.id, { planned_budget: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={label}>Impact (1-10)</label>
                    <input type="number" min={1} max={10} style={inputStyle} value={t.impact_score ?? ""} onChange={e => update(t.id, { impact_score: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={label}>Effort (1-10)</label>
                    <input type="number" min={1} max={10} style={inputStyle} value={t.effort_score ?? ""} onChange={e => update(t.id, { effort_score: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>Hypothèse (we believe X will drive Y because Z)</label>
                    <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={t.hypothesis ?? ""} onChange={e => update(t.id, { hypothesis: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Résultat attendu / KPI cible</label>
                    <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={t.expected_outcome ?? ""} onChange={e => update(t.id, { expected_outcome: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>Critère de succès</label>
                    <input style={inputStyle} placeholder="ex: ROAS > 2.5" value={t.success_criteria ?? ""} onChange={e => update(t.id, { success_criteria: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Apprentissage recherché</label>
                    <input style={inputStyle} value={t.learnings_expected ?? ""} onChange={e => update(t.id, { learnings_expected: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Responsable</label>
                    <input style={inputStyle} value={t.owner ?? ""} onChange={e => update(t.id, { owner: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => save(t)} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Save size={14} /> Sauvegarder
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
