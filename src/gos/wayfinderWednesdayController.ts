import { supabase } from "@/integrations/supabase/client";

type QueryRow = Record<string, unknown>;

export type WayfinderSession = {
  id: string;
  client_id: string;
  session_date: string;
  week_label: string | null;
  status: string;
  facilitator: string | null;
  participants: string[];
  objective_ids: string[];
  winner_concept_ids: string[];
  loser_concept_ids: string[];
  performance_summary: string | null;
  key_learnings: string | null;
  decisions: string | null;
  next_actions: string | null;
  blockers: string | null;
  next_session_date: string | null;
  notes: string | null;
};

export type WayfinderObjective = {
  id: string;
  label: string;
};

export type WayfinderConcept = {
  id: string;
  concept_name: string;
  status: string;
};

export type WayfinderWednesdayData = {
  sessions: WayfinderSession[];
  objectives: WayfinderObjective[];
  concepts: WayfinderConcept[];
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (item == null ? "" : String(item).trim())).filter(Boolean)
    : [];
}

export function nextWednesday(from = new Date()): string {
  const d = new Date(from);
  const day = d.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `S${week} - ${d.getFullYear()}`;
}

export function normalizeWayfinderSessionRow(row: QueryRow): WayfinderSession {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    session_date: optionalString(row.session_date) ?? "",
    week_label: optionalString(row.week_label),
    status: optionalString(row.status) ?? "draft",
    facilitator: optionalString(row.facilitator),
    participants: stringArray(row.participants),
    objective_ids: stringArray(row.objective_ids),
    winner_concept_ids: stringArray(row.winner_concept_ids),
    loser_concept_ids: stringArray(row.loser_concept_ids),
    performance_summary: optionalString(row.performance_summary),
    key_learnings: optionalString(row.key_learnings),
    decisions: optionalString(row.decisions),
    next_actions: optionalString(row.next_actions),
    blockers: optionalString(row.blockers),
    next_session_date: optionalString(row.next_session_date),
    notes: optionalString(row.notes),
  };
}

export function normalizeWayfinderObjectiveRow(row: QueryRow): WayfinderObjective {
  return {
    id: String(row.id ?? ""),
    label: optionalString(row.label) ?? "",
  };
}

export function normalizeWayfinderConceptRow(row: QueryRow): WayfinderConcept {
  return {
    id: String(row.id ?? ""),
    concept_name: optionalString(row.concept_name) ?? "",
    status: optionalString(row.status) ?? "draft",
  };
}

export function toWayfinderSessionCreatePayload(clientId: string, date = nextWednesday()) {
  return {
    client_id: clientId,
    session_date: date,
    week_label: weekLabel(date),
    status: "draft",
    participants: [],
    objective_ids: [],
    winner_concept_ids: [],
    loser_concept_ids: [],
  };
}

export function toWayfinderSessionUpdatePayload(session: WayfinderSession) {
  return {
    session_date: optionalString(session.session_date) ?? nextWednesday(),
    week_label: optionalString(session.week_label) ?? weekLabel(session.session_date),
    status: optionalString(session.status) ?? "draft",
    facilitator: optionalString(session.facilitator),
    participants: stringArray(session.participants),
    objective_ids: stringArray(session.objective_ids),
    winner_concept_ids: stringArray(session.winner_concept_ids),
    loser_concept_ids: stringArray(session.loser_concept_ids),
    performance_summary: optionalString(session.performance_summary),
    key_learnings: optionalString(session.key_learnings),
    decisions: optionalString(session.decisions),
    next_actions: optionalString(session.next_actions),
    blockers: optionalString(session.blockers),
    next_session_date: optionalString(session.next_session_date),
    notes: optionalString(session.notes),
  };
}

export async function fetchWayfinderWednesdayData(clientId: string): Promise<WayfinderWednesdayData> {
  const [sessionsResult, objectivesResult, conceptsResult] = await Promise.all([
    supabase
      .from("gos_wayfinder_sessions" as never)
      .select("*")
      .eq("client_id", clientId)
      .order("session_date", { ascending: false }),
    supabase
      .from("gos_business_objectives" as never)
      .select("id,label")
      .eq("client_id", clientId)
      .eq("status", "active"),
    supabase
      .from("gos_concept_log" as never)
      .select("id,concept_name,status")
      .eq("client_id", clientId)
      .in("status", ["live", "winner", "loser", "paused"]),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (objectivesResult.error) throw objectivesResult.error;
  if (conceptsResult.error) throw conceptsResult.error;

  return {
    sessions: ((sessionsResult.data ?? []) as QueryRow[]).map(normalizeWayfinderSessionRow),
    objectives: ((objectivesResult.data ?? []) as QueryRow[]).map(normalizeWayfinderObjectiveRow),
    concepts: ((conceptsResult.data ?? []) as QueryRow[]).map(normalizeWayfinderConceptRow),
  };
}

export async function createWayfinderSession(clientId: string): Promise<void> {
  const { error } = await supabase
    .from("gos_wayfinder_sessions" as never)
    .insert(toWayfinderSessionCreatePayload(clientId) as never);

  if (error) throw error;
}

export async function saveWayfinderSession(session: WayfinderSession): Promise<void> {
  const { error } = await supabase
    .from("gos_wayfinder_sessions" as never)
    .update(toWayfinderSessionUpdatePayload(session) as never)
    .eq("id", session.id);

  if (error) throw error;
}

export async function deleteWayfinderSession(id: string): Promise<void> {
  const { error } = await supabase
    .from("gos_wayfinder_sessions" as never)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
