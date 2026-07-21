
-- Phase 11A.0.1 — Order Value Distribution / Funnel Economics / SKU Demand / OPEX

-- 1. order value distributions
CREATE TABLE public.gos_order_value_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  business_type TEXT,
  avg_order_value NUMERIC,
  median_order_value NUMERIC,
  modal_order_value NUMERIC,
  min_order_value NUMERIC,
  max_order_value NUMERIC,
  bucket_size NUMERIC,
  buckets_json JSONB,
  top_bucket_min NUMERIC,
  top_bucket_max NUMERIC,
  top_bucket_order_count INTEGER,
  top_bucket_order_percent NUMERIC,
  long_tail_risk TEXT,
  cac_target_risk TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_order_value_distributions TO anon, authenticated;
GRANT ALL ON public.gos_order_value_distributions TO service_role;
ALTER TABLE public.gos_order_value_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_ovd_all" ON public.gos_order_value_distributions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_ovd_client ON public.gos_order_value_distributions(client_id);

-- 2. funnel economics
CREATE TABLE public.gos_funnel_economics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  funnel_name TEXT,
  funnel_type TEXT,
  primary_product_id UUID REFERENCES public.gos_products(id) ON DELETE SET NULL,
  primary_sku TEXT,
  expected_order_type TEXT,
  expected_order_value NUMERIC,
  modal_order_value NUMERIC,
  expected_units_per_order NUMERIC,
  expected_gross_profit NUMERIC,
  expected_contribution_before_cac NUMERIC,
  target_cac NUMERIC,
  break_even_cac NUMERIC,
  first_order_profit_at_target_cac NUMERIC,
  expected_product_mix_json JSONB,
  landing_page_url TEXT,
  campaign_name TEXT,
  notes TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_funnel_economics TO anon, authenticated;
GRANT ALL ON public.gos_funnel_economics TO service_role;
ALTER TABLE public.gos_funnel_economics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_funnel_all" ON public.gos_funnel_economics FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_funnel_client ON public.gos_funnel_economics(client_id);
CREATE TRIGGER trg_gos_funnel_updated BEFORE UPDATE ON public.gos_funnel_economics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. sku demand plans
CREATE TABLE public.gos_sku_demand_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  plan_month DATE,
  product_id UUID REFERENCES public.gos_products(id) ON DELETE SET NULL,
  sku TEXT,
  product_name TEXT,
  forecasted_units NUMERIC,
  forecasted_revenue NUMERIC,
  forecasted_gross_profit NUMERIC,
  available_inventory NUMERIC,
  projected_inventory_after_plan NUMERIC,
  inventory_risk TEXT,
  marketing_priority TEXT,
  paid_media_action TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_sku_demand_plans TO anon, authenticated;
GRANT ALL ON public.gos_sku_demand_plans TO service_role;
ALTER TABLE public.gos_sku_demand_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_sku_demand_all" ON public.gos_sku_demand_plans FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_sku_demand_client ON public.gos_sku_demand_plans(client_id);
CREATE TRIGGER trg_gos_sku_demand_updated BEFORE UPDATE ON public.gos_sku_demand_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. opex allocation settings
CREATE TABLE public.gos_opex_allocation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  use_opex_buffer BOOLEAN NOT NULL DEFAULT false,
  opex_buffer_type TEXT NOT NULL DEFAULT 'NONE',
  opex_buffer_percent_of_revenue NUMERIC,
  opex_buffer_per_order NUMERIC,
  opex_fixed_monthly NUMERIC,
  conservative_bootstrap_mode BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_opex_allocation_settings TO anon, authenticated;
GRANT ALL ON public.gos_opex_allocation_settings TO service_role;
ALTER TABLE public.gos_opex_allocation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_opex_alloc_all" ON public.gos_opex_allocation_settings FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_opex_alloc_client ON public.gos_opex_allocation_settings(client_id);
CREATE TRIGGER trg_gos_opex_alloc_updated BEFORE UPDATE ON public.gos_opex_allocation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
