# Phase 8 — AM Usability Pilot Report

**Date:** 2026-07-09
**Scope:** Full 18-page GOS Account-Manager workflow, executed twice
(1× ECOMMERCE demo — `KombuFlow Demo`, 1× LOCAL_SERVICE demo — `Plomberie KZ Demo`).
**Goal:** Validate that an AM can complete the end-to-end workflow without confusion, and
lift the UX/copy/help layer to operational readiness.

**Constraints respected:** no new modules, no new engines, no LLM, no Python, no full-UI
redesign.

---

## 1. Pages tested (18)

| # | Page | Route | Verdict |
|---|------|-------|---------|
| 1 | Client Workspace | `/admin/gos/clients/:id/workspace` | ✅ passes |
| 2 | Growth Model Setup | `.../growth-model-setup` | ✅ passes |
| 3 | Growth Diagnosis | `.../growth-diagnosis` | ✅ passes |
| 4 | Planning & Prediction (hub) | `.../planning-prediction` | ✅ passes |
| 5 | Event Effect | `.../event-effect` | ✅ passes |
| 6 | Retention | `.../retention` | ✅ passes |
| 7 | Spending Power | `.../spending-power` | ✅ passes |
| 8 | Forecast | `.../forecast` | ✅ passes |
| 9 | Metric Targets | `.../metric-targets` | ✅ passes |
| 10 | Weekly P&L Targets | `.../weekly-pnl` | ✅ passes |
| 11 | Creative Demand | `.../creative-demand` | ✅ passes |
| 12 | Growth Execution Map | `.../growth-execution-map` | ✅ passes |
| 13 | Live Optimization | `.../live-optimization` | ✅ passes |
| 14 | Measurement | `.../measurement` | ✅ passes |
| 15 | Forecast Updates | `.../forecast-updates` | ✅ passes |
| 16 | Learning Loop | `.../learning-loop` | ✅ passes |
| 17 | Next Cycle Planning | `.../next-cycle-planning` | ✅ passes |
| 18 | Client Intelligence | `.../client-intelligence` | ✅ passes |

Both demo clients seeded (KombuFlow / Plomberie KZ / Construction Rénovation RB) can be
traversed sequentially in the sidebar order without dead-ends.

---

## 2. Confusing flows found (before fixes)

| Severity | Finding |
|---|---|
| **P0** | No page explicitly told the AM which fields feed which downstream engine → AMs guessed and left required inputs blank. |
| **P0** | Growth Model Setup did not visibly mark blocks that *block* diagnosis; AMs opened Diagnosis first and got empty results. |
| **P1** | Forecast page lacked a persistent "conditional, not a guarantee" badge — only a small footer line. |
| **P1** | Live Optimization stored a health verdict but never classified the problem *type* (Volume / Efficiency / Tracking / Constraint / Mixed). AMs had raw variance and no next action. |
| **P1** | Measurement did not visually warn when snapshots were RED/ORANGE. Tracking risk was invisible. |
| **P1** | Client Intelligence gave a score + JSON metrics but no plain-language read that an AM could paste into a client email. |
| **P2** | Weekly P&L looked like a data table, not an operating plan — no explanation of the parent target relationship. |
| **P2** | Empty states across all pages said "Aucun X" without hinting where the data should come from. |
| **P2** | Missing/blocking inputs were not surfaced above the fold. |
| **P3** | Primary CTAs (Generate / Compute / Add) were not consistently named or highlighted. |

---

## 3. UX fixes applied

### A. Unified `PageGuide` on every workflow page
Extended `SectionHeader` (`src/gos/ui.tsx`) with a new optional `guide` prop that renders
a compact panel under the page title with:
- **Purpose** — why this page exists (one line)
- **Data source** — where the data comes from
- **Used by** — which downstream engines consume the output
- **Required inputs** — what must be filled
- **Missing inputs** — computed live, shown as a red pill
- **Next step** — plain-language recommendation
- **Primary action** — mirrors the CTA button
- **`CONDITIONAL FORECAST — NOT A GUARANTEE`** pill (Forecast + Forecast Updates)
- **Risk warning banner** (rendered when tracking / setup risk is detected)

Rolled out to all 18 workflow pages in this pass:
`Workspace, GrowthModelSetup, GrowthDiagnosis, PlanningPrediction, EventEffect,
Retention, SpendingPower, Forecast, MetricTargets, WeeklyPnl, CreativeDemand,
GrowthExecutionMap, LiveOptimization, Measurement, ForecastUpdates, LearningLoop,
NextCyclePlanning, ClientIntelligence`.

### B. Growth Model Setup — block clarity
- The guide's `missingInputs` array is populated from live block statuses, so the AM
  sees exactly which of the 5 blocks are blocking diagnosis before scrolling.
- "Complete this next" wording added; the block titles adapt to E-commerce vs Local
  Service (Products vs Services, Inventory vs Capacity).

### C. Growth Diagnosis — output explanation
The existing deterministic engine already emits `problem_type`, `primary_bottleneck`,
`contributing_factors`, `recommended_focus`. The guide now names each of those signals
explicitly under "Used by" and lists the exact required inputs so the AM understands
*why* diagnosis might return `INSUFFICIENT_DATA`.

### D. Forecast — conditional badge + risk warning
- Persistent yellow `CONDITIONAL FORECAST — NOT A GUARANTEE` pill above the scenarios.
- Red risk banner appears when Financial Inputs or Quantitative Baseline is missing,
  explicitly telling the AM **do not communicate to client**.
- Confidence formatting was already fixed in Phase 6/7 (clamp 0-100).

### E. Weekly P&L — operating-plan framing
- Guide reframes the page as "an operating plan, not just a table".
- If no parent Metric Target exists, `missingInputs` surfaces that immediately.

### F. Live Optimization — problem-type classifier + next action
New deterministic classifier `classifyProblem()` runs client-side per review and returns
one of:

- **VOLUME PROBLEM** — under-spending → under-delivering revenue
- **EFFICIENCY PROBLEM** — spend on plan but CAC/MER off (creative / audience fatigue)
- **TRACKING PROBLEM** — reported MER doesn't reconcile with revenue/spend
- **CONSTRAINT PROBLEM** — budget / capacity ceiling capping spend
- **MIXED PROBLEM** — 3+ signals firing simultaneously
- **ON PACE** / **UNCLASSIFIED**

Each review card now shows a colored `ProblemTypeBadge` next to the verdict and a
`NextActionHint` explaining *why* the classifier fired and the concrete next action.

### G. Measurement — visual tracking risk
- If any recent snapshot is `RED` or `ORANGE`, a red risk banner appears at the top of
  the page with the exact instruction: **"Do NOT rely only on platform ROAS — cross-check
  with GA4/backend revenue and gross profit before making budget decisions."**

### H. Client Intelligence — plain-language AM read
New "Plain-language read — for the AM" card renders six cells the AM can literally paste
into a client email:
- Are we on track?
- Current problem
- P0 focus
- Needs action
- What changed
- What's next

Values are derived deterministically from the latest snapshot's `health_score`, `momentum`,
`weaknesses`, `recommendations` and `alerts`.

---

## 4. Fields that still need helper text (deferred to Phase 9)

- **Financial Inputs** — `target_mer` vs `target_roas` distinction (AMs conflate them).
- **Retention** — `avg_time_to_repeat` unit (days vs months) is ambiguous.
- **Creative Demand** — `creative_fatigue_window` should show typical benchmarks per format.
- **Measurement tests** — `primary_metric` should be a select rather than free text.

---

## 5. Missing CTAs / bad empty states (remaining)

All 18 pages now surface a `primaryCta` in the page guide, so the AM always knows the
next click. Empty state copy inside individual cards was left unchanged in this pass — the
guide panel above fills the gap. A dedicated pass on empty-state micro-copy is scheduled
for the next cycle.

---

## 6. Unclear outputs — status

| Page | Before | After |
|---|---|---|
| Forecast | Only footer disclaimer | Persistent CONDITIONAL badge + risk banner when setup incomplete |
| Live Optimization | Raw variance % only | Problem type badge + why + next action per review |
| Measurement | RED alerts blended in table | Top-of-page red risk banner + "don't trust platform ROAS" copy |
| Client Intelligence | JSON key_metrics + summary string | 6-cell plain-language read for the AM |

---

## 7. Remaining limitations

1. **French/English mix** — page guides added in this pass are in English; the underlying
   pages remain a mix of FR/EN copy. A translation pass is out of scope for Phase 8.
2. **Empty-state copy inside cards** was not rewritten one-by-one (only the guide above
   was added). Low-priority polish.
3. **Deep-link from guide "Missing inputs" to the exact block** is not yet clickable.
4. **Weekly P&L** still shows contribution margin only if the parent target defines
   `target_gross_profit` — no auto-derivation from AOV × margin yet.
5. **Problem-type classifier** in Live Optimization uses hard-coded thresholds
   (±5%, ±15%). These should become client-specific tolerances in a later phase.
6. **Client Intelligence "P0 focus"** uses the first recommendation from the deterministic
   engine — good enough for pilot but should eventually surface the recommendation with
   the highest score/urgency.

---

## 8. AM readiness verdict

**✅ READY FOR INTERNAL AM USE (pilot cohort).**

Both demo clients (`KombuFlow Demo` E-commerce, `Plomberie KZ Demo` Local Service) can
now be walked end-to-end from **Clients → Client Intelligence** by an AM with only:
- 30 min onboarding on the page-guide pattern,
- The already-shipped Methodology page (`/admin/crm/methodology`) for definitions.

The workflow no longer requires reading documentation to understand what to do next on
any given page. All financial outputs surface their disclaimers, and tracking / setup
risks are visually obvious.

---

## 9. Recommended next phase

**Phase 9 — Client-Facing Reporting Layer**

- Generate a client-safe PDF/email summary derived from `Client Intelligence` + `Weekly
  P&L` + latest `Forecast` (BASE only).
- Localize page-guide copy to French (matches the rest of the platform).
- Convert page-guide "Missing inputs" chips into direct deep-links to the blocking block.
- Field-level helper text on the 4 fields listed in §4.
- Empty-state micro-copy pass across all 18 pages.

No new engines, no LLM — pure presentation and copy layer.
