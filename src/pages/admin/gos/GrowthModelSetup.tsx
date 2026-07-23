import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, StatusBadge, EmptyState, SetupStatus } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { MarkBlockDoneButton } from "@/gos/workflow";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

type Block = "business_context" | "financial_inputs" | "products" | "inventory" | "quantitative_baseline" | "basket_economics";

const BLOCK_META: Record<Block, { title: string; why: string }> = {
  business_context:      { title: "A. Contexte business",         why: "Définit l'objectif client, le marché, les produits prioritaires, les contraintes et les risques." },
  financial_inputs:      { title: "B. Données financières / Unit economics", why: "Définit marge, COGS, taux de remboursement et cibles CAC/MER (ou CPL/taux de closing)." },
  products:              { title: "C. Profil produits / SKU ou services", why: "Définit les produits/services à pousser, éviter, mettre en avant, bundles, upsells." },
  inventory:             { title: "D. Stock ou capacité",           why: "Niveaux de stock & réappro (ou capacité hebdo & temps de réponse) pour scaler sans risque." },
  quantitative_baseline: { title: "E. Baseline quantitative",       why: "Revenu / spend / CAC / MER / AOV / CVR sur 30 jours (ou leads/jobs/taux de closing)." },
  basket_economics:      { title: "F. Économie du panier (PFMB)",  why: "AOV new/repeat, CAC new/repeat, cycle de rachat, churn, stock, délai payout — débloque le moteur Profit-First Media Buying." },
};

// Fields required for each block to reach READY.
function isReady(block: Block, row: any, businessType: string): boolean {
  if (!row) return false;
  const isEcom = businessType === "ECOMMERCE" || businessType === "HYBRID";
  const isLocal = businessType === "LOCAL_SERVICE" || businessType === "HYBRID";
  switch (block) {
    case "business_context":
      return !!(row.goal_lock && row.three_month_objective && row.north_star_kpi && row.success_definition);
    case "financial_inputs":
      if (isEcom) return row.aov != null && row.gross_margin_percent != null && row.target_cac != null && row.target_mer != null;
      if (isLocal) return row.avg_job_value != null && row.gross_margin_percent != null && row.target_cpl != null && row.target_close_rate != null;
      return false;
    case "quantitative_baseline":
      if (isEcom) return row.revenue_30d != null && row.ad_spend_30d != null && row.orders_30d != null;
      if (isLocal) return row.leads_30d != null && row.ad_spend_30d != null && row.jobs_closed_30d != null;
      return false;
    case "basket_economics":
      return row.aov_new != null && row.aov_repeat != null && row.cac_new != null && row.cac_repeat != null
        && row.conversion_rate != null && row.repeat_cycle_months != null && row.churn_per_cycle != null
        && row.inventory_days != null && row.payout_delay_days != null;
    default:
      return true;
  }
}

export default function GrowthModelSetup() {
  const { clientId } = useParams();
  const nav = useNavigate();
  const { setSelectedClient } = useSelectedClient();
  const [client, setClient] = useState<any>(null);
  const [bc, setBc] = useState<any>(null);
  const [fi, setFi] = useState<any>(null);
  const [qb, setQb] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [inv, setInv] = useState<any[]>([]);
  const [cap, setCap] = useState<any[]>([]);
  const [be, setBe] = useState<any>(null);
  const [active, setActive] = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data: c } = await supabase.from("gos_clients").select("*").eq("id", clientId).single();
    if (c) { setClient(c); setSelectedClient(c as any); }
    const [b, f, q, p, s, i, ca, bx] = await Promise.all([
      supabase.from("gos_business_contexts").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_quantitative_baselines").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("gos_products").select("*").eq("client_id", clientId),
      supabase.from("gos_services").select("*").eq("client_id", clientId),
      supabase.from("gos_inventory_snapshots").select("*").eq("client_id", clientId),
      supabase.from("gos_capacity_snapshots").select("*").eq("client_id", clientId),
      supabase.from("gos_basket_economics").select("*").eq("client_id", clientId).maybeSingle(),
    ]);
    setBc(b.data); setFi(f.data); setQb(q.data);
    setProducts(p.data ?? []); setServices(s.data ?? []);
    setInv(i.data ?? []); setCap(ca.data ?? []);
    setBe(bx.data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  if (loading || !client) return <div style={{ height: 300, background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }} />;

  const isEcom = client.business_type === "ECOMMERCE" || client.business_type === "HYBRID";
  const isLocal = client.business_type === "LOCAL_SERVICE" || client.business_type === "HYBRID";

  const blockStatuses: Record<Block, SetupStatus> = {
    business_context: (bc?.status as SetupStatus) ?? (bc ? "MISSING_INPUTS" : "NOT_STARTED"),
    financial_inputs: (fi?.status as SetupStatus) ?? (fi ? "MISSING_INPUTS" : "NOT_STARTED"),
    products: (isEcom ? products.length : services.length) > 0 ? "READY" : "NOT_STARTED",
    inventory: (isEcom ? inv.length : cap.length) > 0 ? "READY" : "NOT_STARTED",
    quantitative_baseline: (qb?.status as SetupStatus) ?? (qb ? "MISSING_INPUTS" : "NOT_STARTED"),
    basket_economics: isReady("basket_economics", be, client.business_type) ? "READY" : (be ? "MISSING_INPUTS" : "NOT_STARTED"),
  };

  const ordered: Block[] = ["business_context","financial_inputs","products","inventory","quantitative_baseline","basket_economics"];
  const totalBlocks = ordered.length;
  const completed = Object.values(blockStatuses).filter((s) => s === "READY" || s === "APPROVED").length;
  const nextStep = ordered.find((k) => blockStatuses[k] !== "READY" && blockStatuses[k] !== "APPROVED");
  const current: Block = active ?? nextStep ?? "business_context";
  const letters = ["A","B","C","D","E","F"];

  const isDone = (s: SetupStatus) => s === "READY" || s === "APPROVED";

  return (
    <div>
      <SectionHeader
        guide={{
          purpose: "Saisir les 6 blocs de données business dont dépendent toutes les engines en aval.",
          dataSource: "Saisie manuelle par l'AM à partir des données financières, produits/services et performance 30 jours du client.",
          usedBy: "Diagnostic · Prévisions · Objectifs de métriques · Pouvoir de dépense · Profit-First Media Buying · Besoin en créatifs · Optimisation live.",
          requiredInputs: ["Contexte business", "Données financières / Unit economics", isEcom ? "Produits" : "Services", isEcom ? "Stock" : "Capacité", "Baseline quantitative", "Économie du panier (PFMB)"],
          missingInputs: ordered.filter((k) => !isDone(blockStatuses[k])).map((k) => BLOCK_META[k].title.replace(/^[A-F]\. /, "")),
          nextStep: nextStep ? `Complète "${BLOCK_META[nextStep].title}" — c'est ce qui bloque le diagnostic.` : "Tous les blocs sont prêts — lance le Diagnostic de croissance.",
          primaryCta: nextStep ? "Éditer le prochain bloc" : "Lancer le diagnostic",
        }}
        title="Configuration du modèle de croissance"
        subtitle={`${client.company_name} — saisis les données business requises avant de lancer diagnostic, prévisions et modèles de prédiction.`}
        actions={
          <>
            <button className="gos-btn-secondary" onClick={() => nav(`/admin/gos/clients/${client.id}/workspace`)}>
              <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Retour à l'espace client
            </button>
            <MarkBlockDoneButton clientId={clientId} blockKey="setup" label="Marquer configuration terminée" disabled={completed !== totalBlocks} />
          </>
        }
      />

      <div className="gos-card" style={{ marginBottom: 24 }} data-tour="setup-status">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>Statut global</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: "var(--tdia-text)" }}>
              {completed === totalBlocks ? "PRÊT POUR LE DIAGNOSTIC" : "INCOMPLET"}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 6 }}>
              <span>Progression</span>
              <span>{completed} / {totalBlocks}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(148, 170, 215, 0.12)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(completed / totalBlocks) * 100}%`, background: "var(--tdia-primary, #4f8cff)", transition: "width .3s" }} />
            </div>
          </div>
          <div style={{ maxWidth: 260 }}>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>Prochaine étape</div>
            <div style={{ marginTop: 4, color: "var(--tdia-text)", fontWeight: 500 }}>
              {nextStep ? BLOCK_META[nextStep].title : "Tous les blocs sont prêts."}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 20, alignItems: "start" }} data-tour="setup-blocks">
        {/* Stepper vertical */}
        <div className="gos-card" style={{ padding: 16, position: "sticky", top: 16 }}>
          <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 14, paddingLeft: 4 }}>
            Blocs de configuration
          </div>
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 19, top: 16, bottom: 16, width: 2, background: "rgba(148, 170, 215, 0.12)", zIndex: 0 }} />
            {ordered.map((k, idx) => {
              const status = blockStatuses[k];
              const done = isDone(status);
              const isCurrent = k === current;
              const isNext = k === nextStep;
              return (
                <button
                  key={k}
                  onClick={() => { setActive(k); if (k !== active) load(); }}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    width: "100%",
                    padding: "10px 10px",
                    marginBottom: idx === ordered.length - 1 ? 0 : 4,
                    background: isCurrent ? "rgba(255, 255, 255, 0.02)" : "transparent",
                    border: isCurrent ? "1px solid rgba(148, 170, 215, 0.12)" : "1px solid transparent",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.04)"; }}
                  onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14,
                    background: done ? "var(--tdia-primary, #4f8cff)" : isCurrent ? "rgba(148, 170, 215, 0.12)" : "rgba(255, 255, 255, 0.02)",
                    color: done ? "#fff" : "var(--tdia-text)",
                    border: `2px solid ${done ? "var(--tdia-primary, #4f8cff)" : isCurrent ? "var(--tdia-primary, #4f8cff)" : "rgba(148, 170, 215, 0.12)"}`,
                  }}>
                    {done ? "✓" : letters[idx]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tdia-text)", lineHeight: 1.3 }}>
                      {BLOCK_META[k].title.replace(/^[A-F]\. /, "")}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <StatusBadge status={status} />
                      {isNext && !isCurrent && (
                        <span style={{ fontSize: 10, color: "var(--tdia-primary, #4f8cff)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          · À faire
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: form */}
        <div>
          <div style={{ marginBottom: 12, color: "var(--tdia-muted)", fontSize: 13 }}>
            {BLOCK_META[current].why}
          </div>
          {current === "business_context" && <BusinessContextForm clientId={client.id} row={bc} products={products} onSaved={load} />}
          {current === "financial_inputs" && <FinancialInputsForm clientId={client.id} businessType={client.business_type} row={fi} onSaved={load} />}
          {current === "products" && (isEcom ? <ProductsForm clientId={client.id} rows={products} onSaved={load} /> : <ServicesForm clientId={client.id} rows={services} onSaved={load} />)}
          {current === "inventory" && (isEcom ? <InventoryForm clientId={client.id} products={products} rows={inv} onSaved={load} /> : <CapacityForm clientId={client.id} services={services} rows={cap} onSaved={load} />)}
          {current === "quantitative_baseline" && <BaselineForm clientId={client.id} businessType={client.business_type} row={qb} onSaved={load} />}
          {current === "basket_economics" && <BasketEconomicsForm clientId={client.id} row={be} qbRow={qb} fiRow={fi} onSaved={load} />}

          {/* Prev / Next nav */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
            {(() => {
              const idx = ordered.indexOf(current);
              const prev = idx > 0 ? ordered[idx - 1] : null;
              const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;
              return (
                <>
                  <button className="gos-btn-secondary" disabled={!prev} onClick={() => prev && (setActive(prev), load())} style={{ opacity: prev ? 1 : 0.4 }}>
                    <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {prev ? BLOCK_META[prev].title.replace(/^[A-F]\. /, "") : "Précédent"}
                  </button>
                  <button className="gos-btn-primary" disabled={!next} onClick={() => next && (setActive(next), load())} style={{ opacity: next ? 1 : 0.4 }}>
                    {next ? `Suivant : ${BLOCK_META[next].title.replace(/^[A-F]\. /, "")}` : "Dernier bloc"}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Forms ----------

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gos-card">
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "var(--tdia-text)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>{children}</div>;
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="gos-label">{label}</label>{children}</div>;
}

const NORTH_STAR_KPI_OPTIONS = [
  { value: "revenue", label: "Revenue (chiffre d'affaires)" },
  { value: "net_profit", label: "Net Profit (profit net)" },
  { value: "mer", label: "MER (Media Efficiency Ratio)" },
  { value: "roas", label: "ROAS (Return on Ad Spend)" },
  { value: "cac", label: "CAC (Coût d'acquisition client)" },
  { value: "ltv_cac", label: "LTV:CAC ratio" },
  { value: "aov", label: "AOV (Panier moyen)" },
  { value: "cvr", label: "CVR (Taux de conversion)" },
  { value: "cpl", label: "CPL (Coût par lead)" },
  { value: "close_rate", label: "Close Rate (taux de closing)" },
  { value: "gross_margin", label: "Gross Margin %" },
  { value: "contribution_margin", label: "Contribution Margin" },
  { value: "repeat_rate", label: "Repeat Purchase Rate" },
];

function MultiProductSelect({ value, onChange, products, placeholder }: { value: string; onChange: (v: string) => void; products: any[]; placeholder?: string }) {
  const selected = (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name];
    onChange(next.join(", "));
  };
  if (!products || products.length === 0) {
    return (
      <div>
        <input className="gos-input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Aucun produit synchronisé — saisir manuellement"} />
        <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 4 }}>Connecte Shopify et lance une synchro pour sélectionner depuis la liste.</div>
      </div>
    );
  }
  return (
    <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid rgba(148, 170, 215, 0.12)", borderRadius: 8, padding: 8, background: "rgba(255, 255, 255, 0.02)" }}>
      {products.map((p) => {
        const name = p.product_name || p.sku;
        const checked = selected.includes(name);
        return (
          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", cursor: "pointer", fontSize: 13, color: "var(--tdia-text)" }}>
            <input type="checkbox" checked={checked} onChange={() => toggle(name)} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            {p.sku && <span style={{ fontSize: 10, color: "var(--tdia-muted)" }}>{p.sku}</span>}
          </label>
        );
      })}
    </div>
  );
}

function BusinessContextForm({ clientId, row, products, onSaved }: any) {
  const [f, setF] = useState<any>(row ?? {});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const ready = !!(f.goal_lock && f.three_month_objective && f.north_star_kpi && f.success_definition);
    const payload = { ...f, client_id: clientId, status: ready ? "READY" : "MISSING_INPUTS" };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const { error } = row
      ? await supabase.from("gos_business_contexts").update(payload).eq("id", row.id)
      : await supabase.from("gos_business_contexts").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); onSaved(); }
  };

  return (
    <FormCard title="Contexte business">
      <Grid>
        <F label="Goal Lock"><input className="gos-input" value={f.goal_lock ?? ""} onChange={(e) => set("goal_lock", e.target.value)} /></F>
        <F label="3-Month Objective"><input className="gos-input" value={f.three_month_objective ?? ""} onChange={(e) => set("three_month_objective", e.target.value)} placeholder="e.g. 65k$/mo → 100k$/mo in 90 days" /></F>
        <F label="Target Market"><input className="gos-input" value={f.target_market ?? ""} onChange={(e) => set("target_market", e.target.value)} /></F>
        <F label="North Star KPI">
          <select className="gos-input" value={f.north_star_kpi ?? ""} onChange={(e) => set("north_star_kpi", e.target.value)}>
            <option value="">— Sélectionne un KPI —</option>
            {NORTH_STAR_KPI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </F>
      </Grid>
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label={`Produits à pousser ${products?.length ? `(${products.length} dispo)` : ""}`}>
          <MultiProductSelect value={f.product_to_push ?? ""} onChange={(v) => set("product_to_push", v)} products={products ?? []} />
        </F>
        <F label="Produits à éviter">
          <MultiProductSelect value={f.product_to_avoid ?? ""} onChange={(v) => set("product_to_avoid", v)} products={products ?? []} />
        </F>
      </div>
      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <F label="Business Constraints"><textarea className="gos-textarea" rows={2} value={f.business_constraints ?? ""} onChange={(e) => set("business_constraints", e.target.value)} /></F>
        <F label="Operational Constraints"><textarea className="gos-textarea" rows={2} value={f.operational_constraints ?? ""} onChange={(e) => set("operational_constraints", e.target.value)} /></F>
        <F label="Claims / Legal Constraints"><textarea className="gos-textarea" rows={2} value={f.claims_legal_constraints ?? ""} onChange={(e) => set("claims_legal_constraints", e.target.value)} /></F>
        <F label="Known Risks"><textarea className="gos-textarea" rows={2} value={f.known_risks ?? ""} onChange={(e) => set("known_risks", e.target.value)} /></F>
        <F label="Success Definition"><textarea className="gos-textarea" rows={2} value={f.success_definition ?? ""} onChange={(e) => set("success_definition", e.target.value)} /></F>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="gos-btn-primary" onClick={save} disabled={saving}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </FormCard>
  );
}

// Compute Meta-derived values from measurement snapshots (CSV imports).
// Reads snapshots imported via AdFileUpload where notes JSON contains platform="meta_ads".
// Filters by created_at (upload date) — the CSV's period_start may fall outside the 30-day
// window (e.g., a 30-day report starting 32 days ago) even when the data was just uploaded.
async function deriveFromMeta(clientId: string) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("gos_measurement_snapshots")
    .select("actual_ad_spend, actual_revenue, actual_orders, actual_roas, notes, created_at, period_start, period_end")
    .eq("client_id", clientId)
    .gte("created_at", since)
    .like("notes", '%"platform":"meta_ads"%')
    .order("created_at", { ascending: false });
  if (error) console.error("[deriveFromMeta] query error:", error.message);
  const snaps = data ?? [];
  const spend = snaps.reduce((s, r) => s + Number(r.actual_ad_spend || 0), 0);
  const revenue = snaps.reduce((s, r) => s + Number(r.actual_revenue || 0), 0);
  const orders = snaps.reduce((s, r) => s + Number(r.actual_orders || 0), 0);
  let activeAds = 0;
  for (const r of snaps) {
    try {
      const meta = JSON.parse((r as { notes?: string }).notes ?? "{}");
      if (typeof meta.active_count === "number") activeAds += meta.active_count;
    } catch { /* ignore malformed notes */ }
  }
  const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : null;
  const cpa = orders > 0 ? Number((spend / orders).toFixed(2)) : null;
  return {
    ad_spend_30d: snaps.length ? Number(spend.toFixed(2)) : null,
    meta_revenue_30d: snaps.length ? Number(revenue.toFixed(2)) : null,
    meta_orders_30d: snaps.length ? orders : null,
    roas_30d: roas,
    meta_cpa: cpa,
    active_ads_count: activeAds || null,
    has_data: snaps.length > 0,
  };
}

// Compute Shopify-derived values from measurement snapshots + product profiles
async function deriveFromShopify(clientId: string) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [snapsRes, profilesRes] = await Promise.all([
    supabase
      .from("gos_measurement_snapshots")
      .select("actual_revenue, actual_orders, period_start, notes")
      .eq("client_id", clientId)
      .gte("period_start", since)
      .like("notes", "shopify_api%"),
    supabase
      .from("gos_product_financial_profiles")
      .select("price, product_cost")
      .eq("client_id", clientId),
  ]);
  const snaps = snapsRes.data ?? [];
  const revenue = snaps.reduce((s, r) => s + Number(r.actual_revenue || 0), 0);
  const orders = snaps.reduce((s, r) => s + Number(r.actual_orders || 0), 0);
  const aov = orders > 0 ? Number((revenue / orders).toFixed(2)) : null;
  // Gross margin: only if product_cost is populated in profiles (Shopify rarely has it)
  const profiles = profilesRes.data ?? [];
  const withCost = profiles.filter((p: any) => p.price && p.product_cost != null);
  let grossMarginPct: number | null = null;
  if (withCost.length > 0) {
    const avgMargin =
      withCost.reduce((s: number, p: any) => s + ((Number(p.price) - Number(p.product_cost)) / Number(p.price)) * 100, 0) /
      withCost.length;
    grossMarginPct = Number(avgMargin.toFixed(1));
  }
  return {
    revenue_30d: snaps.length ? Number(revenue.toFixed(2)) : null,
    orders_30d: snaps.length ? orders : null,
    aov,
    gross_margin_percent: grossMarginPct,
    has_data: snaps.length > 0,
  };
}

function FinancialInputsForm({ clientId, businessType, row, onSaved }: any) {
  const [f, setF] = useState<any>(row ?? { business_type: businessType });
  const [saving, setSaving] = useState(false);
  const [derived, setDerived] = useState<any>(null);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v === "" ? null : v }));
  const num = (v: any) => (v == null ? "" : v);
  const isEcom = businessType === "ECOMMERCE" || businessType === "HYBRID";
  const isLocal = businessType === "LOCAL_SERVICE" || businessType === "HYBRID";

  // Auto-derive from Shopify on mount; auto-fill empty fields
  useEffect(() => {
    if (!isEcom) return;
    (async () => {
      const d = await deriveFromShopify(clientId);
      setDerived(d);
      if (!d.has_data) return;
      setF((prev: any) => {
        const next = { ...prev };
        if (next.aov == null && d.aov != null) next.aov = d.aov;
        if (next.gross_margin_percent == null && d.gross_margin_percent != null) next.gross_margin_percent = d.gross_margin_percent;
        // Sensible defaults for Shopify Payments
        if (next.payment_processing_percent == null) next.payment_processing_percent = 2.9;
        return next;
      });
    })();
    // eslint-disable-next-line
  }, [clientId]);

  const autofill = async () => {
    const d = await deriveFromShopify(clientId);
    setDerived(d);
    if (!d.has_data) { toast.error("Aucune donnée Shopify — lance d'abord une synchro."); return; }
    setF((prev: any) => ({
      ...prev,
      aov: d.aov ?? prev.aov,
      gross_margin_percent: d.gross_margin_percent ?? prev.gross_margin_percent,
      payment_processing_percent: prev.payment_processing_percent ?? 2.9,
    }));
    toast.success("Champs auto-remplis depuis Shopify");
  };

  const save = async () => {
    setSaving(true);
    const ready = isEcom
      ? f.aov != null && f.gross_margin_percent != null && f.target_cac != null && f.target_mer != null
      : f.avg_job_value != null && f.gross_margin_percent != null && f.target_cpl != null && f.target_close_rate != null;
    const payload = { ...f, client_id: clientId, business_type: businessType, status: ready ? "READY" : "MISSING_INPUTS" };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    ["aov","gross_margin_percent","cogs_per_order","shipping_cost_per_order","fulfillment_cost_per_order",
     "payment_processing_percent","refund_rate_percent","target_cac","target_mer","target_roas","payback_window_days",
     "desired_contribution_margin_percent","avg_job_value","labor_cost","material_cost","travel_cost","target_cpl",
     "target_cost_per_booked_appointment","target_cost_per_job","target_close_rate"].forEach((k) => {
      if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]);
    });
    const { error } = row
      ? await supabase.from("gos_financial_inputs").update(payload).eq("id", row.id)
      : await supabase.from("gos_financial_inputs").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); onSaved(); }
  };

  const hint = (val: any) => (val != null ? <div style={{ fontSize: 10, color: "var(--tdia-primary, #4f8cff)", marginTop: 2 }}>Auto depuis Shopify</div> : null);

  return (
    <FormCard title="Données financières / Unit economics">
      {isEcom && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", textTransform: "uppercase" }}>E-commerce</div>
            <button className="gos-btn-secondary" type="button" onClick={autofill} style={{ fontSize: 12 }}>
              ⟳ Auto-remplir depuis Shopify
            </button>
          </div>
          {derived && !derived.has_data && (
            <div style={{ fontSize: 12, color: "var(--tdia-muted)", background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 6, marginBottom: 12 }}>
              Aucune donnée Shopify détectée. Connecte l'intégration et lance une synchro pour auto-remplir AOV, marge et % de traitement.
            </div>
          )}
          {derived && derived.has_data && (
            <div style={{ fontSize: 12, color: "var(--tdia-muted)", background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 6, marginBottom: 12 }}>
              Shopify 30j : {derived.revenue_30d ?? 0} € revenue · {derived.orders_30d ?? 0} commandes · AOV {derived.aov ?? "—"} · Marge {derived.gross_margin_percent ?? "n/a (pas de product_cost)"} %
            </div>
          )}
          <Grid>
            <F label="AOV"><input type="number" className="gos-input" value={num(f.aov)} onChange={(e) => set("aov", e.target.value)} />{derived?.aov != null && hint(f.aov)}</F>
            <F label="Gross Margin %"><input type="number" className="gos-input" value={num(f.gross_margin_percent)} onChange={(e) => set("gross_margin_percent", e.target.value)} />{derived?.gross_margin_percent != null && hint(f.gross_margin_percent)}</F>
            <F label="COGS per Order"><input type="number" className="gos-input" value={num(f.cogs_per_order)} onChange={(e) => set("cogs_per_order", e.target.value)} /></F>
            <F label="Shipping / Order"><input type="number" className="gos-input" value={num(f.shipping_cost_per_order)} onChange={(e) => set("shipping_cost_per_order", e.target.value)} /></F>
            <F label="Fulfillment / Order"><input type="number" className="gos-input" value={num(f.fulfillment_cost_per_order)} onChange={(e) => set("fulfillment_cost_per_order", e.target.value)} /></F>
            <F label="Payment Processing %"><input type="number" className="gos-input" value={num(f.payment_processing_percent)} onChange={(e) => set("payment_processing_percent", e.target.value)} />{f.payment_processing_percent === 2.9 && <div style={{ fontSize: 10, color: "var(--tdia-primary, #4f8cff)", marginTop: 2 }}>Défaut Shopify Payments</div>}</F>
            <F label="Refund Rate %"><input type="number" className="gos-input" value={num(f.refund_rate_percent)} onChange={(e) => set("refund_rate_percent", e.target.value)} /></F>
            <F label="Target CAC"><input type="number" className="gos-input" value={num(f.target_cac)} onChange={(e) => set("target_cac", e.target.value)} /></F>
            <F label="MER cible"><input type="number" className="gos-input" value={num(f.target_mer)} onChange={(e) => set("target_mer", e.target.value)} /></F>
            <F label="Target ROAS"><input type="number" className="gos-input" value={num(f.target_roas)} onChange={(e) => set("target_roas", e.target.value)} /></F>
            <F label="Payback Window (days)"><input type="number" className="gos-input" value={num(f.payback_window_days)} onChange={(e) => set("payback_window_days", e.target.value)} /></F>
            <F label="Desired Contribution Margin %"><input type="number" className="gos-input" value={num(f.desired_contribution_margin_percent)} onChange={(e) => set("desired_contribution_margin_percent", e.target.value)} /></F>
          </Grid>
        </>
      )}
      {isLocal && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", textTransform: "uppercase", margin: "20px 0 12px" }}>Local Service</div>
          <Grid>
            <F label="Average Job Value"><input type="number" className="gos-input" value={num(f.avg_job_value)} onChange={(e) => set("avg_job_value", e.target.value)} /></F>
            <F label="Gross Margin %"><input type="number" className="gos-input" value={num(f.gross_margin_percent)} onChange={(e) => set("gross_margin_percent", e.target.value)} /></F>
            <F label="Labor Cost"><input type="number" className="gos-input" value={num(f.labor_cost)} onChange={(e) => set("labor_cost", e.target.value)} /></F>
            <F label="Material Cost"><input type="number" className="gos-input" value={num(f.material_cost)} onChange={(e) => set("material_cost", e.target.value)} /></F>
            <F label="Travel Cost"><input type="number" className="gos-input" value={num(f.travel_cost)} onChange={(e) => set("travel_cost", e.target.value)} /></F>
            <F label="Target CPL"><input type="number" className="gos-input" value={num(f.target_cpl)} onChange={(e) => set("target_cpl", e.target.value)} /></F>
            <F label="Target Cost / Booked Appointment"><input type="number" className="gos-input" value={num(f.target_cost_per_booked_appointment)} onChange={(e) => set("target_cost_per_booked_appointment", e.target.value)} /></F>
            <F label="Target Cost / Job"><input type="number" className="gos-input" value={num(f.target_cost_per_job)} onChange={(e) => set("target_cost_per_job", e.target.value)} /></F>
            <F label="Target Close Rate %"><input type="number" className="gos-input" value={num(f.target_close_rate)} onChange={(e) => set("target_close_rate", e.target.value)} /></F>
          </Grid>
        </>
      )}
      <div style={{ marginTop: 16 }}>
        <button className="gos-btn-primary" onClick={save} disabled={saving}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </FormCard>
  );
}

const PRODUCT_ROLES = ["HERO","BUNDLE","SUBSCRIPTION","UPSELL","LOW_MARGIN","HIGH_MARGIN","SEASONAL","DO_NOT_PUSH","TEST_PRODUCT"];
const SERVICE_ROLES = ["HERO","UPSELL","LOW_MARGIN","HIGH_MARGIN","SEASONAL","DO_NOT_PUSH","TEST_SERVICE"];

function ProductsForm({ clientId, rows, onSaved }: any) {
  const [name, setName] = useState(""); const [sku, setSku] = useState(""); const [price, setPrice] = useState("");
  const [role, setRole] = useState("HERO"); const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name) { toast.error("Product name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("gos_products").insert({
      client_id: clientId, product_name: name, sku: sku || null, price: price ? Number(price) : null, product_role: role,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setName(""); setSku(""); setPrice(""); onSaved(); }
  };

  const del = async (id: string) => {
    await supabase.from("gos_products").delete().eq("id", id);
    onSaved();
  };

  const togglePriority = async (r: any) => {
    await supabase.from("gos_products").update({ is_priority: !r.is_priority }).eq("id", r.id);
    onSaved();
  };
  const toggleAvoid = async (r: any) => {
    await supabase.from("gos_products").update({ is_avoid: !r.is_avoid }).eq("id", r.id);
    onSaved();
  };

  return (
    <FormCard title="Profil produits / SKU">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
        <F label="Product Name"><input className="gos-input" value={name} onChange={(e) => setName(e.target.value)} /></F>
        <F label="SKU"><input className="gos-input" value={sku} onChange={(e) => setSku(e.target.value)} /></F>
        <F label="Price"><input type="number" className="gos-input" value={price} onChange={(e) => setPrice(e.target.value)} /></F>
        <F label="Role"><select className="gos-select" value={role} onChange={(e) => setRole(e.target.value)}>{PRODUCT_ROLES.map((r) => <option key={r}>{r}</option>)}</select></F>
        <button className="gos-btn-primary" onClick={add} disabled={saving}>Add</button>
      </div>
      {rows.length === 0 ? <EmptyState title="Aucun produit." /> : (
        <table className="gos-table">
          <thead><tr><th>Name</th><th>SKU</th><th>Price</th><th>Role</th><th>Priority</th><th>Avoid</th><th></th></tr></thead>
          <tbody>{rows.map((r: any) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.product_name}</td>
              <td>{r.sku ?? "—"}</td>
              <td>{r.price ?? "—"}</td>
              <td>{r.product_role ?? "—"}</td>
              <td><input type="checkbox" checked={r.is_priority} onChange={() => togglePriority(r)} /></td>
              <td><input type="checkbox" checked={r.is_avoid} onChange={() => toggleAvoid(r)} /></td>
              <td><button className="gos-btn-secondary" onClick={() => del(r.id)}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </FormCard>
  );
}

function ServicesForm({ clientId, rows, onSaved }: any) {
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const [role, setRole] = useState("HERO"); const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name) { toast.error("Service name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("gos_services").insert({
      client_id: clientId, service_name: name, avg_price: price ? Number(price) : null, service_role: role,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setName(""); setPrice(""); onSaved(); }
  };

  return (
    <FormCard title="Profil services">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
        <F label="Service Name"><input className="gos-input" value={name} onChange={(e) => setName(e.target.value)} /></F>
        <F label="Average Price"><input type="number" className="gos-input" value={price} onChange={(e) => setPrice(e.target.value)} /></F>
        <F label="Role"><select className="gos-select" value={role} onChange={(e) => setRole(e.target.value)}>{SERVICE_ROLES.map((r) => <option key={r}>{r}</option>)}</select></F>
        <button className="gos-btn-primary" onClick={add} disabled={saving}>Add</button>
      </div>
      {rows.length === 0 ? <EmptyState title="Aucun service." /> : (
        <table className="gos-table">
          <thead><tr><th>Name</th><th>Price</th><th>Role</th><th></th></tr></thead>
          <tbody>{rows.map((r: any) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.service_name}</td>
              <td>{r.avg_price ?? "—"}</td>
              <td>{r.service_role ?? "—"}</td>
              <td><button className="gos-btn-secondary" onClick={async () => { await supabase.from("gos_services").delete().eq("id", r.id); onSaved(); }}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </FormCard>
  );
}

const RISK_OPTIONS = ["LOW","MEDIUM","HIGH","CRITICAL"];

function InventoryForm({ clientId, products, rows, onSaved }: any) {
  const [productId, setProductId] = useState(""); const [stock, setStock] = useState(""); const [velocity, setVelocity] = useState("");
  const [risk, setRisk] = useState("LOW"); const [safe, setSafe] = useState(true); const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!productId) { toast.error("Select a product"); return; }
    setSaving(true);
    const { error } = await supabase.from("gos_inventory_snapshots").insert({
      client_id: clientId, product_id: productId,
      available_stock: stock ? Number(stock) : null,
      daily_sales_velocity: velocity ? Number(velocity) : null,
      inventory_risk: risk, safe_to_scale: safe,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setStock(""); setVelocity(""); onSaved(); }
  };

  return (
    <FormCard title="Snapshots de stock">
      {products.length === 0 && <div style={{ color: "var(--tdia-muted)", fontSize: 13, marginBottom: 12 }}>Add products first in block C.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
        <F label="Product"><select className="gos-select" value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">—</option>{products.map((p: any) => <option key={p.id} value={p.id}>{p.product_name}</option>)}</select></F>
        <F label="Available Stock"><input type="number" className="gos-input" value={stock} onChange={(e) => setStock(e.target.value)} /></F>
        <F label="Daily Velocity"><input type="number" className="gos-input" value={velocity} onChange={(e) => setVelocity(e.target.value)} /></F>
        <F label="Risque"><select className="gos-select" value={risk} onChange={(e) => setRisk(e.target.value)}>{RISK_OPTIONS.map((r) => <option key={r}>{r}</option>)}</select></F>
        <F label="Safe to Scale"><select className="gos-select" value={String(safe)} onChange={(e) => setSafe(e.target.value === "true")}><option value="true">YES</option><option value="false">NO</option></select></F>
        <button className="gos-btn-primary" onClick={add} disabled={saving || !products.length}>Add</button>
      </div>
      {rows.length === 0 ? <EmptyState title="Aucun snapshot de stock." /> : (
        <table className="gos-table">
          <thead><tr><th>Product</th><th>Stock</th><th>Velocity</th><th>Risk</th><th>Safe</th><th>Date</th></tr></thead>
          <tbody>{rows.map((r: any) => (
            <tr key={r.id}>
              <td>{products.find((p: any) => p.id === r.product_id)?.product_name ?? "—"}</td>
              <td>{r.available_stock ?? "—"}</td>
              <td>{r.daily_sales_velocity ?? "—"}</td>
              <td>{r.inventory_risk ?? "—"}</td>
              <td>{r.safe_to_scale ? "YES" : "NO"}</td>
              <td>{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </FormCard>
  );
}

function CapacityForm({ clientId, services, rows, onSaved }: any) {
  const [serviceId, setServiceId] = useState(""); const [cap, setCap] = useState(""); const [booked, setBooked] = useState("");
  const [rt, setRt] = useState(""); const [risk, setRisk] = useState("LOW"); const [safe, setSafe] = useState(true); const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    const { error } = await supabase.from("gos_capacity_snapshots").insert({
      client_id: clientId, service_id: serviceId || null,
      weekly_capacity: cap ? Number(cap) : null,
      current_booked_capacity: booked ? Number(booked) : null,
      response_time_minutes: rt ? Number(rt) : null,
      capacity_risk: risk, safe_to_scale: safe,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setCap(""); setBooked(""); setRt(""); onSaved(); }
  };

  return (
    <FormCard title="Snapshots de capacité">
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
        <F label="Service"><select className="gos-select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}><option value="">— any —</option>{services.map((s: any) => <option key={s.id} value={s.id}>{s.service_name}</option>)}</select></F>
        <F label="Weekly Capacity"><input type="number" className="gos-input" value={cap} onChange={(e) => setCap(e.target.value)} /></F>
        <F label="Booked"><input type="number" className="gos-input" value={booked} onChange={(e) => setBooked(e.target.value)} /></F>
        <F label="Response (min)"><input type="number" className="gos-input" value={rt} onChange={(e) => setRt(e.target.value)} /></F>
        <F label="Risque"><select className="gos-select" value={risk} onChange={(e) => setRisk(e.target.value)}>{RISK_OPTIONS.map((r) => <option key={r}>{r}</option>)}</select></F>
        <F label="Safe"><select className="gos-select" value={String(safe)} onChange={(e) => setSafe(e.target.value === "true")}><option value="true">YES</option><option value="false">NO</option></select></F>
        <button className="gos-btn-primary" onClick={add} disabled={saving}>Add</button>
      </div>
      {rows.length === 0 ? <EmptyState title="Aucun snapshot de capacité." /> : (
        <table className="gos-table">
          <thead><tr><th>Service</th><th>Capacity</th><th>Booked</th><th>Response</th><th>Risk</th><th>Safe</th></tr></thead>
          <tbody>{rows.map((r: any) => (
            <tr key={r.id}>
              <td>{services.find((s: any) => s.id === r.service_id)?.service_name ?? "—"}</td>
              <td>{r.weekly_capacity ?? "—"}</td>
              <td>{r.current_booked_capacity ?? "—"}</td>
              <td>{r.response_time_minutes ?? "—"}</td>
              <td>{r.capacity_risk ?? "—"}</td>
              <td>{r.safe_to_scale ? "YES" : "NO"}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </FormCard>
  );
}

function BaselineForm({ clientId, businessType, row, onSaved }: any) {
  const [f, setF] = useState<any>(row ?? { business_type: businessType });
  const [saving, setSaving] = useState(false);
  const [derived, setDerived] = useState<any>(null);
  const [metaDerived, setMetaDerived] = useState<any>(null);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v === "" ? null : v }));
  const num = (v: any) => (v == null ? "" : v);
  const isEcom = businessType === "ECOMMERCE" || businessType === "HYBRID";
  const isLocal = businessType === "LOCAL_SERVICE" || businessType === "HYBRID";

  useEffect(() => {
    if (!isEcom) return;
    (async () => {
      const [shop, meta] = await Promise.all([deriveFromShopify(clientId), deriveFromMeta(clientId)]);
      setDerived(shop);
      setMetaDerived(meta);
      setF((prev: any) => {
        const next = { ...prev };
        if (shop.has_data) {
          if (next.revenue_30d == null && shop.revenue_30d != null) next.revenue_30d = shop.revenue_30d;
          if (next.orders_30d == null && shop.orders_30d != null) next.orders_30d = shop.orders_30d;
          if (next.aov_30d == null && shop.aov != null) next.aov_30d = shop.aov;
        }
        if (meta.has_data) {
          if (next.ad_spend_30d == null && meta.ad_spend_30d != null) next.ad_spend_30d = meta.ad_spend_30d;
          if (next.roas_30d == null && meta.roas_30d != null) next.roas_30d = meta.roas_30d;
          if (next.active_ads_count == null && meta.active_ads_count != null) next.active_ads_count = meta.active_ads_count;
        }
        // Blended MER = revenue Shopify / spend Meta (once both present)
        if (next.mer_30d == null && shop.has_data && meta.has_data && meta.ad_spend_30d && shop.revenue_30d) {
          next.mer_30d = Number((shop.revenue_30d / meta.ad_spend_30d).toFixed(2));
        }
        if (!shop.has_data && !meta.has_data) return prev;
        if (next.ad_spend_30d == null && !meta.has_data) next.ad_spend_30d = 0;
        return next;
      });
    })();
    // eslint-disable-next-line
  }, [clientId]);

  const autofill = async () => {
    const [shop, meta] = await Promise.all([deriveFromShopify(clientId), deriveFromMeta(clientId)]);
    setDerived(shop);
    setMetaDerived(meta);
    if (!shop.has_data && !meta.has_data) {
      toast.error("Aucune donnée Shopify ni CSV Meta — lance d'abord une synchro ou importe un CSV Meta.");
      return;
    }
    setF((prev: any) => {
      const next = { ...prev };
      if (shop.has_data) {
        next.revenue_30d = shop.revenue_30d ?? prev.revenue_30d;
        next.orders_30d = shop.orders_30d ?? prev.orders_30d;
        next.aov_30d = shop.aov ?? prev.aov_30d;
      }
      if (meta.has_data) {
        next.ad_spend_30d = meta.ad_spend_30d ?? prev.ad_spend_30d;
        next.roas_30d = meta.roas_30d ?? prev.roas_30d;
        next.active_ads_count = meta.active_ads_count ?? prev.active_ads_count;
      } else if (next.ad_spend_30d == null) {
        next.ad_spend_30d = 0;
      }
      if (shop.has_data && meta.has_data && meta.ad_spend_30d && shop.revenue_30d) {
        next.mer_30d = Number((shop.revenue_30d / meta.ad_spend_30d).toFixed(2));
      }
      return next;
    });
    const parts: string[] = [];
    if (shop.has_data) parts.push("Shopify");
    if (meta.has_data) parts.push("CSV Meta");
    toast.success(`Baseline auto-remplie depuis ${parts.join(" + ")}`);
  };

  const save = async () => {
    setSaving(true);
    const ready = isEcom
      ? f.revenue_30d != null && f.ad_spend_30d != null && f.orders_30d != null
      : f.leads_30d != null && f.ad_spend_30d != null && f.jobs_closed_30d != null;
    const payload: any = { ...f, client_id: clientId, business_type: businessType, status: ready ? "READY" : "MISSING_INPUTS" };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    Object.keys(payload).forEach((k) => {
      if (typeof payload[k] === "string" && payload[k] !== "" && !isNaN(Number(payload[k])) && !["business_type","status","client_id"].includes(k)) {
        payload[k] = Number(payload[k]);
      }
    });
    const { error } = row
      ? await supabase.from("gos_quantitative_baselines").update(payload).eq("id", row.id)
      : await supabase.from("gos_quantitative_baselines").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); onSaved(); }
  };

  const SHOPIFY_KEYS = new Set(["revenue_30d", "orders_30d", "aov_30d"]);
  const META_KEYS = new Set(["ad_spend_30d", "roas_30d", "active_ads_count", "mer_30d"]);
  const ecomFields = [
    ["revenue_30d","Revenue 30d"],["ad_spend_30d","Ad Spend 30d"],["mer_30d","MER 30d"],["cac_30d","CAC 30d"],
    ["roas_30d","ROAS 30d"],["aov_30d","AOV 30d"],["cvr_30d","CVR 30d (%)"],["atc_rate_30d","ATC Rate (%)"],
    ["checkout_rate_30d","Checkout Rate (%)"],["orders_30d","Orders 30d"],["new_customers_30d","New Customers"],
    ["returning_customers_30d","Returning Customers"],["returning_revenue_30d","Returning Revenue"],
    ["top3_ads_spend_share_percent","Top 3 Ads Spend Share %"],["avg_frequency","Avg Frequency"],
    ["new_creatives_last_30d","New Creatives 30d"],["active_ads_count","Active Ads Count"],
  ];
  const localFields = [
    ["leads_30d","Leads 30d"],["qualified_leads_30d","Qualified Leads"],["booked_appointments_30d","Booked Appointments"],
    ["jobs_closed_30d","Jobs Closed"],["ad_spend_30d","Ad Spend 30d"],["cpl_30d","CPL 30d"],
    ["cost_per_booked_appointment","Cost / Booked Appt"],["cost_per_job","Cost / Job"],
    ["show_rate","Show Rate (%)"],["close_rate","Close Rate (%)"],["avg_job_value","Avg Job Value"],
    ["response_time_minutes","Response Time (min)"],["missed_call_rate","Missed Call Rate (%)"],
  ];

  return (
    <FormCard title="Baseline quantitative (30 jours)">
      {isEcom && (<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", textTransform: "uppercase" }}>E-commerce</div>
          <button className="gos-btn-secondary" type="button" onClick={autofill} style={{ fontSize: 12 }}>⟳ Auto-remplir (Shopify + CSV Meta)</button>
        </div>
        {(derived?.has_data || metaDerived?.has_data) && (
          <div style={{ fontSize: 12, color: "var(--tdia-muted)", background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 6, marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {derived?.has_data && (
              <div>Shopify 30j : revenue {derived.revenue_30d ?? 0} · orders {derived.orders_30d ?? 0} · AOV {derived.aov ?? "—"}</div>
            )}
            {metaDerived?.has_data && (
              <div>CSV Meta 30j : spend {metaDerived.ad_spend_30d ?? 0} · revenue {metaDerived.meta_revenue_30d ?? 0} · ROAS {metaDerived.roas_30d ?? "—"} · {metaDerived.active_ads_count ?? 0} pubs actives</div>
            )}
            {!metaDerived?.has_data && derived?.has_data && (
              <div style={{ opacity: 0.7 }}>Aucun CSV Meta importé — ad_spend/ROAS restent manuels. Importe un CSV Meta depuis la page Data Sources pour compléter.</div>
            )}
          </div>
        )}
        <Grid>{ecomFields.map(([k, l]) => (
          <F key={k} label={l}>
            <input type="number" className="gos-input" value={num(f[k])} onChange={(e) => set(k, e.target.value)} />
            {SHOPIFY_KEYS.has(k) && f[k] != null && <div style={{ fontSize: 10, color: "var(--tdia-primary, #4f8cff)", marginTop: 2 }}>Auto depuis Shopify</div>}
            {META_KEYS.has(k) && f[k] != null && metaDerived?.has_data && <div style={{ fontSize: 10, color: "#0866FF", marginTop: 2 }}>Auto depuis CSV Meta</div>}
          </F>
        ))}</Grid>
      </>)}
      {isLocal && (<>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tdia-muted)", textTransform: "uppercase", margin: "20px 0 12px" }}>Local Service</div>
        <Grid>{localFields.map(([k, l]) => <F key={k} label={l}><input type="number" className="gos-input" value={num(f[k])} onChange={(e) => set(k, e.target.value)} /></F>)}</Grid>
      </>)}
      <div style={{ marginTop: 16 }}>
        <button className="gos-btn-primary" onClick={save} disabled={saving}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </FormCard>
  );
}

// ---------- Basket Economics (PFMB) ----------
function BasketEconomicsForm({ clientId, row, qbRow, fiRow, onSaved }: any) {
  const [f, setF] = useState<any>(row ?? {});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v === "" ? null : v }));
  const num = (v: any) => (v == null ? "" : v);

  // Prefill helpers from other blocks
  const prefill = () => {
    setF((prev: any) => {
      const next = { ...prev };
      // aov_new depuis financial_inputs.aov ou baseline aov_30d
      const aov = fiRow?.aov ?? qbRow?.aov_30d ?? null;
      if (next.aov_new == null && aov != null) next.aov_new = Number(aov);
      if (next.aov_repeat == null && aov != null) next.aov_repeat = Number((Number(aov) * 1.1).toFixed(2));
      // cac_new depuis fi.target_cac ou baseline cac_30d
      const cac = qbRow?.cac_30d ?? fiRow?.target_cac ?? null;
      if (next.cac_new == null && cac != null) next.cac_new = Number(cac);
      if (next.cac_repeat == null) next.cac_repeat = 8;
      // conversion_rate depuis baseline cvr_30d (déjà en %, on divise)
      if (next.conversion_rate == null && qbRow?.cvr_30d != null) {
        next.conversion_rate = Number((Number(qbRow.cvr_30d) / 100).toFixed(4));
      }
      if (next.repeat_cycle_months == null) next.repeat_cycle_months = 3;
      if (next.churn_per_cycle == null) next.churn_per_cycle = 0.4;
      if (next.inventory_days == null) next.inventory_days = 30;
      if (next.payout_delay_days == null) next.payout_delay_days = 3;
      return next;
    });
    toast.success("Valeurs pré-remplies depuis les blocs précédents + défauts standards");
  };

  const save = async () => {
    setSaving(true);
    const payload: any = { ...f, client_id: clientId };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    ["aov_new","aov_repeat","cac_new","cac_repeat","conversion_rate","repeat_cycle_months",
     "churn_per_cycle","inventory_days","payout_delay_days","avg_order_value","avg_units_per_transaction",
     "basket_cogs","basket_shipping_cost","basket_fulfillment_cost","basket_payment_processing_cost",
     "basket_refund_allowance","basket_discount_allowance","basket_gross_profit","basket_gross_margin_percent",
     "break_even_cac","target_cac","first_order_profit_at_target_cac"].forEach((k) => {
      if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]);
    });
    const { error } = row
      ? await supabase.from("gos_basket_economics").update(payload).eq("id", row.id)
      : await supabase.from("gos_basket_economics").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Économie du panier enregistrée — PFMB débloqué"); onSaved(); }
  };

  const fields: [string, string, string?][] = [
    ["aov_new", "AOV Nouveaux clients ($)", "Panier moyen d'un client qui achète pour la 1ère fois"],
    ["aov_repeat", "AOV Récurrents ($)", "Panier moyen d'un client qui re-commande"],
    ["cac_new", "CAC Nouveaux ($)", "Coût d'acquisition d'un nouveau client (ads spend ÷ new customers)"],
    ["cac_repeat", "CAC Récurrents ($)", "Coût pour faire re-commander (email/SMS/retargeting)"],
    ["conversion_rate", "Conversion Rate (0-1)", "Sessions → commandes. Ex: 0.018 = 1.8%"],
    ["repeat_cycle_months", "Cycle de rachat (mois)", "Délai moyen entre 2 commandes du même client"],
    ["churn_per_cycle", "Churn par cycle (0-1)", "% de clients perdus à chaque cycle. Ex: 0.4 = 40%"],
    ["inventory_days", "Stock (jours)", "Jours de stock que tu détiens en moyenne"],
    ["payout_delay_days", "Délai payout (jours)", "Délai d'encaissement Shopify/Stripe. Défaut: 3"],
  ];

  return (
    <FormCard title="Économie du panier — débloque Profit-First Media Buying">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>
          Utilisé par le moteur PFMB (Pouvoir de dépense) pour combiner régression + cash + funnel + LTV par cohorte.
        </div>
        <button className="gos-btn-secondary" type="button" onClick={prefill} style={{ fontSize: 12 }}>
          ⟳ Pré-remplir depuis blocs précédents
        </button>
      </div>
      <Grid>
        {fields.map(([k, l, h]) => (
          <F key={k} label={l}>
            <input type="number" step="any" className="gos-input" value={num(f[k])} onChange={(e) => set(k, e.target.value)} />
            {h && <div style={{ fontSize: 10, color: "var(--tdia-muted)", marginTop: 3 }}>{h}</div>}
          </F>
        ))}
      </Grid>
      <div style={{ marginTop: 16 }}>
        <button className="gos-btn-primary" onClick={save} disabled={saving}>
          <Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </FormCard>
  );
}
