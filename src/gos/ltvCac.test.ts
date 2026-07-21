import { describe, expect, it } from "vitest";
import { computePredictiveLtvCac } from "./ltvCac";

describe("computePredictiveLtvCac", () => {
  it("uses repeat rate when estimating LTV", () => {
    const base = {
      horizon_months: 12,
      new_customers: 100,
      ad_spend: 2000,
      avg_order_value: 100,
      gross_margin_pct: 50,
      purchase_frequency: 1,
      churn_rate_pct: 10,
    };

    const lowRepeat = computePredictiveLtvCac({ ...base, repeat_rate_pct: 0 });
    const highRepeat = computePredictiveLtvCac({ ...base, repeat_rate_pct: 50 });

    expect(lowRepeat.predicted_ltv).toBe(50);
    expect(highRepeat.predicted_ltv).toBeGreaterThan(lowRepeat.predicted_ltv ?? 0);
  });

  it("returns null CAC and flags missing data instead of hiding it as zero", () => {
    const output = computePredictiveLtvCac({
      horizon_months: 12,
      new_customers: 0,
      ad_spend: 2000,
      avg_order_value: 100,
      gross_margin_pct: 50,
      repeat_rate_pct: 25,
      purchase_frequency: 1,
      churn_rate_pct: 10,
    });

    expect(output.cac).toBeNull();
    expect(output.missing_data).toContain("new_customers");
  });

  it("does not emit NaN or Infinity for incomplete inputs", () => {
    const output = computePredictiveLtvCac({});
    const numbers = [
      output.cac,
      output.predicted_ltv,
      output.ltv_cac_ratio,
      output.payback_months,
      output.contribution_margin,
      output.confidence_score,
    ].filter((value): value is number => value !== null);

    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
