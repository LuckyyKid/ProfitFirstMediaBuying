-- Internal agency workspace: TDIA runs its OWN agency metrics through the
-- same GOS pipeline as its clients. Rather than fork the AGENCE screens,
-- we mark a single row in gos_clients as "internal" — it stays out of the
-- regular client list but the sidebar surfaces it as a pinned workspace
-- for admins.

ALTER TABLE public.gos_clients
  ADD COLUMN IF NOT EXISTS is_internal_agency BOOLEAN NOT NULL DEFAULT FALSE;

-- Only one internal-agency row can exist at a time.
CREATE UNIQUE INDEX IF NOT EXISTS gos_clients_one_internal_agency
  ON public.gos_clients ((TRUE))
  WHERE is_internal_agency = TRUE;

-- Idempotent seed of the TDIA row.
INSERT INTO public.gos_clients (
  client_code,
  company_name,
  business_type,
  current_phase,
  industry,
  is_internal_agency
)
SELECT
  'TDIA-INTERNAL',
  'TDIA',
  'AGENCE',
  'LIVE',
  'Agency',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.gos_clients WHERE is_internal_agency = TRUE
);
