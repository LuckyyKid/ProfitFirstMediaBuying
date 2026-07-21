CREATE TABLE public.gos_weekly_executive_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  week_label TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  executive_summary TEXT,
  performance_highlights TEXT,
  key_wins TEXT,
  key_challenges TEXT,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  wayfinder_decisions TEXT,
  next_week_priorities TEXT,
  blockers TEXT,
  asks_to_client TEXT,
  winner_concept_ids UUID[] NOT NULL DEFAULT '{}',
  loser_concept_ids UUID[] NOT NULL DEFAULT '{}',
  linked_test_ids UUID[] NOT NULL DEFAULT '{}',
  recipients TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  sent_by UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_weekly_executive_reports TO authenticated;
GRANT ALL ON public.gos_weekly_executive_reports TO service_role;

ALTER TABLE public.gos_weekly_executive_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view weekly reports"
  ON public.gos_weekly_executive_reports FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "members insert weekly reports"
  ON public.gos_weekly_executive_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "members update weekly reports"
  ON public.gos_weekly_executive_reports FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "members delete weekly reports"
  ON public.gos_weekly_executive_reports FOR DELETE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE INDEX idx_gos_wer_client ON public.gos_weekly_executive_reports(client_id, week_start DESC);

CREATE TRIGGER update_gos_wer_updated_at
  BEFORE UPDATE ON public.gos_weekly_executive_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();