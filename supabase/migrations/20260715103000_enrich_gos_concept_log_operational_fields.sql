alter table public.gos_concept_log
  add column if not exists offer text,
  add column if not exists landing_page_url text,
  add column if not exists primary_copy text,
  add column if not exists bid_strategy text,
  add column if not exists cost_cap numeric,
  add column if not exists expected_daily_spend numeric,
  add column if not exists campaign_link_url text,
  add column if not exists ads_per_concept integer;

create index if not exists gos_concept_log_client_offer_status_idx
  on public.gos_concept_log (client_id, offer, status);
