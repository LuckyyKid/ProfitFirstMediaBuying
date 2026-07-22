import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Save, Trash2, Trophy, XCircle, Calendar, Users as UsersIcon, CheckCircle2 } from "lucide-react";
import {
  createWayfinderSession,
  deleteWayfinderSession,
  fetchWayfinderWednesdayData,
  nextWednesday,
  saveWayfinderSession,
  weekLabel,
  type WayfinderConcept as Concept,
  type WayfinderObjective as Objective,
  type WayfinderSession as Session,
} from "@/gos/wayfinderWednesdayController";

const CARD = "rgba(255, 255, 255, 0.02)";
const BG_DEEP = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";
const YELLOW = "#f5b74e";

const STATUSES = ["draft", "scheduled", "completed", "cancelled"];
const STATUS_COLOR: Record<string, string> = {
  draft: MUTED, scheduled: YELLOW, completed: GREEN, cancelled: RED,
};

export default function WayfinderWednesday() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchWayfinderWednesdayData(clientId);
      setSessions(data.sessions);
      setObjectives(data.objectives);
      setConcepts(data.concepts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger le rituel");
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const addSession = async () => {
    if (!clientId) return;
    try {
      await createWayfinderSession(clientId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de creer le rituel");
      return;
    }
    toast.success("Rituel créé");
    load();
  };

  const update = (id: string, patch: Partial<Session>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const save = async (s: Session) => {
    try {
      await saveWayfinderSession(s);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de sauvegarder le rituel");
      return;
    }
    toast.success("Sauvegardé");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce rituel ?")) return;
    try {
      await deleteWayfinderSession(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer le rituel");
      return;
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success("Supprimé");
  };

  const stats = useMemo(() => {
    return {
      total: sessions.length,
      completed: sessions.filter(s => s.status === "completed").length,
      scheduled: sessions.filter(s => s.status === "scheduled").length,
      draft: sessions.filter(s => s.status === "draft").length,
    };
  }, [sessions]);

  const winnerMap = useMemo(() => new Map(concepts.map(c => [c.id, c])), [concepts]);
  const objectiveMap = useMemo(() => new Map(objectives.map(o => [o.id, o])), [objectives]);

  if (!selectedClient) {
    return <EmptyState title="Aucun client sélectionné" hint="Choisis un client pour accéder au rituel Wayfinder Wednesday." />;
  }

  const inputStyle: React.CSSProperties = {
    background: BG_DEEP, border: `1px solid ${BORDER}`, color: "var(--tdia-text)",
    padding: "8px 10px", borderRadius: 6, fontSize: 13, width: "100%",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 4, display: "block",
  };

  return (
    <div>
      <SectionHeader
        title="Wayfinder Wednesday"
        subtitle="Rituel hebdomadaire de revue créative & décisions stratégiques"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: BLUE },
          { label: "Complétées", value: stats.completed, color: GREEN },
          { label: "Planifiées", value: stats.scheduled, color: YELLOW },
          { label: "Brouillons", value: stats.draft, color: MUTED },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: MUTED }}>
          Prochaine session suggérée : <strong style={{ color: "var(--tdia-text)" }}>{nextWednesday()}</strong>
        </div>
        <button onClick={addSession} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nouveau rituel
        </button>
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Chargement…</div>
      ) : sessions.length === 0 ? (
        <EmptyState title="Aucun rituel encore" hint="Crée ton premier Wayfinder Wednesday pour synchroniser l'équipe autour des apprentissages." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sessions.map(s => {
            const expanded = expandedId === s.id;
            return (
              <div key={s.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{ padding: 14, display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                >
                  <Calendar size={18} color={BLUE} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--tdia-text)", fontSize: 14 }}>
                      {s.session_date} · {s.week_label ?? weekLabel(s.session_date)}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                      {s.participants.length > 0 ? `${s.participants.length} participants` : "Aucun participant"}
                      {" · "}{s.winner_concept_ids.length} winners · {s.loser_concept_ids.length} losers
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 999, background: STATUS_COLOR[s.status] + "22", color: STATUS_COLOR[s.status], fontSize: 11, fontWeight: 700 }}>
                    {s.status.toUpperCase()}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); del(s.id); }} style={{ background: "transparent", border: "none", color: RED, cursor: "pointer" }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                {expanded && (
                  <div style={{ padding: 16, borderTop: `1px solid ${BORDER}`, display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Date</label>
                        <input type="date" style={inputStyle} value={s.session_date}
                          onChange={e => update(s.id, { session_date: e.target.value, week_label: weekLabel(e.target.value) })} />
                      </div>
                      <div>
                        <label style={labelStyle}>Statut</label>
                        <select style={inputStyle} value={s.status} onChange={e => update(s.id, { status: e.target.value })}>
                          {STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Facilitateur</label>
                        <input style={inputStyle} value={s.facilitator ?? ""} onChange={e => update(s.id, { facilitator: e.target.value })} />
                      </div>
                      <div>
                        <label style={labelStyle}>Prochaine session</label>
                        <input type="date" style={inputStyle} value={s.next_session_date ?? ""} onChange={e => update(s.id, { next_session_date: e.target.value })} />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}><UsersIcon size={11} style={{ display: "inline", marginRight: 4 }} />Participants (séparés par virgule)</label>
                      <input style={inputStyle}
                        value={s.participants.join(", ")}
                        onChange={e => update(s.id, { participants: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Objectifs business revus</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {objectives.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>Aucun objectif actif</div>}
                        {objectives.map(o => {
                          const active = s.objective_ids.includes(o.id);
                          return (
                            <button key={o.id} type="button"
                              onClick={() => update(s.id, { objective_ids: active ? s.objective_ids.filter(x => x !== o.id) : [...s.objective_ids, o.id] })}
                              style={{
                                padding: "5px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                                background: active ? BLUE + "33" : BG_DEEP, color: active ? BLUE : MUTED,
                                border: `1px solid ${active ? BLUE : BORDER}`,
                              }}>{o.label}</button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={labelStyle}><Trophy size={11} style={{ display: "inline", marginRight: 4, color: GREEN }} />Winners à scaler</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {concepts.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>Aucun concept disponible</div>}
                          {concepts.map(c => {
                            const active = s.winner_concept_ids.includes(c.id);
                            return (
                              <button key={c.id} type="button"
                                onClick={() => update(s.id, { winner_concept_ids: active ? s.winner_concept_ids.filter(x => x !== c.id) : [...s.winner_concept_ids, c.id] })}
                                style={{
                                  padding: "5px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                                  background: active ? GREEN + "33" : BG_DEEP, color: active ? GREEN : MUTED,
                                  border: `1px solid ${active ? GREEN : BORDER}`,
                                }}>{c.concept_name}</button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}><XCircle size={11} style={{ display: "inline", marginRight: 4, color: RED }} />Losers à couper</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {concepts.map(c => {
                            const active = s.loser_concept_ids.includes(c.id);
                            return (
                              <button key={c.id} type="button"
                                onClick={() => update(s.id, { loser_concept_ids: active ? s.loser_concept_ids.filter(x => x !== c.id) : [...s.loser_concept_ids, c.id] })}
                                style={{
                                  padding: "5px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                                  background: active ? RED + "33" : BG_DEEP, color: active ? RED : MUTED,
                                  border: `1px solid ${active ? RED : BORDER}`,
                                }}>{c.concept_name}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Résumé de performance</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        placeholder="Metrics clés : ROAS, MER, CAC, revenue vs target…"
                        value={s.performance_summary ?? ""} onChange={e => update(s.id, { performance_summary: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Apprentissages clés</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        placeholder="Ce que la semaine nous a appris (angles, audiences, formats, offres)…"
                        value={s.key_learnings ?? ""} onChange={e => update(s.id, { key_learnings: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Décisions prises</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        placeholder="Décisions stratégiques : arbitrages budget, priorisation, pivots…"
                        value={s.decisions ?? ""} onChange={e => update(s.id, { decisions: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Prochaines actions</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        placeholder="Qui fait quoi d'ici mercredi prochain ?"
                        value={s.next_actions ?? ""} onChange={e => update(s.id, { next_actions: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Blockers / risques</label>
                      <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                        value={s.blockers ?? ""} onChange={e => update(s.id, { blockers: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Notes libres</label>
                      <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                        value={s.notes ?? ""} onChange={e => update(s.id, { notes: e.target.value })} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      {s.status !== "completed" && (
                        <button onClick={() => { update(s.id, { status: "completed" }); save({ ...s, status: "completed" }); }}
                          className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={14} /> Marquer complétée
                        </button>
                      )}
                      <button onClick={() => save(s)} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Save size={14} /> Sauvegarder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
