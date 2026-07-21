CREATE TABLE public.gos_integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  display_name TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  next_sync_at TIMESTAMPTZ,
  sync_frequency_hours INTEGER NOT NULL DEFAULT 24,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_integration_connections TO authenticated;
GRANT ALL ON public.gos_integration_connections TO service_role;

ALTER TABLE public.gos_integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gos_integration_connections_all"
  ON public.gos_integration_connections
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_gos_integration_connections_updated_at
  BEFORE UPDATE ON public.gos_integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gos_integration_connections_client ON public.gos_integration_connections(client_id);
CREATE INDEX idx_gos_integration_connections_provider ON public.gos_integration_connections(provider);


CREATE TABLE public.gos_integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.gos_integration_connections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  rows_ingested INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.gos_integration_sync_runs TO authenticated;
GRANT ALL ON public.gos_integration_sync_runs TO service_role;

ALTER TABLE public.gos_integration_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gos_integration_sync_runs_all"
  ON public.gos_integration_sync_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_gos_integration_sync_runs_connection ON public.gos_integration_sync_runs(connection_id);
CREATE INDEX idx_gos_integration_sync_runs_started ON public.gos_integration_sync_runs(started_at DESC);