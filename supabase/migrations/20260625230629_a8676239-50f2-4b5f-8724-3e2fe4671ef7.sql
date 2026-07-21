ALTER TABLE public.closed_deals ADD COLUMN IF NOT EXISTS client_code TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_closed_deals_client_code ON public.closed_deals(client_code);