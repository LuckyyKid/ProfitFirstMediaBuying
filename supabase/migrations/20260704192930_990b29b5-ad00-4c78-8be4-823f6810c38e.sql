
ALTER TABLE public.closed_deals
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'ecommerce'
    CHECK (business_type IN ('ecommerce', 'local_service'));

ALTER TABLE public.client_progress
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'ecommerce'
    CHECK (business_type IN ('ecommerce', 'local_service'));
