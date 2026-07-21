
CREATE TABLE public.gos_customer_activity_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  new_customers INT DEFAULT 0,
  reactivated_customers INT DEFAULT 0,
  active_customers INT DEFAULT 0,
  lapsed_customers INT DEFAULT 0,
  net_active_customer_change INT,
  quick_ratio NUMERIC,
  retention_quality TEXT,
  backtest_error_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gos_customer_activity_client_month ON public.gos_customer_activity_snapshots(client_id, snapshot_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_customer_activity_snapshots TO anon, authenticated;
GRANT ALL ON public.gos_customer_activity_snapshots TO service_role;

ALTER TABLE public.gos_customer_activity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gos_customer_activity_snapshots_all"
ON public.gos_customer_activity_snapshots
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_gos_customer_activity_snapshots_updated_at
BEFORE UPDATE ON public.gos_customer_activity_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
