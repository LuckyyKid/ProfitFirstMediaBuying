// Dry-run du pulse-weekly-scheduler contre le vrai DB via integrations-proxy.
// Charge les meetings dans le scope et rapporte l'action que le scheduler
// PRENDRAIT à ce tick, sans envoyer d'email/SMS ni écrire dans la DB.
//
// Usage:
//   npx tsx scripts/test-weekly-scheduler-dryrun.ts
//   npx tsx scripts/test-weekly-scheduler-dryrun.ts CLI-A7C02EF1   (filtre client)

import { dbQuery } from "./proxy.ts";

const INITIAL_LEAD_HOURS = 48;
const FOLLOWUP_INTERVAL_HOURS = 24;
const LOOKBACK_HOURS = 4;

interface MeetingRow {
  id: string;
  client_code: string;
  scheduled_at: string;
  pulse_survey_id: string | null;
  initial_sent_at: string | null;
  last_followup_at: string | null;
  followup_count: number;
  slack_reminded_at: string | null;
}

interface ClientRow {
  client_code: string;
  email: string | null;
  phone: string | null;
  client_name: string | null;
  company_name: string | null;
  client_language: string | null;
}

interface SurveyRow {
  id: string;
  closed_at: string | null;
}

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 3_600_000;
}

async function main() {
  const filterClient = process.argv[2];
  const now = new Date();
  console.log(`[dry-run] scheduler tick à ${now.toISOString()} (UTC)\n`);

  const lowerBound = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000).toISOString();
  const clientFilter = filterClient ? ` AND client_code = '${filterClient}'` : "";
  const sqlMeetings = `
    SELECT id, client_code, scheduled_at, pulse_survey_id, initial_sent_at,
           last_followup_at, followup_count, slack_reminded_at
    FROM client_meetings
    WHERE scheduled_at >= '${lowerBound}'
      AND slack_reminded_at IS NULL${clientFilter}
    ORDER BY scheduled_at ASC
  `;
  const meetingsRes = await dbQuery(sqlMeetings);
  const meetings = (meetingsRes.data ?? []) as MeetingRow[];
  if (!meetings.length) {
    console.log("Aucun meeting dans le scope.");
    return;
  }
  console.log(`${meetings.length} meeting(s) dans le scope.\n`);

  for (const m of meetings) {
    const hoursUntil = hoursBetween(new Date(m.scheduled_at), now);
    console.log(`── Meeting ${m.id.slice(0, 8)} · ${m.client_code} · ${m.scheduled_at} · T${hoursUntil >= 0 ? "-" : "+"}${Math.abs(hoursUntil).toFixed(2)}h`);
    console.log(`   pulse_survey_id=${m.pulse_survey_id || "null"} initial_sent_at=${m.initial_sent_at || "null"} followup_count=${m.followup_count}`);

    // Load client
    const cRes = await dbQuery(`SELECT client_code, email, phone, client_name, company_name, client_language FROM client_progress WHERE client_code = '${m.client_code}' LIMIT 1`);
    const client = (cRes.data ?? [])[0] as ClientRow | undefined;

    // Load survey if present
    let survey: SurveyRow | undefined;
    if (m.pulse_survey_id) {
      const sRes = await dbQuery(`SELECT id, closed_at FROM pulse_surveys WHERE id = '${m.pulse_survey_id}' LIMIT 1`);
      survey = (sRes.data ?? [])[0] as SurveyRow | undefined;
    }
    const responded = !!survey?.closed_at;

    // Decide action (mirror scheduler logic)
    if (hoursUntil <= 0) {
      if (responded) {
        console.log(`   → RESPONSE_FOUND — survey closed, cycle done\n`);
      } else {
        console.log(`   → SLACK_REMINDED — post #client-nps, close cycle`);
        console.log(`      (client=${client ? `${client.client_name} <${client.email || "no-email"}>` : "INTROUVABLE"})\n`);
      }
      continue;
    }
    if (!client) {
      console.log(`   → SKIPPED — client introuvable dans client_progress\n`);
      continue;
    }
    if (!m.initial_sent_at) {
      if (hoursUntil > INITIAL_LEAD_HOURS) {
        console.log(`   → SKIPPED — T-${hoursUntil.toFixed(1)}h > ${INITIAL_LEAD_HOURS}h (initial pas encore dû)\n`);
      } else if (!client.email && !client.phone) {
        console.log(`   → SKIPPED — client sans email ni phone (attente ping Slack J-0)\n`);
      } else {
        console.log(`   → INITIAL_SENT — createSurvey(weekly) + email(${client.email || "-"}) + sms(${client.phone || "-"})\n`);
      }
      continue;
    }
    if (responded) {
      console.log(`   → SKIPPED — déjà répondu, attente jour du meeting\n`);
      continue;
    }
    const lastSendIso = m.last_followup_at || m.initial_sent_at;
    const hoursSinceLast = hoursBetween(now, new Date(lastSendIso));
    if (hoursSinceLast < FOLLOWUP_INTERVAL_HOURS) {
      console.log(`   → SKIPPED — dernier envoi il y a ${hoursSinceLast.toFixed(1)}h (< ${FOLLOWUP_INTERVAL_HOURS}h)\n`);
    } else {
      console.log(`   → FOLLOWUP_SENT — email+sms variant='followup' (dernier envoi il y a ${hoursSinceLast.toFixed(1)}h)\n`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
