
-- 1. Extend client_progress with all tracking fields
ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS welcome_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS platforms_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS form_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS founder_scan_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kickoff_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS onboarding_sent_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS deal_value numeric,
  ADD COLUMN IF NOT EXISTS closing_date date,
  ADD COLUMN IF NOT EXISTS closer_name text,
  ADD COLUMN IF NOT EXISTS sales_supervisor text,
  ADD COLUMN IF NOT EXISTS ad_budget numeric,
  ADD COLUMN IF NOT EXISTS already_runs_ads boolean,
  ADD COLUMN IF NOT EXISTS stripe_link text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_amount_paid numeric,
  ADD COLUMN IF NOT EXISTS stripe_amount_expected numeric,
  ADD COLUMN IF NOT EXISTS docusign_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS docusign_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS docusign_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS docusign_pdf_url text,
  ADD COLUMN IF NOT EXISTS kickoff_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS kickoff_meeting_link text,
  ADD COLUMN IF NOT EXISTS kickoff_calendar_link text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS founder_summary jsonb,
  ADD COLUMN IF NOT EXISTS alert_24h_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_48h_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stuck_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_step int DEFAULT 1;

-- 2. Form answers table
CREATE TABLE IF NOT EXISTS public.client_form_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text NOT NULL,
  form_type text NOT NULL,
  section text,
  question_key text NOT NULL,
  question_label text,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_answers_client ON public.client_form_answers(client_code, form_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_form_answers TO anon, authenticated;
GRANT ALL ON public.client_form_answers TO service_role;
ALTER TABLE public.client_form_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read form_answers" ON public.client_form_answers FOR SELECT USING (true);
CREATE POLICY "Public insert form_answers" ON public.client_form_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update form_answers" ON public.client_form_answers FOR UPDATE USING (true) WITH CHECK (true);

-- 3. Platform access table
CREATE TABLE IF NOT EXISTS public.client_platform_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'not_requested',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_code, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_platform_access TO anon, authenticated;
GRANT ALL ON public.client_platform_access TO service_role;
ALTER TABLE public.client_platform_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read platform_access" ON public.client_platform_access FOR SELECT USING (true);
CREATE POLICY "Public insert platform_access" ON public.client_platform_access FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update platform_access" ON public.client_platform_access FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Activity log table
CREATE TABLE IF NOT EXISTS public.client_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text NOT NULL,
  event_type text NOT NULL,
  status text,
  details jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_client ON public.client_activity_log(client_code, created_at DESC);
GRANT SELECT, INSERT ON public.client_activity_log TO anon, authenticated;
GRANT ALL ON public.client_activity_log TO service_role;
ALTER TABLE public.client_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read activity_log" ON public.client_activity_log FOR SELECT USING (true);
CREATE POLICY "Public insert activity_log" ON public.client_activity_log FOR INSERT WITH CHECK (true);

-- 5. Enable realtime on activity_log + new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_form_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_platform_access;

-- 6. Enable pg_cron + pg_net for scheduled alerts
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
