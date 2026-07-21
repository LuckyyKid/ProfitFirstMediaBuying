
-- Snapshots de cashflow consolidé (hebdo ou mensuel)
CREATE TABLE public.gos_cashflow_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  granularity text NOT NULL DEFAULT 'weekly' CHECK (granularity IN ('weekly','monthly')),
  opening_cash numeric NOT NULL DEFAULT 0,
  cash_in numeric NOT NULL DEFAULT 0,
  cash_out_cogs numeric NOT NULL DEFAULT 0,
  cash_out_ads numeric NOT NULL DEFAULT 0,
  cash_out_opex numeric NOT NULL DEFAULT 0,
  cash_out_tax numeric NOT NULL DEFAULT 0,
  cash_out_other numeric NOT NULL DEFAULT 0,
  closing_cash numeric GENERATED ALWAYS AS (
    opening_cash + cash_in - cash_out_cogs - cash_out_ads - cash_out_opex - cash_out_tax - cash_out_other
  ) STORED,
  runway_weeks numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_cashflow_snapshots TO authenticated;
GRANT ALL ON public.gos_cashflow_snapshots TO service_role;
ALTER TABLE public.gos_cashflow_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashflow_select" ON public.gos_cashflow_snapshots FOR SELECT TO authenticated
  USING (is_gos_client_member(client_id) OR is_global_admin());
CREATE POLICY "cashflow_insert" ON public.gos_cashflow_snapshots FOR INSERT TO authenticated
  WITH CHECK (has_gos_client_role(client_id, 'analyst') OR is_global_admin());
CREATE POLICY "cashflow_update" ON public.gos_cashflow_snapshots FOR UPDATE TO authenticated
  USING (has_gos_client_role(client_id, 'analyst') OR is_global_admin());
CREATE POLICY "cashflow_delete" ON public.gos_cashflow_snapshots FOR DELETE TO authenticated
  USING (has_gos_client_role(client_id, 'admin') OR is_global_admin());

CREATE TRIGGER tg_gos_cashflow_snapshots_updated
BEFORE UPDATE ON public.gos_cashflow_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cashflow_client_period ON public.gos_cashflow_snapshots(client_id, period_start DESC);

-- Prédictions LTV/CAC consolidées
CREATE TABLE public.gos_ltv_cac_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  horizon_months int NOT NULL DEFAULT 12,
  channel text,
  segment text,
  -- inputs
  new_customers int,
  ad_spend numeric,
  avg_order_value numeric,
  gross_margin_pct numeric,
  repeat_rate_pct numeric,
  purchase_frequency numeric,
  churn_rate_pct numeric,
  -- computed
  cac numeric,
  predicted_ltv numeric,
  ltv_cac_ratio numeric,
  payback_months numeric,
  contribution_margin numeric,
  confidence_score numeric,
  model_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_ltv_cac_predictions TO authenticated;
GRANT ALL ON public.gos_ltv_cac_predictions TO service_role;
ALTER TABLE public.gos_ltv_cac_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ltvcac_select" ON public.gos_ltv_cac_predictions FOR SELECT TO authenticated
  USING (is_gos_client_member(client_id) OR is_global_admin());
CREATE POLICY "ltvcac_insert" ON public.gos_ltv_cac_predictions FOR INSERT TO authenticated
  WITH CHECK (has_gos_client_role(client_id, 'analyst') OR is_global_admin());
CREATE POLICY "ltvcac_update" ON public.gos_ltv_cac_predictions FOR UPDATE TO authenticated
  USING (has_gos_client_role(client_id, 'analyst') OR is_global_admin());
CREATE POLICY "ltvcac_delete" ON public.gos_ltv_cac_predictions FOR DELETE TO authenticated
  USING (has_gos_client_role(client_id, 'admin') OR is_global_admin());

CREATE TRIGGER tg_gos_ltv_cac_predictions_updated
BEFORE UPDATE ON public.gos_ltv_cac_predictions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ltvcac_client_date ON public.gos_ltv_cac_predictions(client_id, snapshot_date DESC);
