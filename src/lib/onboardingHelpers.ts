// Shared admin helpers: progress %, current step, status, risk level.

export const ONBOARDING_STEPS = [
  { key: "welcome", label: "Bienvenue", flag: "welcome_completed_at", legacy: null as string | null },
  { key: "platforms", label: "Accès plateformes", flag: "platforms_completed_at", legacy: null },
  { key: "form", label: "Formulaire", flag: "form_completed_at", legacy: "welcome_form_submitted" },
  { key: "founder_scan", label: "Founder Scan", flag: "founder_scan_completed_at", legacy: "founder_scan_submitted" },
  { key: "business_deep_dive", label: "Business Deep Dive", flag: "business_deep_dive_completed_at", legacy: "business_deep_dive_submitted" },
  { key: "payment", label: "Paiement", flag: "payment_completed_at", legacy: "paid" },
  { key: "contract", label: "Contrat", flag: "contract_completed_at", legacy: "contract_signed" },
  { key: "kickoff", label: "Appel démarrage", flag: "kickoff_completed_at", legacy: "kickoff_scheduled" },
  { key: "done", label: "Terminé", flag: "completed_at", legacy: null },
] as const;

export type ClientRow = Record<string, any>;

export function isStepDone(client: ClientRow, idx: number): boolean {
  const step = ONBOARDING_STEPS[idx];
  if (!step) return false;
  if (step.key === "platforms") {
    return Boolean(client.platforms_completed_at || client.video_watched);
  }
  if (step.key === "kickoff") {
    return Boolean(
      client.kickoff_completed_at ||
      client.kickoff_scheduled_at ||
      client.kickoff_scheduled
    );
  }
  if (client[step.flag]) return true;
  if (step.legacy && client[step.legacy]) return true;
  return false;
}

export function completedStepsCount(client: ClientRow): number {
  let n = 0;
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) if (isStepDone(client, i)) n++;
  return n;
}

export function currentStepIndex(client: ClientRow): number {
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    if (!isStepDone(client, i)) return i;
  }
  return ONBOARDING_STEPS.length - 1;
}

export function normalizeClientProgress<T extends ClientRow>(client: T): T {
  if (!client) return client;

  const normalized: ClientRow = { ...client };

  if (normalized.platforms_completed_at || normalized.video_watched) {
    normalized.welcome_completed_at = normalized.welcome_completed_at ?? normalized.last_activity_at ?? normalized.updated_at ?? true;
  }

  if (normalized.form_completed_at || normalized.welcome_form_submitted) {
    normalized.welcome_completed_at = normalized.welcome_completed_at ?? normalized.form_completed_at ?? normalized.last_activity_at ?? true;
    normalized.platforms_completed_at = normalized.platforms_completed_at ?? normalized.form_completed_at ?? normalized.last_activity_at ?? true;
    normalized.video_watched = true;
  }

  if (normalized.founder_scan_completed_at || normalized.founder_scan_submitted) {
    normalized.welcome_completed_at = normalized.welcome_completed_at ?? normalized.founder_scan_completed_at ?? normalized.last_activity_at ?? true;
    normalized.platforms_completed_at = normalized.platforms_completed_at ?? normalized.founder_scan_completed_at ?? normalized.last_activity_at ?? true;
    normalized.form_completed_at = normalized.form_completed_at ?? normalized.founder_scan_completed_at ?? normalized.last_activity_at ?? true;
    normalized.welcome_form_submitted = true;
    normalized.video_watched = true;
  }

  if (normalized.payment_completed_at || normalized.paid) {
    normalized.welcome_completed_at = normalized.welcome_completed_at ?? normalized.payment_completed_at ?? normalized.last_activity_at ?? true;
    normalized.platforms_completed_at = normalized.platforms_completed_at ?? normalized.payment_completed_at ?? normalized.last_activity_at ?? true;
    normalized.form_completed_at = normalized.form_completed_at ?? normalized.payment_completed_at ?? normalized.last_activity_at ?? true;
    normalized.founder_scan_completed_at = normalized.founder_scan_completed_at ?? normalized.payment_completed_at ?? normalized.last_activity_at ?? true;
    normalized.welcome_form_submitted = true;
    normalized.founder_scan_submitted = true;
    normalized.video_watched = true;
  }

  if (normalized.contract_completed_at || normalized.contract_signed) {
    normalized.payment_completed_at = normalized.payment_completed_at ?? normalized.contract_completed_at ?? normalized.last_activity_at ?? true;
    normalized.paid = true;
  }

  if (normalized.kickoff_completed_at || normalized.kickoff_scheduled || normalized.kickoff_scheduled_at) {
    normalized.contract_completed_at = normalized.contract_completed_at ?? normalized.kickoff_completed_at ?? normalized.kickoff_scheduled_at ?? normalized.last_activity_at ?? true;
    normalized.contract_signed = true;
  }

  return normalized as T;
}

export function progressPercent(client: ClientRow): number {
  return Math.round((completedStepsCount(client) / ONBOARDING_STEPS.length) * 100);
}

export type GlobalStatus =
  | "Signed - Onboarding Sent"
  | "Onboarding Not Started"
  | "Onboarding In Progress"
  | "Onboarding Blocked"
  | "Payment Pending"
  | "Payment Completed"
  | "Contract Pending"
  | "Contract Signed"
  | "Kick-off Not Booked"
  | "Kick-off Booked"
  | "Onboarding Completed";

export function globalStatus(client: ClientRow): GlobalStatus {
  if (isStepDone(client, 8)) return "Onboarding Completed";
  if (isStepDone(client, 7)) return "Kick-off Booked";
  if (isStepDone(client, 6)) return "Kick-off Not Booked";
  if (isStepDone(client, 5)) return "Contract Pending";
  if (isStepDone(client, 4)) return "Payment Pending";
  const completed = completedStepsCount(client);
  if (completed === 0) {
    const sent = client.onboarding_sent_at ? new Date(client.onboarding_sent_at).getTime() : null;
    if (sent && Date.now() - sent < 60 * 60 * 1000) return "Signed - Onboarding Sent";
    return "Onboarding Not Started";
  }
  // Stuck > 24h on same step
  const last = client.last_activity_at ? new Date(client.last_activity_at).getTime() : null;
  if (last && Date.now() - last > 24 * 3600 * 1000) return "Onboarding Blocked";
  return "Onboarding In Progress";
}

export type Risk = "Low" | "Normal" | "Medium" | "High";

export function riskLevel(client: ClientRow): Risk {
  if (isStepDone(client, 8)) return "Low";
  const sent = client.onboarding_sent_at ? new Date(client.onboarding_sent_at).getTime() : null;
  const last = client.last_activity_at ? new Date(client.last_activity_at).getTime() : sent;
  const now = Date.now();
  const notStarted = completedStepsCount(client) === 0;
  if (notStarted && sent && now - sent > 48 * 3600 * 1000) return "High";
  if (notStarted && sent && now - sent > 24 * 3600 * 1000) return "Medium";
  if (last && now - last > 48 * 3600 * 1000) return "High";
  if (last && now - last > 24 * 3600 * 1000) return "Medium";
  return "Normal";
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "à l'instant";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

const GOOD = "bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))] border-[rgba(122,232,180,0.3)]";
const INFO = "bg-[rgba(77,159,255,0.08)] text-[#9ec8ff] border-[rgba(77,159,255,0.3)]";
const MUTED = "bg-[rgba(148,170,215,0.06)] text-[#c8d2e4] border-[rgba(148,170,215,0.15)]";
const WATCH = "bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))] border-[rgba(255,184,77,0.3)]";
const BAD = "bg-[rgba(255,107,107,0.08)] text-[hsl(var(--bad))] border-[rgba(255,107,107,0.3)]";

export const statusBadgeClass: Record<GlobalStatus, string> = {
  "Signed - Onboarding Sent": INFO,
  "Onboarding Not Started": MUTED,
  "Onboarding In Progress": INFO,
  "Onboarding Blocked": BAD,
  "Payment Pending": WATCH,
  "Payment Completed": GOOD,
  "Contract Pending": WATCH,
  "Contract Signed": GOOD,
  "Kick-off Not Booked": WATCH,
  "Kick-off Booked": GOOD,
  "Onboarding Completed": GOOD,
};

export const riskBadgeClass: Record<Risk, string> = {
  Low: GOOD,
  Normal: MUTED,
  Medium: WATCH,
  High: BAD,
};
