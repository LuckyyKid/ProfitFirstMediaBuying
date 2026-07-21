CREATE TABLE public.gos_angle_audience_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  angle text NOT NULL,
  audience text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'untested',
  priority text NOT NULL DEFAULT 'medium',
  hypothesis text,
  linked_concept_ids uuid[] NOT NULL DEFAULT '{}',
  linked_brief_ids uuid[] NOT NULL DEFAULT '{}',
  linked_test_ids uuid[] NOT NULL DEFAULT '{}',
  spend numeric,
  impressions numeric,
  ctr numeric,
  cpa numeric,
  roas numeric,
  cvr numeric,
  verdict text,
  notes text,
  last_tested_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (client_id, angle, audience, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_angle_audience_matrix TO authenticated;
GRANT ALL ON public.gos_angle_audience_matrix TO service_role;

ALTER TABLE public.gos_angle_audience_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matrix_select" ON public.gos_angle_audience_matrix
  FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.is_gos_client_member(client_id));

CREATE POLICY "matrix_insert" ON public.gos_angle_audience_matrix
  FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE POLICY "matrix_update" ON public.gos_angle_audience_matrix
  FOR UPDATE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE POLICY "matrix_delete" ON public.gos_angle_audience_matrix
  FOR DELETE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'admin'));

CREATE TRIGGER trg_matrix_updated
  BEFORE UPDATE ON public.gos_angle_audience_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_matrix_client ON public.gos_angle_audience_matrix(client_id);
CREATE INDEX idx_matrix_status ON public.gos_angle_audience_matrix(client_id, status);