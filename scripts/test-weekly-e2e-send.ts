// Simule un tick du pulse-weekly-scheduler pour un meeting spécifique :
//   1. Récupère le meeting + client via proxy DB
//   2. Crée la pulse_surveys row (type='weekly') via proxy DB
//   3. Envoie l'email via proxy resend.send
//   4. (SMS/Slack pas testés — pas d'action twilio dans le proxy)
//   5. Met à jour client_meetings avec pulse_survey_id + initial_sent_at
//
// Usage: npx tsx scripts/test-weekly-e2e-send.ts <meeting_id>
// Ex:    npx tsx scripts/test-weekly-e2e-send.ts eb8f2f49-f933-43cc-bebf-ede029e6cd42
//
// PORTÉE: valide templates + Resend + DB shape end-to-end. Ne teste pas
// le SMS ni l'orchestration (crons/décisions T-48h). La logique de décision
// est validée séparément par test-weekly-scheduler-dryrun.ts.

import { dbQuery, dbExec, proxy } from "./proxy.ts";
import { renderPulseEmail } from "../supabase/functions/_shared/pulseTemplates.ts";

const APP_URL = "https://profit-first-media-buying.vercel.app";
const FROM = "TDIA <onboarding@resend.dev>";

async function main() {
  const meetingId = process.argv[2];
  if (!meetingId) { console.error("Usage: <meeting_id>"); process.exit(1); }

  // 1) Meeting
  const mRes = await dbQuery<{ ok: boolean; data: Array<{
    id: string; client_code: string; scheduled_at: string;
    pulse_survey_id: string | null; initial_sent_at: string | null;
  }> }>(`SELECT id, client_code, scheduled_at, pulse_survey_id, initial_sent_at FROM client_meetings WHERE id = '${meetingId}' LIMIT 1`);
  const m = (mRes.data ?? [])[0];
  if (!m) { console.error("meeting introuvable"); process.exit(1); }
  console.log(`Meeting ${m.id} · ${m.client_code} · scheduled ${m.scheduled_at}`);
  if (m.initial_sent_at) {
    console.log(`⚠ initial_sent_at déjà set (${m.initial_sent_at}) — abort (déjà envoyé)`);
    process.exit(0);
  }

  // 2) Client
  const cRes = await dbQuery<{ ok: boolean; data: Array<{
    client_code: string; email: string | null; phone: string | null;
    client_name: string | null; company_name: string | null; client_language: string | null;
  }> }>(`SELECT client_code, email, phone, client_name, company_name, client_language FROM client_progress WHERE client_code = '${m.client_code}' LIMIT 1`);
  const client = (cRes.data ?? [])[0];
  if (!client) { console.error("client introuvable dans client_progress"); process.exit(1); }
  console.log(`Client: ${client.client_name} <${client.email}> (${client.client_language || "fr"})`);

  // 3) Create pulse_surveys row (type='weekly') — génère l'UUID côté client
  //    pour éviter d'avoir à lire back après l'INSERT (db.exec ne renvoie rien).
  const token = crypto.randomUUID().replace(/-/g, "");
  const surveyId = crypto.randomUUID();
  const now = new Date();
  const meetingAt = new Date(m.scheduled_at);
  const expiresAt = new Date(meetingAt.getTime() + 6 * 3_600_000);

  await dbExec(`
    INSERT INTO pulse_surveys (id, client_code, type, token, sent_at, expires_at, sent_channels, manual, created_by)
    VALUES ('${surveyId}', '${client.client_code}', 'weekly', '${token}', '${now.toISOString()}', '${expiresAt.toISOString()}', ARRAY[]::text[], false, 'e2e_test:${m.id}')
  `);
  console.log(`✓ pulse_surveys row créée: ${surveyId}`);

  // 4) Rendre email
  const rendered = renderPulseEmail({
    type: "weekly",
    variant: "initial",
    firstName: client.client_name,
    clientName: client.client_name,
    companyName: client.company_name,
    clientCode: client.client_code,
    appUrl: APP_URL,
    language: client.client_language,
  });
  console.log(`✓ template rendu — subject: "${rendered.subject}"`);

  // 5) Envoi via proxy resend.send
  if (!client.email) {
    console.log("⚠ pas d'email — skip envoi (SMS not tested here)");
    return;
  }
  const sendRes = await proxy<{ ok?: boolean; error?: string; id?: string }>({
    action: "resend.send",
    payload: { from: FROM, to: client.email, subject: rendered.subject, html: rendered.html },
  });
  console.log("resend.send response:", JSON.stringify(sendRes));

  // 6) Update meeting (only if send didn't error)
  if (!sendRes.error) {
    await dbExec(`UPDATE client_meetings SET pulse_survey_id = '${surveyId}', initial_sent_at = '${now.toISOString()}' WHERE id = '${m.id}'`);
    await dbExec(`UPDATE pulse_surveys SET sent_channels = ARRAY['email']::text[] WHERE id = '${surveyId}'`);
    console.log(`✓ meeting mis à jour — pulse_survey_id + initial_sent_at`);
  } else {
    console.log("⚠ envoi email en erreur — meeting non mis à jour, survey reste ouverte");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
