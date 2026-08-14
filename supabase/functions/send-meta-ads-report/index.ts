// Meta Ads report — server-side PDF generation + email + Slack.
// Called from admin ClientDetail → Meta Ads tab.
//
// Payload:
//   {
//     client_code: string,
//     period_label: string,
//     action: "download" | "send",
//     data: MetaDashboardDataResponse   // fetched client-side and forwarded
//   }
//
// Response (action="download"):
//   { pdf_base64, filename }
//
// Response (action="send"):
//   { filename, email:{sent,...}, slack:{sent,...} }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_URL = "https://api.resend.com/emails";
const SANDBOX_FALLBACK_TO =
  Deno.env.get("RESEND_SANDBOX_TO") || "mikola.business@gmail.com";
const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";

interface Kpis {
  spend: number;
  purchases: number;
  purchase_value: number;
  roas: number;
  ctr: number;
  cpm: number;
  cpc?: number;
  cpa?: number;
  aov?: number;
  impressions?: number;
  clicks?: number;
  reach_approx?: number;
  frequency_approx?: number;
  add_to_cart?: number;
  checkouts_initiated?: number;
}

interface DailyPoint {
  date: string;
  spend?: number;
  purchases?: number;
  purchase_value?: number;
  impressions?: number;
  clicks?: number;
  [k: string]: string | number | undefined;
}

interface DashboardData {
  headers: string[];
  rows: Array<Record<string, string | number>>;
  daily?: DailyPoint[];
  kpis: Kpis;
  last_refreshed_at?: string;
}

interface Payload {
  client_code: string;
  period_label: string;
  action: "download" | "send";
  data: DashboardData;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const { client_code, period_label, action, data } = body;
    if (!client_code || !period_label || !action || !data?.kpis) {
      throw new Error("client_code, period_label, action, data.kpis required");
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cp } = await sb
      .from("client_progress")
      .select("email, slack_channel_id, slack_channel_name, company_name, contact_name")
      .eq("client_code", client_code)
      .maybeSingle();

    let toEmail: string | null = (cp as { email?: string } | null)?.email ?? null;
    if (!toEmail) {
      const { data: deal } = await sb
        .from("closed_deals")
        .select("owner_email")
        .eq("client_code", client_code)
        .maybeSingle();
      toEmail = (deal as { owner_email?: string } | null)?.owner_email ?? null;
    }
    const slackChannelId = (cp as { slack_channel_id?: string } | null)?.slack_channel_id ?? null;
    const slackChannelName = (cp as { slack_channel_name?: string } | null)?.slack_channel_name ?? null;
    const companyName = (cp as { company_name?: string } | null)?.company_name ?? null;
    const contactName = (cp as { contact_name?: string } | null)?.contact_name ?? null;

    const pdfBuffer = await generatePdf({
      clientCode: client_code,
      companyName,
      periodLabel: period_label,
      data,
    });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `rapport-meta-ads-${client_code}-${date}.pdf`;

    if (action === "download") {
      return new Response(
        JSON.stringify({ pdf_base64: uint8ToBase64(pdfBuffer), filename }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const emailResult = await sendEmail({
      apiKey: RESEND_API_KEY,
      to: toEmail,
      companyName,
      contactName,
      periodLabel: period_label,
      pdfBuffer,
      filename,
    });
    const slackResult = await postSlack({
      channelId: slackChannelId,
      channelName: slackChannelName,
      periodLabel: period_label,
      pdfBuffer,
      filename,
      companyName,
    });

    return new Response(
      JSON.stringify({ filename, email: emailResult, slack: slackResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------
// PDF generation — pdf-lib. Design portail : fond sombre, accent bleu,
// bandeau gradient, cartes KPI avec bordure gauche colorée, graphe barres
// dépenses/revenus, top annonces stylées.
// ---------------------------------------------------------------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;

const COLOR_BG = rgb(6 / 255, 9 / 255, 16 / 255);
const COLOR_PANEL = rgb(11 / 255, 19 / 255, 34 / 255);
const COLOR_PANEL_ELEV = rgb(14 / 255, 24 / 255, 42 / 255);
const COLOR_ROW_ALT = rgb(9 / 255, 14 / 255, 24 / 255);
const COLOR_ACCENT = rgb(77 / 255, 159 / 255, 255 / 255);
const COLOR_ACCENT_DEEP = rgb(47 / 255, 107 / 255, 255 / 255);
const COLOR_GREEN = rgb(74 / 255, 222 / 255, 128 / 255);
const COLOR_AMBER = rgb(251 / 255, 191 / 255, 36 / 255);
const COLOR_TEXT = rgb(0.92, 0.94, 0.98);
const COLOR_MUTED = rgb(0.55, 0.6, 0.7);
const COLOR_LINE = rgb(0.15, 0.18, 0.24);

async function generatePdf(args: {
  clientCode: string;
  companyName: string | null;
  periodLabel: string;
  data: DashboardData;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  paintBg(page);
  drawTopAccentBar(page);

  let y = PAGE_H - MARGIN - 8;

  // Header
  drawText(page, "TDIA", { x: MARGIN, y: y - 4, size: 10, font: bold, color: COLOR_ACCENT });
  drawText(page, "Rapport Meta Ads", { x: MARGIN, y: y - 30, size: 24, font: bold, color: COLOR_TEXT });
  drawText(page, args.periodLabel.toUpperCase(), {
    x: MARGIN, y: y - 50, size: 9, font: bold, color: COLOR_ACCENT,
  });

  const rightLabel = args.companyName || args.clientCode;
  const rightW = bold.widthOfTextAtSize(rightLabel, 13);
  drawText(page, rightLabel, {
    x: PAGE_W - MARGIN - rightW, y: y - 4, size: 13, font: bold, color: COLOR_TEXT,
  });
  const genLabel = `Généré le ${new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  })}`;
  const genW = font.widthOfTextAtSize(genLabel, 9);
  drawText(page, genLabel, {
    x: PAGE_W - MARGIN - genW, y: y - 22, size: 9, font, color: COLOR_MUTED,
  });
  if (args.data.last_refreshed_at) {
    const rf = `Données rafraîchies : ${formatRefreshDate(args.data.last_refreshed_at)}`;
    const rfW = font.widthOfTextAtSize(rf, 8);
    drawText(page, rf, {
      x: PAGE_W - MARGIN - rfW, y: y - 36, size: 8, font, color: COLOR_MUTED,
    });
  }

  y -= 78;

  // KPI hero row (3 primary metrics, taller cards with left accent border)
  const kpis = args.data.kpis;
  const heroItems: Array<{ label: string; value: string; sub?: string; accent: ReturnType<typeof rgb> }> = [
    {
      label: "DÉPENSES",
      value: fmtMoney(kpis.spend),
      sub: fmtNum(kpis.impressions) + " impressions",
      accent: COLOR_AMBER,
    },
    {
      label: "REVENUS",
      value: fmtMoney(kpis.purchase_value),
      sub: fmtInt(kpis.purchases) + " achats",
      accent: COLOR_GREEN,
    },
    {
      label: "ROAS",
      value: (kpis.roas || 0).toFixed(2) + "x",
      sub: kpis.aov ? "Panier moy. " + fmtMoney(kpis.aov) : undefined,
      accent: COLOR_ACCENT,
    },
  ];
  const heroGap = 12;
  const heroW = (PAGE_W - MARGIN * 2 - heroGap * 2) / 3;
  const heroH = 90;
  heroItems.forEach((it, i) => {
    const x = MARGIN + i * (heroW + heroGap);
    const cy = y - heroH;
    drawKpiCard(page, {
      x, y: cy, w: heroW, h: heroH,
      label: it.label, value: it.value, sub: it.sub, accent: it.accent,
      valueSize: 22, font, bold,
    });
  });
  y -= heroH + 12;

  // KPI secondary row (3 smaller metrics)
  const subItems: Array<{ label: string; value: string; sub?: string; accent: ReturnType<typeof rgb> }> = [
    {
      label: "CTR",
      value: fmtPct(kpis.ctr),
      sub: fmtNum(kpis.clicks) + " clics",
      accent: COLOR_ACCENT,
    },
    {
      label: "CPM",
      value: fmtMoney(kpis.cpm),
      sub: kpis.cpc != null ? "CPC " + fmtMoney(kpis.cpc) : undefined,
      accent: COLOR_ACCENT_DEEP,
    },
    {
      label: "CPA",
      value: kpis.cpa != null ? fmtMoney(kpis.cpa) : "-",
      sub: kpis.checkouts_initiated != null
        ? fmtInt(kpis.checkouts_initiated) + " checkouts"
        : undefined,
      accent: COLOR_ACCENT_DEEP,
    },
  ];
  const subH = 66;
  subItems.forEach((it, i) => {
    const x = MARGIN + i * (heroW + heroGap);
    const cy = y - subH;
    drawKpiCard(page, {
      x, y: cy, w: heroW, h: subH,
      label: it.label, value: it.value, sub: it.sub, accent: it.accent,
      valueSize: 16, font, bold,
    });
  });
  y -= subH + 24;

  // Daily performance chart
  const daily = normalizeDaily(args.data.daily);
  if (daily.length > 1) {
    drawText(page, "PERFORMANCE QUOTIDIENNE", {
      x: MARGIN, y, size: 9, font: bold, color: COLOR_MUTED,
    });
    y -= 14;

    const chartH = 130;
    const chartW = PAGE_W - MARGIN * 2;
    const chartY = y - chartH;
    drawDailyChart(page, {
      x: MARGIN, y: chartY, w: chartW, h: chartH,
      daily, font, bold,
    });
    y = chartY - 18;

    // Legend
    drawLegendDot(page, MARGIN, y, COLOR_ACCENT);
    drawText(page, "Dépenses", {
      x: MARGIN + 10, y: y - 3, size: 8, font, color: COLOR_TEXT,
    });
    drawLegendDot(page, MARGIN + 80, y, COLOR_GREEN);
    drawText(page, "Revenus", {
      x: MARGIN + 90, y: y - 3, size: 8, font, color: COLOR_TEXT,
    });
    y -= 22;
  }

  // Top ads table (top 10 by spend)
  const rows = (args.data.rows || []).slice();
  const spendKey = pickHeader(args.data.headers, ["Amount spent", "spend", "Spend"]) ?? "Amount spent";
  const nameKey = pickHeader(args.data.headers, ["Ad name", "ad_name", "Ad Name"]) ?? "Ad name";
  const campaignKey = pickHeader(args.data.headers, ["Campaign name", "campaign_name"]) ?? "Campaign name";
  const purchasesKey = pickHeader(args.data.headers, ["Purchases", "purchases"]) ?? "Purchases";
  const revenueKey = pickHeader(args.data.headers, [
    "Website purchases conversion value (default attribution)",
    "purchase_value", "conversion_value",
  ]);
  const roasKey = pickHeader(args.data.headers, [
    "Purchase ROAS (Return on ad spend)", "roas",
  ]);

  const topAds = rows
    .map((r) => ({
      name: String(r[nameKey] ?? "—"),
      campaign: String(r[campaignKey] ?? "—"),
      spend: toNum(r[spendKey]),
      purchases: toNum(r[purchasesKey]),
      revenue: revenueKey ? toNum(r[revenueKey]) : 0,
      roas: roasKey ? toNum(r[roasKey]) : 0,
    }))
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  if (topAds.length > 0) {
    drawText(page, "TOP ANNONCES", {
      x: MARGIN, y, size: 9, font: bold, color: COLOR_MUTED,
    });
    y -= 14;

    // Column layout
    const cols = [
      { label: "#", w: 24, align: "left" as const },
      { label: "Annonce", w: 210, align: "left" as const },
      { label: "Dépenses", w: 75, align: "right" as const },
      { label: "Achats", w: 55, align: "right" as const },
      { label: "Revenus", w: 80, align: "right" as const },
      { label: "ROAS", w: 60, align: "right" as const },
    ];
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const scale = (PAGE_W - MARGIN * 2) / totalW;
    cols.forEach((c) => (c.w = c.w * scale));

    // Header row
    page.drawRectangle({
      x: MARGIN, y: y - 4, width: PAGE_W - MARGIN * 2, height: 20, color: COLOR_PANEL_ELEV,
    });
    let cx = MARGIN + 10;
    cols.forEach((c) => {
      const tw = font.widthOfTextAtSize(c.label, 8);
      drawText(page, c.label.toUpperCase(), {
        x: c.align === "right" ? cx + c.w - tw - 10 : cx,
        y: y + 4, size: 8, font: bold, color: COLOR_MUTED,
      });
      cx += c.w;
    });
    y -= 20;

    topAds.forEach((ad, i) => {
      if (y < MARGIN + 40) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        paintBg(page);
        drawTopAccentBar(page);
        y = PAGE_H - MARGIN - 8;
      }
      const rowY = y - 24;
      if (i % 2 === 0) {
        page.drawRectangle({
          x: MARGIN, y: rowY, width: PAGE_W - MARGIN * 2, height: 24,
          color: COLOR_ROW_ALT,
        });
      }
      // Rank badge (small colored square with number)
      const rankColor = i === 0 ? COLOR_GREEN : i < 3 ? COLOR_ACCENT : COLOR_MUTED;
      page.drawRectangle({
        x: MARGIN + 10, y: rowY + 6, width: 12, height: 12, color: rankColor,
      });
      const rankTxt = String(i + 1);
      const rankTw = bold.widthOfTextAtSize(rankTxt, 8);
      drawText(page, rankTxt, {
        x: MARGIN + 10 + (12 - rankTw) / 2, y: rowY + 9, size: 8, font: bold,
        color: rgb(0.06, 0.09, 0.14),
      });

      let cx = MARGIN + 10;
      const vals = [
        "",
        truncate(ad.name, 42),
        fmtMoney(ad.spend),
        fmtInt(ad.purchases),
        fmtMoney(ad.revenue),
        ad.roas ? ad.roas.toFixed(2) + "x" : "-",
      ];
      cols.forEach((c, idx) => {
        if (idx === 0) { cx += c.w; return; }
        const txt = vals[idx];
        const isBold = idx === 2 || idx === 5;
        const useFont = isBold ? bold : font;
        const useColor = idx === 5 && ad.roas >= 2 ? COLOR_GREEN : COLOR_TEXT;
        const tw = useFont.widthOfTextAtSize(txt, 9);
        drawText(page, txt, {
          x: c.align === "right" ? cx + c.w - tw - 10 : cx,
          y: rowY + 8, size: 9, font: useFont, color: useColor,
        });
        cx += c.w;
      });
      y -= 24;
    });
  }

  // Footer
  const footer = "TDIA · Profit First Media Buying";
  const fw = font.widthOfTextAtSize(footer, 8);
  drawText(page, footer, {
    x: (PAGE_W - fw) / 2, y: MARGIN / 2, size: 8, font, color: COLOR_MUTED,
  });

  return await pdf.save();
}

function paintBg(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: COLOR_BG });
}

// Bandeau accent en haut de page — simule un gradient bleu → transparent via
// N segments d'opacité décroissante (pdf-lib supporte l'opacité par shape).
function drawTopAccentBar(page: PDFPage) {
  const segments = 24;
  const totalW = PAGE_W;
  const segW = totalW / segments;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    page.drawRectangle({
      x: i * segW,
      y: PAGE_H - 4,
      width: segW + 0.5,
      height: 4,
      color: t < 0.5 ? COLOR_ACCENT_DEEP : COLOR_ACCENT,
      opacity: 1 - t * 0.6,
    });
  }
}

function drawKpiCard(
  page: PDFPage,
  opts: {
    x: number; y: number; w: number; h: number;
    label: string; value: string; sub?: string;
    accent: ReturnType<typeof rgb>;
    valueSize: number;
    font: PDFFont; bold: PDFFont;
  },
) {
  // Panel
  page.drawRectangle({
    x: opts.x, y: opts.y, width: opts.w, height: opts.h,
    color: COLOR_PANEL, borderColor: COLOR_LINE, borderWidth: 0.5,
  });
  // Left accent border (3px thick)
  page.drawRectangle({
    x: opts.x, y: opts.y, width: 3, height: opts.h, color: opts.accent,
  });
  // Subtle accent tint at top (gradient hint via low-opacity rectangle)
  page.drawRectangle({
    x: opts.x + 3, y: opts.y + opts.h - 24, width: opts.w - 3, height: 24,
    color: opts.accent, opacity: 0.06,
  });

  drawText(page, opts.label, {
    x: opts.x + 14, y: opts.y + opts.h - 20, size: 8, font: opts.bold, color: COLOR_MUTED,
  });
  drawText(page, opts.value, {
    x: opts.x + 14, y: opts.y + opts.h - 20 - opts.valueSize - 6,
    size: opts.valueSize, font: opts.bold, color: COLOR_TEXT,
  });
  if (opts.sub) {
    drawText(page, opts.sub, {
      x: opts.x + 14, y: opts.y + 10, size: 8, font: opts.font, color: COLOR_MUTED,
    });
  }
}

function drawLegendDot(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y: y - 3, width: 6, height: 6, color });
}

function drawDailyChart(
  page: PDFPage,
  opts: {
    x: number; y: number; w: number; h: number;
    daily: Array<{ date: string; spend: number; revenue: number }>;
    font: PDFFont; bold: PDFFont;
  },
) {
  const { x, y, w, h, daily } = opts;

  // Panel bg
  page.drawRectangle({
    x, y, width: w, height: h, color: COLOR_PANEL,
    borderColor: COLOR_LINE, borderWidth: 0.5,
  });

  const padL = 44, padR = 44, padT = 16, padB = 24;
  const plotX = x + padL;
  const plotY = y + padB;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxSpend = Math.max(1, ...daily.map((d) => d.spend));
  const maxRev = Math.max(1, ...daily.map((d) => d.revenue));
  const yMax = Math.max(maxSpend, maxRev) * 1.1;

  // Grid lines (4 horizontal)
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + (plotH * i) / 4;
    page.drawLine({
      start: { x: plotX, y: gy }, end: { x: plotX + plotW, y: gy },
      thickness: 0.3, color: COLOR_LINE, opacity: 0.6,
    });
    const val = (yMax * i) / 4;
    const label = fmtMoneyShort(val);
    const tw = opts.font.widthOfTextAtSize(label, 7);
    drawText(page, label, {
      x: plotX - 6 - tw, y: gy - 3, size: 7, font: opts.font, color: COLOR_MUTED,
    });
  }

  // Bars (spend) — one bar per day, blue
  const barGap = 2;
  const barW = Math.max(1, (plotW - barGap * (daily.length - 1)) / daily.length);
  daily.forEach((d, i) => {
    const bx = plotX + i * (barW + barGap);
    const bh = (d.spend / yMax) * plotH;
    page.drawRectangle({
      x: bx, y: plotY, width: barW, height: bh, color: COLOR_ACCENT, opacity: 0.85,
    });
  });

  // Revenue line — draw as segments (green)
  for (let i = 0; i < daily.length - 1; i++) {
    const a = daily[i];
    const b = daily[i + 1];
    const ax = plotX + i * (barW + barGap) + barW / 2;
    const ay = plotY + (a.revenue / yMax) * plotH;
    const bx = plotX + (i + 1) * (barW + barGap) + barW / 2;
    const by = plotY + (b.revenue / yMax) * plotH;
    page.drawLine({
      start: { x: ax, y: ay }, end: { x: bx, y: by },
      thickness: 1.4, color: COLOR_GREEN,
    });
  }
  // Revenue dots
  daily.forEach((d, i) => {
    const dx = plotX + i * (barW + barGap) + barW / 2;
    const dy = plotY + (d.revenue / yMax) * plotH;
    page.drawRectangle({ x: dx - 1.5, y: dy - 1.5, width: 3, height: 3, color: COLOR_GREEN });
  });

  // X axis dates (first, middle, last)
  const dateLabels = pickDateLabels(daily);
  dateLabels.forEach((label, i) => {
    const idx = i === 0 ? 0 : i === dateLabels.length - 1 ? daily.length - 1 : Math.floor(daily.length / 2);
    const dx = plotX + idx * (barW + barGap) + barW / 2;
    const tw = opts.font.widthOfTextAtSize(label, 7);
    drawText(page, label, {
      x: dx - tw / 2, y: y + 8, size: 7, font: opts.font, color: COLOR_MUTED,
    });
  });
}

function normalizeDaily(daily: DashboardData["daily"]): Array<{ date: string; spend: number; revenue: number }> {
  if (!daily) return [];
  return daily
    .map((d) => ({
      date: String(d.date ?? ""),
      spend: toNum(d.spend),
      revenue: toNum(d.purchase_value),
    }))
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function pickDateLabels(daily: Array<{ date: string }>): string[] {
  if (daily.length === 0) return [];
  if (daily.length === 1) return [formatDayLabel(daily[0].date)];
  const first = formatDayLabel(daily[0].date);
  const mid = formatDayLabel(daily[Math.floor(daily.length / 2)].date);
  const last = formatDayLabel(daily[daily.length - 1].date);
  return [first, mid, last];
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatRefreshDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function fmtMoneyShort(n: number): string {
  if (n >= 1000) return "$" + Math.round(n / 100) / 10 + "k";
  return "$" + Math.round(n);
}

function drawText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> },
) {
  // pdf-lib Helvetica: strip characters not in WinAnsi to avoid encode errors.
  const map: Record<string, string> = {
    "—": "-", "–": "-", "…": "...",
    "\u2019": "'", "\u2018": "'", "\u201C": '"', "\u201D": '"',
    "\u2009": " ", "\u202F": " ", "\u200B": "",
  };
  const safe = text
    // NBSP (U+00A0) est dans WinAnsi mais Intl.NumberFormat FR peut aussi produire
    // des espaces fines/étroites non encodables — on les normalise en espace simple.
    .replace(/[\u0100-\uFFFF]/g, (c) => map[c] ?? "?");
  page.drawText(safe, opts);
}

function pickHeader(headers: string[] | undefined, candidates: string[]): string | null {
  if (!headers) return null;
  for (const c of candidates) {
    const hit = headers.find((h) => h.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const clean = v.replace(/[^\d.,-]/g, "").replace(",", ".");
    const n = Number(clean);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function fmtMoney(n: number | undefined): string {
  const v = n ?? 0;
  return v.toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

function fmtNum(n: number | undefined): string {
  return (n ?? 0).toLocaleString("fr-CA");
}

function fmtInt(n: number | undefined): string {
  return String(Math.round(n ?? 0));
}

function fmtPct(n: number | undefined): string {
  return ((n ?? 0) * 100).toFixed(2) + "%";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ---------------------------------------------------------------
// Email + Slack (inchangés vs version précédente)
// ---------------------------------------------------------------

async function sendEmail(args: {
  apiKey: string;
  to: string | null;
  companyName: string | null;
  contactName: string | null;
  periodLabel: string;
  pdfBuffer: Uint8Array;
  filename: string;
}) {
  if (!args.to) return { sent: false, error: "Aucun email trouvé pour ce client" };
  const b64 = uint8ToBase64(args.pdfBuffer);
  const subject = `Votre rapport Meta Ads — ${args.periodLabel}`;
  const greeting = args.contactName ? `Bonjour ${args.contactName},` : "Bonjour,";
  const company = args.companyName ? ` pour ${args.companyName}` : "";
  const html = `
<div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.6;max-width:560px">
  <p>${greeting}</p>
  <p>Voici votre rapport de performance Meta Ads${company} pour la période <strong>${args.periodLabel}</strong>.</p>
  <p>Toutes vos métriques clés (dépenses, revenus, ROAS, CTR, top créatifs) sont détaillées dans le PDF joint.</p>
  <p>Une question ? Répondez simplement à ce message.</p>
  <p style="color:#666;font-size:12px;margin-top:24px">TDIA · Profit First Media Buying</p>
</div>`.trim();

  const attach = [{ filename: args.filename, content: b64 }];

  const post = async (to: string, sbjPrefix = "") => {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({ from: FROM, to: [to], subject: `${sbjPrefix}${subject}`, html, attachments: attach }),
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, body };
  };

  const first = await post(args.to);
  if (first.ok) return { sent: true, to: args.to };

  const msg = JSON.stringify(first.body);
  const isSandbox =
    first.status === 403 && /verify a domain|testing emails to your own/i.test(msg);

  if (isSandbox && args.to.toLowerCase() !== SANDBOX_FALLBACK_TO.toLowerCase()) {
    const fb = await post(SANDBOX_FALLBACK_TO, `[TEST → ${args.to}] `);
    if (fb.ok) return { sent: true, to: args.to, redirected_to: SANDBOX_FALLBACK_TO };
    return { sent: false, to: args.to, error: `Resend sandbox-fallback ${fb.status}: ${JSON.stringify(fb.body)}` };
  }

  return { sent: false, to: args.to, error: `Resend ${first.status}: ${msg}` };
}

async function postSlack(args: {
  channelId: string | null;
  channelName: string | null;
  periodLabel: string;
  pdfBuffer: Uint8Array;
  filename: string;
  companyName: string | null;
}) {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) return { sent: false, error: "SLACK_BOT_TOKEN not configured" };
  if (!args.channelId) return { sent: false, error: "Aucun slack_channel_id pour ce client" };

  const size = args.pdfBuffer.length;
  const title = `Rapport Meta Ads — ${args.periodLabel}`;

  const step1 = await fetch("https://slack.com/api/files.getUploadURLExternal", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Bearer ${token}` },
    body: new URLSearchParams({ filename: args.filename, length: String(size) }),
  });
  const step1Body = (await step1.json()) as { ok: boolean; upload_url?: string; file_id?: string; error?: string };
  if (!step1Body.ok || !step1Body.upload_url || !step1Body.file_id) {
    return { sent: false, error: `slack.getUploadURLExternal: ${step1Body.error || "no upload url"}` };
  }

  const step2 = await fetch(step1Body.upload_url, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: args.pdfBuffer,
  });
  if (!step2.ok) return { sent: false, error: `slack upload PUT ${step2.status}: ${await step2.text()}` };

  const step3 = await fetch("https://slack.com/api/files.completeUploadExternal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      files: [{ id: step1Body.file_id, title }],
      channel_id: args.channelId,
      initial_comment: `📊 *${title}*${args.companyName ? ` — ${args.companyName}` : ""}\nGénéré depuis votre portail TDIA.`,
    }),
  });
  const step3Body = (await step3.json()) as { ok: boolean; error?: string };
  if (!step3Body.ok) return { sent: false, error: `slack.completeUploadExternal: ${step3Body.error}` };

  return { sent: true, channel: args.channelName || args.channelId };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
