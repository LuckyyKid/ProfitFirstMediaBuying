
ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID;

-- Unique case-insensitive email so the webhook can find the row deterministically
CREATE UNIQUE INDEX IF NOT EXISTS client_progress_email_lower_idx
  ON public.client_progress (LOWER(email))
  WHERE email IS NOT NULL;

-- Enable realtime so frontend gets instant updates when webhook fires
ALTER TABLE public.client_progress REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_progress;
