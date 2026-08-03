-- ============================================================
-- Portail client TDIA — pivot sur client_code + vérification email
-- 2026-08-03
--
-- Le portail utilisera désormais client_code (identifiant partagé,
-- toujours présent) plutôt que client_id (uuid, seulement rempli
-- après signature du deal). Le flow d'invitation est supprimé :
-- le client se rattache en fournissant son client_code, et on
-- vérifie que l'email de la session correspond à l'email enregistré
-- dans client_progress pour ce code.
-- ============================================================

-- 1) Nettoyage : plus d'invites, plus de RPCs liées
drop function if exists public.redeem_portal_invite(text);
drop function if exists public.create_portal_invite(uuid, text, timestamptz);
drop function if exists public.revoke_portal_invite(text);
drop function if exists public.current_portal_client_id();
drop table if exists public.client_portal_invites cascade;

-- 2) Pivot de client_portal_users : client_id (uuid) → client_code (text)
alter table public.client_portal_users
  drop column if exists client_id;
alter table public.client_portal_users
  add column if not exists client_code text not null;

drop index if exists client_portal_users_client_id_idx;
create index if not exists client_portal_users_client_code_idx
  on public.client_portal_users(client_code);

-- 3) Helper de lecture : le frontend récupère LE client_code de la session
create or replace function public.current_portal_client_code()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select client_code from public.client_portal_users where user_id = auth.uid();
$fn$;

revoke all on function public.current_portal_client_code() from public;
grant execute on function public.current_portal_client_code() to authenticated;

-- 4) RPC de rattachement : vérifie l'email + lie user_id ↔ client_code
create or replace function public.redeem_portal_client_code(p_client_code text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user_id      uuid := auth.uid();
  v_user_email   text;
  v_client_email text;
  v_client_code  text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null or length(trim(v_user_email)) = 0 then
    raise exception 'user_email_missing';
  end if;

  select client_code, email
    into v_client_code, v_client_email
    from public.client_progress
    where upper(trim(client_code)) = upper(trim(p_client_code))
    limit 1;

  if v_client_code is null then
    raise exception 'unknown_client_code';
  end if;
  if v_client_email is null or length(trim(v_client_email)) = 0 then
    raise exception 'client_email_missing';
  end if;
  if lower(trim(v_client_email)) <> lower(trim(v_user_email)) then
    raise exception 'email_mismatch';
  end if;

  insert into public.client_portal_users (user_id, client_code, role)
    values (v_user_id, v_client_code, 'client')
    on conflict (user_id) do update
      set client_code = excluded.client_code,
          updated_at  = now();

  return v_client_code;
end;
$fn$;

revoke all on function public.redeem_portal_client_code(text) from public;
grant execute on function public.redeem_portal_client_code(text) to authenticated;
