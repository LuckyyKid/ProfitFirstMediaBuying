import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import {
  Plus, Save, Trash2, FileText, Send, Copy, Download, Sparkles,
  Trophy, XCircle, Calendar,
} from "lucide-react";

type Report = {
  id: string; client_id: string;
  week_start: string; week_end: string; week_label: string | null;
  title: string | null; status: string;
  executive_summary: string | null;
  performance_highlights: string | null;
  key_wins: string | null;
  key_challenges: string | null;
  metrics_snapshot: Record<string, any>;
  wayfinder_decisions: string | null;
  next_week_priorities: string | null;
  blockers: string | null;
  asks_to_client: string | null;
  winner_concept_ids: string[];
  loser_concept_ids: string[];
  linked_test_ids: string[];
  recipients: string[];
  sent_at: string | null;
  notes: string | null;
};

type Concept = { id: string; concept_name: string; status: string };
type Wayfinder = {
  id: string; session_date: string; status: string;
  performance_summary: string | null; key_learnings: string | null;
  decisions: string | null; next_actions: string | null;
  winner_concept_ids: string[]; loser_concept_ids: string[];
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

const STATUSES = ["draft", "ready", "sent", "archived"];
const STATUS_COLOR: Record<string, string> = {
  draft: MUTED, ready: YELLOW, sent: GREEN, archived: RED,
};

function lastMondayToSunday(from = new Date()): { start: string; end: string } {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff - 7); // previous week's Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `S${week} - ${d.getFullYear()}`;
}

const METRICS = [
  { key: "revenue", label: "Revenue", unit: "€" },
  { key: "ad_spend", label: "Ad Spend", unit: "€" },
  { key: "orders", label: "Orders", unit: "" },
  { key: "roas", label: "ROAS", unit: "x" },
  { key: "mer", label: "MER", unit: "x" },
  { key: "cac", label: "CAC", unit: "€" },
  { key: "aov", label: "AOV", unit: "€" },
  { key: "cvr", label: "CVR", unit: "%" },
];

export default function WeeklyExecutiveReport() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [wayfinders, setWayfinders] = useState<Wayfinder[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [r, c, w] = await Promise.all([
      (supabase as any).from("gos_weekly_executive_reports").select("*").eq("client_id", clientId).order("week_start", { ascending: false }),
      supabase.from("gos_concept_log").select("id,concept_name,status").eq("client_id", clientId),
      (supabase as any).from("gos_wayfinder_sessions").select("id,session_date,status,performance_summary,key_learnings,decisions,next_actions,winner_concept_ids,loser_concept_ids").eq("client_id", clientId).order("session_date", { ascending: false }).limit(10),
    ]);
    setReports((r.data ?? []) as Report[]);
    setConcepts((c.data ?? []) as Concept[]);
    setWayfinders((w.data ?? []) as Wayfinder[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const conceptMap = useMemo(() => new Map(concepts.map(c => [c.id, c])), [concepts]);

  const addReport = async () => {
    if (!clientId) return;
    const { start, end } = lastMondayToSunday();
    const { error } = await (supabase as any).from("gos_weekly_executive_reports").insert({
      client_id: clientId,
      week_start: start,
      week_end: end,
      week_label: weekLabel(start),
      title: `Rapport hebdo · ${weekLabel(start)}`,
      status: "draft",
      metrics_snapshot: {},
    });
    if (error) return toast.error(error.message);
    toast.success("Rapport créé");
    load();
  };

  const update = (id: string, patch: Partial<Report>) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const save = async (r: Report) => {
    const { id, client_id, ...rest } = r;
    const { error } = await (supabase as any).from("gos_weekly_executive_reports").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sauvegardé");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce rapport ?")) return;
    const { error } = await (supabase as any).from("gos_weekly_executive_reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success("Supprimé");
  };

  const importFromWayfinder = (r: Report, w: Wayfinder) => {
    update(r.id, {
      wayfinder_decisions: [w.decisions, w.key_learnings].filter(Boolean).join("\n\n") || null,
      next_week_priorities: w.next_actions ?? r.next_week_priorities,
      performance_highlights: w.performance_summary ?? r.performance_highlights,
      winner_concept_ids: Array.from(new Set([...r.winner_concept_ids, ...(w.winner_concept_ids ?? [])])),
      loser_concept_ids: Array.from(new Set([...r.loser_concept_ids, ...(w.loser_concept_ids ?? [])])),
    });
    toast.success("Wayfinder importé (n'oublie pas de sauvegarder)");
  };

  const buildMarkdown = (r: Report): string => {
    const winners = r.winner_concept_ids.map(id => conceptMap.get(id)?.concept_name).filter(Boolean);
    const losers = r.loser_concept_ids.map(id => conceptMap.get(id)?.concept_name).filter(Boolean);
    const m = r.metrics_snapshot ?? {};
    const metricLines = METRICS
      .filter(mm => m[mm.key] !== undefined && m[mm.key] !== "" && m[mm.key] !== null)
      .map(mm => `- **${mm.label}**: ${m[mm.key]}${mm.unit}${m[`${mm.key}_target`] ? ` (cible: ${m[`${mm.key}_target`]}${mm.unit})` : ""}`);
    return [
      `# ${r.title ?? "Rapport hebdomadaire"}`,
      `_${r.week_start} → ${r.week_end}_`,
      "",
      "## Résumé exécutif",
      r.executive_summary || "_—_",
      "",
      "## Performance",
      metricLines.join("\n") || "_—_",
      r.performance_highlights ? `\n${r.performance_highlights}` : "",
      "",
      "## Wins de la semaine",
      r.key_wins || "_—_",
      "",
      "## Défis & apprentissages",
      r.key_challenges || "_—_",
      "",
      "## Décisions Wayfinder",
      r.wayfinder_decisions || "_—_",
      "",
      "## Créatifs",
      winners.length ? `**Winners à scaler** : ${winners.join(", ")}` : "",
      losers.length ? `**Losers coupés** : ${losers.join(", ")}` : "",
      "",
      "## Priorités semaine prochaine",
      r.next_week_priorities || "_—_",
      "",
      r.blockers ? `## Blockers\n${r.blockers}\n` : "",
      r.asks_to_client ? `## Demandes au client\n${r.asks_to_client}\n` : "",
    ].filter(Boolean).join("\n");
  };

  const copyMarkdown = (r: Report) => {
    const md = buildMarkdown(r);
    navigator.clipboard.writeText(md);
    toast.success("Markdown copié");
  };

  const downloadMarkdown = (r: Report) => {
    const md = buildMarkdown(r);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${r.week_start}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markSent = async (r: Report) => {
    const patch = { status: "sent", sent_at: new Date().toISOString() };
    update(r.id, patch as any);
    await save({ ...r, ...patch } as any);
  };

  const sendEmail = async (r: Report) => {
    if (!r.recipients?.length) return toast.error("Ajoute au moins un destinataire");
    // Save first so backend reads latest content
    await save(r);
    const t = toast.loading(`Envoi à ${r.recipients.length} destinataire(s)…`);
    const { data, error } = await (supabase as any).functions.invoke("gos-send-weekly-report", {
      body: { report_id: r.id },
    });
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    if (!data?.success) return toast.error(data?.results?.[0]?.error ?? "Échec de l'envoi");
    toast.success(`Envoyé ✓`);
    update(r.id, { status: "sent", sent_at: new Date().toISOString() } as any);
  };

  const stats = useMemo(() => ({
    total: reports.length,
    draft: reports.filter(r => r.status === "draft").length,
    ready: reports.filter(r => r.status === "ready").length,
    sent: reports.filter(r => r.status === "sent").length,
  }), [reports]);

  if (!selectedClient) {
    return <EmptyState title="Aucun client sélectionné" hint="Choisis un client pour accéder au rapport exécutif hebdomadaire." />;
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
        title="Weekly Executive Report"
        subtitle="Rapport hebdomadaire client : perf, décisions, next actions, exportable en Markdown"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: BLUE },
          { label: "Brouillons", value: stats.draft, color: MUTED },
          { label: "Prêts", value: stats.ready, color: YELLOW },
          { label: "Envoyés", value: stats.sent, color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={addReport} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nouveau rapport
        </button>
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Chargement…</div>
      ) : reports.length === 0 ? (
        <EmptyState title="Aucun rapport encore" hint="Génère ton premier Weekly Executive Report pour capitaliser sur la semaine." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {reports.map(r => {
            const expanded = expandedId === r.id;
            const m = r.metrics_snapshot ?? {};
            return (
              <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{ padding: 14, display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                >
                  <FileText size={18} color={BLUE} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--tdia-text)", fontSize: 14 }}>
                      {r.title ?? r.week_label ?? `${r.week_start} → ${r.week_end}`}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                      <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
                      {r.week_start} → {r.week_end}
                      {" · "}{r.recipients.length} destinataires
                      {r.sent_at ? ` · envoyé le ${new Date(r.sent_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 999, background: STATUS_COLOR[r.status] + "22", color: STATUS_COLOR[r.status], fontSize: 11, fontWeight: 700 }}>
                    {r.status.toUpperCase()}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); del(r.id); }} style={{ background: "transparent", border: "none", color: RED, cursor: "pointer" }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                {expanded && (
                  <div style={{ padding: 16, borderTop: `1px solid ${BORDER}`, display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Titre</label>
                        <input style={inputStyle} value={r.title ?? ""} onChange={e => update(r.id, { title: e.target.value })} />
                      </div>
                      <div>
                        <label style={labelStyle}>Statut</label>
                        <select style={inputStyle} value={r.status} onChange={e => update(r.id, { status: e.target.value })}>
                          {STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Début semaine</label>
                        <input type="date" style={inputStyle} value={r.week_start}
                          onChange={e => update(r.id, { week_start: e.target.value, week_label: weekLabel(e.target.value) })} />
                      </div>
                      <div>
                        <label style={labelStyle}>Fin semaine</label>
                        <input type="date" style={inputStyle} value={r.week_end} onChange={e => update(r.id, { week_end: e.target.value })} />
                      </div>
                    </div>

                    {/* Import from Wayfinder */}
                    {wayfinders.length > 0 && (
                      <div style={{ background: BG_DEEP, border: `1px dashed ${BORDER}`, borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 6 }}>
                          <Sparkles size={11} style={{ display: "inline", marginRight: 4, color: PURPLE }} />
                          IMPORTER DEPUIS UN WAYFINDER RÉCENT
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {wayfinders.slice(0, 5).map(w => (
                            <button key={w.id} type="button" onClick={() => importFromWayfinder(r, w)}
                              style={{
                                padding: "4px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                                background: PURPLE + "22", color: PURPLE, border: `1px solid ${PURPLE}55`,
                              }}>
                              {w.session_date}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metrics snapshot */}
                    <div>
                      <label style={labelStyle}>Snapshot métriques</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {METRICS.map(mm => (
                          <div key={mm.key} style={{ background: BG_DEEP, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 8 }}>
                            <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{mm.label.toUpperCase()} ({mm.unit || "-"})</div>
                            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                              <input
                                style={{ ...inputStyle, padding: "4px 6px", fontSize: 12 }}
                                placeholder="Réel"
                                value={m[mm.key] ?? ""}
                                onChange={e => update(r.id, { metrics_snapshot: { ...m, [mm.key]: e.target.value } })}
                              />
                              <input
                                style={{ ...inputStyle, padding: "4px 6px", fontSize: 12 }}
                                placeholder="Cible"
                                value={m[`${mm.key}_target`] ?? ""}
                                onChange={e => update(r.id, { metrics_snapshot: { ...m, [`${mm.key}_target`]: e.target.value } })}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Résumé exécutif</label>
                      <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                        placeholder="1-3 phrases : où en est le business, quelle a été la dynamique de la semaine…"
                        value={r.executive_summary ?? ""} onChange={e => update(r.id, { executive_summary: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Faits marquants de performance</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        value={r.performance_highlights ?? ""} onChange={e => update(r.id, { performance_highlights: e.target.value })} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Wins clés</label>
                        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                          value={r.key_wins ?? ""} onChange={e => update(r.id, { key_wins: e.target.value })} />
                      </div>
                      <div>
                        <label style={labelStyle}>Défis / apprentissages</label>
                        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                          value={r.key_challenges ?? ""} onChange={e => update(r.id, { key_challenges: e.target.value })} />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Décisions Wayfinder</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        value={r.wayfinder_decisions ?? ""} onChange={e => update(r.id, { wayfinder_decisions: e.target.value })} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={labelStyle}><Trophy size={11} style={{ display: "inline", marginRight: 4, color: GREEN }} />Winners à scaler</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {concepts.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>Aucun concept</div>}
                          {concepts.map(c => {
                            const active = r.winner_concept_ids.includes(c.id);
                            return (
                              <button key={c.id} type="button"
                                onClick={() => update(r.id, { winner_concept_ids: active ? r.winner_concept_ids.filter(x => x !== c.id) : [...r.winner_concept_ids, c.id] })}
                                style={{
                                  padding: "4px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                                  background: active ? GREEN + "33" : BG_DEEP, color: active ? GREEN : MUTED,
                                  border: `1px solid ${active ? GREEN : BORDER}`,
                                }}>{c.concept_name}</button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}><XCircle size={11} style={{ display: "inline", marginRight: 4, color: RED }} />Losers coupés</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {concepts.map(c => {
                            const active = r.loser_concept_ids.includes(c.id);
                            return (
                              <button key={c.id} type="button"
                                onClick={() => update(r.id, { loser_concept_ids: active ? r.loser_concept_ids.filter(x => x !== c.id) : [...r.loser_concept_ids, c.id] })}
                                style={{
                                  padding: "4px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                                  background: active ? RED + "33" : BG_DEEP, color: active ? RED : MUTED,
                                  border: `1px solid ${active ? RED : BORDER}`,
                                }}>{c.concept_name}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Priorités semaine prochaine</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        value={r.next_week_priorities ?? ""} onChange={e => update(r.id, { next_week_priorities: e.target.value })} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Blockers / risques</label>
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                          value={r.blockers ?? ""} onChange={e => update(r.id, { blockers: e.target.value })} />
                      </div>
                      <div>
                        <label style={labelStyle}>Demandes au client</label>
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                          value={r.asks_to_client ?? ""} onChange={e => update(r.id, { asks_to_client: e.target.value })} />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Destinataires (emails séparés par virgule)</label>
                      <input style={inputStyle}
                        value={r.recipients.join(", ")}
                        onChange={e => update(r.id, { recipients: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Notes internes</label>
                      <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                        value={r.notes ?? ""} onChange={e => update(r.id, { notes: e.target.value })} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => copyMarkdown(r)} className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Copy size={14} /> Copier Markdown
                        </button>
                        <button onClick={() => downloadMarkdown(r)} className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Download size={14} /> Télécharger .md
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => sendEmail(r)} className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, color: GREEN, borderColor: GREEN + "55" }}>
                          <Send size={14} /> Envoyer par email
                        </button>
                        {r.status !== "sent" && (
                          <button onClick={() => markSent(r)} className="gos-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Send size={14} /> Marquer envoyé
                          </button>
                        )}
                        <button onClick={() => save(r)} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Save size={14} /> Sauvegarder
                        </button>
                      </div>
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
