import { describe, expect, it, vi } from "vitest";
import { runCreativeDemand } from "./creativeDemand";
import {
  normalizeCreativeDemandRunRow,
  toCreativeDemandInput,
  toCreativeDemandRunPayload,
} from "./creativeDemandController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("creative demand controller", () => {
  it("maps UI drafts into model inputs", () => {
    expect(toCreativeDemandInput({
      period_label: "Week 45",
      target_ad_spend: "25000" as unknown as number,
      avg_cpm: "12.5" as unknown as number,
      fatigue_threshold_impressions: "200000" as unknown as number,
    })).toEqual({
      weekly_spend: 25_000,
      avg_cpm: 12.5,
      fatigue_threshold_impressions: 200_000,
    });
  });

  it("builds persistence payloads from deterministic output", () => {
    const draft = {
      period_label: " Week 45 ",
      target_ad_spend: 25_000,
      avg_cpm: 12.5,
      fatigue_threshold_impressions: 200_000,
      notes: " creative plan ",
    };
    const output = runCreativeDemand(toCreativeDemandInput(draft));
    const payload = toCreativeDemandRunPayload("client-1", draft, output);

    expect(payload.period_label).toBe("Week 45");
    expect(payload.creatives_per_week_needed).toBe(10);
    expect(payload.breakdown.impressions_per_week).toBe(2_000_000);
    expect(payload.assumptions.source).toBe("manual");
    expect(payload.formula_used).toContain("weekly_spend");
    expect(payload.confidence).toBe(0.6);
    expect(payload.notes).toBe("creative plan");
  });

  it("normalizes persisted rows for the page", () => {
    const row = normalizeCreativeDemandRunRow({
      id: "run-1",
      client_id: "client-1",
      period_label: "Week 45",
      target_ad_spend: "25000",
      avg_cpm: "12.5",
      fatigue_threshold_impressions: "200000",
      creatives_per_week_needed: "10",
      static_creatives_needed: "5",
      video_creatives_needed: "4",
      ugc_creatives_needed: "1",
      breakdown: { impressions_per_week: 2_000_000 },
      confidence: "0.6",
      status: "DRAFT",
      notes: "",
      created_at: "2026-07-14T00:00:00Z",
    });

    expect(row.target_ad_spend).toBe(25_000);
    expect(row.avg_cpm).toBe(12.5);
    expect(row.creatives_per_week_needed).toBe(10);
    expect(row.notes).toBeNull();
  });
});
