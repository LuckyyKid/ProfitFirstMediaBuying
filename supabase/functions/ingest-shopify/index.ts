// Wave 10H.1 — Shopify Admin API ingestion
// Pulls last 90 days of orders and upserts daily revenue/orders snapshots into gos_measurement_snapshots.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { readConnectionSecret } from "../_shared/vault.ts";

interface RequestBody {
  connection_id: string;
  days?: number;
}

interface ShopifyLineItem {
  sku: string | null;
  quantity: number;
  variant_id: number | null;
  product_id: number | null;
  price: string | null;
  name: string | null;
}

interface ShopifyOrder {
  id: number;
  created_at: string;
  cancelled_at: string | null;
  financial_status: string | null;
  current_total_price: string;
  current_subtotal_price: string;
  customer?: { id?: number | null } | null;
  line_items?: ShopifyLineItem[];
}

interface ShopifyVariant {
  id: number;
  sku: string | null;
  title: string | null;
  price: string | null;
  inventory_item_id: number | null;
  inventory_quantity: number | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  status: string;
  variants: ShopifyVariant[];
}

const SHOPIFY_API_VERSION = "2025-07";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.connection_id) {
      return json({ error: "connection_id required" }, 400);
    }
    const days = Math.min(Math.max(body.days ?? 90, 1), 365);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load connection
    const { data: conn, error: connErr } = await supabase
      .from("gos_integration_connections")
      .select("*")
      .eq("id", body.connection_id)
      .maybeSingle();

    if (connErr || !conn) return json({ error: "connection not found" }, 404);
    if (conn.provider !== "shopify") return json({ error: "connection is not shopify" }, 400);

    const shopDomain: string = (conn.config?.shop_domain || "").toString().trim();
    const creds = (await readConnectionSecret(supabase, conn.vault_secret_id)) || {};
    const accessToken: string = ((creds as Record<string, unknown>).admin_access_token || "").toString().trim();
    if (!shopDomain || !accessToken) {
      return json({ error: "missing shop_domain or admin_access_token" }, 400);
    }

    // Log run start
    const { data: runRow } = await supabase
      .from("gos_integration_sync_runs")
      .insert({
        connection_id: conn.id,
        client_id: conn.client_id,
        provider: "shopify",
        status: "running",
      })
      .select("id")
      .single();

    const runId = runRow?.id as string | undefined;

    try {
      const sinceIso = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const orders = await fetchAllOrders(shopDomain, accessToken, sinceIso);

      // Aggregate by day (YYYY-MM-DD)
      type DayAgg = { orders: number; revenue: number; customers: Set<string | number> };
      const byDay = new Map<string, DayAgg>();
      for (const o of orders) {
        if (o.cancelled_at) continue;
        const day = o.created_at.slice(0, 10);
        const revenue = parseFloat(o.current_total_price || o.current_subtotal_price || "0");
        if (!byDay.has(day)) byDay.set(day, { orders: 0, revenue: 0, customers: new Set() });
        const agg = byDay.get(day)!;
        agg.orders += 1;
        agg.revenue += isNaN(revenue) ? 0 : revenue;
        const cid = o.customer?.id;
        if (cid != null) agg.customers.add(cid);
      }

      // Upsert daily snapshots — schema uses period_start/period_end + actual_* columns
      let rowsIngested = 0;
      const snapshots: Array<Record<string, unknown>> = [];
      for (const [day, agg] of byDay.entries()) {
        const aov = agg.orders > 0 ? Number((agg.revenue / agg.orders).toFixed(2)) : null;
        snapshots.push({
          client_id: conn.client_id,
          period_label: day,
          period_start: day,
          period_end: day,
          actual_revenue: Number(agg.revenue.toFixed(2)),
          actual_orders: agg.orders,
          notes: `shopify_api · ${agg.customers.size} unique customers · AOV ${aov ?? "n/a"}`,
        });
      }

      if (snapshots.length > 0) {
        const days = [...byDay.keys()];
        // Idempotent replace: delete same-day rows previously ingested from Shopify (notes prefix)
        await supabase
          .from("gos_measurement_snapshots")
          .delete()
          .eq("client_id", conn.client_id)
          .in("period_start", days)
          .like("notes", "shopify_api%");

        const { error: insErr } = await supabase.from("gos_measurement_snapshots").insert(snapshots);
        if (insErr) throw new Error(`insert snapshots: ${insErr.message}`);
        rowsIngested = snapshots.length;
      }

      // ---- Products, variants & inventory ingestion ----
      console.log(`[ingest-shopify] Fetching products for ${shopDomain}...`);
      const products = await fetchAllProducts(shopDomain, accessToken);
      console.log(`[ingest-shopify] Fetched ${products.length} products`);

      // Compute per-SKU sales velocity from orders in window
      const skuUnits = new Map<string, number>();
      for (const o of orders) {
        if (o.cancelled_at) continue;
        for (const li of o.line_items || []) {
          const sku = (li.sku || "").trim();
          if (!sku) continue;
          skuUnits.set(sku, (skuUnits.get(sku) || 0) + (li.quantity || 0));
        }
      }

      // Load existing products for this client (to upsert by SKU)
      const { data: existingProducts } = await supabase
        .from("gos_products")
        .select("id, sku, product_name")
        .eq("client_id", conn.client_id);
      const bySku = new Map<string, { id: string; product_name: string }>();
      for (const p of existingProducts || []) {
        if (p.sku) bySku.set(p.sku, { id: p.id, product_name: p.product_name });
      }

      // Flatten variants -> product rows keyed by SKU
      const productUpserts: Array<{ sku: string; product_name: string; price: number | null; variant: ShopifyVariant }> = [];
      for (const prod of products) {
        for (const v of prod.variants || []) {
          const sku = (v.sku || "").trim();
          if (!sku) continue;
          const name = v.title && v.title !== "Default Title" ? `${prod.title} — ${v.title}` : prod.title;
          const price = v.price ? parseFloat(v.price) : null;
          productUpserts.push({ sku, product_name: name, price: price != null && !isNaN(price) ? price : null, variant: v });
        }
      }
      console.log(`[ingest-shopify] ${productUpserts.length} variants with SKU to upsert`);

      // Insert missing products, update existing names/prices
      const toInsert: Array<Record<string, unknown>> = [];
      const toUpdate: Array<{ id: string; product_name: string }> = [];
      for (const u of productUpserts) {
        const existing = bySku.get(u.sku);
        if (existing) {
          if (existing.product_name !== u.product_name) {
            toUpdate.push({ id: existing.id, product_name: u.product_name });
          }
        } else {
          toInsert.push({ client_id: conn.client_id, sku: u.sku, product_name: u.product_name });
        }
      }
      if (toInsert.length) {
        const { data: inserted, error: insProdErr } = await supabase
          .from("gos_products")
          .insert(toInsert)
          .select("id, sku, product_name");
        if (insProdErr) console.error(`[ingest-shopify] insert products error: ${insProdErr.message}`);
        for (const p of inserted || []) {
          if (p.sku) bySku.set(p.sku, { id: p.id, product_name: p.product_name });
        }
      }
      for (const u of toUpdate) {
        await supabase.from("gos_products").update({ product_name: u.product_name }).eq("id", u.id);
      }

      // Upsert financial profile (price only — costs stay MANUAL)
      const { data: existingProfiles } = await supabase
        .from("gos_product_financial_profiles")
        .select("id, sku")
        .eq("client_id", conn.client_id);
      const profileBySku = new Map<string, string>();
      for (const p of existingProfiles || []) {
        if (p.sku) profileBySku.set(p.sku, p.id);
      }
      const profileInserts: Array<Record<string, unknown>> = [];
      for (const u of productUpserts) {
        const prodRow = bySku.get(u.sku);
        if (!prodRow) continue;
        const existingProfileId = profileBySku.get(u.sku);
        if (existingProfileId) {
          if (u.price != null) {
            await supabase
              .from("gos_product_financial_profiles")
              .update({ price: u.price, product_id: prodRow.id })
              .eq("id", existingProfileId);
          }
        } else {
          profileInserts.push({
            client_id: conn.client_id,
            product_id: prodRow.id,
            sku: u.sku,
            price: u.price,
          });
        }
      }
      if (profileInserts.length) {
        const { error: insProfErr } = await supabase
          .from("gos_product_financial_profiles")
          .insert(profileInserts);
        if (insProfErr) console.error(`[ingest-shopify] insert profiles error: ${insProfErr.message}`);
      }

      // Inventory snapshots — one row per SKU (using variant.inventory_quantity)
      const invRows: Array<Record<string, unknown>> = [];
      const windowDays = Math.max(days, 1);
      for (const u of productUpserts) {
        const prodRow = bySku.get(u.sku);
        if (!prodRow) continue;
        const available = u.variant.inventory_quantity ?? null;
        const unitsSold = skuUnits.get(u.sku) || 0;
        const velocity = unitsSold / windowDays;
        let risk: string | null = null;
        if (available != null && velocity > 0) {
          const daysCover = available / velocity;
          if (daysCover < 7) risk = "CRITICAL";
          else if (daysCover < 21) risk = "HIGH";
          else if (daysCover < 45) risk = "MEDIUM";
          else risk = "LOW";
        }
        invRows.push({
          client_id: conn.client_id,
          product_id: prodRow.id,
          available_stock: available,
          daily_sales_velocity: Number(velocity.toFixed(4)),
          inventory_risk: risk,
          safe_to_scale: risk === "LOW" || risk === "MEDIUM",
          notes: `shopify_api snapshot (${windowDays}d window, ${unitsSold} units sold)`,
        });
      }
      if (invRows.length) {
        // Replace latest snapshot batch for cleanliness (keep history: only delete same-day inserts)
        const today = new Date().toISOString().slice(0, 10);
        await supabase
          .from("gos_inventory_snapshots")
          .delete()
          .eq("client_id", conn.client_id)
          .gte("created_at", `${today}T00:00:00Z`);
        const { error: invErr } = await supabase.from("gos_inventory_snapshots").insert(invRows);
        if (invErr) console.error(`[ingest-shopify] insert inventory error: ${invErr.message}`);
        else console.log(`[ingest-shopify] Inserted ${invRows.length} inventory snapshots`);
      }

      // Update connection
      const now = new Date().toISOString();
      await supabase
        .from("gos_integration_connections")
        .update({
          status: "connected",
          last_sync_at: now,
          last_sync_status: "success",
          next_sync_at: new Date(Date.now() + (conn.sync_frequency_hours || 24) * 3600 * 1000).toISOString(),
        })
        .eq("id", conn.id);

      // Upsert data_sources card (insert if missing, else update sync info)
      const { data: existingSrc } = await supabase
        .from("gos_data_sources")
        .select("id")
        .eq("client_id", conn.client_id)
        .eq("source_type", "SHOPIFY")
        .maybeSingle();
      if (existingSrc?.id) {
        await supabase
          .from("gos_data_sources")
          .update({
            last_sync_at: now,
            data_freshness_status: "FRESH",
            connection_mode: "API_CONNECTED",
            connection_status: "CONNECTED",
          })
          .eq("id", existingSrc.id);
      } else {
        await supabase.from("gos_data_sources").insert({
          client_id: conn.client_id,
          source_type: "SHOPIFY",
          source_name: `Shopify — ${shopDomain}`,
          connection_mode: "API_CONNECTED",
          connection_status: "CONNECTED",
          data_freshness_status: "FRESH",
          reliability_score: 90,
          last_sync_at: now,
          feeds: "orders, products, variants, inventory",
          notes: `Auto-créé par sync Shopify (${shopDomain})`,
        });
      }

      if (runId) {
        await supabase
          .from("gos_integration_sync_runs")
          .update({
            status: "success",
            finished_at: now,
            rows_ingested: rowsIngested,
            metadata: {
              orders_fetched: orders.length,
              days_covered: byDay.size,
              window_days: days,
            },
          })
          .eq("id", runId);
      }

      return json({
        ok: true,
        rows_ingested: rowsIngested,
        orders_fetched: orders.length,
        days_covered: byDay.size,
        products_fetched: products.length,
        variants_upserted: productUpserts.length,
        inventory_rows: invRows.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (runId) {
        await supabase
          .from("gos_integration_sync_runs")
          .update({ status: "failed", finished_at: new Date().toISOString(), error_message: msg })
          .eq("id", runId);
      }
      await supabase
        .from("gos_integration_connections")
        .update({ status: "error", last_sync_status: "failed", last_sync_at: new Date().toISOString() })
        .eq("id", conn.id);
      return json({ error: msg }, 500);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

async function fetchAllOrders(
  shopDomain: string,
  accessToken: string,
  sinceIso: string,
): Promise<ShopifyOrder[]> {
  const all: ShopifyOrder[] = [];
  let url: string | null =
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&created_at_min=${encodeURIComponent(sinceIso)}&limit=250&fields=id,created_at,cancelled_at,financial_status,current_total_price,current_subtotal_price,customer,line_items`;

  // Cap pagination to avoid runaway
  for (let page = 0; page < 40 && url; page++) {
    const res: Response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = (await res.json()) as { orders: ShopifyOrder[] };
    all.push(...(data.orders || []));
    // Parse Link header for next page (Shopify cursor pagination)
    const link = res.headers.get("Link") || res.headers.get("link") || "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }
  return all;
}

async function fetchAllProducts(
  shopDomain: string,
  accessToken: string,
): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  let url: string | null =
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250&fields=id,title,status,variants`;

  for (let page = 0; page < 40 && url; page++) {
    const res: Response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify Products API ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = (await res.json()) as { products: ShopifyProduct[] };
    all.push(...(data.products || []));
    const link = res.headers.get("Link") || res.headers.get("link") || "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }
  return all;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
