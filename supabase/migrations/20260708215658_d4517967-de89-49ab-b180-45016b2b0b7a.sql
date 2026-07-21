
-- 1) gos_growth_execution_maps
CREATE TABLE public.gos_growth_execution_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  owner TEXT,
  primary_focus TEXT,
  linked_target_id UUID REFERENCES public.gos_metric_targets(id) ON DELETE SET NULL,
  linked_diagnosis_id UUID REFERENCES public.gos_diagnoses(id) ON DELETE SET NULL,
  summary TEXT,
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_growth_execution_maps TO authenticated;
GRANT ALL ON public.gos_growth_execution_maps TO service_role;
ALTER TABLE public.gos_growth_execution_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_execution_maps" ON public.gos_growth_execution_maps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_exec_maps_updated_at BEFORE UPDATE ON public.gos_growth_execution_maps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_exec_maps_client ON public.gos_growth_execution_maps(client_id, created_at DESC);

-- 2) gos_growth_execution_items
CREATE TABLE public.gos_growth_execution_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES public.gos_growth_execution_maps(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  item_type TEXT,
  priority TEXT DEFAULT 'MEDIUM',
  owner TEXT,
  due_date DATE,
  status TEXT DEFAULT 'TODO',
  estimated_impact TEXT,
  hypothesis TEXT,
  linked_test_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_growth_execution_items TO authenticated;
GRANT ALL ON public.gos_growth_execution_items TO service_role;
ALTER TABLE public.gos_growth_execution_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_execution_items" ON public.gos_growth_execution_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_exec_items_updated_at BEFORE UPDATE ON public.gos_growth_execution_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_exec_items_map ON public.gos_growth_execution_items(map_id);
CREATE INDEX idx_gos_exec_items_client ON public.gos_growth_execution_items(client_id);

-- 3) gos_live_optimization_reviews
CREATE TABLE public.gos_live_optimization_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  period_label TEXT,
  health_verdict TEXT,
  reviewer TEXT,
  actual_revenue NUMERIC,
  actual_ad_spend NUMERIC,
  actual_cac NUMERIC,
  actual_mer NUMERIC,
  variance_vs_target_pct NUMERIC,
  actions_taken JSONB,
  next_actions JSONB,
  alerts JSONB,
  notes TEXT,
  status TEXT DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_live_optimization_reviews TO authenticated;
GRANT ALL ON public.gos_live_optimization_reviews TO service_role;
ALTER TABLE public.gos_live_optimization_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_live_opt" ON public.gos_live_optimization_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_live_opt_updated_at BEFORE UPDATE ON public.gos_live_optimization_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_live_opt_client ON public.gos_live_optimization_reviews(client_id, review_date DESC);

-- 4) gos_measurement_snapshots
CREATE TABLE public.gos_measurement_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  linked_target_id UUID REFERENCES public.gos_metric_targets(id) ON DELETE SET NULL,
  actual_revenue NUMERIC,
  actual_orders INTEGER,
  actual_leads INTEGER,
  actual_ad_spend NUMERIC,
  actual_cac NUMERIC,
  actual_cpl NUMERIC,
  actual_mer NUMERIC,
  actual_roas NUMERIC,
  actual_cvr NUMERIC,
  actual_close_rate NUMERIC,
  actual_gross_profit NUMERIC,
  variance_pct JSONB,
  alert_level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_measurement_snapshots TO authenticated;
GRANT ALL ON public.gos_measurement_snapshots TO service_role;
ALTER TABLE public.gos_measurement_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_measurement" ON public.gos_measurement_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_measurement_updated_at BEFORE UPDATE ON public.gos_measurement_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_measurement_client ON public.gos_measurement_snapshots(client_id, period_start DESC);

-- 5) gos_measurement_tests
CREATE TABLE public.gos_measurement_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_type TEXT,
  hypothesis TEXT,
  variant_a TEXT,
  variant_b TEXT,
  primary_metric TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'PLANNED',
  result TEXT,
  winner TEXT,
  lift_pct NUMERIC,
  confidence NUMERIC,
  learning TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_measurement_tests TO authenticated;
GRANT ALL ON public.gos_measurement_tests TO service_role;
ALTER TABLE public.gos_measurement_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_measurement_tests" ON public.gos_measurement_tests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_measurement_tests_updated_at BEFORE UPDATE ON public.gos_measurement_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_measurement_tests_client ON public.gos_measurement_tests(client_id, start_date DESC);

-- 6) gos_forecast_updates
CREATE TABLE public.gos_forecast_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  parent_forecast_id UUID REFERENCES public.gos_forecasts(id) ON DELETE SET NULL,
  update_reason TEXT,
  triggered_by TEXT,
  previous_revenue NUMERIC,
  updated_revenue NUMERIC,
  previous_ad_spend NUMERIC,
  updated_ad_spend NUMERIC,
  previous_cac NUMERIC,
  updated_cac NUMERIC,
  delta_revenue_pct NUMERIC,
  delta_spend_pct NUMERIC,
  new_confidence NUMERIC,
  assumptions JSONB,
  notes TEXT,
  status TEXT DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_forecast_updates TO authenticated;
GRANT ALL ON public.gos_forecast_updates TO service_role;
ALTER TABLE public.gos_forecast_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_forecast_updates" ON public.gos_forecast_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_forecast_updates_updated_at BEFORE UPDATE ON public.gos_forecast_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_forecast_updates_client ON public.gos_forecast_updates(client_id, created_at DESC);
