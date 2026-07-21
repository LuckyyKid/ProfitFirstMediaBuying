
-- Vague 2: Diagnosis & Prediction tables for Profit First Media Buying

CREATE TABLE public.gos_diagnoses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  problem_type TEXT,
  severity TEXT,
  primary_bottleneck TEXT,
  bottleneck_details JSONB DEFAULT '{}'::jsonb,
  contributing_factors JSONB DEFAULT '[]'::jsonb,
  recommended_focus TEXT,
  confidence_score NUMERIC,
  inputs_snapshot JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_diagnoses TO authenticated, anon;
GRANT ALL ON public.gos_diagnoses TO service_role;
ALTER TABLE public.gos_diagnoses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_diagnoses_all" ON public.gos_diagnoses FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.gos_event_effects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_type TEXT,
  start_date DATE,
  end_date DATE,
  expected_lift_pct NUMERIC,
  expected_revenue_delta NUMERIC,
  confidence TEXT,
  assumptions JSONB DEFAULT '{}'::jsonb,
  actual_revenue_delta NUMERIC,
  actual_lift_pct NUMERIC,
  status TEXT DEFAULT 'PLANNED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_event_effects TO authenticated, anon;
GRANT ALL ON public.gos_event_effects TO service_role;
ALTER TABLE public.gos_event_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_event_effects_all" ON public.gos_event_effects FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.gos_retention_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  new_customers INTEGER,
  returning_customers INTEGER,
  repeat_rate_pct NUMERIC,
  ltv_30d NUMERIC,
  ltv_60d NUMERIC,
  ltv_90d NUMERIC,
  ltv_365d NUMERIC,
  avg_orders_per_customer NUMERIC,
  cohort_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_retention_snapshots TO authenticated, anon;
GRANT ALL ON public.gos_retention_snapshots TO service_role;
ALTER TABLE public.gos_retention_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_retention_snapshots_all" ON public.gos_retention_snapshots FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.gos_spending_power_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_label TEXT,
  cash_available NUMERIC,
  monthly_burn NUMERIC,
  gross_margin_pct NUMERIC,
  target_roas NUMERIC,
  max_monthly_ad_spend NUMERIC,
  recommended_monthly_ad_spend NUMERIC,
  runway_months NUMERIC,
  assumptions JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_spending_power_snapshots TO authenticated, anon;
GRANT ALL ON public.gos_spending_power_snapshots TO service_role;
ALTER TABLE public.gos_spending_power_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_spending_power_snapshots_all" ON public.gos_spending_power_snapshots FOR ALL USING (true) WITH CHECK (true);

-- updated_at triggers
CREATE TRIGGER gos_diagnoses_updated BEFORE UPDATE ON public.gos_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER gos_event_effects_updated BEFORE UPDATE ON public.gos_event_effects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER gos_retention_snapshots_updated BEFORE UPDATE ON public.gos_retention_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER gos_spending_power_snapshots_updated BEFORE UPDATE ON public.gos_spending_power_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
