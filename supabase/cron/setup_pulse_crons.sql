-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT PULSE SYSTEM — pg_cron installer (run once per environment)
-- ─────────────────────────────────────────────────────────────────────────────
-- Schedules :
--   pulse-onboarding-j7      → toutes les heures, envoie aux clients à J+7 (± 12h)
--   pulse-monthly            → tous les jours 15:00 UTC (~11:00 EDT / 10:00 EST),
--                              l'edge function skip si ce n'est pas le dernier
--                              jour ouvrable du mois (BIZDAY_TZ=America/Toronto)
--   pulse-followup           → toutes les heures, relance J+1 (24h) et escalade
--                              Slack J+2 (48h) pour les non-répondants
--                              (onboarding/monthly seulement)
--   pulse-recap-monthly      → tous les jours 16:00 UTC (~12:00 EDT), skip si ce
--                              n'est pas le 1er jour ouvrable du mois. Poste le
--                              récap du mois précédent dans #head-of-things.
--   pulse-weekly-scheduler   → toutes les 15 min, orchestre le NPS hebdo
--                              déclenché par un meeting :
--                                T-48h → envoi initial
--                                +24h  → suivi (tant que non-répondu)
--                                T-0h  → ping Slack #client-nps si non-rempli
--
-- HOW TO INSTALL
-- 1. Open Supabase → SQL Editor.
-- 2. Replace <SERVICE_ROLE_KEY> avec le service_role JWT (Settings → API).
-- 3. Run this file.
-- 4. Vérifier :
--      SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'pulse-%';
--
-- HOW TO REMOVE
--    SELECT cron.unschedule('pulse-onboarding-j7');
--    SELECT cron.unschedule('pulse-monthly');
--    SELECT cron.unschedule('pulse-followup');
--    SELECT cron.unschedule('pulse-recap-monthly');
--    SELECT cron.unschedule('pulse-weekly-scheduler');
--
-- HOW TO PAUSE (sans unschedule)
--    UPDATE cron.job SET active = FALSE WHERE jobname LIKE 'pulse-%';
--    UPDATE cron.job SET active = TRUE  WHERE jobname LIKE 'pulse-%';
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions nécessaires (déjà activées par les autres crons TDIA — no-op safe)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── 1. Onboarding J+7 — toutes les heures ─────────────────────────────────
SELECT cron.schedule(
  'pulse-onboarding-j7',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('trigger', 'cron', 'type', 'onboarding')
  ) AS request_id;
  $$
);

-- ─── 2. Monthly — daily 15:00 UTC (gate LBD inside edge function) ──────────
SELECT cron.schedule(
  'pulse-monthly',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('trigger', 'cron', 'type', 'monthly')
  ) AS request_id;
  $$
);

-- ─── 3. Followup — toutes les heures ──────────────────────────────────────
SELECT cron.schedule(
  'pulse-followup',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-cron-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ─── 4. Recap monthly — daily 16:00 UTC (gate 1st business day inside func) ─
SELECT cron.schedule(
  'pulse-recap-monthly',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-recap-monthly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ─── 5. Weekly scheduler — toutes les 15 min ───────────────────────────────
-- Orchestre le cycle NPS hebdo attaché à un meeting (initial T-48h, suivis
-- +24h, ping Slack #client-nps le jour du meeting). Idempotent : safe si un
-- tick double-fire ou si aucun meeting n'est en scope.
SELECT cron.schedule(
  'pulse-weekly-scheduler',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-weekly-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
