-- Voice onboarding: table for recorded/transcribed answers + private storage bucket.
-- Writes always go through the voice-upload edge function (service_role); no direct
-- client access is granted. Transcript is filled asynchronously by back-office.

create table if not exists public.voice_answers (
  id uuid primary key default gen_random_uuid(),
  client_code text not null,
  form_key text not null check (form_key in ('welcome','founder_scan','business_deep_dive')),
  question_id text not null,
  audio_bucket text,
  audio_path text,
  audio_mime text,
  transcript text,
  duration_ms integer not null default 0,
  status text not null default 'complete'
    check (status in ('complete','short','text_fallback','missing','skipped')),
  written_fallback text,
  target_field_ids jsonb not null default '[]'::jsonb,
  ambient_noise_warning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_code, form_key, question_id)
);

create index if not exists idx_voice_answers_client
  on public.voice_answers (client_code);
create index if not exists idx_voice_answers_client_form
  on public.voice_answers (client_code, form_key);

alter table public.voice_answers enable row level security;

-- No client-facing policies. All writes/reads go through service_role in edge functions
-- (voice-upload for writes, and later a session-status function if we need reads).

-- Private storage bucket for raw audio blobs.
insert into storage.buckets (id, name, public)
values ('onboarding-voice', 'onboarding-voice', false)
on conflict (id) do nothing;

-- No storage policies for anon/authenticated: only service_role (edge function) uploads.
