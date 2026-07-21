import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Save, Trash2, Grid3x3, Filter, Sparkles } from "lucide-react";

type Cell = {
  id: string; client_id: string;
  angle: string; audience: string; platform: string;
  status: string; priority: string;
  hypothesis: string | null; notes: string | null; verdict: string | null;
  spend: number | null; impressions: number | null;
  ctr: number | null; cpa: number | null; roas: number | null; cvr: number | null;
  last_tested_at: string | null;
  linked_concept_ids: string[]; linked_brief_ids: string[]; linked_test_ids: string[];
};

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";
const PURPLE = "#a855f7";

const STATUSES = ["untested", "queued", "testing", "winner", "loser", "inconclusive"];
const STATUS_COLOR: Record<string, string> = {
  untested: MUTED, queued: BLUE, testing: YELLOW,
  winner: GREEN, loser: RED, inconclusive: PURPLE,
};
const PRIORITIES = ["low", "medium", "high", "critical"];
const PRIORITY_COLOR: Record<string, string> = {
  low: MUTED, medium: BLUE, high: YELLOW, critical: RED,
};

export default function AngleAudienceMatrix() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [cells, setCells] = useState<Cell[]>([]);
  const [view, setView] = useState<"matrix" | "list">("matrix");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Quick add
  const [newAngle, setNewAngle] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [newPlatform, setNewPlatform] = useState("Meta");

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("gos_angle_audience_matrix")
      .select("*").eq("client_id", clientId)
      .order("angle").order("audience");
    if (error) toast.error(error.message);
    setCells((data ?? []) as Cell[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const addCell = async () => {
    if (!clientId) return;
    if (!newAngle.trim() || !newAudience.trim() || !newPlatform.trim()) {
      return toast.error("Angle, audience et plateforme requis");
    }
    const { error } = await (supabase as any).from("gos_angle_audience_matrix").insert({
      client_id: clientId,
      angle: newAngle.trim(),
      audience: newAudience.trim(),
      platform: newPlatform.trim(),
      status: "untested",
      priority: "medium",
    });
    if (error) return toast.error(error.message);
    setNewAngle(""); setNewAudience("");
    toast.success("Combinaison ajoutée");
    load();
  };

  const update = (id: string, patch: Partial<Cell>) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const save = async (c: Cell) => {
    const { id, client_id, ...rest } = c;
    const { error } = await (supabase as any).from("gos_angle_audience_matrix").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sauvegardé");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette combinaison ?")) return;
    const { error } = await (supabase as any).from("gos_angle_audience_matrix").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCells(prev => prev.filter(c => c.id !== id));
    if (editingId === id) setEditingId(null);
    toast.success("Supprimé");
  };

  const filtered = useMemo(() => cells.filter(c =>
    (platformFilter === "all" || c.platform === platformFilter) &&
    (statusFilter === "all" || c.status === statusFilter)
  ), [cells, platformFilter, statusFilter]);

  const angles = useMemo(() => Array.from(new Set(filtered.map(c => c.angle))).sort(), [filtered]);
  const audiences = useMemo(() => Array.from(new Set(filtered.map(c => c.audience))).sort(), [filtered]);
  const platforms = useMemo(() => Array.from(new Set(cells.map(c => c.platform))).sort(), [cells]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Cell[]>();
    filtered.forEach(c => {
      const k = `${c.angle}|||${c.audience}`;
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    });
    return m;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: cells.length,
    untested: cells.filter(c => c.status === "untested").length,
    testing: cells.filter(c => c.status === "testing" || c.status === "queued").length,
    winners: cells.filter(c => c.status === "winner").length,
    losers: cells.filter(c => c.status === "loser").length,
    coverage: cells.length > 0 ? Math.round((cells.filter(c => c.status !== "untested").length / cells.length) * 100) : 0,
  }), [cells]);

  if (!selectedClient) {
    return <EmptyState title="Aucun client sélectionné" hint="Choisis un client pour accéder à la matrice angles × audiences." />;
  }

  const inputStyle: React.CSSProperties = {
    background: BG_DEEP, border: `1px solid ${BORDER}`, color: "var(--tdia-text)",
    padding: "8px 10px", borderRadius: 6, fontSize: 13, width: "100%",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 4, display: "block",
  };

  const editingCell = editingId ? cells.find(c => c.id === editingId) : null;

  return (
    <div>
      <SectionHeader
        title="Angle & Audience Matrix"
        subtitle="Repère les combinaisons non testées et priorise les opportunités"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: BLUE },
          { label: "Non testées", value: stats.untested, color: MUTED },
          { label: "En test", value: stats.testing, color: YELLOW },
          { label: "Winners", value: stats.winners, color: GREEN },
          { label: "Losers", value: stats.losers, color: RED },
          { label: "Coverage", value: `${stats.coverage}%`, color: PURPLE },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick add */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>AJOUTER UNE COMBINAISON</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 8 }}>
          <input style={inputStyle} placeholder="Angle (ex: Douleur dos)" value={newAngle} onChange={e => setNewAngle(e.target.value)} />
          <input style={inputStyle} placeholder="Audience (ex: Femmes 35-55)" value={newAudience} onChange={e => setNewAudience(e.target.value)} />
          <input style={inputStyle} placeholder="Plateforme" value={newPlatform} onChange={e => setNewPlatform(e.target.value)} />
          <button onClick={addCell} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setView("matrix")}
            className={view === "matrix" ? "gos-btn-primary" : "gos-btn-secondary"}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Grid3x3 size={14} /> Matrice
          </button>
          <button onClick={() => setView("list")}
            className={view === "list" ? "gos-btn-primary" : "gos-btn-secondary"}>
            Liste
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Filter size={14} color={MUTED} />
          <select style={{ ...inputStyle, width: "auto" }} value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
            <option value="all">Toutes plateformes</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select style={{ ...inputStyle, width: "auto" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Chargement…</div>
      ) : cells.length === 0 ? (
        <EmptyState title="Matrice vide" hint="Ajoute tes premières combinaisons angle × audience pour visualiser la couverture de tes tests." />
      ) : view === "matrix" ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ padding: 10, background: BG_DEEP, borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 11, textAlign: "left", position: "sticky", left: 0, zIndex: 2 }}>
                  Angle ↓ / Audience →
                </th>
                {audiences.map(a => (
                  <th key={a} style={{ padding: 10, background: BG_DEEP, borderBottom: `1px solid ${BORDER}`, color: "var(--tdia-text)", fontSize: 12, minWidth: 140, textAlign: "center" }}>
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {angles.map(angle => (
                <tr key={angle}>
                  <td style={{ padding: 10, borderBottom: `1px solid ${BORDER}`, color: "var(--tdia-text)", fontSize: 12, fontWeight: 600, background: BG_DEEP, position: "sticky", left: 0, zIndex: 1 }}>
                    {angle}
                  </td>
                  {audiences.map(aud => {
                    const list = cellMap.get(`${angle}|||${aud}`) ?? [];
                    return (
                      <td key={aud} style={{ padding: 6, borderBottom: `1px solid ${BORDER}`, verticalAlign: "top" }}>
                        {list.length === 0 ? (
                          <div style={{ color: MUTED, fontSize: 11, textAlign: "center", padding: 8, opacity: 0.4 }}>—</div>
                        ) : (
                          <div style={{ display: "grid", gap: 4 }}>
                            {list.map(c => (
                              <button key={c.id}
                                onClick={() => setEditingId(c.id)}
                                title={`${c.platform} · ${c.status} · ${c.priority}`}
                                style={{
                                  padding: "5px 8px", borderRadius: 6, cursor: "pointer",
                                  background: STATUS_COLOR[c.status] + "22",
                                  border: `1px solid ${STATUS_COLOR[c.status]}55`,
                                  color: "var(--tdia-text)", fontSize: 11, textAlign: "left",
                                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                                }}>
                                <span style={{ fontWeight: 600 }}>{c.platform}</span>
                                <span style={{ color: STATUS_COLOR[c.status], fontSize: 10, fontWeight: 700 }}>{c.status}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id}
              onClick={() => setEditingId(c.id)}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ color: "var(--tdia-text)", fontSize: 13, fontWeight: 600 }}>{c.angle} × {c.audience}</div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{c.platform}{c.hypothesis ? ` · ${c.hypothesis.slice(0, 80)}` : ""}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 999, background: PRIORITY_COLOR[c.priority] + "22", color: PRIORITY_COLOR[c.priority], fontSize: 11, fontWeight: 700 }}>
                {c.priority}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: 999, background: STATUS_COLOR[c.status] + "22", color: STATUS_COLOR[c.status], fontSize: 11, fontWeight: 700 }}>
                {c.status}
              </span>
              <div style={{ color: MUTED, fontSize: 11 }}>
                {c.roas != null ? `ROAS ${Number(c.roas).toFixed(2)}` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit panel */}
      {editingCell && (
        <div onClick={() => setEditingId(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 520, maxWidth: "100vw", height: "100vh", overflowY: "auto", background: CARD, borderLeft: `1px solid ${BORDER}`, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tdia-text)" }}>
                  <Sparkles size={14} style={{ display: "inline", marginRight: 6, color: PURPLE }} />
                  {editingCell.angle} × {editingCell.audience}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{editingCell.platform}</div>
              </div>
              <button onClick={() => del(editingCell.id)} style={{ background: "transparent", border: "none", color: RED, cursor: "pointer" }}>
                <Trash2 size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Angle</label>
                  <input style={inputStyle} value={editingCell.angle} onChange={e => update(editingCell.id, { angle: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Audience</label>
                  <input style={inputStyle} value={editingCell.audience} onChange={e => update(editingCell.id, { audience: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Plateforme</label>
                  <input style={inputStyle} value={editingCell.platform} onChange={e => update(editingCell.id, { platform: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Statut</label>
                  <select style={inputStyle} value={editingCell.status} onChange={e => update(editingCell.id, { status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priorité</label>
                  <select style={inputStyle} value={editingCell.priority} onChange={e => update(editingCell.id, { priority: e.target.value })}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Hypothèse</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                  placeholder="Pourquoi cette combinaison devrait fonctionner ?"
                  value={editingCell.hypothesis ?? ""} onChange={e => update(editingCell.id, { hypothesis: e.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Spend €</label>
                  <input type="number" style={inputStyle} value={editingCell.spend ?? ""} onChange={e => update(editingCell.id, { spend: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <label style={labelStyle}>ROAS</label>
                  <input type="number" step="0.01" style={inputStyle} value={editingCell.roas ?? ""} onChange={e => update(editingCell.id, { roas: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <label style={labelStyle}>CPA €</label>
                  <input type="number" step="0.01" style={inputStyle} value={editingCell.cpa ?? ""} onChange={e => update(editingCell.id, { cpa: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <label style={labelStyle}>CTR %</label>
                  <input type="number" step="0.01" style={inputStyle} value={editingCell.ctr ?? ""} onChange={e => update(editingCell.id, { ctr: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <label style={labelStyle}>CVR %</label>
                  <input type="number" step="0.01" style={inputStyle} value={editingCell.cvr ?? ""} onChange={e => update(editingCell.id, { cvr: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <label style={labelStyle}>Impressions</label>
                  <input type="number" style={inputStyle} value={editingCell.impressions ?? ""} onChange={e => update(editingCell.id, { impressions: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Dernier test le</label>
                <input type="date" style={inputStyle} value={editingCell.last_tested_at ?? ""} onChange={e => update(editingCell.id, { last_tested_at: e.target.value || null })} />
              </div>

              <div>
                <label style={labelStyle}>Verdict</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                  placeholder="Conclusion : ce qui a marché / n'a pas marché"
                  value={editingCell.verdict ?? ""} onChange={e => update(editingCell.id, { verdict: e.target.value })} />
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                  value={editingCell.notes ?? ""} onChange={e => update(editingCell.id, { notes: e.target.value })} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button onClick={() => setEditingId(null)} className="gos-btn-secondary">Fermer</button>
                <button onClick={() => save(editingCell)} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Save size={14} /> Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
