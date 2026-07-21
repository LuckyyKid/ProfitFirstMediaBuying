
create table if not exists public.gos_concept_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.gos_clients(id) on delete cascade,
  objective_id uuid references public.gos_business_objectives(id) on delete set null,
  concept_name text not null,
  angle text,               -- 'problem-agitate-solve', 'social-proof', 'ugc-testimonial', 'demo', 'founder-story'...
  hypothesis text,          -- "we believe X will drive Y because Z"
  audience text,
  format text,              -- 'video', 'static', 'carousel', 'ugc'...
  platform text,
  status text not null default 'draft',  -- draft | in_review | live | paused | winner | loser | archived
  launch_date date,
  end_date date,
  spend numeric default 0,
  impressions integer default 0,
  clicks integer default 0,
  orders integer default 0,
  revenue numeric default 0,
  cpa numeric,
  ctr numeric,
  verdict text,             -- 'winner' | 'loser' | 'inconclusive' | 'iterate'
  learning text,            -- what did we learn
  next_action text,         -- iterate / scale / kill
  tags text[],
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gos_concept_log to authenticated;
grant all on public.gos_concept_log to service_role;
alter table public.gos_concept_log enable row level security;
create policy "gos_concept_log_select" on public.gos_concept_log for select to authenticated using (true);
create policy "gos_concept_log_insert" on public.gos_concept_log for insert to authenticated with check (true);
create policy "gos_concept_log_update" on public.gos_concept_log for update to authenticated using (true) with check (true);
create policy "gos_concept_log_delete" on public.gos_concept_log for delete to authenticated using (true);
create index if not exists gos_concept_log_client_status_idx on public.gos_concept_log (client_id, status, launch_date desc);
create trigger gos_concept_log_updated_at before update on public.gos_concept_log
  for each row execute function public.update_updated_at_column();
