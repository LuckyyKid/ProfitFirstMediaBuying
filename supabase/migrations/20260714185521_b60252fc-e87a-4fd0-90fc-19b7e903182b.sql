
CREATE TABLE public.gos_digest_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_label text,
  active boolean NOT NULL DEFAULT true,
  send_hour_utc smallint NOT NULL DEFAULT 11,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_digest_recipients TO authenticated;
GRANT ALL ON public.gos_digest_recipients TO service_role;

ALTER TABLE public.gos_digest_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_recipients_select"
  ON public.gos_digest_recipients FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.is_gos_client_member(client_id));

CREATE POLICY "digest_recipients_insert"
  ON public.gos_digest_recipients FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE POLICY "digest_recipients_update"
  ON public.gos_digest_recipients FOR UPDATE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'))
  WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE POLICY "digest_recipients_delete"
  ON public.gos_digest_recipients FOR DELETE TO authenticated
  USING (public.is_global_admin() OR public.has_gos_client_role(client_id, 'analyst'));

CREATE TRIGGER trg_digest_recipients_updated
  BEFORE UPDATE ON public.gos_digest_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.gos_digest_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  digest_date date NOT NULL,
  status text NOT NULL,
  error text,
  email_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gos_digest_sends_lookup ON public.gos_digest_sends (client_id, digest_date, recipient_email);

GRANT SELECT ON public.gos_digest_sends TO authenticated;
GRANT ALL ON public.gos_digest_sends TO service_role;

ALTER TABLE public.gos_digest_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_sends_select"
  ON public.gos_digest_sends FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.is_gos_client_member(client_id));

-- Schedule the daily digest edge function at 11:00 UTC (~7am EST).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
