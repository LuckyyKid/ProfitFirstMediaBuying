import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { RefreshCw, Plus, Rocket, Trash2 } from "lucide-react";

type Plan = {
  id: string;
  cycle_name: string;
  cycle_start: string | null;
  cycle_end: string | null;
  status: string;
  north_star_goal: string | null;
  primary_objectives: any;
  key_hypotheses: any;
  planned_budget: number | null;
  budget_allocation: any;
  target_revenue: number | null;
  target_cac: number | null;
  target_roas: number | null;
  known_risks: any;
  dependencies: string | null;
  linked_learning_ids: string[] | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

const STATUSES = ["DRAFT", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"];

export default function NextCyclePlanning() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [learnings, setLearnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cycle_name: "", cycle_start: "", cycle_end: "", north_star_goal: "",
    primary_objectives: "", key_hypotheses: "", known_risks: "",
    planned_budget: "", target_revenue: "", target_cac: "", target_roas: "",
    budget_creative: "", budget_media: "", budget_ops: "",
    dependencies: "", notes: "", created_by: "",
    linked_learning_ids: [] as string[],
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, p, l] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_next_cycle_plans").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("gos_learning_entries").select("id, title, category, impact_level").eq("client_id", clientId).eq("status", "ACTIVE").order("created_at", { ascending: false }),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    setPlans((p.data ?? []) as Plan[]);
    setLearnings(l.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const splitLines = (s: string) => s.split("\n").map(x => x.trim()).filter(Boolean);
  const num = (v: string) => v === "" ? null : Number(v);

  const submit = async () => {
    if (!form.cycle_name.trim()) { toast.error("Nom du cycle requis"); return; }
    const alloc: Record<string, number> = {};
    if (form.budget_creative) alloc.creative = Number(form.budget_creative);
    if (form.budget_media) alloc.media = Number(form.budget_media);
    if (form.budget_ops) alloc.ops = Number(form.budget_ops);
    const { error } = await supabase.from("gos_next_cycle_plans").insert({
      client_id: clientId!,
      cycle_name: form.cycle_name,
      cycle_start: form.cycle_start || null,
      cycle_end: form.cycle_end || null,
      status: "DRAFT",
      north_star_goal: form.north_star_goal || null,
      primary_objectives: splitLines(form.primary_objectives),
      key_hypotheses: splitLines(form.key_hypotheses),
      known_risks: splitLines(form.known_risks),
      planned_budget: num(form.planned_budget),
      budget_allocation: alloc,
      target_revenue: num(form.target_revenue),
      target_cac: num(form.target_cac),
      target_roas: num(form.target_roas),
      dependencies: form.dependencies || null,
      notes: form.notes || null,
      created_by: form.created_by || null,
      linked_learning_ids: form.linked_learning_ids,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Plan de cycle créé");
    setForm({ ...form, cycle_name: "", cycle_start: "", cycle_end: "", north_star_goal: "", primary_objectives: "", key_hypotheses: "", known_risks: "", planned_budget: "", target_revenue: "", target_cac: "", target_roas: "", budget_creative: "", budget_media: "", budget_ops: "", dependencies: "", notes: "", linked_learning_ids: [] });
    setShowForm(false);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("gos_next_cycle_plans").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce plan ?")) return;
    const { error } = await supabase.from("gos_next_cycle_plans").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const toggleLearning = (id: string) => {
    setForm(f => ({
      ...f,
      linked_learning_ids: f.linked_learning_ids.includes(id)
        ? f.linked_learning_ids.filter(x => x !== id)
        : [...f.linked_learning_ids, id],
    }));
  };

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Conçoit le prochain cycle 30 jours à partir des apprentissages, du diagnostic actuel et du pouvoir de dépense restant.",
          dataSource: "Boucle d'apprentissage · Intelligence client · Diagnostic · Mises à jour prévisions.",
          usedBy: "Carte d'exécution (prochain cycle) · Objectifs de métriques (prochaine période).",
          requiredInputs: ["Thème du cycle", "Priorités (P0/P1/P2)", "Critères de succès"],
          nextStep: "Approuve le plan, puis réinitialise la Carte d'exécution et les Objectifs pour le nouveau cycle.",
          primaryCta: "Créer un plan de cycle",
        }}
        title="Planification prochain cycle"
        subtitle="Planification du prochain cycle : objectifs, hypothèses, budget et risques, ancrés aux apprentissages actuels."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser</button>
            <button className="gos-btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouveau plan</button>
          </>
        }
      />

      {showForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouveau plan de cycle</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <F label="Nom du cycle *"><input className="gos-input" value={form.cycle_name} onChange={e => setForm({ ...form, cycle_name: e.target.value })} placeholder="Cycle Q1 2026" /></F>
            <F label="Début"><input className="gos-input" type="date" value={form.cycle_start} onChange={e => setForm({ ...form, cycle_start: e.target.value })} /></F>
            <F label="Fin"><input className="gos-input" type="date" value={form.cycle_end} onChange={e => setForm({ ...form, cycle_end: e.target.value })} /></F>
            <div style={{ gridColumn: "span 3" }}><F label="North Star Goal"><input className="gos-input" value={form.north_star_goal} onChange={e => setForm({ ...form, north_star_goal: e.target.value })} placeholder="Ex: Atteindre 250k$ MRR avec ROAS 2.8+" /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Objectifs principaux (1 par ligne)"><textarea className="gos-input" rows={3} value={form.primary_objectives} onChange={e => setForm({ ...form, primary_objectives: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Hypothèses prioritaires (1 par ligne)"><textarea className="gos-input" rows={3} value={form.key_hypotheses} onChange={e => setForm({ ...form, key_hypotheses: e.target.value })} /></F></div>
            <F label="Budget total"><input className="gos-input" type="number" value={form.planned_budget} onChange={e => setForm({ ...form, planned_budget: e.target.value })} /></F>
            <F label="Revenu cible"><input className="gos-input" type="number" value={form.target_revenue} onChange={e => setForm({ ...form, target_revenue: e.target.value })} /></F>
            <F label="CAC cible"><input className="gos-input" type="number" value={form.target_cac} onChange={e => setForm({ ...form, target_cac: e.target.value })} /></F>
            <F label="ROAS cible"><input className="gos-input" type="number" step="0.1" value={form.target_roas} onChange={e => setForm({ ...form, target_roas: e.target.value })} /></F>
            <F label="Allocation Créatif"><input className="gos-input" type="number" value={form.budget_creative} onChange={e => setForm({ ...form, budget_creative: e.target.value })} /></F>
            <F label="Allocation Média"><input className="gos-input" type="number" value={form.budget_media} onChange={e => setForm({ ...form, budget_media: e.target.value })} /></F>
            <div style={{ gridColumn: "span 3" }}><F label="Risques connus (1 par ligne)"><textarea className="gos-input" rows={2} value={form.known_risks} onChange={e => setForm({ ...form, known_risks: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Dépendances"><textarea className="gos-input" rows={2} value={form.dependencies} onChange={e => setForm({ ...form, dependencies: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 3" }}><F label="Notes"><textarea className="gos-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></F></div>
            <F label="Créé par"><input className="gos-input" value={form.created_by} onChange={e => setForm({ ...form, created_by: e.target.value })} placeholder="AM" /></F>

            {learnings.length > 0 && (
              <div style={{ gridColumn: "span 3" }}>
                <div className="gos-label">Apprentissages liés</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflow: "auto", padding: 8, background: "hsl(220 45% 14%)", borderRadius: 8 }}>
                  {learnings.map(l => {
                    const sel = form.linked_learning_ids.includes(l.id);
                    return (
                      <button key={l.id} type="button" onClick={() => toggleLearning(l.id)}
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                          border: sel ? "1px solid hsl(140 45% 45%)" : "1px solid hsl(220 45% 25%)",
                          background: sel ? "hsl(140 45% 30% / 0.35)" : "transparent",
                          color: "var(--tdia-text)",
                        }}>
                        {l.title} · <span style={{ opacity: 0.7 }}>{l.category}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submit}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="gos-card"><EmptyState title="Aucun plan de cycle" hint="Crée un plan pour cadrer le prochain sprint (30/60/90j)." /></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {plans.map(p => (
            <div key={p.id} className="gos-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Rocket size={16} />
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{p.cycle_name}</div>
                    <Tag tone={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "muted" : "default"}>{p.status}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tdia-muted)", marginTop: 4 }}>
                    {p.cycle_start ?? "?"} → {p.cycle_end ?? "?"} · Créé par {p.created_by ?? "—"} · {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="gos-input" style={{ width: 130 }} value={p.status} onChange={e => setStatus(p.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button className="gos-btn-secondary" style={{ padding: "4px 8px" }} onClick={() => remove(p.id)}><Trash2 size={14} /></button>
                </div>
              </div>

              {p.north_star_goal && (
                <div style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>NORTH STAR</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{p.north_star_goal}</div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                <Kpi label="Budget" v={p.planned_budget} money />
                <Kpi label="Revenu cible" v={p.target_revenue} money />
                <Kpi label="CAC cible" v={p.target_cac} money />
                <Kpi label="ROAS cible" v={p.target_roas} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                <List title="Objectifs" items={Array.isArray(p.primary_objectives) ? p.primary_objectives : []} />
                <List title="Hypothèses" items={Array.isArray(p.key_hypotheses) ? p.key_hypotheses : []} />
                <List title="Risques" items={Array.isArray(p.known_risks) ? p.known_risks : []} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", marginBottom: 4 }}>ALLOCATION</div>
                  {p.budget_allocation && Object.keys(p.budget_allocation).length > 0 ? (
                    <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                      {Object.entries(p.budget_allocation).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ textTransform: "capitalize" }}>{k}</span>
                          <span style={{ fontWeight: 600 }}>{Number(v).toLocaleString()} $</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>—</div>}
                </div>
              </div>

              {p.linked_learning_ids && p.linked_learning_ids.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--tdia-muted)" }}>
                  🔗 {p.linked_learning_ids.length} apprentissage(s) lié(s)
                </div>
              )}
              {p.notes && <div style={{ marginTop: 10, fontSize: 13 }}>{p.notes}</div>}
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
function Kpi({ label, v, money }: { label: string; v: number | null; money?: boolean }) {
  return (
    <div style={{ padding: 10, background: "hsl(220 45% 14%)", borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{v == null ? "—" : money ? `${Number(v).toLocaleString()} $` : v}</div>
    </div>
  );
}
function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", marginBottom: 4 }}>{title.toUpperCase()}</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>—</div> : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {items.map((i, idx) => <li key={idx} style={{ marginBottom: 2 }}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}
function Tag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "muted" }) {
  const bg = tone === "success" ? "hsl(140 45% 30% / 0.35)" : tone === "muted" ? "hsl(220 45% 20%)" : "hsl(220 45% 25%)";
  return <span style={{ background: bg, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, letterSpacing: "0.03em" }}>{children}</span>;
}
