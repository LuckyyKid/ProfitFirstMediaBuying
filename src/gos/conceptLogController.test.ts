import { describe, expect, it, vi } from "vitest";
import {
  normalizeConceptLogRow,
  toConceptCreatePayload,
  toConceptUpdatePayload,
  type ConceptLogEntry,
} from "./conceptLogController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const entry: ConceptLogEntry = {
  id: "concept-1",
  client_id: "client-1",
  objective_id: null,
  concept_name: " Proof concept ",
  angle: "social-proof",
  hypothesis: "Proof-led copy should improve conversion.",
  audience: "prospecting",
  format: "video-short",
  platform: "meta",
  offer: " Core Bundle ",
  landing_page_url: " https://example.com/core ",
  primary_copy: " Main copy ",
  bid_strategy: "cost-cap",
  cost_cap: 40,
  expected_daily_spend: 100,
  campaign_link_url: " https://ads.example.com/campaign/1 ",
  ads_per_concept: 4,
  status: "in_review",
  launch_date: "2026-07-01",
  end_date: null,
  spend: 500,
  impressions: 50_000,
  clicks: 1_000,
  orders: 20,
  revenue: 2_000,
  cpa: null,
  ctr: null,
  verdict: null,
  learning: null,
  next_action: null,
  tags: null,
};

describe("concept log controller mappers", () => {
  it("normalizes operational fields from persisted rows", () => {
    const row = normalizeConceptLogRow({
      id: "concept-1",
      client_id: "client-1",
      concept_name: "Proof",
      offer: "Core Bundle",
      landing_page_url: "https://example.com/core",
      primary_copy: "Main copy",
      bid_strategy: "cost-cap",
      cost_cap: "40",
      expected_daily_spend: "100",
      campaign_link_url: "https://ads.example.com/campaign/1",
      ads_per_concept: "4",
    });

    expect(row.offer).toBe("Core Bundle");
    expect(row.cost_cap).toBe(40);
    expect(row.expected_daily_spend).toBe(100);
    expect(row.ads_per_concept).toBe(4);
  });

  it("builds create and update payloads through the controller boundary", () => {
    const createPayload = toConceptCreatePayload("client-1");
    const updatePayload = toConceptUpdatePayload(entry);

    expect(createPayload.client_id).toBe("client-1");
    expect(createPayload.ads_per_concept).toBe(1);
    expect(updatePayload.concept_name).toBe("Proof concept");
    expect(updatePayload.offer).toBe("Core Bundle");
    expect(updatePayload.landing_page_url).toBe("https://example.com/core");
    expect(updatePayload.primary_copy).toBe("Main copy");
    expect(updatePayload.campaign_link_url).toBe("https://ads.example.com/campaign/1");
    expect(updatePayload.cpa).toBe(25);
    expect(updatePayload.ctr).toBe(2);
  });
});
