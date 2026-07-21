# System Design Best Practices

This document stores the system design rules for the Profit System build. It combines the Six-File Context methodology with the system design transcripts and the ecommerce-specific requirements of this project.

## Operating Principle

The developer or agent is the architect; AI is the implementation engine. Do not outsource architecture to code generation.

Before adding a new layer, define:

- what business capability the layer unlocks;
- which module owns the logic;
- where data is persisted;
- how the result is verified;
- what is explicitly out of scope.

Build in scoped, verifiable units. A unit is complete only when it has a clear result, tests or validation, and no architecture invariant is violated.

## Transcript-Derived System Design Rules

These rules come from the supplied system-design and agentic-development transcripts and are persistent rules for this app.

1. Design before implementation. Write down product intent, boundaries, storage, security, and verification before code changes.
2. Use the Six-File Context method when planning larger work: project overview, architecture, code standards, AI workflow rules, UI context, and progress tracker.
3. Build one scoped unit at a time. A unit must have a concrete goal, implementation boundary, dependencies, and verification checklist.
4. Keep the app modular before reaching for microservices. Use a modular monolith by default; extract services only for clear team, scaling, reliability, or deployment reasons.
5. Keep compute stateless and persisted data external. App code can scale horizontally only when state is not trapped in a single runtime instance.
6. Choose storage by responsibility: relational tables for structured source truth, object storage for large artifacts, cache/CDN for repeated or static reads, and queues for durable asynchronous work.
7. Treat API design as a contract. Use consistent resource names, typed payloads, proper HTTP status semantics, bounded reads, validation, and versioning when public clients depend on it.
8. Separate authentication from authorization. Authentication identifies the requester; authorization/RLS decides which client, project, workflow, or mutation they can access.
9. Use asynchronous workers or queued jobs for long-running AI/statistical/integration work. Request handlers should trigger work and return quickly when the job may exceed request limits.
10. Add reliability before scale: retries, idempotency, audit trails, dead-letter handling for queues, health checks, and clear failure states.
11. Add rate limiting and payload limits to expensive or public write paths.
12. Use design tokens and shared UI primitives so AI-generated UI stays consistent and verification stays cheap.
13. AI increases implementation speed but also increases verification responsibility. Every AI-generated change must be reviewed against the spec, architecture invariants, and targeted tests.
14. Every new system component must justify its complexity with a concrete correctness, reliability, scalability, security, or maintainability gain.

## Project Boundaries

Use MVC-style separation for GOS / Profit System work:

- `src/gos/*`: model and domain logic. Financial math, cohort transforms, forecast calculations, guardrails, deterministic engines.
- `src/pages/admin/gos/*`: views and controllers for user workflows. Pages collect inputs, call model/controller functions, render output, and persist results.
- `src/integrations/*`: integration clients only. No business math here.
- `supabase/migrations/*`: persistent schema and RLS policy changes.
- `docs/*`: architecture, modeling, validation, and operating notes.

React pages must not own formulas. If a calculation affects business decisions, move it into `src/gos/*` and test it.

## Architecture Invariants

1. Keep compute logic separate from UI rendering.
2. Keep Supabase/network access behind page-level loading functions or a small controller module.
3. Treat integration and manual-entry data as external input; normalize it before model use.
4. Use deterministic TypeScript models in the app runtime. Use Python/R only for statistical or batch modeling.
5. Never hide missing financial data as zero when zero would change the decision.
6. Never mix unrelated layers in one implementation step unless the unit cannot be verified otherwise.
7. Store source data separately from derived analysis. Derived outputs can be recomputed.
8. Add tests for model behavior before relying on the result in a workflow.
9. Keep `target_*`, `projection_*`, and `actual_*` semantically separate. Targets are commitments, projections are editable forecasts, actuals are realized results.
10. Audit projection and target-lock changes through `gos_projection_updates`; do not overwrite operating context without a durable history.

## Storage Rules

Use PostgreSQL/Supabase for structured business data:

- clients, memberships, roles, settings;
- financial inputs and daily targets;
- transactions, orders, customer rows, campaign metadata;
- model runs and derived snapshots.

Use object/file storage for large files or generated artifacts. Do not store large binary payloads in relational tables.

Use cache only for short-lived, recomputable reads or rate-limit counters. Do not use cache as the source of truth.

## API And Controller Design

Prefer simple REST-style resource boundaries for this app:

- resource nouns, not action verbs;
- predictable create/read/update/delete semantics;
- typed request payloads and response shapes;
- pagination or bounded reads for large data sets;
- explicit versioning if a public API is introduced.

Authentication answers who the user is. Authorization answers what the user can do. Keep these separate in the design.

Use RLS and role checks for data boundaries. Mutations must be scoped to a client and must enforce membership/role rules.

## Scaling Rules

Start simple and decouple when a real constraint appears:

- Separate stateless app logic from persisted data.
- Add load balancing and horizontal scaling when traffic requires it.
- Add an API gateway only when multiple services or routing/security boundaries justify it.
- Add message queues for durable asynchronous work and fan-out events.
- Add caching/CDN for repeated reads or static assets.
- Add rate limiting to protect expensive endpoints and public write paths.

Avoid premature microservices. A modular monolith with clear domain boundaries is the default until team size, load, or failure isolation requires service extraction.

## Reliability Rules

Design for known failure modes:

- database unavailable;
- integration sync delay or partial data;
- duplicate manual/integration rows;
- missing cost or revenue fields;
- stale cached derived output;
- long-running statistical jobs.

For asynchronous work, use durable queues with retry, acknowledgement, and dead-letter handling. Do not rely on direct synchronous fan-out when failure would silently drop important work.

## Security Rules

Protect APIs and mutations with:

- authentication;
- authorization/RLS;
- input validation;
- rate limiting for expensive or public endpoints;
- bounded payload sizes;
- HTTPS in production;
- CSRF protections where cookie auth is used;
- output sanitization for user-generated HTML/text.

Do not put secrets, private tokens, or service-role keys in frontend code.

## Modeling Rules

Use TypeScript in the app for deterministic calculations:

- unit economics;
- spend-to-efficiency frontiers and objective-based spend selection;
- CAC, MER, contribution, ROAS display;
- inventory and cash constraints;
- cohort preparation and matrices;
- weekly and daily target splitting;
- target/projection/actual variance math and projection audit payloads;
- data analyst readiness checks and model-card generation;
- forecast display math.
- deterministic event-effect estimates, interrupted time series, and difference-in-differences approximations.
- creative-demand planning from spend, CPM, fatigue thresholds, and asset mix.
- campaign configuration from category targets, campaign grouping, active budget totals, and guarded current-budget edits.
- daily budget planning from target CPA, active campaign counts, current budgets, status bands, and guarded budget-update payloads.
- buyer-workspace daily decisioning from campaign performance, category targets, buyer decision drafts, and guarded budget-change intent.
- media-buying rule evaluation from campaign lookback performance, cooldowns, and budget-compliance guardrails.
- media-buying action application gating from action status transitions and budget application audit history.
- spending-power and Profit-First Media Buying orchestration from cash, burn, margin, historical spend/CAC/MER, new-customer revenue, basket economics, and funnel capacity.
- Profit Plan orchestration as a derived monthly/daily plan that composes deterministic engines without replacing source data.
- three-cohort forecasting from normalized transactions: planned new customers, recently acquired 180d repeat revenue, and active non-recent repeat revenue.
- offer/SKU unit-economics targets: landed contribution before ads, break-even CAC, target CAC, ROAS/AMR, and portfolio-weighted target economics.
- attribution target translation from business CAC/AMR into click-only platform targets by reporting window, delayed attribution, and view-through exclusion.
- channel allocation from planned spend, allocation weights, channel efficiency, and incrementality factors, including incremental target AMR and required platform AMR.
- campaign-level daily planning from channel allocation, active campaign inputs, campaign allocation weights, current budgets, and Profit Plan daily pacing.
- event-adjusted daily Profit Plan pacing from day-of-week weights, planned marketing events, event lift multipliers, and normalized monthly totals.
- Concept Log operational planning from offer, landing page, copy, bid/cost cap, expected daily spend, campaign link, ads per concept, readiness scoring, and expected spend coverage.
- Daily Growth Map execution metrics from daily P&L targets/actuals, latest Profit Plan daily rows, campaign daily plan rows, and buyer-workspace campaign performance actuals.

Use Python/R as a batch or service layer only when the model needs statistical machinery:

- regression;
- confidence intervals;
- feature selection;
- retention curve fitting;
- advanced event-effect modeling with stronger statistics, seasonality, and backtesting;
- MMM/incrementality;
- outlier detection and backtesting.

The Python/R layer should write model outputs back to Supabase. React should consume saved outputs or call deterministic TypeScript models, not execute statistical notebooks.

Current Data Analyst batch standard:

- Python script path: `scripts/data_analyst_statistical_upgrade.py`.
- Runtime libraries: `pandas`, `numpy`, `scipy`; add `statsmodels` only when richer regression diagnostics are required.
- Output contract: JSON with `engine_version = data_analyst_statistical_upgrade_v1`.
- Persistence: save derived output to `model_runs`, never as source truth.
- UI rule: React may build input JSON, parse output JSON, display results, and save batch outputs, but must not execute the Python job in-browser.
- MMM rule: lightweight MMM/incrementality outputs are advisory model context only. They may inform reviewed channel-allocation assumptions, but they must not mutate Profit Plans, channel budgets, or campaign budgets directly.
- MMM input rule: use normalized `gos_campaign_daily_perf` joined to `gos_campaigns.platform` for channel-level daily spend/revenue. If only blended P&L exists, surface the output as directional instead of pretending channel separation exists.
- Decision rule: statistical results must be translated through a deterministic decision brief before they influence AM/media-buying actions.
- Execution rule: a decision brief must be translated into a deterministic execution plan before it becomes AM/media-buyer workflow. Budget changes still require Profit First contribution, cash, inventory, and funnel checks.
- Clash-code-confirm rule: execution work must explicitly challenge the recommendation, code the decision into the operating record, and confirm evidence/sign-off before it is treated as complete or used for a budget decision.
- Budget gate rule: material budget changes must be evaluated by the deterministic Profit First Budget Change Gate before application. The gate may approve, approve with conditions, hold, or block, but it does not mutate campaign budgets directly.
- Budget mutation rule: pages must not write `gos_campaigns.current_daily_budget` directly for budget changes. Use `budgetApplicationController` so increases are covered by the latest Budget Change Gate.
- Campaign configuration rule: Campaign Categories may edit campaign metadata directly through `campaignConfigurationController`, but all `current_daily_budget` creates/updates must be routed through Budget Application Guard.
- Daily budget planner rule: Daily Budget Planner must use `dailyBudgetPlannerController` for campaign/category data and budget applications. The page must not own `target CPA x 50 / 7`, category allocation, status band, or budget-update payload logic.
- Budget audit rule: every guarded budget application attempt should be written to `model_runs` under `budget_application_guard`, whether it was applied or rejected.
- Budget compliance rule: current active campaign budgets should be monitored against the latest gate and application audit through `budget_compliance_monitor` before the next media-buying review.
- Buyer workspace rule: Buyer Workspace may collect manual performance and decision drafts, but it must use `buyerWorkspaceController` for `gos_campaign_daily_perf`, `gos_buyer_decisions`, and budget-change side effects. The page must not own CPA/ROAS/AOV/category formulas.
- Media-buying automation rule: rule evaluation may create suggestions, but it must not mutate campaign budgets or platform state directly. Scale-up suggestions must surface Budget Change Gate and Budget Application Guard requirements.
- Media-buying action status rule: budget-mutating media-buying suggestions must not be marked `applied` unless a matching `budget_application_guard` audit confirms the campaign-budget mutation was actually applied.
- Spending Power rule: Spending Power may collect manual history and trigger model runs, but it must use `spendingPowerController` for `gos_spending_power_snapshots`, `model_runs`, client context, financial input, and basket economics. The page must not own Supabase persistence or PFMB audit payloads.
- Daily Growth Map rule: Walkdown may choose the date scope and render the metric tree, but `src/gos/dailyGrowthMap.ts` owns metric formulas/statuses and `src/gos/dailyGrowthMapController.ts` owns Lovable/Supabase reads. The page must not query Supabase directly or reimplement variance, contribution, AMR, channel, or campaign formulas.

## Ecommerce Cohort Rules

The cohort engine must follow the cohort-analysis transcript while staying ecommerce-native.

Required source fields:

- `customer_id`;
- `transaction_date`.

Optional but recommended ecommerce fields:

- `order_id`;
- `revenue`;
- `gross_profit`;
- `acquisition_channel`;
- `product_key`;
- `segment_key`;
- `source`.

Rules:

1. Acquisition cohort is based on the first known purchase date, not signup date unless the business is subscription-first and signup is the commercial event.
2. Default cadence is monthly because ecommerce repeat purchase behavior is usually easier to interpret monthly than weekly.
3. Weekly and quarterly views are supported for high-frequency or slower-cycle businesses.
4. Survival rate counts unique customers, not orders.
5. Revenue and gross profit metrics can be layered into the same C3 matrix, but customer survival remains a unique-customer metric.
6. Read rows left-to-right for cohort survival/progression.
7. Read columns/up-down for cohort comparison at the same age.
8. Read diagonals for seasonality and calendar effects.
9. Segment by acquisition channel, product, or lifecycle only after the base acquisition cohort view is valid.
10. Do not require spreadsheets. Integrations and manual account-manager entry should both write normalized transaction rows to `gos_customer_transactions`.

Amazon/new-to-brand planning is not part of the active Profit System scope unless the business starts serving Amazon accounts.

## Build Workflow

For each new Profit System layer:

1. Define the layer goal and its inputs/outputs.
2. Decide whether it is deterministic TypeScript or statistical Python/R.
3. Add or update the persistence model if the source data or outputs need storage.
4. Implement the model/controller before the view.
5. Add focused tests for edge cases, missing data, and business guardrails.
6. Wire the UI only after the model is stable.
7. Run validation commands before moving on.

Verification commands:

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run validate:financial`
- `npm.cmd run validate:forecast`
- targeted `eslint` for touched files

## Design Tradeoff Rule

Every architecture addition must pay for its complexity. Add a database, cache, queue, service, Python job, or new dependency only when it solves a concrete scaling, correctness, reliability, or maintainability problem.
