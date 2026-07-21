
CREATE TABLE public.gos_data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'SHOPIFY','META_ADS','GOOGLE_ADS','GA4','KLAVIYO','TIKTOK_ADS',
    'AMAZON','STRIPE','QUICKBOOKS','MANUAL_UPLOAD','GOOGLE_SHEETS','OTHER'
  )),
  source_name TEXT NOT NULL,
  connection_mode TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (connection_mode IN (
    'NOT_CONNECTED','MANUAL_ENTRY','MANUAL_EXPORT','CSV_UPLOAD','API_PLACEHOLDER','API_CONNECTED'
  )),
  connection_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (connection_status IN (
    'NOT_STARTED','NEEDS_ACCESS','CONNECTED','ERROR','STALE','DISABLED'
  )),
  last_sync_at TIMESTAMPTZ,
  data_freshness_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (data_freshness_status IN (
    'FRESH','STALE','MISSING','UNKNOWN'
  )),
  reliability_score INTEGER NOT NULL DEFAULT 0 CHECK (reliability_score BETWEEN 0 AND 100),
  feeds TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_data_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_data_sources TO anon;
GRANT ALL ON public.gos_data_sources TO service_role;

ALTER TABLE public.gos_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gos_data_sources_all" ON public.gos_data_sources FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX gos_data_sources_client_id_idx ON public.gos_data_sources(client_id);

CREATE TRIGGER update_gos_data_sources_updated_at
BEFORE UPDATE ON public.gos_data_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
