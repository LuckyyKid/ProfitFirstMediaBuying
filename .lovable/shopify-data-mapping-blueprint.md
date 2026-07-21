# Shopify → TDIA GOS — Data Mapping Blueprint

Phase 11A.0. **No OAuth yet. No live API calls yet.** This document defines exactly how
Shopify objects will map into the GOS financial model once ingestion is enabled.
Every Shopify field is either:

- **AUTO** — Shopify supplies it cleanly and it drops into the target column.
- **DERIVED** — computed from Shopify data by an ingestion job.
- **MANUAL** — Shopify does not expose it (or not reliably); Account Manager must enter it.
- **PARTIAL** — Shopify exposes an approximation; still needs manual override for finance-grade use.

---

## 1. Shopify **Orders** → GOS

**Source object:** `orders` (Admin API) + `order.transactions`, `order.refunds`, `order.line_items`, `order.discount_applications`, `order.shipping_lines`, `order.tax_lines`.

### Useful fields
`id`, `created_at`, `financial_status`, `fulfillment_status`, `currency`, `total_price`,
`subtotal_price`, `total_discounts`, `total_shipping_price_set`, `total_tax`,
`total_refunded`, `customer.id`, `customer.orders_count`, `line_items[].product_id`,
`line_items[].variant_id`, `line_items[].sku`, `line_items[].quantity`,
`line_items[].price`, `refunds[].transactions[].amount`.

### Target GOS tables
| GOS Table | Fields fed | Origin |
|-----------|------------|--------|
| `gos_shopify_orders_raw` *(future)* | Raw order + refund payloads | AUTO |
| `gos_quantitative_baselines` | `revenue`, `orders`, `aov`, `new_customers`, `returning_customers` | DERIVED |
| `gos_gross_to_net_snapshots` | `gross_revenue`, `discounts`, `refunds`, `shipping_collected`, `taxes_collected`, `net_revenue` | DERIVED |
| `gos_customer_cohorts` *(future)* | first-order date, repeat cadence | DERIVED |
| `gos_measurement_snapshots` | `shopify_revenue` (truth-source vs platform-reported) | DERIVED |
| `gos_daily_actuals` *(future)* | daily revenue/orders/AOV rollup | DERIVED |

### Engines that use it
Growth Diagnosis, Forecast, Forecast Updates, Live Optimization, Measurement,
Retention, Weekly/Daily P&L, Next-Cycle Planning.

### Shopify **cannot** supply — must remain MANUAL
- `chargebacks` (payment-processor level, not Shopify)
- `taxes_collected_included_in_price` vs `added_on_top` (needs client tax policy)
- Cost of delivery components (see Products section)
- New-vs-returning definition window (needs client rule: 90 d, 180 d, ever?)

---

## 2. Shopify **Products / Variants** → GOS

**Source object:** `products`, `products.variants`, `inventory_levels`, `inventory_items`.

### Useful fields
`id`, `title`, `product_type`, `vendor`, `tags`, `status`,
`variants[].id`, `variants[].sku`, `variants[].price`, `variants[].inventory_item_id`,
`variants[].inventory_quantity`, `inventory_items.cost` (unit cost — often blank),
`inventory_items.harmonized_system_code`, `inventory_items.country_code_of_origin`.

### Target GOS tables
| GOS Table | Fields fed | Origin |
|-----------|------------|--------|
| `gos_products` | `product_name`, `sku`, `price` | AUTO |
| `gos_inventory_snapshots` | `units_on_hand`, `sku` | AUTO |
| `gos_product_financial_profiles` | `sku`, `price`, `product_cost` (from `inventory_items.cost` if set) | PARTIAL |
| `gos_inventory_grade_snapshots` | `sku`, `inventory_units`, `inventory_value_at_cost` (needs unit cost), `inventory_value_at_retail` | PARTIAL |

### Shopify **cannot** supply — must remain MANUAL
- `landed_cost`, `freight_cost`, `duties_tariffs` (Shopify has HS code + origin but not paid duties)
- `shipping_cost_to_customer` (client's actual carrier cost, not what was billed)
- `pick_pack_cost` (3PL invoice)
- `payment_processing_percent` (varies per processor; Shopify Payments knows its own but not Klarna, Afterpay, PayPal splits)
- `refund_allowance_percent`, `discount_allowance_percent` (planning assumptions)
- `daily_sales_velocity` used to compute grade — DERIVED from Orders

---

## 3. Shopify **Customers** → GOS

**Source object:** `customers`, plus `orders.customer.orders_count`, `orders.customer.total_spent`.

### Useful fields
`id`, `created_at`, `email`, `orders_count`, `total_spent`, `first_order_id`,
`last_order_id`, `tags`, `state`, `default_address.country`.

### Target GOS tables
| GOS Table | Fields fed | Origin |
|-----------|------------|--------|
| `gos_customer_cohorts` *(future)* | first-order month, cohort size, revenue-by-month | DERIVED |
| `gos_customer_activity_snapshots` | `active_customers_30d`, `repeat_purchase_rate`, `avg_time_between_orders` | DERIVED |
| Retention engine input | `first_order_revenue`, `returning_revenue_{30,60,90,180}d` | DERIVED |

### New-vs-returning logic (definition)
An order is **new-customer** iff `customer.orders_count == 1` at time of order creation
AND `line_items` are not part of a subscription reactivation.
An order is **returning-customer** iff `customer.orders_count > 1`.
The window used for retention (30/60/90/180) is measured from the customer's
`first_order_created_at`, not the calendar month.

### Shopify **cannot** supply — must remain MANUAL
- Cross-channel identity (Shopify does not know Amazon/wholesale orders)
- Consent status for marketing attribution
- Customer LTV projection horizon (client policy)

---

## 4. Shopify **Refunds / Discounts** → GOS

**Source object:** `refunds`, `discount_codes`, `price_rules`,
`order.discount_applications`, `order.total_discounts`.

### Useful fields
`refunds[].created_at`, `refunds[].total_refunded_set`, `refunds[].refund_line_items[]`,
`price_rules[].id`, `price_rules[].value_type`, `price_rules[].value`,
`price_rules[].usage_count`, `discount_codes[].code`,
`order.discount_applications[].type` (`manual`, `automatic`, `discount_code`),
`order.discount_applications[].value`.

### Target GOS tables
| GOS Table | Fields fed | Origin |
|-----------|------------|--------|
| `gos_gross_to_net_snapshots` | `discounts`, `refunds` | AUTO |
| `gos_offer_economics_runs` | `offer_name`, `base_price`, `discount_percent`, `discounted_price` | AUTO |
| `gos_pnl_snapshots` | `net_revenue` (via gross-to-net) | DERIVED |

### Shopify **cannot** supply — must remain MANUAL
- Real offer intent (acquisition vs retention vs clearance) — needed to score viability
- Ad-spend attribution for the offer (from ad platforms, not Shopify)
- Gift / bundled-freebie COGS

---

## 5. Shopify **Inventory** → GOS

**Source object:** `inventory_levels`, `inventory_items`, `locations`.

### Useful fields
`inventory_levels[].available`, `inventory_levels[].location_id`,
`inventory_items[].cost`, `inventory_items[].requires_shipping`,
`locations[].country_code`.

### Target GOS tables
| GOS Table | Fields fed | Origin |
|-----------|------------|--------|
| `gos_inventory_snapshots` | `units_on_hand` per SKU per location | AUTO |
| `gos_inventory_grade_snapshots` | `inventory_units`, `daily_sales_velocity` (from Orders), `days_of_inventory_on_hand`, `inventory_grade`, `cash_locked_in_inventory` | DERIVED |
| Forecast (constraint) | out-of-stock horizon | DERIVED |
| Live Optimization (constraint) | do-not-push flags for near-OOS or dead stock | DERIVED |

### Grading rule (deterministic)
- `days_on_hand < 30` → **A** (fast) → strategy: *push, protect margin*
- `30 ≤ days_on_hand < 90` → **B** → strategy: *steady demand generation*
- `90 ≤ days_on_hand < 180` → **C** → strategy: *volume test, watch CAC*
- `days_on_hand ≥ 180` → **D** (dead) → strategy: *cash-recovery / liquidation campaign; do not scale full-price acquisition*

### Shopify **cannot** supply cleanly — MANUAL fallback
- Unit cost (`inventory_items.cost` is optional; often blank or wrong)
- Inbound POs already paid but not yet received (cash-conversion cycle)
- Supplier lead times

---

## Fields Shopify will **never** provide — permanent MANUAL entry

These live in `gos_financial_inputs` / `gos_product_financial_profiles` /
`gos_pnl_snapshots` and must be surfaced in the Manual Checklist:

- Landed cost, duties, tariffs
- True shipping cost paid to carrier (vs shipping billed to customer)
- Pick & pack cost per order (3PL invoice)
- Exact payment-processing percent per gateway split
- OPEX (payroll, rent, software)
- Interest expense
- Supplier payment terms (Net 30 / 60)
- Cash-conversion cycle
- Marketing spend (comes from ad platforms, not Shopify)
- Chargebacks (from processor)

---

## Downstream engine dependency map

```text
Shopify Orders ──► gross_to_net_snapshots ──► pnl_snapshots ──► Weekly/Daily P&L
              └──► quantitative_baselines ──► Diagnosis / Forecast / Live Opt
              └──► customer_cohorts       ──► Retention ──► allowable CAC
              └──► measurement_snapshots  ──► Measurement engine

Shopify Products ──► product_financial_profiles (+ MANUAL cost inputs)
                                            └──► basket_economics ──► break-even CAC
                                            └──► offer_economics  ──► offer viability

Shopify Inventory ──► inventory_grade_snapshots ──► Forecast constraint
                                                 └──► Live Optimization constraint
```

---

## Phase 11A.0.1 addendum — Order distribution, funnel, SKU demand, OPEX

### Shopify **Orders** — additional feeds
- **Order-value distribution** → `gos_order_value_distributions` (avg, median, modal, buckets_json). Uses raw `order.total_price` per order over the period.
- **Units per transaction** and **product mix by order** → funnel economics defaults (DERIVED from `order.line_items[].quantity`).
- **First-time vs returning order patterns** → cohort curves used by Retention + LTGP:CAC (already noted in §3).

### Shopify **Line Items** — new feeds
- `line_items[].sku` + `line_items[].quantity` → **SKU demand plan actuals** in `gos_sku_demand_plans` (compare `forecasted_units` vs realised units).
- Bundles: detect two-pack / three-pack via `title` + `variant.option1..3` (PARTIAL — usually needs client naming convention).
- **Funnel/order profitability** → when joined with UTM/campaign data on the same order, seeds `gos_funnel_economics.expected_product_mix_json`.

### Shopify **UTM / landing site** fields
- `order.landing_site`, `order.referring_site`, `order.source_name`, `order.note_attributes[utm_*]`.
- Connect orders to campaigns/funnels → funnel-level AOV, product mix, gross profit.
- **PARTIAL:** many orders lack UTMs (direct traffic, email); attribute unknowns to `funnel_type = UNKNOWN`.

### Shopify **Inventory** — additional feeds
- Directly hydrates `gos_sku_demand_plans.available_inventory`.
- Combined with velocity (from Orders) → `gos_inventory_grade_snapshots` grade + the inventory-aware media buying warnings (Growth Diagnosis `CONSTRAINT_PROBLEM`, Live Optimization `REDIRECT_TO_ALTERNATIVE_SKU`).

### Still MANUAL after 11A.0.1
- True landed cost, freight, duties
- Pick & pack, payment processing splits
- Return allowance and discount allowance **by SKU or category**
- OPEX buffer settings (`gos_opex_allocation_settings`) — a policy choice, not data
- Strategic demand plan approval (AM signs off the `gos_sku_demand_plans` for the month)
