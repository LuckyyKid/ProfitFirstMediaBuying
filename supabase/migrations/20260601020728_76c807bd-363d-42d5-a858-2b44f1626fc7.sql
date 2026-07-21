ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS external_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS external_snapshot_hash text,
  ADD COLUMN IF NOT EXISTS external_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_sync_error text;