-- Track when a lead responds so the follow-up sequence stops.
-- Also caps the sequence at 6 follow-ups: the cron runner enforces the
-- ceiling, but we keep a partial index on active sequences to keep the
-- scheduled scan cheap.

alter table public.sales_leads
  add column if not exists responded_at timestamptz;

-- Cron picks up leads that have a scheduled follow-up, are not closed,
-- have not replied, and haven't hit the 6-follow-up ceiling.
drop index if exists public.sales_leads_next_followup_idx;
create index if not exists sales_leads_next_followup_idx
  on public.sales_leads(next_followup_at)
  where status not in ('won','lost')
    and responded_at is null
    and followup_count < 6;
