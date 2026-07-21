CREATE TABLE IF NOT EXISTS public.gos_retention_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  cohort_month date NOT NULL,
  cohort_size int NOT NULL DEFAULT 0,
  m1_retained int,
  m2_retained int,
  m3_retained int,
  m6_retained int,
  m12_retained int,
  arpu_month numeric,
  gross_margin_pct numeric,
  ltv_predicted numeric,
  ltv_actual numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, cohort_month)
);

CREATE INDEX IF NOT EXISTS gos_retention_cohorts_client_idx
  ON public.gos_retention_cohorts (client_id, cohort_month DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_retention_cohorts TO authenticated;
GRANT ALL ON public.gos_retention_cohorts TO service_role;

ALTER TABLE public.gos_retention_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read cohorts" ON public.gos_retention_cohorts FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert cohorts" ON public.gos_retention_cohorts FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update cohorts" ON public.gos_retention_cohorts FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete cohorts" ON public.gos_retention_cohorts FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_retention_cohorts_updated
  BEFORE UPDATE ON public.gos_retention_cohorts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.gos_lifecycle_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  segment_type text NOT NULL DEFAULT 'custom',
  criteria text,
  customer_count int NOT NULL DEFAULT 0,
  arpu numeric,
  aov numeric,
  frequency_days int,
  churn_risk_pct numeric,
  recommended_channel text,
  recommended_action text,
  priority text NOT NULL DEFAULT 'medium',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gos_lifecycle_segments_client_idx
  ON public.gos_lifecycle_segments (client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_lifecycle_segments TO authenticated;
GRANT ALL ON public.gos_lifecycle_segments TO service_role;

ALTER TABLE public.gos_lifecycle_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read segments" ON public.gos_lifecycle_segments FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert segments" ON public.gos_lifecycle_segments FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update segments" ON public.gos_lifecycle_segments FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete segments" ON public.gos_lifecycle_segments FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_lifecycle_segments_updated
  BEFORE UPDATE ON public.gos_lifecycle_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();