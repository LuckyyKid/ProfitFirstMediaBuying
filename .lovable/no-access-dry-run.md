# Phase 9A — No-Access Dry Run Report

_Date: 2026-07-09_
_Scope: TDIA Growth Operating System / Profit First Media Buying OS_

## Context

TDIA does not currently have API or platform access to any real client account.
Real-time API calibration (Meta, Google Ads, Shopify, Klaviyo, CRM) cannot yet run.

Phase 9A adds a formal **Dry Run mode** so the system can be exercised end-to-end
against manual, anonymized, or proxy data — without ever presenting the outputs
as if they were fully API-validated.

## What was shipped

### 1. `data_mode` on every client (schema)

`gos_clients.data_mode` — enum-like text, values:

| Mode                    | Badge          | Confidence cap | Client-facing? |
| ----------------------- | -------------- | -------------- | -------------- |
| `DEMO_DATA`             | Demo Data      | 40%            | ❌             |
| `ANONYMIZED_HISTORICAL` | Historical Proxy | 60%          | ❌             |
| `MANUAL_CLIENT_EXPORT`  | Manual Export  | 75%            | ❌ (internal only) |
| `API_CONNECTED`         | API Connected  | 100%           | ✅             |

Also added:
- `data_quality_score` (0-100, deterministic)
- `data_mode_notes` (free text)

### 2. Data Quality Score (DQS)

Deterministic formula in `src/gos/dataMode.ts`:

```
DQS = completeness × 0.70   (required checklist fields filled)
    + source       × 0.15   (DEMO 0.2 · HIST 0.5 · MANUAL 0.8 · API 1.0)
    + recency      × 0.15   (baseline updated_at bucketing)
```

### 3. Manual Data Checklist page

Route: `/admin/gos/clients/:id/manual-checklist`

- Ecom minimum (12 fields): revenue 30d, ad spend 30d, orders 30d, AOV,
  CAC / new customers, MER/ROAS, gross margin %, target CAC, product to push,
  product to avoid, inventory risk, creative signals.
- Local service minimum (11 fields): leads 30d, qualified leads 30d, booked
  appts 30d, jobs closed 30d, revenue 30d, ad spend 30d, avg job value,
  gross margin %, close rate, capacity per week, response time.
- Live DQS panel + missing-field list.
- Data mode selector with per-mode usage warning.

### 4. Forecast page

- Data Sourcing banner (mode + DQS + explicit confidence cap).
- Yellow warning when mode ≠ API_CONNECTED: _"This forecast is based on
  manually entered or proxy data. Use for internal planning, not as a client
  guarantee."_
- Confidence at insert time is **capped** by `DATA_MODE_META[mode].confidenceCap`.
  Demo data can never emit >40% confidence in `gos_forecasts.confidence`.
- Existing CONDITIONAL FORECAST badge preserved.

### 5. Client Intelligence page

Adds a persistent Data Sourcing panel showing:
- Current Data Mode (badge)
- Current DQS
- Confidence cap
- Missing required fields
- Direct link to the Manual Data Checklist

## What can be validated without API access

- End-to-end AM workflow across the 18 GOS pages.
- All 14 deterministic engines produce `model_runs`, formulas, and outputs.
- Financial correctness (Phase 7 golden tests still pass, 43/43).
- UX and page guides (Phase 8) — every page tells the AM what to do next.
- Data-mode gating: forecasts and intelligence clearly refuse to look
  "API-grade" when they aren't.

## What cannot be validated without real data

- Actual accuracy of the projections vs real-world outcomes.
- Platform-specific tracking realities (iOS opt-out, CAPI dedup, view-through).
- Real inventory/capacity constraints and true refund/RTO behaviour.
- Creative velocity vs true audience saturation curves.
- CRM handoff timings and Slack alert cadence under real load.

## Demo clients used

| Client                | Business type | Data mode  | DQS baseline |
| --------------------- | ------------- | ---------- | ------------ |
| KombuFlow Demo        | ECOMMERCE     | DEMO_DATA  | ~60          |
| Plomberie KZ Demo     | LOCAL_SERVICE | DEMO_DATA  | ~60          |

Both are labelled `DEMO_DATA`, capped at 40% forecast confidence, and every
forecast surfaced now carries the "internal planning only" banner.

## Engine outputs (dry-run status)

All 14 engines run without error and persist `gos_model_runs` rows. In DEMO_DATA
mode:
- `run-forecast` confidence ≤ 40%
- `run-creative-demand` outputs unaffected structurally, still marked demo
- `run-metric-targets` unchanged (targets are prescriptive, not predictive)
- All other engines unchanged; they are deterministic given inputs.

## Confidence limitations

- No engine may present >40% confidence while the client is in DEMO_DATA.
- No engine may present >60% while ANONYMIZED_HISTORICAL.
- No engine may present >75% while MANUAL_CLIENT_EXPORT.
- Only API_CONNECTED unlocks full 0–100% band.

## Recommended next step to reach real calibration

1. Onboard one live pilot client and flip `data_mode` to `API_CONNECTED`.
2. Wire the read-only API connectors (Meta Insights, GA4, Shopify Admin,
   platform ROAS) into the existing `gos_quantitative_baselines` and
   `gos_measurement_snapshots` tables. Engines already consume that shape.
3. Re-run the Phase 8 usability pilot end-to-end against the real account.
4. Compare forecast BASE vs actuals after 30 days; only then relax the
   API_CONNECTED cap toward "high confidence" language for that account.

## Definition of Done — check

- ✅ AM can run the full system without API access.
- ✅ System clearly labels manual/proxy data (mode badge on Forecast and
     Client Intelligence, banner in Manual Checklist).
- ✅ Forecasts do not pretend to be fully validated (warning + confidence cap).
- ✅ Data quality affects confidence via `capConfidence()` at insert time.
- ✅ No misleading client-facing claims — all non-API modes carry the
     internal-only disclaimer.
