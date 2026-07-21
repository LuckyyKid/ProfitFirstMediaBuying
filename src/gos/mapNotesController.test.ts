import { describe, expect, it, vi } from "vitest";
import {
  normalizeMapNoteRow,
  toMapNoteCreatePayload,
  type MapNoteDraft,
} from "./mapNotesController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("map notes controller", () => {
  it("normalizes map note rows with safe defaults", () => {
    expect(normalizeMapNoteRow({
      id: "note-1",
      client_id: "client-1",
      note_date: "2026-07-15",
      author_role: "",
      scope_type: null,
      what_happened: " Spend shifted ",
      is_signal: true,
      created_at: "2026-07-15T12:00:00.000Z",
    })).toMatchObject({
      id: "note-1",
      author_role: "other",
      scope_type: "global",
      what_happened: "Spend shifted",
      is_signal: true,
    });
  });

  it("builds trimmed create payloads with nullable optional fields", () => {
    const draft: MapNoteDraft = {
      note_date: "2026-07-15",
      author_role: "analyst",
      scope_type: "campaign",
      scope_key: "",
      scope_label: " Meta prospecting ",
      what_happened: " CAC dropped ",
      so_what: "",
      now_what: " Increase budget test ",
      is_signal: true,
    };

    expect(toMapNoteCreatePayload("client-1", "user-1", draft)).toEqual({
      client_id: "client-1",
      note_date: "2026-07-15",
      author_id: "user-1",
      author_role: "analyst",
      scope_type: "campaign",
      scope_key: null,
      scope_label: "Meta prospecting",
      what_happened: "CAC dropped",
      so_what: null,
      now_what: "Increase budget test",
      is_signal: true,
      status: "posted",
    });
  });
});
