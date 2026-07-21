CREATE TABLE public.gos_wayfinder_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  week_label text,
  status text NOT NULL DEFAULT 'draft',
  facilitator text,
  participants text[] NOT NULL DEFAULT '{}',
  objective_ids uuid[] NOT NULL DEFAULT '{}',
  winner_concept_ids uuid[] NOT NULL DEFAULT '{}',
  loser_concept_ids uuid[] NOT NULL DEFAULT '{}',
  performance_summary text,
  key_learnings text,
  decisions text,
  next_actions text,
  blockers text,
  next_session_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_wayfinder_sessions TO authenticated;
GRANT ALL ON public.gos_wayfinder_sessions TO service_role;

ALTER TABLE public.gos_wayfinder_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wayfinder_select" ON public.gos_wayfinder_sessions
  FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id));

CREATE POLICY "wayfinder_insert" ON public.gos_wayfinder_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id));

CREATE POLICY "wayfinder_update" ON public.gos_wayfinder_sessions
  FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id))
  WITH CHECK (public.is_gos_client_member(client_id));

CREATE POLICY "wayfinder_delete" ON public.gos_wayfinder_sessions
  FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin'));

CREATE INDEX idx_wayfinder_client_date ON public.gos_wayfinder_sessions(client_id, session_date DESC);

CREATE TRIGGER update_gos_wayfinder_sessions_updated_at
  BEFORE UPDATE ON public.gos_wayfinder_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();