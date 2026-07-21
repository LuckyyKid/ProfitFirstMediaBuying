
create table if not exists public.gos_campaign_daily_perf (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.gos_clients(id) on delete cascade,
  campaign_id uuid not null references public.gos_campaigns(id) on delete cascade,
  perf_date date not null,
  spend numeric not null default 0,
  orders integer not null default 0,
  leads integer not null default 0,
  revenue numeric not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, perf_date)
);
grant select, insert, update, delete on public.gos_campaign_daily_perf to authenticated;
grant all on public.gos_campaign_daily_perf to service_role;
alter table public.gos_campaign_daily_perf enable row level security;
create policy "gos_campaign_daily_perf_select" on public.gos_campaign_daily_perf for select to authenticated using (true);
create policy "gos_campaign_daily_perf_insert" on public.gos_campaign_daily_perf for insert to authenticated with check (true);
create policy "gos_campaign_daily_perf_update" on public.gos_campaign_daily_perf for update to authenticated using (true) with check (true);
create policy "gos_campaign_daily_perf_delete" on public.gos_campaign_daily_perf for delete to authenticated using (true);
create index if not exists gos_campaign_daily_perf_client_date_idx on public.gos_campaign_daily_perf (client_id, perf_date desc);

create table if not exists public.gos_buyer_decisions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.gos_clients(id) on delete cascade,
  campaign_id uuid not null references public.gos_campaigns(id) on delete cascade,
  decision_date date not null default (now() at time zone 'utc')::date,
  decision_type text not null,
  previous_budget numeric,
  new_budget numeric,
  reasoning text,
  expected_impact text,
  actual_cpa numeric,
  target_cpa numeric,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gos_buyer_decisions to authenticated;
grant all on public.gos_buyer_decisions to service_role;
alter table public.gos_buyer_decisions enable row level security;
create policy "gos_buyer_decisions_select" on public.gos_buyer_decisions for select to authenticated using (true);
create policy "gos_buyer_decisions_insert" on public.gos_buyer_decisions for insert to authenticated with check (true);
create policy "gos_buyer_decisions_update" on public.gos_buyer_decisions for update to authenticated using (true) with check (true);
create policy "gos_buyer_decisions_delete" on public.gos_buyer_decisions for delete to authenticated using (true);
create index if not exists gos_buyer_decisions_client_date_idx on public.gos_buyer_decisions (client_id, decision_date desc);
