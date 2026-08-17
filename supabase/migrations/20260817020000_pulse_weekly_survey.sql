-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT PULSE — WEEKLY SURVEY (déclenché par meeting-scheduled webhook)
-- ─────────────────────────────────────────────────────────────────────────────
-- Un nouveau type de pulse 'weekly' déclenché non pas par un cron mais par
-- l'endpoint meeting-scheduled (POST reçu depuis une app externe quand un
-- meeting est créé pour un client). Un survey weekly = un formulaire 4 questions :
--
--   Q1 pace/clarté          → weekly_pace_score (1-5, obligatoire)
--   Q2 raison du score      → verbatim (colonne existante, court)
--   Q3 blocker/inquiétude   → weekly_blocker (optionnel, long)
--   Q4 priorité semaine +1  → weekly_next_priority (obligatoire, court)
--
-- Le score 1-5 du weekly ne correspond PAS au score 0-10 des autres pulses,
-- donc on stocke dans une colonne dédiée et on assouplit score NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Ajouter 'weekly' à la CHECK constraint de pulse_surveys.type
ALTER TABLE public.pulse_surveys
  DROP CONSTRAINT IF EXISTS pulse_surveys_type_check;
ALTER TABLE public.pulse_surveys
  ADD CONSTRAINT pulse_surveys_type_check
  CHECK (type IN ('onboarding', 'monthly', 'relational', 'weekly'));

-- 2) score devient nullable — un weekly n'a pas de score 0-10, il a un
--    weekly_pace_score 1-5 dans sa propre colonne.
ALTER TABLE public.pulse_responses
  ALTER COLUMN score DROP NOT NULL;

-- 3) Nouvelles colonnes weekly (toutes nullable, compatibles avec les autres types)
ALTER TABLE public.pulse_responses
  ADD COLUMN IF NOT EXISTS weekly_pace_score      SMALLINT
    CHECK (weekly_pace_score IS NULL OR (weekly_pace_score >= 1 AND weekly_pace_score <= 5)),
  ADD COLUMN IF NOT EXISTS weekly_blocker         TEXT,
  ADD COLUMN IF NOT EXISTS weekly_next_priority   TEXT,
  ADD COLUMN IF NOT EXISTS weekly_completed_at    TIMESTAMPTZ;

COMMENT ON COLUMN public.pulse_responses.weekly_pace_score IS
  'Q1 weekly — à quel point ça a avancé rapidement et clairement cette semaine (1-5). NULL pour les autres types.';
COMMENT ON COLUMN public.pulse_responses.weekly_blocker IS
  'Q3 weekly — blocker/inquiétude à adresser tout de suite. Optionnel.';
COMMENT ON COLUMN public.pulse_responses.weekly_next_priority IS
  'Q4 weekly — priorité #1 pour la semaine prochaine (texte court).';
COMMENT ON COLUMN public.pulse_responses.weekly_completed_at IS
  'Timestamp de finalisation du formulaire weekly (Q1→Q4). NULL = pas encore complet ou pas un weekly.';
