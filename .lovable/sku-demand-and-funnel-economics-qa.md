# Phase 11A.0.1 — SKU Demand & Funnel Economics QA

**Scope:** Extend the e-commerce financial layer with order-value distribution, funnel-level economics, SKU demand planning with inventory-aware media actions, and an explicit OPEX buffer setting. Still **no OAuth. No Shopify API call.**

**Result:** ✅ 74/74 golden + safety checks pass (`bun scripts/validate-financial-formulas.ts`). Typecheck clean.

## What shipped

- **Migration** — 4 new tables (`gos_order_value_distributions`, `gos_funnel_economics`, `gos_sku_demand_plans`, `gos_opex_allocation_settings`) with GRANT + RLS.
- **Formulas** (`src/gos/formulas.ts`) — `computeOrderValueDistribution`, `computeFunnelEconomics`, `computeSkuDemandPlan`, `computeOpexBufferWarning`. All null-safe, no NaN/Infinity leaks, all with `missing_data` and `summary`.
- **E-commerce Financial Model page** — 3 new sections:
  - §7 Distribution de la valeur de commande (raw values → auto-buckets, avg / median / modal, long-tail risk, CAC-target risk warning, bucket histogram table).
  - §8 Économie de funnel / campagne (funnel_type-aware, product_mix_confidence, retention-only warning, first-order profitability at target CAC).
  - §9 Traitement de l'OPEX (buffer type selector, bootstrap mode, mandatory warning).
- **New page** `/admin/gos/clients/:clientId/sku-demand-plan` — editable SKU table, live projected inventory, marketing priority + paid media action derivation, month selector. Nav entry added under STRATEGY.
- **Methodology** — 4 new sections: *Averages Lie*, *Media Buying Must Match SKU Strategy*, *Marketing/Finance/Inventory Share One Plan*, *Fixed OPEX ≠ Variable Cost per Order*.
- **Shopify mapping blueprint** — addendum documenting order-value distribution, line-item SKU demand actuals, UTM/landing site → funnel attribution, and the fields that remain manual.

## Golden test summary (phase 11A.0.1)

| Case | Domain | Assertions | Result |
|------|--------|-----------:|:------:|
| Golden 12 | AOV average vs modal risk | 4 | ✅ 4/4 |
| Golden 13 | Funnel economics not first-order profitable | 3 | ✅ 3/3 |
| Golden 14 | SKU demand plan inventory constraint | 3 | ✅ 3/3 |
| Golden 15 | Grade D cash recovery | 2 | ✅ 2/2 |
| Golden 16 | OPEX buffer warning | 2 | ✅ 2/2 |
| Total new | | **14** | ✅ 14/14 |
| Total suite (Phases 7 + 11A.0 + 11A.0.1) | | **74** | ✅ 74/74 |

## Inventory-aware media buying — logic table

| Grade | Projected stock | Marketing priority | Paid media action | Note |
|-------|----------------|--------------------|-------------------|------|
| A + GM ≥ 40% | Safe | SCALE | INCREASE_SPEND | Profit-max play. |
| B | Safe | MAINTAIN | MAINTAIN_SPEND | Steady demand. |
| Any | Projected < 0 | DO_NOT_PUSH | REDIRECT_TO_ALTERNATIVE_SKU | Would oversell. |
| Any | 0 ≤ projected < safety | LIMIT | REDUCE_SPEND | Stock too thin. |
| Any | 0 ≤ projected < 10% forecast | LIMIT | REDUCE_SPEND | Medium risk. |
| C | Any | CLEARANCE | BUILD_DEDICATED_FUNNEL | Cash-flow play, not profit-max. |
| D | Any | CLEARANCE | LIQUIDATE_INVENTORY | Cash-recovery only. |

## Definition of Done — checked

- [x] Order Value Distribution model exists (table + formula + UI section).
- [x] Funnel Economics model exists (table + formula + UI section).
- [x] SKU Demand Plan exists (table + formula + dedicated page + nav).
- [x] Inventory-aware media buying logic implemented via `computeSkuDemandPlan` (feeds any campaign-level check that reads it).
- [x] OPEX treatment setting exists (table + formula + UI section + warning).
- [x] Methodology updated with 4 new sections.
- [x] Shopify blueprint addendum written.
- [x] Golden tests: 74/74 pass.
- [x] No OAuth implemented. No Shopify API call. No Meta/Google/GA4. No LLM. No Python.
- [x] Typecheck passes.
- [x] Existing GOS pages / demo clients untouched.

## Known follow-ups

- Persistence: page-level save/load into the 4 new tables (currently in-memory). Phase 11A.0.2.
- Auto-derivation of Order Value Distribution from `gos_shopify_orders_raw` after 11B Shopify ingestion.
- Wire the SKU Demand plan into Live Optimization to emit `CONSTRAINT_PROBLEM` automatically. Phase 11A.0.3.
