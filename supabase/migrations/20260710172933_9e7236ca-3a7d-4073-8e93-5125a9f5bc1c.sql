
-- ============================================================
-- Phase 1A-0 : Fondations sécurité (sans casser l'existant)
-- ============================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('global_admin', 'admin', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_member_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABLE user_roles (rôles globaux TDIA)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. TABLE gos_client_members (appartenance par client)
CREATE TABLE IF NOT EXISTS public.gos_client_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.client_member_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

CREATE INDEX IF NOT EXISTS gos_client_members_client_idx ON public.gos_client_members(client_id);
CREATE INDEX IF NOT EXISTS gos_client_members_user_idx ON public.gos_client_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_client_members TO authenticated;
GRANT ALL ON public.gos_client_members TO service_role;

ALTER TABLE public.gos_client_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_gos_client_members_updated
  BEFORE UPDATE ON public.gos_client_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. FONCTIONS DE SÉCURITÉ (SECURITY DEFINER, évitent la récursion RLS)
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'global_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_gos_client_member(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gos_client_members
    WHERE user_id = auth.uid() AND client_id = _client_id
  );
$$;

-- Rôle minimum (ordre : viewer < analyst < admin < owner)
CREATE OR REPLACE FUNCTION public.has_gos_client_role(_client_id uuid, _min_role public.client_member_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rank AS (
    SELECT CASE _min_role
      WHEN 'viewer' THEN 1
      WHEN 'analyst' THEN 2
      WHEN 'admin' THEN 3
      WHEN 'owner' THEN 4
    END AS need
  ),
  mine AS (
    SELECT CASE role
      WHEN 'viewer' THEN 1
      WHEN 'analyst' THEN 2
      WHEN 'admin' THEN 3
      WHEN 'owner' THEN 4
    END AS lvl
    FROM public.gos_client_members
    WHERE user_id = auth.uid() AND client_id = _client_id
  )
  SELECT COALESCE((SELECT MAX(lvl) FROM mine), 0) >= (SELECT need FROM rank);
$$;

-- 5. POLICIES sur les deux nouvelles tables
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;
CREATE POLICY user_roles_admin_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

DROP POLICY IF EXISTS gos_client_members_select ON public.gos_client_members;
CREATE POLICY gos_client_members_select ON public.gos_client_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_global_admin()
    OR public.has_gos_client_role(client_id, 'admin')
  );

DROP POLICY IF EXISTS gos_client_members_write ON public.gos_client_members;
CREATE POLICY gos_client_members_write ON public.gos_client_members
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR public.has_gos_client_role(client_id, 'admin')
  )
  WITH CHECK (
    public.is_global_admin()
    OR public.has_gos_client_role(client_id, 'admin')
  );
