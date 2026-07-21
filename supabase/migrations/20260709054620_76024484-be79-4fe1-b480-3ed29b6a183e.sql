ALTER TABLE public.gos_clients
  ADD COLUMN IF NOT EXISTS data_mode text NOT NULL DEFAULT 'DEMO_DATA',
  ADD COLUMN IF NOT EXISTS data_quality_score integer,
  ADD COLUMN IF NOT EXISTS data_mode_notes text;

ALTER TABLE public.gos_clients
  DROP CONSTRAINT IF EXISTS gos_clients_data_mode_check;

ALTER TABLE public.gos_clients
  ADD CONSTRAINT gos_clients_data_mode_check
  CHECK (data_mode IN ('DEMO_DATA','ANONYMIZED_HISTORICAL','MANUAL_CLIENT_EXPORT','API_CONNECTED'));

ALTER TABLE public.gos_clients
  DROP CONSTRAINT IF EXISTS gos_clients_dqs_check;

ALTER TABLE public.gos_clients
  ADD CONSTRAINT gos_clients_dqs_check
  CHECK (data_quality_score IS NULL OR (data_quality_score >= 0 AND data_quality_score <= 100));

UPDATE public.gos_clients
SET data_mode = 'DEMO_DATA'
WHERE data_mode IS NULL;