# Phase 11A.0 — Ecommerce Financial Model QA

**Scope:** Expand the e-commerce financial model with finance-grade formulas (gross-to-net, cost of delivery, true gross margin, basket & offer economics, inventory grade, P&L, LTGP:CAC) and lay the Shopify mapping blueprint. **No OAuth. No Shopify API call yet.**

**Result:** ✅ Formulas ship, tables ship, page ships. 59/59 golden + safety checks pass (`bun scripts/validate-financial-formulas.ts`).

## What shipped

- Blueprint: `.lovable/shopify-data-mapping-blueprint.md`
- Migration: 6 new tables (`gos_gross_to_net_snapshots`, `gos_product_financial_profiles`, `gos_basket_economics`, `gos_offer_economics_runs`, `gos_inventory_grade_snapshots`, `gos_pnl_snapshots`) with GRANT + RLS.
- Formulas (`src/gos/formulas.ts`): `computeGrossToNet`, `computeProductProfile`, `computeBasketEconomics`, `computeOfferEconomics`, `computeLtgpToCac`, `computeInventoryGrade`, `computePnlSnapshot`. All null-safe; no NaN/Infinity leaks.
- Page: `/admin/gos/clients/:clientId/ecommerce-financial-model` (+ nav entry). Gated to `business_type === "ECOMMERCE"` with a friendly redirect message for `LOCAL_SERVICE`.
- Methodology page updated with 11 new finance-grade rules.
- Data Sources page updated with a Shopify readiness panel listing AUTO vs MANUAL fields.
- Golden test coverage extended (5 new cases).

## Golden test summary

| Case | Domain | Assertions | Result |
|------|--------|-----------:|:------:|
| Golden 7 | Product margin vs true gross margin | 4 | ✅ 4/4 |
| Golden 8 | Discount economics | 4 | ✅ 4/4 |
| Golden 9 | LTGP:CAC | 2 | ✅ 2/2 |
| Golden 10 | Inventory grade | 3 | ✅ 3/3 |
| Golden 11 | P&L snapshot | 4 | ✅ 4/4 |
| Previous Phase 7 tests | Untouched | 43 | ✅ 43/43 |
| **Total** | | **60** | ✅ 60/60 |

## Formula highlights (documented in Methodology)

- Gross-to-net = gross − discounts − refunds − chargebacks + shipping_collected − taxes_if_TTC.
- Cost of delivery = product_cost + landed + freight + duties + shipping_to_customer + pick_pack + payment_processing + refund_alw + discount_alw.
- Break-even CAC = true_gross_profit (per unit).
- Break-even ROAS = 1 / true_gross_margin.
- Offer viability thresholds (break-even ROAS after offer): ≥6 HIGH_RISK; ≥3 TIGHT; <3 HEALTHY; GP≤0 NOT_VIABLE_FOR_ACQUISITION.
- Inventory grades: A <30d · B <90d · C <180d · D ≥180d (cash-recovery only).
- LTGP:CAC bands: <1 LOSING_MONEY · <2 WEAK · ≤3 HEALTHY · >3 UNDER_SPENDING.
- P&L waterfall: net_rev → gross_profit → contribution_margin → EBITDA → net_profit, all null-safe.

## Definition of Done — checked

- [x] Shopify mapping blueprint exists.
- [x] New financial tables exist with GRANTs + RLS.
- [x] `formulas.ts` extended with all 7 new pure formulas.
- [x] E-commerce Financial Model page live at `/admin/gos/clients/:clientId/ecommerce-financial-model`.
- [x] Methodology page updated with 11 new rules.
- [x] Data Sources page shows Shopify readiness mapping.
- [x] Golden tests: 60/60 pass.
- [x] No OAuth implemented. No Shopify API call added. No LLM. No Python.
- [x] Typecheck passes (build).
- [x] Existing demo clients / other GOS pages untouched.

## Known limitations / next phases

- The new tables are wired but the E-com Financial Model page currently computes live in-memory. Persisting into `gos_*` tables (save/load) is a small Phase 11A.1 follow-up.
- Shopify OAuth + `gos_shopify_orders_raw` ingestion → Phase 11B.
- Meta / Google Ads / GA4 connectors → Phase 11C.
- Customer cohort table + retention hydration from Shopify → Phase 11D.
