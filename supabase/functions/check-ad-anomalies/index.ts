// ─────────────────────────────────────────────────────────────────────────────
// KPI ANOMALY ALERT SYSTEM — daily ad-account anomaly check
// ─────────────────────────────────────────────────────────────────────────────
// Triggered by pg_cron every morning after the Porter Metrics 5h refresh.
// For each active client with `anomaly_checks_enabled = true`, runs 4 checks
// on yesterday's aggregated ad data and posts Slack alerts (deduped against
// the ad_anomaly_log table). Always sends a heartbeat, whether or not any
// anomaly fired — the absence of a heartbeat means the workflow itself died.
//
// Manual invocation (dry run — no Slack, no log writes):
//   POST /functions/v1/check-ad-anomalies
//   { "dry_run": true, "client_code": "CLI-A7C02EF1" }
//
// Manual invocation (single client, real run):
//   POST /functions/v1/check-ad-anomalies
//   { "client_code": "CLI-A7C02EF1" }
//
// Simulate a specific date (for testing baselines):
//   POST /functions/v1/check-ad-anomalies
//   { "client_code": "CLI-A7C02EF1", "force_date": "2026-08-13", "dry_run": true }
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config (tune here, don't scatter magic numbers) ─────────────────────────
const CHECK_2_OVER_PCT = 1.4;   // > 140 % of budget → overspend
const CHECK_2_UNDER_PCT = 0.5;  // < 50 %  of budget → underspend
const CHECK_3_SPEND_FLOOR = 30; // must spend >= $30 to trust "0 conversions"
const CHECK_3_MIN_7D_CONV = 1;  // 7d avg conversions must be >= 1/day
const CHECK_4_DRIFT_PCT = 0.5;  // >50 % KPI drift vs 7d baseline
const BASELINE_DAYS = 7;        // 7-day rolling baseline
const HEARTBEAT_CHANNEL = "heartbeat";
const ALERT_CHANNEL = "alerts";

// ── Type helpers ────────────────────────────────────────────────────────────
type ClientConfig = {
  client_code: string;
  google_sheet_id: string;
  tab_name: string;
  client_type: "ecom" | "local";
  daily_budget_planned: number;
  conversion_metric: "purchases" | "leads";
  target_cpl_or_roas: number;
};

type AnomalyType =
  | "spend_dead"
  | "spend_off_band"
  | "tracking_dead"
  | "kpi_outlier"
  | "data_missing";

type Severity = "S1" | "S2" | "S3";

type Anomaly = {
  type: AnomalyType;
  severity: Severity;
  title: string;
  yesterdayValue: number | null;
  expectedText: string;
  baselineValue: number | null;
  runbook: string;
  details: Record<string, unknown>;
};

type DailyRow = {
  date: string;
  spend: number;
  conversions: number;
  purchase_value: number;
};

// ── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Fuzzy column matchers (same patterns as MetaAdsDashboard.tsx) ───────────
const RE_DATE = [/^date$/i, /^day$/i, /^jour$/i, /reporting.*date/i];
const RE_SPEND = [/amount\s*spent/i, /^spend$/i, /^cost$/i, /dépens/i];
const RE_REVENUE = [/purchases?\s*(conversion)?\s*value/i, /purchase\s*value/i, /revenue/i, /revenu/i];
const RE_PURCHASES = [/^purchases$/i, /^achats$/i, /website\s*purchases/i];
const RE_LEADS = [
  /^leads?$/i,
  /lead\s*count/i,
  /on.facebook.leads/i,
  /form\s*fills?/i,
  /prospects?/i,
];

function findKey(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const re of patterns) if (re.test(h)) return h;
  }
  return null;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// ── Date helpers (in America/Toronto to match Porter's local export) ────────
function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayIso(forceDate?: string | null): string {
  if (forceDate) return forceDate;
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return isoDate(now);
}

function daysBeforeIso(reference: string, n: number): string[] {
  const out: string[] = [];
  const ref = new Date(`${reference}T00:00:00Z`);
  for (let i = 1; i <= n; i++) {
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDate(d));
  }
  return out;
}

// ── Fetch client data via the existing meta-dashboard-data function ─────────
async function fetchClientData(
  clientCode: string,
  dateFrom: string,
  dateTo: string,
  authHeader: string,
): Promise<{
  headers: string[];
  rows: Array<Record<string, unknown>>;
  daily?: Array<Record<string, unknown>>;
} | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const res = await fetch(`${supabaseUrl}/functions/v1/meta-dashboard-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      client_code: clientCode,
      date_from: dateFrom,
      date_to: dateTo,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`meta-dashboard-data ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
}

// ── Aggregate raw rows (date × campaign × ad) into per-day totals ───────────
// Uses `daily` when the upstream provided it; otherwise falls back to rows.
function buildDailySeries(
  data: {
    headers: string[];
    rows: Array<Record<string, unknown>>;
    daily?: Array<Record<string, unknown>>;
  },
  metric: "purchases" | "leads",
): Map<string, DailyRow> {
  const out = new Map<string, DailyRow>();

  if (metric === "purchases" && Array.isArray(data.daily) && data.daily.length > 0) {
    for (const d of data.daily) {
      const date = String(d.date ?? "").slice(0, 10);
      if (!date) continue;
      out.set(date, {
        date,
        spend: toNumber(d.spend),
        conversions: toNumber(d.purchases),
        purchase_value: toNumber(d.purchase_value),
      });
    }
    return out;
  }

  // Fallback: aggregate raw rows ourselves (needed for leads or when daily is missing).
  const dateKey = findKey(data.headers, RE_DATE);
  const spendKey = findKey(data.headers, RE_SPEND);
  const revKey = findKey(data.headers, RE_REVENUE);
  const convKey = metric === "leads"
    ? findKey(data.headers, RE_LEADS)
    : findKey(data.headers, RE_PURCHASES);
  if (!dateKey || !spendKey) return out;

  for (const r of data.rows) {
    const date = String(r[dateKey] ?? "").slice(0, 10);
    if (!date) continue;
    const cur = out.get(date) ?? { date, spend: 0, conversions: 0, purchase_value: 0 };
    cur.spend += toNumber(r[spendKey]);
    if (convKey) cur.conversions += toNumber(r[convKey]);
    if (revKey) cur.purchase_value += toNumber(r[revKey]);
    out.set(date, cur);
  }
  return out;
}

// ── The 4 checks ────────────────────────────────────────────────────────────
function runChecks(
  cfg: ClientConfig,
  yesterday: string,
  daily: Map<string, DailyRow>,
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const y = daily.get(yesterday);

  if (!y) {
    anomalies.push({
      type: "data_missing",
      severity: "S2",
      title: "Données Porter manquantes pour hier",
      yesterdayValue: null,
      expectedText: `1 ligne pour ${yesterday}`,
      baselineValue: null,
      runbook: "Vérifier que Porter Metrics a bien tourné à 5h — dashboard Porter, sinon rerun manuel de l'export.",
      details: { yesterday },
    });
    return anomalies;
  }

  // Baseline = up to BASELINE_DAYS days before yesterday, only dates present.
  const baselineDates = daysBeforeIso(yesterday, BASELINE_DAYS);
  const baselineRows = baselineDates
    .map((d) => daily.get(d))
    .filter((x): x is DailyRow => !!x);
  const hasBaseline = baselineRows.length >= BASELINE_DAYS;
  const avgSpend = baselineRows.length > 0
    ? baselineRows.reduce((s, r) => s + r.spend, 0) / baselineRows.length
    : 0;
  const avgConv = baselineRows.length > 0
    ? baselineRows.reduce((s, r) => s + r.conversions, 0) / baselineRows.length
    : 0;

  const metricLabel = cfg.conversion_metric === "leads" ? "leads" : "purchases";
  const budget = cfg.daily_budget_planned;

  // Check 1 — SPEND DEAD
  if (budget > 0 && y.spend === 0) {
    anomalies.push({
      type: "spend_dead",
      severity: "S1",
      title: "Spend mort — 0 $ dépensé hier",
      yesterdayValue: 0,
      expectedText: `≈ ${budget.toFixed(2)} $ (budget planifié)`,
      baselineValue: avgSpend,
      runbook: "Ads Manager > Réglages du compte : vérifier billing + restrictions. Ensuite : Vue d'ensemble > statut des campagnes actives.",
      details: { budget, avg_spend_7d: avgSpend },
    });
  } else if (budget > 0) {
    // Check 2 — SPEND OFF-BAND (only if check 1 didn't fire — dead beats off-band)
    if (y.spend > budget * CHECK_2_OVER_PCT) {
      anomalies.push({
        type: "spend_off_band",
        severity: "S1",
        title: `Overspend — ${((y.spend / budget - 1) * 100).toFixed(0)} % au-dessus du budget`,
        yesterdayValue: y.spend,
        expectedText: `${(budget * CHECK_2_UNDER_PCT).toFixed(2)}–${(budget * CHECK_2_OVER_PCT).toFixed(2)} $ (bande ±40/50 %)`,
        baselineValue: avgSpend,
        runbook: "CBO doublé ? budget accidentellement ×10 ? Ads Manager > Vue d'ensemble, filtrer les campagnes modifiées dans les dernières 24h.",
        details: { budget, over_ratio: y.spend / budget },
      });
    } else if (y.spend < budget * CHECK_2_UNDER_PCT) {
      anomalies.push({
        type: "spend_off_band",
        severity: "S2",
        title: `Sous-spend — ${((1 - y.spend / budget) * 100).toFixed(0)} % sous le budget`,
        yesterdayValue: y.spend,
        expectedText: `${(budget * CHECK_2_UNDER_PCT).toFixed(2)}–${(budget * CHECK_2_OVER_PCT).toFixed(2)} $ (bande ±40/50 %)`,
        baselineValue: avgSpend,
        runbook: "Audience trop restrictive ? créatifs rejetés ? Ads Manager > filtrer campagnes actives avec impressions faibles vs veille.",
        details: { budget, under_ratio: y.spend / budget },
      });
    }
  }

  // Check 3 — TRACKING SUSPECT (needs baseline)
  if (hasBaseline && y.spend > CHECK_3_SPEND_FLOOR && y.conversions === 0 && avgConv >= CHECK_3_MIN_7D_CONV) {
    anomalies.push({
      type: "tracking_dead",
      severity: "S2", // may escalate to S1 at dedup time if repeat
      title: `Tracking suspect — 0 ${metricLabel} pour ${y.spend.toFixed(2)} $ dépensés`,
      yesterdayValue: 0,
      expectedText: `≥ ${Math.max(1, Math.round(avgConv))} ${metricLabel} attendus`,
      baselineValue: avgConv,
      runbook: "Events Manager > Test Events (envoyer un event test) + Diagnostic Pixel/CAPI + vérifier que le domaine est vérifié dans BM.",
      details: { spend_yesterday: y.spend, avg_conv_7d: avgConv },
    });
  }

  // Check 4 — KPI OUT OF BAND (needs baseline)
  if (hasBaseline) {
    if (cfg.client_type === "ecom") {
      const yRoas = y.spend > 0 ? y.purchase_value / y.spend : null;
      const bSpend = baselineRows.reduce((s, r) => s + r.spend, 0);
      const bValue = baselineRows.reduce((s, r) => s + r.purchase_value, 0);
      const avgRoas = bSpend > 0 ? bValue / bSpend : null;
      if (yRoas !== null && avgRoas !== null && avgRoas > 0) {
        const drift = Math.abs(yRoas - avgRoas) / avgRoas;
        if (drift > CHECK_4_DRIFT_PCT) {
          anomalies.push({
            type: "kpi_outlier",
            severity: "S3",
            title: `ROAS hors bande — ${yRoas.toFixed(2)}× vs ${avgRoas.toFixed(2)}× (7j)`,
            yesterdayValue: yRoas,
            expectedText: `${avgRoas.toFixed(2)}× ± 50 %`,
            baselineValue: avgRoas,
            runbook: "Informationnel. Nouveau créatif hier ? changement de landing ? promo active ? Ads Manager > filtrer par date de création.",
            details: { roas_yesterday: yRoas, roas_7d: avgRoas, drift },
          });
        }
      }
    } else {
      // local — CPL
      const yCpl = y.conversions > 0 ? y.spend / y.conversions : null;
      const bSpend = baselineRows.reduce((s, r) => s + r.spend, 0);
      const bConv = baselineRows.reduce((s, r) => s + r.conversions, 0);
      const avgCpl = bConv > 0 ? bSpend / bConv : null;
      if (yCpl !== null && avgCpl !== null && avgCpl > 0) {
        const drift = Math.abs(yCpl - avgCpl) / avgCpl;
        if (drift > CHECK_4_DRIFT_PCT) {
          anomalies.push({
            type: "kpi_outlier",
            severity: "S3",
            title: `CPL hors bande — ${yCpl.toFixed(2)} $ vs ${avgCpl.toFixed(2)} $ (7j)`,
            yesterdayValue: yCpl,
            expectedText: `${avgCpl.toFixed(2)} $ ± 50 %`,
            baselineValue: avgCpl,
            runbook: "Informationnel. Nouveau créatif hier ? formulaire cassé ? Ads Manager + tester le formulaire manuellement.",
            details: { cpl_yesterday: yCpl, cpl_7d: avgCpl, drift },
          });
        }
      }
    }
  }

  return anomalies;
}

// ── Dedup: was a same-type alert already sent for the previous check_date? ──
async function findPreviousRunAlert(
  supabase: SupabaseClient,
  clientCode: string,
  anomalyType: AnomalyType,
  currentCheckDate: string,
): Promise<{ severity: Severity } | null> {
  const priorDate = daysBeforeIso(currentCheckDate, 1)[0];
  const { data } = await supabase
    .from("ad_anomaly_log")
    .select("severity, slack_sent")
    .eq("client_code", clientCode)
    .eq("anomaly_type", anomalyType)
    .eq("check_date", priorDate)
    .eq("slack_sent", true)
    .maybeSingle();
  if (!data) return null;
  return { severity: data.severity as Severity };
}

// ── Slack posting ───────────────────────────────────────────────────────────
const SEV_EMOJI: Record<Severity, string> = { S1: "🔴", S2: "🟡", S3: "🟢" };

function sheetUrl(cfg: ClientConfig): string {
  return `https://docs.google.com/spreadsheets/d/${cfg.google_sheet_id}/edit`;
}

function clientLabel(cfg: ClientConfig, name?: string | null): string {
  return name ? `${name} (${cfg.client_code})` : cfg.client_code;
}

async function postSlack(channel: string, text: string, blocks: unknown[]): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${supabaseUrl}/functions/v1/notify-slack-channel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
  if (!r.ok) throw new Error(`notify-slack-channel ${r.status}: ${await r.text()}`);
}

function buildAnomalyBlocks(
  cfg: ClientConfig,
  clientName: string | null,
  a: Anomaly,
  effectiveSeverity: Severity,
): { text: string; blocks: unknown[] } {
  const emoji = SEV_EMOJI[effectiveSeverity];
  const label = clientLabel(cfg, clientName);
  const header = `${emoji} [${effectiveSeverity}] — ${label} — ${a.title}`;
  const mention = effectiveSeverity === "S1" ? "<!channel> " : "";
  const yLine = a.yesterdayValue !== null ? `Hier : ${formatNumber(a.yesterdayValue)}` : "Hier : —";
  const bLine = a.baselineValue !== null ? `Moyenne 7j : ${formatNumber(a.baselineValue)}` : "Moyenne 7j : —";
  const expected = `Attendu : ${a.expectedText}`;
  const body = `${mention}*${header}*\n${yLine} · ${expected} · ${bLine}\n_Premier geste :_ ${a.runbook}\n<${sheetUrl(cfg)}|Ouvrir le sheet client>`;
  return {
    text: header,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: body } }],
  };
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

// ── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authHeader = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`;

  let body: { dry_run?: boolean; client_code?: string; force_date?: string } = {};
  try {
    body = req.method === "POST" ? await req.json() : {};
  } catch {
    body = {};
  }
  const dryRun = !!body.dry_run;
  const forceDate = body.force_date ?? null;
  const clientFilter = body.client_code ?? null;
  const checkDate = yesterdayIso(forceDate);

  try {
    // 1) Load active configs
    let q = supabase
      .from("meta_dashboard_config")
      .select("client_code, google_sheet_id, tab_name, client_type, daily_budget_planned, conversion_metric, target_cpl_or_roas")
      .eq("active", true)
      .eq("anomaly_checks_enabled", true);
    if (clientFilter) q = q.eq("client_code", clientFilter);
    const { data: configs, error: cfgErr } = await q;
    if (cfgErr) throw cfgErr;

    // 2) Optionally resolve client names (from client_progress) for nicer Slack
    const codes = (configs ?? []).map((c) => c.client_code);
    const namesByCode = new Map<string, string>();
    if (codes.length > 0) {
      const { data: nameRows } = await supabase
        .from("client_progress")
        .select("client_code, company_name, brand_name, client_name")
        .in("client_code", codes);
      for (const r of nameRows ?? []) {
        namesByCode.set(
          r.client_code,
          (r.company_name as string | null) ||
            (r.brand_name as string | null) ||
            (r.client_name as string | null) ||
            r.client_code,
        );
      }
    }

    let clientsChecked = 0;
    let anomaliesFired = 0;
    const perClientLog: Array<{ client_code: string; anomalies: number; error?: string }> = [];
    const dateFrom = daysBeforeIso(checkDate, BASELINE_DAYS + 1).at(-1) ?? checkDate;

    // 3) Loop clients — each iteration wrapped so one failure never kills the run
    for (const cfg of (configs as ClientConfig[]) ?? []) {
      clientsChecked++;
      try {
        const data = await fetchClientData(cfg.client_code, dateFrom, checkDate, authHeader);
        if (!data) throw new Error("empty response from meta-dashboard-data");
        const daily = buildDailySeries(data, cfg.conversion_metric);
        const anomalies = runChecks(cfg, checkDate, daily);
        const clientName = namesByCode.get(cfg.client_code) ?? cfg.client_code;

        for (const a of anomalies) {
          const prior = await findPreviousRunAlert(supabase, cfg.client_code, a.type, checkDate);

          // Dedup + escalation rules
          let effectiveSev: Severity = a.severity;
          let shouldSend = true;
          if (prior) {
            if (a.type === "tracking_dead" && prior.severity === "S2") {
              effectiveSev = "S1"; // day 2 of tracking dead → escalate
            } else {
              shouldSend = false; // straight repeat — skip Slack, still log
            }
          }

          let slackSent = false;
          let slackError: string | null = null;
          if (shouldSend && !dryRun) {
            try {
              const { text, blocks } = buildAnomalyBlocks(cfg, clientName, a, effectiveSev);
              await postSlack(ALERT_CHANNEL, text, blocks);
              slackSent = true;
              anomaliesFired++;
            } catch (e) {
              slackError = (e as Error).message;
            }
          } else if (shouldSend && dryRun) {
            anomaliesFired++;
          }

          if (!dryRun) {
            await supabase.from("ad_anomaly_log").insert({
              client_code: cfg.client_code,
              check_date: checkDate,
              anomaly_type: a.type,
              severity: effectiveSev,
              yesterday_value: a.yesterdayValue,
              baseline_value: a.baselineValue,
              details: { ...a.details, dedup_skipped: !shouldSend, expected: a.expectedText },
              slack_sent: slackSent,
              slack_error: slackError,
            });
          }
        }

        perClientLog.push({ client_code: cfg.client_code, anomalies: anomalies.length });
      } catch (e) {
        const msg = (e as Error).message || "unknown error";
        perClientLog.push({ client_code: cfg.client_code, anomalies: 0, error: msg });
        // A per-client failure is itself an anomaly worth an alert
        if (!dryRun) {
          try {
            await postSlack(
              ALERT_CHANNEL,
              `🟡 [S2] — ${namesByCode.get(cfg.client_code) ?? cfg.client_code} — Données manquantes`,
              [{
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `🟡 *[S2] — ${namesByCode.get(cfg.client_code) ?? cfg.client_code} — Données manquantes*\nCheck du ${checkDate} impossible : ${msg}\n_Premier geste :_ vérifier que Porter Metrics a bien exporté ce matin, ou que le sheet client est bien partagé au service account.`,
                },
              }],
            );
          } catch { /* swallow — don't cascade a Slack failure */ }
          await supabase.from("ad_anomaly_log").insert({
            client_code: cfg.client_code,
            check_date: checkDate,
            anomaly_type: "data_missing",
            severity: "S2",
            details: { error: msg },
            slack_sent: true,
          });
          anomaliesFired++;
        }
      }
    }

    // 4) Heartbeat (always, unless dry-run)
    const summaryText = `✅ Anomaly check ${checkDate} — ${clientsChecked} client${clientsChecked > 1 ? "s" : ""} vérifié${clientsChecked > 1 ? "s" : ""}, ${anomaliesFired} anomalie${anomaliesFired > 1 ? "s" : ""}`;
    if (!dryRun) {
      try {
        await postSlack(HEARTBEAT_CHANNEL, summaryText, [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${summaryText}\n_Durée : ${Math.round((Date.now() - startedAt.getTime()) / 1000)}s_`,
            },
          },
        ]);
      } catch { /* if heartbeat fails, don't 500 — logs still capture the run */ }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        check_date: checkDate,
        dry_run: dryRun,
        clients_checked: clientsChecked,
        anomalies_fired: anomaliesFired,
        per_client: perClientLog,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message || "unknown error";
    // Top-level failure: workflow itself died — this is the "absence of heartbeat"
    // signal, so we also post an explicit failure message to the alerts channel.
    try {
      await postSlack(
        ALERT_CHANNEL,
        `⚠️ WORKFLOW ANOMALY CHECK EN ÉCHEC`,
        [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `⚠️ *WORKFLOW ANOMALY CHECK EN ÉCHEC (${checkDate})*\n${msg}\n_Aucun heartbeat ne sera envoyé — investiguer les logs de la fonction check-ad-anomalies._`,
          },
        }],
      );
    } catch { /* nothing more to do */ }
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
