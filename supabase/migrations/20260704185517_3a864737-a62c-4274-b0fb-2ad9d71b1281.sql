ALTER TABLE public.client_progress
ADD COLUMN IF NOT EXISTS business_deep_dive_submitted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS business_deep_dive_completed_at timestamptz;