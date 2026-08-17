-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT_MEETINGS — endpoint d'ingestion externe
-- ─────────────────────────────────────────────────────────────────────────────
-- Table qui stocke les meetings créés depuis une app externe (celle où
-- l'employé remplit un formulaire "créer meeting"). L'app externe POST sur
-- l'edge function meeting-scheduled qui insère ici.
--
-- On ne pose PAS de FK vers client_progress : l'app émettrice peut envoyer
-- un client_id qui n'existe pas encore côté ici (nouveau prospect, typo,
-- désynchro). On garde tout et on réconcilie visuellement dans l'admin.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code   TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL DEFAULT 'external_webhook',
  payload_raw   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_meetings_client_time_idx
  ON public.client_meetings (client_code, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS client_meetings_upcoming_idx
  ON public.client_meetings (scheduled_at)
  WHERE scheduled_at >= NOW();

COMMENT ON TABLE public.client_meetings IS
  'Meetings ingérés depuis une app externe (formulaire "créer meeting"). Alimentée par l''edge function meeting-scheduled.';
COMMENT ON COLUMN public.client_meetings.client_code IS
  'ID client tel que fourni par l''app externe. Pas de FK — peut ne pas exister dans client_progress.';
COMMENT ON COLUMN public.client_meetings.scheduled_at IS
  'Timestamp du meeting (converti depuis date + time en TZ America/Toronto si envoyé séparément).';
COMMENT ON COLUMN public.client_meetings.source IS
  'Identifiant de l''app émettrice — passé optionnellement en payload sinon "external_webhook".';
COMMENT ON COLUMN public.client_meetings.payload_raw IS
  'Corps complet du POST reçu pour audit / debug.';

-- RLS : admin peut lire pour l'affichage dans la fiche client
ALTER TABLE public.client_meetings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_meetings' AND policyname='client_meetings_admin_read') THEN
    CREATE POLICY client_meetings_admin_read
      ON public.client_meetings FOR SELECT TO authenticated USING (TRUE);
  END IF;
END $$;
