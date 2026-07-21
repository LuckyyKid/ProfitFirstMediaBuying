# TDIA GOS — Golden Financial Test Cases (Phase 7)

All six test cases are executed by `scripts/validate-financial-formulas.ts`, which pulls the pure formula library at `src/gos/formulas.ts`. **All 43 assertions currently pass** (see `.lovable/financial-validation-results.md`).

Run:
```
bun scripts/validate-financial-formulas.ts
```

---

## Golden 1 — E-commerce Unit Economics

| Input                        | Value |
|------------------------------|-------|
| AOV                          | 58    |
| COGS / order                 | 22    |
| Shipping / order             | 8     |
| Fulfillment / order          | 3     |
| Payment processing           | 2 %   |
| Refund rate                  | 5 %   |
| Target CAC                   | 32    |

**Expected**
- `payment_processing_cost` = 1.16
- `refund_cost` = 2.90
- `variable_cost_per_order` = 37.06
- `contribution_before_cac` = 20.94
- `break_even_cac` = 20.94
- `first_order_profit_at_target_cac` = −11.06
- `risk` ∈ {HIGH, WARNING}
- Output text must warn that Target CAC is not first-order profitable unless LTV/payback justifies it.

---

## Golden 2 — E-commerce Baseline

| Input          | Value  |
|----------------|--------|
| Revenue        | 65 000 |
| Ad Spend       | 14 000 |
| New customers  | 380    |
| AOV            | 58     |
| Gross margin   | 52 %   |
| Target CAC     | 32     |
| Target MER     | 5      |

**Expected**
- MER ≈ 4.64, CAC ≈ 36.84
- Gross profit = 33 800, Contribution ≈ 19 800
- `diagnosis` = `EFFICIENCY_PROBLEM` (CAC above target while MER below target).

---

## Golden 3 — Spending Power

History: `[10 000 / CAC 30 / MER 5.0]`, `[12 000 / 32 / 4.8]`, `[14 000 / 36 / 4.6]`. Planned spend = 22 000.

**Expected**
- `historical_max_spend` = 14 000
- `spend_increase_ratio` ≈ 1.57
- `spend_risk` = HIGH
- `projected_cac` > historical avg (32.67)
- `projected_mer` < historical avg (4.80)
- Recommendation warns against jumping directly to 22k and prescribes 15–25% ramp.

---

## Golden 4 — Retention

First-order revenue 50 000 · returning 30/60/90/180d = 7 500 / 12 500 / 15 000 / 22 500. Contribution before CAC = 20, payback window = 90 d.

**Expected**
- LTV lift 30/60/90/180 = 15 % / 25 % / 30 % / 45 %
- `retention_quality` = HIGH
- `allowable_cac_with_ltv` = 26 (i.e. `20 * (1 + 0.30)`)
- Output must explain CAC can flex within payback window.

---

## Golden 5 — Local Service Baseline

Leads 100 · Qualified 60 · Booked 30 · Jobs 12 · Revenue 24 000 · Ad Spend 4 000 · Gross Margin 45 % · Avg Job 2 000.

**Expected**
- CPL 40, cost / booked ≈ 133.33, cost / job ≈ 333.33
- Close rate 40 %, Booked rate 50 %
- Gross profit 10 800, Contribution 6 800
- `diagnosis` = `SALES_EFFICIENCY` (close rate < 50%).

---

## Golden 6 — Measurement

Meta 18 000 · Shopify 12 400 · Ad Spend 2 000 · Baseline 15 000 · Test 19 500.

**Expected**
- Platform gap ≈ 45.16 %
- `tracking_risk` = HIGH
- `observed_lift_revenue` = 4 500
- `estimated_i_roas` = 2.25
- Warning: *Do NOT rely only on Meta ROAS for scaling decisions.*

---

## Safety cases (also enforced)

- Null AOV → `missing_data` includes `aov`, no NaN.
- Zero ad_spend → MER / CAC / ROAS = null (never Infinity).
- Zero leads / zero jobs → all local KPIs null (no divide-by-zero).
- Empty history → spending power returns `spend_risk = UNKNOWN`, `missing_data` populated.
- All-null Measurement → tracking_risk `UNKNOWN`, no NaN.
