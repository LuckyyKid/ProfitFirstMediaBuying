CREATE TABLE public.gos_creative_testing_roadmap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  objective_id uuid REFERENCES public.gos_business_objectives(id) ON DELETE SET NULL,
  brief_id uuid REFERENCES public.gos_creative_briefs(id) ON DELETE SET NULL,
  resulting_concept_id uuid REFERENCES public.gos_concept_log(id) ON DELETE SET NULL,
  title text NOT NULL,
  hypothesis text,
  angle text,
  format text,
  platform text,
  target_audience text,
  planned_budget numeric,
  planned_start_date date,
  planned_end_date date,
  priority integer NOT NULL DEFAULT 3,
  impact_score integer,
  effort_score integer,
  status text NOT NULL DEFAULT 'backlog',
  expected_outcome text,
  success_criteria text,
  learnings_expected text,
  owner text,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_creative_testing_roadmap TO authenticated;
GRANT ALL ON public.gos_creative_testing_roadmap TO service_role;

ALTER TABLE public.gos_creative_testing_roadmap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmap_select" ON public.gos_creative_testing_roadmap
  FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id));
CREATE POLICY "roadmap_insert" ON public.gos_creative_testing_roadmap
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id));
CREATE POLICY "roadmap_update" ON public.gos_creative_testing_roadmap
  FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id))
  WITH CHECK (public.is_gos_client_member(client_id));
CREATE POLICY "roadmap_delete" ON public.gos_creative_testing_roadmap
  FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin'));

CREATE INDEX idx_roadmap_client_status ON public.gos_creative_testing_roadmap(client_id, status, priority);
CREATE INDEX idx_roadmap_client_start ON public.gos_creative_testing_roadmap(client_id, planned_start_date);

CREATE TRIGGER update_gos_creative_testing_roadmap_updated_at
  BEFORE UPDATE ON public.gos_creative_testing_roadmap
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();