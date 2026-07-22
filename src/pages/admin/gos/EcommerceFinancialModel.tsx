import { useEffect, useMemo, useState } from "react";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  computeGrossToNet, computeProductProfile, computeBasketEconomics,
  computeOfferEconomics, computeInventoryGrade, computePnlSnapshot,
  computeOrderValueDistribution, computeFunnelEconomics, computeOpexBufferWarning,
} from "@/gos/formulas";

type NumInput = number | "";
const n = (v: NumInput): number | null => (v === "" || Number.isNaN(v) ? null : Number(v));

const BG = "rgba(255, 255, 255, 0.02)";
const CARD = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#0f8a44";
const RED = "#c1121f";
const AMBER = "#a8730a";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const fmt = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  }
  return String(v);
};
const fmtPct = (v: number | null | undefined) => v == null ? "—" : `${v}%`;
const fmtCompact = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
};

// ---------- Terminal building blocks ----------

function Module({ title, children, span = 1, tint }: { title: string; children: React.ReactNode; span?: 1 | 2 | 3; tint?: string }) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderTop: tint ? `2px solid ${tint}` : `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minHeight: 240,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
        textTransform: "uppercase", color: MUTED, fontFamily: MONO,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TField({ label, value, onChange, suffix }: { label: string; value: NumInput; onChange: (v: NumInput) => void; suffix?: string }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: MUTED, fontFamily: MONO }}>
        {label}{suffix ? ` (${suffix})` : ""}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        style={{
          width: 90, textAlign: "right", background: "transparent",
          border: "none", outline: "none", color: "var(--tdia-text)",
          fontFamily: MONO, fontSize: 12, padding: "2px 4px",
          borderBottom: `1px dotted ${BORDER}`,
        }}
      />
    </label>
  );
}

function TRow({ label, value, tint, bold }: { label: string; value: unknown; tint?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: bold ? (tint ?? "white") : MUTED, fontFamily: MONO, fontWeight: bold ? 700 : 400 }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: tint ?? "white", fontWeight: bold ? 700 : 500 }}>
        {fmt(value)}
      </span>
    </div>
  );
}

function TCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function TSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: T[] }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: MUTED, fontFamily: MONO }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        style={{ background: BG, border: `1px solid ${BORDER}`, color: "var(--tdia-text)", fontFamily: MONO, fontSize: 11, padding: "2px 4px", borderRadius: 4 }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function TText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: MUTED, fontFamily: MONO }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 120, textAlign: "right", background: "transparent", border: "none", outline: "none", color: "var(--tdia-text)", fontFamily: MONO, fontSize: 12, borderBottom: `1px dotted ${BORDER}` }} />
    </label>
  );
}

function KpiRibbon({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: MUTED, fontFamily: MONO }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ---------- Page ----------

export default function EcommerceFinancialModel() {
  const { selectedClient } = useSelectedClient();

  const [g2n, setG2n] = useState({ gross_revenue: "" as NumInput, discounts: "" as NumInput, refunds: "" as NumInput, chargebacks: "" as NumInput, shipping_collected: "" as NumInput, taxes_collected: "" as NumInput });
  const g2nOut = useMemo(() => computeGrossToNet({
    gross_revenue: n(g2n.gross_revenue), discounts: n(g2n.discounts), refunds: n(g2n.refunds),
    chargebacks: n(g2n.chargebacks), shipping_collected: n(g2n.shipping_collected), taxes_collected: n(g2n.taxes_collected),
  }), [g2n]);

  const [pp, setPp] = useState({
    price: "" as NumInput, product_cost: "" as NumInput, landed_cost: "" as NumInput,
    freight_cost: "" as NumInput, duties_tariffs: "" as NumInput, shipping_cost_to_customer: "" as NumInput,
    pick_pack_cost: "" as NumInput, payment_processing_percent: "" as NumInput,
    refund_allowance_percent: "" as NumInput, discount_allowance_percent: "" as NumInput,
    target_cac: "" as NumInput,
  });
  const ppOut = useMemo(() => computeProductProfile({
    price: n(pp.price), product_cost: n(pp.product_cost), landed_cost: n(pp.landed_cost),
    freight_cost: n(pp.freight_cost), duties_tariffs: n(pp.duties_tariffs),
    shipping_cost_to_customer: n(pp.shipping_cost_to_customer), pick_pack_cost: n(pp.pick_pack_cost),
    payment_processing_percent: n(pp.payment_processing_percent),
    refund_allowance_percent: n(pp.refund_allowance_percent),
    discount_allowance_percent: n(pp.discount_allowance_percent),
    target_cac: n(pp.target_cac),
  }), [pp]);

  const [bk, setBk] = useState({
    avg_order_value: "" as NumInput, basket_cogs: "" as NumInput,
    basket_shipping_cost: "" as NumInput, basket_fulfillment_cost: "" as NumInput,
    basket_payment_processing_cost: "" as NumInput,
    basket_refund_allowance: "" as NumInput, basket_discount_allowance: "" as NumInput,
    target_cac: "" as NumInput,
  });
  const bkOut = useMemo(() => computeBasketEconomics({
    avg_order_value: n(bk.avg_order_value), basket_cogs: n(bk.basket_cogs),
    basket_shipping_cost: n(bk.basket_shipping_cost),
    basket_fulfillment_cost: n(bk.basket_fulfillment_cost),
    basket_payment_processing_cost: n(bk.basket_payment_processing_cost),
    basket_refund_allowance: n(bk.basket_refund_allowance),
    basket_discount_allowance: n(bk.basket_discount_allowance),
    target_cac: n(bk.target_cac),
  }), [bk]);

  const [of, setOf] = useState({
    base_price: "" as NumInput, discount_percent: "" as NumInput, cogs: "" as NumInput,
    shipping_cost: "" as NumInput, fulfillment_cost: "" as NumInput, gift_cost: "" as NumInput,
    payment_processing_percent: "" as NumInput,
    refund_allowance_percent: "" as NumInput, discount_allowance_percent: "" as NumInput,
  });
  const ofOut = useMemo(() => computeOfferEconomics({
    base_price: n(of.base_price), discount_percent: n(of.discount_percent), cogs: n(of.cogs),
    shipping_cost: n(of.shipping_cost), fulfillment_cost: n(of.fulfillment_cost), gift_cost: n(of.gift_cost),
    payment_processing_percent: n(of.payment_processing_percent),
    refund_allowance_percent: n(of.refund_allowance_percent),
    discount_allowance_percent: n(of.discount_allowance_percent),
  }), [of]);

  const [inv, setInv] = useState({ inventory_units: "" as NumInput, daily_sales_velocity: "" as NumInput, unit_cost: "" as NumInput, unit_price: "" as NumInput });
  const invOut = useMemo(() => computeInventoryGrade({
    inventory_units: n(inv.inventory_units), daily_sales_velocity: n(inv.daily_sales_velocity),
    unit_cost: n(inv.unit_cost), unit_price: n(inv.unit_price),
  }), [inv]);

  const [pl, setPl] = useState({
    net_revenue: "" as NumInput, cost_of_delivery: "" as NumInput,
    marketing_expense: "" as NumInput, opex: "" as NumInput, interest_expense: "" as NumInput,
  });
  const plOut = useMemo(() => computePnlSnapshot({
    net_revenue: n(pl.net_revenue), cost_of_delivery: n(pl.cost_of_delivery),
    marketing_expense: n(pl.marketing_expense), opex: n(pl.opex), interest_expense: n(pl.interest_expense),
  }), [pl]);

  const [ovdRaw, setOvdRaw] = useState<string>("");
  const [ovdBucketSize, setOvdBucketSize] = useState<NumInput>(50);
  const [ovdTargetCac, setOvdTargetCac] = useState<NumInput>("");
  const [ovdContribAtModal, setOvdContribAtModal] = useState<NumInput>("");
  const ovdOut = useMemo(() => {
    const parsed = ovdRaw.split(/[,;\s]+/).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    return computeOrderValueDistribution({
      order_values: parsed,
      bucket_size: ovdBucketSize === "" ? undefined : Number(ovdBucketSize),
      target_cac: n(ovdTargetCac),
      contribution_ratio_at_modal: ovdContribAtModal === "" ? null : Number(ovdContribAtModal) / 100,
    });
  }, [ovdRaw, ovdBucketSize, ovdTargetCac, ovdContribAtModal]);

  const [fn, setFn] = useState({
    funnel_name: "", funnel_type: "SINGLE_PRODUCT" as any,
    expected_order_value: "" as NumInput, contribution_before_cac: "" as NumInput, target_cac: "" as NumInput,
  });
  const fnOut = useMemo(() => computeFunnelEconomics({
    funnel_name: fn.funnel_name, funnel_type: fn.funnel_type,
    expected_order_value: n(fn.expected_order_value),
    contribution_before_cac: n(fn.contribution_before_cac),
    target_cac: n(fn.target_cac),
  }), [fn]);

  const [opex, setOpex] = useState({ use_opex_buffer: false, opex_buffer_type: "NONE" as any, opex_buffer_percent_of_revenue: "" as NumInput, opex_buffer_per_order: "" as NumInput, opex_fixed_monthly: "" as NumInput, conservative_bootstrap_mode: false });
  const opexOut = useMemo(() => computeOpexBufferWarning({
    use_opex_buffer: opex.use_opex_buffer,
    opex_buffer_type: opex.opex_buffer_type,
    opex_buffer_percent_of_revenue: n(opex.opex_buffer_percent_of_revenue),
    opex_buffer_per_order: n(opex.opex_buffer_per_order),
    opex_fixed_monthly: n(opex.opex_fixed_monthly),
    conservative_bootstrap_mode: opex.conservative_bootstrap_mode,
  }), [opex]);

  const [autoloadInfo, setAutoloadInfo] = useState<{ loaded: string[]; empty: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const autoload = async (clientId: string) => {
    setLoading(true);
    const loaded: string[] = [];
    const empty: string[] = [];
    try {
      const [g2nRes, ppRes, bkRes, ofRes, invRes, plRes, ovdRes, opexRes, finRes] = await Promise.all([
        supabase.from("gos_gross_to_net_snapshots").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_product_financial_profiles").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_basket_economics").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_offer_economics_runs").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_inventory_grade_snapshots").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_pnl_snapshots").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_order_value_distributions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_opex_allocation_settings").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gos_financial_inputs").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const fin = finRes.data as any;
      const cacFallback = fin?.target_cac != null ? Number(fin.target_cac) : "";

      // 1. Gross-to-Net
      if (g2nRes.data) {
        const d = g2nRes.data as any;
        setG2n({
          gross_revenue: d.gross_revenue ?? "",
          discounts: d.discounts ?? "",
          refunds: d.refunds ?? "",
          chargebacks: d.chargebacks ?? "",
          shipping_collected: d.shipping_collected ?? "",
          taxes_collected: d.taxes_collected ?? "",
        });
        loaded.push("Gross-to-Net");
      } else empty.push("Gross-to-Net");

      // 2. Product profile
      if (ppRes.data) {
        const d = ppRes.data as any;
        setPp({
          price: d.price ?? "",
          product_cost: d.product_cost ?? "",
          landed_cost: d.landed_cost ?? "",
          freight_cost: d.freight_cost ?? "",
          duties_tariffs: d.duties_tariffs ?? "",
          shipping_cost_to_customer: d.shipping_cost_to_customer ?? "",
          pick_pack_cost: d.pick_pack_cost ?? "",
          payment_processing_percent: d.payment_processing_percent ?? "",
          refund_allowance_percent: d.refund_allowance_percent ?? "",
          discount_allowance_percent: d.discount_allowance_percent ?? "",
          target_cac: cacFallback,
        });
        loaded.push("Profil produit");
      } else empty.push("Profil produit");

      // 3. Basket
      if (bkRes.data) {
        const d = bkRes.data as any;
        setBk({
          avg_order_value: d.avg_order_value ?? fin?.aov ?? "",
          basket_cogs: d.basket_cogs ?? fin?.cogs_per_order ?? "",
          basket_shipping_cost: d.basket_shipping_cost ?? fin?.shipping_cost_per_order ?? "",
          basket_fulfillment_cost: d.basket_fulfillment_cost ?? fin?.fulfillment_cost_per_order ?? "",
          basket_payment_processing_cost: d.basket_payment_processing_cost ?? "",
          basket_refund_allowance: d.basket_refund_allowance ?? "",
          basket_discount_allowance: d.basket_discount_allowance ?? "",
          target_cac: d.target_cac ?? cacFallback,
        });
        loaded.push("Panier");
      } else if (fin) {
        // Fallback : dérive du gos_financial_inputs
        setBk((prev) => ({
          ...prev,
          avg_order_value: fin.aov ?? "",
          basket_cogs: fin.cogs_per_order ?? "",
          basket_shipping_cost: fin.shipping_cost_per_order ?? "",
          basket_fulfillment_cost: fin.fulfillment_cost_per_order ?? "",
          target_cac: cacFallback,
        }));
        loaded.push("Panier (dérivé)");
      } else empty.push("Panier");

      // 4. Offer
      if (ofRes.data) {
        const d = ofRes.data as any;
        setOf({
          base_price: d.base_price ?? "",
          discount_percent: d.discount_percent ?? "",
          cogs: d.cogs ?? "",
          shipping_cost: d.shipping_cost ?? "",
          fulfillment_cost: d.fulfillment_cost ?? "",
          gift_cost: d.gift_cost ?? "",
          payment_processing_percent: ppRes.data?.payment_processing_percent ?? "",
          refund_allowance_percent: ppRes.data?.refund_allowance_percent ?? "",
          discount_allowance_percent: ppRes.data?.discount_allowance_percent ?? "",
        });
        loaded.push("Offre");
      } else empty.push("Offre");

      // 5. Inventory grade — fallback : agrège les snapshots + profils si pas de grade snapshot
      if (invRes.data) {
        const d = invRes.data as any;
        setInv({
          inventory_units: d.inventory_units ?? "",
          daily_sales_velocity: d.daily_sales_velocity ?? "",
          unit_cost: ppRes.data?.product_cost ?? "",
          unit_price: ppRes.data?.price ?? "",
        });
        loaded.push("Stock");
      } else {
        // Aggregate from raw inventory snapshots (latest per product)
        const invSnap = await supabase
          .from("gos_inventory_snapshots")
          .select("product_id, available_stock, daily_sales_velocity, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });
        const latest = new Map<string, any>();
        for (const r of invSnap.data ?? []) if (!latest.has(r.product_id)) latest.set(r.product_id, r);
        const totalUnits = [...latest.values()].reduce((s, r) => s + Number(r.available_stock ?? 0), 0);
        const totalVel = [...latest.values()].reduce((s, r) => s + Number(r.daily_sales_velocity ?? 0), 0);
        if (totalUnits > 0) {
          setInv({
            inventory_units: totalUnits,
            daily_sales_velocity: Number(totalVel.toFixed(2)),
            unit_cost: ppRes.data?.product_cost ?? "",
            unit_price: ppRes.data?.price ?? "",
          });
          loaded.push("Stock (agrégé Shopify)");
        } else empty.push("Stock");
      }

      // 6. P&L
      if (plRes.data) {
        const d = plRes.data as any;
        setPl({
          net_revenue: d.net_revenue ?? "",
          cost_of_delivery: d.cost_of_delivery ?? "",
          marketing_expense: d.marketing_expense ?? "",
          opex: d.opex ?? "",
          interest_expense: d.interest_expense ?? "",
        });
        loaded.push("P&L");
      } else empty.push("P&L");

      // 7. Order value distribution — pré-remplit uniquement les paramètres
      if (ovdRes.data) {
        const d = ovdRes.data as any;
        if (d.bucket_size != null) setOvdBucketSize(Number(d.bucket_size));
        loaded.push("Distribution paniers (params)");
      }
      if (cacFallback !== "") setOvdTargetCac(cacFallback);

      // 9. OPEX
      if (opexRes.data) {
        const d = opexRes.data as any;
        setOpex({
          use_opex_buffer: !!d.use_opex_buffer,
          opex_buffer_type: d.opex_buffer_type ?? "NONE",
          opex_buffer_percent_of_revenue: d.opex_buffer_percent_of_revenue ?? "",
          opex_buffer_per_order: d.opex_buffer_per_order ?? "",
          opex_fixed_monthly: d.opex_fixed_monthly ?? "",
          conservative_bootstrap_mode: !!d.conservative_bootstrap_mode,
        });
        loaded.push("OPEX");
      } else empty.push("OPEX");

      setAutoloadInfo({ loaded, empty });
    } catch (e) {
      console.error("[EcommerceFinancialModel] autoload error", e);
      toast.error("Chargement des données financières échoué");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient?.id) autoload(selectedClient.id);
    // eslint-disable-next-line
  }, [selectedClient?.id]);


  if (!selectedClient) return <EmptyState title="Sélectionne un client" hint="Modèle financier e-commerce disponible après sélection." />;

  const isEcom = (selectedClient as any)?.business_type === "ECOMMERCE" || !(selectedClient as any)?.business_type;
  if (!isEcom) {
    return (
      <>
        <SectionHeader title="Modèle financier e-commerce" subtitle="Réservé aux clients e-commerce" />
        <div className="gos-card" style={{ padding: 24 }}>Ce modèle est conçu pour les clients e-commerce.</div>
      </>
    );
  }

  const gradeColor = invOut.inventory_grade === "A" ? GREEN : invOut.inventory_grade === "B" ? BLUE : invOut.inventory_grade === "C" ? AMBER : invOut.inventory_grade === "D" ? RED : MUTED;
  const roasWarn = (ofOut.break_even_roas_after_offer ?? 0) >= 4;

  // Distribution mini-histogram
  const maxBucketCount = Math.max(1, ...ovdOut.buckets.map((b: any) => b.order_count ?? 0));
  const modalIdx = ovdOut.buckets.findIndex((b: any) => b.order_count === maxBucketCount);

  return (
    <>
      <SectionHeader
        title="Modèle financier e-commerce"
        subtitle={`Terminal financier pour ${selectedClient.company_name}. Les 5 KPIs cross-modules en haut, 9 modules déterministes en dessous.`}
        actions={
          <button className="gos-btn-secondary" onClick={() => selectedClient?.id && autoload(selectedClient.id)} disabled={loading}>
            <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} className={loading ? "animate-spin" : ""} />
            {loading ? "Chargement…" : "Recharger données"}
          </button>
        }
        guide={{
          purpose: "Distinguer marge produit vs vraie marge brute, économie panier, viabilité des offres, cash bloqué en stock, et P&L complet.",
          dataSource: autoloadInfo
            ? `Auto-chargé : ${autoloadInfo.loaded.join(", ") || "aucun"}${autoloadInfo.empty.length ? ` · Vide : ${autoloadInfo.empty.join(", ")}` : ""}`
            : "Saisie manuelle (fallback). Les données Shopify alimenteront automatiquement gross-to-net, produits, stock et paniers dès la connexion.",
          usedBy: "Break-even CAC/ROAS, Live Optimization, Forecast, Next-cycle planning.",
        }}
      />

      {autoloadInfo && (autoloadInfo.loaded.length > 0 || autoloadInfo.empty.length > 0) && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12,
          padding: "10px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
          fontFamily: MONO, fontSize: 11,
        }}>
          {autoloadInfo.loaded.map((k) => (
            <span key={`ok-${k}`} style={{ padding: "2px 8px", borderRadius: 4, background: `${GREEN}22`, color: GREEN, border: `1px solid ${GREEN}55` }}>
              ✓ {k}
            </span>
          ))}
          {autoloadInfo.empty.map((k) => (
            <span key={`ko-${k}`} style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(255, 255, 255, 0.02)", color: MUTED, border: `1px solid ${BORDER}` }}>
              ○ {k}
            </span>
          ))}
        </div>
      )}


      {/* Top ribbon: cross-computed KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <KpiRibbon label="True GM%" value={fmtPct(ppOut.true_gross_margin_percent)} color={(ppOut.true_gross_margin_percent ?? 0) >= 30 ? GREEN : (ppOut.true_gross_margin_percent ?? 0) >= 15 ? AMBER : ppOut.true_gross_margin_percent != null ? RED : MUTED} />
        <KpiRibbon label="Break-even ROAS" value={ppOut.break_even_roas != null ? `${ppOut.break_even_roas.toFixed(2)}x` : "—"} color={BLUE} />
        <KpiRibbon label="Break-even CAC" value={ppOut.break_even_cac != null ? `${ppOut.break_even_cac.toFixed(2)} $` : "—"} color="white" />
        <KpiRibbon label="Cash in Stock" value={invOut.cash_locked_in_inventory != null ? `${fmtCompact(invOut.cash_locked_in_inventory)} $` : "—"} color={AMBER} />
        <KpiRibbon label="Contr. / Order" value={bkOut.basket_gross_profit != null ? `${Number(bkOut.basket_gross_profit).toFixed(2)} $` : "—"} color="white" />
      </div>

      {/* 3-column module grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

        {/* 1. Gross-to-Net */}
        <Module title="1 · Gross-to-Net Revenue" tint={BLUE}>
          <div>
            <TField label="Gross revenue" value={g2n.gross_revenue} onChange={(v) => setG2n({ ...g2n, gross_revenue: v })} />
            <TField label="Discounts" value={g2n.discounts} onChange={(v) => setG2n({ ...g2n, discounts: v })} />
            <TField label="Refunds" value={g2n.refunds} onChange={(v) => setG2n({ ...g2n, refunds: v })} />
            <TField label="Chargebacks" value={g2n.chargebacks} onChange={(v) => setG2n({ ...g2n, chargebacks: v })} />
            <TField label="Shipping coll." value={g2n.shipping_collected} onChange={(v) => setG2n({ ...g2n, shipping_collected: v })} />
            <TField label="Taxes coll." value={g2n.taxes_collected} onChange={(v) => setG2n({ ...g2n, taxes_collected: v })} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Gap gross→net" value={g2nOut.gross_to_net_gap_percent != null ? `${g2nOut.gross_to_net_gap_percent}%` : null} tint={RED} />
            <TRow label="Net revenue" value={g2nOut.net_revenue} tint={BLUE} bold />
          </div>
        </Module>

        {/* 2. Product profile */}
        <Module title="2 · Profil financier produit" tint={GREEN}>
          <div>
            <TField label="Price" value={pp.price} onChange={(v) => setPp({ ...pp, price: v })} />
            <TField label="Product cost" value={pp.product_cost} onChange={(v) => setPp({ ...pp, product_cost: v })} />
            <TField label="Landed cost" value={pp.landed_cost} onChange={(v) => setPp({ ...pp, landed_cost: v })} />
            <TField label="Freight" value={pp.freight_cost} onChange={(v) => setPp({ ...pp, freight_cost: v })} />
            <TField label="Duties" value={pp.duties_tariffs} onChange={(v) => setPp({ ...pp, duties_tariffs: v })} />
            <TField label="Ship to cust." value={pp.shipping_cost_to_customer} onChange={(v) => setPp({ ...pp, shipping_cost_to_customer: v })} />
            <TField label="Pick & pack" value={pp.pick_pack_cost} onChange={(v) => setPp({ ...pp, pick_pack_cost: v })} />
            <TField label="Payment proc." suffix="%" value={pp.payment_processing_percent} onChange={(v) => setPp({ ...pp, payment_processing_percent: v })} />
            <TField label="Refund allow." suffix="%" value={pp.refund_allowance_percent} onChange={(v) => setPp({ ...pp, refund_allowance_percent: v })} />
            <TField label="Discount allow." suffix="%" value={pp.discount_allowance_percent} onChange={(v) => setPp({ ...pp, discount_allowance_percent: v })} />
            <TField label="Target CAC" value={pp.target_cac} onChange={(v) => setPp({ ...pp, target_cac: v })} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Product margin %" value={fmtPct(ppOut.product_margin_percent)} />
            <TRow label="True gross profit" value={ppOut.true_gross_profit} />
            <TRow label="True GM %" value={fmtPct(ppOut.true_gross_margin_percent)} tint={GREEN} bold />
            <TRow label="First-order profit" value={ppOut.first_order_profit_at_target_cac} tint={(ppOut.first_order_profit_at_target_cac ?? 0) < 0 ? RED : GREEN} />
          </div>
        </Module>

        {/* 3. Basket */}
        <Module title="3 · Économie panier" tint={BLUE}>
          <div>
            <TField label="AOV" value={bk.avg_order_value} onChange={(v) => setBk({ ...bk, avg_order_value: v })} />
            <TField label="Basket COGS" value={bk.basket_cogs} onChange={(v) => setBk({ ...bk, basket_cogs: v })} />
            <TField label="Shipping" value={bk.basket_shipping_cost} onChange={(v) => setBk({ ...bk, basket_shipping_cost: v })} />
            <TField label="Fulfillment" value={bk.basket_fulfillment_cost} onChange={(v) => setBk({ ...bk, basket_fulfillment_cost: v })} />
            <TField label="Payment proc." value={bk.basket_payment_processing_cost} onChange={(v) => setBk({ ...bk, basket_payment_processing_cost: v })} />
            <TField label="Refund allow." value={bk.basket_refund_allowance} onChange={(v) => setBk({ ...bk, basket_refund_allowance: v })} />
            <TField label="Discount allow." value={bk.basket_discount_allowance} onChange={(v) => setBk({ ...bk, basket_discount_allowance: v })} />
            <TField label="Target CAC" value={bk.target_cac} onChange={(v) => setBk({ ...bk, target_cac: v })} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Basket GP" value={bkOut.basket_gross_profit} />
            <TRow label="Basket GM %" value={fmtPct(bkOut.basket_gross_margin_percent)} tint={BLUE} bold />
            <TRow label="Break-even CAC" value={bkOut.break_even_cac} />
            <TRow label="First-order profit" value={bkOut.first_order_profit_at_target_cac} tint={(bkOut.first_order_profit_at_target_cac ?? 0) < 0 ? RED : GREEN} />
          </div>
        </Module>

        {/* 4. Offer */}
        <Module title="4 · Économie d'offre" tint={roasWarn ? RED : AMBER}>
          <div>
            <TField label="Base price" value={of.base_price} onChange={(v) => setOf({ ...of, base_price: v })} />
            <TField label="Discount" suffix="%" value={of.discount_percent} onChange={(v) => setOf({ ...of, discount_percent: v })} />
            <TField label="COGS" value={of.cogs} onChange={(v) => setOf({ ...of, cogs: v })} />
            <TField label="Shipping" value={of.shipping_cost} onChange={(v) => setOf({ ...of, shipping_cost: v })} />
            <TField label="Fulfillment" value={of.fulfillment_cost} onChange={(v) => setOf({ ...of, fulfillment_cost: v })} />
            <TField label="Gift" value={of.gift_cost} onChange={(v) => setOf({ ...of, gift_cost: v })} />
            <TField label="Payment proc." suffix="%" value={of.payment_processing_percent} onChange={(v) => setOf({ ...of, payment_processing_percent: v })} />
            <TField label="Refund allow." suffix="%" value={of.refund_allowance_percent} onChange={(v) => setOf({ ...of, refund_allowance_percent: v })} />
            <TField label="Discount allow." suffix="%" value={of.discount_allowance_percent} onChange={(v) => setOf({ ...of, discount_allowance_percent: v })} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Discounted price" value={ofOut.discounted_price} />
            <TRow label="GP after offer" value={ofOut.gross_profit_after_offer} tint={(ofOut.gross_profit_after_offer ?? 0) <= 0 ? RED : GREEN} />
            <TRow label="Break-even ROAS" value={ofOut.break_even_roas_after_offer != null ? `${ofOut.break_even_roas_after_offer.toFixed(2)}x` : null} tint={roasWarn ? RED : AMBER} bold />
            <TRow label="Viability" value={ofOut.offer_viability} tint={ofOut.offer_viability === "NOT_VIABLE_FOR_ACQUISITION" || ofOut.offer_viability === "HIGH_RISK" ? RED : GREEN} />
          </div>
        </Module>

        {/* 5. Inventory grade */}
        <Module title="5 · Grade de stock A/B/C/D" tint={gradeColor}>
          <div>
            <TField label="Inventory units" value={inv.inventory_units} onChange={(v) => setInv({ ...inv, inventory_units: v })} />
            <TField label="Daily velocity" value={inv.daily_sales_velocity} onChange={(v) => setInv({ ...inv, daily_sales_velocity: v })} />
            <TField label="Unit cost" value={inv.unit_cost} onChange={(v) => setInv({ ...inv, unit_cost: v })} />
            <TField label="Unit price" value={inv.unit_price} onChange={(v) => setInv({ ...inv, unit_price: v })} />
          </div>
          {invOut.inventory_grade && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "12px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: `${gradeColor}22`, border: `2px solid ${gradeColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 32, fontWeight: 700, color: gradeColor }}>
                {invOut.inventory_grade}
              </div>
            </div>
          )}
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Days on hand" value={invOut.days_of_inventory_on_hand} />
            <TRow label="Cash locked" value={invOut.cash_locked_in_inventory} tint={AMBER} bold />
            <TRow label="Value @ retail" value={invOut.inventory_value_at_retail} />
          </div>
        </Module>

        {/* 6. P&L */}
        <Module title="6 · P&L Snapshot" tint={GREEN}>
          <div>
            <TField label="Net revenue" value={pl.net_revenue} onChange={(v) => setPl({ ...pl, net_revenue: v })} />
            <TField label="Cost of delivery" value={pl.cost_of_delivery} onChange={(v) => setPl({ ...pl, cost_of_delivery: v })} />
            <TField label="Marketing" value={pl.marketing_expense} onChange={(v) => setPl({ ...pl, marketing_expense: v })} />
            <TField label="OPEX" value={pl.opex} onChange={(v) => setPl({ ...pl, opex: v })} />
            <TField label="Interest" value={pl.interest_expense} onChange={(v) => setPl({ ...pl, interest_expense: v })} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Gross margin %" value={fmtPct(plOut.gross_margin_percent)} />
            <TRow label="MER" value={plOut.marketing_efficiency_ratio} />
            <TRow label="Contribution %" value={fmtPct(plOut.contribution_margin_percent)} />
            <TRow label="EBITDA" value={plOut.ebitda} tint={BLUE} />
            <TRow label="Net profit" value={plOut.net_profit} tint={(plOut.net_profit ?? 0) < 0 ? RED : GREEN} bold />
          </div>
        </Module>

        {/* 7. Order value distribution — spans 2 cols */}
        <Module title="7 · Distribution valeur commandes" span={2} tint={BLUE}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: MUTED, fontFamily: MONO }}>Valeurs de commandes (CSV)</span>
                <textarea value={ovdRaw} onChange={(e) => setOvdRaw(e.target.value)} rows={2}
                  placeholder="35, 42, 47, 47, 48, 51, 55, 92, 148, 220"
                  style={{ width: "100%", marginTop: 4, background: BG, border: `1px solid ${BORDER}`, color: "var(--tdia-text)", fontFamily: MONO, fontSize: 12, padding: 6, borderRadius: 4, resize: "vertical" }} />
              </label>
              <TField label="Bucket size" value={ovdBucketSize} onChange={setOvdBucketSize} />
              <TField label="Target CAC" value={ovdTargetCac} onChange={setOvdTargetCac} />
              <TField label="Contrib @ modal" suffix="%" value={ovdContribAtModal} onChange={setOvdContribAtModal} />
            </div>
            <div>
              <TRow label="AOV (moy)" value={ovdOut.avg_order_value} />
              <TRow label="Médiane" value={ovdOut.median_order_value} />
              <TRow label="Modal" value={ovdOut.modal_order_value} tint={BLUE} bold />
              <TRow label="Long-tail risk" value={ovdOut.long_tail_risk} tint={ovdOut.long_tail_risk === "HIGH" ? RED : MUTED} />
              <TRow label="CAC risk" value={ovdOut.cac_target_risk} tint={ovdOut.cac_target_risk === "HIGH" ? RED : MUTED} />
            </div>
          </div>
          {ovdOut.buckets.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60, padding: "0 4px" }}>
                {ovdOut.buckets.map((b: any, i: number) => (
                  <div key={i} title={`${b.min}–${Math.round(b.max)} · ${b.order_count} orders`}
                    style={{
                      flex: 1,
                      height: `${(b.order_count / maxBucketCount) * 100}%`,
                      background: i === modalIdx ? BLUE : "hsl(0 0% 78%)",
                      borderRadius: "2px 2px 0 0",
                      minHeight: 2,
                    }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: MUTED, fontFamily: MONO }}>
                <span>{fmt(ovdOut.buckets[0]?.min)}</span>
                <span>{fmt(ovdOut.buckets[ovdOut.buckets.length - 1]?.max)}+</span>
              </div>
            </div>
          )}
          {ovdOut.warning && (
            <div style={{ padding: "6px 10px", background: `${RED}22`, color: RED, borderRadius: 6, fontSize: 11, fontFamily: MONO }}>
              {ovdOut.warning}
            </div>
          )}
        </Module>

        {/* 8. Funnel economics */}
        <Module title="8 · Funnel economics" tint={AMBER}>
          <div>
            <TText label="Name" value={fn.funnel_name} onChange={(v) => setFn({ ...fn, funnel_name: v })} />
            <TSelect label="Type" value={fn.funnel_type} onChange={(v) => setFn({ ...fn, funnel_type: v })}
              options={["SINGLE_PRODUCT","BUNDLE","HERO_PRODUCT","CATEGORY_PAGE","LANDING_PAGE","PROMO","INVENTORY_CLEARANCE","RETENTION_ONLY","TEST"]} />
            <TField label="Expected OV" value={fn.expected_order_value} onChange={(v) => setFn({ ...fn, expected_order_value: v })} />
            <TField label="Contrib. before CAC" value={fn.contribution_before_cac} onChange={(v) => setFn({ ...fn, contribution_before_cac: v })} />
            <TField label="Target CAC" value={fn.target_cac} onChange={(v) => setFn({ ...fn, target_cac: v })} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <TRow label="Break-even CAC" value={fnOut.break_even_cac} />
            <TRow label="First-order profit" value={fnOut.first_order_profit_at_target_cac} tint={(fnOut.first_order_profit_at_target_cac ?? 0) < 0 ? RED : GREEN} bold />
            <TRow label="Profitable" value={fnOut.first_order_profitable === null ? null : String(fnOut.first_order_profitable)} tint={fnOut.first_order_profitable === false ? RED : GREEN} />
            <TRow label="Mix confidence" value={fnOut.product_mix_confidence} tint={fnOut.product_mix_confidence !== "HIGH" ? AMBER : GREEN} />
          </div>
        </Module>

        {/* 9. OPEX buffer — spans 3 */}
        <Module title="9 · Traitement de l'OPEX" span={3} tint={opexOut.warning ? AMBER : MUTED}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <TCheck label="Utiliser buffer OPEX" checked={opex.use_opex_buffer} onChange={(v) => setOpex({ ...opex, use_opex_buffer: v })} />
            <TCheck label="Bootstrap conservateur" checked={opex.conservative_bootstrap_mode} onChange={(v) => setOpex({ ...opex, conservative_bootstrap_mode: v })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <TSelect label="Buffer type" value={opex.opex_buffer_type} onChange={(v) => setOpex({ ...opex, opex_buffer_type: v })}
              options={["NONE","PERCENT_OF_REVENUE","PER_ORDER","FIXED_MONTHLY"]} />
            <TField label="% of revenue" suffix="%" value={opex.opex_buffer_percent_of_revenue} onChange={(v) => setOpex({ ...opex, opex_buffer_percent_of_revenue: v })} />
            <TField label="Per order ($)" value={opex.opex_buffer_per_order} onChange={(v) => setOpex({ ...opex, opex_buffer_per_order: v })} />
            <TField label="Fixed monthly ($)" value={opex.opex_fixed_monthly} onChange={(v) => setOpex({ ...opex, opex_fixed_monthly: v })} />
          </div>
          <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, lineHeight: 1.6 }}>
            {opexOut.note}
          </div>
          {opexOut.warning && (
            <div style={{ padding: "8px 12px", background: `${AMBER}22`, color: AMBER, borderRadius: 6, fontSize: 11, fontFamily: MONO, borderLeft: `3px solid ${AMBER}` }}>
              {opexOut.warning}
            </div>
          )}
        </Module>
      </div>
    </>
  );
}
