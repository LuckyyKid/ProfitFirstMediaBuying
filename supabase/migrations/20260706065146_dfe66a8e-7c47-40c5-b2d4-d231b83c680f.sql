
-- model_versions
create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  version text not null,
  description text,
  formula_json jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by text,
  constraint model_versions_model_name_version_unique unique (model_name, version)
);

grant select on public.model_versions to authenticated;
grant all on public.model_versions to service_role;
alter table public.model_versions enable row level security;
create policy "model_versions readable by authenticated"
  on public.model_versions for select to authenticated using (true);

insert into public.model_versions (model_name, version, description, formula_json, created_by) values
  ('decision_scoring_engine','v1.0','Scores approved hypotheses and classifies operational priority.',
   '{"decision_score":"(business_impact * 25) + (goal_alignment * 20) + (evidence_strength * 20) + (confidence_score * 15) + (urgency * 10) + (ease_of_execution * 10) - (risk * 15) - (dependency_level * 10)","priority_order":["dependency_level = 5 => Blocked","risk = 5 => Needs Review","evidence_strength <= 2 and confidence_score <= 2 => Research Needed","goal_alignment <= 2 => P2 Maximum / Not P0","decision_score >= 350 => P0","decision_score >= 275 => P1","decision_score >= 200 => P2","else => Low Priority"]}'::jsonb,
   'tdia-intelligence-engine'),
  ('forecast_engine','v1.0','Creates conditional forecasts from selected P0/P1 hypotheses.',
   '{"forecast_lift_low":"sum(expected_lift_min) * overlap_discount","forecast_lift_base":"sum(expected_lift_base) * overlap_discount","forecast_lift_high":"sum(expected_lift_max) * overlap_discount","confidence_score":"sum confidence positives - risk_penalty - dependency_penalty, clamped 0-100","required_summary":"This is a conditional forecast, not a guarantee."}'::jsonb,
   'tdia-intelligence-engine'),
  ('metric_targets_engine','v1.0','Translates forecast lift and explicit business goals into operating targets.',
   '{"rules":["Explicit goal target wins when present.","Projected targets are calculated only for impacted metrics.","Revenue target is not invented without explicit AM input or spend/conversion assumptions."]}'::jsonb,
   'tdia-intelligence-engine'),
  ('creative_demand_engine','v1.0','Estimates creative supply risk and deterministic creative output need.',
   '{"risk_rules":{"concentration":"share > 0.60 high, 0.40-0.60 medium, <0.40 low","fatigue":"frequency > 5 high, 3-5 medium, <3 low","supply":"0 new creatives high, <8 medium, >=8 low"},"split":"60% video, 40% static"}'::jsonb,
   'tdia-intelligence-engine')
on conflict (model_name, version) do nothing;

-- model_runs
create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  model_name text not null,
  model_version text not null,
  input_json jsonb not null,
  output_json jsonb not null,
  formula_used jsonb,
  generated_at timestamptz default now(),
  generated_by text,
  am_approved boolean default false,
  am_override boolean default false,
  override_reason text,
  constraint model_runs_override_reason_required check (
    coalesce(am_override, false) = false
    or nullif(trim(override_reason), '') is not null
  )
);

create index if not exists model_runs_client_id_idx on public.model_runs (client_id);
create index if not exists model_runs_model_name_version_idx on public.model_runs (model_name, model_version);
create index if not exists model_runs_generated_at_idx on public.model_runs (generated_at desc);

grant select, insert, update on public.model_runs to authenticated;
grant all on public.model_runs to service_role;
alter table public.model_runs enable row level security;
create policy "model_runs readable by authenticated"
  on public.model_runs for select to authenticated using (true);
create policy "model_runs writable by authenticated"
  on public.model_runs for insert to authenticated with check (true);
create policy "model_runs updatable by authenticated"
  on public.model_runs for update to authenticated using (true) with check (true);
