-- Client preferred language for all outbound comms (welcome email, follow-ups,
-- seasonal broadcasts, Slack channel welcome). Set at deal-close time.
alter table public.client_progress
  add column if not exists client_language text not null default 'fr'
  check (client_language in ('fr','en'));
