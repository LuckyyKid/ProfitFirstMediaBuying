CREATE TABLE IF NOT EXISTS public.gos_media_buying_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  platform text NOT NULL DEFAULT 'meta',
  scope text NOT NULL DEFAULT 'campaign',
  metric text NOT NULL,
  operator text NOT NULL,
  threshold_value numeric NOT NULL,
  lookback_days int NOT NULL DEFAULT 3,
  action_type text NOT NULL,
  action_value numeric,
  cooldown_hours int NOT NULL DEFAULT 24,
  priority text NOT NULL DEFAULT 'medium',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gos_media_buying_rules_client_idx
  ON public.gos_media_buying_rules (client_id, is_active, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_media_buying_rules TO authenticated;
GRANT ALL ON public.gos_media_buying_rules TO service_role;

ALTER TABLE public.gos_media_buying_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read rules" ON public.gos_media_buying_rules FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert rules" ON public.gos_media_buying_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update rules" ON public.gos_media_buying_rules FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete rules" ON public.gos_media_buying_rules FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_mb_rules_updated
  BEFORE UPDATE ON public.gos_media_buying_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.gos_media_buying_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.gos_media_buying_rules(id) ON DELETE SET NULL,
  target_name text NOT NULL,
  target_platform text,
  metric text,
  metric_value numeric,
  threshold_value numeric,
  action_type text NOT NULL,
  action_value numeric,
  status text NOT NULL DEFAULT 'suggested',
  applied_by uuid,
  applied_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gos_media_buying_actions_client_idx
  ON public.gos_media_buying_actions (client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_media_buying_actions TO authenticated;
GRANT ALL ON public.gos_media_buying_actions TO service_role;

ALTER TABLE public.gos_media_buying_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read mb actions" ON public.gos_media_buying_actions FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert mb actions" ON public.gos_media_buying_actions FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update mb actions" ON public.gos_media_buying_actions FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete mb actions" ON public.gos_media_buying_actions FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_mb_actions_updated
  BEFORE UPDATE ON public.gos_media_buying_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();