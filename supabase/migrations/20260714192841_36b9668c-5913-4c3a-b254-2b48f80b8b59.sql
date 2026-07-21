
create table if not exists public.gos_creative_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.gos_clients(id) on delete cascade,
  objective_id uuid references public.gos_business_objectives(id) on delete set null,
  title text not null,
  status text not null default 'draft', -- draft | in_review | approved | in_production | shipped | archived
  target_audience text,
  audience_pains text,
  audience_desires text,
  big_idea text,               -- the one-line hook
  core_promise text,
  proof_points text,           -- bullets / testimonials
  offer text,
  mandatory_elements text,     -- logo, disclaimers, product shot...
  do_not_use text,
  formats text[] default '{}', -- ['video-15s','static-1x1','carousel']
  platforms text[] default '{}',
  deliverables_count integer default 1,
  due_date date,
  reference_winners uuid[] default '{}', -- concept_log ids
  reference_links text,
  brand_voice text,
  generated_brief text,        -- AI-composed final brief
  generated_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gos_creative_briefs to authenticated;
grant all on public.gos_creative_briefs to service_role;
alter table public.gos_creative_briefs enable row level security;
create policy "gos_creative_briefs_select" on public.gos_creative_briefs for select to authenticated using (true);
create policy "gos_creative_briefs_insert" on public.gos_creative_briefs for insert to authenticated with check (true);
create policy "gos_creative_briefs_update" on public.gos_creative_briefs for update to authenticated using (true) with check (true);
create policy "gos_creative_briefs_delete" on public.gos_creative_briefs for delete to authenticated using (true);
create index if not exists gos_creative_briefs_client_status_idx on public.gos_creative_briefs (client_id, status, due_date);
create trigger gos_creative_briefs_updated_at before update on public.gos_creative_briefs
  for each row execute function public.update_updated_at_column();
