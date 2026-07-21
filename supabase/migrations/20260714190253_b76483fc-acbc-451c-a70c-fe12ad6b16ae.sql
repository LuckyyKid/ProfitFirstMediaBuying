
CREATE TABLE public.gos_campaign_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  target_cpa numeric,
  target_daily_budget numeric,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_campaign_categories TO authenticated;
GRANT ALL ON public.gos_campaign_categories TO service_role;

ALTER TABLE public.gos_campaign_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camp_cat_select" ON public.gos_campaign_categories FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.is_gos_client_member(client_id));
CREATE POLICY "camp_cat_insert" ON public.gos_campaign_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));
CREATE POLICY "camp_cat_update" ON public.gos_campaign_categories FOR UPDATE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'))
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));
CREATE POLICY "camp_cat_delete" ON public.gos_campaign_categories FOR DELETE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE TRIGGER trg_camp_cat_updated BEFORE UPDATE ON public.gos_campaign_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.gos_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.gos_campaign_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'other',
  external_id text,
  current_daily_budget numeric,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform, name)
);

CREATE INDEX gos_campaigns_by_category ON public.gos_campaigns (client_id, category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_campaigns TO authenticated;
GRANT ALL ON public.gos_campaigns TO service_role;

ALTER TABLE public.gos_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camp_select" ON public.gos_campaigns FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.is_gos_client_member(client_id));
CREATE POLICY "camp_insert" ON public.gos_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));
CREATE POLICY "camp_update" ON public.gos_campaigns FOR UPDATE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'))
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));
CREATE POLICY "camp_delete" ON public.gos_campaigns FOR DELETE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE TRIGGER trg_camp_updated BEFORE UPDATE ON public.gos_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
