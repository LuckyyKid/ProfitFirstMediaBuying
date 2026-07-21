
-- gos_learning_entries
CREATE TABLE public.gos_learning_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'MANUAL',
  source_ref_id UUID,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  title TEXT NOT NULL,
  hypothesis TEXT,
  result TEXT,
  insight TEXT NOT NULL,
  recommendation TEXT,
  confidence NUMERIC,
  impact_level TEXT DEFAULT 'MEDIUM',
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  captured_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_learning_entries TO authenticated;
GRANT ALL ON public.gos_learning_entries TO service_role;
ALTER TABLE public.gos_learning_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage gos_learning_entries" ON public.gos_learning_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_learning_entries_updated BEFORE UPDATE ON public.gos_learning_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- gos_next_cycle_plans
CREATE TABLE public.gos_next_cycle_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  cycle_name TEXT NOT NULL,
  cycle_start DATE,
  cycle_end DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  north_star_goal TEXT,
  primary_objectives JSONB DEFAULT '[]'::jsonb,
  key_hypotheses JSONB DEFAULT '[]'::jsonb,
  planned_budget NUMERIC,
  budget_allocation JSONB DEFAULT '{}'::jsonb,
  target_revenue NUMERIC,
  target_cac NUMERIC,
  target_roas NUMERIC,
  known_risks JSONB DEFAULT '[]'::jsonb,
  dependencies TEXT,
  linked_learning_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_next_cycle_plans TO authenticated;
GRANT ALL ON public.gos_next_cycle_plans TO service_role;
ALTER TABLE public.gos_next_cycle_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage gos_next_cycle_plans" ON public.gos_next_cycle_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_next_cycle_plans_updated BEFORE UPDATE ON public.gos_next_cycle_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- gos_client_intelligence_snapshots
CREATE TABLE public.gos_client_intelligence_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  health_score NUMERIC,
  health_grade TEXT,
  momentum TEXT,
  key_metrics JSONB DEFAULT '{}'::jsonb,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  alerts JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  learning_count INTEGER DEFAULT 0,
  active_cycle_id UUID,
  summary TEXT,
  computed_by TEXT DEFAULT 'DETERMINISTIC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_client_intelligence_snapshots TO authenticated;
GRANT ALL ON public.gos_client_intelligence_snapshots TO service_role;
ALTER TABLE public.gos_client_intelligence_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage gos_client_intelligence_snapshots" ON public.gos_client_intelligence_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gos_client_intelligence_snapshots_updated BEFORE UPDATE ON public.gos_client_intelligence_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
