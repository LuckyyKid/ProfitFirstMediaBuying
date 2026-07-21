# TDIA GOS — Financial Formula Registry (Phase 7)

Every formula in the Growth Operating System is deterministic, explainable, and traceable in `gos_model_runs`. The canonical implementation lives in `src/gos/formulas.ts` (frontend) and `supabase/functions/run-*` (edge functions). This registry is the single source of truth.

Global rules for every engine:
- Never divide by zero — return `null` instead.
- Never emit `NaN` or `Infinity`. If a term is undefined, output is `null` and the field name is added to `missing_data`.
- Every `output_json` carries `summary`, `confidence_score` (0–100 where relevant), and `risks` or `missing_data`.
- Forecasts and projections are always labelled **"This is a conditional forecast, not a guarantee."**
- Percentages exposed to the UI are 0–100, never 0–1 or 0–10000.

---

## 1. `unit_economics_engine_v1`

**Inputs** — `aov`, `cogs_per_order`, `shipping_cost_per_order`, `fulfillment_cost_per_order`, `payment_processing_percent` (0–100), `refund_rate_percent` (0–100), `cac?`, `target_cac?`.

**Formulas**
```
payment_processing_cost         = aov * payment_processing_percent / 100
refund_cost                     = aov * refund_rate_percent / 100
variable_cost_per_order         = cogs + shipping + fulfillment + payment_processing_cost + refund_cost
contribution_before_cac         = aov - variable_cost_per_order
break_even_cac                  = contribution_before_cac
first_order_profit              = contribution_before_cac - cac
first_order_profit_at_target    = contribution_before_cac - target_cac
```

**Missing data** — any missing required input → `missing_data` populated, dependent outputs `null`.

**Outputs** — all formulas above + `first_order_profitable` (bool), `risk` ∈ `{OK, WARNING, HIGH, UNKNOWN}`, `summary`.

**Risks / limitations** — Does not model returns re-fulfillment cost or gift cards. Assumes flat `%` processing.

**Example** (Golden Test 1): AOV 58, COGS 22, Ship 8, Fulf 3, PP 2%, Refund 5%, Target CAC 32 → contribution 20.94, first-order profit at target = −11.06, risk HIGH.

---

## 2. `growth_diagnosis_engine_v1`

**Inputs** — `revenue_30d`, `ad_spend_30d`, `orders_30d`, `new_customers`, `target_cac`, `target_mer`, `target_cvr`, capacity/inventory snapshots.

**Formulas**
```
mer = revenue_30d / ad_spend_30d       (null if ad_spend_30d = 0)
cac = ad_spend_30d / new_customers     (null if new_customers = 0)
```

**Decision matrix**
- CAC > target_cac × 1.5 → `EFFICIENCY_PROBLEM`
- MER < target_mer × 0.85 → `EFFICIENCY_PROBLEM`
- Inventory shortage or capacity constraint present → `CONSTRAINT_OVERRIDE` (blocks scale recs regardless of finance signals).
- Otherwise `HEALTHY` or `VOLUME_PROBLEM` depending on spend vs plan.

**Missing data** — targets missing → factor is ignored, `missing_data` records the omission.

**Risks** — 30d window; sensitive to seasonality. Marked `confidence_label` ∈ `{Low, Medium, High}`.

---

## 3. `spending_power_engine_v1`

**Inputs** — array of `{ad_spend, cac, mer}` history, `planned_spend`.

**Formulas**
```
historical_avg_cac    = mean(history.cac)
historical_avg_mer    = mean(history.mer)
historical_max_spend  = max(history.ad_spend)
spend_increase_ratio  = planned_spend / historical_max_spend

spend_risk = LOW    if planned_spend ≤ historical_max_spend * 1.10
             MEDIUM if planned_spend ≤ historical_max_spend * 1.30
             HIGH   otherwise

Deterministic degradation:
  LOW    → projected_cac = avg_cac,        projected_mer = avg_mer
  MEDIUM → projected_cac = avg_cac * 1.15, projected_mer = avg_mer * 0.90
  HIGH   → projected_cac = avg_cac * 1.35, projected_mer = avg_mer * 0.80
```

**Missing data** — empty history OR missing `planned_spend` → `spend_risk = UNKNOWN`, all projections `null`, `missing_data` populated.

**Recommendation** — HIGH always advises a 15–25% ramp, not a jump.

**Example** (Golden Test 3): max spend 14 000, planned 22 000 → ratio 1.57, risk HIGH, projected CAC bumps by 35%.

---

## 4. `retention_cohort_engine_v1`

**Inputs** — `first_order_revenue`, `returning_revenue_{30,60,90,180}d`, optional `contribution_before_cac`, `payback_window_days`.

**Formulas**
```
ltv_lift_Xd_pct         = returning_revenue_Xd / first_order_revenue * 100
retention_quality       = HIGH   if ltv_lift_90d ≥ 30
                          MEDIUM if ltv_lift_90d ≥ 15
                          LOW    otherwise
allowable_cac_with_ltv  = contribution_before_cac * (1 + ltv_lift_within_payback_window / 100)
```

**Missing data** — `first_order_revenue = 0` or null → all lifts `null`, quality `UNKNOWN`.

**Example** (Golden Test 4): first-order rev 50 k, returning 30/60/90/180 = 7.5/12.5/15/22.5 k → lifts 15/25/30/45%, quality HIGH.

---

## 5. `event_effect_engine_v1`

**Inputs** — `event_type`, `start_date`, `end_date`, `baseline_revenue_30d`.

**Formulas**
```
duration_days           = ceil((end_date - start_date) / 86400s) + 1
daily_baseline          = baseline_revenue_30d / 30
expected_lift_pct       = lift table lookup by event_type
expected_revenue_delta  = daily_baseline * duration_days * (expected_lift_pct / 100)
```

Lift table: PROMO 18, LAUNCH 25, SEASONAL 30, PAID_PUSH 12, PR 8, INFLUENCER 10, OTHER 5.

**Missing data** — baseline = 0 → delta 0, confidence `LOW`.

**Risks** — lift table is heuristic; must be recalibrated after each event via Learning Loop.

---

## 6. `forecast_engine_v1`

**Inputs** — selected hypotheses `{min, base, max}`, `overlap_discount ∈ {0.5, 0.7, 0.85}`, confidence sub-scores.

**Formulas**
```
forecast_lift_low   = Σ min  * overlap_discount
forecast_lift_base  = Σ base * overlap_discount
forecast_lift_high  = Σ max  * overlap_discount

confidence_score    = clamp(
    data_quality + evidence + goal_alignment + execution_readiness
    + tracking + historical_similarity - risk_penalty - dependency_penalty,
    0, 100)

confidence_label    = <50 Low | <70 Medium | <85 High | else Very High/Rare
```

**Missing data** — component missing → score is not calculated (returns `null`), label `UNKNOWN`.

**Required text** — `"This is a conditional forecast, not a guarantee."` MUST appear in `summary`.

---

## 7. `metric_targets_engine_v1`

**Inputs** — `baseline`, `goal`, `forecast_lift_base`, `north_star_metric`.

**Rules**
1. Explicit goal always wins.
2. Otherwise projection is derived **only for the impacted metric**:
   - `cac_target = baseline_cac * (1 - lift/100)`
   - `mer_target = baseline_mer * (1 + lift/100)`
   - `new_customers_target = baseline_nc * (1 + lift/100)`
3. Revenue and channel-level targets are **never invented** without explicit inputs — they appear in `missing_targets`.
4. Action rules (deterministic) map each Spend×Efficiency quadrant to a recommended play (Volume / Efficiency / Creative / CRO / Increase / Reduce).

---

## 8. `weekly_pnl_targets_engine_v1`

**Inputs** — monthly revenue target, gross_margin_percent, ad_spend_target, fixed_costs, `weeks_in_month = 4.33`.

**Formulas**
```
weekly_revenue_target  = monthly_revenue_target / weeks_in_month
weekly_ad_spend        = monthly_ad_spend / weeks_in_month
weekly_gross_profit    = weekly_revenue * gross_margin_percent / 100
weekly_contribution    = weekly_gross_profit - weekly_ad_spend - (fixed_costs / weeks_in_month)
weekly_break_even_rev  = (fixed_costs / weeks_in_month + weekly_ad_spend) / (gross_margin_percent / 100)
```

**Missing data** — any input null → same-name output null, `missing_data` records it.

---

## 9. `creative_demand_engine_v1`

**Inputs** — `planned_meta_spend`, `current_top_3_ads_spend_share` (0–1), `frequency`, `new_creatives_last_30d`, `active_ads`, `priority_angles`, `priority_products`.

**Risk rules**
- Concentration: >0.60 High | 0.40–0.60 Medium | <0.40 Low.
- Fatigue: freq >5 High | 3–5 Medium | <3 Low.
- Supply: 0 new High | <8 Medium | ≥8 Low.
- Overall = worst of the three.

**Output**
```
total_needed = 24 High | 16 Medium | 8 Low
videos       = round(total * 0.6)
statics      = round(total * 0.4)
```

Deterministic, upper-bound resolution of the 16–24 / 8–16 / 4–8 ranges.

---

## 10. `live_optimization_engine_v1`

**Inputs** — daily/weekly `spend`, `revenue`, `cac`, `mer`, `frequency`, targets.

**Rules**
- `ON_TRACK`         : cac ≤ target and mer ≥ target.
- `WATCH`            : within ±10% of target.
- `AT_RISK`          : cac 10–25% above target OR mer 10–25% below.
- `CRISIS`           : cac >25% above target OR mer >25% below OR frequency > 5 with rising cac.
- **Overrides** — tracking risk HIGH or inventory constraint present → scaling actions blocked.

---

## 11. `measurement_engine_v1`

**Inputs** — `platform_reported_revenue`, `shopify_revenue`, `ad_spend`, `baseline_revenue`, `test_period_revenue`.

**Formulas**
```
platform_to_shopify_gap_pct = (platform_reported_revenue - shopify_revenue) / shopify_revenue * 100
observed_lift_revenue       = test_period_revenue - baseline_revenue
estimated_i_roas            = observed_lift_revenue / ad_spend

tracking_risk = HIGH   if |gap_pct| > 30
                MEDIUM if 15 ≤ |gap_pct| ≤ 30
                LOW    otherwise
```

**Warning** — HIGH tracking risk forces the UI to display: *"Do NOT rely on Meta ROAS for scaling decisions."*

**Example** (Golden Test 6): Meta 18k, Shopify 12.4k → gap 45.16%, HIGH, incremental ROAS 2.25.

---

## 12. `forecast_update_engine_v1`

Recomputes `forecast_engine_v1` with the current observed lift replacing hypotheses that have already resolved. Emits a versioned `forecast_update` linked to the parent forecast. Confidence rebases using observed data quality.

---

## 13. `learning_loop_engine_v1`

Tags each closed hypothesis with `outcome ∈ {WIN, LOSS, NEUTRAL}` computed from observed vs predicted lift bands. Updates rolling win-rate per angle / product / channel. Purely counting; no probability inference.

---

## 14. `next_cycle_planning_engine_v1`

Aggregates learning-loop stats + spending-power projections + retention quality to output the deterministic 30/60/90 plan:
- Next-cycle spend ceiling = `spending_power.recommended` clamped by `historical_max_spend * 1.25`.
- Hypothesis backlog is ranked by `(historical_win_rate * expected_lift_base)`.

---

## Cross-engine invariants

- Every insert into `gos_model_runs` carries `model_name`, `model_version`, `input_json`, `output_json`, `formula_used`, `generated_by`, `created_at`.
- `output_json.summary` is always populated.
- `output_json.confidence_score` is 0–100 (clamped) or absent — never > 100.
- `output_json.risks` OR `output_json.missing_data` is populated when applicable.
- No engine multiplies a percentage twice (0–100 in → 0–100 out; 0–1 ratios stay in their own suffix).
