# Financial Formula Validation — 74/74 checks passed

### Golden 1 — E-commerce Unit Economics
  ✅ payment_processing_cost = 1.16
  ✅ refund_cost = 2.90
  ✅ variable_cost_per_order = 37.06
  ✅ contribution_before_cac = 20.94
  ✅ break_even_cac = 20.94
  ✅ first_order_profit_at_target_cac = -11.06
  ✅ risk is HIGH or WARNING
  ✅ first_order_profitable === false

### Golden 2 — E-commerce Baseline
  ✅ MER ≈ 4.64
  ✅ CAC ≈ 36.84
  ✅ Gross Profit = 33800
  ✅ Contribution ≈ 19800
  ✅ diagnosis = EFFICIENCY_PROBLEM

### Golden 3 — Spending Power
  ✅ historical_max_spend = 14000
  ✅ spend_increase_ratio ≈ 1.57
  ✅ spend_risk = HIGH
  ✅ projected_cac > historical_avg_cac
  ✅ projected_mer < historical_avg_mer
  ✅ recommendation warns against jumping

### Golden 4 — Retention
  ✅ LTV lift 30d = 15%
  ✅ LTV lift 60d = 25%
  ✅ LTV lift 90d = 30%
  ✅ LTV lift 180d = 45%
  ✅ retention_quality HIGH
  ✅ allowable_cac_with_ltv = 26

### Golden 5 — Local Service Baseline
  ✅ CPL = 40
  ✅ cost_per_booked ≈ 133.33
  ✅ cost_per_job ≈ 333.33
  ✅ close_rate = 40%
  ✅ gross_profit = 10800
  ✅ contribution = 6800
  ✅ diagnosis flags SALES_EFFICIENCY

### Golden 6 — Measurement
  ✅ platform_to_shopify_gap ≈ 45.16%
  ✅ tracking_risk = HIGH
  ✅ observed_lift_revenue = 4500
  ✅ estimated_i_roas = 2.25
  ✅ warning about Meta ROAS present

### Safety — nulls / zeros / NaN / Infinity
  ✅ UE with null aov reports missing_data
  ✅ Ecom baseline no NaN/Infinity on divide-by-zero
  ✅ Ecom baseline MER/CAC null on zero spend
  ✅ Local baseline no NaN/Infinity
  ✅ Spending power reports missing_data on empty history
  ✅ Measurement handles all-null inputs cleanly

### Golden 7 — Product margin vs true gross margin
  ✅ product_margin = 70
  ✅ cost_of_delivery = 76
  ✅ true_gross_profit = 24
  ✅ true_gross_margin_percent = 24

### Golden 8 — Discount economics
  ✅ discounted_price = 70
  ✅ gross_profit_after_offer = 10
  ✅ break_even_roas_after_offer = 7
  ✅ offer flagged HIGH_RISK for acquisition

### Golden 9 — LTGP:CAC
  ✅ ltgp_to_cac ≈ 3.03
  ✅ classification HEALTHY or UNDER_SPENDING

### Golden 10 — Inventory grade
  ✅ days_of_inventory_on_hand = 400
  ✅ inventory_grade = D
  ✅ strategy mentions cash recovery / liquidation

### Golden 11 — P&L snapshot
  ✅ gross_profit = 60
  ✅ contribution_margin = 40
  ✅ ebitda = 20
  ✅ net_profit = 10

### Golden 12 — AOV average vs modal risk
  ✅ avg_order_value ≈ 94
  ✅ modal_order_value in low bucket (< 60)
  ✅ long_tail_risk = HIGH
  ✅ warning about AOV overstating CAC

### Golden 13 — Funnel economics
  ✅ first_order_profit_at_target_cac = -12
  ✅ first_order_profitable === false
  ✅ warnings include not first-order profitable

### Golden 14 — SKU demand plan constraint
  ✅ projected_inventory_after_plan = -150
  ✅ inventory_risk = HIGH
  ✅ marketing_priority is LIMIT or DO_NOT_PUSH

### Golden 15 — Grade D cash recovery
  ✅ paid_media_action = LIQUIDATE_INVENTORY or BUILD_DEDICATED_FUNNEL
  ✅ explanation mentions cash-flow / recovery

### Golden 16 — OPEX buffer warning
  ✅ applied === true
  ✅ warning mentions fixed OPEX not linearly variable
