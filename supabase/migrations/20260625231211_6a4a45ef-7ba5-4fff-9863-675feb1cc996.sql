ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_name TEXT,
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;