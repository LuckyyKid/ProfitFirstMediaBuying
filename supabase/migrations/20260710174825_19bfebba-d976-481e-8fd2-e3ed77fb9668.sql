
-- Enable Supabase Vault (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Add vault reference
ALTER TABLE public.gos_integration_connections
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid;

-- Drop plaintext credentials column (verified 0 rows have data)
ALTER TABLE public.gos_integration_connections
  DROP COLUMN IF EXISTS credentials;

-- Prevent the frontend from ever writing vault_secret_id directly
REVOKE UPDATE (vault_secret_id) ON public.gos_integration_connections FROM authenticated;
REVOKE INSERT (vault_secret_id) ON public.gos_integration_connections FROM authenticated;
