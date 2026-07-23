-- ─────────────────────────────────────────────────────────────────────────────
-- SEASONAL BROADCAST CRONS — run once per Supabase environment
-- ─────────────────────────────────────────────────────────────────────────────
-- This file installs the 4 pg_cron jobs that trigger the yearly seasonal
-- broadcasts. It lives OUTSIDE `supabase/migrations/` because it embeds the
-- project-specific base URL and service-role key, which must not be checked
-- into version control per-environment.
--
-- HOW TO INSTALL
-- 1. Open Supabase → SQL Editor.
-- 2. Replace <SERVICE_ROLE_KEY> below with the service_role secret from
--    Settings → API (long JWT starting with eyJ...). The project ref
--    'gcgwcjeryahysjwfznww' is already baked into the URLs below.
-- 3. Run the whole file.
-- 4. Verify with:  SELECT jobname, schedule, active FROM cron.job;
--
-- All jobs run at 13:00 UTC ≈ 8:00 America/Toronto (works year-round given
-- Canada's DST — 13 UTC = 8 EST in winter, i.e. exactly when we send).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Dec 1 — Yearly 1:1 check-in email
SELECT cron.schedule(
  'seasonal-yearly-checkin',
  '0 13 1 12 *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/send-seasonal-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('type', 'yearly_checkin')
  ) AS request_id;
  $$
);

-- 2) Dec 1 — Slack reminder to buy Christmas gifts (posted to #head-of-things)
SELECT cron.schedule(
  'seasonal-christmas-gifts-reminder',
  '5 13 1 12 *',  -- 5 minutes after the check-in email, same day
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/notify-christmas-gifts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) Dec 24 — Christmas email (warm, no CTA)
SELECT cron.schedule(
  'seasonal-christmas-email',
  '0 13 24 12 *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/send-seasonal-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('type', 'christmas')
  ) AS request_id;
  $$
);

-- 4) Dec 31 — New Year email
SELECT cron.schedule(
  'seasonal-new-year-email',
  '0 13 31 12 *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/send-seasonal-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('type', 'new_year')
  ) AS request_id;
  $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK / RESCHEDULE
-- ─────────────────────────────────────────────────────────────────────────────
-- To remove a job:
--   SELECT cron.unschedule('seasonal-yearly-checkin');
--
-- To dry-run an email now (no cron, no double-send guard bypass — a client
-- already emailed this year will be skipped):
--   SELECT net.http_post(
--     url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/send-seasonal-email',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body := jsonb_build_object('type','yearly_checkin','dry_run',true)
--   );
