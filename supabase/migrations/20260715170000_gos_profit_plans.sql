CREATE TABLE IF NOT EXISTS public.gos_profit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  engine_version text NOT NULL,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gos_profit_plan_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_plan_id uuid NOT NULL REFERENCES public.gos_profit_plans(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  month_end date NOT NULL,
  planned_revenue numeric NOT NULL DEFAULT 0,
  planned_new_customer_revenue numeric NOT NULL DEFAULT 0,
  planned_returning_revenue numeric NOT NULL DEFAULT 0,
  planned_ad_spend numeric NOT NULL DEFAULT 0,
  planned_orders numeric NOT NULL DEFAULT 0,
  planned_new_customers numeric NOT NULL DEFAULT 0,
  planned_returning_orders numeric NOT NULL DEFAULT 0,
  planned_gross_profit numeric NOT NULL DEFAULT 0,
  planned_contribution_margin numeric NOT NULL DEFAULT 0,
  recommended_spend numeric NOT NULL DEFAULT 0,
  recommended_amr numeric,
  binding_constraint text,
  target_cac numeric,
  target_mer numeric,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profit_plan_id, month_start)
);

CREATE TABLE IF NOT EXISTS public.gos_profit_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_plan_id uuid NOT NULL REFERENCES public.gos_profit_plans(id) ON DELETE CASCADE,
  month_id uuid NOT NULL REFERENCES public.gos_profit_plan_months(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  day_of_week integer NOT NULL,
  day_index integer NOT NULL,
  pacing_weight numeric NOT NULL DEFAULT 0,
  target_revenue numeric NOT NULL DEFAULT 0,
  target_new_customer_revenue numeric NOT NULL DEFAULT 0,
  target_returning_revenue numeric NOT NULL DEFAULT 0,
  target_ad_spend numeric NOT NULL DEFAULT 0,
  target_orders numeric NOT NULL DEFAULT 0,
  target_new_customers numeric NOT NULL DEFAULT 0,
  target_returning_orders numeric NOT NULL DEFAULT 0,
  target_gross_profit numeric NOT NULL DEFAULT 0,
  target_contribution_margin numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PLANNED',
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profit_plan_id, plan_date)
);

CREATE INDEX IF NOT EXISTS gos_profit_plans_client_period_idx
  ON public.gos_profit_plans (client_id, period_start DESC);

CREATE INDEX IF NOT EXISTS gos_profit_plan_months_client_month_idx
  ON public.gos_profit_plan_months (client_id, month_start DESC);

CREATE INDEX IF NOT EXISTS gos_profit_plan_days_client_date_idx
  ON public.gos_profit_plan_days (client_id, plan_date);

CREATE INDEX IF NOT EXISTS gos_profit_plan_days_month_idx
  ON public.gos_profit_plan_days (month_id, plan_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_profit_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_profit_plan_months TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_profit_plan_days TO authenticated;
GRANT ALL ON public.gos_profit_plans TO service_role;
GRANT ALL ON public.gos_profit_plan_months TO service_role;
GRANT ALL ON public.gos_profit_plan_days TO service_role;

ALTER TABLE public.gos_profit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gos_profit_plan_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gos_profit_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read profit plans" ON public.gos_profit_plans FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert profit plans" ON public.gos_profit_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update profit plans" ON public.gos_profit_plans FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete profit plans" ON public.gos_profit_plans FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE POLICY "members read profit plan months" ON public.gos_profit_plan_months FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert profit plan months" ON public.gos_profit_plan_months FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update profit plan months" ON public.gos_profit_plan_months FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete profit plan months" ON public.gos_profit_plan_months FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE POLICY "members read profit plan days" ON public.gos_profit_plan_days FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert profit plan days" ON public.gos_profit_plan_days FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update profit plan days" ON public.gos_profit_plan_days FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete profit plan days" ON public.gos_profit_plan_days FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_gos_profit_plans_updated
  BEFORE UPDATE ON public.gos_profit_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_gos_profit_plan_months_updated
  BEFORE UPDATE ON public.gos_profit_plan_months
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_gos_profit_plan_days_updated
  BEFORE UPDATE ON public.gos_profit_plan_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
