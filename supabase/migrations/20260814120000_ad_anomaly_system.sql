-- ─────────────────────────────────────────────────────────────────────────────
-- KPI ANOMALY ALERT SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds per-client anomaly-check configuration to `meta_dashboard_config` and
-- creates the `ad_anomaly_log` table used for dedup (don't repeat yesterday's
-- alert) and for audit (running incident registry).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Extend meta_dashboard_config with anomaly-check inputs
ALTER TABLE public.meta_dashboard_config
  ADD COLUMN IF NOT EXISTS client_type TEXT
    NOT NULL DEFAULT 'ecom'
    CHECK (client_type IN ('ecom', 'local')),
  ADD COLUMN IF NOT EXISTS daily_budget_planned NUMERIC(12, 2)
    NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS conversion_metric TEXT
    NOT NULL DEFAULT 'purchases'
    CHECK (conversion_metric IN ('purchases', 'leads')),
  ADD COLUMN IF NOT EXISTS target_cpl_or_roas NUMERIC(12, 2)
    NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS anomaly_checks_enabled BOOLEAN
    NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.meta_dashboard_config.client_type IS
  'ecom = ROAS-driven ; local = CPL-driven. Drives check 4 interpretation.';
COMMENT ON COLUMN public.meta_dashboard_config.daily_budget_planned IS
  'Planned daily spend in USD. Feeds checks 1 & 2 (dead spend / off-band spend).';
COMMENT ON COLUMN public.meta_dashboard_config.conversion_metric IS
  'Which Porter column counts as a conversion for this client (purchases | leads).';
COMMENT ON COLUMN public.meta_dashboard_config.target_cpl_or_roas IS
  'CPL target (local, USD) or ROAS target (ecom, ratio). Check 4 flags >50% drift vs 7d.';
COMMENT ON COLUMN public.meta_dashboard_config.anomaly_checks_enabled IS
  'Per-client kill switch. Set FALSE to opt a client out of the daily check.';

-- 2) Anomaly log table (dedup + audit)
CREATE TABLE IF NOT EXISTS public.ad_anomaly_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT NOT NULL,
  check_date DATE NOT NULL,
  anomaly_type TEXT NOT NULL
    CHECK (anomaly_type IN (
      'spend_dead',
      'spend_off_band',
      'tracking_dead',
      'kpi_outlier',
      'data_missing'
    )),
  severity TEXT NOT NULL
    CHECK (severity IN ('S1', 'S2', 'S3')),
  yesterday_value NUMERIC,
  expected_value NUMERIC,
  baseline_value NUMERIC,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  slack_sent BOOLEAN NOT NULL DEFAULT FALSE,
  slack_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_anomaly_log_client_date_idx
  ON public.ad_anomaly_log (client_code, check_date DESC);

CREATE INDEX IF NOT EXISTS ad_anomaly_log_type_client_date_idx
  ON public.ad_anomaly_log (anomaly_type, client_code, check_date DESC);

COMMENT ON TABLE public.ad_anomaly_log IS
  'Daily ad-anomaly audit + dedup. One row per (client, check_date, anomaly_type).';

ALTER TABLE public.ad_anomaly_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy (service_role bypasses RLS, so the edge function
-- always has access — the policy only affects authenticated dashboards).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ad_anomaly_log'
      AND policyname = 'ad_anomaly_log_admin_read'
  ) THEN
    CREATE POLICY ad_anomaly_log_admin_read
      ON public.ad_anomaly_log
      FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;
END $$;
