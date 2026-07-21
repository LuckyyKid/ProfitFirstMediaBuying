
CREATE TABLE public.gos_daily_pnl_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  parent_weekly_id UUID REFERENCES public.gos_weekly_pnl_targets(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  day_of_week SMALLINT NOT NULL,
  day_index INT NOT NULL,
  pacing_weight NUMERIC NOT NULL DEFAULT 1,
  target_revenue NUMERIC,
  target_ad_spend NUMERIC,
  target_orders INT,
  target_leads INT,
  target_gross_profit NUMERIC,
  actual_revenue NUMERIC,
  actual_ad_spend NUMERIC,
  actual_orders INT,
  actual_leads INT,
  variance_pct NUMERIC,
  status TEXT DEFAULT 'PLANNED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gos_daily_pnl_client_date ON public.gos_daily_pnl_targets(client_id, target_date);
CREATE INDEX idx_gos_daily_pnl_parent ON public.gos_daily_pnl_targets(parent_weekly_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_daily_pnl_targets TO authenticated;
GRANT ALL ON public.gos_daily_pnl_targets TO service_role;

ALTER TABLE public.gos_daily_pnl_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage gos_daily_pnl_targets"
ON public.gos_daily_pnl_targets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_gos_daily_pnl_targets_updated_at
BEFORE UPDATE ON public.gos_daily_pnl_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
