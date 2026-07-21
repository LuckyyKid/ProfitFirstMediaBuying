
-- ============================================================
-- Phase 1A part 2 : Close all open USING(true) policies
-- ============================================================

DO $$
DECLARE
  t text;
  -- All GOS tables with a client_id column (excluding gos_clients, gos_client_members)
  gos_client_id_tables text[] := ARRAY[
    'gos_basket_economics','gos_business_contexts','gos_capacity_snapshots',
    'gos_client_intelligence_snapshots','gos_creative_demand_runs',
    'gos_customer_activity_snapshots','gos_daily_pnl_targets','gos_data_sources',
    'gos_diagnoses','gos_event_effects','gos_financial_inputs','gos_forecast_updates',
    'gos_forecasts','gos_funnel_economics','gos_gross_to_net_snapshots',
    'gos_growth_execution_items','gos_growth_execution_maps','gos_integration_connections',
    'gos_integration_sync_runs','gos_inventory_grade_snapshots','gos_inventory_snapshots',
    'gos_learning_entries','gos_live_optimization_reviews','gos_measurement_snapshots',
    'gos_measurement_tests','gos_metric_targets','gos_next_cycle_plans',
    'gos_offer_economics_runs','gos_opex_allocation_settings','gos_order_value_distributions',
    'gos_pnl_snapshots','gos_product_financial_profiles','gos_products',
    'gos_quantitative_baselines','gos_retention_snapshots','gos_services',
    'gos_sku_demand_plans','gos_spending_power_snapshots','gos_weekly_pnl_targets'
  ];
  crm_tables text[] := ARRAY[
    'crm_audit_syntheses','crm_business_context','crm_clients','crm_creative_demand_plans',
    'crm_cro_offer_audits','crm_decision_scores','crm_experimental_history',
    'crm_financial_inputs','crm_forecasts','crm_growth_execution_maps','crm_hypotheses',
    'crm_learning_library','crm_live_optimization_reviews','crm_market_research',
    'crm_metric_targets','crm_quant_analysis_outputs','crm_quantitative_baselines'
  ];
  pol record;
BEGIN
  -- 1) Drop every existing open (qual='true') policy on all target tables
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename LIKE 'gos_%' OR tablename LIKE 'crm_%')
      AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;

  -- 2) GOS tables scoped by client_id membership
  FOREACH t IN ARRAY gos_client_id_tables LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.is_global_admin() OR public.is_gos_client_member(client_id));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$s_insert" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (public.is_global_admin() OR public.is_gos_client_member(client_id));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$s_update" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (public.is_global_admin() OR public.is_gos_client_member(client_id))
        WITH CHECK (public.is_global_admin() OR public.is_gos_client_member(client_id));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$s_delete" ON public.%1$I
        FOR DELETE TO authenticated
        USING (public.is_global_admin() OR public.is_gos_client_member(client_id));
    $f$, t);
  END LOOP;

  -- 3) gos_clients (uses id, not client_id)
  EXECUTE 'CREATE POLICY "gos_clients_select" ON public.gos_clients
    FOR SELECT TO authenticated
    USING (public.is_global_admin() OR public.is_gos_client_member(id))';
  EXECUTE 'CREATE POLICY "gos_clients_insert" ON public.gos_clients
    FOR INSERT TO authenticated
    WITH CHECK (public.is_global_admin())';
  EXECUTE 'CREATE POLICY "gos_clients_update" ON public.gos_clients
    FOR UPDATE TO authenticated
    USING (public.is_global_admin() OR public.has_gos_client_role(id, ''admin''::client_member_role))
    WITH CHECK (public.is_global_admin() OR public.has_gos_client_role(id, ''admin''::client_member_role))';
  EXECUTE 'CREATE POLICY "gos_clients_delete" ON public.gos_clients
    FOR DELETE TO authenticated
    USING (public.is_global_admin())';

  -- 4) CRM tables: global_admin only (Phase 1A; membership model can be added later)
  FOREACH t IN ARRAY crm_tables LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_admin_all" ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_global_admin())
        WITH CHECK (public.is_global_admin());
    $f$, t);
  END LOOP;
END $$;

-- 5) Trigger on gos_clients to auto-seed owner membership on creation by global_admin
CREATE OR REPLACE FUNCTION public.gos_clients_seed_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.gos_client_members (client_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner')
    ON CONFLICT (client_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gos_clients_seed_owner ON public.gos_clients;
CREATE TRIGGER trg_gos_clients_seed_owner
AFTER INSERT ON public.gos_clients
FOR EACH ROW EXECUTE FUNCTION public.gos_clients_seed_owner();
