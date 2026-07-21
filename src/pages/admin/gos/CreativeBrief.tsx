import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Save, Trash2, Sparkles, FileText, Copy, Loader2 } from "lucide-react";

type Brief = {
  id: string; client_id: string; objective_id: string | null;
  title: string; status: string;
  target_audience: string | null; audience_pains: string | null; audience_desires: string | null;
  big_idea: string | null; core_promise: string | null; proof_points: string | null;
  offer: string | null; mandatory_elements: string | null; do_not_use: string | null;
  formats: string[] | null; platforms: string[] | null;
  deliverables_count: number; due_date: string | null;
  reference_winners: string[] | null; reference_links: string | null;
  brand_voice: string | null;
  generated_brief: string | null; generated_at: string | null;
};
type Objective = { id: string; label: string; primary_kpi: string; target_value: number | null; rationale: string | null; };
type Winner = { id: string; concept_name: string; angle: string | null; format: string | null; hypothesis: string | null; orders: number; cpa: number | null; revenue: number; spend: number; learning: string | null; };

const CARD = "hsl(220 45% 16%)";
const BG_DEEP = "hsl(220 45% 14%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";
const PURPLE = "#a855f7";

const STATUS_LIST = ["draft", "in_review", "approved", "in_production", "shipped", "archived"];
const STATUS_COLOR: Record<string, string> = {
  draft: MUTED, in_review: YELLOW, approved: BLUE, in_production: PURPLE, shipped: GREEN, archived: MUTED,
};

const FORMAT_OPTS = ["video-15s", "video-30s", "video-60s", "static-1x1", "static-4x5", "static-9x16", "carousel", "ugc", "gif"];
const PLATFORM_OPTS = ["meta", "tiktok", "youtube", "google", "pinterest"];

export default function CreativeBrief() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [businessContext, setBusinessContext] = useState<string>("");

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [b, o, w, bc] = await Promise.all([
      supabase.from("gos_creative_briefs").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }),
      supabase.from("gos_business_objectives").select("id,label,primary_kpi,target_value,rationale").eq("client_id", clientId).eq("status", "active"),
      supabase.from("gos_concept_log").select("id,concept_name,angle,format,hypothesis,orders,cpa,revenue,spend,learning")
        .eq("client_id", clientId).or("verdict.eq.winner,status.eq.winner").limit(20),
      supabase.from("gos_business_contexts").select("*").eq("client_id", clientId).maybeSingle(),
    ]);
    setBriefs((b.data ?? []) as Brief[]);
    setObjectives((o.data ?? []) as Objective[]);
    setWinners((w.data ?? []) as Winner[]);
    // Compose a compact business context string from whatever fields exist
    if (bc.data) {
      const bcData: any = bc.data;
      setBusinessContext(
        [bcData.brand_positioning, bcData.value_proposition, bcData.unique_selling_points, bcData.brand_voice]
          .filter(Boolean).join("\n") || ""
      );
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const addBrief = async () => {
    if (!clientId) return;
    const { error } = await supabase.from("gos_creative_briefs").insert({
      client_id: clientId, title: "Nouveau brief", status: "draft",
      formats: [], platforms: [], deliverables_count: 1,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: Partial<Brief>) => {
    setBriefs(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const save = async (b: Brief) => {
    const { id, client_id, ...rest } = b;
    const { error } = await supabase.from("gos_creative_briefs").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Brief enregistré");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce brief ?")) return;
    const { error } = await supabase.from("gos_creative_briefs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const generate = async (b: Brief) => {
    setGenerating(b.id);
    try {
      // Save latest edits first
      await supabase.from("gos_creative_briefs").update({
        ...b, id: undefined, client_id: undefined,
      } as any).eq("id", b.id);

      const objective = objectives.find(o => o.id === b.objective_id);
      const selectedWinners = winners.filter(w => (b.reference_winners ?? []).includes(w.id))
        .map(w => ({
          ...w,
          roas: w.spend > 0 ? (w.revenue / w.spend).toFixed(2) : null,
        }));

      const { data, error } = await supabase.functions.invoke("gos-generate-brief", {
        body: {
          client_name: selectedClient?.company_name,
          objective, brief: b,
          business_context: businessContext,
          winners: selectedWinners,
          brand_voice: b.brand_voice,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const generated = data?.generated ?? "";
      await supabase.from("gos_creative_briefs").update({
        generated_brief: generated, generated_at: new Date().toISOString(),
      }).eq("id", b.id);
      toast.success("Brief généré");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur génération");
    } finally {
      setGenerating(null);
    }
  };

  const copyBrief = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  const toggleArrayItem = (arr: string[] | null, item: string): string[] => {
    const list = arr ?? [];
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  };

  if (!selectedClient) return <EmptyState title="Aucun client sélectionné" hint="Sélectionne un client d'abord." />;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
      <SectionHeader
        title="Ultimate Creative Brief"
        subtitle="Génère un brief production-ready qui combine ton objectif business, ton contexte de marque et les winners de ton Concept Log. Powered by Lovable AI."
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 12, color: MUTED }}>
          {briefs.length} brief(s) · {winners.length} winner(s) disponible(s) comme référence
        </div>
        <button onClick={addBrief}
          style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nouveau brief
        </button>
      </div>

      {loading && <div style={{ color: MUTED }}>Chargement...</div>}
      {!loading && briefs.length === 0 && (
        <EmptyState title="Aucun brief" hint="Crée un brief pour ta prochaine batch créative." />
      )}

      {briefs.map(b => (
        <div key={b.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${STATUS_COLOR[b.status] ?? MUTED}`, borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px auto", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Titre</div>
              <input value={b.title} onChange={e => update(b.id, { title: e.target.value })}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", fontWeight: 600 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Objectif lié</div>
              <select value={b.objective_id ?? ""} onChange={e => update(b.id, { objective_id: e.target.value || null })}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }}>
                <option value="">—</option>
                {objectives.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Statut</div>
              <select value={b.status} onChange={e => update(b.id, { status: e.target.value })}
                style={{ background: BG_DEEP, color: STATUS_COLOR[b.status], fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }}>
                {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Deadline</div>
              <input type="date" value={b.due_date ?? ""} onChange={e => update(b.id, { due_date: e.target.value || null })}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Nb livrables</div>
              <input type="number" value={b.deliverables_count} min={1} onChange={e => update(b.id, { deliverables_count: Number(e.target.value) })}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => save(b)} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Save size={13} /> Save
              </button>
              <button onClick={() => del(b.id)} style={{ background: "transparent", color: RED, border: `1px solid ${RED}`, borderRadius: 6, padding: "8px 10px", cursor: "pointer" }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Audience block */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {([
              ["target_audience", "Audience cible"],
              ["audience_pains", "Pains (frustrations)"],
              ["audience_desires", "Désirs (aspirations)"],
            ] as [keyof Brief, string][]).map(([k, label]) => (
              <div key={k as string}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>{label}</div>
                <textarea value={(b[k] as string) ?? ""} onChange={e => update(b.id, { [k]: e.target.value } as any)}
                  rows={2}
                  style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
              </div>
            ))}
          </div>

          {/* Message block */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>💡 Big idea (une phrase)</div>
              <textarea value={b.big_idea ?? ""} onChange={e => update(b.id, { big_idea: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>🗣️ Promesse</div>
              <textarea value={b.core_promise ?? ""} onChange={e => update(b.id, { core_promise: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>✅ Proof points</div>
              <textarea value={b.proof_points ?? ""} onChange={e => update(b.id, { proof_points: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>🎁 Offre</div>
              <textarea value={b.offer ?? ""} onChange={e => update(b.id, { offer: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
          </div>

          {/* Mandatories */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Mandatories</div>
              <textarea value={b.mandatory_elements ?? ""} onChange={e => update(b.id, { mandatory_elements: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>À éviter</div>
              <textarea value={b.do_not_use ?? ""} onChange={e => update(b.id, { do_not_use: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Ton de marque</div>
              <textarea value={b.brand_voice ?? ""} onChange={e => update(b.id, { brand_voice: e.target.value })}
                rows={2}
                style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            </div>
          </div>

          {/* Formats + Platforms toggles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Formats</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {FORMAT_OPTS.map(f => {
                  const on = (b.formats ?? []).includes(f);
                  return (
                    <button key={f} onClick={() => update(b.id, { formats: toggleArrayItem(b.formats, f) })}
                      style={{ background: on ? BLUE : "transparent", color: on ? "#fff" : MUTED, border: `1px solid ${on ? BLUE : BORDER}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Plateformes</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PLATFORM_OPTS.map(p => {
                  const on = (b.platforms ?? []).includes(p);
                  return (
                    <button key={p} onClick={() => update(b.id, { platforms: toggleArrayItem(b.platforms, p) })}
                      style={{ background: on ? PURPLE : "transparent", color: on ? "#fff" : MUTED, border: `1px solid ${on ? PURPLE : BORDER}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Winner references */}
          <div>
            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
              🏆 Winners du Concept Log à référencer ({(b.reference_winners ?? []).length} sélectionné(s))
            </div>
            {winners.length === 0 ? (
              <div style={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>Aucun winner documenté dans le Concept Log.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {winners.map(w => {
                  const on = (b.reference_winners ?? []).includes(w.id);
                  return (
                    <button key={w.id} onClick={() => update(b.id, { reference_winners: toggleArrayItem(b.reference_winners, w.id) })}
                      style={{ background: on ? GREEN : "transparent", color: on ? "#fff" : "#e5e7eb", border: `1px solid ${on ? GREEN : BORDER}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                      🏆 {w.concept_name} <span style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>· {w.angle ?? "?"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reference links */}
          <div>
            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Références externes (URLs)</div>
            <textarea value={b.reference_links ?? ""} onChange={e => update(b.id, { reference_links: e.target.value })}
              rows={2} placeholder="https://... (concurrents, moodboard, videos qui inspirent)"
              style={{ background: BG_DEEP, color: "var(--tdia-text)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", width: "100%", resize: "vertical", fontFamily: "inherit" }} />
          </div>

          {/* AI generation */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, background: "rgba(168,85,247,0.08)", border: `1px dashed ${PURPLE}`, borderRadius: 8 }}>
            <Sparkles size={20} style={{ color: PURPLE }} />
            <div style={{ flex: 1, fontSize: 12, color: "#e5e7eb" }}>
              <div style={{ fontWeight: 600, color: PURPLE }}>Générer le brief final avec Lovable AI</div>
              <div style={{ color: MUTED, marginTop: 2 }}>
                L'IA composera un brief markdown structuré (contexte, cible, big idea, directions créatives, mandatories, livrables, hypothèse à valider) en s'appuyant sur les champs remplis + les winners sélectionnés.
              </div>
            </div>
            <button onClick={() => generate(b)} disabled={generating === b.id}
              style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: generating === b.id ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {generating === b.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating === b.id ? "Génération..." : "Générer"}
            </button>
          </div>

          {/* Generated output */}
          {b.generated_brief && (
            <div style={{ background: BG_DEEP, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <FileText size={14} style={{ color: GREEN }} />
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Brief final · généré {b.generated_at ? new Date(b.generated_at).toLocaleString("fr-FR") : ""}
                </div>
                <button onClick={() => copyBrief(b.generated_brief!)}
                  style={{ marginLeft: "auto", background: "transparent", color: BLUE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <Copy size={11} /> Copier
                </button>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", color: "#e5e7eb", fontSize: 12, lineHeight: 1.6, margin: 0, maxHeight: 500, overflow: "auto" }}>
                {b.generated_brief}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
