import { describe, expect, it, vi } from "vitest";
import { runEventEffectV2 } from "./eventEffectV2";
import {
  parseNumericSeries,
  toEventEffectAnalysisPatch,
  toEventEffectModelRunPayload,
  toPlannedEventPayload,
  type EventEffectAnalysisDraft,
} from "./eventEffectController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("event effect controller", () => {
  it("parses comma, space, and semicolon separated numeric series", () => {
    expect(parseNumericSeries("100, 110; 120\nbad 130")).toEqual([100, 110, 120, 130]);
  });

  it("builds planned event payloads from deterministic estimates", () => {
    const payload = toPlannedEventPayload("client-1", {
      event_name: " Summer Promo ",
      event_type: "PROMO",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      notes: " promo note ",
    }, 30000);

    expect(payload.event_name).toBe("Summer Promo");
    expect(payload.expected_lift_pct).toBe(18);
    expect(payload.expected_revenue_delta).toBe(540);
    expect(payload.confidence).toBe("MEDIUM");
    expect(payload.assumptions.formula).toContain("expected_lift_pct");
    expect(payload.notes).toBe("promo note");
  });

  it("maps causal analysis output into event update patches and model run payloads", () => {
    const draft: EventEffectAnalysisDraft = {
      event_id: "event-1",
      event_name: "Launch",
      metric: "revenue",
      pre_series: [100, 101, 99, 100],
      post_series: [130, 132],
      control_pre_series: null,
      control_post_series: null,
      use_linear_trend: false,
      significance_level: 0.05,
    };
    const result = runEventEffectV2(draft);
    const patch = toEventEffectAnalysisPatch(draft, result);
    const runPayload = toEventEffectModelRunPayload("client-1", draft, result);

    expect(patch.status).toBe("MEASURED");
    expect(patch.actual_revenue_delta).toBe(Math.round(result.causal_lift_abs * draft.post_series.length));
    expect(patch.engine_output.engine_version).toBe("event_effect_v2");
    expect(runPayload.client_id).toBe("client-1");
    expect(runPayload.model_name).toBe("event_effect_v2");
    expect(runPayload.input_json.event_id).toBe("event-1");
    expect(runPayload.formula_used.engine).toBe("event_effect_v2");
  });
});
