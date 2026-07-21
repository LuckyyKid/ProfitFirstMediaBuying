import { useEffect, useMemo, useState } from "react";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { computeSkuDemandPlan } from "@/gos/formulas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  sku: string;
  product_name: string;
  forecasted_units: number | "";
  available_inventory: number | "";
  safety_stock: number | "";
  inventory_grade: "" | "A" | "B" | "C" | "D";
  gross_margin_percent: number | "";
  notes: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const toISOMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtInt = (n: number | null | undefined) => n == null || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("fr-FR");

const RISKS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
const GRADES = ["A", "B", "C", "D"] as const;

const riskColor = (r: string) =>
  r === "HIGH" ? "#c1121f" : r === "MEDIUM" ? "#a8730a" : r === "LOW" ? "#0f8a44" : "#7a8ca6";
const actionColor = (a: string) => {
  if (!a) return "#7a8ca6";
  if (a.includes("SCALE")) return "hsl(226 100% 60%)";
  if (a.includes("LIQUIDATE")) return "#c1121f";
  if (a.includes("BUILD")) return "#0f8a44";
  if (a.includes("DO_NOT")) return "#c1121f";
  return "#a8730a";
};
const actionShort = (a: string) => a?.replace(/_/g, " ") || "—";

const seed: Row[] = [
  { id: uid(), sku: "SKU-293-A", product_name: "Winter Down Jacket (Onyx)", forecasted_units: 1800, available_inventory: 3200, safety_stock: 200, inventory_grade: "A", gross_margin_percent: 46, notes: "" },
  { id: uid(), sku: "SKU-882-C", product_name: "Summer Linen Tee (Sand)", forecasted_units: 400, available_inventory: 4590, safety_stock: 100, inventory_grade: "D", gross_margin_percent: 22, notes: "" },
  { id: uid(), sku: "SKU-104-B", product_name: "Active Legging (Cobalt)", forecasted_units: 1200, available_inventory: 800, safety_stock: 150, inventory_grade: "C", gross_margin_percent: 38, notes: "" },
  { id: uid(), sku: "SKU-771-A", product_name: "Merino Crew Sock 3-pack", forecasted_units: 3200, available_inventory: 900, safety_stock: 400, inventory_grade: "A", gross_margin_percent: 52, notes: "" },
  { id: uid(), sku: "SKU-559-B", product_name: "Trail Runner Cap", forecasted_units: 600, available_inventory: 1100, safety_stock: 100, inventory_grade: "B", gross_margin_percent: 41, notes: "" },
];

export default function SkuDemandPlan() {
  const { selectedClient } = useSelectedClient();
  const [month, setMonth] = useState<string>(toISOMonth(new Date()));
  const [rows, setRows] = useState<Row[]>(seed);
  const [tableOpen, setTableOpen] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"ALL" | typeof RISKS[number]>("ALL");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [source, setSource] = useState<"DEMO" | "SHOPIFY">("DEMO");
  const [shopifyConnId, setShopifyConnId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Map inventory_risk -> letter grade (A best, D worst)
  const riskToGrade = (r: string | null): Row["inventory_grade"] =>
    r === "LOW" ? "A" : r === "MEDIUM" ? "B" : r === "HIGH" ? "C" : r === "CRITICAL" ? "D" : "";

  const loadFromDb = async (clientId: string) => {
    setLoading(true);
    try {
      const [prodRes, invRes, profRes, connRes] = await Promise.all([
        supabase.from("gos_products").select("id, sku, product_name").eq("client_id", clientId),
        supabase
          .from("gos_inventory_snapshots")
          .select("product_id, available_stock, daily_sales_velocity, inventory_risk, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("gos_product_financial_profiles")
          .select("sku, true_gross_margin_percent, product_margin_percent, price, product_cost")
          .eq("client_id", clientId),
        supabase
          .from("gos_integration_connections")
          .select("id, last_sync_at")
          .eq("client_id", clientId)
          .eq("provider", "shopify")
          .maybeSingle(),
      ]);

      setShopifyConnId(connRes.data?.id ?? null);
      setLastSyncAt(connRes.data?.last_sync_at ?? null);

      const products = prodRes.data ?? [];
      if (products.length === 0) {
        setSource("DEMO");
        setRows(seed);
        return;
      }

      // Latest snapshot per product_id
      const latestInv = new Map<string, typeof invRes.data extends (infer T)[] | null ? T : never>();
      for (const s of invRes.data ?? []) {
        if (!latestInv.has(s.product_id)) latestInv.set(s.product_id, s);
      }
      const profBySku = new Map<string, { gm: number | null; price: number | null }>();
      for (const p of profRes.data ?? []) {
        if (!p.sku) continue;
        const gmRaw =
          p.true_gross_margin_percent != null
            ? Number(p.true_gross_margin_percent)
            : p.product_margin_percent != null
            ? Number(p.product_margin_percent)
            : p.price && p.product_cost && Number(p.price) > 0
            ? ((Number(p.price) - Number(p.product_cost)) / Number(p.price)) * 100
            : null;
        profBySku.set(p.sku, {
          gm: gmRaw != null ? Number(gmRaw.toFixed(1)) : null,
          price: p.price != null ? Number(p.price) : null,
        });
      }

      const mapped: Row[] = products.map((p) => {
        const inv = latestInv.get(p.id) as any;
        const velocity = Number(inv?.daily_sales_velocity ?? 0);
        const forecast = velocity > 0 ? Math.round(velocity * 30) : "";
        const prof = p.sku ? profBySku.get(p.sku) : undefined;
        return {
          id: p.id,
          sku: p.sku ?? "",
          product_name: p.product_name ?? "",
          forecasted_units: forecast === "" ? "" : forecast,
          available_inventory: inv?.available_stock != null ? Number(inv.available_stock) : "",
          safety_stock: "",
          inventory_grade: riskToGrade(inv?.inventory_risk ?? null),
          gross_margin_percent: prof?.gm ?? "",
          notes: "",
        };
      });
      setRows(mapped);
      setSource("SHOPIFY");
    } catch (e) {
      console.error("[SkuDemandPlan] loadFromDb", e);
      toast.error("Chargement SKU échoué");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient?.id) loadFromDb(selectedClient.id);
    // eslint-disable-next-line
  }, [selectedClient?.id]);

  const importShopify = async () => {
    if (!shopifyConnId) {
      toast.error("Aucune connexion Shopify pour ce client");
      return;
    }
    setImporting(true);
    const t = toast.loading("Import Shopify en cours…");
    const { data, error } = await supabase.functions.invoke("ingest-shopify", {
      body: { connection_id: shopifyConnId, days: 90 },
    });
    toast.dismiss(t);
    setImporting(false);
    if (error) {
      toast.error(`Import échoué : ${error.message}`);
      return;
    }
    toast.success(
      `Import OK — ${data?.variants_upserted ?? 0} variants · ${data?.inventory_rows ?? 0} snapshots`,
    );
    if (selectedClient?.id) loadFromDb(selectedClient.id);
  };


  const computed = useMemo(() => rows.map((r) => {
    const out = computeSkuDemandPlan({
      forecasted_units: r.forecasted_units === "" ? null : Number(r.forecasted_units),
      available_inventory: r.available_inventory === "" ? null : Number(r.available_inventory),
      safety_stock: r.safety_stock === "" ? null : Number(r.safety_stock),
      inventory_grade: r.inventory_grade === "" ? null : r.inventory_grade,
      gross_margin_percent: r.gross_margin_percent === "" ? null : Number(r.gross_margin_percent),
    });
    return { row: r, out };
  }), [rows]);

  const kpis = useMemo(() => {
    let totalForecast = 0, shortfall = 0, highRisk = 0, weightedGmNum = 0, weightedGmDen = 0;
    computed.forEach(({ row, out }) => {
      const f = Number(row.forecasted_units) || 0;
      totalForecast += f;
      if ((out.projected_inventory_after_plan ?? 0) < 0) shortfall += Math.abs(out.projected_inventory_after_plan ?? 0);
      if (out.inventory_risk === "HIGH") highRisk++;
      const gm = Number(row.gross_margin_percent) || 0;
      weightedGmNum += gm * f;
      weightedGmDen += f;
    });
    return {
      totalForecast,
      shortfall,
      highRisk,
      weightedGm: weightedGmDen > 0 ? weightedGmNum / weightedGmDen : 0,
    };
  }, [computed]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, typeof computed>> = {};
    RISKS.forEach(r => { m[r] = {}; GRADES.forEach(g => { m[r][g] = []; }); });
    computed.forEach((c) => {
      const risk = (RISKS as readonly string[]).includes(c.out.inventory_risk) ? c.out.inventory_risk : "UNKNOWN";
      const grade = c.row.inventory_grade || "D";
      if (m[risk] && m[risk][grade]) m[risk][grade].push(c);
    });
    return m;
  }, [computed]);

  const actionQueue = useMemo(() => {
    const priority = (a: string) => a?.includes("SCALE") ? 0 : a?.includes("LIQUIDATE") ? 1 : a?.includes("BUILD") ? 2 : a?.includes("DO_NOT") ? 3 : 4;
    return [...computed].sort((a, b) => priority(a.out.paid_media_action) - priority(b.out.paid_media_action)).slice(0, 6);
  }, [computed]);

  if (!selectedClient) return <EmptyState title="Sélectionne un client" hint="Plan de demande SKU disponible après sélection." />;

  const addRow = () => setRows((rs) => [...rs, { id: uid(), sku: "", product_name: "", forecasted_units: "", available_inventory: "", safety_stock: "", inventory_grade: "", gross_margin_percent: "", notes: "" }]);
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const update = <K extends keyof Row>(id: string, k: K, v: Row[K]) => setRows((rs) => rs.map((r) => r.id === id ? { ...r, [k]: v } : r));

  const filteredComputed = riskFilter === "ALL" ? computed : computed.filter(c => c.out.inventory_risk === riskFilter);

  return (
    <>
      <SectionHeader
        title="Plan de demande SKU"
        subtitle={`Casser le forecast en attentes unitaires par SKU pour ${selectedClient.company_name}. Le média doit servir ce plan, pas l'inverse.`}
        actions={
          <>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                background: source === "SHOPIFY" ? "#0f8a4422" : "#a8730a22",
                color: source === "SHOPIFY" ? "#0f8a44" : "#a8730a",
                border: `1px solid ${source === "SHOPIFY" ? "#0f8a4455" : "#a8730a55"}`,
              }}
              title={
                source === "SHOPIFY"
                  ? `Sync : ${lastSyncAt ? new Date(lastSyncAt).toLocaleString("fr-FR") : "—"}`
                  : "Données de démo — importe Shopify pour les vraies valeurs"
              }
            >
              {source === "SHOPIFY" ? "SHOPIFY" : "DEMO"}
            </span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--tdia-border)", background: "var(--tdia-surface)", color: "var(--tdia-text)" }} />
            {shopifyConnId && (
              <button className="gos-btn-secondary" onClick={importShopify} disabled={importing || loading}>
                {importing ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}{" "}
                {importing ? "Import…" : "Importer Shopify"}
              </button>
            )}
            <button className="gos-btn-primary" onClick={addRow}><Plus size={14} /> Ajouter SKU</button>
          </>
        }
        guide={{
          purpose: "Aligner forecast, stock et achat média au niveau SKU. Éviter les push d'acquisition sur un SKU dont le stock ne couvre pas la demande.",
          dataSource: source === "SHOPIFY"
            ? `Shopify (${rows.length} SKUs) — forecast = velocity × 30j, stock & risk depuis dernier snapshot.`
            : "Démo. Connecte Shopify pour alimenter forecast, inventaire, GM% automatiquement.",
          usedBy: "Live Optimization (contrainte stock), Growth Diagnosis (CONSTRAINT_PROBLEM), Weekly/Daily P&L.",
        }}
      />

      {/* KPI Ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Kpi label="Total forecast units" value={fmtInt(kpis.totalForecast)} sub={`${computed.length} SKUs planifiés`} />
        <Kpi label="Shortfall units" value={fmtInt(kpis.shortfall)} sub={kpis.shortfall > 0 ? "Exposition critique" : "Aucune exposition"} color={kpis.shortfall > 0 ? "#c1121f" : "var(--tdia-text)"} />
        <Kpi label="SKUs at high risk" value={String(kpis.highRisk)} sub={kpis.highRisk > 0 ? "Action immédiate requise" : "Portfolio sain"} color={kpis.highRisk > 0 ? "#a8730a" : "var(--tdia-text)"} />
        <Kpi label="Weighted GM%" value={`${kpis.weightedGm.toFixed(1)}%`} sub="Pondéré par forecast" color={kpis.weightedGm >= 40 ? "#0f8a44" : kpis.weightedGm >= 25 ? "#a8730a" : "#c1121f"} />
      </div>

      {/* War Room Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start", marginBottom: 24 }}>

        {/* Risk × Grade Heatmap */}
        <div className="gos-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={panelHeader}>
            <span style={panelTitle}>Inventory risk heatmap · Grade × Risk</span>
            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--tdia-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "hsl(226 100% 60%)" }} /> SKU
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "hsl(226 100% 60%)", boxShadow: "none" }} /> High volume
              </span>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto repeat(4, 1fr)", gap: 8 }}>
              <div />
              {GRADES.map(g => (
                <div key={g} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--tdia-muted)", letterSpacing: "0.03em", paddingBottom: 4 }}>GRADE {g}</div>
              ))}
              {RISKS.map(risk => (
                <>
                  <div key={`${risk}-lbl`} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, fontSize: 10, fontWeight: 700, color: riskColor(risk), letterSpacing: "0.04em" }}>{risk}</div>
                  {GRADES.map(grade => {
                    const cell = matrix[risk][grade];
                    const isFocus = cell.length > 0 && ((risk === "HIGH") || (risk === "MEDIUM" && grade !== "A") || (risk === "LOW" && grade === "C"));
                    const border = isFocus ? `1px solid ${riskColor(risk)}55` : "1px solid var(--tdia-border)";
                    const bg = isFocus ? `${riskColor(risk)}14` : "hsl(220 45% 16%)";
                    const maxUnits = Math.max(1, ...cell.map(c => Number(c.row.forecasted_units) || 0));
                    return (
                      <div key={`${risk}-${grade}`} style={{ border, background: bg, borderRadius: 8, padding: 8, minHeight: 74, display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 6 }}>
                        {cell.map(c => {
                          const u = Number(c.row.forecasted_units) || 0;
                          const intensity = 0.35 + 0.65 * (u / maxUnits);
                          return (
                            <span
                              key={c.row.id}
                              title={`${c.row.sku || "(no sku)"} — ${c.row.product_name} · ${fmtInt(u)}u · ${actionShort(c.out.paid_media_action)}`}
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                background: `hsl(226 100% 60% / ${intensity})`,
                                boxShadow: intensity > 0.7 ? "0 0 8px hsl(226 100% 60% / 0.55)" : "none",
                                cursor: "pointer",
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>

        {/* Action Queue */}
        <div className="gos-card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={panelHeader}>
            <span style={panelTitle}>Action queue · priorité</span>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 460, overflowY: "auto" }}>
            {actionQueue.length === 0 && <div style={{ fontSize: 12, color: "var(--tdia-muted)", padding: 16, textAlign: "center" }}>Aucune action</div>}
            {actionQueue.map(({ row, out }) => {
              const c = actionColor(out.paid_media_action);
              return (
                <div key={row.id} style={{ background: "hsl(0 0% 98.8% / 0.5)", padding: 12, borderRadius: 8, borderLeft: `4px solid ${c}`, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c, letterSpacing: "0.03em" }}>{actionShort(out.paid_media_action)}</span>
                    <span style={{ fontSize: 10, color: "var(--tdia-muted)", fontFamily: "JetBrains Mono, monospace" }}>{row.sku || "—"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--tdia-text)", fontWeight: 500 }}>{row.product_name || "(sans nom)"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--tdia-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                      Stock: {fmtInt(Number(row.available_inventory) || 0)}u · Proj: {fmtInt(out.projected_inventory_after_plan)}
                    </span>
                    <span style={{ padding: "2px 8px", background: `${riskColor(out.inventory_risk)}22`, color: riskColor(out.inventory_risk), border: `1px solid ${riskColor(out.inventory_risk)}55`, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{out.inventory_risk}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: 12, borderTop: "1px solid var(--tdia-border)", background: "hsl(0 0% 98.8% / 0.4)", textAlign: "center", fontSize: 10, color: "var(--tdia-muted)", fontWeight: 600 }}>
            {Math.max(0, computed.length - actionQueue.length)} SKUs additionnels en file
          </div>
        </div>
      </div>

      {/* Collapsible Ledger */}
      <div className="gos-card" style={{ padding: 0, overflow: "hidden" }}>
        <button onClick={() => setTableOpen(o => !o)} style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", color: "var(--tdia-text)", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {tableOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>Detailed SKU demand plan ledger</span>
            <span style={{ fontSize: 10, color: "var(--tdia-muted)" }}>{computed.length} lignes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: 10, color: "var(--tdia-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Filter:</span>
            {(["ALL", ...RISKS] as const).map(f => (
              <button key={f} onClick={() => setRiskFilter(f)} style={{
                padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                border: `1px solid ${riskFilter === f ? (f === "ALL" ? "hsl(226 100% 60%)" : riskColor(f)) : "var(--tdia-border)"}`,
                background: riskFilter === f ? (f === "ALL" ? "hsl(226 100% 60% / 0.15)" : `${riskColor(f)}22`) : "transparent",
                color: riskFilter === f ? (f === "ALL" ? "hsl(226 100% 60%)" : riskColor(f)) : "var(--tdia-muted)",
                cursor: "pointer",
              }}>{f}</button>
            ))}
          </div>
        </button>

        {tableOpen && (
          <div style={{ overflowX: "auto", borderTop: "1px solid var(--tdia-border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "hsl(220 45% 16%)", color: "var(--tdia-muted)", textAlign: "left" }}>
                  <th style={th}>SKU</th>
                  <th style={th}>Produit</th>
                  <th style={th}>Forecast</th>
                  <th style={th}>Stock</th>
                  <th style={th}>Safety</th>
                  <th style={th}>Grade</th>
                  <th style={th}>GM %</th>
                  <th style={th}>Projected</th>
                  <th style={th}>Risk</th>
                  <th style={th}>Media action</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredComputed.map(({ row: r, out }) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--tdia-border)" }}>
                    <td style={td}><input value={r.sku} onChange={(e) => update(r.id, "sku", e.target.value)} style={inp} /></td>
                    <td style={td}><input value={r.product_name} onChange={(e) => update(r.id, "product_name", e.target.value)} style={inp} /></td>
                    <td style={td}><input type="number" value={r.forecasted_units} onChange={(e) => update(r.id, "forecasted_units", e.target.value === "" ? "" : Number(e.target.value))} style={inpMono} /></td>
                    <td style={td}><input type="number" value={r.available_inventory} onChange={(e) => update(r.id, "available_inventory", e.target.value === "" ? "" : Number(e.target.value))} style={inpMono} /></td>
                    <td style={td}><input type="number" value={r.safety_stock} onChange={(e) => update(r.id, "safety_stock", e.target.value === "" ? "" : Number(e.target.value))} style={inpMono} /></td>
                    <td style={td}>
                      <select value={r.inventory_grade} onChange={(e) => update(r.id, "inventory_grade", e.target.value as Row["inventory_grade"])} style={inp}>
                        <option value="">—</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                      </select>
                    </td>
                    <td style={td}><input type="number" value={r.gross_margin_percent} onChange={(e) => update(r.id, "gross_margin_percent", e.target.value === "" ? "" : Number(e.target.value))} style={inpMono} /></td>
                    <td style={{ ...tdMono, fontWeight: 600, color: (out.projected_inventory_after_plan ?? 0) < 0 ? "#c1121f" : "var(--tdia-text)" }}>{fmtInt(out.projected_inventory_after_plan)}</td>
                    <td style={td}>
                      <span style={{ background: `${riskColor(out.inventory_risk)}22`, color: riskColor(out.inventory_risk), border: `1px solid ${riskColor(out.inventory_risk)}55`, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{out.inventory_risk}</span>
                    </td>
                    <td style={{ ...td, fontSize: 11, fontWeight: 600, color: actionColor(out.paid_media_action) }}>{actionShort(out.paid_media_action)}</td>
                    <td style={td}>
                      <button onClick={() => removeRow(r.id)} className="gos-btn-secondary" style={{ padding: "4px 6px" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--tdia-muted)" }}>
        Règles : projected &lt; 0 → DO_NOT_PUSH + redirection. Grade D → LIQUIDATE_INVENTORY. Grade C → BUILD_DEDICATED_FUNNEL. Grade A + GM ≥ 40% → SCALE.
      </div>
    </>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="gos-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--tdia-muted)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: color || "var(--tdia-text)" }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 500 }}>{sub}</span>
    </div>
  );
}

const panelHeader: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--tdia-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "hsl(220 45% 16%)" };
const panelTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--tdia-muted)" };
const th: React.CSSProperties = { padding: "10px 8px", fontWeight: 700, fontSize: 10, letterSpacing: "0.03em", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "6px 8px", color: "var(--tdia-text)" };
const tdMono: React.CSSProperties = { padding: "6px 8px", color: "var(--tdia-text)", fontFamily: "JetBrains Mono, monospace", textAlign: "right" };
const inp: React.CSSProperties = { width: "100%", padding: "4px 6px", borderRadius: 4, border: "1px solid var(--tdia-border)", fontSize: 12, background: "hsl(220 45% 14%)", color: "var(--tdia-text)" };
const inpMono: React.CSSProperties = { ...inp, fontFamily: "JetBrains Mono, monospace", textAlign: "right" };
