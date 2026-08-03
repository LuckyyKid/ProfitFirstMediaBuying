-- ============================================================
-- Portail client TDIA — auth + lien user ↔ client_id
-- 2026-08-03
-- ============================================================

-- 1) Table de liaison : un utilisateur Supabase Auth = un client_id
create table if not exists public.client_portal_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  client_id    uuid not null,
  role         text not null default 'client' check (role in ('client','client_admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_portal_users_client_id_idx
  on public.client_portal_users(client_id);

-- 2) Codes d'invitation générés par l'AM depuis l'admin
create table if not exists public.client_portal_invites (
  code         text primary key,
  client_id    uuid not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  used_by      uuid references auth.users(id) on delete set null,
  used_at      timestamptz,
  revoked_at   timestamptz,
  note         text
);
create index if not exists client_portal_invites_client_id_idx
  on public.client_portal_invites(client_id);
create index if not exists client_portal_invites_active_idx
  on public.client_portal_invites(client_id)
  where used_at is null and revoked_at is null;

-- 3) RLS : le client ne voit que sa propre ligne de liaison
alter table public.client_portal_users    enable row level security;
alter table public.client_portal_invites  enable row level security;

drop policy if exists client_portal_users_self_read on public.client_portal_users;
create policy client_portal_users_self_read
  on public.client_portal_users for select
  to authenticated
  using (user_id = auth.uid());

-- 4) RPC atomique : le client redeem son code juste après signup
create or replace function public.redeem_portal_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_client_id uuid;
  v_user_id   uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select client_id into v_client_id
    from public.client_portal_invites
    where code = p_code
      and used_at is null
      and revoked_at is null
      and (expires_at is null or expires_at > now())
    for update;

  if v_client_id is null then
    raise exception 'invalid_or_expired_code';
  end if;

  insert into public.client_portal_users (user_id, client_id, role)
    values (v_user_id, v_client_id, 'client')
    on conflict (user_id) do update
      set client_id = excluded.client_id,
          updated_at = now();

  update public.client_portal_invites
    set used_by = v_user_id, used_at = now()
    where code = p_code;

  return v_client_id;
end;
$fn$;

revoke all on function public.redeem_portal_invite(text) from public;
grant execute on function public.redeem_portal_invite(text) to authenticated;

-- 5) Helper de lecture : le frontend obtient LE client_id de la session courante
create or replace function public.current_portal_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select client_id from public.client_portal_users where user_id = auth.uid();
$fn$;

grant execute on function public.current_portal_client_id() to authenticated;
