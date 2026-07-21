# TDIA Growth Operating System — Plan

Nouvelle section admin `/admin/gos` (Growth Operating System) — application interne complète pour AM, inspirée du modèle CTC/Prophit mais 100% TDIA, déterministe, sans LLM dans la logique métier.

## Décision importante — coexistence avec l'existant

Il y a déjà une section `/admin/crm` avec 17 tables `crm_*` (clients, business_context, financial_inputs, quantitative_baselines, forecasts, hypotheses, decision_scores, live_optimization_reviews, learning_library, etc.) et 4 Edge Functions engine (`run-forecast`, `run-decision-scoring`, `run-creative-demand`, `run-metric-targets`) + table `model_runs`.

Le nouveau système demandé **recouvre à 60%** l'existant mais avec :

- un **schéma bien plus large** (30+ tables, business_type e-com vs local service, weekly P&L, event effect, retention cohorts, spending power, measurement, forecast updates, next cycle planning, execution map)
- une **UX de type OS interne** (sidebar globale, workspace client, 21 routes)
- des **engines déterministes** additionnels (event_effect, retention_cohort, spending_power, weekly_pnl, forecast_update, learning_loop, next_cycle_planning, measurement)

Je propose de **construire à côté** dans `/admin/gos` avec des nouvelles tables préfixées `gos_*` (pas de conflit avec `crm_*`), puis en V2 on décide si on migre / fusionne / retire la vieille section CRM. Ça évite de casser ce qui marche déjà.

**À confirmer :**

1. OK pour `/admin/gos` en parallèle de `/admin/crm` (pas de suppression maintenant) ?
2. OK pour tables `gos_*` (aucun conflit avec `crm_*` / `client_progress` / `closed_deals`) ?
3. Auth : je réutilise `useAdminAuth` (mot de passe admin unique) — les rôles ADMIN/AM viendront en V2 quand tu voudras du vrai Supabase Auth multi-users. OK ?

## Phasing (livraison par vagues, pas tout d'un coup)

Impossible de livrer 21 pages + 14 engines + 30 tables en un seul batch propre. Découpage :

### Vague 1 — Fondations (livraison 1)

- Migration `gos_*` core : `gos_clients`, `gos_business_contexts`, `gos_financial_inputs`, `gos_products`, `gos_services`, `gos_inventory_snapshots`, `gos_capacity_snapshots`, `gos_quantitative_baselines`
- Design tokens TDIA (--tdia-blue #006AFF, --tdia-navy #060721, etc.) dans `index.css`
- Layout `GosLayout` avec sidebar groupée (MAIN / CLIENT WORKFLOW / STRATEGY / EXECUTION / SYSTEM)
- Pages : Dashboard, Clients, New Client, Client Workspace, Growth Model Setup (5 blocs : Business Context, Financial Inputs, Products/SKU ou Services, Inventory ou Capacity, Quantitative Baseline)
- Statuts NOT_STARTED / MISSING_INPUTS / READY / APPROVED / ERROR par bloc
- Adaptation e-commerce vs local_service partout via `business_type`

### Vague 2 — Diagnosis + Prediction cockpit

- Tables : `gos_growth_diagnosis_runs`, `gos_marketing_events`, `gos_event_effect_runs`, `gos_customer_cohorts`, `gos_retention_model_runs`, `gos_spending_history`, `gos_spending_power_runs`, `gos_model_runs`
- Edge Functions engines déterministes v1 : `growth-diagnosis`, `event-effect`, `retention-cohort`, `spending-power`
- Pages : Growth Diagnosis, Planning & Prediction cockpit, Event Effect, Retention, Spending Power

### Vague 3 — Forecast + Targets + Creative Demand

- Tables : `gos_forecasts`, `gos_metric_targets`, `gos_weekly_pnl_targets`, `gos_creative_demand_runs`
- Edge Functions : `forecast`, `metric-targets`, `weekly-pnl-targets`, `creative-demand`
- Pages : Forecast, Metric Targets, Weekly P&L Targets, Creative Demand

### Vague 4 — Execution + Live + Measurement

- Tables : `gos_growth_execution_maps`, `gos_growth_execution_items`, `gos_live_optimization_reviews`, `gos_measurement_snapshots`, `gos_measurement_tests`, `gos_forecast_updates`
- Edge Functions : `growth-execution-map`, `live-optimization`, `measurement`, `forecast-update`
- Pages : Growth Execution Map, Live Optimization, Measurement, Forecast Updates

### Vague 5 — Learning + Cycle + Intelligence

- Tables : `gos_learning_entries`, `gos_next_cycle_plans`
- Edge Functions : `learning-loop`, `next-cycle-planning`
- Pages : Learning Loop, Next Cycle Planning, Client Intelligence
- QA checklists internes en docs `.md`

## Règles techniques appliquées partout

- **Deterministic-only** : engines dans Edge Functions TypeScript, formules pures, aucun LLM dans la logique métier
- **model_runs obligatoire** : chaque run d'engine insère une ligne (`model_name`, `model_version`, `input_json`, `output_json`, `formula_used`, `generated_by`, `created_at`) — jamais d'overwrite
- **Confidence + conditions + risks + missing_data** dans chaque output
- **business_type** (`ECOMMERCE` | `LOCAL_SERVICE` | `HYBRID` | `OTHER`) drive les champs affichés et les formules
- **RLS V1** : `authenticated` full access (gate via `useAdminAuth`), `service_role` full — rôles ADMIN/AM en V2
- **GRANTs** sur chaque table publique (authenticated + service_role, jamais anon)
- **Forecast conditionnel** — badge visible partout : "Conditional forecast, not a guarantee"
- **Empty / loading / error states** systématiques (pas de spinner géant, skeletons)
- **Sidebar** : liens client-specific désactivés si aucun client sélectionné (context React `SelectedClientProvider` en session storage)

## Confirmation demandée avant de coder

Réponds à ces 3 points et je démarre **Vague 1** (migration + shell + Dashboard + Clients + New Client + Workspace + Growth Model Setup) :

1. Route `/admin/gos` en parallèle de `/admin/crm` — OK ?
2. Tables préfixées `gos_*` — OK ?
3. Auth admin existant (pas de nouveau système de rôles pour V1) — OK ?

Une fois confirmé, je livre Vague 1 en 1-2 messages : d'abord la migration seule (pour approbation), puis tout le code frontend et le layout.

&nbsp;

Oui, confirme Vague 1 avec ces conditions.

1. Route /admin/gos en parallèle de /admin/crm — OK.

Do not delete or modify the existing /admin/crm section for now. The new GOS should be built as a clean parallel system.

2. Tables prefixed gos_* — OK.

Use gos_* as the source of truth for /admin/gos. Do not mix crm_* and gos_* inside the new GOS UI unless explicitly needed for read-only reference. We will decide later whether to migrate, merge, or retire the old crm_* system.

3. Auth — OK to reuse the existing useAdminAuth for V1.

However, structure the code so we can migrate to Supabase Auth with ADMIN/AM roles in V2. Also make sure any RLS or table access rules are compatible with the current auth approach. Do not create RLS policies that break access if useAdminAuth is not the same as Supabase Auth authenticated users.

Start with Vague 1 only.

Vague 1 scope:

- Migration gos_* core tables only

- TDIA design tokens

- GosLayout with sidebar

- Dashboard

- Clients

- New Client

- Client Workspace

- Growth Model Setup

- Status logic for the 5 setup blocks:

  - Business Context

  - Financial Inputs / Unit Economics

  - Products / SKU or Services

  - Inventory or Capacity

  - Quantitative Baseline

- E-commerce vs Local Service adaptation through business_type

Do not build engines yet.

Do not build Growth Diagnosis yet.

Do not build Forecast, Spending Power, Retention, Event Effect, Measurement, or Learning yet.

Do not add LLM.

Do not add Python.

Before coding frontend, show me the migration SQL for Vague 1 first.

After migration approval, build the frontend pages.