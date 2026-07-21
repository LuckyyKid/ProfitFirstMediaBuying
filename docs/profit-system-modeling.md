# Profit System Modeling

Read `docs/system-design-best-practices.md` before adding a new modeling layer. That file owns the architecture invariants, MVC rules, and ecommerce cohort interpretation rules.

## TypeScript Runtime Models

Use TypeScript for deterministic calculations that must run in the app:

- Profit First Media Buying constraints: cash, inventory, payout, funnel, contribution, LTV guardrails.
- Spend Efficiency Frontier: AMR curve, contribution math, objective-based spend selection, and extrapolation guardrails.
- Forecast scenario projections: revenue, orders, leads, spend, CAC, MER, ROAS when platform revenue exists, gross profit.
- LTV/CAC preview and persistence.
- Weekly and daily P&L target splitting and variance math.
- Customer cohort preparation and C3 matrices from normalized transactions.
- Data Analyst Foundation readiness: transaction quality, cohort depth, daily P&L coverage, projection coverage, and model-card output.
- Event Effect v2: planned-event lift estimates, interrupted time series, and difference-in-differences when a control series is provided.
- Creative Demand: weekly creative output from planned spend, CPM, fatigue threshold, and format mix.
- Campaign Configuration: campaign/category grouping, active campaign budget totals, target-budget coverage, and guarded current-budget edits.
- Daily Budget Planner: CPA target to ideal daily budget, category allocation, budget status bands, and guarded budget-update payloads.
- Buyer Workspace Daily Decision: manual/integration campaign performance normalization, CPA/CPL/ROAS/AOV, category rollups, and audited buyer-decision payloads.
- Media Buying Rule Evaluation: campaign performance lookback aggregation, ROAS/CPA/CPL/spend rules, cooldown filtering, and budget-compliance scale-up guardrails.
- Media Buying Action Application Guard: validates `applied` status changes against budget application audits for budget-mutating actions.
- Profit Plan Engine: monthly P&L orchestration, new vs returning revenue, recommended spend, unit economics, creative demand, weekly rollup, and daily execution targets.
- Three-Cohort Forecast: new customers, recently acquired 180d, and active non-recent returning revenue from normalized transactions.
- Unit Economics Target Engine: offer/SKU contribution before ads, break-even CAC, target CAC, ROAS/AMR targets, and portfolio-weighted targets.
- Attribution Target Engine: business CAC/AMR targets translated into click-only platform targets by attribution window and delayed attribution multiplier.
- Channel Allocation: planned spend split by channel using explicit spend, allocation weights, or expected incremental efficiency, with incrementality-adjusted targets.
- Campaign Daily Plan: channel allocation split into campaign-level daily spend, platform revenue, incremental revenue, and conversion requirements.
- Event Daily Plan: day-of-week pacing adjusted by planned marketing event multipliers while preserving monthly Profit Plan totals.
- Concept Log Operational Plan: offer, landing page, copy, bid/cost cap, expected daily spend, campaign link, ads per concept, readiness scoring, and expected spend coverage.
- Daily Growth Map: 35+ execution metrics that connect contribution margin, revenue, spend, AMR, volume, pacing, channel, and campaign actuals back to the Profit Plan.

These models live in `src/gos/*` and are tested with Vitest. React pages should not own formulas; they should collect inputs, call a model, render output, and persist validated output.

`decimal.js` is used for money-sensitive calculations where rounding drift would affect business decisions.

## Python / R Modeling Layer

Do not use Python inside the React runtime. Add Python or R as a batch/service layer when the model needs statistics rather than deterministic arithmetic:

- spend-to-efficiency regression with feature selection and confidence intervals;
- retention cohort forecasting and LTV curves;
- advanced event-effect modeling for promotions and launches, including stronger confidence intervals, seasonality, and backtesting;
- outlier detection and backtesting;
- MMM and incrementality.

Recommended Python stack: `pandas`, `numpy`, `scipy`, `statsmodels`, `scikit-learn`.

For production-grade MMM, Meta Robyn is a stronger fit, but it is R-based. A Python service can still own lighter custom models and write outputs back to Supabase.

## Validation Commands

- `npm test`: unit tests for model behavior.
- `npm run build`: production compile.
- `npm run validate:financial`: deterministic financial formula smoke tests.
- `npm run validate:forecast`: Hemrock forecast smoke tests.
- `npm run validate:data-analyst`: Python batch statistical self-test.

## Cohort Data Flow

Spreadsheets are not required. The cohort engine expects normalized transaction rows with only two mandatory fields:

- `customer_id`
- `transaction_date`

Optional fields add business value: `order_id`, `revenue`, `gross_profit`, `acquisition_channel`, `product_key`, `segment_key`, `source`.

Rows can come from integrations or account-manager manual entry. Both should write to `gos_customer_transactions`; the app model then derives:

- transaction week/month/quarter;
- acquisition date per customer;
- acquisition week/month/quarter;
- C3 matrix by acquisition cohort and transaction period;
- survival rate, acquisition pace, retention rate, seasonality diagonals, and segmented cohort views.

`src/pages/admin/gos/Retention.tsx` renders the transaction-driven C3 output and keeps manual transaction entry behind a controller layer (`src/gos/customerCohortController.ts`). Integrations should use the same controller payload shape or write the same normalized columns directly.

## Spend Efficiency Frontier Data Flow

The media-buying transcript requires more than projecting CAC/MER. The system must decide which spend level serves the business objective:

- maximize first-order contribution when repeat purchase is weak or unknown;
- maximize lifetime contribution when LTV is credible;
- maximize new customer revenue only while first-order contribution remains at or above the required threshold;
- honor a custom AM-selected spend while surfacing extrapolation risk.

`src/gos/spendEfficiencyFrontier.ts` owns this deterministic runtime layer. Required source fields are:

- `spend`
- `new_customer_revenue`

Recommended inputs are:

- `contribution_margin_rate` or `gross_margin_rate` or `cost_of_delivery_rate`
- `ltv_revenue_multiplier`
- selected business objective

The model fits a lightweight AMR curve in TypeScript (`new_customer_revenue / spend`) using log-linear diminishing-return behavior when enough history exists. If history is weak or does not show diminishing returns, it falls back to historical average AMR and lowers confidence.

Persist frontier runs through `src/gos/spendEfficiencyFrontierController.ts`, which writes derived outputs to `model_runs`. Do not store this derived frontier as source truth; it can be recomputed from the period history and objective inputs.

`src/pages/admin/gos/SpendingPower.tsx` is the workflow entry point for this layer:

1. the account manager enters period spend, new customer revenue, CAC, and MER;
2. Spending Power v2 still uses spend/CAC/MER for efficiency projection;
3. Spend Efficiency Frontier uses spend/new customer revenue for AMR and contribution decisioning;
4. the selected frontier spend is written back into planned spend;
5. Profit First Media Buying then applies cash, funnel, inventory, payout, and cohort LTV constraints.

`src/pages/admin/gos/PlanningPrediction.tsx` keeps only a quick Spending Power v1 shortcut. It calls `v1Threshold` from `src/gos/spendingPowerV2.ts`, writes the snapshot to `gos_spending_power_snapshots`, and logs the deterministic run to `model_runs`. It must not reimplement spending formulas inline.

Use Python/R later only for the statistical upgrade: confidence intervals, feature selection, seasonality, outlier handling, and backtesting. The current runtime model is deterministic and safe for app execution.

## Profit Plan Engine Data Flow

Profit Plan Engine is the P0 orchestrator for the transcript-driven Profit System. It does not replace the source engines. It composes their deterministic outputs into one monthly and daily operating plan.

`src/gos/profitPlanEngine.ts` owns deterministic runtime orchestration:

- run Profit First Media Buying for cash, inventory, payout, funnel, LTV, and contribution guardrails;
- run Spend Efficiency Frontier when new-customer revenue history is available;
- run customer cohorts from normalized `gos_customer_transactions` rows when available;
- run Creative Demand from planned weekly spend, CPM, fatigue threshold, and mix;
- produce one monthly P&L plan with new-customer revenue, returning revenue, ad spend, gross profit, contribution margin, orders, new customers, returning orders, target CAC, and target MER;
- split the month into weighted daily execution targets and weekly rollups;
- surface missing data and risks instead of failing or hiding gaps as zero.

`src/gos/profitPlanController.ts` owns Supabase persistence:

- writes the full auditable plan to `gos_profit_plans`;
- writes the monthly operating row to `gos_profit_plan_months`;
- writes daily execution rows to `gos_profit_plan_days`;
- keeps insert payloads and row normalizers testable outside React.

The Profit Plan tables store derived, auditable outputs. Source truth remains normalized transactions, financial inputs, spend history, basket economics, campaign data, and saved model runs. If source inputs change, generate a new plan instead of mutating old plan math silently.

Known P0 boundary: this version creates the central orchestration contract. P1/P2 layers should keep enriching the same contract with Concept Log details, Growth Map metrics, and statistical context rather than building parallel planning outputs.

## Three-Cohort Forecast Data Flow

Three-Cohort Forecast is the first P1 layer inside the Profit Plan. It replaces a single blended returning-revenue assumption with three explicit revenue layers:

- `new_customers`: planned acquisition revenue from the Profit Plan acquisition layer;
- `recently_acquired_180d`: repeat revenue from customers acquired within the last 180 days before the plan period;
- `active_non_recent`: repeat revenue from older customers who are still active inside the configured active window.

`src/gos/threeCohortForecast.ts` owns deterministic runtime logic:

- use normalized `CustomerTransaction` rows only;
- ignore transactions on or after `period_start` so future/current-plan data does not leak into the forecast;
- classify lapsed customers outside the active window and exclude them from the base forecast;
- exclude each customer's first purchase from returning-revenue history;
- project returning revenue from trailing repeat revenue scaled to the plan horizon;
- derive gross profit from transaction gross profit when complete, otherwise from gross margin when available;
- surface missing revenue, gross-profit, margin, and transaction data explicitly.

`src/gos/profitPlanEngine.ts` composes this output. When transactions exist, the Profit Plan monthly revenue and daily plan use `three_cohort_forecast.totals` for new vs returning revenue, gross profit, contribution, orders, new customers, and returning orders. When transactions are missing, the plan keeps the P0 fallback and records the missing cohort source.

This layer is still deterministic TypeScript. Python/R can later improve retention curves and confidence intervals, but it should write statistical outputs back as context rather than replacing this runtime contract.

## Unit Economics Target Engine Data Flow

Unit Economics Target Engine is the next P1 layer inside the Profit Plan. It turns offer/SKU economics into executable acquisition guardrails:

- revenue per order from AOV or price;
- COGS from direct COGS when available, otherwise gross margin;
- landed variable costs from shipping, fulfillment, payment fees, refund reserve, and optional variable cost rates;
- contribution before ads per order;
- break-even CAC when contribution after ads can be zero;
- target CAC when required contribution per order or contribution margin is set;
- ROAS/AMR targets from revenue per order divided by allowed CAC;
- portfolio-weighted targets using expected orders, expected revenue mix, or equal offer weighting.

`src/gos/unitEconomicsTargetEngine.ts` owns the deterministic runtime logic. It must not hide missing margin or COGS as profitable output. When COGS and gross margin are both missing, it sets COGS equal to revenue for that offer, records missing data, and keeps CAC targets conservative.

`src/gos/profitPlanEngine.ts` composes this output. When `unit_economics_targets.offers` are provided, Profit Plan `target_cac`, `target_mer`, break-even CAC, and break-even AMR come from the unit-economics portfolio. When offers are missing, the plan keeps the existing Profit First fallback targets and records `unit_economics_targets` as missing data.

This layer remains deterministic TypeScript. Python/R is not needed for the unit-economics formulas; later statistical layers can estimate channel incrementality, attribution delay, or SKU mix, then feed those outputs back into this contract.

## Attribution Target Engine Data Flow

Attribution Target Engine is the click-only media-target translation layer. It does not change the business target. It translates the Profit Plan's business CAC and AMR/ROAS into the numbers a media buyer should expect inside each platform reporting window.

`src/gos/attributionTargetEngine.ts` owns deterministic runtime logic:

- use business target AMR/ROAS and CAC as the source of truth;
- translate 28-day click, 7-day click, or 1-day click reporting into a click-window multiplier;
- apply a delayed-attribution multiplier for in-flight platform reporting;
- exclude view-through revenue when platform reporting includes it;
- return platform target AMR/ROAS, platform target CAC, platform revenue target, and platform conversion target by channel;
- aggregate portfolio targets by planned spend when channel spend is available.

The core formula is:

```text
platform target AMR = business target AMR
  x click-window multiplier
  x delayed-attribution multiplier
  x click-only view-through exclusion multiplier

platform target CAC = business target CAC / same multiplier
```

`src/gos/profitPlanEngine.ts` composes this output. When `attribution_targets.channels` are provided, the Profit Plan stores attribution targets under `sources.attribution_targets`. Monthly business targets remain unchanged; this layer is a read/decision aid for media execution and the later channel/campaign plan.

Amazon/new-to-brand cohorts are out of scope for the current operating model because the business does not currently serve Amazon clients. Do not add an Amazon-specific planning layer unless the business model changes.

## Channel Allocation Data Flow

Channel Allocation is the deterministic bridge between the monthly Profit Plan and channel-level media execution. It allocates planned ad spend across paid channels and translates business targets through manual or model-provided incrementality factors.

`src/gos/channelAllocation.ts` owns deterministic runtime logic:

- allocate planned spend by explicit channel spend, allocation weights, expected incremental efficiency, or equal weight fallback;
- preserve the total planned monthly ad spend after rounding;
- calculate `incremental_target_amr = business_target_amr * incrementality_factor`;
- calculate `required_platform_amr = business_target_amr / incrementality_factor` for platform reporting checks;
- calculate required platform CAC from business CAC and incrementality;
- surface missing incrementality as missing data instead of assuming the channel is fully incremental silently;
- flag concentration risk when one channel exceeds the configured spend-share threshold.

`src/gos/profitPlanEngine.ts` composes this output under `sources.channel_allocation`. If explicit channel allocation inputs are missing but attribution channels exist, the Profit Plan can derive channel allocation rows from attribution targets and still surface missing incrementality. If no channels exist, the layer remains inactive and records `channel_allocation` as missing.

This is still a deterministic planning layer. Future MMM or lift-test work should write incrementality factors back as model context; React pages should not calculate channel incrementality inline.

## Campaign Daily Plan Data Flow

Campaign Daily Plan is the deterministic execution map below Channel Allocation. It turns each channel's monthly allocation into dated campaign-level targets that media buyers can execute against.

`src/gos/campaignDailyPlan.ts` owns deterministic runtime logic:

- match active campaigns to channel allocation rows by channel id, channel name, or platform;
- split each channel's allocated spend across matched campaigns by explicit campaign spend, allocation weight, current daily budget, or equal-weight fallback;
- follow Profit Plan daily pacing so event/day-of-week weights carry through to campaign rows;
- calculate campaign daily target spend, required platform revenue, incremental revenue target, and required platform conversions;
- preserve the total channel and monthly spend after rounding;
- create an auditable unassigned placeholder when a channel has no matched active campaigns, instead of dropping that channel's spend;
- keep this layer advisory only. It does not write campaign budgets or mark media-buying actions applied.

`src/gos/profitPlanEngine.ts` composes this output under `sources.campaign_daily_plan` after daily pacing and channel allocation are available. React pages should display or persist the derived plan through the Profit Plan flow; budget mutation still belongs to Budget Change Gate and Budget Application Guard.

## Event Daily Plan Data Flow

Event Daily Plan is the deterministic calendar injection layer inside the Profit Plan. It adjusts daily execution pacing when planned launches, promos, seasonal moments, or other marketing events are known before the month starts.

`src/gos/eventDailyPlan.ts` owns deterministic runtime logic:

- start from the existing day-of-week weights;
- convert planned event lift or explicit event multipliers into daily pacing multipliers;
- support optional pre-event and post-event shoulder days;
- cap extreme multipliers instead of allowing one event to consume the month;
- normalize final daily weights so monthly revenue, spend, orders, gross profit, and contribution totals are preserved.

`src/gos/profitPlanEngine.ts` composes this output. When `event_daily_plan.events` are provided, daily target rows use event-adjusted weights and the full event source is stored under `sources.event_daily_plan`. When no events are provided, the Profit Plan keeps the existing day-of-week pacing and records the event layer as inactive.

This is not the statistical event-effect layer. `eventEffectV2` measures or estimates event impact. Event Daily Plan consumes planned lift assumptions and turns them into an executable daily target map.

## Event Effect Data Flow

Event Effect follows the marketing-calendar transcript: planned events estimate expected lift from event type, duration, and the 30-day revenue baseline; measured events compare pre/post performance and optionally a control series.

`src/gos/eventEffectV2.ts` owns deterministic runtime math:

- planned-event baseline lift estimates;
- interrupted time series using pre-window mean or trend extrapolation;
- difference-in-differences when both control windows are available;
- p-value approximation, confidence interval, recommendation, risks, and missing-data flags.

`src/gos/eventEffectController.ts` owns Supabase payload mapping and `model_runs` persistence. `src/pages/admin/gos/EventEffect.tsx` should only collect series inputs, call the deterministic model, render the result, and call the controller to save.

Use Python/R later only if the event layer needs richer statistical governance, such as seasonality controls, robust standard errors, synthetic controls, or historical backtests. Do not introduce Python into the React runtime.

## Creative Demand Data Flow

Creative Demand supports the calendars-and-concepts layer from the growth-system transcript. It converts planned media pressure into the weekly number of new concepts/assets needed to avoid creative fatigue.

`src/gos/creativeDemand.ts` owns deterministic runtime math:

- weekly impressions from `weekly_spend / avg_cpm * 1000`;
- concept count from `max(minimum_creatives, ceil(impressions / fatigue_threshold_impressions))`;
- static/video/UGC allocation using the configured mix;
- confidence and missing-data flags.

`src/gos/creativeDemandController.ts` owns persistence into `gos_creative_demand_runs`. `src/pages/admin/gos/CreativeDemand.tsx` should only collect inputs, call the model for preview, render the result, and call the controller to save.

This local GOS calculator is intentionally different from the CRM Edge Function `run-creative-demand`, which scores creative supply risk from concentration, frequency, and recent production. The GOS layer is for planning media-calendar output volume from spend pressure.

## Concept Log Operational Data Flow

Concept Log Operational Plan turns creative ideas into execution-ready campaign inputs. A concept is not ready for the Profit Plan just because it has a name or an angle; it needs the fields a media buyer can actually execute.

`src/gos/conceptLog.ts` owns deterministic runtime logic:

- derived CPA, CTR, ROAS, and AOV metrics from spend, impressions, clicks, orders, and revenue;
- readiness checks for offer, landing page, primary copy, platform, format, audience, hypothesis, expected daily spend, ads per concept, and campaign link when live;
- expected period spend from expected daily spend and active days inside the plan period;
- portfolio coverage: ready concepts, planned ads, expected daily spend, expected period spend, and spend coverage versus planned monthly spend.

`src/gos/conceptLogController.ts` owns Supabase access for `gos_concept_log`. `src/pages/admin/gos/ConceptLog.tsx` must not write Supabase directly; it collects fields, renders readiness, and calls the controller.

`src/gos/profitPlanEngine.ts` composes this output under `sources.concept_log` when Concept Log rows are provided. The layer is advisory and does not mutate campaign budgets or platform campaigns.

The required backend columns are added by `supabase/migrations/20260715103000_enrich_gos_concept_log_operational_fields.sql`. Apply that migration to the active Lovable/Supabase Cloud backend before expecting the new fields to persist.

## Daily Growth Map Data Flow

Daily Growth Map is the operating walkdown layer. It does not create a new plan; it explains whether the latest plan is being executed and which driver is off track.

`src/gos/dailyGrowthMap.ts` owns deterministic runtime logic:

- select the reporting window: MTD, WTD, last 7 days, all, or custom;
- aggregate daily target, projection, and actual P&L rows;
- preserve target, projection, and actual as separate values;
- compute contribution margin, gross profit, revenue, spend, AMR/MER, orders, leads, CAC/CPL, AOV, mix, daily pacing, target gaps, and actual coverage;
- attach channel and campaign metrics from the latest Profit Plan campaign daily plan;
- join buyer-workspace campaign performance actuals by campaign id and date;
- surface missing actual gross profit, new/returning actual splits, selected-period rows, and campaign plan rows instead of hiding them as zero.

`src/gos/dailyGrowthMapController.ts` owns Lovable/Supabase access:

- reads `gos_clients`;
- reads `gos_daily_pnl_targets`;
- reads the latest `gos_profit_plans.output_json`;
- reads bounded `gos_campaign_daily_perf` rows;
- merges Profit Plan daily targets with daily actuals before handing data to the model.

`src/pages/admin/gos/Walkdown.tsx` is now a view-only workflow. It can select scope, refresh, render the hierarchy, and display missing data/risks/conditions. It must not query Supabase directly and must not reimplement contribution, AMR, pacing, or campaign formulas inline.

Amazon/new-to-brand metrics stay out of scope for this project because the business does not currently serve Amazon clients.

## Weekly P&L Target Data Flow

Weekly P&L targets convert a parent metric target into executable weekly operating targets. This is part of the execution layer: every week gets a planned revenue, spend, order/lead, and gross-profit target before daily pacing is generated.

`src/gos/weeklyPnlTargets.ts` owns deterministic runtime math:

- split a parent `gos_metric_targets` row into N weekly rows;
- preserve totals when targets do not divide evenly;
- carry CAC/MER targets as weekly guardrails;
- compute revenue variance from target vs actual.

`src/gos/weeklyPnlController.ts` owns Supabase reads/writes for `gos_weekly_pnl_targets`. `src/pages/admin/gos/WeeklyPnl.tsx` should select the parent target, trigger generation, render rows, and call the controller when actuals are entered.

## Daily P&L Target Data Flow

Daily P&L targets convert one weekly row into seven executable daily targets. This is the live media-buying control layer: each day has a planned revenue, spend, order, and lead target, then account-manager or integration actuals update variance.

`src/gos/dailyTargets.ts` owns deterministic runtime math:

- normalize day-of-week pacing weights;
- split weekly targets across seven days;
- preserve integer metrics with largest-remainder distribution;
- compute daily variance from target vs actual.

`src/gos/dailyPnlSummary.ts` owns deterministic weekly rollup display math:

- target revenue total;
- actual revenue total;
- days with actuals;
- pace delta;
- projected week-end revenue;
- cumulative revenue sparkline points.

`src/gos/dailyPnlController.ts` owns Supabase reads/writes for `gos_weekly_pnl_targets` and `gos_daily_pnl_targets`. New daily rows initialize `projection_*` from `target_*` so later projection/audit workflows do not start from nulls.

`src/pages/admin/gos/DailyPnl.tsx` should select the weekly parent, choose a pacing preset, render the generated ledger, and call the controller when actuals are entered. It must not directly mutate daily/weekly target tables or reimplement pacing/variance/projection formulas.

## Projection And Audit Data Flow

Projection/Audit is the final execution-control layer before data analyst work. It keeps three values separate:

- `target_*`: committed operating target;
- `projection_*`: latest account-manager forecast;
- `actual_*`: realized result from integrations or manual entry.

`target_locked_at` marks when a target is frozen for operating accountability. A locked target should not be silently changed; new expectations should be recorded in `projection_*`.

`src/gos/projectionAudit.ts` owns deterministic runtime helpers:

- allowed daily vs weekly projection fields;
- projection patch normalization;
- target lock/unlock payloads;
- target fallback when a projection is missing;
- actual-vs-projection variance math.

`src/gos/projectionAuditController.ts` owns Supabase reads/writes for:

- daily projection edits on `gos_daily_pnl_targets`;
- weekly projection edits on `gos_weekly_pnl_targets`;
- target lock/unlock updates;
- audit reads from `gos_projection_updates`.

The database trigger `log_projection_changes()` writes `gos_projection_updates` whenever a projection changes or a target is locked/unlocked. React views should display audit logs through the controller rather than manually reconstructing history.

`src/pages/admin/gos/DailyPnl.tsx` now renders Plan / Projection / Actual / Actual-vs-Projection for each daily metric and shows recent projection audit entries for the selected week. This is the first AM-facing projection workflow.

## Data Analyst Foundation Data Flow

Data Analyst Foundation is the readiness gate before statistical analyst work. It does not replace the later Python/R layer; it decides whether the client has enough clean data to justify that layer.

`src/gos/dataAnalystFoundation.ts` owns deterministic runtime checks:

- transaction presence and validity from `customer_id` plus `transaction_date`;
- monthly acquisition cohort depth and age-column depth;
- unique-customer sample size;
- revenue and gross-profit coverage for ecommerce value analysis;
- daily target/projection/actual coverage;
- projection audit recency from `gos_projection_updates`;
- analyst signals and a model card listing inputs, assumptions, limitations, and next statistical upgrades.

`src/gos/dataAnalystFoundationController.ts` owns Supabase reads/writes:

- reads `gos_customer_transactions`;
- reads `gos_daily_pnl_targets`;
- reads `gos_projection_updates`;
- writes compact derived output to `model_runs` under `model_name = data_analyst_foundation`.

`src/pages/admin/gos/DataAnalystFoundation.tsx` is the AM-facing view. It renders score, readiness, data coverage, checks, signals, model card, and saved run history. It should not run formulas inline or reach around the controller for persistence.

Use Python/R only after this layer reports enough readiness for statistical work. The next statistical upgrade can add retention curve fitting, outlier detection, spend-to-efficiency regression, confidence intervals, and backtesting as a batch/service process that writes results back to Supabase.

## Data Analyst Statistical Upgrade Data Flow

The statistical upgrade is a Python batch layer, not a React runtime layer. It starts only after Data Analyst Foundation has enough clean data.

`scripts/data_analyst_statistical_upgrade.py` owns statistical computation:

- monthly acquisition cohort survival fitting with a log-survival curve;
- retention confidence bands from residual variance;
- retention holdout backtest error when enough age periods exist;
- robust P&L anomaly detection from actual-vs-projection residuals;
- log-log spend-to-revenue regression for statistical spend-efficiency context;
- lightweight adstock/ridge MMM for directional channel incrementality context;
- governance diagnostics, library versions, recommendations, and a model card.

The current local stack uses `pandas`, `numpy`, and `scipy`, which are installed in the development environment. `statsmodels` is not required for this version; add it later only if the batch needs richer regression diagnostics. This MMM layer is intentionally lightweight and directional; production-grade MMM or causal incrementality should use stronger tooling such as Robyn, geo tests, or holdout tests.

Expected batch command shape:

```powershell
python scripts\data_analyst_statistical_upgrade.py --input C:\tmp\gos-analyst-input.json --output C:\tmp\gos-analyst-output.json
```

The output JSON must use `engine_version = data_analyst_statistical_upgrade_v1`.

`src/gos/dataAnalystStatisticalController.ts` owns app-side persistence:

- builds the normalized batch input JSON from app data;
- parses and validates the batch JSON contract;
- writes output to `model_runs` under `model_name = data_analyst_statistical_upgrade`;
- reads saved statistical runs for the selected client.

The batch input JSON includes:

- `transactions` from `gos_customer_transactions`;
- `daily_pnl` from `gos_daily_pnl_targets`;
- `spend_history` from the latest `spend_efficiency_frontier` run when available;
- `channel_daily` from `gos_campaign_daily_perf` joined to `gos_campaigns.platform` when campaign performance exists;
- `source_summary` counts for auditability.

`src/pages/admin/gos/DataAnalystStatistical.tsx` is the app-side export, viewer, and save workflow. It displays foundation readiness, builds/downloads the Python input JSON, accepts the Python output JSON, saves the derived output, and renders latest run, retention fit, P&L anomalies, spend regression, MMM incrementality context, model card, and run history.

This layer does not replace deterministic Profit First Media Buying decisions. Use statistical outputs as context beside deterministic spend frontiers, projection audit, cohort/LTV guardrails, channel allocation, and AM review. MMM incrementality factors may inform reviewed channel-allocation assumptions later, but they must not directly mutate budgets or Profit Plans.

End-to-end workflow:

1. Run Data Analyst Foundation.
2. Open Statistical Analyst and click `Build input`.
3. Download or copy the generated JSON into the Python batch input path.
4. Run `python scripts\data_analyst_statistical_upgrade.py --input ... --output ...`.
5. Paste the output JSON into Statistical Analyst.
6. Save output to `model_runs`.
7. Generate the Decision Brief to translate statistical context into AM/media-buying actions.
8. Generate the Analyst Execution Plan to turn the brief into dated work items and guardrail monitors.

## Data Analyst Decision Brief Data Flow

Decision Brief is the operating handoff after statistical analysis. It does not run new statistics and it does not approve spend by itself. It translates the latest Foundation and Statistical runs into posture, actions, guardrails, and risks.

`src/gos/dataAnalystDecisionBrief.ts` owns deterministic decision translation:

- foundation readiness gate;
- critical P&L anomaly gate;
- retention/LTV guardrail;
- spend-regression guardrail;
- channel-incrementality context guardrail from lightweight MMM;
- decision posture selection;
- confidence score and primary decision copy.

`src/gos/dataAnalystDecisionBriefController.ts` owns persistence:

- reads latest `data_analyst_foundation` run;
- reads latest `data_analyst_statistical_upgrade` run;
- writes derived brief output to `model_runs` under `model_name = data_analyst_decision_brief`.

`src/pages/admin/gos/DataAnalystStatistical.tsx` renders the brief directly beside the batch workflow because the brief depends on the saved statistical run. The AM/media buyer should use it to decide whether to hold, maintain, investigate, or proceed to controlled scale, then still verify Profit First contribution, cash, inventory, funnel constraints, and budget gates before changing budget. MMM remains a channel-allocation context signal, not an automatic budget approval.

## Data Analyst Execution Plan Data Flow

Execution Plan is the operating layer after the Decision Brief. It does not run new statistics and it does not change budgets directly. It turns posture, actions, and guardrails into dated work items, owners, escalation rules, and validation checks.

`src/gos/dataAnalystExecutionPlan.ts` owns deterministic execution planning:

- map brief actions into work items;
- generate the explicit clash-code-confirm workflow for each work item;
- assign priority due dates;
- assign phase, owner, and blocked/watch/ready status;
- map brief guardrails into monitor cadence and escalation rules;
- add validation checklist and risks before controlled scale.

`src/gos/dataAnalystExecutionPlanController.ts` owns persistence:

- reads latest `data_analyst_decision_brief` run;
- writes derived plan output to `model_runs` under `model_name = data_analyst_execution_plan`;
- keeps source brief metadata in `input_json` for auditability.

`src/pages/admin/gos/DataAnalystExecutionPlan.tsx` is the AM/media-buyer view. It renders the source brief, latest execution plan, work items, guardrail monitors, validation checklist, risks, and run history. React must not decide due dates, statuses, or guardrail cadence inline.

The clash-code-confirm workflow means:

1. `clash`: challenge the recommendation against source evidence, contradictions, stale runs, and missing data.
2. `code`: write the decision, owner, due date, and follow-up into the operating record.
3. `confirm`: verify evidence, sign-off, and next review before treating the work item as complete or using it in a budget decision.

The system order is now:

1. Foundation readiness.
2. Statistical batch output.
3. Decision Brief.
4. Execution Plan.
5. Budget Change Gate.
6. Profit First constraint check before any material budget change is applied.

## Profit First Budget Change Gate Data Flow

Budget Change Gate is the approval layer between analyst execution planning and campaign-budget changes. It does not apply budgets directly. It evaluates whether a proposed monthly media spend is safe to execute.

`src/gos/profitFirstBudgetChangeGate.ts` owns deterministic gate logic:

- validate proposed monthly spend;
- classify increase, decrease, maintain, or unknown;
- compare proposed spend against the latest PFMB safe cap;
- enforce cash cap, funnel cap, contribution, and net LTV/CAC checks;
- enforce Analyst Execution Plan posture before increases;
- return decision, required approval, conditions, risks, and model-card-style checks.

`src/gos/profitFirstBudgetChangeGateController.ts` owns source reads and persistence:

- reads active campaign daily budgets from `gos_campaigns`;
- reads latest `profit_first_media_buying` run from `model_runs`;
- reads latest `data_analyst_execution_plan` run;
- writes derived gate output to `model_runs` under `model_name = profit_first_budget_change_gate`.

`src/pages/admin/gos/BudgetChangeGate.tsx` is the AM/media-buyer approval view. It renders current campaign budget source, latest Profit First source, latest execution source, proposed spend, gate checks, conditions, risks, and run history.

Daily Budget Planner and Buyer Workspace can propose or apply budget changes, but material increases should pass this gate first. The gate output is derived and auditable; source truth remains campaign budgets, PFMB inputs, and analyst execution runs.

## Campaign Configuration Data Flow

Campaign Configuration is the source setup layer for media buying. It owns campaign categories, campaign metadata, target CPA, target daily category budgets, active flags, platform labels, and external campaign IDs.

`src/gos/campaignConfiguration.ts` owns deterministic runtime logic:

- campaign and category draft normalization;
- optional numeric input parsing without hiding missing values as zero;
- campaign grouping by category and unassigned bucket;
- active campaign budget totals;
- target-budget coverage percentage and under/in-band/over status;
- guarded campaign-budget update payloads.

`src/gos/campaignConfigurationController.ts` owns Supabase reads/writes:

- reads `gos_clients` for selected-client sync;
- reads/writes `gos_campaign_categories`;
- reads/writes `gos_campaigns` metadata;
- creates campaigns with requested initial budgets through `budgetApplicationController`;
- updates `gos_campaigns.current_daily_budget` only through `budgetApplicationController`.

`src/pages/admin/gos/CampaignCategories.tsx` is now view-only for this setup workflow. It renders category/campaign rows, calls controller CRUD actions, and uses the model for totals. It must not query Supabase directly or write campaign budgets directly.

## Daily Budget Planner Data Flow

Daily Budget Planner is the campaign-budget allocation layer. It applies the playbook rule `target CPA x 50 / 7` to estimate the minimum daily budget required to create enough weekly conversion signal for platform learning.

`src/gos/dailyBudgetPlanner.ts` owns deterministic runtime logic:

- ideal daily budget from target CPA;
- current-vs-ideal status bands;
- active campaign budget totals;
- category-to-campaign grouping, including unassigned campaigns;
- ideal per-campaign allocation for a category;
- normalized budget-update payloads for guarded mutation.

`src/gos/dailyBudgetPlannerController.ts` owns Supabase and mutation side effects:

- reads `gos_campaign_categories`;
- reads `gos_campaigns`;
- applies a single campaign budget through `budgetApplicationController`;
- applies category-wide ideal allocation through `budgetApplicationController`;
- never writes `gos_campaigns.current_daily_budget` directly.

`src/pages/admin/gos/DailyBudgetPlanner.tsx` is now view-only. It renders category plans from the model and triggers controller actions. It must not query Supabase directly, call Budget Application Guard directly, or reimplement ideal budget/status/allocation formulas inline.

## Budget Application Guard Data Flow

Budget Application Guard is the final mutation guard before campaign budgets are written. It is separate from Budget Change Gate:

- Budget Change Gate evaluates whether a proposed total spend is safe.
- Budget Application Guard checks that an actual campaign-budget update is covered by the latest gate before mutating `gos_campaigns.current_daily_budget`.

`src/gos/budgetApplicationGuard.ts` owns deterministic mutation checks:

- calculate current and proposed daily/monthly totals from active campaigns;
- classify increase, decrease, or maintain;
- allow decreases and maintains without a gate;
- require a Budget Change Gate for increases;
- block increases when the latest gate is `BLOCKED` or `HOLD`;
- require a new gate when the actual proposed total exceeds the gated proposal or safe cap.

`src/gos/budgetApplicationController.ts` owns guarded writes:

- reads current campaign budgets;
- reads latest `profit_first_budget_change_gate` run;
- evaluates the guard;
- writes an audit run to `model_runs` under `model_name = budget_application_guard`;
- updates `gos_campaigns.current_daily_budget` only when the guard returns `ALLOW` or `ALLOW_WITH_CONDITIONS`.

`src/pages/admin/gos/DailyBudgetPlanner.tsx` and `src/pages/admin/gos/BuyerWorkspace.tsx` now call this controller for budget mutations. They no longer write campaign budgets directly for budget changes.

`src/pages/admin/gos/BudgetChangeGate.tsx` displays the latest budget-gate history and budget-application audit history together, so the team can compare approved spend proposals with actual campaign-budget writes.

## Budget Compliance Monitor Data Flow

Budget Compliance Monitor is the recurring control layer after gates and budget applications. It checks whether the current active campaign budgets still comply with the latest approved gate and latest application audit.

`src/gos/budgetComplianceMonitor.ts` owns deterministic compliance checks:

- calculate current daily and monthly active campaign budget totals;
- compare current spend to the latest gated proposal;
- compare current spend to the latest max safe spend;
- compare current spend to the latest applied budget-application audit;
- flag rejected application proposals that appear to be live;
- return `COMPLIANT`, `WATCH`, `BREACH`, or `NO_GATE`.

`src/gos/budgetComplianceMonitorController.ts` owns reads and persistence:

- reads current active campaign budgets;
- reads latest `profit_first_budget_change_gate` run;
- reads latest `budget_application_guard` run;
- writes compliance output to `model_runs` under `model_name = budget_compliance_monitor`.

`src/pages/admin/gos/BudgetChangeGate.tsx` runs and displays the monitor. Budget gate, application audit, and compliance history now live together so AMs can see approved intent, actual writes, and current drift.

## Buyer Workspace Daily Decision Data Flow

Buyer Workspace is the AM/media-buyer daily operating surface. It supports the transcript workflow: review yesterday's campaign performance, compare CPA against targets, decide What / So What / Now What, and log an auditable action.

`src/gos/buyerWorkspace.ts` owns deterministic runtime logic:

- normalize missing campaign performance rows for the selected day;
- group active campaigns by campaign category and keep uncategorized campaigns separate;
- compute campaign CPA, CPL, ROAS, AOV, and CPA target bands;
- compute category spend, orders, leads, revenue, CPA, CPL, ROAS, and target bands;
- build buyer-decision payloads from campaign, category, performance, and draft decision state;
- decide whether a logged decision requires a guarded campaign-budget application.

`src/gos/buyerWorkspaceController.ts` owns Supabase reads/writes:

- reads active `gos_campaign_categories`;
- reads active `gos_campaigns`;
- reads `gos_campaign_daily_perf` by selected `perf_date`;
- reads recent `gos_buyer_decisions`;
- upserts manual performance entries;
- logs buyer decisions;
- routes any budget-changing decision through `budgetApplicationController` before inserting the decision.

`src/pages/admin/gos/BuyerWorkspace.tsx` is now view-only for this workflow. It renders the controller/model output, calls the assistant for recommendation copy, and triggers controller actions. It must not query Supabase directly, write buyer decisions directly, write performance rows directly, or reimplement CPA/ROAS/AOV/category formulas inline.

## Media Buying Rule Evaluation Data Flow

Media Buying Rule Evaluation is the daily review layer after budget compliance. It turns campaign performance into auditable media-buying suggestions without applying platform or budget mutations directly.

`src/gos/mediaBuyingRuleEngine.ts` owns deterministic runtime logic:

- aggregate `gos_campaign_daily_perf` by campaign and rule lookback window;
- compute ROAS, CPA, CPL, spend, revenue, orders, and leads;
- treat spend with zero orders/leads as unbounded CPA/CPL for cost guardrails;
- skip metrics whose source fields are unavailable;
- suppress duplicate triggers during rule cooldown windows;
- hold `scale_up` suggestions as alerts when the latest `budget_compliance_monitor` is not `COMPLIANT`;
- annotate any scale-up with the requirement to pass Budget Change Gate before budget writes.

`src/gos/mediaBuyingRuleController.ts` owns reads and persistence:

- reads `gos_media_buying_rules`;
- reads `gos_media_buying_actions` for cooldown history;
- reads active campaign metadata from `gos_campaigns`;
- reads performance from `gos_campaign_daily_perf.perf_date`;
- reads latest `budget_compliance_monitor`;
- writes an auditable run to `model_runs` under `model_name = media_buying_rule_evaluation`;
- writes saved suggestions to `gos_media_buying_actions`.

`src/pages/admin/gos/MediaBuyingAutomation.tsx` now renders the controller/model output only. It no longer owns media-buying formulas, campaign performance aggregation, cooldown logic, or direct action persistence.

This layer remains advisory. Any material budget increase must still flow through:

1. Budget Compliance Monitor review.
2. Media Buying Rule Evaluation suggestion.
3. Budget Change Gate approval.
4. Budget Application Guard mutation.

## Media Buying Action Application Guard Data Flow

Media Buying Action Application Guard is the status-transition control after Media Buying Rule Evaluation. It prevents a budget-mutating suggestion from being marked `applied` unless the actual budget application has already passed the guarded mutation flow.

`src/gos/mediaBuyingActionApplicationGuard.ts` owns deterministic transition checks:

- identify whether an action type requires a campaign-budget mutation (`scale_up`, `scale_down`, `pause`, `increase`, `decrease`);
- match `gos_media_buying_actions.target_name` to a unique campaign;
- find a matching `budget_application_guard` audit after the action was created;
- require the matching audit to have `application.applied = true`;
- verify the action type aligns with the budget application change type;
- block `pause` unless the matching campaign budget update is zero.

`src/gos/mediaBuyingRuleController.ts` owns persistence and mutation:

- reads the action row from `gos_media_buying_actions`;
- reads campaign references from `gos_campaigns`;
- reads budget application audit history from `model_runs`;
- writes every applied-status attempt to `model_runs` under `model_name = media_buying_action_application_guard`;
- updates `gos_media_buying_actions.status` only when the guard returns `ALLOW`.

`src/pages/admin/gos/MediaBuyingAutomation.tsx` calls the guarded controller when an AM/media buyer marks an action as applied. Dismissals remain simple status updates because they do not claim a budget or platform mutation occurred.

The updated order for budget-affecting media actions is:

1. Rule Evaluation creates a suggestion.
2. Budget Change Gate approves the proposed spend when needed.
3. Budget Application Guard applies the campaign-budget change and audits it.
4. Action Application Guard allows the suggestion to be marked `applied`.

## Spending Power / Profit-First Media Buying Data Flow

Spending Power is the core forecast-to-budget bridge. It converts cash, burn, margin, historical spend/CAC/MER, new-customer revenue, basket economics, and expected sessions into a bounded media-buying recommendation.

`src/gos/spendingPowerV2.ts`, `src/gos/spendEfficiencyFrontier.ts`, and `src/gos/profitFirstMediaBuying.ts` own deterministic runtime logic:

- v1 cash and margin threshold fallback;
- v2 OLS spend-to-CAC/MER projection with backtest outputs;
- spend efficiency frontier using new-customer revenue and contribution objectives;
- Profit-First Media Buying constraints across cash, inventory/payout delay, funnel capacity, cohort economics, LTV horizon, and regression spend cap.

`src/gos/spendingPowerController.ts` owns Supabase reads/writes and persistence payloads:

- reads selected client context, latest financial input, spending-power snapshots, and latest basket economics;
- normalizes manual account-manager history rows;
- builds v1 snapshot payloads;
- runs and saves v2 snapshots plus `model_runs` under `model_name = spending_power_engine_v2`;
- runs and saves spend efficiency frontier through the frontier controller;
- builds and saves Profit-First Media Buying runs under `model_name = profit_first_media_buying`.

`src/pages/admin/gos/SpendingPower.tsx` now renders and orchestrates this workflow only. It must not query Supabase directly, insert snapshots directly, insert model runs directly, or reimplement PFMB persistence payloads inline.

The operational PFMB layer remains deterministic TypeScript. Python/R owns statistical upgrades such as the current lightweight MMM/incrementality context, stronger future regression diagnostics, confidence intervals, or outlier-aware backtesting, with outputs persisted back to `model_runs`.
