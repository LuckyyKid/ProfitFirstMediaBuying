-- ─────────────────────────────────────────────────────────────────────────────
-- AUTOMATION ERROR MONITORING
-- ─────────────────────────────────────────────────────────────────────────────
-- Platform-agnostic "dead man's switch" for TDIA agency workflows.
--
-- Every automation POSTs to the /automation-ping edge function on success and
-- on failure. A daily watchdog (see supabase/cron/setup_automation_watchdog_cron.sql)
-- catches workflows that stopped pinging (dead cron, disabled scenario, etc.).
--
-- Three tables:
--   automation_registry  — declared workflows + criticality + expected cadence
--   automation_run_log   — every ping received
--   automation_error_log — alerts fired (Slack sent) or dedup-skipped
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Registry — also acts as the Automation Documentation System.
CREATE TABLE IF NOT EXISTS public.automation_registry (
  workflow_id           TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  criticality           TEXT NOT NULL CHECK (criticality IN ('S1', 'S2', 'S3')),
  expected_cadence_hours INTEGER NOT NULL,
  owner                 TEXT NOT NULL,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  description           TEXT,
  notify_on_failure     TEXT,
  how_to_pause          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.automation_registry IS
  'Declared automations. Watchdog checks that each active row got a success ping within expected_cadence_hours.';
COMMENT ON COLUMN public.automation_registry.expected_cadence_hours IS
  'Max hours between two success pings before the watchdog raises "cadence missed".';
COMMENT ON COLUMN public.automation_registry.how_to_pause IS
  'Runbook: exact steps to disable this automation manually (which platform, which switch).';

-- 2) Run log — every ping lands here (success OR failure).
CREATE TABLE IF NOT EXISTS public.automation_run_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  items_count   INTEGER,
  run_url       TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_run_log_workflow_time_idx
  ON public.automation_run_log (workflow_id, received_at DESC);
CREATE INDEX IF NOT EXISTS automation_run_log_status_time_idx
  ON public.automation_run_log (status, received_at DESC);

COMMENT ON TABLE public.automation_run_log IS
  'One row per ping. Success pings feed the watchdog cadence check; failure pings trigger the alert pipeline.';

-- 3) Error log — alerts + storm aggregates + dedup counters.
CREATE TABLE IF NOT EXISTS public.automation_error_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   TEXT,
  severity      TEXT NOT NULL CHECK (severity IN ('S1', 'S2', 'S3')),
  error         TEXT,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  slack_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  slack_error   TEXT,
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_error_log_workflow_time_idx
  ON public.automation_error_log (workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_error_log_unresolved_time_idx
  ON public.automation_error_log (resolved, created_at DESC)
  WHERE resolved = FALSE;

COMMENT ON TABLE public.automation_error_log IS
  'Alert registry. Source of MTTD/MTTR metrics. details.repeat_count aggregates dedup-skipped failures.';

-- 4) RLS — service_role bypasses; authenticated admins can read for dashboards.
ALTER TABLE public.automation_registry  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_run_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_error_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_registry' AND policyname='automation_registry_admin_read') THEN
    CREATE POLICY automation_registry_admin_read
      ON public.automation_registry FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_run_log' AND policyname='automation_run_log_admin_read') THEN
    CREATE POLICY automation_run_log_admin_read
      ON public.automation_run_log FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_error_log' AND policyname='automation_error_log_admin_read') THEN
    CREATE POLICY automation_error_log_admin_read
      ON public.automation_error_log FOR SELECT TO authenticated USING (TRUE);
  END IF;
END $$;

-- 5) Seed — the 12 known TDIA workflows. UPSERT-safe: re-running the migration
--    keeps whatever the user tweaked in the UI/UPDATE afterwards.
INSERT INTO public.automation_registry
  (workflow_id, name, criticality, expected_cadence_hours, owner, description, how_to_pause)
VALUES
  ('lead_routing',            'Routage leads entrants',       'S1',   2, 'bafingsimbokeita@gmail.com',
   'Route les nouveaux leads (formulaire, ads, referral) vers le closer disponible.',
   'Désactiver le scénario dans la plateforme d''automation.'),
  ('closed_won',              'Post-processing closed-won',   'S1',   6, 'bafingsimbokeita@gmail.com',
   'Déclenché quand un lead passe closed-won : création client, envoi contrat, canal Slack, portail.',
   'Désactiver le trigger côté CRM ou couper le webhook.'),
  ('client_onboarding',       'Onboarding client',            'S1',   6, 'bafingsimbokeita@gmail.com',
   'Envoie l''email de bienvenue, planifie le kickoff, provisionne l''accès au portail.',
   'Désactiver le scénario ou passer active=false ici.'),
  ('follow_up_stuck_clients', 'Relance clients bloqués',      'S1',  26, 'bafingsimbokeita@gmail.com',
   'Relance quotidienne SMS/email des clients bloqués dans l''onboarding (edge function existante).',
   'UPDATE cron.job SET active=false WHERE jobname=''follow-up-stuck-clients''.'),
  ('task_creation',           'Création tâches internes',     'S2',  26, 'bafingsimbokeita@gmail.com',
   'Crée automatiquement les tâches internes post-kickoff et sur milestones.',
   'Désactiver le scénario dans la plateforme.'),
  ('deadline_reminders',      'Rappels deadlines',            'S2',  26, 'bafingsimbokeita@gmail.com',
   'Notifie l''équipe des deadlines projet approchant sous 48 h.',
   'Désactiver le cron ou le scénario.'),
  ('creative_approval',       'Approbation créative',         'S2',  26, 'bafingsimbokeita@gmail.com',
   'Ping client + équipe quand une créative attend approbation depuis > 24 h.',
   'Désactiver le scénario.'),
  ('reporting_weekly',        'Rapports hebdo clients',       'S3', 192, 'bafingsimbokeita@gmail.com',
   'Génère et envoie le rapport hebdomadaire à chaque client actif.',
   'UPDATE cron.job SET active=false ou active=false ici.'),
  ('client_health_check',     'Score santé client',           'S2',  26, 'bafingsimbokeita@gmail.com',
   'Calcule un score de santé (engagement, résultats, tickets) et flag les clients à risque.',
   'Désactiver le scénario.'),
  ('payment_invoice',         'Facturation et paiements',     'S1',  26, 'bafingsimbokeita@gmail.com',
   'Génère les factures récurrentes et suit les paiements Stripe / relances.',
   'Désactiver le webhook Stripe ou le scénario côté billing.'),
  ('internal_notifications',  'Notifs internes agrégées',     'S3',  26, 'bafingsimbokeita@gmail.com',
   'Résumé matinal Slack pour l''équipe (nouveaux leads, tâches, alertes).',
   'Désactiver le cron matinal.'),
  ('ad_anomaly_check',        'Check anomalies Meta Ads',     'S2',  26, 'bafingsimbokeita@gmail.com',
   'Détection quotidienne d''anomalies Meta Ads par client (voir docs/ad-anomaly-system.md).',
   'UPDATE cron.job SET active=false WHERE jobname=''ad-anomaly-daily-check''.')
ON CONFLICT (workflow_id) DO NOTHING;
