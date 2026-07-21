ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS business_deep_dive_sheet_id TEXT,
  ADD COLUMN IF NOT EXISTS business_deep_dive_sheet_url TEXT;