
DROP POLICY IF EXISTS "Authenticated can manage gos_daily_pnl_targets" ON public.gos_daily_pnl_targets;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_daily_pnl_targets TO anon;

CREATE POLICY "gos_daily_pnl_targets_all"
ON public.gos_daily_pnl_targets
FOR ALL
USING (true)
WITH CHECK (true);
