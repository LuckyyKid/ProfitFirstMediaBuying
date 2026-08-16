-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT PULSE SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────
-- Sonde de satisfaction client TDIA. Trois types de pulse :
--   1. onboarding — envoi automatique J+7 après completed_at
--   2. monthly    — envoi automatique le dernier jour ouvrable du mois
--   3. relational — logué en direct par l'AM après un call stratégique/renewal
--
-- Flow non-réponse (onboarding + monthly seulement) :
--   J+0 : envoi email + SMS
--   J+1 : relance email + SMS
--   J+2 : escalade Slack #head-of-things, survey fermée
--
-- Interprétation Slack (règles) :
--   0-6 → rouge (détracteur, call récupération 24-48 h)
--   7-8 → jaune (passif, question au prochain weekly)
--   9-10 → vert (promoteur, demande testimonial/référence)
--   Trajectoire ≥ 2 points en baisse → orange (prioritaire sur la couleur du score)
--
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Colonne clickup_task_id sur client_progress
--    (chaque client = 1 tâche ClickUp dans la liste 901714791842 ; on stocke
--    le task_id pour attacher des commentaires pulse à cette entité client)
ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS clickup_task_id TEXT;

COMMENT ON COLUMN public.client_progress.clickup_task_id IS
  'ID de la tâche ClickUp qui représente ce client (créée par create-clickup-task). Utilisé pour attacher les commentaires pulse à l''entité client.';

-- 2) Table pulse_surveys — un envoi (ou saisie manuelle) = une ligne
CREATE TABLE IF NOT EXISTS public.pulse_surveys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code           TEXT NOT NULL REFERENCES public.client_progress(client_code) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN ('onboarding', 'monthly', 'relational')),
  token                 TEXT NOT NULL UNIQUE,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  sent_channels         TEXT[] NOT NULL DEFAULT '{}',
  followup_sent_at      TIMESTAMPTZ,
  followup_count        INTEGER NOT NULL DEFAULT 0,
  escalated_at          TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  manual                BOOLEAN NOT NULL DEFAULT FALSE,
  created_by            TEXT NOT NULL DEFAULT 'cron',
  previous_score        INTEGER,
  previous_survey_id    UUID REFERENCES public.pulse_surveys(id) ON DELETE SET NULL,
  slack_posted_at       TIMESTAMPTZ,
  clickup_commented_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pulse_surveys_client_time_idx
  ON public.pulse_surveys (client_code, sent_at DESC);
CREATE INDEX IF NOT EXISTS pulse_surveys_open_idx
  ON public.pulse_surveys (closed_at)
  WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS pulse_surveys_type_time_idx
  ON public.pulse_surveys (type, sent_at DESC);

COMMENT ON TABLE public.pulse_surveys IS
  'Chaque envoi (ou saisie manuelle NPS relationnel) de pulse. Le token sert de clé d''entrée pour la micro-page de réponse.';
COMMENT ON COLUMN public.pulse_surveys.expires_at IS
  'Après cette date la micro-page refuse le score (fenêtre fermée). Défaut : sent_at + 7 jours.';
COMMENT ON COLUMN public.pulse_surveys.previous_score IS
  'Score du pulse précédent du même client (peu importe le type). Sert à calculer la trajectoire ≥ 2 points.';
COMMENT ON COLUMN public.pulse_surveys.escalated_at IS
  'Timestamp de l''escalade Slack à J+2 en cas de non-réponse. NULL = pas encore escaladé.';

-- 3) Table pulse_responses — une seule ligne par survey (score + verbatim optionnel)
CREATE TABLE IF NOT EXISTS public.pulse_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id     UUID NOT NULL UNIQUE REFERENCES public.pulse_surveys(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  verbatim      TEXT,
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verbatim_at   TIMESTAMPTZ,
  source        TEXT NOT NULL DEFAULT 'client_email_click'
                CHECK (source IN ('client_email_click', 'nps_relational_manual', 'admin_manual'))
);

CREATE INDEX IF NOT EXISTS pulse_responses_survey_idx
  ON public.pulse_responses (survey_id);
CREATE INDEX IF NOT EXISTS pulse_responses_time_idx
  ON public.pulse_responses (responded_at DESC);

COMMENT ON TABLE public.pulse_responses IS
  'Réponse à un pulse. Score obligatoire (0-10), verbatim optionnel (posté après le score dans la micro-page).';

-- 4) RLS — service_role bypass ; authenticated (admin) peut lire pour la fiche client
ALTER TABLE public.pulse_surveys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_surveys' AND policyname='pulse_surveys_admin_read') THEN
    CREATE POLICY pulse_surveys_admin_read
      ON public.pulse_surveys FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_responses' AND policyname='pulse_responses_admin_read') THEN
    CREATE POLICY pulse_responses_admin_read
      ON public.pulse_responses FOR SELECT TO authenticated USING (TRUE);
  END IF;
END $$;

-- 5) Seed automation_registry — workflow_id 'client_pulse' (S2, cadence 26h : le
--    cron horaire de suivi doit pinger au moins une fois par jour).
INSERT INTO public.automation_registry
  (workflow_id, name, criticality, expected_cadence_hours, owner, description, how_to_pause)
VALUES
  ('client_pulse', 'Client Pulse System (satisfaction)', 'S2', 26, 'bafingsimbokeita@gmail.com',
   'Sonde de satisfaction : envoi automatique onboarding J+7 + mensuel dernier jour ouvrable + NPS relationnel manuel. Non-réponse J+1 relance (email+SMS), J+2 escalade Slack #head-of-things. Voir docs/client-pulse-system.md.',
   'UPDATE cron.job SET active=false WHERE jobname IN (''pulse-onboarding-j7'',''pulse-monthly'',''pulse-followup'',''pulse-recap''); OU UPDATE automation_registry SET active=false WHERE workflow_id=''client_pulse''.')
ON CONFLICT (workflow_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Note pour la Tranche 5 : create-clickup-task devra faire un UPDATE
-- client_progress SET clickup_task_id = <task_id> WHERE client_code = <code>
-- après création réussie de la tâche. Un script one-shot backfill-clickup-task-ids
-- remplira la colonne pour les clients créés avant cette migration.
-- ─────────────────────────────────────────────────────────────────────────────
