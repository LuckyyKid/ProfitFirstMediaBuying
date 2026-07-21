
create table if not exists public.gos_business_objectives (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.gos_clients(id) on delete cascade,
  objective_type text not null, -- 'acquire_new' | 'increase_aov' | 'improve_retention' | 'clear_inventory' | 'launch_product' | 'defend_share' | 'reactivate' | 'other'
  label text not null,
  primary_kpi text not null,     -- e.g. 'new_customers', 'aov', 'repeat_rate', 'inventory_days'
  target_value numeric,
  current_value numeric,
  timeframe_start date,
  timeframe_end date,
  rationale text,
  constraints_notes text,
  status text not null default 'active', -- 'active' | 'paused' | 'achieved' | 'abandoned'
  priority integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gos_business_objectives to authenticated;
grant all on public.gos_business_objectives to service_role;
alter table public.gos_business_objectives enable row level security;
create policy "gos_business_objectives_select" on public.gos_business_objectives for select to authenticated using (true);
create policy "gos_business_objectives_insert" on public.gos_business_objectives for insert to authenticated with check (true);
create policy "gos_business_objectives_update" on public.gos_business_objectives for update to authenticated using (true) with check (true);
create policy "gos_business_objectives_delete" on public.gos_business_objectives for delete to authenticated using (true);
create index if not exists gos_business_objectives_client_status_idx on public.gos_business_objectives (client_id, status, priority);

create trigger gos_business_objectives_updated_at
  before update on public.gos_business_objectives
  for each row execute function public.update_updated_at_column();
