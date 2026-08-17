-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT PULSE — MONTHLY FULL SURVEY (10 questions)
-- ─────────────────────────────────────────────────────────────────────────────
-- Le pulse mensuel passe d'un simple score+verbatim à un formulaire structuré
-- de 10 questions. Colonnes ajoutées à pulse_responses (toutes nullable pour
-- rester compatibles avec onboarding + relational qui gardent leur flow).
--
-- Mapping des questions :
--   Q1 satisfaction   → score (colonne existante, 0-10)
--   Q2 NPS            → nps_score (nouveau, 0-10)
--   Q3 confiance      → confidence_next_month (nouveau, 1-5)
--   Q4 collab health  → collab_health (nouveau, enum-like text)
--   Q5 raison score   → verbatim (colonne existante, text long)
--   Q6 amélioration   → improvement_one_thing (nouveau, text court)
--   Q7 keep doing     → keep_doing (nouveau, text long)
--   Q8 difficultés    → difficulties (text[]) + difficulties_other (text libre)
--   Q9 business impact → business_impact (nouveau, 1-5)
--   Q10 priorité      → next_month_priority + next_month_priority_other
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pulse_responses
  ADD COLUMN IF NOT EXISTS nps_score                  SMALLINT
    CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
  ADD COLUMN IF NOT EXISTS confidence_next_month      SMALLINT
    CHECK (confidence_next_month IS NULL OR (confidence_next_month >= 1 AND confidence_next_month <= 5)),
  ADD COLUMN IF NOT EXISTS collab_health              TEXT
    CHECK (collab_health IS NULL OR collab_health IN ('very_healthy','good','fragile','at_risk')),
  ADD COLUMN IF NOT EXISTS improvement_one_thing      TEXT,
  ADD COLUMN IF NOT EXISTS keep_doing                 TEXT,
  ADD COLUMN IF NOT EXISTS difficulties               TEXT[],
  ADD COLUMN IF NOT EXISTS difficulties_other         TEXT,
  ADD COLUMN IF NOT EXISTS business_impact            SMALLINT
    CHECK (business_impact IS NULL OR (business_impact >= 1 AND business_impact <= 5)),
  ADD COLUMN IF NOT EXISTS next_month_priority        TEXT
    CHECK (next_month_priority IS NULL OR next_month_priority IN
      ('volume','profitability','test_angles','creatives','foundation','stabilize','other')),
  ADD COLUMN IF NOT EXISTS next_month_priority_other  TEXT,
  ADD COLUMN IF NOT EXISTS monthly_completed_at       TIMESTAMPTZ;

COMMENT ON COLUMN public.pulse_responses.nps_score IS
  'Q2 mensuel — recommendation 0-10 (NPS). NULL pour onboarding/relational.';
COMMENT ON COLUMN public.pulse_responses.confidence_next_month IS
  'Q3 mensuel — confiance mois prochain 1-5. NULL sinon.';
COMMENT ON COLUMN public.pulse_responses.collab_health IS
  'Q4 mensuel — état de la collab (very_healthy|good|fragile|at_risk). NULL sinon.';
COMMENT ON COLUMN public.pulse_responses.improvement_one_thing IS
  'Q6 mensuel — LA chose à améliorer pour gagner +1 (texte court).';
COMMENT ON COLUMN public.pulse_responses.keep_doing IS
  'Q7 mensuel — ce qu''on doit absolument continuer à faire (texte long).';
COMMENT ON COLUMN public.pulse_responses.difficulties IS
  'Q8 mensuel — array des codes de difficultés cochées (communication|creative_quality|creative_volume|strategy|timelines|reporting|brand_understanding|other).';
COMMENT ON COLUMN public.pulse_responses.difficulties_other IS
  'Q8 mensuel — texte libre associé à difficulties contenant "other".';
COMMENT ON COLUMN public.pulse_responses.business_impact IS
  'Q9 mensuel — dans quelle mesure nos actions ont fait avancer le business 1-5.';
COMMENT ON COLUMN public.pulse_responses.next_month_priority IS
  'Q10 mensuel — priorité #1 pour le mois prochain (enum).';
COMMENT ON COLUMN public.pulse_responses.next_month_priority_other IS
  'Q10 mensuel — texte libre associé à next_month_priority = "other".';
COMMENT ON COLUMN public.pulse_responses.monthly_completed_at IS
  'Timestamp de finalisation du formulaire mensuel complet (Q1→Q10). NULL = pas encore complet ou pas un mensuel.';
