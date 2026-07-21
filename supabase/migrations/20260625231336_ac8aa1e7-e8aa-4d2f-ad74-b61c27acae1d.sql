ALTER TABLE public.closed_deals
  ADD COLUMN IF NOT EXISTS stripe_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_type TEXT;