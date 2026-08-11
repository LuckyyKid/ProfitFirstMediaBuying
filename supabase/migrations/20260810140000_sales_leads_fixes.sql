-- Fix generate_lead_code() to not depend on pgcrypto's gen_random_bytes()
-- (not available on Lovable Cloud without extra extension setup). Use
-- gen_random_uuid() instead, which is always available.
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

-- Add business type (SaaS / ecom / service / other) to categorize leads.
alter table public.sales_leads
  add column if not exists business_type text
  check (business_type in ('saas','ecom','service','other'));
