import { describe, expect, it, vi } from "vitest";
import {
  normalizeBuyerCampaignRow,
  normalizeBuyerCategoryRow,
  normalizeBuyerDecisionRow,
  normalizeBuyerPerformanceRow,
  toBuyerDecisionInsertPayload,
  toBuyerPerformanceUpsertPayload,
} from "./buyerWorkspaceController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("buyer workspace controller", () => {
  it("normalizes category and campaign rows from Supabase", () => {
    expect(normalizeBuyerCategoryRow({
      id: "cat-1",
      name: " Prospecting ",
      kind: "",
      target_cpa: "50.25",
      target_daily_budget: "300",
    })).toEqual({
      id: "cat-1",
      name: "Prospecting",
      kind: "uncategorized",
      target_cpa: 50.25,
      target_daily_budget: 300,
    });

    expect(normalizeBuyerCampaignRow({
      id: "camp-1",
      category_id: "",
      name: "Meta",
      platform: null,
      current_daily_budget: "125",
      active: null,
    })).toEqual({
      id: "camp-1",
      category_id: null,
      name: "Meta",
      platform: "meta",
      current_daily_budget: 125,
      active: true,
    });
  });

  it("normalizes performance and decision rows", () => {
    expect(normalizeBuyerPerformanceRow({
      id: "perf-1",
      campaign_id: "camp-1",
      perf_date: "2026-07-14",
      spend: "-20",
      orders: "2.6",
      leads: 4.2,
      revenue: "500",
      notes: " checked ",
    })).toEqual({
      id: "perf-1",
      campaign_id: "camp-1",
      perf_date: "2026-07-14",
      spend: 0,
      orders: 3,
      leads: 4,
      revenue: 500,
      notes: "checked",
    });

    expect(normalizeBuyerDecisionRow({
      id: "decision-1",
      campaign_id: "camp-1",
      decision_date: "2026-07-15",
      decision_type: "scale",
      previous_budget: "100",
      new_budget: "120",
      reasoning: "",
      expected_impact: "More efficient volume",
      actual_cpa: "40",
      target_cpa: "50",
      created_at: "2026-07-15T12:00:00.000Z",
    })).toMatchObject({
      id: "decision-1",
      decision_type: "scale",
      previous_budget: 100,
      new_budget: 120,
      reasoning: null,
      actual_cpa: 40,
      target_cpa: 50,
    });
  });

  it("builds upsert payloads for manual performance entry", () => {
    expect(toBuyerPerformanceUpsertPayload("client-1", "2026-07-14", "camp-1", {
      campaign_id: "camp-1",
      perf_date: "ignored",
      spend: 125.5,
      orders: 3.4,
      leads: 2.2,
      revenue: 450,
      notes: "",
    })).toEqual({
      client_id: "client-1",
      campaign_id: "camp-1",
      perf_date: "2026-07-14",
      spend: 125.5,
      orders: 3,
      leads: 2,
      revenue: 450,
      notes: null,
    });
  });

  it("builds insert payloads for audited buyer decisions", () => {
    expect(toBuyerDecisionInsertPayload("client-1", {
      campaign_id: "camp-1",
      decision_date: "2026-07-15",
      decision_type: "scale",
      previous_budget: 100,
      new_budget: 120,
      reasoning: "CPA below target",
      expected_impact: "Scale controlled",
      actual_cpa: 40,
      target_cpa: 50,
    })).toEqual({
      client_id: "client-1",
      campaign_id: "camp-1",
      decision_date: "2026-07-15",
      decision_type: "scale",
      previous_budget: 100,
      new_budget: 120,
      reasoning: "CPA below target",
      expected_impact: "Scale controlled",
      actual_cpa: 40,
      target_cpa: 50,
    });
  });
});
