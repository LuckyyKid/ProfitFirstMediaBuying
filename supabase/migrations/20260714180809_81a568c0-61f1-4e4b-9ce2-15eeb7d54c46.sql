
CREATE TABLE IF NOT EXISTS public.gos_map_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  author_id uuid,
  author_role text NOT NULL DEFAULT 'other'
    CHECK (author_role IN ('media_buyer','growth_strategist','creative_strategist','ops','ceo','analyst','other')),
  scope_type text NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global','channel','campaign_category','campaign','metric')),
  scope_key text,
  scope_label text,
  what_happened text NOT NULL,
  so_what text,
  now_what text,
  linked_projection_update_id uuid REFERENCES public.gos_projection_updates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft','posted')),
  is_signal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gos_map_notes_client_date
  ON public.gos_map_notes (client_id, note_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gos_map_notes_scope
  ON public.gos_map_notes (client_id, scope_type, scope_key);
CREATE INDEX IF NOT EXISTS idx_gos_map_notes_author
  ON public.gos_map_notes (author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_map_notes TO authenticated;
GRANT ALL ON public.gos_map_notes TO service_role;

ALTER TABLE public.gos_map_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read map notes"
  ON public.gos_map_notes FOR SELECT
  TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "Analysts+ can create map notes"
  ON public.gos_map_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_gos_client_role(client_id, 'analyst'::client_member_role) OR public.is_global_admin())
    AND (author_id = auth.uid() OR author_id IS NULL)
  );

CREATE POLICY "Author or admin can update map notes"
  ON public.gos_map_notes FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_gos_client_role(client_id, 'admin'::client_member_role)
    OR public.is_global_admin()
  );

CREATE POLICY "Author or admin can delete map notes"
  ON public.gos_map_notes FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_gos_client_role(client_id, 'admin'::client_member_role)
    OR public.is_global_admin()
  );

DROP TRIGGER IF EXISTS trg_gos_map_notes_updated ON public.gos_map_notes;
CREATE TRIGGER trg_gos_map_notes_updated
  BEFORE UPDATE ON public.gos_map_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
