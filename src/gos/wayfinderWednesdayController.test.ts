import { describe, expect, it, vi } from "vitest";
import {
  nextWednesday,
  normalizeWayfinderSessionRow,
  toWayfinderSessionCreatePayload,
  toWayfinderSessionUpdatePayload,
  weekLabel,
  type WayfinderSession,
} from "./wayfinderWednesdayController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("wayfinder wednesday controller", () => {
  it("computes the next ritual date and week label deterministically", () => {
    expect(nextWednesday(new Date("2026-07-15T12:00:00.000Z"))).toBe("2026-07-22");
    expect(weekLabel("2026-07-22")).toBe("S30 - 2026");
  });

  it("normalizes persisted session rows", () => {
    expect(normalizeWayfinderSessionRow({
      id: "session-1",
      client_id: "client-1",
      session_date: "2026-07-22",
      status: "",
      participants: [" Alice ", "", "Bob"],
      objective_ids: null,
      winner_concept_ids: ["concept-1"],
      loser_concept_ids: [null, "concept-2"],
      performance_summary: " Good week ",
    })).toMatchObject({
      id: "session-1",
      status: "draft",
      participants: ["Alice", "Bob"],
      objective_ids: [],
      winner_concept_ids: ["concept-1"],
      loser_concept_ids: ["concept-2"],
      performance_summary: "Good week",
    });
  });

  it("builds create and update payloads through the controller boundary", () => {
    const session: WayfinderSession = {
      id: "session-1",
      client_id: "client-1",
      session_date: "2026-07-22",
      week_label: null,
      status: "completed",
      facilitator: "",
      participants: ["Alice", " Bob "],
      objective_ids: ["objective-1"],
      winner_concept_ids: [],
      loser_concept_ids: ["concept-2"],
      performance_summary: "",
      key_learnings: " Winner uses proof ",
      decisions: null,
      next_actions: " Scale test ",
      blockers: "",
      next_session_date: "",
      notes: null,
    };

    expect(toWayfinderSessionCreatePayload("client-1", "2026-07-22")).toEqual({
      client_id: "client-1",
      session_date: "2026-07-22",
      week_label: "S30 - 2026",
      status: "draft",
      participants: [],
      objective_ids: [],
      winner_concept_ids: [],
      loser_concept_ids: [],
    });

    expect(toWayfinderSessionUpdatePayload(session)).toMatchObject({
      session_date: "2026-07-22",
      week_label: "S30 - 2026",
      status: "completed",
      facilitator: null,
      participants: ["Alice", "Bob"],
      performance_summary: null,
      key_learnings: "Winner uses proof",
      next_actions: "Scale test",
      next_session_date: null,
    });
  });
});
