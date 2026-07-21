import { supabase } from "@/integrations/supabase/client";

type QueryRow = Record<string, unknown>;

export type MapNote = {
  id: string;
  client_id: string;
  note_date: string;
  author_id: string | null;
  author_role: string;
  scope_type: string;
  scope_key: string | null;
  scope_label: string | null;
  what_happened: string;
  so_what: string | null;
  now_what: string | null;
  linked_projection_update_id: string | null;
  status: string;
  is_signal: boolean;
  created_at: string;
};

export type MapNoteDraft = {
  note_date: string;
  author_role: string;
  scope_type: string;
  scope_key: string;
  scope_label: string;
  what_happened: string;
  so_what: string;
  now_what: string;
  is_signal: boolean;
};

export type MapNoteFilters = {
  note_date?: string | null;
  author_role?: string | null;
  scope_type?: string | null;
  signal_only?: boolean;
};

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function booleanOrFalse(value: unknown): boolean {
  return value === true;
}

export function normalizeMapNoteRow(row: QueryRow): MapNote {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    note_date: optionalString(row.note_date) ?? "",
    author_id: optionalString(row.author_id),
    author_role: optionalString(row.author_role) ?? "other",
    scope_type: optionalString(row.scope_type) ?? "global",
    scope_key: optionalString(row.scope_key),
    scope_label: optionalString(row.scope_label),
    what_happened: optionalString(row.what_happened) ?? "",
    so_what: optionalString(row.so_what),
    now_what: optionalString(row.now_what),
    linked_projection_update_id: optionalString(row.linked_projection_update_id),
    status: optionalString(row.status) ?? "posted",
    is_signal: booleanOrFalse(row.is_signal),
    created_at: optionalString(row.created_at) ?? "",
  };
}

export function toMapNoteCreatePayload(clientId: string, authorId: string | null, draft: MapNoteDraft) {
  return {
    client_id: clientId,
    note_date: optionalString(draft.note_date) ?? new Date().toISOString().slice(0, 10),
    author_id: authorId,
    author_role: optionalString(draft.author_role) ?? "other",
    scope_type: optionalString(draft.scope_type) ?? "global",
    scope_key: optionalString(draft.scope_key),
    scope_label: optionalString(draft.scope_label),
    what_happened: optionalString(draft.what_happened) ?? "",
    so_what: optionalString(draft.so_what),
    now_what: optionalString(draft.now_what),
    is_signal: draft.is_signal === true,
    status: "posted",
  };
}

export async function fetchMapNotes(clientId: string, filters: MapNoteFilters = {}): Promise<MapNote[]> {
  let query = supabase
    .from("gos_map_notes" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.note_date) query = query.eq("note_date", filters.note_date);
  if (filters.author_role) query = query.eq("author_role", filters.author_role);
  if (filters.scope_type) query = query.eq("scope_type", filters.scope_type);
  if (filters.signal_only) query = query.eq("is_signal", true);

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeMapNoteRow);
}

export async function createMapNote(clientId: string, draft: MapNoteDraft): Promise<void> {
  const { data: userResult } = await supabase.auth.getUser();
  const payload = toMapNoteCreatePayload(clientId, userResult.user?.id ?? null, draft);
  const { error } = await supabase
    .from("gos_map_notes" as never)
    .insert(payload as never);

  if (error) throw error;
}

export async function deleteMapNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("gos_map_notes" as never)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
