
-- Phase 11A.0 — Expanded ecommerce financial model tables

-- 1. gross-to-net snapshots
CREATE TABLE public.gos_gross_to_net_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  gross_revenue NUMERIC,
  discounts NUMERIC,
  refunds NUMERIC,
  chargebacks NUMERIC,
  shipping_collected NUMERIC,
  taxes_collected NUMERIC,
  net_revenue NUMERIC,
  gross_to_net_gap_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_gross_to_net_snapshots TO anon, authenticated;
GRANT ALL ON public.gos_gross_to_net_snapshots TO service_role;
ALTER TABLE public.gos_gross_to_net_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_gross_to_net_all" ON public.gos_gross_to_net_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_g2n_client ON public.gos_gross_to_net_snapshots(client_id);

-- 2. product financial profiles
CREATE TABLE public.gos_product_financial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.gos_products(id) ON DELETE SET NULL,
  sku TEXT,
  price NUMERIC,
  product_cost NUMERIC,
  landed_cost NUMERIC,
  freight_cost NUMERIC,
  duties_tariffs NUMERIC,
  shipping_cost_to_customer NUMERIC,
  pick_pack_cost NUMERIC,
  payment_processing_percent NUMERIC,
  refund_allowance_percent NUMERIC,
  discount_allowance_percent NUMERIC,
  product_margin_percent NUMERIC,
  true_gross_margin_percent NUMERIC,
  contribution_before_cac NUMERIC,
  break_even_cac NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_product_financial_profiles TO anon, authenticated;
GRANT ALL ON public.gos_product_financial_profiles TO service_role;
ALTER TABLE public.gos_product_financial_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_pfp_all" ON public.gos_product_financial_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_pfp_client ON public.gos_product_financial_profiles(client_id);
CREATE TRIGGER trg_gos_pfp_updated BEFORE UPDATE ON public.gos_product_financial_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. basket economics
CREATE TABLE public.gos_basket_economics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  basket_name TEXT,
  avg_order_value NUMERIC,
  avg_units_per_transaction NUMERIC,
  basket_cogs NUMERIC,
  basket_shipping_cost NUMERIC,
  basket_fulfillment_cost NUMERIC,
  basket_payment_processing_cost NUMERIC,
  basket_refund_allowance NUMERIC,
  basket_discount_allowance NUMERIC,
  basket_gross_profit NUMERIC,
  basket_gross_margin_percent NUMERIC,
  break_even_cac NUMERIC,
  target_cac NUMERIC,
  first_order_profit_at_target_cac NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_basket_economics TO anon, authenticated;
GRANT ALL ON public.gos_basket_economics TO service_role;
ALTER TABLE public.gos_basket_economics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_basket_all" ON public.gos_basket_economics FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_basket_client ON public.gos_basket_economics(client_id);
CREATE TRIGGER trg_gos_basket_updated BEFORE UPDATE ON public.gos_basket_economics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. offer economics runs
CREATE TABLE public.gos_offer_economics_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  offer_name TEXT,
  offer_type TEXT,
  base_price NUMERIC,
  discount_percent NUMERIC,
  discounted_price NUMERIC,
  cogs NUMERIC,
  shipping_cost NUMERIC,
  fulfillment_cost NUMERIC,
  gift_cost NUMERIC,
  payment_processing_cost NUMERIC,
  refund_allowance NUMERIC,
  discount_allowance NUMERIC,
  gross_profit_after_offer NUMERIC,
  gross_margin_after_offer_percent NUMERIC,
  break_even_cac_after_offer NUMERIC,
  break_even_roas_after_offer NUMERIC,
  offer_viability TEXT,
  recommendation TEXT,
  model_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_offer_economics_runs TO anon, authenticated;
GRANT ALL ON public.gos_offer_economics_runs TO service_role;
ALTER TABLE public.gos_offer_economics_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_offer_all" ON public.gos_offer_economics_runs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_offer_client ON public.gos_offer_economics_runs(client_id);

-- 5. inventory grade snapshots
CREATE TABLE public.gos_inventory_grade_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.gos_products(id) ON DELETE SET NULL,
  sku TEXT,
  inventory_units NUMERIC,
  daily_sales_velocity NUMERIC,
  days_of_inventory_on_hand NUMERIC,
  inventory_value_at_cost NUMERIC,
  inventory_value_at_retail NUMERIC,
  inventory_grade TEXT,
  cash_locked_in_inventory NUMERIC,
  recommended_media_strategy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_inventory_grade_snapshots TO anon, authenticated;
GRANT ALL ON public.gos_inventory_grade_snapshots TO service_role;
ALTER TABLE public.gos_inventory_grade_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_inv_grade_all" ON public.gos_inventory_grade_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_invgrade_client ON public.gos_inventory_grade_snapshots(client_id);

-- 6. P&L snapshots
CREATE TABLE public.gos_pnl_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  gross_revenue NUMERIC,
  net_revenue NUMERIC,
  cost_of_delivery NUMERIC,
  gross_profit NUMERIC,
  gross_margin_percent NUMERIC,
  marketing_expense NUMERIC,
  marketing_efficiency_ratio NUMERIC,
  contribution_margin NUMERIC,
  contribution_margin_percent NUMERIC,
  opex NUMERIC,
  ebitda NUMERIC,
  interest_expense NUMERIC,
  net_profit NUMERIC,
  net_profit_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_pnl_snapshots TO anon, authenticated;
GRANT ALL ON public.gos_pnl_snapshots TO service_role;
ALTER TABLE public.gos_pnl_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gos_pnl_all" ON public.gos_pnl_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_gos_pnl_client ON public.gos_pnl_snapshots(client_id);
