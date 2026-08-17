-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT_MEETINGS — colonnes de suivi du pulse hebdo (planifié)
-- ─────────────────────────────────────────────────────────────────────────────
-- Un meeting orchestre son propre cycle de vie NPS hebdo :
--   T-48h  → envoi initial (email + SMS)  → initial_sent_at
--   +24h   → suivi (email + SMS)          → last_followup_at + followup_count++
--   T-0h   → si non-répondu, ping Slack   → slack_reminded_at
--
-- pulse_survey_id : lien vers la pulse_surveys créée à l'envoi initial. Une
-- seule survey par meeting (le suivi hebdo est mono-tour, la même survey).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.client_meetings
  ADD COLUMN IF NOT EXISTS pulse_survey_id   UUID REFERENCES public.pulse_surveys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initial_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_followup_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_count    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slack_reminded_at TIMESTAMPTZ;

-- Index pour le scheduler : meetings à venir (ou passés récemment) dont le
-- cycle n'a pas atteint le ping Slack final. Le scheduler tourne au 15 min.
CREATE INDEX IF NOT EXISTS client_meetings_scheduler_idx
  ON public.client_meetings (scheduled_at)
  WHERE slack_reminded_at IS NULL;

COMMENT ON COLUMN public.client_meetings.pulse_survey_id IS
  'FK vers la pulse_surveys créée à l''envoi initial (T-48h). NULL tant que rien n''a été envoyé.';
COMMENT ON COLUMN public.client_meetings.initial_sent_at IS
  'Timestamp du 1er envoi (email/SMS) — cible T-48h avant scheduled_at.';
COMMENT ON COLUMN public.client_meetings.last_followup_at IS
  'Timestamp du dernier suivi envoyé (relances toutes les 24h jusqu''au meeting).';
COMMENT ON COLUMN public.client_meetings.followup_count IS
  'Nombre de suivis envoyés après l''envoi initial.';
COMMENT ON COLUMN public.client_meetings.slack_reminded_at IS
  'Timestamp du ping Slack #client-nps le jour du meeting si le client n''a pas répondu. Marque la fin du cycle.';
