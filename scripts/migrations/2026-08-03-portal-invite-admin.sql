-- ============================================================
-- Portail client TDIA — RPC admin pour générer un code d'invitation
-- 2026-08-03
-- ============================================================

-- 1) Politique de lecture : les admins voient tous les codes d'invitation
drop policy if exists client_portal_invites_admin_read on public.client_portal_invites;
create policy client_portal_invites_admin_read
  on public.client_portal_invites for select
  to authenticated
  using (public.is_global_admin());

-- 2) RPC : l'admin génère un code d'invitation pour un client_id donné
create or replace function public.create_portal_invite(
  p_client_id  uuid,
  p_note       text        default null,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code text;
begin
  if not public.is_global_admin() then
    raise exception 'not_authorized';
  end if;
  if p_client_id is null then
    raise exception 'client_id_required';
  end if;

  -- code court, lisible, uppercase (12 caractères hex)
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));

  insert into public.client_portal_invites (code, client_id, created_by, expires_at, note)
    values (v_code, p_client_id, auth.uid(), p_expires_at, p_note);

  return v_code;
end;
$fn$;

revoke all on function public.create_portal_invite(uuid, text, timestamptz) from public;
grant execute on function public.create_portal_invite(uuid, text, timestamptz) to authenticated;

-- 3) RPC : l'admin révoque un code (utile si envoyé au mauvais destinataire)
create or replace function public.revoke_portal_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_global_admin() then
    raise exception 'not_authorized';
  end if;
  update public.client_portal_invites
    set revoked_at = now()
    where code = p_code and revoked_at is null;
end;
$fn$;

revoke all on function public.revoke_portal_invite(text) from public;
grant execute on function public.revoke_portal_invite(text) to authenticated;
