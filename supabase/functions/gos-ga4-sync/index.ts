// GA4 sync — last N days (default 30) of daily metrics into gos_measurement_snapshots.
// Also refreshes gos_data_sources GA4 row (Data Quality) and stamps gos_client_intelligence_snapshots key_metrics.ga4.
// POST { connection_id, days? }

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFreshAccessToken, serviceClient } from "../_shared/google-oauth.ts";

interface GA4RunReportRow {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const connectionId: string | undefined = body?.connection_id;
    const days = Math.min(Math.max(Number(body?.days ?? 30), 1), 90);
    if (!connectionId) return json({ error: "connection_id required" }, 400);

    const supabase = serviceClient();
    const { accessToken, connection } = await getFreshAccessToken(supabase, connectionId);
    if (connection.provider !== "ga4") return json({ error: "connection is not ga4" }, 400);

    const config = (connection.config || {}) as Record<string, unknown>;
    const propertyId = String(config.property_id || "");
    if (!propertyId) return json({ error: "property_id not set on connection — pick a GA4 property first" }, 400);

    // Log run
    const { data: runRow } = await supabase
      .from("gos_integration_sync_runs")
      .insert({
        connection_id: connectionId,
        client_id: connection.client_id,
        provider: "ga4",
        status: "running",
      })
      .select("id")
      .single();
    const runId = runRow?.id as string | undefined;

    try {
      // GA4 Data API v1beta runReport
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days - 1) * 24 * 3600 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const reportBody = {
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "transactions" },
          { name: "purchaseRevenue" },
          { name: "conversions" },
        ],
        limit: 10000,
      };

      const rptRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reportBody),
        },
      );
      if (!rptRes.ok) {
        throw new Error(`GA4 runReport ${rptRes.status}: ${(await rptRes.text()).slice(0, 500)}`);
      }
      const rpt = await rptRes.json() as { rows?: GA4RunReportRow[] };
      const rows = rpt.rows || [];

      // Parse rows -> per-day snapshots + totals for intelligence
      const parsed = rows.map((r) => {
        const dateStr = r.dimensionValues[0]?.value || ""; // YYYYMMDD
        const day = dateStr.length === 8
          ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
          : dateStr;
        const m = r.metricValues.map((v) => Number(v.value || 0));
        return {
          day,
          sessions: m[0] || 0,
          totalUsers: m[1] || 0,
          newUsers: m[2] || 0,
          transactions: m[3] || 0,
          purchaseRevenue: m[4] || 0,
          conversions: m[5] || 0,
        };
      }).filter(p => p.day);

      // Totals for intelligence snapshot
      const totals = parsed.reduce((acc, p) => ({
        sessions: acc.sessions + p.sessions,
        totalUsers: acc.totalUsers + p.totalUsers,
        newUsers: acc.newUsers + p.newUsers,
        transactions: acc.transactions + p.transactions,
        purchaseRevenue: acc.purchaseRevenue + p.purchaseRevenue,
        conversions: acc.conversions + p.conversions,
      }), { sessions: 0, totalUsers: 0, newUsers: 0, transactions: 0, purchaseRevenue: 0, conversions: 0 });

      // Idempotent replace: delete daily rows in window, then re-insert.
      const startISO = fmt(startDate);
      const endISO = fmt(endDate);
      await supabase
        .from("gos_measurement_snapshots")
        .delete()
        .eq("client_id", connection.client_id)
        .eq("period_label", "ga4_daily")
        .gte("period_start", startISO)
        .lte("period_end", endISO);

      const snapshots = parsed.map((p) => ({
        client_id: connection.client_id,
        period_label: "ga4_daily",
        period_start: p.day,
        period_end: p.day,
        actual_revenue: Number(p.purchaseRevenue.toFixed(2)),
        actual_orders: p.transactions,
        actual_leads: p.conversions,
        actual_cvr: p.sessions > 0 ? Number((p.transactions / p.sessions).toFixed(6)) : null,
        notes: `GA4 property ${propertyId} · sessions=${p.sessions} users=${p.totalUsers}`,
      }));

      let rowsIngested = 0;
      if (snapshots.length > 0) {
        const { error: insErr } = await supabase.from("gos_measurement_snapshots").insert(snapshots);
        if (insErr) throw new Error(`insert snapshots: ${insErr.message}`);
        rowsIngested = snapshots.length;
      }

      const now = new Date().toISOString();

      // Update connection
      await supabase
        .from("gos_integration_connections")
        .update({
          status: "connected",
          last_sync_at: now,
          last_sync_status: "success",
          next_sync_at: new Date(Date.now() + ((connection as { sync_frequency_hours?: number }).sync_frequency_hours || 24) * 3600 * 1000).toISOString(),
        })
        .eq("id", connectionId);

      // Update / upsert Data Quality (gos_data_sources GA4 row)
      const { data: existingDS } = await supabase
        .from("gos_data_sources")
        .select("id")
        .eq("client_id", connection.client_id)
        .eq("source_type", "GA4")
        .maybeSingle();

      const dsPatch = {
        client_id: connection.client_id,
        source_type: "GA4",
        source_name: (config.property_display_name as string) || `GA4 · ${propertyId}`,
        connection_mode: "API_CONNECTED",
        connection_status: "CONNECTED",
        data_freshness_status: "FRESH",
        last_sync_at: now,
        reliability_score: 90,
        feeds: "sessions, users, transactions, purchase revenue, conversions",
      };
      if (existingDS?.id) {
        await supabase.from("gos_data_sources").update(dsPatch).eq("id", existingDS.id);
      } else {
        await supabase.from("gos_data_sources").insert(dsPatch);
      }

      // Update / insert today's client intelligence snapshot with GA4 key_metrics
      const today = fmt(new Date());
      const { data: existingCI } = await supabase
        .from("gos_client_intelligence_snapshots")
        .select("id, key_metrics")
        .eq("client_id", connection.client_id)
        .eq("snapshot_date", today)
        .maybeSingle();

      const ga4Block = {
        property_id: propertyId,
        property_display_name: config.property_display_name || null,
        window_days: days,
        sessions: totals.sessions,
        total_users: totals.totalUsers,
        new_users: totals.newUsers,
        transactions: totals.transactions,
        purchase_revenue: Number(totals.purchaseRevenue.toFixed(2)),
        conversions: totals.conversions,
        avg_daily_sessions: parsed.length > 0 ? Math.round(totals.sessions / parsed.length) : 0,
        cvr: totals.sessions > 0 ? Number((totals.transactions / totals.sessions).toFixed(6)) : null,
        synced_at: now,
      };

      if (existingCI?.id) {
        const prev = (existingCI.key_metrics || {}) as Record<string, unknown>;
        await supabase
          .from("gos_client_intelligence_snapshots")
          .update({ key_metrics: { ...prev, ga4: ga4Block }, computed_by: "ga4_sync", updated_at: now })
          .eq("id", existingCI.id);
      } else {
        await supabase.from("gos_client_intelligence_snapshots").insert({
          client_id: connection.client_id,
          snapshot_date: today,
          key_metrics: { ga4: ga4Block },
          computed_by: "ga4_sync",
        });
      }

      if (runId) {
        await supabase
          .from("gos_integration_sync_runs")
          .update({
            status: "success",
            finished_at: now,
            rows_ingested: rowsIngested,
            metadata: { property_id: propertyId, days, totals },
          })
          .eq("id", runId);
      }

      return json({ ok: true, rows_ingested: rowsIngested, days_covered: parsed.length, totals });
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
        .eq("id", connectionId);
      return json({ error: msg }, 500);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
