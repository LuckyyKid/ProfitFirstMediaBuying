
-- ============ TDIA Intelligence CRM V1 ============
-- 17 tables préfixées crm_ pour isoler du reste du schéma.

-- helper: updated_at trigger (réutilise public.update_updated_at_column existant)

-- 1. crm_clients
CREATE TABLE public.crm_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text UNIQUE,
  company_name text NOT NULL,
  website_url text,
  industry text,
  business_model text,
  main_contact_name text,
  main_contact_email text,
  main_contact_phone text,
  am_owner_id uuid,
  am_owner_name text,
  offer_sold text,
  platforms_managed text[],
  lead_source text,
  deal_value numeric,
  monthly_retainer numeric,
  closing_date date,
  launch_target_date date,
  current_phase text DEFAULT 'Not Started',
  risk_level text DEFAULT 'Low',
  clickup_client_task_id text,
  clickup_task_url text,
  clickup_status text,
  slack_channel text,
  drive_folder_url text,
  hub_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_clients TO authenticated, anon;
GRANT ALL ON public.crm_clients TO service_role;
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_clients all" ON public.crm_clients FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_clients_updated BEFORE UPDATE ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. crm_business_context
CREATE TABLE public.crm_business_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  mission text, one_year_vision text, ten_year_vision text,
  goal_lock text, success_3_months text, primary_kpi text,
  monthly_revenue numeric, annual_revenue numeric,
  weekly_ad_budget numeric, monthly_ad_budget numeric,
  target_country text, target_customer text,
  products_to_push text, products_to_avoid text, best_selling_product text,
  main_value_proposition text, top_competitors text, known_objections text,
  founder_profile text, founder_strengths text, founder_weaknesses text,
  communication_preference text, feedback_availability text,
  decision_makers text, approval_risk text, strategic_guardrails text,
  status text DEFAULT 'Not Started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_business_context TO authenticated, anon;
GRANT ALL ON public.crm_business_context TO service_role;
ALTER TABLE public.crm_business_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_business_context all" ON public.crm_business_context FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_bc_updated BEFORE UPDATE ON public.crm_business_context FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. crm_financial_inputs
CREATE TABLE public.crm_financial_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  gross_margin_percent numeric,
  average_cogs numeric, average_shipping_cost numeric, average_fulfillment_cost numeric,
  refund_rate_percent numeric,
  target_cac numeric, target_mer numeric, target_roas numeric,
  payback_window text, top_product_margin_notes text,
  stock_risk text, claims_allowed text, claims_forbidden text, legal_risk_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_financial_inputs TO authenticated, anon;
GRANT ALL ON public.crm_financial_inputs TO service_role;
ALTER TABLE public.crm_financial_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_financial_inputs all" ON public.crm_financial_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_fi_updated BEFORE UPDATE ON public.crm_financial_inputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. crm_market_research
CREATE TABLE public.crm_market_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  competitor_name text, source_type text, source_url text,
  finding_type text, finding_text text, customer_voice_quote text,
  objection text, desire text, icp_segment text,
  creative_angle text, competitor_gap text, claim_risk text,
  evidence_strength int, confidence int, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_market_research TO authenticated, anon;
GRANT ALL ON public.crm_market_research TO service_role;
ALTER TABLE public.crm_market_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_market_research all" ON public.crm_market_research FOR ALL USING (true) WITH CHECK (true);

-- 5. crm_quantitative_baselines
CREATE TABLE public.crm_quantitative_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  period text DEFAULT '30d',
  meta_spend numeric, meta_impressions numeric, meta_reach numeric,
  meta_cpm numeric, meta_clicks numeric, meta_ctr numeric, meta_cpc numeric,
  meta_purchases numeric, meta_cpa numeric, meta_purchase_value numeric,
  meta_roas numeric, meta_frequency numeric,
  meta_top_ads text, meta_worst_ads text,
  shopify_revenue numeric, shopify_orders numeric, shopify_aov numeric,
  shopify_total_customers numeric, shopify_new_customers numeric, shopify_returning_customers numeric,
  shopify_conversion_rate numeric, shopify_refund_amount numeric, shopify_refund_rate numeric,
  shopify_discount_amount numeric,
  ga4_sessions numeric, ga4_users numeric, ga4_add_to_cart numeric,
  ga4_begin_checkout numeric, ga4_purchases numeric, ga4_purchase_conversion_rate numeric,
  ga4_add_to_cart_rate numeric, ga4_checkout_rate numeric,
  mobile_conversion_rate numeric, desktop_conversion_rate numeric,
  google_ads_applicable boolean DEFAULT false,
  google_ads_spend numeric, google_ads_clicks numeric, google_ads_ctr numeric,
  google_ads_cpc numeric, google_ads_conversions numeric, google_ads_cpa numeric,
  google_ads_conversion_value numeric, google_ads_roas numeric,
  notes text, status text DEFAULT 'Not Started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quantitative_baselines TO authenticated, anon;
GRANT ALL ON public.crm_quantitative_baselines TO service_role;
ALTER TABLE public.crm_quantitative_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_quantitative_baselines all" ON public.crm_quantitative_baselines FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_qb_updated BEFORE UPDATE ON public.crm_quantitative_baselines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. crm_quant_analysis_outputs
CREATE TABLE public.crm_quant_analysis_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  quantitative_baseline_id uuid REFERENCES public.crm_quantitative_baselines(id) ON DELETE SET NULL,
  revenue_30d numeric, total_ad_spend_30d numeric, blended_mer numeric,
  blended_cac numeric, estimated_break_even_cac numeric,
  current_cac_vs_target numeric, current_cac_vs_break_even numeric,
  gross_profit_per_order numeric,
  creative_fatigue_risk text, spend_concentration_risk text,
  stock_constraint_risk text, tracking_confidence text,
  baseline_health_score int,
  main_quantitative_problem text, secondary_quantitative_problem text,
  quant_risk_level text, quant_diagnosis text,
  missing_data_summary text, am_manual_checks text, next_analysis_step text,
  am_validated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quant_analysis_outputs TO authenticated, anon;
GRANT ALL ON public.crm_quant_analysis_outputs TO service_role;
ALTER TABLE public.crm_quant_analysis_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_quant_analysis_outputs all" ON public.crm_quant_analysis_outputs FOR ALL USING (true) WITH CHECK (true);

-- 7. crm_experimental_history
CREATE TABLE public.crm_experimental_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  campaign_name text, test_period text, channel text,
  angle text, hook text, format text, offer text, landing_page text,
  spend numeric, cpa numeric, roas numeric, ctr numeric,
  result text, pattern_type text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_experimental_history TO authenticated, anon;
GRANT ALL ON public.crm_experimental_history TO service_role;
ALTER TABLE public.crm_experimental_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_experimental_history all" ON public.crm_experimental_history FOR ALL USING (true) WITH CHECK (true);

-- 8. crm_cro_offer_audits
CREATE TABLE public.crm_cro_offer_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  page_url text, page_type text, friction_type text,
  finding text, evidence text, severity text,
  expected_impact text, recommendation text, priority text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_cro_offer_audits TO authenticated, anon;
GRANT ALL ON public.crm_cro_offer_audits TO service_role;
ALTER TABLE public.crm_cro_offer_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_cro_offer_audits all" ON public.crm_cro_offer_audits FOR ALL USING (true) WITH CHECK (true);

-- 9. crm_audit_syntheses
CREATE TABLE public.crm_audit_syntheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  goal_lock text, strategic_context text,
  primary_problem_category text, primary_problem text, secondary_problems text,
  quant_evidence text, market_evidence text, experimental_evidence text,
  cro_offer_evidence text, business_context_evidence text,
  key_uncertainties text, priority_levers text, rejected_or_delayed_levers text,
  strategic_diagnosis text, confidence_level text, next_step text,
  am_approved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_audit_syntheses TO authenticated, anon;
GRANT ALL ON public.crm_audit_syntheses TO service_role;
ALTER TABLE public.crm_audit_syntheses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_audit_syntheses all" ON public.crm_audit_syntheses FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_as_updated BEFORE UPDATE ON public.crm_audit_syntheses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. crm_hypotheses
CREATE TABLE public.crm_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  audit_synthesis_id uuid REFERENCES public.crm_audit_syntheses(id) ON DELETE SET NULL,
  category text, hypothesis text, evidence text,
  goal_alignment text, test_description text,
  primary_metric text, secondary_metrics text,
  expected_lift_min numeric, expected_lift_base numeric, expected_lift_max numeric,
  timeline text, confidence text, risk text, dependencies text,
  suggested_priority text, status text DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_hypotheses TO authenticated, anon;
GRANT ALL ON public.crm_hypotheses TO service_role;
ALTER TABLE public.crm_hypotheses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_hypotheses all" ON public.crm_hypotheses FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_hy_updated BEFORE UPDATE ON public.crm_hypotheses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. crm_decision_scores
CREATE TABLE public.crm_decision_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  hypothesis_id uuid REFERENCES public.crm_hypotheses(id) ON DELETE CASCADE,
  business_impact int, goal_alignment int, evidence_strength int,
  confidence_score int, ease_of_execution int, urgency int,
  risk int, dependency_level int, expected_time_to_result int,
  decision_score numeric, priority text,
  override_priority text, override_reason text,
  am_approved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_decision_scores TO authenticated, anon;
GRANT ALL ON public.crm_decision_scores TO service_role;
ALTER TABLE public.crm_decision_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_decision_scores all" ON public.crm_decision_scores FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_ds_updated BEFORE UPDATE ON public.crm_decision_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. crm_forecasts
CREATE TABLE public.crm_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  forecast_name text, forecast_period text, goal text,
  selected_hypotheses uuid[],
  expected_result text,
  expected_lift_low numeric, expected_lift_base numeric, expected_lift_high numeric,
  timeline text,
  confidence_score numeric, confidence_label text,
  conditions text, risks text, dependencies text,
  forecast_status text DEFAULT 'Draft',
  am_approved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_forecasts TO authenticated, anon;
GRANT ALL ON public.crm_forecasts TO service_role;
ALTER TABLE public.crm_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_forecasts all" ON public.crm_forecasts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_fc_updated BEFORE UPDATE ON public.crm_forecasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. crm_metric_targets
CREATE TABLE public.crm_metric_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES public.crm_forecasts(id) ON DELETE SET NULL,
  period text, north_star_metric text,
  revenue_target numeric, ad_spend_target numeric, mer_target numeric,
  cac_target numeric, contribution_margin_proxy_target numeric,
  new_customers_target numeric, returning_revenue_target numeric,
  meta_spend_target numeric, meta_cac_target numeric, meta_roas_target numeric,
  google_spend_target numeric, google_roas_target numeric,
  email_revenue_target numeric, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_metric_targets TO authenticated, anon;
GRANT ALL ON public.crm_metric_targets TO service_role;
ALTER TABLE public.crm_metric_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_metric_targets all" ON public.crm_metric_targets FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_mt_updated BEFORE UPDATE ON public.crm_metric_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. crm_creative_demand_plans
CREATE TABLE public.crm_creative_demand_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES public.crm_forecasts(id) ON DELETE SET NULL,
  total_creatives_needed int, videos_needed int, statics_needed int,
  priority_products text, priority_angles text,
  creative_risk_level text, rationale text,
  production_sources text, due_dates text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_creative_demand_plans TO authenticated, anon;
GRANT ALL ON public.crm_creative_demand_plans TO service_role;
ALTER TABLE public.crm_creative_demand_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_creative_demand_plans all" ON public.crm_creative_demand_plans FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_cdp_updated BEFORE UPDATE ON public.crm_creative_demand_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. crm_growth_execution_maps
CREATE TABLE public.crm_growth_execution_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES public.crm_forecasts(id) ON DELETE SET NULL,
  week_number int, weekly_goal text, planned_actions text,
  revenue_target numeric, spend_target numeric, cac_target numeric, mer_target numeric,
  creative_output_target int, key_milestone text, dependencies text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_growth_execution_maps TO authenticated, anon;
GRANT ALL ON public.crm_growth_execution_maps TO service_role;
ALTER TABLE public.crm_growth_execution_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_growth_execution_maps all" ON public.crm_growth_execution_maps FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_gem_updated BEFORE UPDATE ON public.crm_growth_execution_maps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. crm_live_optimization_reviews
CREATE TABLE public.crm_live_optimization_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  review_period text,
  revenue_target numeric, revenue_actual numeric,
  spend_target numeric, spend_actual numeric,
  cac_target numeric, cac_actual numeric,
  mer_target numeric, mer_actual numeric,
  ctr_actual numeric, cvr_actual numeric, atc_actual numeric,
  creative_output_target int, creative_output_actual int,
  variance_summary text, problem_type text,
  what_happened text, so_what text, now_what text,
  recommended_actions text, forecast_status text,
  client_success_payload text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_live_optimization_reviews TO authenticated, anon;
GRANT ALL ON public.crm_live_optimization_reviews TO service_role;
ALTER TABLE public.crm_live_optimization_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_live_optimization_reviews all" ON public.crm_live_optimization_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_lor_updated BEFORE UPDATE ON public.crm_live_optimization_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 17. crm_learning_library
CREATE TABLE public.crm_learning_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.crm_clients(id) ON DELETE SET NULL,
  industry text,
  hypothesis_id uuid REFERENCES public.crm_hypotheses(id) ON DELETE SET NULL,
  hypothesis text, action_taken text,
  expected_lift text, actual_lift text, result text,
  time_to_signal text, time_to_result text, decision text,
  creative_angle text, offer text, cro_module text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_learning_library TO authenticated, anon;
GRANT ALL ON public.crm_learning_library TO service_role;
ALTER TABLE public.crm_learning_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_learning_library all" ON public.crm_learning_library FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX ON public.crm_business_context (client_id);
CREATE INDEX ON public.crm_financial_inputs (client_id);
CREATE INDEX ON public.crm_market_research (client_id);
CREATE INDEX ON public.crm_quantitative_baselines (client_id);
CREATE INDEX ON public.crm_quant_analysis_outputs (client_id);
CREATE INDEX ON public.crm_experimental_history (client_id);
CREATE INDEX ON public.crm_cro_offer_audits (client_id);
CREATE INDEX ON public.crm_audit_syntheses (client_id);
CREATE INDEX ON public.crm_hypotheses (client_id);
CREATE INDEX ON public.crm_decision_scores (client_id);
CREATE INDEX ON public.crm_forecasts (client_id);
CREATE INDEX ON public.crm_metric_targets (client_id);
CREATE INDEX ON public.crm_creative_demand_plans (client_id);
CREATE INDEX ON public.crm_growth_execution_maps (client_id);
CREATE INDEX ON public.crm_live_optimization_reviews (client_id);
CREATE INDEX ON public.crm_learning_library (client_id);
