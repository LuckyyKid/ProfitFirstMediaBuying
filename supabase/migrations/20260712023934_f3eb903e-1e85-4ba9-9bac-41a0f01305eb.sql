ALTER TABLE public.gos_basket_economics
  ADD COLUMN IF NOT EXISTS aov_new numeric,
  ADD COLUMN IF NOT EXISTS aov_repeat numeric,
  ADD COLUMN IF NOT EXISTS cac_new numeric,
  ADD COLUMN IF NOT EXISTS cac_repeat numeric,
  ADD COLUMN IF NOT EXISTS conversion_rate numeric,
  ADD COLUMN IF NOT EXISTS repeat_cycle_months numeric,
  ADD COLUMN IF NOT EXISTS churn_per_cycle numeric,
  ADD COLUMN IF NOT EXISTS inventory_days numeric,
  ADD COLUMN IF NOT EXISTS payout_delay_days numeric;

COMMENT ON COLUMN public.gos_basket_economics.aov_new IS 'Average order value for new customers';
COMMENT ON COLUMN public.gos_basket_economics.aov_repeat IS 'Average order value for repeat customers';
COMMENT ON COLUMN public.gos_basket_economics.cac_new IS 'Customer acquisition cost (new customers)';
COMMENT ON COLUMN public.gos_basket_economics.cac_repeat IS 'Reactivation cost per repeat customer';
COMMENT ON COLUMN public.gos_basket_economics.conversion_rate IS 'Sessions → orders conversion rate (0..1)';
COMMENT ON COLUMN public.gos_basket_economics.repeat_cycle_months IS 'Months between repeat purchases (Hemrock cycle)';
COMMENT ON COLUMN public.gos_basket_economics.churn_per_cycle IS 'Fraction of cohort lost per repeat cycle (0..1)';
COMMENT ON COLUMN public.gos_basket_economics.inventory_days IS 'Days of inventory on hand';
COMMENT ON COLUMN public.gos_basket_economics.payout_delay_days IS 'Days from sale to cash-in-bank (Shopify/Stripe payout)';