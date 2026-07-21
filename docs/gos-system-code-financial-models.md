# GOS System, Code, Financial Models And Formulas

Ce document est la carte technique complete du systeme GOS / Profit First.
Il complete:

- `docs/system-design-best-practices.md` pour les regles d'architecture.
- `docs/profit-system-modeling.md` pour les invariants de modelisation.
- `docs/gos-input-source-guide.md` pour savoir quoi saisir dans chaque ecran.

Objectif: comprendre le code, le systeme, les modeles financiers, les formules
utilisees et la facon dont tout s'interlink pour produire un plan d'action
client.

## 1. Role Du Systeme

GOS est un systeme d'exploitation pour piloter la croissance rentable de
clients ecommerce. Il ne sert pas seulement a afficher des KPI. Il transforme
des donnees client, finance, retention, campagnes, stock, creatifs et
objectifs business en:

- une cible de rentabilite a 30 jours;
- un forecast mensuel, hebdomadaire et journalier;
- un plafond de risque media;
- des cibles CAC, MER, ROAS/AMR;
- un plan de spend par jour, canal et campagne;
- un volume creatif requis;
- des alertes stock/SKU;
- des garde-fous avant d'augmenter les budgets;
- une routine AM/media buyer quotidienne, hebdomadaire et mensuelle;
- des rapports client et apprentissages de cycle.

Le principe central est:

```text
source data -> modeles deterministes -> plan profit -> execution -> mesure -> apprentissage -> prochain cycle
```

## 2. Architecture MVC

Le systeme suit une architecture modulaire de type MVC.

### Modeles: `src/gos/*.ts`

Ces fichiers possedent les formules, les moteurs de decision et les sorties
deterministes.

Exemples:

- `profitPlanEngine.ts`
- `profitFirstMediaBuying.ts`
- `spendEfficiencyFrontier.ts`
- `unitEconomicsTargetEngine.ts`
- `threeCohortForecast.ts`
- `channelAllocation.ts`
- `campaignDailyPlan.ts`
- `creativeDemand.ts`
- `dailyGrowthMap.ts`
- `formulas.ts`

Regle: toute formule qui influence une decision business doit vivre ici et
avoir un test.

### Controllers: `src/gos/*Controller.ts`

Ces fichiers lisent/ecrivent Lovable/Supabase Cloud, normalisent les lignes et
construisent les payloads de persistence.

Exemples:

- `profitPlanController.ts`
- `spendingPowerController.ts`
- `customerCohortController.ts`
- `budgetApplicationController.ts`
- `mediaBuyingRuleController.ts`
- `dailyGrowthMapController.ts`

Regle: une page React ne devrait pas reimplementer la logique de persistence
quand un workflow devient critique.

### Views: `src/pages/admin/gos/*.tsx`

Ces fichiers affichent les formulaires, boutons, tableaux et appels aux
controllers/modeles.

Exemples:

- `Dashboard.tsx`
- `GrowthModelSetup.tsx`
- `ProfitFirstWorkspace.tsx`
- `SpendingPower.tsx`
- `BuyerWorkspace.tsx`
- `DailyBudgetPlanner.tsx`
- `BudgetChangeGate.tsx`

Regle: une page peut collecter des inputs, declencher un modele, rendre le
resultat et sauvegarder via controller. Elle ne doit pas devenir le proprietaire
des formules.

### Navigation Et Layout

- Routing GOS: `src/App.tsx`
- Sidebar et modes workflow: `src/gos/GosLayout.tsx`
- Client selectionne et mode sidebar: `src/gos/context.tsx`
- UI primitives GOS: `src/gos/ui.tsx`, `src/gos/tokens.css`

Les deux modes operationnels de sidebar sont:

- `new-client`: onboarding, setup, plan 30 jours, creative foundation, campaign setup.
- `active-client`: execution quotidienne, review hebdo, fin de cycle, creative rescue.

## 3. Backend Et Storage

Le backend operationnel reste Lovable/Supabase Cloud. Les donnees structurees
sont dans PostgreSQL/Supabase. Les sorties derivees et audits sont souvent dans
`model_runs`.

### Source Truth

Ces tables representent des donnees de base ou des entrees humaines/integration.

- `gos_clients`
- `gos_client_members`
- `gos_data_sources`
- `gos_business_contexts`
- `gos_financial_inputs`
- `gos_quantitative_baselines`
- `gos_products`
- `gos_services`
- `gos_inventory_snapshots`
- `gos_capacity_snapshots`
- `gos_basket_economics`
- `gos_customer_transactions`
- `gos_customer_activity_snapshots`
- `gos_campaign_categories`
- `gos_campaigns`
- `gos_campaign_daily_perf`
- `gos_concept_log`
- `gos_creative_briefs`
- `gos_offer_lab`
- `gos_angle_audience_matrix`
- `gos_creative_testing_roadmap`

### Derived Outputs

Ces tables/sorties sont des resultats calcules, auditables ou regenerables.

- `model_runs`
- `gos_profit_plans`
- `gos_profit_plan_months`
- `gos_profit_plan_days`
- `gos_spending_power_snapshots`
- `gos_retention_snapshots`
- `gos_forecasts`
- `gos_metric_targets`
- `gos_weekly_pnl_targets`
- `gos_daily_pnl_targets`
- `gos_forecast_updates`
- `gos_measurement_snapshots`
- `gos_growth_execution_maps`
- `gos_growth_execution_items`
- `gos_live_optimization_reviews`
- `gos_buyer_decisions`
- `gos_media_buying_actions`
- `gos_weekly_executive_reports`
- `gos_learning_entries`
- `gos_next_cycle_plans`

Regle importante: une sortie derivee ne doit pas remplacer la source truth. Si
les inputs changent, on genere un nouveau run au lieu de modifier silencieusement
le passe.

## 4. Flux Principal Du Profit System

### 4.1 Setup Client

Le setup collecte les inputs de base:

```text
client -> integrations/checklist -> configuration modele -> objectifs business
```

Fichiers principaux:

- `GrowthModelSetup.tsx`
- `BusinessObjectives.tsx`
- `ManualChecklist.tsx`
- `DataSources.tsx`
- `Workspace.tsx`

Resultat attendu: le client est suffisamment configure pour lancer les moteurs.

### 4.2 Diagnostic Et Plan Profit

Le systeme identifie le probleme principal et construit un plan.

```text
diagnostic -> event effect -> retention/cohortes -> spending power
-> forecast -> metric targets -> weekly P&L -> daily P&L
-> creative demand -> SKU demand -> campaign setup
```

Fichiers principaux:

- `GrowthDiagnosis.tsx`
- `EventEffect.tsx`
- `Retention.tsx`
- `SpendingPower.tsx`
- `Forecast.tsx`
- `MetricTargets.tsx`
- `WeeklyPnl.tsx`
- `DailyPnl.tsx`
- `CreativeDemand.tsx`
- `SkuDemandPlan.tsx`

### 4.3 Profit Plan Engine

`src/gos/profitPlanEngine.ts` est l'orchestrateur central.

Il compose:

- Profit First Media Buying;
- Spend Efficiency Frontier;
- Unit Economics Target Engine;
- Three-Cohort Forecast;
- Attribution Target Engine;
- Channel Allocation;
- Event Daily Plan;
- Campaign Daily Plan;
- Concept Log Operational Plan;
- Creative Demand;
- daily/weekly rollups.

Output:

- `month`: P&L mensuel et cibles globales.
- `weeks`: decoupage hebdomadaire.
- `days`: execution journaliere.
- `sources`: tous les sous-modeles utilises.
- `missing_data`, `risks`, `conditions`: limites et garde-fous.

Persistence:

- `profitPlanController.ts`
- `gos_profit_plans`
- `gos_profit_plan_months`
- `gos_profit_plan_days`

### 4.4 Execution Active

Une fois le client actif:

```text
daily targets + campaign performance -> daily growth map
-> buyer workspace -> daily budget planner
-> media buying automation -> budget gate/application guard
-> optimization log -> map notes -> daily digest
```

Fichiers principaux:

- `Walkdown.tsx`
- `BuyerWorkspace.tsx`
- `DailyBudgetPlanner.tsx`
- `MediaBuyingAutomation.tsx`
- `BudgetChangeGate.tsx`
- `LiveOptimization.tsx`
- `MapNotes.tsx`
- `DailyDigest.tsx`

### 4.5 Review Et Cycle Suivant

```text
wayfinder wednesday -> measurement -> forecast updates
-> weekly executive report -> learning loop -> next cycle planning
```

Fichiers principaux:

- `WayfinderWednesday.tsx`
- `Measurement.tsx`
- `ForecastUpdates.tsx`
- `WeeklyExecutiveReport.tsx`
- `LearningLoop.tsx`
- `NextCyclePlanning.tsx`

## 5. Catalogue Des Modeles

| Fichier | Role | Sortie principale |
| --- | --- | --- |
| `formulas.ts` | Librairie financiere de base | unit economics, baseline, P&L, SKU, inventory, offer math |
| `forecastProjection.ts` | Forecast simple par scenario | revenue, spend, orders/leads, CAC, MER, gross profit |
| `profitPlanEngine.ts` | Orchestrateur central | plan mensuel/hebdo/journalier + sources |
| `profitFirstMediaBuying.ts` | Contrainte Profit First | spend recommande, cap cash/funnel/LTV, contribution |
| `spendingPowerV2.ts` | Projection spend/CAC/MER | regression OLS, scenarios low/base/high, risk |
| `spendEfficiencyFrontier.ts` | Courbe spend -> AMR | spend recommande par objectif et contribution |
| `unitEconomicsTargetEngine.ts` | Guardrails offre/SKU | break-even CAC, target CAC, AMR/ROAS cible |
| `threeCohortForecast.ts` | Forecast 3 cohortes | new, recent 180d, active non-recent |
| `customerCohorts.ts` | Cohortes transactionnelles | C3 matrix, survival, revenue/gross profit |
| `retentionCohort.ts` | Snapshot retention rapide | quick ratio, repeat behavior, LTV projection |
| `attributionTargetEngine.ts` | Traduction business -> plateformes | platform AMR/CAC/revenue/conversions |
| `channelAllocation.ts` | Allocation par canal | spend par canal, AMR incremental, platform target |
| `campaignDailyPlan.ts` | Plan par campagne/jour | target spend/revenue/conversions par campagne |
| `eventDailyPlan.ts` | Pacing evenementiel | poids journaliers ajustes et normalises |
| `eventEffectV2.ts` | Impact evenement causal | lift attendu/mesure, ITS, diff-in-diff |
| `creativeDemand.ts` | Besoin creatif | creatives/semaine, impressions, fatigue load |
| `conceptLog.ts` | Readiness concepts creatifs | score, spend coverage, concepts prets |
| `dailyTargets.ts` | Decoupage hebdo -> jours | target quotidien avec poids de pacing |
| `weeklyPnlTargets.ts` | Decoupage metric target -> semaines | P&L hebdo et variance |
| `dailyPnlSummary.ts` | Resume daily P&L | totals et sparkline |
| `dailyGrowthMap.ts` | Walkdown execution | 35+ metrics cible/projection/reel |
| `campaignConfiguration.ts` | Setup categories/campaigns | grouping, budget totals, update payload |
| `dailyBudgetPlanner.ts` | Allocation budget quotidienne | ideal budget, status bands, proposed budgets |
| `buyerWorkspace.ts` | Decisions media buyer | CPA/CPL/ROAS/AOV, payload decision |
| `mediaBuyingRuleEngine.ts` | Suggestions automatiques | scale/hold/pause suggestions avec cooldown |
| `profitFirstBudgetChangeGate.ts` | Gate avant augmentation budget | approved/hold/blocked + conditions |
| `budgetApplicationGuard.ts` | Guard avant mutation budget | allow/block/require gate |
| `budgetComplianceMonitor.ts` | Compliance budgets actifs | compliant/watch/breach/no_gate |
| `mediaBuyingActionApplicationGuard.ts` | Guard statut applied | empeche faux applied sans audit budget |
| `projectionAudit.ts` | Historique projection/target lock | payload audit et variance |
| `dataAnalystFoundation.ts` | Readiness data/modeles | score qualite donnees et model card |
| `dataAnalystDecisionBrief.ts` | Handoff statistique -> decision | posture, actions, guardrails |
| `dataAnalystExecutionPlan.ts` | Decision -> work items | clash-code-confirm, owners, due dates |
| `ltvCac.ts` | LTV/CAC predictif | contribution LTV, payback, risk |
| `incrementalityV2.ts` | Incrementalite simple | observed lift/iROAS/significance |
| `forecastBayesianV2.ts` | Forecast probabiliste leger | downside/base/upside |
| `hemrockForecast.ts` | Replica forecast validation | smoke forecast |

## 6. Formules Financieres Principales

Cette section liste les formules presentes ou utilisees par les modeles.
Les noms exacts peuvent varier dans l'UI, mais la logique source vit dans
`src/gos/*`.

### 6.1 Ratios De Base

```text
AOV = revenue / orders
MER = revenue / ad_spend
ROAS = platform_reported_revenue / ad_spend
CAC = ad_spend / new_customers
CPA = spend / orders
CPL = spend / leads
CTR % = clicks / impressions * 100
Gross Profit = revenue - cost_of_delivery
Gross Margin % = gross_profit / revenue
Contribution = gross_profit - ad_spend - extra_variable_costs
Contribution Margin % = contribution / revenue
```

Dans le code:

- `formulas.ts`
- `buyerWorkspace.ts`
- `mediaBuyingRuleEngine.ts`
- `dailyGrowthMap.ts`
- `conceptLog.ts`

### 6.2 Unit Economics

Dans `formulas.ts` et `unitEconomicsTargetEngine.ts`:

```text
payment_fee_per_order = revenue_per_order * payment_fee_rate
refund_reserve_per_order = revenue_per_order * refund_rate
variable_cost_from_rate = revenue_per_order * variable_cost_rate

contribution_before_ads =
  revenue_per_order
  - cogs_per_order
  - shipping_per_order
  - fulfillment_per_order
  - payment_fee_per_order
  - refund_reserve_per_order
  - extra_variable_costs

break_even_cac = contribution_before_ads
target_cac = max(0, contribution_before_ads - desired_contribution_per_order)
target_amr_or_roas = revenue_per_order / target_cac
expected_ad_spend_capacity = target_cac * expected_orders
expected_contribution_after_ads = desired_contribution_per_order * expected_orders
```

Si COGS et gross margin sont manquants, le moteur reste conservateur: il ne
pretend pas qu'un offer est profitable.

### 6.3 Gross-To-Net

Dans `computeGrossToNet`:

```text
net_revenue =
  gross_sales
  - discounts
  - refunds
  - chargebacks
  + shipping_collected
  - taxes_if_included

gross_to_net_gap = (gross_sales - net_revenue) / gross_sales
```

But: eviter de planifier sur du chiffre brut quand le business encaisse moins.

### 6.4 Product Profile

Dans `computeProductProfile`:

```text
cost_of_delivery =
  product_cost
  + landed_cost
  + freight
  + duties
  + shipping
  + pick_pack
  + payment_processing
  + refund_allowance
  + discount_allowance

true_gross_profit = price - cost_of_delivery
true_gross_margin_rate = true_gross_profit / price
break_even_cac = true_gross_profit
break_even_roas = 1 / true_gross_margin_rate
profit_at_target_cac = true_gross_profit - target_cac
```

### 6.5 Basket Economics

Dans `computeBasketEconomics`:

```text
basket_gross_profit = aov - basket_variable_costs
basket_margin_rate = basket_gross_profit / aov
break_even_cac = basket_gross_profit
first_order_profit_at_target = basket_gross_profit - target_cac
```

Cette couche est cruciale pour Spending Power et PFMB.

### 6.6 Offer Economics

Dans `computeOfferEconomics`:

```text
discounted_price = base_price * (1 - discount_percent / 100)

gross_profit_after_offer =
  discounted_price
  - cogs
  - shipping
  - fulfillment
  - gift_cost
  - payment_processing
  - refund_allowance
  - discount_allowance

offer_margin_rate = gross_profit_after_offer / discounted_price
break_even_cac_after_offer = gross_profit_after_offer
break_even_roas_after_offer = 1 / offer_margin_rate
```

Le moteur classe l'offre comme saine, serrée, risquee ou non viable selon la
marge et le CAC possible.

### 6.7 LTGP / CAC

Dans `computeLtgpToCac` et `ltvCac.ts`:

```text
ltgp_to_cac = lifetime_gross_profit_within_window / cac
```

Interpretation:

- ratio bas: acquisition fragile;
- ratio proche du seuil: surveiller payback et cash;
- ratio haut: possible marge de scale si stock/funnel/cash suivent.

### 6.8 P&L Snapshot

Dans `computePnlSnapshot`:

```text
gross_profit = net_revenue - cost_of_delivery
gross_margin_pct = gross_profit / net_revenue
contribution_margin = gross_profit - marketing_expense
MER = net_revenue / marketing_expense
EBITDA = contribution_margin - opex
net_profit = EBITDA - interest
net_profit_pct = net_profit / net_revenue
```

Ce modele sert a verifier si la croissance est vraiment rentable apres couts.

### 6.9 Inventory Grade

Dans `computeInventoryGrade`:

```text
days_on_hand = inventory_units / daily_sales_velocity
cash_locked = inventory_units * unit_cost
retail_value = inventory_units * retail_price
```

Grades:

- A: stock court, risque de rupture;
- B/C: stock correct ou prudent;
- D: stock trop long, cash bloque.

### 6.10 SKU Demand Plan

Dans `computeSkuDemandPlan`:

```text
projected_inventory = available_inventory - forecasted_units
stock_coverage_rate = available_inventory / forecasted_units
```

Le modele indique si on peut pousser un SKU, le limiter, ou le bloquer en paid.

## 7. Spending Power Et Profit First Media Buying

### 7.1 Spending Power V1

Dans `spendingPowerV2.ts`:

```text
runway_months = cash_available / monthly_burn
cash_budget = (cash_available - monthly_burn * safety_months) / safety_months
margin_supported_spend = burn / ((gross_margin_pct / 100) * target_mer) * 1.5
max_monthly_ad_spend = min(cash_budget, margin_supported_spend)
recommended_monthly_ad_spend = max_monthly_ad_spend * 0.7
```

V1 est un fallback rapide. Il ne remplace pas PFMB.

### 7.2 Spending Power V2

Dans `runSpendingPowerV2`:

```text
CAC(spend) = slope_cac * spend + intercept_cac
MER(spend) = slope_mer * spend + intercept_mer
```

Le modele utilise OLS simple sur l'historique spend/CAC/MER, puis produit:

- projected CAC low/base/high;
- projected MER low/base/high;
- spend recommended low/base/high;
- risk LOW/MEDIUM/HIGH;
- backtest leave-one-out quand possible.

Si l'historique est insuffisant, il baisse la confiance et conserve des caps
plus prudents.

### 7.3 Spend Efficiency Frontier

Dans `spendEfficiencyFrontier.ts`:

```text
AMR = new_customer_revenue / spend
predicted_amr = intercept + slope * log(spend)
new_customer_revenue = spend * predicted_amr
contribution_before_ads = new_customer_revenue * contribution_margin_rate
first_order_contribution = contribution_before_ads - spend
lifetime_revenue = new_customer_revenue * ltv_revenue_multiplier
lifetime_contribution = lifetime_revenue * contribution_margin_rate - spend
break_even_amr = 1 / contribution_margin_rate
```

Objectifs supportes:

- maximiser contribution first-order;
- maximiser contribution lifetime;
- maximiser new-customer revenue avec seuil de contribution;
- respecter un custom spend tout en montrant le risque.

### 7.4 Profit First Media Buying

Dans `profitFirstMediaBuying.ts`:

```text
first_order_contribution = aov_new * gross_margin_rate
repeat_order_contribution = aov_repeat * gross_margin_rate - cac_repeat

ltv_horizon =
  first_order_contribution
  + sum_survival_cycles(repeat_order_contribution)

max_orders_by_funnel = monthly_sessions * conversion_rate
incremental_sessions = planned_spend * sessions_per_dollar
max_orders_by_spend = incremental_sessions * conversion_rate
planned_orders = min(max_orders_by_spend, max_orders_by_funnel)

cash_locked_inventory = daily_revenue_estimate * cogs_rate * inventory_days
cash_locked_payout = daily_revenue_estimate * payout_delay_days
effective_cash =
  cash_available
  - monthly_burn * safety_months
  - cash_locked_inventory
  - cash_locked_payout

cash_capped_spend = effective_cash / safety_months

contribution_new = planned_new_customers * first_order_contribution - planned_spend
contribution_repeat = planned_repeat_orders * repeat_order_contribution
contribution_total = contribution_new + contribution_repeat

recommended_spend = min(
  planned_spend,
  cash_cap,
  funnel_cap,
  regression_cap
)
```

PFMB est le moteur qui dit: "combien peut-on depenser sans casser la marge, le
cash, le funnel ou le stock".

## 8. Forecast Et Cohortes

### 8.1 Forecast Projection Simple

Dans `forecastProjection.ts`, pour ecommerce:

```text
orders = spend / cost_per_order
revenue = orders * aov
gross_profit = revenue * gross_margin
cac = spend / new_customers
mer = revenue / spend
```

Pour local/service:

```text
leads = spend / cpl
jobs = leads * close_rate
revenue = jobs * avg_job_value
gross_profit = revenue * gross_margin
```

### 8.2 Customer Cohorts

Dans `customerCohorts.ts`:

```text
acquisition_date = first(transaction_date) by customer_id
cohort_period = month/week/quarter(acquisition_date)
transaction_age = transaction_period - cohort_period
survival_rate = active_customers_at_age / acquired_customers_in_cohort
revenue_by_age = sum(revenue) by cohort_period and age
gross_profit_by_age = sum(gross_profit) by cohort_period and age
```

Regles:

- la cohorte ecommerce est basee sur le premier achat;
- la survival compte des clients uniques, pas des commandes;
- les transactions normalisees viennent de `gos_customer_transactions`.

### 8.3 Three-Cohort Forecast

Dans `threeCohortForecast.ts`:

```text
new_customer_revenue = planned_new_customers * planned_new_customer_aov

recently_acquired_180d =
  repeat revenue historique des clients acquis dans les 180 derniers jours,
  scale au nombre de jours du plan

active_non_recent =
  repeat revenue historique des clients plus anciens encore actifs,
  scale au nombre de jours du plan

projected_revenue =
  new_customer_revenue
  + recently_acquired_180d_projected_revenue
  + active_non_recent_projected_revenue

projected_gross_profit =
  projected_revenue * gross_margin_rate
  ou gross_profit transactionnel si complet

projected_contribution_margin = projected_gross_profit - planned_ad_spend
```

Ce modele evite de melanger revenu new customer et revenu returning customer.

### 8.4 Retention Cohort V2

Dans `retentionCohort.ts`:

- derive l'activite client;
- produit retention, repeat behavior et quick ratio;
- alimente le forecast par la partie revenue "previsible".

La page `Retention.tsx` est la source operationnelle pour retention/cohortes.

## 9. Daily, Weekly Et Event Pacing

### 9.1 Weekly P&L

Dans `weeklyPnlTargets.ts`:

```text
weekly_target = monthly_target / number_of_weeks
variance_pct = (actual - target) / target * 100
```

Les restes d'arrondi sont redistribues pour conserver le total.

### 9.2 Daily Targets

Dans `dailyTargets.ts`:

```text
daily_weight_normalized = day_weight / sum(week_day_weights)
daily_target = weekly_target * daily_weight_normalized
variance_pct = (actual - target) / target * 100
```

Presets:

- uniform;
- ecommerce B2C;
- B2B weekday.

### 9.3 Event Daily Plan

Dans `eventDailyPlan.ts`:

```text
base_weight = day_of_week_weight
event_multiplier = 1 + expected_lift_pct / 100
shoulder_multiplier = 1 + (expected_lift_pct * shoulder_pct / 10000)
final_weight = base_weight * event_or_shoulder_multiplier
normalized_weight = final_weight / sum(final_weights)
daily_target = monthly_total * normalized_weight
```

Le modele preserve les totaux mensuels. Il change la distribution par jour, pas
le total du mois.

### 9.4 Event Effect V2

Dans `eventEffectV2.ts`:

Planned event:

```text
expected_lift = daily_baseline_revenue * duration_days * expected_lift_pct
```

Measured event:

```text
pre_mean = mean(pre_event_revenue)
post_mean = mean(post_event_revenue)
observed_lift = post_mean - pre_mean
```

Avec serie controle:

```text
diff_in_diff =
  (test_post - test_pre) - (control_post - control_pre)
```

## 10. Attribution, Channels Et Campaign Plan

### 10.1 Attribution Target Engine

Dans `attributionTargetEngine.ts`:

```text
multiplier =
  click_window_multiplier
  * delayed_attribution_multiplier
  * click_only_view_through_exclusion_multiplier

platform_target_amr = business_target_amr * multiplier
platform_target_cac = business_target_cac / multiplier
business_revenue_target = planned_spend * business_target_amr
platform_revenue_target = planned_spend * platform_target_amr
business_new_customer_target = planned_spend / business_target_cac
platform_conversion_target = business_new_customer_target * multiplier
```

But: traduire une cible business en cible lisible dans Meta/Google sans
confondre attribution plateforme et impact reel.

### 10.2 Channel Allocation

Dans `channelAllocation.ts`:

```text
allocation_basis =
  explicit planned_spend
  ou allocation_weight
  ou expected_amr * incrementality_factor
  ou equal_weight

allocated_spend = planned_ad_spend * allocation_basis / sum(allocation_basis)

incremental_target_amr = business_target_amr * incrementality_factor
required_platform_amr = business_target_amr / incrementality_factor
required_platform_cac = business_target_cac * incrementality_factor
incremental_revenue_target = allocated_spend * incremental_target_amr
platform_revenue_required = allocated_spend * required_platform_amr
incremental_new_customer_target = allocated_spend / business_target_cac
platform_conversion_required = allocated_spend / required_platform_cac
```

Le moteur signale le risque si un canal concentre trop de spend.

### 10.3 Campaign Daily Plan

Dans `campaignDailyPlan.ts`:

```text
campaign_allocation_basis =
  campaign.planned_spend
  ou campaign.allocation_weight
  ou campaign.current_daily_budget
  ou equal_weight

campaign_monthly_target_spend =
  channel_allocated_spend * campaign_share

campaign_daily_target_spend =
  campaign_monthly_target_spend * daily_pacing_weight

daily_platform_revenue_required =
  campaign_daily_target_spend * required_platform_amr

daily_incremental_revenue_target =
  campaign_daily_target_spend * incremental_target_amr

daily_platform_conversions_required =
  campaign_daily_target_spend / required_platform_cac
```

Si un canal n'a aucune campagne active, le systeme cree un placeholder
"unassigned" pour ne pas perdre le spend planifie.

## 11. Creative, Offers Et Concept Log

### 11.1 Creative Demand

Dans `creativeDemand.ts`:

```text
impressions_per_week = weekly_spend / avg_cpm * 1000
demand_creatives = ceil(impressions_per_week / fatigue_threshold_impressions)
creatives_per_week_needed = max(minimum_creatives, demand_creatives)
fatigue_load_pct =
  impressions_per_week / (fatigue_threshold_impressions * creatives_per_week_needed)
```

Le besoin est ensuite reparti par mix:

```text
static_creatives = creatives_total * static_mix
video_creatives = creatives_total * video_mix
ugc_creatives = reste
```

### 11.2 Concept Log Operational Plan

Dans `conceptLog.ts`:

```text
cpa = spend / orders
ctr_pct = clicks / impressions * 100
roas = revenue / spend
expected_period_spend = expected_daily_spend * active_days_in_period
spend_coverage_rate = expected_period_spend / planned_monthly_spend
readiness_score = 100 - missing_fields * 10 - warnings * 3
```

Champs importants pour qu'un concept soit pret:

- concept name;
- offer;
- landing page;
- primary copy;
- expected daily spend;
- ads per concept;
- bid strategy et cost cap;
- campaign link quand live.

## 12. Daily Execution Et Budget Guards

### 12.1 Daily Growth Map

Dans `dailyGrowthMap.ts`, le systeme construit un arbre de walkdown:

```text
contribution margin
  -> revenue
  -> ad spend
  -> AMR/MER
  -> orders/leads/customers
  -> AOV/CAC/CPA/CPL
  -> channel spend/revenue/conversions
  -> campaign spend/revenue/conversions
```

Formules standard:

```text
remaining_gap = target - actual
projection_gap = projection - actual
variance_vs_target_pct = (actual - target) / abs(target) * 100
variance_vs_projection_pct = (actual - projection) / abs(projection) * 100
```

Le statut depend de la direction:

- higher is better: actual au-dessus de la cible est bon;
- lower is better: actual sous la cible est bon.

### 12.2 Buyer Workspace

Dans `buyerWorkspace.ts`:

```text
campaign_cpa = spend / orders
campaign_cpl = spend / leads
campaign_roas = revenue / spend
campaign_aov = revenue / orders
```

Le systeme compare chaque campagne a la cible CPA de sa categorie et genere un
payload de decision:

- scale;
- hold;
- reduce;
- pause;
- note;
- budget change.

### 12.3 Daily Budget Planner

Dans `dailyBudgetPlanner.ts`:

```text
ideal_daily_budget = target_cpa * 50 / 7
ideal_per_campaign_budget = ideal_daily_budget / active_campaign_count
budget_status =
  under si current < ideal * 0.9
  in_band si current entre 0.9 et 1.1
  over si current > ideal * 1.1
```

La regle `target CPA x 50 / 7` vise a donner assez de signal hebdomadaire a la
campagne pour sortir de l'apprentissage.

### 12.4 Profit First Budget Change Gate

Dans `profitFirstBudgetChangeGate.ts`:

Le gate evalue si une augmentation de budget est acceptable selon:

- proposed monthly spend;
- latest PFMB safe cap;
- cash cap;
- funnel cap;
- contribution;
- net LTV/CAC;
- posture de l'Analyst Execution Plan.

Sorties:

- `APPROVED`;
- `APPROVED_WITH_CONDITIONS`;
- `HOLD`;
- `BLOCKED`.

### 12.5 Budget Application Guard

Dans `budgetApplicationGuard.ts`:

```text
current_daily_total = sum(active_campaign.current_daily_budget)
proposed_daily_total = sum(proposed_campaign.current_daily_budget)
current_monthly_total = current_daily_total * 30.4
proposed_monthly_total = proposed_daily_total * 30.4
delta_monthly = proposed_monthly_total - current_monthly_total
```

Regles:

- decrease/maintain: autorise sans nouveau gate;
- increase: exige un Budget Change Gate;
- bloque si le dernier gate est HOLD/BLOCKED;
- exige nouveau gate si le budget propose depasse la proposition approuvee ou
  le max safe spend.

### 12.6 Budget Compliance Monitor

Dans `budgetComplianceMonitor.ts`:

Compare les budgets actifs actuels avec:

- latest Budget Change Gate;
- latest Budget Application Guard audit;
- max safe spend.

Statuts:

- `COMPLIANT`;
- `WATCH`;
- `BREACH`;
- `NO_GATE`.

### 12.7 Media Buying Rule Engine

Dans `mediaBuyingRuleEngine.ts`:

```text
lookback_rows = campaign_daily_perf in last N days
roas = revenue / spend
cpa = spend / orders
cpl = spend / leads
condition = metric operator threshold
```

Regles:

- skip si metric/source manquante;
- cooldown pour eviter le spam;
- scale_up exige gate;
- si budget compliance non compliant, scale_up est held.

### 12.8 Media Buying Action Application Guard

Dans `mediaBuyingActionApplicationGuard.ts`:

But: empecher de marquer une suggestion comme `applied` si aucune mutation
budget auditee ne prouve que l'action a vraiment ete appliquee.

## 13. Data Analyst Et Python Statistical Layer

La couche Python n'est pas executee dans React. Elle sert aux analyses
statistiques batch.

Script:

- `scripts/data_analyst_statistical_upgrade.py`

Contrat:

```text
engine_version = data_analyst_statistical_upgrade_v1
runtime = python_batch
output -> model_runs
```

Librairies actuelles:

- `pandas`
- `numpy`
- `scipy`

`statsmodels` n'est pas requis actuellement. Il peut etre ajoute plus tard pour
des diagnostics regression plus riches.

### 13.1 Inputs Python

Construits par `dataAnalystStatisticalController.ts`:

- transactions depuis `gos_customer_transactions`;
- daily P&L depuis `gos_daily_pnl_targets`;
- spend history depuis les derniers model runs frontier;
- channel daily depuis `gos_campaign_daily_perf` + `gos_campaigns.platform`;
- source summary pour audit.

### 13.2 Sorties Python

Le script peut produire:

- retention curve fit;
- anomalies P&L;
- spend regression;
- MMM/incrementality context;
- model card;
- risks et limitations.

Regle: ces sorties sont du contexte decisionnel, pas une mutation automatique.
Elles doivent passer par:

```text
Data Analyst Foundation
-> Statistical Analyst
-> Decision Brief
-> Analyst Execution Plan
-> Budget Change Gate
-> Budget Application Guard
```

### 13.3 Clash-Code-Confirm

`dataAnalystExecutionPlan.ts` impose:

```text
clash: challenger la recommandation contre les preuves et contradictions
code: inscrire decision, owner, date, follow-up
confirm: verifier evidence, sign-off et prochaine revue
```

## 14. Reliability, Security Et Audit

### 14.1 Reliability

Le systeme evite de cacher les donnees manquantes:

- `missing_data`
- `risks`
- `conditions`
- `confidence`
- `model_card`

Les modeles doivent signaler une limite au lieu de transformer un champ absent
en zero quand cela changerait la decision.

### 14.2 Security

Les donnees client sont isolees par `client_id`.

Regles attendues:

- auth + authorization/RLS;
- pas de secret frontend;
- mutations critiques via controllers;
- budgets via guards;
- sorties derivees auditees dans `model_runs`;
- source truth separee des outputs.

### 14.3 Budget Audit Trail

Toute mutation de budget importante doit laisser une trace:

```text
budget_change_gate -> model_runs
budget_application_guard -> model_runs
budget_compliance_monitor -> model_runs
media_buying_action_application_guard -> model_runs
```

## 15. Tests Et Validation

Les modeles ont des tests Vitest dans `src/gos/*.test.ts`.

Commandes principales:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run validate:financial
npm.cmd run validate:forecast
npm.cmd run validate:data-analyst
```

Smoke end-to-end ecommerce:

- `scripts/run-ecommerce-profit-system-smoke.ts`

Ce smoke verifie notamment la presence de:

- `profit_plan_engine_v1`
- `profit_first_media_buying_v1`
- `spend_efficiency_frontier_v1`
- `three_cohort_forecast_v1`
- `unit_economics_target_engine_v1`
- `attribution_target_engine_v1`
- `channel_allocation_v1`
- `campaign_daily_plan_v1`
- `concept_log_operational_v1`
- `event_daily_plan_v1`
- `creative_demand_v1`
- `daily_growth_map_v1`

## 16. Comment Tout Produit Le Resultat Final

Le resultat final est un operating plan rentable.

### Etape 1: Base Client

```text
Client + integrations + manual checklist
-> business context
-> financial inputs
-> products/SKU/stock
-> quantitative baseline
-> basket economics
```

Le systeme sait qui est le client, ce qu'il vend, ses marges, son stock, sa
baseline de performance et son economie de panier.

### Etape 2: Objectif Business

```text
business objective
-> primary KPI
-> target value
-> timeline
-> risk appetite
```

Le systeme sait quelle cible viser: profit, croissance, sortie, cash preservation
ou autre.

### Etape 3: Diagnostic

```text
baseline + financial inputs
-> CAC issue / conversion issue / volume issue / margin issue / creative issue
-> severity
-> confidence
```

Le systeme sait ou le compte bloque.

### Etape 4: Risk And Spend Power

```text
cash + burn + margin + spend history + basket economics + funnel capacity
-> max safe spend
-> recommended spend
-> risk level
```

Le systeme sait combien on peut depenser sans casser le client.

### Etape 5: Forecast

```text
new customer plan
+ recent cohort return revenue
+ active non-recent return revenue
+ event/day-of-week pacing
-> monthly/weekly/daily forecast
```

Le systeme sait combien de revenus, orders, gross profit et contribution viser.

### Etape 6: Media Targets

```text
unit economics
-> break-even CAC
-> target CAC
-> target MER/AMR

attribution engine
-> platform CAC/ROAS targets

channel allocation
-> spend/revenue/conversion target by channel

campaign daily plan
-> spend/revenue/conversion target by campaign/day
```

Le systeme transforme la cible business en cibles executables pour le media
buyer.

### Etape 7: Creative And SKU Feasibility

```text
planned weekly spend + CPM + fatigue threshold
-> creatives per week

forecast units + inventory
-> SKU push / watch / hold
```

Le systeme verifie que le client a assez de creatifs et de stock pour executer.

### Etape 8: Daily Execution

```text
daily target + actual performance
-> daily growth map
-> buyer decision
-> budget planner
-> automation suggestions
-> budget gate/application guard
-> map notes
-> daily digest
```

Le systeme dit quoi faire aujourd'hui, pourquoi, avec quel risque, et garde un
audit trail.

### Etape 9: Review And Learning

```text
weekly review + measurement + forecast updates
-> executive report
-> learning loop
-> next cycle plan
```

Le systeme apprend ce qui a marche, ce qui a echoue, et prepare le prochain
cycle.

## 17. Ce Qui N'Est Pas Dans Le Scope Actif

Amazon/new-to-brand n'est pas pertinent pour le scope actuel. Le systeme ne doit
pas ajouter une couche Amazon tant que l'entreprise ne sert pas de clients
Amazon.

Les modeles Python/R avances ne remplacent pas les moteurs deterministes. Ils
ajoutent du contexte statistique, mais les decisions budgetaires passent toujours
par Profit First, gates et guards.

## 18. Regle Pour Ajouter Un Nouveau Modele

Avant d'ajouter un modele:

1. Definir la decision business qu'il permet.
2. Definir les inputs source truth.
3. Definir les outputs derives.
4. Decider TypeScript deterministe ou Python statistique.
5. Ajouter le modele dans `src/gos/*`.
6. Ajouter le controller si persistence necessaire.
7. Ajouter des tests.
8. Ajouter ou mettre a jour la doc.
9. Ne pas dupliquer une formule deja existante.

Si la formule sert une decision quotidienne ou financiere, elle doit etre
testable en dehors de React.
