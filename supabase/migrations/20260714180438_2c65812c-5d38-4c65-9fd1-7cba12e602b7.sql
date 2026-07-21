
-- =========================================================================
-- 1. Projection columns on gos_daily_pnl_targets
-- =========================================================================
ALTER TABLE public.gos_daily_pnl_targets
  ADD COLUMN IF NOT EXISTS projection_revenue numeric,
  ADD COLUMN IF NOT EXISTS projection_ad_spend numeric,
  ADD COLUMN IF NOT EXISTS projection_orders numeric,
  ADD COLUMN IF NOT EXISTS projection_leads numeric,
  ADD COLUMN IF NOT EXISTS projection_gross_profit numeric,
  ADD COLUMN IF NOT EXISTS target_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_locked_by uuid,
  ADD COLUMN IF NOT EXISTS projection_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS projection_last_updated_by uuid;

-- =========================================================================
-- 2. Projection columns on gos_weekly_pnl_targets
-- =========================================================================
ALTER TABLE public.gos_weekly_pnl_targets
  ADD COLUMN IF NOT EXISTS projection_revenue numeric,
  ADD COLUMN IF NOT EXISTS projection_ad_spend numeric,
  ADD COLUMN IF NOT EXISTS projection_orders numeric,
  ADD COLUMN IF NOT EXISTS projection_leads numeric,
  ADD COLUMN IF NOT EXISTS projection_gross_profit numeric,
  ADD COLUMN IF NOT EXISTS projection_cac numeric,
  ADD COLUMN IF NOT EXISTS projection_mer numeric,
  ADD COLUMN IF NOT EXISTS target_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_locked_by uuid,
  ADD COLUMN IF NOT EXISTS projection_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS projection_last_updated_by uuid;

-- =========================================================================
-- 3. Audit log table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.gos_projection_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('daily', 'weekly')),
  target_row_id uuid NOT NULL,
  period_date date,
  period_start date,
  period_end date,
  metric_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_type text NOT NULL DEFAULT 'projection_update'
    CHECK (change_type IN ('projection_update', 'target_lock', 'target_unlock')),
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gos_projection_updates_client_date
  ON public.gos_projection_updates (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gos_projection_updates_target_row
  ON public.gos_projection_updates (target_row_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_projection_updates TO authenticated;
GRANT ALL ON public.gos_projection_updates TO service_role;

ALTER TABLE public.gos_projection_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read projection updates"
  ON public.gos_projection_updates FOR SELECT
  TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "Analysts+ can insert projection updates"
  ON public.gos_projection_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_gos_client_role(client_id, 'analyst'::client_member_role)
    OR public.is_global_admin()
  );

CREATE POLICY "Admins can update projection updates"
  ON public.gos_projection_updates FOR UPDATE
  TO authenticated
  USING (
    public.has_gos_client_role(client_id, 'admin'::client_member_role)
    OR public.is_global_admin()
  );

CREATE POLICY "Admins can delete projection updates"
  ON public.gos_projection_updates FOR DELETE
  TO authenticated
  USING (
    public.has_gos_client_role(client_id, 'admin'::client_member_role)
    OR public.is_global_admin()
  );

-- =========================================================================
-- 4. Trigger function: log projection changes automatically
-- =========================================================================
CREATE OR REPLACE FUNCTION public.log_projection_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric text;
  v_old jsonb;
  v_new jsonb;
  v_period_date date;
  v_period_start date;
  v_period_end date;
  v_scope text;
  v_projection_cols text[];
  v_any_changed boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'gos_daily_pnl_targets' THEN
    v_scope := 'daily';
    v_period_date := NEW.target_date;
    v_projection_cols := ARRAY[
      'projection_revenue','projection_ad_spend','projection_orders',
      'projection_leads','projection_gross_profit'
    ];
  ELSE
    v_scope := 'weekly';
    v_period_start := NEW.week_start;
    v_period_end := NEW.week_end;
    v_projection_cols := ARRAY[
      'projection_revenue','projection_ad_spend','projection_orders',
      'projection_leads','projection_gross_profit','projection_cac','projection_mer'
    ];
  END IF;

  FOREACH v_metric IN ARRAY v_projection_cols LOOP
    v_old := to_jsonb(OLD) -> v_metric;
    v_new := to_jsonb(NEW) -> v_metric;
    IF v_old IS DISTINCT FROM v_new THEN
      v_any_changed := true;
      INSERT INTO public.gos_projection_updates (
        client_id, scope, target_row_id,
        period_date, period_start, period_end,
        metric_name, old_value, new_value,
        change_type, updated_by
      ) VALUES (
        NEW.client_id, v_scope, NEW.id,
        v_period_date, v_period_start, v_period_end,
        v_metric, v_old, v_new,
        'projection_update', auth.uid()
      );
    END IF;
  END LOOP;

  IF (OLD.target_locked_at IS NULL AND NEW.target_locked_at IS NOT NULL) THEN
    INSERT INTO public.gos_projection_updates (
      client_id, scope, target_row_id,
      period_date, period_start, period_end,
      metric_name, change_type, updated_by
    ) VALUES (
      NEW.client_id, v_scope, NEW.id,
      v_period_date, v_period_start, v_period_end,
      '__all__', 'target_lock', auth.uid()
    );
  ELSIF (OLD.target_locked_at IS NOT NULL AND NEW.target_locked_at IS NULL) THEN
    INSERT INTO public.gos_projection_updates (
      client_id, scope, target_row_id,
      period_date, period_start, period_end,
      metric_name, change_type, updated_by
    ) VALUES (
      NEW.client_id, v_scope, NEW.id,
      v_period_date, v_period_start, v_period_end,
      '__all__', 'target_unlock', auth.uid()
    );
  END IF;

  IF v_any_changed THEN
    NEW.projection_last_updated_at := now();
    NEW.projection_last_updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_projection_daily ON public.gos_daily_pnl_targets;
CREATE TRIGGER trg_log_projection_daily
  BEFORE UPDATE ON public.gos_daily_pnl_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_projection_changes();

DROP TRIGGER IF EXISTS trg_log_projection_weekly ON public.gos_weekly_pnl_targets;
CREATE TRIGGER trg_log_projection_weekly
  BEFORE UPDATE ON public.gos_weekly_pnl_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_projection_changes();

-- =========================================================================
-- 5. Seed projection_* with current target_* values
-- =========================================================================
UPDATE public.gos_daily_pnl_targets
SET
  projection_revenue = target_revenue,
  projection_ad_spend = target_ad_spend,
  projection_orders = target_orders,
  projection_leads = target_leads,
  projection_gross_profit = target_gross_profit
WHERE projection_revenue IS NULL
  AND projection_ad_spend IS NULL
  AND projection_orders IS NULL;

UPDATE public.gos_weekly_pnl_targets
SET
  projection_revenue = target_revenue,
  projection_ad_spend = target_ad_spend,
  projection_orders = target_orders,
  projection_leads = target_leads,
  projection_gross_profit = target_gross_profit,
  projection_cac = target_cac,
  projection_mer = target_mer
WHERE projection_revenue IS NULL
  AND projection_ad_spend IS NULL
  AND projection_orders IS NULL;
