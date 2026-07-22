import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Save, Trash2, Trophy, XCircle, Filter, Package } from "lucide-react";

type Offer = {
  id: string; client_id: string; objective_id: string | null;
  offer_name: string; offer_type: string; description: string | null; hook: string | null;
  channel: string | null; landing_url: string | null;
  reference_price: number | null; offer_price: number | null; cost: number | null;
  discount_pct: number | null; guarantee: string | null; bonus: string | null; urgency: string | null;
  test_start: string | null; test_end: string | null;
  visitors: number; add_to_carts: number; conversions: number;
  revenue: number; spend: number; refunds: number;
  status: string; verdict: string | null; learning: string | null; replay_hypothesis: string | null;
  tags: string[];
};
type Objective = { id: string; label: string };

const CARD = "rgba(255, 255, 255, 0.02)";
const BG_DEEP = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";
const YELLOW = "#f5b74e";

const OFFER_TYPES = ["discount","bundle","bogo","freeshipping","guarantee","upsell","subscription","tripwire","gift","payment_plan"];
const STATUSES = ["draft","live","paused","winner","loser","archived"];
const STATUS_COLOR: Record<string, string> = {
  draft: MUTED, live: BLUE, paused: YELLOW, winner: GREEN, loser: RED, archived: MUTED,
};

const eur = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
const pct = (n: number) => (n * 100).toFixed(2) + "%";

export default function OfferLab() {
  const { clientId } = useParams();
  const { selectedClient } = useSelectedClient();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [o, obj] = await Promise.all([
      (supabase as any).from("gos_offer_lab").select("*").eq("client_id", clientId).order("test_start", { ascending: false, nullsFirst: false }),
      supabase.from("gos_business_objectives").select("id,label").eq("client_id", clientId).eq("status", "active"),
    ]);
    setOffers((o.data ?? []) as Offer[]);
    setObjectives((obj.data ?? []) as Objective[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const addOffer = async () => {
    if (!clientId) return;
    const { error } = await (supabase as any).from("gos_offer_lab").insert({
      client_id: clientId, offer_name: "Nouvelle offre", offer_type: "discount", status: "draft",
      visitors: 0, add_to_carts: 0, conversions: 0, revenue: 0, spend: 0, refunds: 0, tags: [],
    });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: Partial<Offer>) =>
    setOffers(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));

  const save = async (o: Offer) => {
    const { id, client_id, ...rest } = o;
    const { error } = await (supabase as any).from("gos_offer_lab").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sauvegardé");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette offre ?")) return;
    const { error } = await (supabase as any).from("gos_offer_lab").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setOffers(prev => prev.filter(o => o.id !== id));
  };

  const derived = (o: Offer) => {
    const cvr = o.visitors > 0 ? o.conversions / o.visitors : 0;
    const atc = o.visitors > 0 ? o.add_to_carts / o.visitors : 0;
    const cartCvr = o.add_to_carts > 0 ? o.conversions / o.add_to_carts : 0;
    const aov = o.conversions > 0 ? o.revenue / o.conversions : 0;
    const unitMargin = (o.offer_price ?? 0) - (o.cost ?? 0);
    const marginPct = o.offer_price ? unitMargin / o.offer_price : 0;
    const netRevenue = o.revenue - (o.refunds * aov);
    const roas = o.spend > 0 ? o.revenue / o.spend : 0;
    return { cvr, atc, cartCvr, aov, unitMargin, marginPct, netRevenue, roas };
  };

  const view = filter === "all" ? offers : offers.filter(o => o.status === filter);

  const stats = useMemo(() => {
    const winners = offers.filter(o => o.status === "winner").length;
    const live = offers.filter(o => o.status === "live").length;
    const revenue = offers.reduce((s, o) => s + Number(o.revenue || 0), 0);
    const conv = offers.reduce((s, o) => s + Number(o.conversions || 0), 0);
    const vis = offers.reduce((s, o) => s + Number(o.visitors || 0), 0);
    return { total: offers.length, winners, live, revenue, avgCvr: vis > 0 ? conv / vis : 0 };
  }, [offers]);

  if (!selectedClient) {
    return <EmptyState title="Aucun client sélectionné" hint="Choisis un client pour accéder à l'Offer Lab." />;
  }

  const inp: React.CSSProperties = {
    background: BG_DEEP, border: `1px solid ${BORDER}`, color: "var(--tdia-text)",
    padding: "8px 10px", borderRadius: 6, fontSize: 13, width: "100%",
  };
  const lbl: React.CSSProperties = { fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 4, display: "block" };

  return (
    <div>
      <SectionHeader title="Offer Lab" subtitle="Bibliothèque d'offres testées : conversion, AOV, marge, verdict" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total offres", value: stats.total, color: BLUE },
          { label: "Live", value: stats.live, color: BLUE },
          { label: "Winners", value: stats.winners, color: GREEN },
          { label: "Revenue cumulé", value: eur(stats.revenue), color: "var(--tdia-text)" },
          { label: "CVR moyen", value: pct(stats.avgCvr), color: YELLOW },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Filter size={14} color={MUTED} />
          <select style={{ ...inp, width: "auto" }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Toutes</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={addOffer} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nouvelle offre
        </button>
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Chargement…</div>
      ) : view.length === 0 ? (
        <EmptyState title="Aucune offre encore" hint="Documente ta première offre pour comparer conversion, AOV et marge." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {view.map(o => {
            const d = derived(o);
            const expanded = expandedId === o.id;
            return (
              <div key={o.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                  style={{ padding: 14, display: "grid", gridTemplateColumns: "auto 1fr repeat(5, 90px) auto auto", gap: 12, alignItems: "center", cursor: "pointer" }}
                >
                  <Package size={18} color={BLUE} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--tdia-text)" }}>{o.offer_name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {o.offer_type.toUpperCase()} · {o.channel ?? "—"} · {o.test_start ?? "—"}
                    </div>
                  </div>
                  {[
                    { l: "CVR", v: pct(d.cvr), c: d.cvr >= 0.03 ? GREEN : d.cvr >= 0.015 ? YELLOW : RED },
                    { l: "AOV", v: eur(d.aov), c: "white" },
                    { l: "Marge %", v: pct(d.marginPct), c: d.marginPct >= 0.4 ? GREEN : d.marginPct >= 0.2 ? YELLOW : RED },
                    { l: "ROAS", v: d.roas.toFixed(2), c: d.roas >= 2 ? GREEN : d.roas >= 1 ? YELLOW : RED },
                    { l: "Revenue", v: eur(o.revenue), c: "white" },
                  ].map(k => (
                    <div key={k.l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: MUTED }}>{k.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: k.c }}>{k.v}</div>
                    </div>
                  ))}
                  <span style={{ padding: "3px 10px", borderRadius: 999, background: STATUS_COLOR[o.status] + "22", color: STATUS_COLOR[o.status], fontSize: 11, fontWeight: 700 }}>
                    {o.status.toUpperCase()}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); del(o.id); }} style={{ background: "transparent", border: "none", color: RED, cursor: "pointer" }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                {expanded && (
                  <div style={{ padding: 16, borderTop: `1px solid ${BORDER}`, display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
                      <div><label style={lbl}>Nom</label><input style={inp} value={o.offer_name} onChange={e => update(o.id, { offer_name: e.target.value })} /></div>
                      <div><label style={lbl}>Type</label>
                        <select style={inp} value={o.offer_type} onChange={e => update(o.id, { offer_type: e.target.value })}>
                          {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Statut</label>
                        <select style={inp} value={o.status} onChange={e => update(o.id, { status: e.target.value })}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Objectif business</label>
                        <select style={inp} value={o.objective_id ?? ""} onChange={e => update(o.id, { objective_id: e.target.value || null })}>
                          <option value="">—</option>
                          {objectives.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={lbl}>Description</label>
                        <textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={o.description ?? ""} onChange={e => update(o.id, { description: e.target.value })} />
                      </div>
                      <div><label style={lbl}>Hook / accroche</label>
                        <textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={o.hook ?? ""} onChange={e => update(o.id, { hook: e.target.value })} />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                      <div><label style={lbl}>Canal</label><input style={inp} value={o.channel ?? ""} onChange={e => update(o.id, { channel: e.target.value })} /></div>
                      <div><label style={lbl}>Landing URL</label><input style={inp} value={o.landing_url ?? ""} onChange={e => update(o.id, { landing_url: e.target.value })} /></div>
                      <div><label style={lbl}>Test start</label><input type="date" style={inp} value={o.test_start ?? ""} onChange={e => update(o.id, { test_start: e.target.value || null })} /></div>
                      <div><label style={lbl}>Test end</label><input type="date" style={inp} value={o.test_end ?? ""} onChange={e => update(o.id, { test_end: e.target.value || null })} /></div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                      <div><label style={lbl}>Prix référence</label><input type="number" style={inp} value={o.reference_price ?? ""} onChange={e => update(o.id, { reference_price: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                      <div><label style={lbl}>Prix offre</label><input type="number" style={inp} value={o.offer_price ?? ""} onChange={e => update(o.id, { offer_price: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                      <div><label style={lbl}>Coût produit</label><input type="number" style={inp} value={o.cost ?? ""} onChange={e => update(o.id, { cost: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                      <div><label style={lbl}>Remise %</label><input type="number" style={inp} value={o.discount_pct ?? ""} onChange={e => update(o.id, { discount_pct: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                      <div><label style={lbl}>Garantie</label><input style={inp} placeholder="30j satisfait/remboursé" value={o.guarantee ?? ""} onChange={e => update(o.id, { guarantee: e.target.value })} /></div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={lbl}>Bonus</label><input style={inp} value={o.bonus ?? ""} onChange={e => update(o.id, { bonus: e.target.value })} /></div>
                      <div><label style={lbl}>Urgence / scarcity</label><input style={inp} value={o.urgency ?? ""} onChange={e => update(o.id, { urgency: e.target.value })} /></div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                      <div><label style={lbl}>Visiteurs</label><input type="number" style={inp} value={o.visitors} onChange={e => update(o.id, { visitors: Number(e.target.value) || 0 })} /></div>
                      <div><label style={lbl}>Add to cart</label><input type="number" style={inp} value={o.add_to_carts} onChange={e => update(o.id, { add_to_carts: Number(e.target.value) || 0 })} /></div>
                      <div><label style={lbl}>Conversions</label><input type="number" style={inp} value={o.conversions} onChange={e => update(o.id, { conversions: Number(e.target.value) || 0 })} /></div>
                      <div><label style={lbl}>Revenue</label><input type="number" style={inp} value={o.revenue} onChange={e => update(o.id, { revenue: Number(e.target.value) || 0 })} /></div>
                      <div><label style={lbl}>Spend</label><input type="number" style={inp} value={o.spend} onChange={e => update(o.id, { spend: Number(e.target.value) || 0 })} /></div>
                      <div><label style={lbl}>Refunds (nb)</label><input type="number" style={inp} value={o.refunds} onChange={e => update(o.id, { refunds: Number(e.target.value) || 0 })} /></div>
                    </div>

                    <div style={{ background: BG_DEEP, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                      {[
                        { l: "CVR", v: pct(d.cvr) },
                        { l: "ATC rate", v: pct(d.atc) },
                        { l: "Cart→Order", v: pct(d.cartCvr) },
                        { l: "AOV", v: eur(d.aov) },
                        { l: "Marge €/unit", v: eur(d.unitMargin) },
                        { l: "Marge %", v: pct(d.marginPct) },
                        { l: "ROAS", v: d.roas.toFixed(2) },
                      ].map(k => (
                        <div key={k.l} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: MUTED }}>{k.l}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tdia-text)", marginTop: 2 }}>{k.v}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={lbl}><Trophy size={11} style={{ display: "inline", marginRight: 4 }} />Verdict</label>
                        <textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={o.verdict ?? ""} onChange={e => update(o.id, { verdict: e.target.value })} />
                      </div>
                      <div><label style={lbl}>Apprentissage clé</label>
                        <textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={o.learning ?? ""} onChange={e => update(o.id, { learning: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Hypothèse de replay (comment on itère ?)</label>
                      <textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={o.replay_hypothesis ?? ""} onChange={e => update(o.id, { replay_hypothesis: e.target.value })} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => save(o)} className="gos-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
