-- Sales pipeline tracking: leads + sales reps (independent of client_progress
-- so we can log leads that never convert).

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- LEAD-XXXXXXXX code, same shape as CLI-XXXXXXXX for client_progress.
create or replace function public.generate_lead_code()
returns text
language plpgsql
as $$
declare
  new_code text;
begin
  loop
    new_code := 'LEAD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.sales_leads where lead_code = new_code);
  end loop;
  return new_code;
end;
$$;

create table if not exists public.sales_leads (
  lead_code text primary key default public.generate_lead_code(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_contact_at timestamptz,

  first_name text,
  last_name text,
  company text,
  industry text,
  business_type text check (business_type in ('saas','ecom','service','other')),
  email text,
  phone text,

  source text,
  status text not null default 'new'
    check (status in ('new','contacted','qualified','proposal','won','lost')),
  qualification_score smallint check (qualification_score between 1 and 5),
  onboarding_booked_at timestamptz,

  owner_id uuid references public.sales_reps(id) on delete set null,

  next_followup_at timestamptz,
  last_followup_at timestamptz,
  followup_count integer not null default 0,
  notes text,

  converted_client_code text,
  converted_at timestamptz
);

create index if not exists sales_leads_status_idx on public.sales_leads(status);
create index if not exists sales_leads_owner_idx on public.sales_leads(owner_id);
create index if not exists sales_leads_created_at_idx on public.sales_leads(created_at desc);
create index if not exists sales_leads_next_followup_idx on public.sales_leads(next_followup_at)
  where status not in ('won','lost');

create or replace function public.touch_sales_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sales_leads_updated_at on public.sales_leads;
create trigger trg_sales_leads_updated_at
  before update on public.sales_leads
  for each row execute function public.touch_sales_leads_updated_at();

alter table public.sales_reps enable row level security;
alter table public.sales_leads enable row level security;

drop policy if exists sales_reps_admin_all on public.sales_reps;
create policy sales_reps_admin_all on public.sales_reps
  for all using (public.is_global_admin()) with check (public.is_global_admin());

drop policy if exists sales_leads_admin_all on public.sales_leads;
create policy sales_leads_admin_all on public.sales_leads
  for all using (public.is_global_admin()) with check (public.is_global_admin());
