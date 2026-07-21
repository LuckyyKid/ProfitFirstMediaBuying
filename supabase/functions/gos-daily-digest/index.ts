// Daily Digest 7am — envoie un résumé quotidien par client à ses destinataires.
// Contenu : MTD vs Target/Projection, hier vs cible journalière, notes du jour précédent.
// Déclenchement : cron pg_cron à 11:00 UTC (~7h EST) OU appel manuel avec { client_id, override_to }.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";

const fmt = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const pct = (target: number | null, actual: number | null): number | null => {
  if (target == null || actual == null || Number(target) === 0) return null;
  return Number((((Number(actual) - Number(target)) / Number(target)) * 100).toFixed(1));
};
const varColor = (v: number | null, invert = false) => {
  if (v == null) return "#8393B4";
  const positive = invert ? v <= 0 : v >= 0;
  return positive ? "#22c55e" : "#ef4444";
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function renderDigestHtml(opts: {
  companyName: string;
  digestDate: string; // yesterday ISO
  mtd: { target: any; projection: any; actual: any };
  yesterday: any | null;
  notes: Array<{ role: string; scope: string; what: string | null; so_what: string | null; now_what: string | null; is_signal: boolean }>;
  workspaceUrl: string;
}) {
  const BG = "#020617", CARD = "#0B1327", BORDER = "#1B294A", TEXT = "#FFFFFF", BODY = "#C9D4EA", MUTED = "#8393B4", ACCENT = "#2E7BFF";
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,Helvetica,Arial,sans-serif";

  const mtdRow = (label: string, key: string, invert = false) => {
    const t = opts.mtd.target[key];
    const p = opts.mtd.projection[key];
    const a = opts.mtd.actual[key];
    const vT = pct(t, a); const vP = pct(p, a);
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};color:${BODY};font-family:${SANS};font-size:13px;">${esc(label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};text-align:right;font-family:${SANS};color:${TEXT};font-size:13px;">${fmt(a)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};text-align:right;font-family:${SANS};color:${MUTED};font-size:13px;">${fmt(t)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};text-align:right;font-family:${SANS};color:${varColor(vT, invert)};font-size:13px;font-weight:700;">${vT == null ? "—" : (vT >= 0 ? "+" : "") + vT + "%"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};text-align:right;font-family:${SANS};color:${varColor(vP, invert)};font-size:13px;">${vP == null ? "—" : (vP >= 0 ? "+" : "") + vP + "%"}</td>
    </tr>`;
  };

  const y = opts.yesterday;
  const yRow = y
    ? ["revenue", "ad_spend", "orders", "leads"].map((k) => {
        const label = { revenue: "Revenu", ad_spend: "Ad spend", orders: "Commandes", leads: "Leads" }[k]!;
        const t = y[`target_${k}`]; const a = y[`actual_${k}`]; const v = pct(t, a);
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${BODY};font-family:${SANS};font-size:12px;">${label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};text-align:right;color:${TEXT};font-family:${SANS};font-size:12px;">${fmt(a)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};text-align:right;color:${MUTED};font-family:${SANS};font-size:12px;">${fmt(t)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};text-align:right;color:${varColor(v, k === "ad_spend")};font-family:${SANS};font-size:12px;font-weight:700;">${v == null ? "—" : (v >= 0 ? "+" : "") + v + "%"}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="4" style="padding:14px;text-align:center;color:${MUTED};font-family:${SANS};font-size:12px;">Aucune donnée pour hier.</td></tr>`;

  const notesBlock = opts.notes.length
    ? opts.notes.map((n) => `
        <div style="padding:12px 14px;margin-bottom:8px;background:#0F1B33;border:1px solid ${BORDER};border-left:3px solid ${n.is_signal ? "#F59E0B" : ACCENT};border-radius:10px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;text-transform:uppercase;margin-bottom:6px;">${esc(n.role)} · ${esc(n.scope)}${n.is_signal ? " · ⚡ SIGNAL" : ""}</div>
          ${n.what ? `<div style="font-family:${SANS};font-size:13px;color:${TEXT};margin-bottom:4px;"><strong style="color:${ACCENT};">What:</strong> ${esc(n.what)}</div>` : ""}
          ${n.so_what ? `<div style="font-family:${SANS};font-size:13px;color:${BODY};margin-bottom:4px;"><strong style="color:${ACCENT};">So what:</strong> ${esc(n.so_what)}</div>` : ""}
          ${n.now_what ? `<div style="font-family:${SANS};font-size:13px;color:${BODY};"><strong style="color:${ACCENT};">Now what:</strong> ${esc(n.now_what)}</div>` : ""}
        </div>`).join("")
    : `<div style="padding:14px;text-align:center;color:${MUTED};font-family:${SANS};font-size:12px;background:#0F1B33;border:1px solid ${BORDER};border-radius:10px;">Aucune note enregistrée hier.</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Digest</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:${SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:${CARD};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;">
  <tr><td style="padding:28px 32px 8px;">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.22em;color:${MUTED};font-weight:700;text-transform:uppercase;margin-bottom:6px;">Daily Digest · ${esc(opts.digestDate)}</div>
    <div style="font-family:${SANS};font-size:24px;color:${TEXT};font-weight:800;letter-spacing:-0.02em;">${esc(opts.companyName)}</div>
  </td></tr>

  <tr><td style="padding:20px 32px 8px;">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.18em;color:${MUTED};font-weight:700;text-transform:uppercase;margin-bottom:10px;">Month-to-date</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
      <thead><tr style="background:#0F1B33;">
        <th style="padding:8px 12px;text-align:left;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">MÉTRIQUE</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">ACTUAL</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">TARGET</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">vs T</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">vs P</th>
      </tr></thead>
      <tbody>
        ${mtdRow("Revenu", "revenue")}
        ${mtdRow("Ad spend", "ad_spend", true)}
        ${mtdRow("Commandes", "orders")}
        ${mtdRow("Leads", "leads")}
        ${mtdRow("Gross profit", "gross_profit")}
      </tbody>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px 8px;">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.18em;color:${MUTED};font-weight:700;text-transform:uppercase;margin-bottom:10px;">Hier vs cible journalière</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
      <thead><tr style="background:#0F1B33;">
        <th style="padding:8px 12px;text-align:left;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">MÉTRIQUE</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">ACTUAL</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">TARGET</th>
        <th style="padding:8px 12px;text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.14em;color:${MUTED};font-weight:700;">ΔT</th>
      </tr></thead>
      <tbody>${yRow}</tbody>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px 8px;">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.18em;color:${MUTED};font-weight:700;text-transform:uppercase;margin-bottom:10px;">Notes du jour précédent (${opts.notes.length})</div>
    ${notesBlock}
  </td></tr>

  <tr><td align="center" style="padding:24px 32px 32px;">
    <a href="${esc(opts.workspaceUrl)}" style="display:inline-block;background:${ACCENT};color:#fff;padding:12px 24px;border-radius:12px;font-family:${SANS};font-size:13px;font-weight:700;text-decoration:none;">Ouvrir le workspace</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function processClient(sb: any, clientId: string, opts: { overrideTo?: string; dryRun?: boolean }) {
  const { data: client, error: cErr } = await sb.from("gos_clients").select("id, company_name, client_code").eq("id", clientId).maybeSingle();
  if (cErr || !client) return { client_id: clientId, status: "skipped", reason: "client_not_found" };

  // Recipients
  let recipients: Array<{ email: string; role_label: string | null }>;
  if (opts.overrideTo) {
    recipients = [{ email: opts.overrideTo, role_label: "override" }];
  } else {
    const { data: r } = await sb.from("gos_digest_recipients").select("email, role_label").eq("client_id", clientId).eq("active", true);
    recipients = r ?? [];
  }
  if (!recipients.length) return { client_id: clientId, status: "skipped", reason: "no_recipients" };

  // Date range: yesterday + MTD
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yISO = yesterday.toISOString().slice(0, 10);
  const mStart = monthStart(yesterday);

  // MTD sums
  const { data: mtdRows } = await sb
    .from("gos_daily_pnl_targets")
    .select("target_revenue,target_ad_spend,target_orders,target_leads,target_gross_profit,projection_revenue,projection_ad_spend,projection_orders,projection_leads,projection_gross_profit,actual_revenue,actual_ad_spend,actual_orders,actual_leads")
    .eq("client_id", clientId)
    .gte("target_date", mStart)
    .lte("target_date", yISO);

  const sum = (rows: any[], k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const rows = mtdRows ?? [];
  const mtd = {
    target: { revenue: sum(rows, "target_revenue"), ad_spend: sum(rows, "target_ad_spend"), orders: sum(rows, "target_orders"), leads: sum(rows, "target_leads"), gross_profit: sum(rows, "target_gross_profit") },
    projection: { revenue: sum(rows, "projection_revenue"), ad_spend: sum(rows, "projection_ad_spend"), orders: sum(rows, "projection_orders"), leads: sum(rows, "projection_leads"), gross_profit: sum(rows, "projection_gross_profit") },
    actual: { revenue: sum(rows, "actual_revenue"), ad_spend: sum(rows, "actual_ad_spend"), orders: sum(rows, "actual_orders"), leads: sum(rows, "actual_leads"), gross_profit: 0 },
  };

  // Yesterday row
  const { data: yRow } = await sb.from("gos_daily_pnl_targets").select("*").eq("client_id", clientId).eq("target_date", yISO).maybeSingle();

  // Notes from yesterday
  const { data: notesRows } = await sb
    .from("gos_map_notes")
    .select("author_role, scope_type, what, so_what, now_what, is_signal")
    .eq("client_id", clientId)
    .eq("note_date", yISO)
    .order("created_at", { ascending: true });

  const notes = (notesRows ?? []).map((n: any) => ({
    role: n.author_role ?? "—",
    scope: n.scope_type ?? "general",
    what: n.what, so_what: n.so_what, now_what: n.now_what,
    is_signal: !!n.is_signal,
  }));

  const workspaceUrl = `https://tdiaonboarding.lovable.app/admin/gos/clients/${clientId}/dashboard`;
  const html = renderDigestHtml({
    companyName: client.company_name || client.client_code,
    digestDate: yISO,
    mtd, yesterday: yRow, notes, workspaceUrl,
  });
  const subject = `[${client.client_code}] Daily Digest — ${yISO}`;

  const results: any[] = [];
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  for (const r of recipients) {
    if (opts.dryRun) { results.push({ email: r.email, status: "dry_run" }); continue; }

    // Skip duplicate for the day
    const { data: existing } = await sb
      .from("gos_digest_sends")
      .select("id, status")
      .eq("client_id", clientId).eq("digest_date", yISO).eq("recipient_email", r.email)
      .eq("status", "sent").maybeSingle();
    if (existing) { results.push({ email: r.email, status: "already_sent" }); continue; }

    try {
      if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
      const send = await sendResendEmail({ apiKey: RESEND_API_KEY, from: FROM, to: r.email, subject, html });
      await sb.from("gos_digest_sends").insert({ client_id: clientId, recipient_email: r.email, digest_date: yISO, status: "sent", email_id: send.id ?? null });
      results.push({ email: r.email, status: "sent", id: send.id, redirected: send.redirected });
    } catch (e) {
      await sb.from("gos_digest_sends").insert({ client_id: clientId, recipient_email: r.email, digest_date: yISO, status: "failed", error: (e as Error).message });
      results.push({ email: r.email, status: "failed", error: (e as Error).message });
    }
  }

  return { client_id: clientId, company: client.company_name, digest_date: yISO, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const overrideTo = body.override_to as string | undefined;
    const dryRun = !!body.dry_run;
    const singleClient = body.client_id as string | undefined;

    let clientIds: string[];
    if (singleClient) {
      clientIds = [singleClient];
    } else {
      const { data } = await sb.from("gos_digest_recipients").select("client_id").eq("active", true);
      clientIds = Array.from(new Set((data ?? []).map((r: any) => r.client_id)));
    }

    const out: any[] = [];
    for (const cid of clientIds) {
      out.push(await processClient(sb, cid, { overrideTo, dryRun }));
    }

    return new Response(JSON.stringify({ ok: true, count: out.length, results: out }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
