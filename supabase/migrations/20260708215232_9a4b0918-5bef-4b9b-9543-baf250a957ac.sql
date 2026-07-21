
-- ============================================================
-- GOS Vague 3 — Forecast, Metric Targets, Weekly P&L, Creative Demand
-- ============================================================

-- 1) gos_forecasts
CREATE TABLE public.gos_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL DEFAULT 'BASE', -- BASE | UPSIDE | DOWNSIDE
  horizon_days INTEGER NOT NULL DEFAULT 30,
  period_start DATE,
  period_end DATE,
  projected_revenue NUMERIC,
  projected_orders INTEGER,
  projected_leads INTEGER,
  projected_ad_spend NUMERIC,
  projected_cac NUMERIC,
  projected_mer NUMERIC,
  projected_roas NUMERIC,
  projected_gross_profit NUMERIC,
  confidence NUMERIC,
  assumptions JSONB,
  inputs_snapshot JSONB,
  formula_used TEXT,
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_forecasts TO authenticated;
GRANT ALL ON public.gos_forecasts TO service_role;
ALTER TABLE public.gos_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_forecasts" ON public.gos_forecasts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_forecasts_updated_at BEFORE UPDATE ON public.gos_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_forecasts_client ON public.gos_forecasts(client_id, created_at DESC);

-- 2) gos_metric_targets
CREATE TABLE public.gos_metric_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  target_revenue NUMERIC,
  target_orders INTEGER,
  target_leads INTEGER,
  target_ad_spend NUMERIC,
  target_cac NUMERIC,
  target_cpl NUMERIC,
  target_mer NUMERIC,
  target_roas NUMERIC,
  target_cvr NUMERIC,
  target_close_rate NUMERIC,
  target_aov NUMERIC,
  target_gross_profit NUMERIC,
  derived_from_forecast_id UUID REFERENCES public.gos_forecasts(id) ON DELETE SET NULL,
  assumptions JSONB,
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_metric_targets TO authenticated;
GRANT ALL ON public.gos_metric_targets TO service_role;
ALTER TABLE public.gos_metric_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_metric_targets" ON public.gos_metric_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_metric_targets_updated_at BEFORE UPDATE ON public.gos_metric_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_metric_targets_client ON public.gos_metric_targets(client_id, period_start DESC);

-- 3) gos_weekly_pnl_targets (breakdown hebdo)
CREATE TABLE public.gos_weekly_pnl_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  target_revenue NUMERIC,
  target_ad_spend NUMERIC,
  target_orders INTEGER,
  target_leads INTEGER,
  target_gross_profit NUMERIC,
  target_cac NUMERIC,
  target_mer NUMERIC,
  actual_revenue NUMERIC,
  actual_ad_spend NUMERIC,
  actual_orders INTEGER,
  actual_leads INTEGER,
  actual_gross_profit NUMERIC,
  variance_pct NUMERIC,
  status TEXT DEFAULT 'PLANNED',
  parent_target_id UUID REFERENCES public.gos_metric_targets(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_weekly_pnl_targets TO authenticated;
GRANT ALL ON public.gos_weekly_pnl_targets TO service_role;
ALTER TABLE public.gos_weekly_pnl_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_weekly_pnl_targets" ON public.gos_weekly_pnl_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_weekly_pnl_targets_updated_at BEFORE UPDATE ON public.gos_weekly_pnl_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_weekly_pnl_client_week ON public.gos_weekly_pnl_targets(client_id, week_start);

-- 4) gos_creative_demand_runs
CREATE TABLE public.gos_creative_demand_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  target_ad_spend NUMERIC,
  avg_cpm NUMERIC,
  fatigue_threshold_impressions NUMERIC,
  creatives_per_week_needed INTEGER,
  static_creatives_needed INTEGER,
  video_creatives_needed INTEGER,
  ugc_creatives_needed INTEGER,
  breakdown JSONB,
  assumptions JSONB,
  formula_used TEXT,
  confidence NUMERIC,
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_creative_demand_runs TO authenticated;
GRANT ALL ON public.gos_creative_demand_runs TO service_role;
ALTER TABLE public.gos_creative_demand_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access gos_creative_demand_runs" ON public.gos_creative_demand_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_creative_demand_updated_at BEFORE UPDATE ON public.gos_creative_demand_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gos_creative_demand_client ON public.gos_creative_demand_runs(client_id, created_at DESC);
