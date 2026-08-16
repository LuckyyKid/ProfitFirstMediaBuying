-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT PULSE — communication_score (onboarding J+7 only)
-- ─────────────────────────────────────────────────────────────────────────────
-- On ajoute une 2e dimension au pulse onboarding : score de communication.
-- Nullable car seul le type 'onboarding' l'utilise (monthly + relational
-- restent monodimensionnels).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pulse_responses
  ADD COLUMN IF NOT EXISTS communication_score SMALLINT
    CHECK (communication_score IS NULL OR (communication_score >= 0 AND communication_score <= 10));

COMMENT ON COLUMN public.pulse_responses.communication_score IS
  'Score 0-10 dédié à la qualité de communication perçue pendant l''onboarding. Utilisé uniquement pour type=onboarding ; NULL sinon.';
