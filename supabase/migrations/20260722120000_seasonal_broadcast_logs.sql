-- Idempotency logs for the yearly seasonal broadcasts (yearly check-in,
-- Christmas, New Year emails + Christmas gifts Slack reminder).
-- The pg_cron schedules that actually trigger the edge functions must be
-- installed once per environment via supabase/cron/setup_seasonal_crons.sql
-- (they require the project URL and service role key, which don't belong
-- in a versioned migration).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- One row per client × email type × year. Presence of a row = "already sent,
-- do not resend even if the cron re-fires".
CREATE TABLE IF NOT EXISTS public.seasonal_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text NOT NULL,
  recipient_email text NOT NULL,
  type text NOT NULL CHECK (type IN ('yearly_checkin', 'christmas', 'new_year')),
  year smallint NOT NULL,
  status text NOT NULL,
  error text,
  email_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_code, type, year)
);

CREATE INDEX IF NOT EXISTS seasonal_email_sends_type_year
  ON public.seasonal_email_sends (type, year);

GRANT SELECT ON public.seasonal_email_sends TO authenticated;
GRANT ALL ON public.seasonal_email_sends TO service_role;

ALTER TABLE public.seasonal_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasonal_email_sends_admin_read"
  ON public.seasonal_email_sends FOR SELECT TO authenticated
  USING (public.is_global_admin());

-- One row per (Slack reminder type × year).
CREATE TABLE IF NOT EXISTS public.seasonal_slack_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  year smallint NOT NULL,
  channel text NOT NULL,
  client_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, year)
);

GRANT SELECT ON public.seasonal_slack_sends TO authenticated;
GRANT ALL ON public.seasonal_slack_sends TO service_role;

ALTER TABLE public.seasonal_slack_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasonal_slack_sends_admin_read"
  ON public.seasonal_slack_sends FOR SELECT TO authenticated
  USING (public.is_global_admin());
