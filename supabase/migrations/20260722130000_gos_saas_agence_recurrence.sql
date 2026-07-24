-- Wave 12A — Add SAAS and AGENCE business types to the GOS enum, and extend
-- gos_financial_inputs / gos_quantitative_baselines with the recurrence
-- columns those two types need (ARPA, churn, retainer, hourly rate, etc).
-- Applied atomically so downstream RLS/policies stay valid.
--
-- Rationale: the earlier design only modelled transactional businesses
-- (ecom) and one-off service jobs (local_service). SaaS and agencies live
-- on recurring revenue, so the diagnostic/forecast layer needs canonical
-- inputs: monthly recurring revenue drivers + retention.
--
-- Migration is idempotent: CHECK swaps are wrapped in DROP IF EXISTS, and
-- new columns use ADD COLUMN IF NOT EXISTS so a partial replay is safe.

-- ============================================================
-- 1. Extend business_type CHECK constraints
-- ============================================================
ALTER TABLE public.gos_clients
  DROP CONSTRAINT IF EXISTS gos_clients_business_type_check;
ALTER TABLE public.gos_clients
  ADD CONSTRAINT gos_clients_business_type_check
    CHECK (business_type IN ('ECOMMERCE','LOCAL_SERVICE','SAAS','AGENCE','HYBRID','OTHER'));

ALTER TABLE public.gos_financial_inputs
  DROP CONSTRAINT IF EXISTS gos_financial_inputs_business_type_check;
ALTER TABLE public.gos_financial_inputs
  ADD CONSTRAINT gos_financial_inputs_business_type_check
    CHECK (business_type IN ('ECOMMERCE','LOCAL_SERVICE','SAAS','AGENCE','HYBRID','OTHER'));

ALTER TABLE public.gos_quantitative_baselines
  DROP CONSTRAINT IF EXISTS gos_quantitative_baselines_business_type_check;
ALTER TABLE public.gos_quantitative_baselines
  ADD CONSTRAINT gos_quantitative_baselines_business_type_check
    CHECK (business_type IN ('ECOMMERCE','LOCAL_SERVICE','SAAS','AGENCE','HYBRID','OTHER'));

-- (gos_business_contexts has no business_type column in the live schema —
--  the enum lives on gos_clients and gets joined, so no CHECK needed here.)

-- ============================================================
-- 2. Recurrence unit economics on gos_financial_inputs
-- ============================================================
ALTER TABLE public.gos_financial_inputs
  ADD COLUMN IF NOT EXISTS arpa                     NUMERIC, -- SaaS: Average Revenue Per Account (monthly)
  ADD COLUMN IF NOT EXISTS churn_monthly_pct        NUMERIC, -- % of paying customers lost per month
  ADD COLUMN IF NOT EXISTS trial_to_paid_pct        NUMERIC, -- SaaS: signup → paying conversion
  ADD COLUMN IF NOT EXISTS onboarding_cost          NUMERIC, -- SaaS: one-off delivery cost per new logo
  ADD COLUMN IF NOT EXISTS cac_payback_months       NUMERIC, -- how many months of ARPA to recover CAC
  ADD COLUMN IF NOT EXISTS gross_margin_recurring_pct NUMERIC, -- SaaS default ~80%, Agence ~40-60%
  -- Agence-specific
  ADD COLUMN IF NOT EXISTS retainer_monthly         NUMERIC, -- average monthly retainer per client
  ADD COLUMN IF NOT EXISTS hours_delivered_per_month NUMERIC,-- avg billable hours per client per month
  ADD COLUMN IF NOT EXISTS hourly_rate              NUMERIC, -- delivered $/h
  ADD COLUMN IF NOT EXISTS weekly_delivery_capacity NUMERIC, -- total team hours available per week
  ADD COLUMN IF NOT EXISTS discovery_close_rate_pct NUMERIC; -- Agence: discovery call → signed retainer

-- ============================================================
-- 3. Recurrence measurement on gos_quantitative_baselines
-- ============================================================
ALTER TABLE public.gos_quantitative_baselines
  ADD COLUMN IF NOT EXISTS mrr_current              NUMERIC, -- current monthly recurring revenue
  ADD COLUMN IF NOT EXISTS new_mrr_30d              NUMERIC, -- MRR added in last 30d
  ADD COLUMN IF NOT EXISTS churned_mrr_30d          NUMERIC, -- MRR lost in last 30d
  ADD COLUMN IF NOT EXISTS expansion_mrr_30d        NUMERIC, -- upsell / seat expansion
  ADD COLUMN IF NOT EXISTS active_subscriptions     NUMERIC, -- current paying accounts / retainers
  ADD COLUMN IF NOT EXISTS trial_signups_30d        NUMERIC, -- SaaS: trials started
  ADD COLUMN IF NOT EXISTS discovery_calls_30d      NUMERIC, -- Agence: qualified discovery calls
  ADD COLUMN IF NOT EXISTS net_revenue_retention_pct NUMERIC;

COMMENT ON COLUMN public.gos_financial_inputs.arpa
  IS 'SaaS: monthly average revenue per account. Basis for MRR/LTV math.';
COMMENT ON COLUMN public.gos_financial_inputs.retainer_monthly
  IS 'Agence: average monthly retainer per active mandate. Drives MRR forecast.';
COMMENT ON COLUMN public.gos_quantitative_baselines.mrr_current
  IS 'Current MRR (SaaS or Agence). Snapshot metric — the timeseries lives in gos_measurement_snapshots.';
