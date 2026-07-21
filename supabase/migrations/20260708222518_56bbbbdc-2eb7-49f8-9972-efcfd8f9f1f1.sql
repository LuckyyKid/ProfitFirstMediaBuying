-- Fix Waves 3-5 RLS + grants: match Waves 1-2 pattern.
-- App auth is a shared admin bearer token (not Supabase Auth), so the anon client
-- must be able to read/write these tables. The entire /admin/gos surface is gated
-- at the application layer.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gos_forecasts','gos_metric_targets','gos_weekly_pnl_targets','gos_creative_demand_runs',
    'gos_growth_execution_maps','gos_growth_execution_items','gos_live_optimization_reviews',
    'gos_measurement_snapshots','gos_measurement_tests','gos_forecast_updates',
    'gos_learning_entries','gos_next_cycle_plans','gos_client_intelligence_snapshots'
  ] LOOP
    -- Drop any pre-existing policies to avoid duplicates
    EXECUTE format('DO $inner$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE tablename=%L LOOP EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%%I'', r.policyname, %L); END LOOP; END $inner$;', t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', t||'_all', t);
  END LOOP;
END $$;