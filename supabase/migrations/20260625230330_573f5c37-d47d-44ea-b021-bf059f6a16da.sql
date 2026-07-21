ALTER TABLE public.client_progress ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_client_progress_archived_at ON public.client_progress(archived_at);