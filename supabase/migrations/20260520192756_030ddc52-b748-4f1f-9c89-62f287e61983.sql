ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS docusign_link text,
  ADD COLUMN IF NOT EXISTS docusign_envelope_id text;