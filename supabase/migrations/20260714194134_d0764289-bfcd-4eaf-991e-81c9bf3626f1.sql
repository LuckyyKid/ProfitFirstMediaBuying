CREATE TABLE public.gos_offer_lab (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  objective_id uuid REFERENCES public.gos_business_objectives(id) ON DELETE SET NULL,
  offer_name text NOT NULL,
  offer_type text NOT NULL DEFAULT 'discount',
  description text,
  hook text,
  channel text,
  landing_url text,
  reference_price numeric,
  offer_price numeric,
  cost numeric,
  discount_pct numeric,
  guarantee text,
  bonus text,
  urgency text,
  test_start date,
  test_end date,
  visitors integer NOT NULL DEFAULT 0,
  add_to_carts integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  refunds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  verdict text,
  learning text,
  replay_hypothesis text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_offer_lab TO authenticated;
GRANT ALL ON public.gos_offer_lab TO service_role;

ALTER TABLE public.gos_offer_lab ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_lab_select" ON public.gos_offer_lab
  FOR SELECT TO authenticated USING (public.is_gos_client_member(client_id));
CREATE POLICY "offer_lab_insert" ON public.gos_offer_lab
  FOR INSERT TO authenticated WITH CHECK (public.is_gos_client_member(client_id));
CREATE POLICY "offer_lab_update" ON public.gos_offer_lab
  FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id))
  WITH CHECK (public.is_gos_client_member(client_id));
CREATE POLICY "offer_lab_delete" ON public.gos_offer_lab
  FOR DELETE TO authenticated USING (public.has_gos_client_role(client_id, 'admin'));

CREATE INDEX idx_offer_lab_client_status ON public.gos_offer_lab(client_id, status);

CREATE TRIGGER update_gos_offer_lab_updated_at
  BEFORE UPDATE ON public.gos_offer_lab
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();