CREATE TABLE IF NOT EXISTS public.gos_customer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  transaction_date date NOT NULL,
  order_id text,
  revenue numeric,
  gross_profit numeric,
  acquisition_channel text,
  product_key text,
  segment_key text,
  source text NOT NULL DEFAULT 'manual',
  raw_payload jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, source, order_id)
);

CREATE INDEX IF NOT EXISTS gos_customer_transactions_client_date_idx
  ON public.gos_customer_transactions (client_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS gos_customer_transactions_customer_idx
  ON public.gos_customer_transactions (client_id, customer_id, transaction_date);

CREATE INDEX IF NOT EXISTS gos_customer_transactions_channel_idx
  ON public.gos_customer_transactions (client_id, acquisition_channel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_customer_transactions TO authenticated;
GRANT ALL ON public.gos_customer_transactions TO service_role;

ALTER TABLE public.gos_customer_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read customer transactions" ON public.gos_customer_transactions FOR SELECT TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members insert customer transactions" ON public.gos_customer_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "members update customer transactions" ON public.gos_customer_transactions FOR UPDATE TO authenticated
  USING (public.is_gos_client_member(client_id) OR public.is_global_admin())
  WITH CHECK (public.is_gos_client_member(client_id) OR public.is_global_admin());
CREATE POLICY "admins delete customer transactions" ON public.gos_customer_transactions FOR DELETE TO authenticated
  USING (public.has_gos_client_role(client_id, 'admin') OR public.is_global_admin());

CREATE TRIGGER trg_customer_transactions_updated
  BEFORE UPDATE ON public.gos_customer_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
