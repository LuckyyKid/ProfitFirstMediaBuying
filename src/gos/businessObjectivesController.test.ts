import { describe, expect, it, vi } from "vitest";
import {
  normalizeBusinessObjectiveRow,
  toBusinessObjectiveCreatePayload,
  toBusinessObjectiveUpdatePayload,
  type BusinessObjective,
} from "./businessObjectivesController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("business objectives controller", () => {
  it("normalizes persisted rows into UI-safe objective records", () => {
    expect(normalizeBusinessObjectiveRow({
      id: "objective-1",
      client_id: "client-1",
      objective_type: "",
      label: " Acquire ",
      primary_kpi: null,
      target_value: "1000",
      current_value: "",
      priority: "2.6",
    })).toMatchObject({
      id: "objective-1",
      client_id: "client-1",
      objective_type: "acquire_new",
      label: "Acquire",
      primary_kpi: "new_customers",
      target_value: 1000,
      current_value: null,
      priority: 3,
    });
  });

  it("builds create and update payloads at the persistence boundary", () => {
    const objective: BusinessObjective = {
      id: "objective-1",
      client_id: "client-1",
      objective_type: "increase_aov",
      label: " AOV push ",
      primary_kpi: " aov ",
      target_value: 95,
      current_value: 80,
      timeframe_start: "",
      timeframe_end: "2026-07-31",
      rationale: " Move margin ",
      constraints_notes: "",
      status: "active",
      priority: 0,
    };

    expect(toBusinessObjectiveCreatePayload("client-1", 2)).toEqual({
      client_id: "client-1",
      objective_type: "acquire_new",
      label: "Nouvel objectif",
      primary_kpi: "new_customers",
      status: "active",
      priority: 2,
    });

    expect(toBusinessObjectiveUpdatePayload(objective)).toEqual({
      objective_type: "increase_aov",
      label: "AOV push",
      primary_kpi: "aov",
      target_value: 95,
      current_value: 80,
      timeframe_start: null,
      timeframe_end: "2026-07-31",
      rationale: "Move margin",
      constraints_notes: null,
      status: "active",
      priority: 1,
    });
  });
});
