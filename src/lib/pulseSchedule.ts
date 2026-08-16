// pulseSchedule — miroir client-side de la logique cron de pulse-send.
// Sert à afficher dans /admin/pulse le prochain envoi automatique par
// client. Doit rester aligné avec supabase/functions/pulse-send/index.ts.
//
// Rappel des règles cron (voir pulse-send) :
//   - onboarding : envoyé une fois, dans une fenêtre ±12h autour de
//     completed_at + 7 jours. Skip si un pulse onboarding existe déjà
//     dans les 30 derniers jours.
//   - monthly    : envoyé le dernier jour ouvrable du mois (America/Toronto).
//     Skip si un pulse monthly existe déjà dans les 20 derniers jours.

const BIZDAY_TZ = "America/Toronto";
const DEDUP_ONBOARDING_DAYS = 30;
const DEDUP_MONTHLY_DAYS = 20;
const ONBOARDING_TARGET_DAYS = 7;

export type PulseKind = "onboarding" | "monthly";

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
  type: "onboarding" | "monthly" | "relational";
  sent_at: string;
}

export interface ScheduledPulse {
  client_code: string;
  display_name: string;
  type: PulseKind;
  next_send_at: Date;
  days_until: number;         // arrondi vers le haut, min 0
  channels: { email: boolean; sms: boolean };
  reason?: string;            // note explicative (ex : "déjà envoyé récemment")
  status: "scheduled" | "already_sent" | "no_channel";
}

// Utilise Intl pour extraire year/month/day/weekday dans une TZ donnée.
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

// Retourne le dernier jour ouvrable d'un mois donné (y=année 4 chiffres,
// m=1-12) en tenant compte de la TZ America/Toronto. Résultat = Date UTC
// correspondant à midi Toronto ce jour-là (proxy stable pour l'affichage
// du cron qui tourne le matin heure Est).
function lastBusinessDayOfMonth(y: number, m: number): Date {
  const lastCalendarDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let day = lastCalendarDay; day >= 1; day--) {
    const wd = new Intl.DateTimeFormat("en-CA", {
      timeZone: BIZDAY_TZ,
      weekday: "short",
    }).format(new Date(Date.UTC(y, m - 1, day, 16)));
    if (wd !== "Sat" && wd !== "Sun") {
      // 16h UTC ≈ 11h/12h Toronto → date affichée = ce jour dans BIZDAY_TZ
      return new Date(Date.UTC(y, m - 1, day, 16));
    }
  }
  return new Date(Date.UTC(y, m - 1, 1, 16));
}

// Prochain "dernier jour ouvrable de mois" à partir de now.
export function nextMonthlyPulseDate(now: Date = new Date()): Date {
  const nowParts = partsIn(now, BIZDAY_TZ);
  const thisMonth = lastBusinessDayOfMonth(nowParts.y, nowParts.m);
  if (thisMonth.getTime() >= now.getTime()) return thisMonth;
  const nextMonth = nowParts.m === 12 ? 1 : nowParts.m + 1;
  const nextYear = nowParts.m === 12 ? nowParts.y + 1 : nowParts.y;
  return lastBusinessDayOfMonth(nextYear, nextMonth);
}

// Version qui tient compte de la dédup 20 jours du cron monthly.
function nextMonthlyRespectingDedup(now: Date, lastMonthlySentAt: Date | null): Date {
  const naive = nextMonthlyPulseDate(now);
  if (!lastMonthlySentAt) return naive;
  const ageDays = (naive.getTime() - lastMonthlySentAt.getTime()) / (24 * 3600 * 1000);
  if (ageDays >= DEDUP_MONTHLY_DAYS) return naive;
  // Le prochain dernier-jour-ouvrable tombe dans la fenêtre de dédup ; on
  // saute au mois suivant.
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

// Point d'entrée principal — pour un client donné + son historique pulses,
// retourne 0/1/2 entrées (onboarding et/ou monthly).
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

  // ─── ONBOARDING ─────────────────────────────────────────────────────────
  const lastOnboarding = pulses
    .filter((p) => p.client_code === client.client_code && p.type === "onboarding")
    .map((p) => new Date(p.sent_at))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const completedAt = new Date(client.completed_at);
  const scheduledOnboarding = new Date(completedAt.getTime() + ONBOARDING_TARGET_DAYS * 24 * 3600 * 1000);

  if (lastOnboarding) {
    // Onboarding est one-shot par client. On l'affiche comme "déjà envoyé"
    // s'il l'a été récemment (dernier 30 jours = dédup). Sinon on n'affiche
    // rien (le client a déjà eu son onboarding, plus jamais).
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
  } else if (scheduledOnboarding.getTime() < now.getTime() - 12 * 3600 * 1000) {
    // Fenêtre ±12h dépassée sans envoi (client trop vieux, cron raté, etc.)
    // On considère qu'il ne recevra plus d'onboarding auto — on n'affiche rien.
  } else {
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

  // ─── MONTHLY ────────────────────────────────────────────────────────────
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

// Batch : calcule pour tous les clients d'un coup et renvoie une liste
// aplatie triée par days_until ascending.
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
