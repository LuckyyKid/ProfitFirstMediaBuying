
-- ============================================================
-- TDIA Growth Operating System — Vague 1 (Foundations)
-- ============================================================

-- Reuse update_updated_at_column() if it exists, create otherwise
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================
-- 1. gos_clients
-- ============================================================
CREATE TABLE public.gos_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  website_url TEXT,
  industry TEXT,
  business_type TEXT NOT NULL DEFAULT 'ECOMMERCE'
    CHECK (business_type IN ('ECOMMERCE','LOCAL_SERVICE','HYBRID','OTHER')),
  current_phase TEXT NOT NULL DEFAULT 'ONBOARDING'
    CHECK (current_phase IN ('ONBOARDING','AUDIT_STRATEGY','CREATIVE','CREATIVE_PRODUCTION','CLIENT_REVIEW_APPROVAL','CAMPAIGN_BUILD','LAUNCH_PREP','LIVE','REPORTING','AT_RISK')),
  risk_level TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (risk_level IN ('UNKNOWN','LOW','MEDIUM','HIGH','CRITICAL')),
  am_owner TEXT,
  main_contact_name TEXT,
  main_contact_email TEXT,
  main_contact_phone TEXT,
  offer_sold TEXT,
  platforms_managed TEXT,
  lead_source TEXT,
  deal_value NUMERIC,
  monthly_retainer NUMERIC,
  closing_date DATE,
  launch_target_date DATE,
  clickup_client_task_url TEXT,
  slack_channel TEXT,
  drive_folder_url TEXT,
  hub_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_clients TO anon, authenticated;
GRANT ALL ON public.gos_clients TO service_role;
ALTER TABLE public.gos_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_clients_all" ON public.gos_clients FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_clients_updated BEFORE UPDATE ON public.gos_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. gos_business_contexts
-- ============================================================
CREATE TABLE public.gos_business_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  goal_lock TEXT,
  three_month_objective TEXT,
  product_to_push TEXT,
  product_to_avoid TEXT,
  target_market TEXT,
  north_star_kpi TEXT,
  business_constraints TEXT,
  operational_constraints TEXT,
  claims_legal_constraints TEXT,
  known_risks TEXT,
  success_definition TEXT,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','MISSING_INPUTS','READY','APPROVED','ERROR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_business_contexts TO anon, authenticated;
GRANT ALL ON public.gos_business_contexts TO service_role;
ALTER TABLE public.gos_business_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_business_contexts_all" ON public.gos_business_contexts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_business_contexts_client ON public.gos_business_contexts(client_id);
CREATE TRIGGER trg_gos_business_contexts_updated BEFORE UPDATE ON public.gos_business_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. gos_financial_inputs
-- ============================================================
CREATE TABLE public.gos_financial_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  business_type TEXT NOT NULL DEFAULT 'ECOMMERCE'
    CHECK (business_type IN ('ECOMMERCE','LOCAL_SERVICE','HYBRID','OTHER')),
  -- ecommerce
  aov NUMERIC,
  gross_margin_percent NUMERIC,
  cogs_per_order NUMERIC,
  shipping_cost_per_order NUMERIC,
  fulfillment_cost_per_order NUMERIC,
  payment_processing_percent NUMERIC,
  refund_rate_percent NUMERIC,
  target_cac NUMERIC,
  target_mer NUMERIC,
  target_roas NUMERIC,
  payback_window_days INTEGER,
  desired_contribution_margin_percent NUMERIC,
  -- local service
  avg_job_value NUMERIC,
  labor_cost NUMERIC,
  material_cost NUMERIC,
  travel_cost NUMERIC,
  target_cpl NUMERIC,
  target_cost_per_booked_appointment NUMERIC,
  target_cost_per_job NUMERIC,
  target_close_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','MISSING_INPUTS','READY','APPROVED','ERROR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_financial_inputs TO anon, authenticated;
GRANT ALL ON public.gos_financial_inputs TO service_role;
ALTER TABLE public.gos_financial_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_financial_inputs_all" ON public.gos_financial_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_financial_inputs_client ON public.gos_financial_inputs(client_id);
CREATE TRIGGER trg_gos_financial_inputs_updated BEFORE UPDATE ON public.gos_financial_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. gos_products (ecommerce)
-- ============================================================
CREATE TABLE public.gos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC,
  product_role TEXT
    CHECK (product_role IS NULL OR product_role IN ('HERO','BUNDLE','SUBSCRIPTION','UPSELL','LOW_MARGIN','HIGH_MARGIN','SEASONAL','DO_NOT_PUSH','TEST_PRODUCT')),
  is_priority BOOLEAN NOT NULL DEFAULT false,
  is_avoid BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_products TO anon, authenticated;
GRANT ALL ON public.gos_products TO service_role;
ALTER TABLE public.gos_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_products_all" ON public.gos_products FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_products_client ON public.gos_products(client_id);
CREATE TRIGGER trg_gos_products_updated BEFORE UPDATE ON public.gos_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. gos_services (local service)
-- ============================================================
CREATE TABLE public.gos_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  avg_price NUMERIC,
  service_role TEXT
    CHECK (service_role IS NULL OR service_role IN ('HERO','UPSELL','LOW_MARGIN','HIGH_MARGIN','SEASONAL','DO_NOT_PUSH','TEST_SERVICE')),
  is_priority BOOLEAN NOT NULL DEFAULT false,
  is_avoid BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_services TO anon, authenticated;
GRANT ALL ON public.gos_services TO service_role;
ALTER TABLE public.gos_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_services_all" ON public.gos_services FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_services_client ON public.gos_services(client_id);
CREATE TRIGGER trg_gos_services_updated BEFORE UPDATE ON public.gos_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. gos_inventory_snapshots
-- ============================================================
CREATE TABLE public.gos_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.gos_products(id) ON DELETE SET NULL,
  available_stock NUMERIC,
  reserved_stock NUMERIC,
  daily_sales_velocity NUMERIC,
  estimated_restock_date DATE,
  inventory_risk TEXT
    CHECK (inventory_risk IS NULL OR inventory_risk IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  safe_to_scale BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_inventory_snapshots TO anon, authenticated;
GRANT ALL ON public.gos_inventory_snapshots TO service_role;
ALTER TABLE public.gos_inventory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_inventory_snapshots_all" ON public.gos_inventory_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_inventory_snapshots_client ON public.gos_inventory_snapshots(client_id);

-- ============================================================
-- 7. gos_capacity_snapshots
-- ============================================================
CREATE TABLE public.gos_capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.gos_services(id) ON DELETE SET NULL,
  weekly_capacity NUMERIC,
  current_booked_capacity NUMERIC,
  team_availability TEXT,
  response_time_minutes NUMERIC,
  capacity_risk TEXT
    CHECK (capacity_risk IS NULL OR capacity_risk IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  safe_to_scale BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_capacity_snapshots TO anon, authenticated;
GRANT ALL ON public.gos_capacity_snapshots TO service_role;
ALTER TABLE public.gos_capacity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_capacity_snapshots_all" ON public.gos_capacity_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_capacity_snapshots_client ON public.gos_capacity_snapshots(client_id);

-- ============================================================
-- 8. gos_quantitative_baselines
-- ============================================================
CREATE TABLE public.gos_quantitative_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  business_type TEXT NOT NULL DEFAULT 'ECOMMERCE'
    CHECK (business_type IN ('ECOMMERCE','LOCAL_SERVICE','HYBRID','OTHER')),
  -- ecommerce
  revenue_30d NUMERIC,
  ad_spend_30d NUMERIC,
  mer_30d NUMERIC,
  cac_30d NUMERIC,
  roas_30d NUMERIC,
  aov_30d NUMERIC,
  cvr_30d NUMERIC,
  atc_rate_30d NUMERIC,
  checkout_rate_30d NUMERIC,
  orders_30d NUMERIC,
  new_customers_30d NUMERIC,
  returning_customers_30d NUMERIC,
  returning_revenue_30d NUMERIC,
  top3_ads_spend_share_percent NUMERIC,
  avg_frequency NUMERIC,
  new_creatives_last_30d NUMERIC,
  active_ads_count NUMERIC,
  -- local service
  leads_30d NUMERIC,
  qualified_leads_30d NUMERIC,
  booked_appointments_30d NUMERIC,
  jobs_closed_30d NUMERIC,
  cpl_30d NUMERIC,
  cost_per_booked_appointment NUMERIC,
  cost_per_job NUMERIC,
  show_rate NUMERIC,
  close_rate NUMERIC,
  avg_job_value NUMERIC,
  response_time_minutes NUMERIC,
  missed_call_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','MISSING_INPUTS','READY','APPROVED','ERROR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_quantitative_baselines TO anon, authenticated;
GRANT ALL ON public.gos_quantitative_baselines TO service_role;
ALTER TABLE public.gos_quantitative_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_quantitative_baselines_all" ON public.gos_quantitative_baselines FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_quantitative_baselines_client ON public.gos_quantitative_baselines(client_id);
CREATE TRIGGER trg_gos_quantitative_baselines_updated BEFORE UPDATE ON public.gos_quantitative_baselines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
