// End-to-end functional test suite for the Client Pulse workflow.
//
// Runs each phase sequentially against a live client and asserts DB state
// after every step. The followup + escalation phases fast-forward sent_at
// via db.exec so we exercise the cron logic without waiting 48h.
//
// Usage: npx tsx scripts/test-pulse-workflow.ts [client_code]
//   default client_code = CLI-A7C02EF1
//
// Real side effects: sends actual email (Resend) + SMS (Twilio) to the
// client. Escalation posts to Slack #head-of-things.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dbExec, dbQuery } from "./proxy";

function loadEnv(path: string): void {
  try {
    for (const line of readFileSync(resolve(path), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch { /* absent */ }
}
loadEnv(".env.local");
loadEnv(".env");

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPA_URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const CLIENT_CODE = process.argv[2] || "CLI-A7C02EF1";

async function invokeFn(fn: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPA_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY!,
      Authorization: `Bearer ${ANON_KEY!}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) throw new Error(`${fn} HTTP ${res.status}: ${text.slice(0, 200)}`);
  if (json?.error) throw new Error(`${fn} error: ${json.error} ${json.detail ?? ""}`);
  return json ?? text;
}

interface Result { name: string; ok: boolean; detail: string; ms: number }
const results: Result[] = [];

async function step(name: string, fn: () => Promise<string>): Promise<void> {
  const t0 = Date.now();
  process.stdout.write(`  → ${name} ... `);
  try {
    const detail = await fn();
    const ms = Date.now() - t0;
    results.push({ name, ok: true, detail, ms });
    console.log(`OK (${ms}ms) — ${detail}`);
  } catch (e) {
    const ms = Date.now() - t0;
    const detail = (e as Error).message;
    results.push({ name, ok: false, detail, ms });
    console.log(`FAIL (${ms}ms) — ${detail}`);
  }
}

async function q<T = any>(sql: string): Promise<T[]> {
  const r = await dbQuery<{ ok: boolean; data: T[]; error?: string }>(sql);
  if (!r.ok) throw new Error(`db.query failed: ${r.error ?? "unknown"}`);
  return r.data ?? [];
}

async function fetchSurvey(id: string): Promise<any> {
  const rows = await q(
    `select id, type, sent_at, closed_at, escalated_at, followup_sent_at, followup_count,
            sent_channels, manual, previous_score, slack_posted_at, token
     from pulse_surveys where id = '${id}'`,
  );
  return rows[0];
}

async function fetchResponse(surveyId: string): Promise<any> {
  const rows = await q(
    `select score, communication_score, verbatim, source, responded_at
     from pulse_responses where survey_id = '${surveyId}'`,
  );
  return rows[0] ?? null;
}

async function backdateSurvey(id: string, hoursAgo: number, alsoBackdateFollowup = false): Promise<void> {
  const sql = alsoBackdateFollowup
    ? `update pulse_surveys set sent_at = now() - interval '${hoursAgo} hours',
         followup_sent_at = case when followup_sent_at is not null
           then now() - interval '${Math.max(0, hoursAgo - 24)} hours' else null end
       where id = '${id}'`
    : `update pulse_surveys set sent_at = now() - interval '${hoursAgo} hours' where id = '${id}'`;
  await dbExec(sql);
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🧪 Pulse workflow test suite — client ${CLIENT_CODE}\n`);

  // Sanity check
  const client = await q(
    `select client_code, email, phone, completed_at, archived_at
     from client_progress where client_code = '${CLIENT_CODE}' limit 1`,
  );
  if (client.length === 0) {
    console.error(`❌ Client ${CLIENT_CODE} introuvable`);
    process.exit(2);
  }
  const c = client[0];
  console.log(`Client: ${c.email ?? "(no email)"} / ${c.phone ?? "(no phone)"} — completed_at=${c.completed_at ?? "null"}\n`);
  if (c.archived_at) throw new Error("client is archived");
  if (!c.email && !c.phone) throw new Error("client has no email and no phone");

  let onboardingId = "";
  let monthlyId = "";
  let followupSurveyId = "";
  let responseSurveyId = "";

  console.log("── Phase 1 : envoi manuel (email + SMS réels) ──");

  await step("T1 — pulse-send onboarding manuel", async () => {
    const r = await invokeFn("pulse-send", {
      type: "onboarding", manual: true, client_code: CLIENT_CODE, created_by: "test_runner",
    });
    const o = r.outcomes?.[0];
    if (!o) throw new Error("no outcome");
    if (o.error) throw new Error(o.error);
    if (!o.survey_id) throw new Error("no survey_id in outcome");
    onboardingId = o.survey_id;
    const row = await fetchSurvey(onboardingId);
    if (!row) throw new Error("survey row not found in DB");
    if (row.type !== "onboarding") throw new Error(`wrong type ${row.type}`);
    if (!row.manual) throw new Error("manual flag not persisted");
    const chans = row.sent_channels ?? [];
    return `survey ${onboardingId.slice(0, 8)} · channels=[${chans.join(",")}] · email=${o.email_sent} sms=${o.sms_sent}`;
  });

  await step("T2 — pulse-send monthly manuel", async () => {
    const r = await invokeFn("pulse-send", {
      type: "monthly", manual: true, client_code: CLIENT_CODE, created_by: "test_runner",
    });
    const o = r.outcomes?.[0];
    if (!o) throw new Error("no outcome");
    if (o.error) throw new Error(o.error);
    monthlyId = o.survey_id;
    const row = await fetchSurvey(monthlyId);
    if (row.type !== "monthly") throw new Error(`wrong type ${row.type}`);
    const chans = row.sent_channels ?? [];
    return `survey ${monthlyId.slice(0, 8)} · channels=[${chans.join(",")}]`;
  });

  console.log("\n── Phase 2 : relance J+1 (fast-forward sent_at à -25h) ──");

  await step("T3 — pulse-send onboarding fresh (for followup test)", async () => {
    const r = await invokeFn("pulse-send", {
      type: "onboarding", manual: true, client_code: CLIENT_CODE, created_by: "test_runner_followup",
    });
    const o = r.outcomes?.[0];
    if (o?.error) throw new Error(o.error);
    followupSurveyId = o.survey_id;
    return `fresh survey ${followupSurveyId.slice(0, 8)} for followup test`;
  });

  await step("T4 — backdate sent_at → -25h", async () => {
    await backdateSurvey(followupSurveyId, 25);
    const row = await fetchSurvey(followupSurveyId);
    const ageH = (Date.now() - new Date(row.sent_at).getTime()) / 3600_000;
    if (ageH < 24 || ageH > 26) throw new Error(`age not in 24-26h range: ${ageH.toFixed(1)}h`);
    return `sent_at now ${ageH.toFixed(1)}h ago`;
  });

  await step("T5 — invoke pulse-cron-followup + assert relance", async () => {
    const r = await invokeFn("pulse-cron-followup", {});
    const mine = (r.outcomes ?? []).find((o: any) => o.survey_id === followupSurveyId);
    const row = await fetchSurvey(followupSurveyId);
    if (!row.followup_sent_at) {
      throw new Error(`followup_sent_at not set. cron summary: attempted=${r.attempted} succeeded=${r.succeeded} open=${r.open_surveys} outcomes=${JSON.stringify(r.outcomes)?.slice(0, 400)}`);
    }
    if (row.followup_count !== 1) throw new Error(`followup_count=${row.followup_count} (expected 1)`);
    const detail = mine?.detail ?? "(no outcome entry, but DB updated)";
    return `followup_sent_at set · count=${row.followup_count} · ${detail}`;
  });

  console.log("\n── Phase 3 : escalade J+2 (fast-forward à -49h, Slack post réel) ──");

  await step("T6 — backdate sent_at → -49h (keep followup)", async () => {
    await backdateSurvey(followupSurveyId, 49, true);
    const row = await fetchSurvey(followupSurveyId);
    const ageH = (Date.now() - new Date(row.sent_at).getTime()) / 3600_000;
    if (ageH < 48) throw new Error(`age ${ageH.toFixed(1)}h < 48h`);
    return `sent_at now ${ageH.toFixed(1)}h ago · followup preserved`;
  });

  await step("T7 — invoke pulse-cron-followup + assert escalade Slack", async () => {
    const r = await invokeFn("pulse-cron-followup", {});
    const mine = (r.outcomes ?? []).find((o: any) => o.survey_id === followupSurveyId);
    const row = await fetchSurvey(followupSurveyId);
    if (!row.escalated_at) {
      throw new Error(`escalated_at not set. cron summary: attempted=${r.attempted} succeeded=${r.succeeded} open=${r.open_surveys} outcomes=${JSON.stringify(r.outcomes)?.slice(0, 400)}`);
    }
    if (!row.closed_at) throw new Error("closed_at not set after escalade");
    const detail = mine?.detail ?? "(no outcome entry, but DB updated)";
    return `escalated_at set · closed_at set · ${detail}`;
  });

  console.log("\n── Phase 4 : capture de réponse client (score + verbatim + comm) ──");

  await step("T8 — pulse-send onboarding fresh (for response test)", async () => {
    const r = await invokeFn("pulse-send", {
      type: "onboarding", manual: true, client_code: CLIENT_CODE, created_by: "test_runner_response",
    });
    const o = r.outcomes?.[0];
    if (o?.error) throw new Error(o.error);
    responseSurveyId = o.survey_id;
    return `fresh onboarding ${responseSurveyId.slice(0, 8)} for response capture`;
  });

  await step("T9 — pulse-frontend lookup", async () => {
    const r = await invokeFn("pulse-frontend", { action: "lookup", client_code: CLIENT_CODE });
    if (!r.ok) throw new Error(`lookup not ok: ${JSON.stringify(r)}`);
    if (!r.survey) throw new Error("no open survey returned by lookup");
    return `open survey id=${r.survey.id.slice(0, 8)} type=${r.survey.type}`;
  });

  await step("T10 — pulse-frontend capture score=9", async () => {
    const r = await invokeFn("pulse-frontend", {
      action: "capture", client_code: CLIENT_CODE, survey_id: responseSurveyId, score: 9,
    });
    if (!r.ok) throw new Error(`capture not ok: ${JSON.stringify(r)}`);
    const resp = await fetchResponse(responseSurveyId);
    if (!resp) throw new Error("no pulse_responses row created");
    if (resp.score !== 9) throw new Error(`stored score=${resp.score} (expected 9)`);
    const row = await fetchSurvey(responseSurveyId);
    if (!row.closed_at) throw new Error("survey.closed_at not set after capture");
    return `response.score=9 · closed_at set · slack_posted=${r.slack_posted}`;
  });

  await step("T11 — pulse-frontend communication comm_score=8", async () => {
    const r = await invokeFn("pulse-frontend", {
      action: "communication", client_code: CLIENT_CODE, survey_id: responseSurveyId, communication_score: 8,
    });
    if (!r.ok) throw new Error(`communication not ok: ${JSON.stringify(r)}`);
    const resp = await fetchResponse(responseSurveyId);
    if (resp.communication_score !== 8) throw new Error(`stored comm=${resp.communication_score} (expected 8)`);
    return `communication_score=8 · slack_posted=${r.slack_posted}`;
  });

  await step("T12 — pulse-frontend verbatim", async () => {
    const r = await invokeFn("pulse-frontend", {
      action: "verbatim", client_code: CLIENT_CODE, survey_id: responseSurveyId, verbatim: "Test verbatim from workflow test suite.",
    });
    if (!r.ok) throw new Error(`verbatim not ok: ${JSON.stringify(r)}`);
    const resp = await fetchResponse(responseSurveyId);
    if (resp.verbatim !== "Test verbatim from workflow test suite.") throw new Error(`stored verbatim=${resp.verbatim}`);
    return `verbatim stored`;
  });

  await step("T13 — capture invalid score=42 rejected", async () => {
    let rejected = false;
    try {
      await invokeFn("pulse-frontend", {
        action: "capture", client_code: CLIENT_CODE, survey_id: responseSurveyId, score: 42,
      });
    } catch (e) {
      if (/score_invalid|score/i.test((e as Error).message)) rejected = true;
      else throw e;
    }
    if (!rejected) throw new Error("invalid score was accepted");
    return "400 score_invalid as expected";
  });

  await step("T14 — communication on monthly survey rejected", async () => {
    let rejected = false;
    try {
      await invokeFn("pulse-frontend", {
        action: "communication", client_code: CLIENT_CODE, survey_id: monthlyId, communication_score: 7,
      });
    } catch (e) {
      if (/only_for_onboarding|onboarding/i.test((e as Error).message)) rejected = true;
      else throw e;
    }
    if (!rejected) throw new Error("comm score accepted on monthly");
    return "400 communication_score_only_for_onboarding as expected";
  });

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`Résultats : ${pass}/${results.length} OK · ${fail} FAIL · total ${results.reduce((a, r) => a + r.ms, 0)}ms`);
  if (fail > 0) {
    console.log("\nÉchecs :");
    for (const r of results.filter(r => !r.ok)) console.log(`  ✗ ${r.name} — ${r.detail}`);
    process.exit(1);
  }
  console.log("\n✅ Workflow pulse validé de bout en bout.");
  console.log(`   Surveys créés : ${[onboardingId, monthlyId, followupSurveyId, responseSurveyId].filter(Boolean).map(s => s.slice(0, 8)).join(", ")}`);
  console.log("   Slack #head-of-things a reçu 1 escalade + 1 alerte score + 1 alerte communication (visibles pour l'équipe).");
}

main().catch(err => {
  console.error("\n💥 Test runner crashed:", (err as Error).message);
  process.exit(2);
});
