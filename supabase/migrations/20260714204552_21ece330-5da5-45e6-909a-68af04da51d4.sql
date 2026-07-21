CREATE TABLE IF NOT EXISTS public.gos_ai_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  automation_type text NOT NULL,
  title text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  output_text text,
  model text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  tokens_input int,
  tokens_output int,
  duration_ms int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gos_ai_automation_runs_client_idx
  ON public.gos_ai_automation_runs (client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_ai_automation_runs TO authenticated;
GRANT ALL ON public.gos_ai_automation_runs TO service_role;

ALTER TABLE public.gos_ai_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ai runs"
  ON public.gos_ai_automation_runs FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "members insert ai runs"
  ON public.gos_ai_automation_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "members update ai runs"
  ON public.gos_ai_automation_runs FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());

CREATE POLICY "members delete ai runs"
  ON public.gos_ai_automation_runs FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_ai_runs_updated
  BEFORE UPDATE ON public.gos_ai_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();