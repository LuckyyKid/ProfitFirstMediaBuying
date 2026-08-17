// pulseSchedule — miroir client-side de la logique des crons pulse.
// Sert à afficher dans /admin/pulse les prochains évènements automatiques
// (envois initiaux ET relances/escalades) par client. Doit rester aligné
// avec :
//   - supabase/functions/pulse-send/index.ts          (onboarding + monthly)
//   - supabase/functions/pulse-cron-followup/index.ts (relance J+1, escalade J+2)
//   - supabase/functions/pulse-weekly-scheduler/index.ts (weekly T-48h/+24h/J-0h)
//
// Règles clés :
//   - onboarding : envoyé une fois, fenêtre ±12h autour de completed_at + 7j.
//     Dédup 30j.
//   - monthly : envoyé dernier jour ouvrable America/Toronto. Dédup 20j.
//   - relance J+1 : 24h après sent_at si non-répondu et pas de followup_sent_at
//     (onboarding + monthly uniquement).
//   - escalade J+2 : 48h après sent_at si toujours non-répondu (ferme le cycle).
//   - weekly initial : T-48h avant client_meetings.scheduled_at.
//   - weekly followup : +24h après le dernier envoi tant que non-répondu.
//   - weekly slack ping : jour du meeting (T-0h) si non-répondu.

const BIZDAY_TZ = "America/Toronto";
const DEDUP_ONBOARDING_DAYS = 30;
const DEDUP_MONTHLY_DAYS = 20;
const ONBOARDING_TARGET_DAYS = 7;

const FOLLOWUP_AFTER_HOURS = 24;
const ESCALATE_AFTER_HOURS = 48;

const WEEKLY_INITIAL_LEAD_HOURS = 48;
const WEEKLY_FOLLOWUP_INTERVAL_HOURS = 24;

export type PulseKind = "onboarding" | "monthly";

export type PulseEventKind =
  | "onboarding_initial"
  | "onboarding_followup"      // pulse-cron-followup relance J+1
  | "onboarding_escalation"    // pulse-cron-followup escalade Slack J+2
  | "monthly_initial"
  | "monthly_followup"
  | "monthly_escalation"
  | "weekly_initial"           // pulse-weekly-scheduler T-48h
  | "weekly_followup"          // pulse-weekly-scheduler +24h
  | "weekly_slack_reminder";   // pulse-weekly-scheduler T-0h (ping #client-nps)

export interface ClientLite {
  client_code: string;
  completed_at: string | null;
  archived_at: string | null;
  email: string | null;
  phone: string | null;
  client_name: string | null;
  company_name: string | null;
}

export interface PulseLite {
  client_code: string;
  type: "onboarding" | "monthly" | "relational" | "weekly";
  sent_at: string;
}

// Survey ouverte (pour calculer les relances et escalades attendues)
export interface OpenSurveyLite {
  id: string;
  client_code: string;
  type: "onboarding" | "monthly" | "weekly" | "relational";
  sent_at: string;
  followup_sent_at: string | null;
  escalated_at: string | null;
  closed_at: string | null;
  expires_at: string;
}

// Meeting (pour calculer les évènements du cycle weekly)
export interface MeetingLite {
  id: string;
  client_code: string;
  scheduled_at: string;
  pulse_survey_id: string | null;
  initial_sent_at: string | null;
  last_followup_at: string | null;
  slack_reminded_at: string | null;
}

export interface ScheduledPulse {
  client_code: string;
  display_name: string;
  type: PulseKind;
  next_send_at: Date;
  days_until: number;         // arrondi vers le haut, min 0
  channels: { email: boolean; sms: boolean };
  reason?: string;
  status: "scheduled" | "already_sent" | "no_channel";
}

export interface ScheduledPulseEvent {
  key: string;                                       // stable pour React
  client_code: string;
  display_name: string;
  kind: PulseEventKind;
  next_send_at: Date;
  hours_until: number;
  days_until: number;
  channels: { email: boolean; sms: boolean };
  reason?: string;
  status: "scheduled" | "no_channel";
  meeting_id?: string;
  survey_id?: string;
}

// ─── Utilitaires temps ─────────────────────────────────────────────────────

function partsIn(date: Date, tz: string): { y: number; m: number; d: number; wd: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    wd: get("weekday"),
  };
}

function lastBusinessDayOfMonth(y: number, m: number): Date {
  const lastCalendarDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let day = lastCalendarDay; day >= 1; day--) {
    const wd = new Intl.DateTimeFormat("en-CA", {
      timeZone: BIZDAY_TZ,
      weekday: "short",
    }).format(new Date(Date.UTC(y, m - 1, day, 16)));
    if (wd !== "Sat" && wd !== "Sun") {
      return new Date(Date.UTC(y, m - 1, day, 16));
    }
  }
  return new Date(Date.UTC(y, m - 1, 1, 16));
}

export function nextMonthlyPulseDate(now: Date = new Date()): Date {
  const nowParts = partsIn(now, BIZDAY_TZ);
  const thisMonth = lastBusinessDayOfMonth(nowParts.y, nowParts.m);
  if (thisMonth.getTime() >= now.getTime()) return thisMonth;
  const nextMonth = nowParts.m === 12 ? 1 : nowParts.m + 1;
  const nextYear = nowParts.m === 12 ? nowParts.y + 1 : nowParts.y;
  return lastBusinessDayOfMonth(nextYear, nextMonth);
}

function nextMonthlyRespectingDedup(now: Date, lastMonthlySentAt: Date | null): Date {
  const naive = nextMonthlyPulseDate(now);
  if (!lastMonthlySentAt) return naive;
  const ageDays = (naive.getTime() - lastMonthlySentAt.getTime()) / (24 * 3600 * 1000);
  if (ageDays >= DEDUP_MONTHLY_DAYS) return naive;
  const parts = partsIn(naive, BIZDAY_TZ);
  const nextMonth = parts.m === 12 ? 1 : parts.m + 1;
  const nextYear = parts.m === 12 ? parts.y + 1 : parts.y;
  return lastBusinessDayOfMonth(nextYear, nextMonth);
}

function displayName(c: ClientLite): string {
  return c.company_name || c.client_name || c.client_code;
}

function daysUntil(target: Date, from: Date = new Date()): number {
  const diffMs = target.getTime() - from.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 3600 * 1000)));
}

function hoursUntil(target: Date, from: Date = new Date()): number {
  const diffMs = target.getTime() - from.getTime();
  return Math.max(0, diffMs / (3600 * 1000));
}

// ─── LEGACY : envois initiaux onboarding + monthly (retro compat) ─────────

export function scheduledPulsesForClient(
  client: ClientLite,
  pulses: PulseLite[],
  now: Date = new Date(),
): ScheduledPulse[] {
  const out: ScheduledPulse[] = [];
  if (client.archived_at || !client.completed_at) return out;

  const channels = { email: !!client.email, sms: !!client.phone };
  const noChannel = !channels.email && !channels.sms;
  const name = displayName(client);

  const lastOnboarding = pulses
    .filter((p) => p.client_code === client.client_code && p.type === "onboarding")
    .map((p) => new Date(p.sent_at))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const completedAt = new Date(client.completed_at);
  const scheduledOnboarding = new Date(completedAt.getTime() + ONBOARDING_TARGET_DAYS * 24 * 3600 * 1000);

  if (lastOnboarding) {
    const ageDays = (now.getTime() - lastOnboarding.getTime()) / (24 * 3600 * 1000);
    if (ageDays < DEDUP_ONBOARDING_DAYS) {
      out.push({
        client_code: client.client_code,
        display_name: name,
        type: "onboarding",
        next_send_at: lastOnboarding,
        days_until: 0,
        channels,
        status: "already_sent",
        reason: `déjà envoyé il y a ${Math.floor(ageDays)}j`,
      });
    }
  } else if (scheduledOnboarding.getTime() >= now.getTime() - 12 * 3600 * 1000) {
    out.push({
      client_code: client.client_code,
      display_name: name,
      type: "onboarding",
      next_send_at: scheduledOnboarding,
      days_until: daysUntil(scheduledOnboarding, now),
      channels,
      status: noChannel ? "no_channel" : "scheduled",
      reason: noChannel ? "ni email ni téléphone" : undefined,
    });
  }

  const lastMonthly = pulses
    .filter((p) => p.client_code === client.client_code && p.type === "monthly")
    .map((p) => new Date(p.sent_at))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const nextMonthly = nextMonthlyRespectingDedup(now, lastMonthly ?? null);
  out.push({
    client_code: client.client_code,
    display_name: name,
    type: "monthly",
    next_send_at: nextMonthly,
    days_until: daysUntil(nextMonthly, now),
    channels,
    status: noChannel ? "no_channel" : "scheduled",
    reason: noChannel ? "ni email ni téléphone" : undefined,
  });

  return out;
}

export function computeAllScheduledPulses(
  clients: ClientLite[],
  pulses: PulseLite[],
  now: Date = new Date(),
): ScheduledPulse[] {
  const all: ScheduledPulse[] = [];
  for (const c of clients) {
    for (const sp of scheduledPulsesForClient(c, pulses, now)) {
      all.push(sp);
    }
  }
  return all.sort((a, b) => {
    if (a.status === "already_sent" && b.status !== "already_sent") return 1;
    if (a.status !== "already_sent" && b.status === "already_sent") return -1;
    return a.days_until - b.days_until;
  });
}

// ─── ENRICHI : envois initiaux + relances + escalades + weekly ─────────────

// Calcule l'évènement de RELANCE (J+1) attendu pour une survey ouverte
// onboarding/monthly. Retourne null si pas applicable (déjà relancée,
// déjà escaladée, ou fenêtre dépassée).
function followupEventForSurvey(
  survey: OpenSurveyLite,
  client: ClientLite,
  now: Date,
): ScheduledPulseEvent | null {
  if (survey.type !== "onboarding" && survey.type !== "monthly") return null;
  if (survey.followup_sent_at || survey.escalated_at || survey.closed_at) return null;

  const sentAt = new Date(survey.sent_at);
  const ageHours = (now.getTime() - sentAt.getTime()) / (3600 * 1000);
  // Le cron déclenche entre 24h et 48h. Si on est déjà > 48h sans followup,
  // c'est bizarre — on affiche quand même comme "dû immédiatement".
  if (ageHours >= ESCALATE_AFTER_HOURS) return null;

  const nextAt = new Date(sentAt.getTime() + FOLLOWUP_AFTER_HOURS * 3600 * 1000);
  const channels = { email: !!client.email, sms: !!client.phone };
  const noChannel = !channels.email && !channels.sms;
  const kind: PulseEventKind = survey.type === "onboarding" ? "onboarding_followup" : "monthly_followup";
  return {
    key: `followup:${survey.id}`,
    client_code: client.client_code,
    display_name: displayName(client),
    kind,
    next_send_at: nextAt,
    hours_until: hoursUntil(nextAt, now),
    days_until: daysUntil(nextAt, now),
    channels,
    status: noChannel ? "no_channel" : "scheduled",
    reason: noChannel ? "ni email ni téléphone" : undefined,
    survey_id: survey.id,
  };
}

// Calcule l'évènement d'ESCALADE (J+2) attendu pour une survey ouverte
// onboarding/monthly qui a déjà été relancée ou qui atteint 48h.
function escalationEventForSurvey(
  survey: OpenSurveyLite,
  client: ClientLite,
  now: Date,
): ScheduledPulseEvent | null {
  if (survey.type !== "onboarding" && survey.type !== "monthly") return null;
  if (survey.escalated_at || survey.closed_at) return null;

  const sentAt = new Date(survey.sent_at);
  const nextAt = new Date(sentAt.getTime() + ESCALATE_AFTER_HOURS * 3600 * 1000);
  const kind: PulseEventKind = survey.type === "onboarding" ? "onboarding_escalation" : "monthly_escalation";
  return {
    key: `escalation:${survey.id}`,
    client_code: client.client_code,
    display_name: displayName(client),
    kind,
    next_send_at: nextAt,
    hours_until: hoursUntil(nextAt, now),
    days_until: daysUntil(nextAt, now),
    channels: { email: !!client.email, sms: !!client.phone },
    status: "scheduled",
    reason: "Slack #head-of-things",
    survey_id: survey.id,
  };
}

// Calcule les évènements du cycle weekly attaché à un meeting.
// - initial : T-48h avant scheduled_at (si initial_sent_at IS NULL)
// - followup : dernier envoi + 24h (si initial_sent_at != null, pas de closed_at, pas de slack_reminded_at)
// - slack_reminder : scheduled_at (si pas de slack_reminded_at)
function weeklyEventsForMeeting(
  meeting: MeetingLite,
  client: ClientLite,
  openSurvey: OpenSurveyLite | undefined,
  now: Date,
): ScheduledPulseEvent[] {
  const events: ScheduledPulseEvent[] = [];
  if (meeting.slack_reminded_at) return events;   // cycle fermé

  const scheduledAt = new Date(meeting.scheduled_at);
  const hoursUntilMeeting = (scheduledAt.getTime() - now.getTime()) / (3600 * 1000);
  const channels = { email: !!client.email, sms: !!client.phone };
  const noChannel = !channels.email && !channels.sms;
  const responded = !!openSurvey?.closed_at;

  // Ping Slack J-0 : toujours si non-répondu et meeting pas encore passé
  if (!responded) {
    events.push({
      key: `weekly_slack:${meeting.id}`,
      client_code: client.client_code,
      display_name: displayName(client),
      kind: "weekly_slack_reminder",
      next_send_at: scheduledAt,
      hours_until: hoursUntil(scheduledAt, now),
      days_until: daysUntil(scheduledAt, now),
      channels: { email: false, sms: false },      // Slack, pas email/SMS
      status: "scheduled",
      reason: `Slack #client-nps si non-rempli · meeting le ${scheduledAt.toLocaleDateString("fr-CA")}`,
      meeting_id: meeting.id,
    });
  }

  if (!meeting.initial_sent_at) {
    // Envoi initial dû à T-48h (ou tout de suite si meeting < 48h)
    const initialAt = hoursUntilMeeting > WEEKLY_INITIAL_LEAD_HOURS
      ? new Date(scheduledAt.getTime() - WEEKLY_INITIAL_LEAD_HOURS * 3600 * 1000)
      : now;
    events.push({
      key: `weekly_initial:${meeting.id}`,
      client_code: client.client_code,
      display_name: displayName(client),
      kind: "weekly_initial",
      next_send_at: initialAt,
      hours_until: hoursUntil(initialAt, now),
      days_until: daysUntil(initialAt, now),
      channels,
      status: noChannel ? "no_channel" : "scheduled",
      reason: noChannel ? "ni email ni téléphone" : undefined,
      meeting_id: meeting.id,
    });
  } else if (!responded && hoursUntilMeeting > 0) {
    // Suivi +24h tant que non-répondu et meeting pas encore passé
    const lastSend = new Date(meeting.last_followup_at || meeting.initial_sent_at);
    const nextFollowup = new Date(lastSend.getTime() + WEEKLY_FOLLOWUP_INTERVAL_HOURS * 3600 * 1000);
    // Cap au meeting : si le prochain followup tombe après, il ne partira jamais
    // (le J-0 prend le relais) — on ne l'affiche que s'il tombe avant le meeting.
    if (nextFollowup.getTime() < scheduledAt.getTime()) {
      events.push({
        key: `weekly_followup:${meeting.id}:${lastSend.getTime()}`,
        client_code: client.client_code,
        display_name: displayName(client),
        kind: "weekly_followup",
        next_send_at: nextFollowup,
        hours_until: hoursUntil(nextFollowup, now),
        days_until: daysUntil(nextFollowup, now),
        channels,
        status: noChannel ? "no_channel" : "scheduled",
        reason: noChannel ? "ni email ni téléphone" : undefined,
        meeting_id: meeting.id,
        survey_id: openSurvey?.id,
      });
    }
  }

  return events;
}

// Calcule tous les évènements programmés pour un client (initial + relance
// + escalade + weekly). Prend en entrée : les surveys ouvertes du client,
// les meetings à venir du client, et l'historique envois passés (pour
// calculer les prochains initiaux via la logique legacy).
export function scheduledEventsForClient(
  client: ClientLite,
  pastPulses: PulseLite[],
  openSurveys: OpenSurveyLite[],
  meetings: MeetingLite[],
  now: Date = new Date(),
): ScheduledPulseEvent[] {
  const out: ScheduledPulseEvent[] = [];
  if (client.archived_at) return out;

  const clientMeetings = meetings.filter((m) => m.client_code === client.client_code);
  const clientSurveys = openSurveys.filter((s) => s.client_code === client.client_code);

  // Envois initiaux onboarding + monthly (via logique legacy)
  const initials = scheduledPulsesForClient(client, pastPulses, now);
  for (const sp of initials) {
    if (sp.status === "already_sent") continue;
    const kind: PulseEventKind = sp.type === "onboarding" ? "onboarding_initial" : "monthly_initial";
    out.push({
      key: `${kind}:${client.client_code}:${sp.next_send_at.getTime()}`,
      client_code: sp.client_code,
      display_name: sp.display_name,
      kind,
      next_send_at: sp.next_send_at,
      hours_until: hoursUntil(sp.next_send_at, now),
      days_until: sp.days_until,
      channels: sp.channels,
      status: sp.status === "no_channel" ? "no_channel" : "scheduled",
      reason: sp.reason,
    });
  }

  // Relances + escalades sur surveys ouvertes
  for (const s of clientSurveys) {
    const fu = followupEventForSurvey(s, client, now);
    if (fu) out.push(fu);
    const esc = escalationEventForSurvey(s, client, now);
    if (esc) out.push(esc);
  }

  // Weekly (initial + followup + slack) par meeting à venir
  for (const m of clientMeetings) {
    const survey = clientSurveys.find((s) => s.id === m.pulse_survey_id);
    for (const ev of weeklyEventsForMeeting(m, client, survey, now)) {
      out.push(ev);
    }
  }

  return out;
}

export function computeAllScheduledEvents(
  clients: ClientLite[],
  pastPulses: PulseLite[],
  openSurveys: OpenSurveyLite[],
  meetings: MeetingLite[],
  now: Date = new Date(),
): ScheduledPulseEvent[] {
  const all: ScheduledPulseEvent[] = [];
  for (const c of clients) {
    for (const ev of scheduledEventsForClient(c, pastPulses, openSurveys, meetings, now)) {
      all.push(ev);
    }
  }
  return all.sort((a, b) => a.next_send_at.getTime() - b.next_send_at.getTime());
}

export const EVENT_LABEL: Record<PulseEventKind, string> = {
  onboarding_initial: "Onboarding J+7",
  onboarding_followup: "Onboarding · relance J+1",
  onboarding_escalation: "Onboarding · escalade Slack J+2",
  monthly_initial: "Mensuel",
  monthly_followup: "Mensuel · relance J+1",
  monthly_escalation: "Mensuel · escalade Slack J+2",
  weekly_initial: "Hebdo · envoi initial (T-48h)",
  weekly_followup: "Hebdo · suivi (+24h)",
  weekly_slack_reminder: "Hebdo · ping Slack #client-nps (jour du meeting)",
};
