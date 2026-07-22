import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { MarkBlockDoneButton } from "@/gos/workflow";
import { toast } from "sonner";
import { Plus, RefreshCw, Copy, Trash2, AlertTriangle } from "lucide-react";

type Review = {
  id: string; review_date: string; period_label: string | null;
  health_verdict: string | null; reviewer: string | null;
  actual_revenue: number | null; actual_ad_spend: number | null;
  actual_cac: number | null; actual_mer: number | null;
  variance_vs_target_pct: number | null;
  actions_taken: any; next_actions: any; alerts: any; notes: string | null; status: string | null;
};

const VERDICT_COLOR: Record<string, string> = {
  ON_TRACK: "#3ddc97", SLIGHTLY_OFF: "#f5b74e", AT_RISK: "#ff6b6b", OFF_TRACK: "#ff6b6b", CRISIS: "#ff6b6b",
};
const VERDICT_SHORT: Record<string, string> = {
  ON_TRACK: "OK", SLIGHTLY_OFF: "OFF-5", AT_RISK: "RISK", OFF_TRACK: "OFF", CRISIS: "CRIT",
};

const MONO: React.CSSProperties = { fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums" };
const MUTED = "#8b97ad";
const BORDER = "rgba(148, 170, 215, 0.12)";
const SURFACE = "rgba(255, 255, 255, 0.02)";
const BG_DEEP = "rgba(11, 19, 34, 0.6)";

const fmtInt = (n: number | null) => n == null ? "—" : Math.round(Number(n)).toLocaleString();
const fmtDec = (n: number | null, d = 2) => n == null ? "—" : Number(n).toFixed(d);
const daysAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 86400000);

function classifyProblem(r: Review, target: any): { type: string; color: string; explain: string; action: string } {
  if (!target) return { type: "NON CLASSÉ", color: "#6C7F93", explain: "Aucune cible active — classification impossible.", action: "Crée d'abord un Objectif de métrique." };
  const rev = r.actual_revenue, spend = r.actual_ad_spend, cac = r.actual_cac, mer = r.actual_mer;
  const tRev = target.target_revenue, tSpend = target.target_ad_spend, tCac = target.target_cac, tMer = target.target_mer;
  const revVar = rev != null && tRev ? (Number(rev) - Number(tRev)) / Number(tRev) : null;
  const spendVar = spend != null && tSpend ? (Number(spend) - Number(tSpend)) / Number(tSpend) : null;
  const cacVar = cac != null && tCac ? (Number(cac) - Number(tCac)) / Number(tCac) : null;
  const merVar = mer != null && tMer ? (Number(mer) - Number(tMer)) / Number(tMer) : null;
  const revOff = revVar != null && revVar < -0.05;
  const spendUnder = spendVar != null && spendVar < -0.15;
  const cacBad = cacVar != null && cacVar > 0.15;
  const merBad = merVar != null && merVar < -0.15;
  const trackingSuspect = rev != null && spend != null && mer != null && cac != null && Math.abs((Number(rev) / Number(spend)) - Number(mer)) > 0.5;
  const flags = [revOff, cacBad || merBad, spendUnder, trackingSuspect].filter(Boolean).length;
  if (flags >= 3) return { type: "MIXTE", color: "#ff6b6b", explain: "Signaux multiples — volume, efficacité et structure tous sous cible.", action: "Escalade au lead strategist ; pause du scaling et re-diagnostic." };
  if (trackingSuspect) return { type: "TRACKING", color: "#f5b74e", explain: "Le MER remonté ne colle pas au revenu/dépense — attribution ou pixel probablement cassé.", action: "Audite pixel, GA4, revenu backend et ROAS plateforme avant toute décision budget." };
  if (spendUnder && revOff) return { type: "VOLUME", color: "#4d9fff", explain: "Sous-dépense vs plan → sous-livraison de revenu.", action: "Scale la dépense sur les campagnes gagnantes en tenant les garde-fous CAC." };
  if ((cacBad || merBad) && !spendUnder) return { type: "EFFICACITÉ", color: "#f5b74e", explain: "La dépense est dans le plan mais CAC/MER sont hors cible — fatigue créative ou audience.", action: "Rafraîchis les créatifs, coupe les angles fatigués, resserre les audiences." };
  if (spendUnder && !revOff) return { type: "CONTRAINTE", color: "#3ddc97", explain: "Plafond budget ou capacité qui limite la dépense — revenu tient.", action: "Augmente le cap quotidien ou débloque la contrainte stock/capacité." };
  if (revOff) return { type: "VOLUME", color: "#4d9fff", explain: "Revenu sous cible avec efficacité qui tient.", action: "Augmente la portée / nouveaux angles / élargis le top-of-funnel." };
  return { type: "DANS LES TEMPS", color: "#3ddc97", explain: "Aucun problème structurel détecté sur la période.", action: "Maintiens le rythme et continue à tester." };
}

export default function LiveOptimization() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [latestTarget, setLatestTarget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const emptyForm = {
    review_date: new Date().toISOString().slice(0, 10),
    period_label: "", reviewer: "",
    actual_revenue: "", actual_ad_spend: "", actual_cac: "", actual_mer: "",
    actions_taken: "", next_actions: "", alerts: "", notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, r, t] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_live_optimization_reviews").select("*").eq("client_id", clientId).order("review_date", { ascending: false }),
      supabase.from("gos_metric_targets").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    const list = (r.data ?? []) as Review[];
    setReviews(list);
    setLatestTarget(t.data);
    setSelectedId((prev) => prev && list.find(x => x.id === prev) ? prev : list[0]?.id ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const kpis = useMemo(() => {
    const last30 = reviews.filter(r => daysAgo(r.review_date) <= 30);
    const onTrack = last30.filter(r => r.health_verdict === "ON_TRACK").length;
    const vars = last30.map(r => r.variance_vs_target_pct).filter((v): v is number => v != null);
    const avgVar = vars.length ? vars.reduce((a, b) => a + b, 0) / vars.length : null;
    const alertsOpen = reviews.filter(r => Array.isArray(r.alerts) && r.alerts.length > 0 && r.status !== "CLOSED").length;
    return {
      count30: last30.length,
      onTrackPct: last30.length ? Math.round((onTrack / last30.length) * 100) : null,
      avgVar,
      alertsOpen,
    };
  }, [reviews]);

  const selected = reviews.find(r => r.id === selectedId) || null;

  const submit = async () => {
    const num = (v: string) => v === "" ? null : Number(v);
    const rev = num(form.actual_revenue);
    const target = latestTarget?.target_revenue ?? null;
    const variance = rev != null && target ? Number(((rev - target) / target * 100).toFixed(1)) : null;
    let verdict = "ON_TRACK";
    if (variance != null) {
      if (variance < -25) verdict = "CRISIS";
      else if (variance < -15) verdict = "OFF_TRACK";
      else if (variance < -5) verdict = "AT_RISK";
      else if (variance < 0) verdict = "SLIGHTLY_OFF";
    }
    const toList = (s: string) => s ? s.split("\n").map((x) => x.trim()).filter(Boolean) : [];
    const { error } = await supabase.from("gos_live_optimization_reviews").insert({
      client_id: clientId!, review_date: form.review_date,
      period_label: form.period_label || null, reviewer: form.reviewer || null,
      health_verdict: verdict, actual_revenue: rev,
      actual_ad_spend: num(form.actual_ad_spend), actual_cac: num(form.actual_cac),
      actual_mer: num(form.actual_mer), variance_vs_target_pct: variance,
      actions_taken: toList(form.actions_taken), next_actions: toList(form.next_actions),
      alerts: toList(form.alerts), notes: form.notes || null, status: "DRAFT",
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Review créée · Verdict: ${verdict}`);
    setForm(emptyForm); setShowForm(false); load();
  };

  const cloneFromSelected = () => {
    if (!selected) return;
    setForm({
      ...emptyForm,
      review_date: new Date().toISOString().slice(0, 10),
      period_label: selected.period_label ?? "",
      reviewer: selected.reviewer ?? "",
      actual_revenue: selected.actual_revenue != null ? String(selected.actual_revenue) : "",
      actual_ad_spend: selected.actual_ad_spend != null ? String(selected.actual_ad_spend) : "",
      actual_cac: selected.actual_cac != null ? String(selected.actual_cac) : "",
      actual_mer: selected.actual_mer != null ? String(selected.actual_mer) : "",
      next_actions: Array.isArray(selected.next_actions) ? selected.next_actions.join("\n") : "",
    });
    setShowForm(true);
  };

  const removeReview = async (id: string) => {
    if (!confirm("Supprimer cette revue ?")) return;
    const { error } = await supabase.from("gos_live_optimization_reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Revue supprimée"); load();
  };

  if (loading) return <div style={{ height: 300, background: SURFACE, borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Revue hebdo en cours de campagne : compare le réel vs cible, classifie le type de problème et verrouille la prochaine action.",
          dataSource: "Objectifs de métriques (actif) + réels saisis par l'AM.",
          usedBy: "Mesure · Mises à jour prévisions · Intelligence client.",
          requiredInputs: ["Objectif de métrique actif", "Revenu / dépense / CAC / MER réels", "Actions prises / prochaines actions"],
          missingInputs: !latestTarget ? ["Aucun Objectif de métrique actif — la variance ne peut pas être calculée"] : [],
          nextStep: !latestTarget ? "Crée d'abord un Objectif de métrique." : "Enregistre la revue de la semaine, puis agis sur la classification du problème.",
          primaryCta: "Nouvelle revue",
        }}
        title="Optimisation live"
        subtitle="Table opérationnelle des revues · sélectionne une ligne pour voir le détail à droite."
        actions={
          <>
            <button className="gos-btn-secondary" onClick={load}>
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
            </button>
            <button className="gos-btn-primary" onClick={() => { setForm(emptyForm); setShowForm(true); }} data-tour="liveopt-new">
              <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Nouvelle revue
            </button>
            <MarkBlockDoneButton clientId={clientId} blockKey="live" disabled={reviews.length === 0} />
          </>
        }
      />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <Kpi label="Revues (30j)" value={String(kpis.count30)} />
        <Kpi label="% ON_TRACK (30j)" value={kpis.onTrackPct != null ? `${kpis.onTrackPct}%` : "—"}
             color={kpis.onTrackPct == null ? undefined : kpis.onTrackPct >= 70 ? "#3ddc97" : kpis.onTrackPct >= 40 ? "#f5b74e" : "#ff6b6b"} />
        <Kpi label="Variance moy. (30j)" value={kpis.avgVar != null ? `${kpis.avgVar > 0 ? "+" : ""}${kpis.avgVar.toFixed(1)}%` : "—"}
             color={kpis.avgVar == null ? undefined : kpis.avgVar >= 0 ? "#3ddc97" : kpis.avgVar >= -10 ? "#f5b74e" : "#ff6b6b"} />
        <Kpi label="Alertes actives" value={String(kpis.alertsOpen)} color={kpis.alertsOpen > 0 ? "#ff6b6b" : undefined} />
      </div>

      {!latestTarget && (
        <div className="gos-card" style={{ marginBottom: 16, borderColor: "rgba(245, 183, 78, 0.4)", display: "flex", gap: 10, alignItems: "center" }}>
          <AlertTriangle size={16} color="#f5b74e" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Aucune cible active</div>
            <div style={{ color: MUTED, fontSize: 12 }}>Crée une cible dans <b>Objectifs de métriques</b> pour calculer la variance et le verdict santé.</div>
          </div>
        </div>
      )}

      {/* New review drawer */}
      {showForm && (
        <div className="gos-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nouvelle revue</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <F label="Date"><input className="gos-input" type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} /></F>
            <F label="Période"><input className="gos-input" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="Sem 45" /></F>
            <F label="Reviewer"><input className="gos-input" value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} /></F>
            <F label="Cible active">
              <div style={{ padding: "8px 12px", background: BG_DEEP, borderRadius: 8, fontSize: 12, ...MONO }}>
                {latestTarget?.period_label ?? "—"}
              </div>
            </F>
            <F label="Revenu réel"><input className="gos-input" type="number" value={form.actual_revenue} onChange={(e) => setForm({ ...form, actual_revenue: e.target.value })} /></F>
            <F label="Spend réel"><input className="gos-input" type="number" value={form.actual_ad_spend} onChange={(e) => setForm({ ...form, actual_ad_spend: e.target.value })} /></F>
            <F label="CAC réel"><input className="gos-input" type="number" value={form.actual_cac} onChange={(e) => setForm({ ...form, actual_cac: e.target.value })} /></F>
            <F label="MER réel"><input className="gos-input" type="number" step="0.1" value={form.actual_mer} onChange={(e) => setForm({ ...form, actual_mer: e.target.value })} /></F>
            <div style={{ gridColumn: "span 2" }}><F label="Actions prises (une par ligne)"><textarea className="gos-input" rows={3} value={form.actions_taken} onChange={(e) => setForm({ ...form, actions_taken: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 2" }}><F label="Prochaines actions"><textarea className="gos-input" rows={3} value={form.next_actions} onChange={(e) => setForm({ ...form, next_actions: e.target.value })} /></F></div>
            <div style={{ gridColumn: "span 4" }}><F label="Alertes"><textarea className="gos-input" rows={2} value={form.alerts} onChange={(e) => setForm({ ...form, alerts: e.target.value })} /></F></div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="gos-btn-primary" onClick={submit}>Créer</button>
            <button className="gos-btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="gos-card"><EmptyState title="Aucune revue" hint="Ajoute une première revue live." /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 12 }} data-tour="liveopt-list">
          {/* TABLE */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "92px 70px 68px 72px 92px 92px 60px 56px 100px 90px",
              gap: 0, padding: "8px 12px", background: BG_DEEP,
              fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em",
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <div>Date</div>
              <div>Période</div>
              <div>Verdict</div>
              <div style={{ textAlign: "right" }}>Var %</div>
              <div style={{ textAlign: "right" }}>Revenu</div>
              <div style={{ textAlign: "right" }}>Spend</div>
              <div style={{ textAlign: "right" }}>CAC</div>
              <div style={{ textAlign: "right" }}>MER</div>
              <div>Problème</div>
              <div>Reviewer</div>
            </div>
            <div style={{ maxHeight: 640, overflowY: "auto" }}>
              {reviews.map((r) => {
                const p = classifyProblem(r, latestTarget);
                const vColor = VERDICT_COLOR[r.health_verdict ?? "ON_TRACK"] ?? "#666";
                const isSel = r.id === selectedId;
                const varN = r.variance_vs_target_pct;
                return (
                  <div key={r.id} onClick={() => setSelectedId(r.id)} style={{
                    display: "grid",
                    gridTemplateColumns: "92px 70px 68px 72px 92px 92px 60px 56px 100px 90px",
                    gap: 0, padding: "10px 12px", cursor: "pointer",
                    borderBottom: `1px solid ${BORDER}`,
                    borderLeft: `3px solid ${isSel ? vColor : "transparent"}`,
                    background: isSel ? "rgba(77, 159, 255, 0.08)" : "transparent",
                    fontSize: 12,
                  }}>
                    <div style={MONO}>{r.review_date}</div>
                    <div style={{ color: MUTED }}>{r.period_label ?? "—"}</div>
                    <div>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: vColor + "22", color: vColor, fontSize: 10, fontWeight: 700, ...MONO }}>
                        {VERDICT_SHORT[r.health_verdict ?? "ON_TRACK"] ?? "—"}
                      </span>
                    </div>
                    <div style={{ ...MONO, textAlign: "right", fontWeight: 600, color: varN == null ? MUTED : varN < 0 ? "#ff6b6b" : "#3ddc97" }}>
                      {varN != null ? `${varN > 0 ? "+" : ""}${varN}%` : "—"}
                    </div>
                    <div style={{ ...MONO, textAlign: "right" }}>{fmtInt(r.actual_revenue)}</div>
                    <div style={{ ...MONO, textAlign: "right" }}>{fmtInt(r.actual_ad_spend)}</div>
                    <div style={{ ...MONO, textAlign: "right" }}>{fmtInt(r.actual_cac)}</div>
                    <div style={{ ...MONO, textAlign: "right" }}>{r.actual_mer != null ? `${fmtDec(r.actual_mer, 1)}x` : "—"}</div>
                    <div>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: p.color + "18", color: p.color, fontSize: 9, fontWeight: 700, letterSpacing: "0.03em" }}>{p.type}</span>
                    </div>
                    <div style={{ color: MUTED, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reviewer ?? "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INSPECTOR */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            {!selected ? (
              <div style={{ color: MUTED, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Sélectionne une revue</div>
            ) : (
              <Inspector r={selected} target={latestTarget} onClone={cloneFromSelected} onDelete={() => removeReview(selected.id)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 22, fontWeight: 600, marginTop: 4, color: color ?? "inherit" }}>{value}</div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="gos-label">{label}</div>{children}</div>;
}

function Inspector({ r, target, onClone, onDelete }: { r: Review; target: any; onClone: () => void; onDelete: () => void }) {
  const p = classifyProblem(r, target);
  const vColor = VERDICT_COLOR[r.health_verdict ?? "ON_TRACK"] ?? "#666";
  const varN = r.variance_vs_target_pct;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ ...MONO, fontSize: 13, fontWeight: 600 }}>{r.review_date}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {r.period_label ? `${r.period_label} · ` : ""}{r.reviewer ?? "—"}
          </div>
        </div>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: vColor + "22", color: vColor, fontSize: 10, fontWeight: 700, ...MONO }}>
          {r.health_verdict}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <div style={{ ...MONO, fontSize: 32, fontWeight: 700, color: varN == null ? MUTED : varN < 0 ? "#ff6b6b" : "#3ddc97" }}>
          {varN != null ? `${varN > 0 ? "+" : ""}${varN}%` : "—"}
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>vs cible</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        <MetricTile label="Revenu" value={fmtInt(r.actual_revenue)} suffix="$" />
        <MetricTile label="Spend" value={fmtInt(r.actual_ad_spend)} suffix="$" />
        <MetricTile label="CAC" value={fmtInt(r.actual_cac)} suffix="$" />
        <MetricTile label="MER" value={r.actual_mer != null ? fmtDec(r.actual_mer, 2) : "—"} suffix="x" />
      </div>

      <div style={{ padding: 10, background: BG_DEEP, borderRadius: 8, borderLeft: `3px solid ${p.color}`, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ padding: "2px 8px", borderRadius: 4, background: p.color + "22", color: p.color, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>{p.type}</span>
        </div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{p.explain}</div>
        <div style={{ fontSize: 12, marginTop: 6, color: p.color, fontWeight: 600 }}>→ {p.action}</div>
      </div>

      {Array.isArray(r.actions_taken) && r.actions_taken.length > 0 && <BlockList label="Actions prises" items={r.actions_taken} />}
      {Array.isArray(r.next_actions) && r.next_actions.length > 0 && <BlockList label="Prochaines actions" items={r.next_actions} />}
      {Array.isArray(r.alerts) && r.alerts.length > 0 && <BlockList label="Alertes" items={r.alerts} color="#ff6b6b" />}
      {r.notes && (
        <div style={{ marginTop: 10 }}>
          <div className="gos-label">Notes</div>
          <div style={{ fontSize: 12, color: MUTED, whiteSpace: "pre-wrap" }}>{r.notes}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        <button className="gos-btn-secondary" onClick={onClone} style={{ flex: 1 }}>
          <Copy size={12} style={{ verticalAlign: "middle", marginRight: 6 }} /> Cloner
        </button>
        <button className="gos-btn-secondary" onClick={onDelete} style={{ color: "#ff6b6b" }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function MetricTile({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div style={{ padding: 8, background: BG_DEEP, borderRadius: 6 }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600 }}>{label}</div>
      <div style={{ ...MONO, fontWeight: 600, fontSize: 14, marginTop: 2 }}>
        {value}{value !== "—" && suffix ? <span style={{ fontSize: 10, color: MUTED, marginLeft: 2 }}>{suffix}</span> : null}
      </div>
    </div>
  );
}

function BlockList({ label, items, color }: { label: string; items: string[]; color?: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="gos-label" style={{ color: color ?? undefined }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
