import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const METRICS: { key: string; label: string; unit: string }[] = [
  { key: "revenue", label: "Revenue", unit: "€" },
  { key: "ad_spend", label: "Ad Spend", unit: "€" },
  { key: "orders", label: "Orders", unit: "" },
  { key: "roas", label: "ROAS", unit: "x" },
  { key: "mer", label: "MER", unit: "x" },
  { key: "cac", label: "CAC", unit: "€" },
  { key: "aov", label: "AOV", unit: "€" },
  { key: "cvr", label: "CVR", unit: "%" },
];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function textToHtml(s: string | null | undefined): string {
  if (!s) return '<span style="color:#94a3b8">—</span>';
  return esc(s).replace(/\n/g, "<br/>");
}

function buildHtml(report: any, clientName: string, conceptById: Map<string, string>): string {
  const m = report.metrics_snapshot ?? {};
  const metricRows = METRICS
    .filter(mm => m[mm.key] !== undefined && m[mm.key] !== null && m[mm.key] !== "")
    .map(mm => {
      const target = m[`${mm.key}_target`];
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${mm.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${esc(String(m[mm.key]))}${mm.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#64748b">${target ? `cible ${esc(String(target))}${mm.unit}` : ""}</td>
      </tr>`;
    }).join("");

  const winners = (report.winner_concept_ids ?? []).map((id: string) => conceptById.get(id)).filter(Boolean);
  const losers = (report.loser_concept_ids ?? []).map((id: string) => conceptById.get(id)).filter(Boolean);

  const section = (title: string, body: string | null | undefined, color = "#0f172a") => `
    <h2 style="font-size:15px;color:${color};margin:24px 0 8px 0;padding-bottom:6px;border-bottom:2px solid #e2e8f0;font-family:Arial,sans-serif">${title}</h2>
    <div style="color:#1e293b;font-size:14px;line-height:1.6;font-family:Arial,sans-serif">${textToHtml(body)}</div>
  `;

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif">
    <div style="max-width:680px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Rapport hebdomadaire · ${esc(clientName)}</div>
        <h1 style="margin:6px 0 4px 0;font-size:22px;color:#0f172a">${esc(report.title ?? "Weekly Executive Report")}</h1>
        <div style="font-size:13px;color:#64748b">${report.week_start} → ${report.week_end}</div>
      </div>

      ${section("Résumé exécutif", report.executive_summary)}

      ${metricRows ? `
        <h2 style="font-size:15px;color:#0f172a;margin:24px 0 8px 0;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Performance</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${metricRows}</table>
      ` : ""}

      ${report.performance_highlights ? section("Faits marquants", report.performance_highlights) : ""}
      ${section("Wins de la semaine", report.key_wins, "#16a34a")}
      ${section("Défis & apprentissages", report.key_challenges, "#d97706")}
      ${section("Décisions Wayfinder", report.wayfinder_decisions, "#7c3aed")}

      ${(winners.length || losers.length) ? `
        <h2 style="font-size:15px;color:#0f172a;margin:24px 0 8px 0;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Créatifs</h2>
        ${winners.length ? `<div style="font-size:14px;margin:6px 0"><strong style="color:#16a34a">Winners à scaler :</strong> ${winners.map((w: string) => esc(w)).join(", ")}</div>` : ""}
        ${losers.length ? `<div style="font-size:14px;margin:6px 0"><strong style="color:#dc2626">Losers coupés :</strong> ${losers.map((l: string) => esc(l)).join(", ")}</div>` : ""}
      ` : ""}

      ${section("Priorités semaine prochaine", report.next_week_priorities, "#2563eb")}
      ${report.blockers ? section("Blockers / risques", report.blockers, "#dc2626") : ""}
      ${report.asks_to_client ? section("Demandes au client", report.asks_to_client, "#0891b2") : ""}

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
        Envoyé via TDIA · Growth OS
      </div>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const reportId = body?.report_id;
    const overrideTo: string[] | undefined = body?.recipients;

    if (!reportId) {
      return new Response(JSON.stringify({ error: "report_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-scoped client for auth check
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the report through the user client to enforce RLS
    const { data: report, error: repErr } = await userClient
      .from("gos_weekly_executive_reports")
      .select("*")
      .eq("id", reportId)
      .single();
    if (repErr || !report) {
      return new Response(JSON.stringify({ error: repErr?.message ?? "Report not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for reads that don't need RLS scope on the same query
    const svc = createClient(supabaseUrl, serviceKey);
    const [{ data: client }, { data: concepts }] = await Promise.all([
      svc.from("gos_clients").select("company_name").eq("id", report.client_id).single(),
      svc.from("gos_concept_log").select("id,concept_name").eq("client_id", report.client_id),
    ]);

    const conceptMap = new Map<string, string>((concepts ?? []).map((c: any) => [c.id, c.concept_name]));
    const html = buildHtml(report, client?.company_name ?? "Client", conceptMap);
    const subject = report.title || `Rapport hebdo ${report.week_start} → ${report.week_end}`;

    const recipients = (overrideTo && overrideTo.length ? overrideTo : report.recipients) as string[];
    if (!recipients?.length) {
      return new Response(JSON.stringify({ error: "No recipients configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const to of recipients) {
      try {
        const r = await sendResendEmail({ apiKey: resendKey, from, to, subject, html });
        results.push({ to, ok: true, ...r });
      } catch (e) {
        results.push({ to, ok: false, error: (e as Error).message });
      }
    }

    const anyOk = results.some(r => r.ok);
    if (anyOk) {
      await svc.from("gos_weekly_executive_reports")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: userData.user.id })
        .eq("id", reportId);
    }

    return new Response(JSON.stringify({ success: anyOk, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
