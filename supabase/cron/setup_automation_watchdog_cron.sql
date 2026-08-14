-- ─────────────────────────────────────────────────────────────────────────────
-- AUTOMATION WATCHDOG — pg_cron installer (run once per environment)
-- ─────────────────────────────────────────────────────────────────────────────
-- Runs daily at 12:00 UTC = 07:00 EST (winter) / 08:00 EDT (summer). This
-- fires ~30 min AFTER the ad-anomaly-daily-check (11:30 UTC), so the anomaly
-- workflow has had a chance to ping "success" before we evaluate its cadence.
--
-- HOW TO INSTALL
-- 1. Open Supabase → SQL Editor.
-- 2. Ensure the service_role secret exists in the vault under the same name
--    used by the anomaly cron ('email_queue_service_role_key'), or replace
--    the SELECT clause with a hardcoded 'Bearer <SERVICE_ROLE_KEY>' string.
-- 3. Run this file.
-- 4. Verify:  SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'automation-watchdog%';
--
-- HOW TO REMOVE
--    SELECT cron.unschedule('automation-watchdog-daily');
--
-- HOW TO PAUSE (without unscheduling)
--    UPDATE cron.job SET active = FALSE WHERE jobname = 'automation-watchdog-daily';
--    UPDATE cron.job SET active = TRUE  WHERE jobname = 'automation-watchdog-daily';
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'automation-watchdog-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/automation-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
