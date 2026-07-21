ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS owner_pain_point text,
  ADD COLUMN IF NOT EXISTS contract_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS contract_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS external_status text,
  ADD COLUMN IF NOT EXISTS churned_at timestamptz,
  ADD COLUMN IF NOT EXISTS churn_reason text;