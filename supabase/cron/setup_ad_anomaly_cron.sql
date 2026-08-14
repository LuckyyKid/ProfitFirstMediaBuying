-- ─────────────────────────────────────────────────────────────────────────────
-- KPI ANOMALY ALERT SYSTEM — pg_cron installer (run once per environment)
-- ─────────────────────────────────────────────────────────────────────────────
-- Schedules the daily check at 11:30 UTC = 06:30 EST (winter) / 07:30 EDT
-- (summer) — always at least 90 min after Porter Metrics refreshes at 5:00 ET,
-- so yesterday's data is guaranteed to be present.
--
-- HOW TO INSTALL
-- 1. Open Supabase → SQL Editor.
-- 2. Replace <SERVICE_ROLE_KEY> with the service_role secret from
--    Settings → API (long JWT starting with eyJ...).
-- 3. Run this file.
-- 4. Verify:  SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ad-anomaly%';
--
-- HOW TO REMOVE
--    SELECT cron.unschedule('ad-anomaly-daily-check');
--
-- HOW TO PAUSE (without unscheduling)
--    UPDATE cron.job SET active = FALSE WHERE jobname = 'ad-anomaly-daily-check';
--    UPDATE cron.job SET active = TRUE  WHERE jobname = 'ad-anomaly-daily-check';
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'ad-anomaly-daily-check',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/check-ad-anomalies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
