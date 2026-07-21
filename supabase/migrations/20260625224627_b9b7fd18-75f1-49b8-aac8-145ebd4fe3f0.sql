
CREATE TABLE public.closed_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Entreprise
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  -- Closing
  payment_type TEXT NOT NULL CHECK (payment_type IN ('one_time','recurring')),
  contract_value NUMERIC,
  monthly_amount NUMERIC,
  additional_monthly NUMERIC,
  closing_date DATE NOT NULL,
  closer_name TEXT NOT NULL,
  contract_pdf_path TEXT,
  -- Contact owner
  owner_name TEXT,
  owner_business TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  -- Fulfillment
  lead_source TEXT,
  engagement_duration TEXT,
  offers_sold TEXT[] DEFAULT '{}',
  platforms_to_manage TEXT[] DEFAULT '{}',
  main_objective TEXT,
  main_objections TEXT,
  target_launch_date DATE,
  risk_level TEXT CHECK (risk_level IN ('Low','Medium','High')),
  risk_reason TEXT,
  account_manager_notes TEXT,
  -- Contexte commercial
  ad_budget_monthly NUMERIC,
  has_run_ads BOOLEAN,
  owner_pain_point TEXT,
  -- Standard
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_deals TO anon;
GRANT ALL ON public.closed_deals TO service_role;

ALTER TABLE public.closed_deals ENABLE ROW LEVEL SECURITY;

-- Admin section uses a password-gated client area (no Supabase auth). Allow open access; protection is at the app layer.
CREATE POLICY "Open read closed_deals" ON public.closed_deals FOR SELECT USING (true);
CREATE POLICY "Open insert closed_deals" ON public.closed_deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update closed_deals" ON public.closed_deals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Open delete closed_deals" ON public.closed_deals FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_closed_deals_updated_at
BEFORE UPDATE ON public.closed_deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
