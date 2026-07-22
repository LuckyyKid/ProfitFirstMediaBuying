import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { MarkBlockDoneButton } from "@/gos/workflow";
import { toast } from "sonner";
import { Map as MapIcon, Plus, RefreshCw, Trash2, Link2, MoreVertical } from "lucide-react";

type MapRow = {
  id: string; period_label: string; period_start: string | null; period_end: string | null;
  owner: string | null; primary_focus: string | null; status: string | null; summary: string | null;
  linked_target_id: string | null; linked_diagnosis_id: string | null; created_at: string;
};
type Item = {
  id: string; map_id: string; title: string; item_type: string | null; priority: string | null;
  owner: string | null; due_date: string | null; status: string | null;
  estimated_impact: string | null; hypothesis: string | null; notes: string | null;
};

const ITEM_TYPES = ["CREATIVE", "OFFER", "AUDIENCE", "LANDING", "CHECKOUT", "EMAIL", "SMS", "SEO", "OTHER"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const;

const typeColor: Record<string, string> = {
  CREATIVE: "#4d9fff", OFFER: "#3ddc97", AUDIENCE: "#f5b74e", LANDING: "#a855f7",
  CHECKOUT: "#ec4899", EMAIL: "#06b6d4", SMS: "#f97316", SEO: "#84cc16", OTHER: "#7a8ca6",
};
const priorityColor = (p: string | null) =>
  p === "CRITICAL" ? "#ff6b6b" : p === "HIGH" ? "#ff6b6b" : p === "MEDIUM" ? "#f5b74e" : p === "LOW" ? "#3ddc97" : "#7a8ca6";

const statusMeta: Record<typeof STATUSES[number], { label: string; color: string }> = {
  TODO: { label: "To do", color: "#7a8ca6" },
  IN_PROGRESS: { label: "In progress", color: "#4d9fff" },
  BLOCKED: { label: "Blocked", color: "#ff6b6b" },
  DONE: { label: "Done", color: "#3ddc97" },
  CANCELLED: { label: "Cancelled", color: "#5b6675" },
};

const initials = (s: string | null) => (s || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const daysDiff = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso); const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / 86400000);
};
const dueLabel = (iso: string | null) => {
  const d = daysDiff(iso);
  if (d == null) return "—";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 0) return `${Math.abs(d)}d late`;
  return new Date(iso!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

export default function GrowthExecutionMap() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [targets, setTargets] = useState<any[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [showMapForm, setShowMapForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [mapForm, setMapForm] = useState({ period_label: "", period_start: "", period_end: "", owner: "", primary_focus: "", linked_target_id: "", linked_diagnosis_id: "", summary: "" });
  const [itemForm, setItemForm] = useState({ title: "", item_type: "CREATIVE", priority: "MEDIUM", owner: "", due_date: "", estimated_impact: "", hypothesis: "" });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, m, t, d] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_growth_execution_maps").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("gos_metric_targets").select("id, period_label").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("gos_diagnoses").select("id, problem_type, primary_bottleneck, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    const mapsData = (m.data ?? []) as MapRow[];
    setMaps(mapsData);
    setTargets(t.data ?? []);
    setDiagnoses(d.data ?? []);
    if (mapsData.length > 0) {
      const first = selectedMap ?? mapsData[0].id;
      setSelectedMap(first);
      const it = await supabase.from("gos_growth_execution_items").select("*").in("map_id", mapsData.map((x) => x.id));
      const grouped: Record<string, Item[]> = {};
      (it.data ?? []).forEach((i: any) => { (grouped[i.map_id] ||= []).push(i); });
      setItems(grouped);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const createMap = async () => {
    if (!mapForm.period_label) { toast.error("Label requis"); return; }
    const { data, error } = await supabase.from("gos_growth_execution_maps").insert({
      client_id: clientId!,
      period_label: mapForm.period_label,
      period_start: mapForm.period_start || null,
      period_end: mapForm.period_end || null,
      owner: mapForm.owner || null,
      primary_focus: mapForm.primary_focus || null,
      linked_target_id: mapForm.linked_target_id || null,
      linked_diagnosis_id: mapForm.linked_diagnosis_id || null,
      summary: mapForm.summary || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Carte créée");
    setShowMapForm(false);
    setMapForm({ period_label: "", period_start: "", period_end: "", owner: "", primary_focus: "", linked_target_id: "", linked_diagnosis_id: "", summary: "" });
    setSelectedMap((data as any).id);
    load();
  };

  const createItem = async (statusOverride?: string) => {
    if (!selectedMap || !itemForm.title) { toast.error("Titre requis"); return; }
    const { error } = await supabase.from("gos_growth_execution_items").insert({
      map_id: selectedMap, client_id: clientId!,
      title: itemForm.title, item_type: itemForm.item_type, priority: itemForm.priority,
      owner: itemForm.owner || null, due_date: itemForm.due_date || null,
      estimated_impact: itemForm.estimated_impact || null, hypothesis: itemForm.hypothesis || null,
      status: statusOverride || "TODO",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Action ajoutée");
    setItemForm({ title: "", item_type: "CREATIVE", priority: "MEDIUM", owner: "", due_date: "", estimated_impact: "", hypothesis: "" });
    setShowItemForm(false);
    load();
  };

  const updateItem = async (id: string, patch: Partial<Item>) => {
    const { error } = await supabase.from("gos_growth_execution_items").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("gos_growth_execution_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const current = maps.find((m) => m.id === selectedMap);
  const currentItems = useMemo(() => (selectedMap ? items[selectedMap] ?? [] : []), [items, selectedMap]);

  const columns = useMemo(() => {
    const cols: Record<string, Item[]> = { TODO: [], IN_PROGRESS: [], BLOCKED: [], DONE: [], CANCELLED: [] };
    currentItems.forEach(i => {
      const s = (i.status && cols[i.status]) ? i.status : "TODO";
      cols[s].push(i);
    });
    return cols;
  }, [currentItems]);

  const sprintProgress = useMemo(() => {
    if (currentItems.length === 0) return 0;
    return Math.round((columns.DONE.length / currentItems.length) * 100);
  }, [columns, currentItems]);

  const linkedTarget = targets.find(t => t.id === current?.linked_target_id);
  const linkedDiag = diagnoses.find(d => d.id === current?.linked_diagnosis_id);

  if (loading) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Le plan opérationnel 30 jours — priorités, owners, deadlines. C'est le contrat d'exécution de l'AM.",
          dataSource: "Focus du diagnostic · Objectifs · Besoin en créatifs.",
          usedBy: "Optimisation live · Boucle d'apprentissage · Planification prochain cycle.",
          requiredInputs: ["Priorités P0 / P1 / P2", "Owner", "Échéance"],
          nextStep: "Verrouille les priorités, partage avec le pod, puis tiens les revues hebdo Optimisation live.",
          primaryCta: "Ajouter une priorité",
        }}
        title="Carte d'exécution"
        subtitle="Plan d'actions concrètes par période, priorisé et rattaché aux cibles et diagnostics."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={() => setShowMapForm((v) => !v)}>
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouvelle carte
            </button>
            <MarkBlockDoneButton clientId={clientId} blockKey="execution" disabled={maps.length === 0} />
          </>
        }
      />

      {showMapForm && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nouvelle carte d'exécution</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <F label="Label"><input className="gos-input" value={mapForm.period_label} onChange={(e) => setMapForm({ ...mapForm, period_label: e.target.value })} placeholder="e.g. Sprint Nov S1" /></F>
            <F label="Début"><input className="gos-input" type="date" value={mapForm.period_start} onChange={(e) => setMapForm({ ...mapForm, period_start: e.target.value })} /></F>
            <F label="Fin"><input className="gos-input" type="date" value={mapForm.period_end} onChange={(e) => setMapForm({ ...mapForm, period_end: e.target.value })} /></F>
            <F label="Owner"><input className="gos-input" value={mapForm.owner} onChange={(e) => setMapForm({ ...mapForm, owner: e.target.value })} /></F>
            <F label="Focus principal"><input className="gos-input" value={mapForm.primary_focus} onChange={(e) => setMapForm({ ...mapForm, primary_focus: e.target.value })} placeholder="e.g. Améliorer CVR" /></F>
            <F label="Cible liée">
              <select className="gos-input" value={mapForm.linked_target_id} onChange={(e) => setMapForm({ ...mapForm, linked_target_id: e.target.value })}>
                <option value="">—</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.period_label}</option>)}
              </select>
            </F>
            <F label="Diagnostic lié">
              <select className="gos-input" value={mapForm.linked_diagnosis_id} onChange={(e) => setMapForm({ ...mapForm, linked_diagnosis_id: e.target.value })}>
                <option value="">—</option>
                {diagnoses.map((d) => <option key={d.id} value={d.id}>{d.primary_bottleneck} — {new Date(d.created_at).toLocaleDateString()}</option>)}
              </select>
            </F>
            <div style={{ gridColumn: "span 3" }}>
              <F label="Résumé"><textarea className="gos-input" rows={2} value={mapForm.summary} onChange={(e) => setMapForm({ ...mapForm, summary: e.target.value })} /></F>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={createMap}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowMapForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {maps.length === 0 ? (
        <div className="gos-card"><EmptyState title="Aucune carte" hint="Crée une carte pour organiser tes actions." /></div>
      ) : (
        <>
          {/* Sprint rail */}
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
            {maps.map((m) => {
              const active = selectedMap === m.id;
              const count = (items[m.id] ?? []).length;
              const doneCount = (items[m.id] ?? []).filter(x => x.status === "DONE").length;
              const pct = count > 0 ? (doneCount / count) * 100 : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMap(m.id)}
                  style={{
                    flexShrink: 0, minWidth: 220, padding: "10px 14px", borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: active ? "2px solid #4d9fff" : "1px solid var(--tdia-border)",
                    boxShadow: active ? "0 0 15px rgba(77, 159, 255, 0.2)" : "none",
                    opacity: active ? 1 : 0.65, cursor: "pointer", textAlign: "left",
                    display: "flex", flexDirection: "column", gap: 4, color: "var(--tdia-text)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", color: active ? "#4d9fff" : "var(--tdia-muted)" }}>
                      <MapIcon size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                      {m.period_label}{active ? " · active" : ""}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: active ? "#4d9fff" : "rgba(255, 255, 255, 0.02)", color: active ? "white" : "var(--tdia-muted)" }}>{count}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {m.period_start && m.period_end ? `${m.period_start} → ${m.period_end}` : "Période non définie"}
                  </span>
                  <div style={{ height: 3, background: "rgba(255, 255, 255, 0.02)", borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#4d9fff" }} />
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Left context panel */}
            {current && (
              <aside style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="gos-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div style={ctxLabel}>Focus area</div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--tdia-text)", margin: "4px 0 0", lineHeight: 1.25 }}>
                      {current.primary_focus || "Focus à définir"}
                    </h2>
                  </div>

                  {current.summary && (
                    <div>
                      <div style={ctxLabel}>Summary</div>
                      <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--tdia-muted)", margin: "4px 0 0" }}>{current.summary}</p>
                    </div>
                  )}

                  <div style={{ height: 1, background: "var(--tdia-border)" }} />

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Ctx label="Période" value={current.period_start && current.period_end ? `${current.period_start} → ${current.period_end}` : "—"} dot="#4d9fff" />
                    <Ctx label="Owner" value={current.owner || "—"} dot="#f5b74e" avatar={current.owner ? initials(current.owner) : undefined} />
                    <Ctx label="Progress" value={`${columns.DONE.length} / ${currentItems.length} · ${sprintProgress}%`} dot="#3ddc97" />
                    <Ctx label="Statut" value={current.status || "—"} dot="#7a8ca6" />
                  </div>

                  {(linkedTarget || linkedDiag) && (
                    <div style={{ padding: 12, borderRadius: 8, background: "rgba(11, 19, 34, 0.6)", border: "1px solid var(--tdia-border)", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#4d9fff", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        <Link2 size={11} /> Linked docs
                      </div>
                      {linkedDiag && <div style={linkText}>Diagnostic · {linkedDiag.primary_bottleneck || linkedDiag.problem_type}</div>}
                      {linkedTarget && <div style={linkText}>Objectif · {linkedTarget.period_label}</div>}
                    </div>
                  )}
                </div>

                <button className="gos-btn-primary" onClick={() => setShowItemForm(v => !v)} style={{ justifyContent: "center" }}>
                  <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Ajouter action
                </button>
              </aside>
            )}

            {/* Kanban board */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {showItemForm && (
                <div className="gos-card" style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nouvelle action</div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12 }}>
                    <F label="Titre"><input className="gos-input" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} /></F>
                    <F label="Type">
                      <select className="gos-input" value={itemForm.item_type} onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value })}>
                        {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </F>
                    <F label="Priorité">
                      <select className="gos-input" value={itemForm.priority} onChange={(e) => setItemForm({ ...itemForm, priority: e.target.value })}>
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </F>
                    <F label="Owner"><input className="gos-input" value={itemForm.owner} onChange={(e) => setItemForm({ ...itemForm, owner: e.target.value })} /></F>
                    <F label="Échéance"><input className="gos-input" type="date" value={itemForm.due_date} onChange={(e) => setItemForm({ ...itemForm, due_date: e.target.value })} /></F>
                    <div style={{ gridColumn: "span 2" }}>
                      <F label="Impact estimé"><input className="gos-input" value={itemForm.estimated_impact} onChange={(e) => setItemForm({ ...itemForm, estimated_impact: e.target.value })} placeholder="e.g. +8% CVR" /></F>
                    </div>
                    <div style={{ gridColumn: "span 3" }}>
                      <F label="Hypothèse"><input className="gos-input" value={itemForm.hypothesis} onChange={(e) => setItemForm({ ...itemForm, hypothesis: e.target.value })} /></F>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button className="gos-btn-primary" onClick={() => createItem()}>Créer</button>
                    <button className="gos-btn-secondary" onClick={() => setShowItemForm(false)}>Annuler</button>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(240px, 1fr))", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
                {STATUSES.map(s => {
                  const meta = statusMeta[s];
                  const col = columns[s];
                  return (
                    <div key={s} style={{ display: "flex", flexDirection: "column", gap: 10, opacity: s === "CANCELLED" ? 0.55 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: meta.color, fontFamily: "JetBrains Mono, monospace", margin: 0 }}>{meta.label}</h3>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>{col.length}</span>
                        </div>
                        {s === "TODO" && (
                          <button onClick={() => setShowItemForm(true)} style={{ background: "transparent", border: "none", color: "var(--tdia-muted)", cursor: "pointer" }}>
                            <Plus size={14} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 100 }}>
                        {col.length === 0 && (
                          <div style={{ padding: 20, borderRadius: 12, border: "1px dashed var(--tdia-border)", textAlign: "center", fontSize: 11, color: "var(--tdia-muted)" }}>
                            Aucune action
                          </div>
                        )}
                        {col.map(i => (
                          <KanbanCard key={i.id} item={i} onStatus={(v) => updateItem(i.id, { status: v })} onDelete={() => deleteItem(i.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function KanbanCard({ item, onStatus, onDelete }: { item: Item; onStatus: (s: string) => void; onDelete: () => void }) {
  const tColor = typeColor[item.item_type || "OTHER"] || "#7a8ca6";
  const pColor = priorityColor(item.priority);
  const meta = statusMeta[(item.status as any)] || statusMeta.TODO;
  const isDone = item.status === "DONE";
  const due = daysDiff(item.due_date);
  const dueIsLate = due != null && due < 0 && !isDone;
  const dueIsToday = due === 0 && !isDone;
  const impact = (item.estimated_impact || "").trim();
  const impactColor = impact.match(/[-−]/) ? "#ff6b6b" : impact.match(/\+|[1-9]/) ? "#3ddc97" : "var(--tdia-muted)";

  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: "rgba(255, 255, 255, 0.02)",
      border: `1px solid ${item.status === "BLOCKED" ? "#ff6b6b66" : "var(--tdia-border)"}`,
      borderLeft: item.status === "IN_PROGRESS" ? "4px solid #4d9fff" : undefined,
      filter: isDone ? "grayscale(0.4)" : undefined,
      opacity: isDone ? 0.65 : 1,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ padding: "1px 6px", borderRadius: 3, background: `${tColor}18`, color: tColor, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.item_type || "OTHER"}</span>
            {item.priority && (
              <span style={{ fontSize: 9, fontWeight: 700, color: pColor, textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", letterSpacing: "-0.01em" }}>{item.priority}</span>
            )}
          </div>
          <h4 style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: "var(--tdia-text)", margin: 0, textDecoration: isDone ? "line-through" : "none" }}>
            {item.title}
          </h4>
          {item.hypothesis && (
            <p style={{ fontSize: 10, color: "var(--tdia-muted)", margin: 0, lineHeight: 1.4 }}>{item.hypothesis}</p>
          )}
        </div>
        <button onClick={onDelete} title="Supprimer" style={{ background: "transparent", border: "none", color: "var(--tdia-muted)", cursor: "pointer", padding: 2 }}>
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        {item.owner ? (
          <div title={item.owner} style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--tdia-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--tdia-text)", fontFamily: "JetBrains Mono, monospace" }}>
            {initials(item.owner)}
          </div>
        ) : (
          <div style={{ width: 24, height: 24, borderRadius: 999, background: "transparent", border: "1px dashed var(--tdia-border)" }} />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {impact && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--tdia-muted)", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>Impact</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: impactColor, fontFamily: "JetBrains Mono, monospace" }}>{impact}</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--tdia-muted)", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>Due</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: dueIsLate ? "#ff6b6b" : dueIsToday ? "#4d9fff" : "var(--tdia-text)" }}>{dueLabel(item.due_date)}</span>
          </div>
        </div>
      </div>

      <select
        value={item.status || "TODO"}
        onChange={(e) => onStatus(e.target.value)}
        style={{
          padding: "4px 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
          background: `${meta.color}14`, color: meta.color, border: `1px solid ${meta.color}44`,
          borderRadius: 6, cursor: "pointer", fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {STATUSES.map(s => <option key={s} value={s}>{statusMeta[s].label}</option>)}
      </select>
    </div>
  );
}

function Ctx({ label, value, dot, avatar }: { label: string; value: string; dot: string; avatar?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tdia-text)" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {avatar && <span style={{ width: 18, height: 18, borderRadius: 999, background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--tdia-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "var(--tdia-text)" }}>{avatar}</span>}
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tdia-text)", fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}

const ctxLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontFamily: "JetBrains Mono, monospace" };
const linkText: React.CSSProperties = { fontSize: 11, color: "#4d9fff", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
