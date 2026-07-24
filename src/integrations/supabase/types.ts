export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      client_activity_log: {
        Row: {
          client_code: string
          created_at: string
          details: Json | null
          error: string | null
          event_type: string
          id: string
          status: string | null
        }
        Insert: {
          client_code: string
          created_at?: string
          details?: Json | null
          error?: string | null
          event_type: string
          id?: string
          status?: string | null
        }
        Update: {
          client_code?: string
          created_at?: string
          details?: Json | null
          error?: string | null
          event_type?: string
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      client_form_answers: {
        Row: {
          answer: string | null
          client_code: string
          created_at: string
          form_type: string
          id: string
          question_key: string
          question_label: string | null
          section: string | null
        }
        Insert: {
          answer?: string | null
          client_code: string
          created_at?: string
          form_type: string
          id?: string
          question_key: string
          question_label?: string | null
          section?: string | null
        }
        Update: {
          answer?: string | null
          client_code?: string
          created_at?: string
          form_type?: string
          id?: string
          question_key?: string
          question_label?: string | null
          section?: string | null
        }
        Relationships: []
      }
      client_platform_access: {
        Row: {
          client_code: string
          id: string
          notes: string | null
          platform: string
          status: string
          updated_at: string
        }
        Insert: {
          client_code: string
          id?: string
          notes?: string | null
          platform: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_code?: string
          id?: string
          notes?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_progress: {
        Row: {
          ad_budget: number | null
          alert_24h_sent: boolean | null
          alert_48h_sent: boolean | null
          already_runs_ads: boolean | null
          archived_at: string | null
          brand_name: string | null
          business_deep_dive_completed_at: string | null
          business_deep_dive_sheet_id: string | null
          business_deep_dive_sheet_url: string | null
          business_deep_dive_submitted: boolean
          business_type: string
          callback_due_at: string | null
          callback_notified_at: string | null
          churn_reason: string | null
          churned_at: string | null
          client_code: string
          client_id: string | null
          client_name: string | null
          closer_name: string | null
          closing_date: string | null
          company_name: string | null
          completed_at: string | null
          contract_completed_at: string | null
          contract_end_date: string | null
          contract_signed: boolean
          contract_start_date: string | null
          created_at: string
          current_step: number | null
          deal_value: number | null
          docusign_envelope_id: string | null
          docusign_link: string | null
          docusign_pdf_url: string | null
          docusign_sent_at: string | null
          docusign_signed_at: string | null
          docusign_viewed_at: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          email: string | null
          external_snapshot: Json | null
          external_snapshot_hash: string | null
          external_status: string | null
          external_sync_error: string | null
          external_synced_at: string | null
          followup_count: number
          followup_sent_at: string | null
          followup_step: number | null
          form_completed_at: string | null
          founder_scan_completed_at: string | null
          founder_scan_submitted: boolean
          founder_summary: Json | null
          internal_notes: string | null
          kickoff_calendar_link: string | null
          kickoff_completed_at: string | null
          kickoff_meeting_link: string | null
          kickoff_scheduled: boolean
          kickoff_scheduled_at: string | null
          last_activity_at: string | null
          lead_id: string | null
          lead_source: string | null
          manual_contract_pdf_url: string | null
          onboarding_sent_at: string | null
          owner_pain_point: string | null
          paid: boolean
          payment_completed_at: string | null
          phone: string | null
          platforms_completed_at: string | null
          sales_supervisor: string | null
          slack_channel_id: string | null
          slack_channel_name: string | null
          slack_invite_url: string | null
          slack_user_id: string | null
          stripe_amount_expected: number | null
          stripe_amount_paid: number | null
          stripe_customer_id: string | null
          stripe_link: string | null
          stuck_alert_at: string | null
          updated_at: string
          video_watched: boolean
          welcome_completed_at: string | null
          welcome_form_submitted: boolean
          welcome_sent_at: string | null
        }
        Insert: {
          ad_budget?: number | null
          alert_24h_sent?: boolean | null
          alert_48h_sent?: boolean | null
          already_runs_ads?: boolean | null
          archived_at?: string | null
          brand_name?: string | null
          business_deep_dive_completed_at?: string | null
          business_deep_dive_sheet_id?: string | null
          business_deep_dive_sheet_url?: string | null
          business_deep_dive_submitted?: boolean
          business_type?: string
          callback_due_at?: string | null
          callback_notified_at?: string | null
          churn_reason?: string | null
          churned_at?: string | null
          client_code: string
          client_id?: string | null
          client_name?: string | null
          closer_name?: string | null
          closing_date?: string | null
          company_name?: string | null
          completed_at?: string | null
          contract_completed_at?: string | null
          contract_end_date?: string | null
          contract_signed?: boolean
          contract_start_date?: string | null
          created_at?: string
          current_step?: number | null
          deal_value?: number | null
          docusign_envelope_id?: string | null
          docusign_link?: string | null
          docusign_pdf_url?: string | null
          docusign_sent_at?: string | null
          docusign_signed_at?: string | null
          docusign_viewed_at?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          email?: string | null
          external_snapshot?: Json | null
          external_snapshot_hash?: string | null
          external_status?: string | null
          external_sync_error?: string | null
          external_synced_at?: string | null
          followup_count?: number
          followup_sent_at?: string | null
          followup_step?: number | null
          form_completed_at?: string | null
          founder_scan_completed_at?: string | null
          founder_scan_submitted?: boolean
          founder_summary?: Json | null
          internal_notes?: string | null
          kickoff_calendar_link?: string | null
          kickoff_completed_at?: string | null
          kickoff_meeting_link?: string | null
          kickoff_scheduled?: boolean
          kickoff_scheduled_at?: string | null
          last_activity_at?: string | null
          lead_id?: string | null
          lead_source?: string | null
          manual_contract_pdf_url?: string | null
          onboarding_sent_at?: string | null
          owner_pain_point?: string | null
          paid?: boolean
          payment_completed_at?: string | null
          phone?: string | null
          platforms_completed_at?: string | null
          sales_supervisor?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          slack_invite_url?: string | null
          slack_user_id?: string | null
          stripe_amount_expected?: number | null
          stripe_amount_paid?: number | null
          stripe_customer_id?: string | null
          stripe_link?: string | null
          stuck_alert_at?: string | null
          updated_at?: string
          video_watched?: boolean
          welcome_completed_at?: string | null
          welcome_form_submitted?: boolean
          welcome_sent_at?: string | null
        }
        Update: {
          ad_budget?: number | null
          alert_24h_sent?: boolean | null
          alert_48h_sent?: boolean | null
          already_runs_ads?: boolean | null
          archived_at?: string | null
          brand_name?: string | null
          business_deep_dive_completed_at?: string | null
          business_deep_dive_sheet_id?: string | null
          business_deep_dive_sheet_url?: string | null
          business_deep_dive_submitted?: boolean
          business_type?: string
          callback_due_at?: string | null
          callback_notified_at?: string | null
          churn_reason?: string | null
          churned_at?: string | null
          client_code?: string
          client_id?: string | null
          client_name?: string | null
          closer_name?: string | null
          closing_date?: string | null
          company_name?: string | null
          completed_at?: string | null
          contract_completed_at?: string | null
          contract_end_date?: string | null
          contract_signed?: boolean
          contract_start_date?: string | null
          created_at?: string
          current_step?: number | null
          deal_value?: number | null
          docusign_envelope_id?: string | null
          docusign_link?: string | null
          docusign_pdf_url?: string | null
          docusign_sent_at?: string | null
          docusign_signed_at?: string | null
          docusign_viewed_at?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          email?: string | null
          external_snapshot?: Json | null
          external_snapshot_hash?: string | null
          external_status?: string | null
          external_sync_error?: string | null
          external_synced_at?: string | null
          followup_count?: number
          followup_sent_at?: string | null
          followup_step?: number | null
          form_completed_at?: string | null
          founder_scan_completed_at?: string | null
          founder_scan_submitted?: boolean
          founder_summary?: Json | null
          internal_notes?: string | null
          kickoff_calendar_link?: string | null
          kickoff_completed_at?: string | null
          kickoff_meeting_link?: string | null
          kickoff_scheduled?: boolean
          kickoff_scheduled_at?: string | null
          last_activity_at?: string | null
          lead_id?: string | null
          lead_source?: string | null
          manual_contract_pdf_url?: string | null
          onboarding_sent_at?: string | null
          owner_pain_point?: string | null
          paid?: boolean
          payment_completed_at?: string | null
          phone?: string | null
          platforms_completed_at?: string | null
          sales_supervisor?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          slack_invite_url?: string | null
          slack_user_id?: string | null
          stripe_amount_expected?: number | null
          stripe_amount_paid?: number | null
          stripe_customer_id?: string | null
          stripe_link?: string | null
          stuck_alert_at?: string | null
          updated_at?: string
          video_watched?: boolean
          welcome_completed_at?: string | null
          welcome_form_submitted?: boolean
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
      closed_deals: {
        Row: {
          account_manager_notes: string | null
          ad_budget_monthly: number | null
          additional_monthly: number | null
          business_type: string
          client_code: string | null
          closer_name: string
          closing_date: string
          company_name: string
          contact_name: string | null
          contract_pdf_path: string | null
          contract_value: number | null
          created_at: string
          engagement_duration: string | null
          has_run_ads: boolean | null
          id: string
          lead_source: string | null
          main_objections: string | null
          main_objective: string | null
          monthly_amount: number | null
          offers_sold: string[] | null
          owner_business: string | null
          owner_email: string | null
          owner_name: string | null
          owner_pain_point: string | null
          owner_phone: string | null
          payment_type: string
          phone: string | null
          platforms_to_manage: string[] | null
          risk_level: string | null
          risk_reason: string | null
          stripe_payment_link_id: string | null
          stripe_payment_type: string | null
          stripe_payment_url: string | null
          target_launch_date: string | null
          updated_at: string
        }
        Insert: {
          account_manager_notes?: string | null
          ad_budget_monthly?: number | null
          additional_monthly?: number | null
          business_type?: string
          client_code?: string | null
          closer_name: string
          closing_date: string
          company_name: string
          contact_name?: string | null
          contract_pdf_path?: string | null
          contract_value?: number | null
          created_at?: string
          engagement_duration?: string | null
          has_run_ads?: boolean | null
          id?: string
          lead_source?: string | null
          main_objections?: string | null
          main_objective?: string | null
          monthly_amount?: number | null
          offers_sold?: string[] | null
          owner_business?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_pain_point?: string | null
          owner_phone?: string | null
          payment_type: string
          phone?: string | null
          platforms_to_manage?: string[] | null
          risk_level?: string | null
          risk_reason?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_type?: string | null
          stripe_payment_url?: string | null
          target_launch_date?: string | null
          updated_at?: string
        }
        Update: {
          account_manager_notes?: string | null
          ad_budget_monthly?: number | null
          additional_monthly?: number | null
          business_type?: string
          client_code?: string | null
          closer_name?: string
          closing_date?: string
          company_name?: string
          contact_name?: string | null
          contract_pdf_path?: string | null
          contract_value?: number | null
          created_at?: string
          engagement_duration?: string | null
          has_run_ads?: boolean | null
          id?: string
          lead_source?: string | null
          main_objections?: string | null
          main_objective?: string | null
          monthly_amount?: number | null
          offers_sold?: string[] | null
          owner_business?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_pain_point?: string | null
          owner_phone?: string | null
          payment_type?: string
          phone?: string | null
          platforms_to_manage?: string[] | null
          risk_level?: string | null
          risk_reason?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_type?: string | null
          stripe_payment_url?: string | null
          target_launch_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_audit_syntheses: {
        Row: {
          am_approved: boolean | null
          business_context_evidence: string | null
          client_id: string
          confidence_level: string | null
          created_at: string
          cro_offer_evidence: string | null
          experimental_evidence: string | null
          goal_lock: string | null
          id: string
          key_uncertainties: string | null
          market_evidence: string | null
          next_step: string | null
          primary_problem: string | null
          primary_problem_category: string | null
          priority_levers: string | null
          quant_evidence: string | null
          rejected_or_delayed_levers: string | null
          secondary_problems: string | null
          strategic_context: string | null
          strategic_diagnosis: string | null
          updated_at: string
        }
        Insert: {
          am_approved?: boolean | null
          business_context_evidence?: string | null
          client_id: string
          confidence_level?: string | null
          created_at?: string
          cro_offer_evidence?: string | null
          experimental_evidence?: string | null
          goal_lock?: string | null
          id?: string
          key_uncertainties?: string | null
          market_evidence?: string | null
          next_step?: string | null
          primary_problem?: string | null
          primary_problem_category?: string | null
          priority_levers?: string | null
          quant_evidence?: string | null
          rejected_or_delayed_levers?: string | null
          secondary_problems?: string | null
          strategic_context?: string | null
          strategic_diagnosis?: string | null
          updated_at?: string
        }
        Update: {
          am_approved?: boolean | null
          business_context_evidence?: string | null
          client_id?: string
          confidence_level?: string | null
          created_at?: string
          cro_offer_evidence?: string | null
          experimental_evidence?: string | null
          goal_lock?: string | null
          id?: string
          key_uncertainties?: string | null
          market_evidence?: string | null
          next_step?: string | null
          primary_problem?: string | null
          primary_problem_category?: string | null
          priority_levers?: string | null
          quant_evidence?: string | null
          rejected_or_delayed_levers?: string | null
          secondary_problems?: string | null
          strategic_context?: string | null
          strategic_diagnosis?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_audit_syntheses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_business_context: {
        Row: {
          annual_revenue: number | null
          approval_risk: string | null
          best_selling_product: string | null
          client_id: string
          communication_preference: string | null
          created_at: string
          decision_makers: string | null
          feedback_availability: string | null
          founder_profile: string | null
          founder_strengths: string | null
          founder_weaknesses: string | null
          goal_lock: string | null
          id: string
          known_objections: string | null
          main_value_proposition: string | null
          mission: string | null
          monthly_ad_budget: number | null
          monthly_revenue: number | null
          one_year_vision: string | null
          primary_kpi: string | null
          products_to_avoid: string | null
          products_to_push: string | null
          status: string | null
          strategic_guardrails: string | null
          success_3_months: string | null
          target_country: string | null
          target_customer: string | null
          ten_year_vision: string | null
          top_competitors: string | null
          updated_at: string
          weekly_ad_budget: number | null
        }
        Insert: {
          annual_revenue?: number | null
          approval_risk?: string | null
          best_selling_product?: string | null
          client_id: string
          communication_preference?: string | null
          created_at?: string
          decision_makers?: string | null
          feedback_availability?: string | null
          founder_profile?: string | null
          founder_strengths?: string | null
          founder_weaknesses?: string | null
          goal_lock?: string | null
          id?: string
          known_objections?: string | null
          main_value_proposition?: string | null
          mission?: string | null
          monthly_ad_budget?: number | null
          monthly_revenue?: number | null
          one_year_vision?: string | null
          primary_kpi?: string | null
          products_to_avoid?: string | null
          products_to_push?: string | null
          status?: string | null
          strategic_guardrails?: string | null
          success_3_months?: string | null
          target_country?: string | null
          target_customer?: string | null
          ten_year_vision?: string | null
          top_competitors?: string | null
          updated_at?: string
          weekly_ad_budget?: number | null
        }
        Update: {
          annual_revenue?: number | null
          approval_risk?: string | null
          best_selling_product?: string | null
          client_id?: string
          communication_preference?: string | null
          created_at?: string
          decision_makers?: string | null
          feedback_availability?: string | null
          founder_profile?: string | null
          founder_strengths?: string | null
          founder_weaknesses?: string | null
          goal_lock?: string | null
          id?: string
          known_objections?: string | null
          main_value_proposition?: string | null
          mission?: string | null
          monthly_ad_budget?: number | null
          monthly_revenue?: number | null
          one_year_vision?: string | null
          primary_kpi?: string | null
          products_to_avoid?: string | null
          products_to_push?: string | null
          status?: string | null
          strategic_guardrails?: string | null
          success_3_months?: string | null
          target_country?: string | null
          target_customer?: string | null
          ten_year_vision?: string | null
          top_competitors?: string | null
          updated_at?: string
          weekly_ad_budget?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_business_context_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          am_owner_id: string | null
          am_owner_name: string | null
          business_model: string | null
          clickup_client_task_id: string | null
          clickup_status: string | null
          clickup_task_url: string | null
          client_code: string | null
          closing_date: string | null
          company_name: string
          created_at: string
          current_phase: string | null
          deal_value: number | null
          drive_folder_url: string | null
          hub_url: string | null
          id: string
          industry: string | null
          launch_target_date: string | null
          lead_source: string | null
          main_contact_email: string | null
          main_contact_name: string | null
          main_contact_phone: string | null
          monthly_retainer: number | null
          notes: string | null
          offer_sold: string | null
          platforms_managed: string[] | null
          risk_level: string | null
          slack_channel: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          am_owner_id?: string | null
          am_owner_name?: string | null
          business_model?: string | null
          clickup_client_task_id?: string | null
          clickup_status?: string | null
          clickup_task_url?: string | null
          client_code?: string | null
          closing_date?: string | null
          company_name: string
          created_at?: string
          current_phase?: string | null
          deal_value?: number | null
          drive_folder_url?: string | null
          hub_url?: string | null
          id?: string
          industry?: string | null
          launch_target_date?: string | null
          lead_source?: string | null
          main_contact_email?: string | null
          main_contact_name?: string | null
          main_contact_phone?: string | null
          monthly_retainer?: number | null
          notes?: string | null
          offer_sold?: string | null
          platforms_managed?: string[] | null
          risk_level?: string | null
          slack_channel?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          am_owner_id?: string | null
          am_owner_name?: string | null
          business_model?: string | null
          clickup_client_task_id?: string | null
          clickup_status?: string | null
          clickup_task_url?: string | null
          client_code?: string | null
          closing_date?: string | null
          company_name?: string
          created_at?: string
          current_phase?: string | null
          deal_value?: number | null
          drive_folder_url?: string | null
          hub_url?: string | null
          id?: string
          industry?: string | null
          launch_target_date?: string | null
          lead_source?: string | null
          main_contact_email?: string | null
          main_contact_name?: string | null
          main_contact_phone?: string | null
          monthly_retainer?: number | null
          notes?: string | null
          offer_sold?: string | null
          platforms_managed?: string[] | null
          risk_level?: string | null
          slack_channel?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      crm_creative_demand_plans: {
        Row: {
          client_id: string
          created_at: string
          creative_risk_level: string | null
          due_dates: string | null
          forecast_id: string | null
          id: string
          priority_angles: string | null
          priority_products: string | null
          production_sources: string | null
          rationale: string | null
          statics_needed: number | null
          total_creatives_needed: number | null
          updated_at: string
          videos_needed: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          creative_risk_level?: string | null
          due_dates?: string | null
          forecast_id?: string | null
          id?: string
          priority_angles?: string | null
          priority_products?: string | null
          production_sources?: string | null
          rationale?: string | null
          statics_needed?: number | null
          total_creatives_needed?: number | null
          updated_at?: string
          videos_needed?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          creative_risk_level?: string | null
          due_dates?: string | null
          forecast_id?: string | null
          id?: string
          priority_angles?: string | null
          priority_products?: string | null
          production_sources?: string | null
          rationale?: string | null
          statics_needed?: number | null
          total_creatives_needed?: number | null
          updated_at?: string
          videos_needed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_creative_demand_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_creative_demand_plans_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "crm_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cro_offer_audits: {
        Row: {
          client_id: string
          created_at: string
          evidence: string | null
          expected_impact: string | null
          finding: string | null
          friction_type: string | null
          id: string
          notes: string | null
          page_type: string | null
          page_url: string | null
          priority: string | null
          recommendation: string | null
          severity: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          evidence?: string | null
          expected_impact?: string | null
          finding?: string | null
          friction_type?: string | null
          id?: string
          notes?: string | null
          page_type?: string | null
          page_url?: string | null
          priority?: string | null
          recommendation?: string | null
          severity?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          evidence?: string | null
          expected_impact?: string | null
          finding?: string | null
          friction_type?: string | null
          id?: string
          notes?: string | null
          page_type?: string | null
          page_url?: string | null
          priority?: string | null
          recommendation?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cro_offer_audits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_decision_scores: {
        Row: {
          am_approved: boolean | null
          business_impact: number | null
          client_id: string
          confidence_score: number | null
          created_at: string
          decision_score: number | null
          dependency_level: number | null
          ease_of_execution: number | null
          evidence_strength: number | null
          expected_time_to_result: number | null
          goal_alignment: number | null
          hypothesis_id: string | null
          id: string
          override_priority: string | null
          override_reason: string | null
          priority: string | null
          risk: number | null
          updated_at: string
          urgency: number | null
        }
        Insert: {
          am_approved?: boolean | null
          business_impact?: number | null
          client_id: string
          confidence_score?: number | null
          created_at?: string
          decision_score?: number | null
          dependency_level?: number | null
          ease_of_execution?: number | null
          evidence_strength?: number | null
          expected_time_to_result?: number | null
          goal_alignment?: number | null
          hypothesis_id?: string | null
          id?: string
          override_priority?: string | null
          override_reason?: string | null
          priority?: string | null
          risk?: number | null
          updated_at?: string
          urgency?: number | null
        }
        Update: {
          am_approved?: boolean | null
          business_impact?: number | null
          client_id?: string
          confidence_score?: number | null
          created_at?: string
          decision_score?: number | null
          dependency_level?: number | null
          ease_of_execution?: number | null
          evidence_strength?: number | null
          expected_time_to_result?: number | null
          goal_alignment?: number | null
          hypothesis_id?: string | null
          id?: string
          override_priority?: string | null
          override_reason?: string | null
          priority?: string | null
          risk?: number | null
          updated_at?: string
          urgency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_decision_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_decision_scores_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "crm_hypotheses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_experimental_history: {
        Row: {
          angle: string | null
          campaign_name: string | null
          channel: string | null
          client_id: string
          cpa: number | null
          created_at: string
          ctr: number | null
          format: string | null
          hook: string | null
          id: string
          landing_page: string | null
          notes: string | null
          offer: string | null
          pattern_type: string | null
          result: string | null
          roas: number | null
          spend: number | null
          test_period: string | null
        }
        Insert: {
          angle?: string | null
          campaign_name?: string | null
          channel?: string | null
          client_id: string
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          format?: string | null
          hook?: string | null
          id?: string
          landing_page?: string | null
          notes?: string | null
          offer?: string | null
          pattern_type?: string | null
          result?: string | null
          roas?: number | null
          spend?: number | null
          test_period?: string | null
        }
        Update: {
          angle?: string | null
          campaign_name?: string | null
          channel?: string | null
          client_id?: string
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          format?: string | null
          hook?: string | null
          id?: string
          landing_page?: string | null
          notes?: string | null
          offer?: string | null
          pattern_type?: string | null
          result?: string | null
          roas?: number | null
          spend?: number | null
          test_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_experimental_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_financial_inputs: {
        Row: {
          average_cogs: number | null
          average_fulfillment_cost: number | null
          average_shipping_cost: number | null
          claims_allowed: string | null
          claims_forbidden: string | null
          client_id: string
          created_at: string
          gross_margin_percent: number | null
          id: string
          legal_risk_notes: string | null
          payback_window: string | null
          refund_rate_percent: number | null
          stock_risk: string | null
          target_cac: number | null
          target_mer: number | null
          target_roas: number | null
          top_product_margin_notes: string | null
          updated_at: string
        }
        Insert: {
          average_cogs?: number | null
          average_fulfillment_cost?: number | null
          average_shipping_cost?: number | null
          claims_allowed?: string | null
          claims_forbidden?: string | null
          client_id: string
          created_at?: string
          gross_margin_percent?: number | null
          id?: string
          legal_risk_notes?: string | null
          payback_window?: string | null
          refund_rate_percent?: number | null
          stock_risk?: string | null
          target_cac?: number | null
          target_mer?: number | null
          target_roas?: number | null
          top_product_margin_notes?: string | null
          updated_at?: string
        }
        Update: {
          average_cogs?: number | null
          average_fulfillment_cost?: number | null
          average_shipping_cost?: number | null
          claims_allowed?: string | null
          claims_forbidden?: string | null
          client_id?: string
          created_at?: string
          gross_margin_percent?: number | null
          id?: string
          legal_risk_notes?: string | null
          payback_window?: string | null
          refund_rate_percent?: number | null
          stock_risk?: string | null
          target_cac?: number | null
          target_mer?: number | null
          target_roas?: number | null
          top_product_margin_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_financial_inputs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_forecasts: {
        Row: {
          am_approved: boolean | null
          client_id: string
          conditions: string | null
          confidence_label: string | null
          confidence_score: number | null
          created_at: string
          dependencies: string | null
          expected_lift_base: number | null
          expected_lift_high: number | null
          expected_lift_low: number | null
          expected_result: string | null
          forecast_name: string | null
          forecast_period: string | null
          forecast_status: string | null
          goal: string | null
          id: string
          risks: string | null
          selected_hypotheses: string[] | null
          timeline: string | null
          updated_at: string
        }
        Insert: {
          am_approved?: boolean | null
          client_id: string
          conditions?: string | null
          confidence_label?: string | null
          confidence_score?: number | null
          created_at?: string
          dependencies?: string | null
          expected_lift_base?: number | null
          expected_lift_high?: number | null
          expected_lift_low?: number | null
          expected_result?: string | null
          forecast_name?: string | null
          forecast_period?: string | null
          forecast_status?: string | null
          goal?: string | null
          id?: string
          risks?: string | null
          selected_hypotheses?: string[] | null
          timeline?: string | null
          updated_at?: string
        }
        Update: {
          am_approved?: boolean | null
          client_id?: string
          conditions?: string | null
          confidence_label?: string | null
          confidence_score?: number | null
          created_at?: string
          dependencies?: string | null
          expected_lift_base?: number | null
          expected_lift_high?: number | null
          expected_lift_low?: number | null
          expected_result?: string | null
          forecast_name?: string | null
          forecast_period?: string | null
          forecast_status?: string | null
          goal?: string | null
          id?: string
          risks?: string | null
          selected_hypotheses?: string[] | null
          timeline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_forecasts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_growth_execution_maps: {
        Row: {
          cac_target: number | null
          client_id: string
          created_at: string
          creative_output_target: number | null
          dependencies: string | null
          forecast_id: string | null
          id: string
          key_milestone: string | null
          mer_target: number | null
          planned_actions: string | null
          revenue_target: number | null
          spend_target: number | null
          updated_at: string
          week_number: number | null
          weekly_goal: string | null
        }
        Insert: {
          cac_target?: number | null
          client_id: string
          created_at?: string
          creative_output_target?: number | null
          dependencies?: string | null
          forecast_id?: string | null
          id?: string
          key_milestone?: string | null
          mer_target?: number | null
          planned_actions?: string | null
          revenue_target?: number | null
          spend_target?: number | null
          updated_at?: string
          week_number?: number | null
          weekly_goal?: string | null
        }
        Update: {
          cac_target?: number | null
          client_id?: string
          created_at?: string
          creative_output_target?: number | null
          dependencies?: string | null
          forecast_id?: string | null
          id?: string
          key_milestone?: string | null
          mer_target?: number | null
          planned_actions?: string | null
          revenue_target?: number | null
          spend_target?: number | null
          updated_at?: string
          week_number?: number | null
          weekly_goal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_growth_execution_maps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_growth_execution_maps_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "crm_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_hypotheses: {
        Row: {
          audit_synthesis_id: string | null
          category: string | null
          client_id: string
          confidence: string | null
          created_at: string
          dependencies: string | null
          evidence: string | null
          expected_lift_base: number | null
          expected_lift_max: number | null
          expected_lift_min: number | null
          goal_alignment: string | null
          hypothesis: string | null
          id: string
          primary_metric: string | null
          risk: string | null
          secondary_metrics: string | null
          status: string | null
          suggested_priority: string | null
          test_description: string | null
          timeline: string | null
          updated_at: string
        }
        Insert: {
          audit_synthesis_id?: string | null
          category?: string | null
          client_id: string
          confidence?: string | null
          created_at?: string
          dependencies?: string | null
          evidence?: string | null
          expected_lift_base?: number | null
          expected_lift_max?: number | null
          expected_lift_min?: number | null
          goal_alignment?: string | null
          hypothesis?: string | null
          id?: string
          primary_metric?: string | null
          risk?: string | null
          secondary_metrics?: string | null
          status?: string | null
          suggested_priority?: string | null
          test_description?: string | null
          timeline?: string | null
          updated_at?: string
        }
        Update: {
          audit_synthesis_id?: string | null
          category?: string | null
          client_id?: string
          confidence?: string | null
          created_at?: string
          dependencies?: string | null
          evidence?: string | null
          expected_lift_base?: number | null
          expected_lift_max?: number | null
          expected_lift_min?: number | null
          goal_alignment?: string | null
          hypothesis?: string | null
          id?: string
          primary_metric?: string | null
          risk?: string | null
          secondary_metrics?: string | null
          status?: string | null
          suggested_priority?: string | null
          test_description?: string | null
          timeline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_hypotheses_audit_synthesis_id_fkey"
            columns: ["audit_synthesis_id"]
            isOneToOne: false
            referencedRelation: "crm_audit_syntheses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_hypotheses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_learning_library: {
        Row: {
          action_taken: string | null
          actual_lift: string | null
          client_id: string | null
          created_at: string
          creative_angle: string | null
          cro_module: string | null
          decision: string | null
          expected_lift: string | null
          hypothesis: string | null
          hypothesis_id: string | null
          id: string
          industry: string | null
          notes: string | null
          offer: string | null
          result: string | null
          time_to_result: string | null
          time_to_signal: string | null
        }
        Insert: {
          action_taken?: string | null
          actual_lift?: string | null
          client_id?: string | null
          created_at?: string
          creative_angle?: string | null
          cro_module?: string | null
          decision?: string | null
          expected_lift?: string | null
          hypothesis?: string | null
          hypothesis_id?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          offer?: string | null
          result?: string | null
          time_to_result?: string | null
          time_to_signal?: string | null
        }
        Update: {
          action_taken?: string | null
          actual_lift?: string | null
          client_id?: string | null
          created_at?: string
          creative_angle?: string | null
          cro_module?: string | null
          decision?: string | null
          expected_lift?: string | null
          hypothesis?: string | null
          hypothesis_id?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          offer?: string | null
          result?: string | null
          time_to_result?: string | null
          time_to_signal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_learning_library_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_learning_library_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "crm_hypotheses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_live_optimization_reviews: {
        Row: {
          atc_actual: number | null
          cac_actual: number | null
          cac_target: number | null
          client_id: string
          client_success_payload: string | null
          created_at: string
          creative_output_actual: number | null
          creative_output_target: number | null
          ctr_actual: number | null
          cvr_actual: number | null
          forecast_status: string | null
          id: string
          mer_actual: number | null
          mer_target: number | null
          now_what: string | null
          problem_type: string | null
          recommended_actions: string | null
          revenue_actual: number | null
          revenue_target: number | null
          review_period: string | null
          so_what: string | null
          spend_actual: number | null
          spend_target: number | null
          updated_at: string
          variance_summary: string | null
          what_happened: string | null
        }
        Insert: {
          atc_actual?: number | null
          cac_actual?: number | null
          cac_target?: number | null
          client_id: string
          client_success_payload?: string | null
          created_at?: string
          creative_output_actual?: number | null
          creative_output_target?: number | null
          ctr_actual?: number | null
          cvr_actual?: number | null
          forecast_status?: string | null
          id?: string
          mer_actual?: number | null
          mer_target?: number | null
          now_what?: string | null
          problem_type?: string | null
          recommended_actions?: string | null
          revenue_actual?: number | null
          revenue_target?: number | null
          review_period?: string | null
          so_what?: string | null
          spend_actual?: number | null
          spend_target?: number | null
          updated_at?: string
          variance_summary?: string | null
          what_happened?: string | null
        }
        Update: {
          atc_actual?: number | null
          cac_actual?: number | null
          cac_target?: number | null
          client_id?: string
          client_success_payload?: string | null
          created_at?: string
          creative_output_actual?: number | null
          creative_output_target?: number | null
          ctr_actual?: number | null
          cvr_actual?: number | null
          forecast_status?: string | null
          id?: string
          mer_actual?: number | null
          mer_target?: number | null
          now_what?: string | null
          problem_type?: string | null
          recommended_actions?: string | null
          revenue_actual?: number | null
          revenue_target?: number | null
          review_period?: string | null
          so_what?: string | null
          spend_actual?: number | null
          spend_target?: number | null
          updated_at?: string
          variance_summary?: string | null
          what_happened?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_live_optimization_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_market_research: {
        Row: {
          claim_risk: string | null
          client_id: string
          competitor_gap: string | null
          competitor_name: string | null
          confidence: number | null
          created_at: string
          creative_angle: string | null
          customer_voice_quote: string | null
          desire: string | null
          evidence_strength: number | null
          finding_text: string | null
          finding_type: string | null
          icp_segment: string | null
          id: string
          notes: string | null
          objection: string | null
          source_type: string | null
          source_url: string | null
        }
        Insert: {
          claim_risk?: string | null
          client_id: string
          competitor_gap?: string | null
          competitor_name?: string | null
          confidence?: number | null
          created_at?: string
          creative_angle?: string | null
          customer_voice_quote?: string | null
          desire?: string | null
          evidence_strength?: number | null
          finding_text?: string | null
          finding_type?: string | null
          icp_segment?: string | null
          id?: string
          notes?: string | null
          objection?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Update: {
          claim_risk?: string | null
          client_id?: string
          competitor_gap?: string | null
          competitor_name?: string | null
          confidence?: number | null
          created_at?: string
          creative_angle?: string | null
          customer_voice_quote?: string | null
          desire?: string | null
          evidence_strength?: number | null
          finding_text?: string | null
          finding_type?: string | null
          icp_segment?: string | null
          id?: string
          notes?: string | null
          objection?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_market_research_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_metric_targets: {
        Row: {
          ad_spend_target: number | null
          cac_target: number | null
          client_id: string
          contribution_margin_proxy_target: number | null
          created_at: string
          email_revenue_target: number | null
          forecast_id: string | null
          google_roas_target: number | null
          google_spend_target: number | null
          id: string
          mer_target: number | null
          meta_cac_target: number | null
          meta_roas_target: number | null
          meta_spend_target: number | null
          new_customers_target: number | null
          north_star_metric: string | null
          notes: string | null
          period: string | null
          returning_revenue_target: number | null
          revenue_target: number | null
          updated_at: string
        }
        Insert: {
          ad_spend_target?: number | null
          cac_target?: number | null
          client_id: string
          contribution_margin_proxy_target?: number | null
          created_at?: string
          email_revenue_target?: number | null
          forecast_id?: string | null
          google_roas_target?: number | null
          google_spend_target?: number | null
          id?: string
          mer_target?: number | null
          meta_cac_target?: number | null
          meta_roas_target?: number | null
          meta_spend_target?: number | null
          new_customers_target?: number | null
          north_star_metric?: string | null
          notes?: string | null
          period?: string | null
          returning_revenue_target?: number | null
          revenue_target?: number | null
          updated_at?: string
        }
        Update: {
          ad_spend_target?: number | null
          cac_target?: number | null
          client_id?: string
          contribution_margin_proxy_target?: number | null
          created_at?: string
          email_revenue_target?: number | null
          forecast_id?: string | null
          google_roas_target?: number | null
          google_spend_target?: number | null
          id?: string
          mer_target?: number | null
          meta_cac_target?: number | null
          meta_roas_target?: number | null
          meta_spend_target?: number | null
          new_customers_target?: number | null
          north_star_metric?: string | null
          notes?: string | null
          period?: string | null
          returning_revenue_target?: number | null
          revenue_target?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_metric_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_metric_targets_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "crm_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quant_analysis_outputs: {
        Row: {
          am_manual_checks: string | null
          am_validated: boolean | null
          baseline_health_score: number | null
          blended_cac: number | null
          blended_mer: number | null
          client_id: string
          created_at: string
          creative_fatigue_risk: string | null
          current_cac_vs_break_even: number | null
          current_cac_vs_target: number | null
          estimated_break_even_cac: number | null
          gross_profit_per_order: number | null
          id: string
          main_quantitative_problem: string | null
          missing_data_summary: string | null
          next_analysis_step: string | null
          quant_diagnosis: string | null
          quant_risk_level: string | null
          quantitative_baseline_id: string | null
          revenue_30d: number | null
          secondary_quantitative_problem: string | null
          spend_concentration_risk: string | null
          stock_constraint_risk: string | null
          total_ad_spend_30d: number | null
          tracking_confidence: string | null
        }
        Insert: {
          am_manual_checks?: string | null
          am_validated?: boolean | null
          baseline_health_score?: number | null
          blended_cac?: number | null
          blended_mer?: number | null
          client_id: string
          created_at?: string
          creative_fatigue_risk?: string | null
          current_cac_vs_break_even?: number | null
          current_cac_vs_target?: number | null
          estimated_break_even_cac?: number | null
          gross_profit_per_order?: number | null
          id?: string
          main_quantitative_problem?: string | null
          missing_data_summary?: string | null
          next_analysis_step?: string | null
          quant_diagnosis?: string | null
          quant_risk_level?: string | null
          quantitative_baseline_id?: string | null
          revenue_30d?: number | null
          secondary_quantitative_problem?: string | null
          spend_concentration_risk?: string | null
          stock_constraint_risk?: string | null
          total_ad_spend_30d?: number | null
          tracking_confidence?: string | null
        }
        Update: {
          am_manual_checks?: string | null
          am_validated?: boolean | null
          baseline_health_score?: number | null
          blended_cac?: number | null
          blended_mer?: number | null
          client_id?: string
          created_at?: string
          creative_fatigue_risk?: string | null
          current_cac_vs_break_even?: number | null
          current_cac_vs_target?: number | null
          estimated_break_even_cac?: number | null
          gross_profit_per_order?: number | null
          id?: string
          main_quantitative_problem?: string | null
          missing_data_summary?: string | null
          next_analysis_step?: string | null
          quant_diagnosis?: string | null
          quant_risk_level?: string | null
          quantitative_baseline_id?: string | null
          revenue_30d?: number | null
          secondary_quantitative_problem?: string | null
          spend_concentration_risk?: string | null
          stock_constraint_risk?: string | null
          total_ad_spend_30d?: number | null
          tracking_confidence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_quant_analysis_outputs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quant_analysis_outputs_quantitative_baseline_id_fkey"
            columns: ["quantitative_baseline_id"]
            isOneToOne: false
            referencedRelation: "crm_quantitative_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quantitative_baselines: {
        Row: {
          client_id: string
          created_at: string
          desktop_conversion_rate: number | null
          ga4_add_to_cart: number | null
          ga4_add_to_cart_rate: number | null
          ga4_begin_checkout: number | null
          ga4_checkout_rate: number | null
          ga4_purchase_conversion_rate: number | null
          ga4_purchases: number | null
          ga4_sessions: number | null
          ga4_users: number | null
          google_ads_applicable: boolean | null
          google_ads_clicks: number | null
          google_ads_conversion_value: number | null
          google_ads_conversions: number | null
          google_ads_cpa: number | null
          google_ads_cpc: number | null
          google_ads_ctr: number | null
          google_ads_roas: number | null
          google_ads_spend: number | null
          id: string
          meta_clicks: number | null
          meta_cpa: number | null
          meta_cpc: number | null
          meta_cpm: number | null
          meta_ctr: number | null
          meta_frequency: number | null
          meta_impressions: number | null
          meta_purchase_value: number | null
          meta_purchases: number | null
          meta_reach: number | null
          meta_roas: number | null
          meta_spend: number | null
          meta_top_ads: string | null
          meta_worst_ads: string | null
          mobile_conversion_rate: number | null
          notes: string | null
          period: string | null
          shopify_aov: number | null
          shopify_conversion_rate: number | null
          shopify_discount_amount: number | null
          shopify_new_customers: number | null
          shopify_orders: number | null
          shopify_refund_amount: number | null
          shopify_refund_rate: number | null
          shopify_returning_customers: number | null
          shopify_revenue: number | null
          shopify_total_customers: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          desktop_conversion_rate?: number | null
          ga4_add_to_cart?: number | null
          ga4_add_to_cart_rate?: number | null
          ga4_begin_checkout?: number | null
          ga4_checkout_rate?: number | null
          ga4_purchase_conversion_rate?: number | null
          ga4_purchases?: number | null
          ga4_sessions?: number | null
          ga4_users?: number | null
          google_ads_applicable?: boolean | null
          google_ads_clicks?: number | null
          google_ads_conversion_value?: number | null
          google_ads_conversions?: number | null
          google_ads_cpa?: number | null
          google_ads_cpc?: number | null
          google_ads_ctr?: number | null
          google_ads_roas?: number | null
          google_ads_spend?: number | null
          id?: string
          meta_clicks?: number | null
          meta_cpa?: number | null
          meta_cpc?: number | null
          meta_cpm?: number | null
          meta_ctr?: number | null
          meta_frequency?: number | null
          meta_impressions?: number | null
          meta_purchase_value?: number | null
          meta_purchases?: number | null
          meta_reach?: number | null
          meta_roas?: number | null
          meta_spend?: number | null
          meta_top_ads?: string | null
          meta_worst_ads?: string | null
          mobile_conversion_rate?: number | null
          notes?: string | null
          period?: string | null
          shopify_aov?: number | null
          shopify_conversion_rate?: number | null
          shopify_discount_amount?: number | null
          shopify_new_customers?: number | null
          shopify_orders?: number | null
          shopify_refund_amount?: number | null
          shopify_refund_rate?: number | null
          shopify_returning_customers?: number | null
          shopify_revenue?: number | null
          shopify_total_customers?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          desktop_conversion_rate?: number | null
          ga4_add_to_cart?: number | null
          ga4_add_to_cart_rate?: number | null
          ga4_begin_checkout?: number | null
          ga4_checkout_rate?: number | null
          ga4_purchase_conversion_rate?: number | null
          ga4_purchases?: number | null
          ga4_sessions?: number | null
          ga4_users?: number | null
          google_ads_applicable?: boolean | null
          google_ads_clicks?: number | null
          google_ads_conversion_value?: number | null
          google_ads_conversions?: number | null
          google_ads_cpa?: number | null
          google_ads_cpc?: number | null
          google_ads_ctr?: number | null
          google_ads_roas?: number | null
          google_ads_spend?: number | null
          id?: string
          meta_clicks?: number | null
          meta_cpa?: number | null
          meta_cpc?: number | null
          meta_cpm?: number | null
          meta_ctr?: number | null
          meta_frequency?: number | null
          meta_impressions?: number | null
          meta_purchase_value?: number | null
          meta_purchases?: number | null
          meta_reach?: number | null
          meta_roas?: number | null
          meta_spend?: number | null
          meta_top_ads?: string | null
          meta_worst_ads?: string | null
          mobile_conversion_rate?: number | null
          notes?: string | null
          period?: string | null
          shopify_aov?: number | null
          shopify_conversion_rate?: number | null
          shopify_discount_amount?: number | null
          shopify_new_customers?: number | null
          shopify_orders?: number | null
          shopify_refund_amount?: number | null
          shopify_refund_rate?: number | null
          shopify_returning_customers?: number | null
          shopify_revenue?: number | null
          shopify_total_customers?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_quantitative_baselines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_ai_automation_runs: {
        Row: {
          automation_type: string
          client_id: string
          created_at: string
          created_by: string | null
          duration_ms: number | null
          error: string | null
          id: string
          input: Json
          model: string | null
          output: Json | null
          output_text: string | null
          status: string
          title: string | null
          tokens_input: number | null
          tokens_output: number | null
          updated_at: string
        }
        Insert: {
          automation_type: string
          client_id: string
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json
          model?: string | null
          output?: Json | null
          output_text?: string | null
          status?: string
          title?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Update: {
          automation_type?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json
          model?: string | null
          output?: Json | null
          output_text?: string | null
          status?: string
          title?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_ai_automation_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_angle_audience_matrix: {
        Row: {
          angle: string
          audience: string
          client_id: string
          cpa: number | null
          created_at: string
          created_by: string | null
          ctr: number | null
          cvr: number | null
          hypothesis: string | null
          id: string
          impressions: number | null
          last_tested_at: string | null
          linked_brief_ids: string[]
          linked_concept_ids: string[]
          linked_test_ids: string[]
          notes: string | null
          platform: string
          priority: string
          roas: number | null
          spend: number | null
          status: string
          updated_at: string
          verdict: string | null
        }
        Insert: {
          angle: string
          audience: string
          client_id: string
          cpa?: number | null
          created_at?: string
          created_by?: string | null
          ctr?: number | null
          cvr?: number | null
          hypothesis?: string | null
          id?: string
          impressions?: number | null
          last_tested_at?: string | null
          linked_brief_ids?: string[]
          linked_concept_ids?: string[]
          linked_test_ids?: string[]
          notes?: string | null
          platform: string
          priority?: string
          roas?: number | null
          spend?: number | null
          status?: string
          updated_at?: string
          verdict?: string | null
        }
        Update: {
          angle?: string
          audience?: string
          client_id?: string
          cpa?: number | null
          created_at?: string
          created_by?: string | null
          ctr?: number | null
          cvr?: number | null
          hypothesis?: string | null
          id?: string
          impressions?: number | null
          last_tested_at?: string | null
          linked_brief_ids?: string[]
          linked_concept_ids?: string[]
          linked_test_ids?: string[]
          notes?: string | null
          platform?: string
          priority?: string
          roas?: number | null
          spend?: number | null
          status?: string
          updated_at?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_angle_audience_matrix_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_basket_economics: {
        Row: {
          aov_new: number | null
          aov_repeat: number | null
          avg_order_value: number | null
          avg_units_per_transaction: number | null
          basket_cogs: number | null
          basket_discount_allowance: number | null
          basket_fulfillment_cost: number | null
          basket_gross_margin_percent: number | null
          basket_gross_profit: number | null
          basket_name: string | null
          basket_payment_processing_cost: number | null
          basket_refund_allowance: number | null
          basket_shipping_cost: number | null
          break_even_cac: number | null
          cac_new: number | null
          cac_repeat: number | null
          churn_per_cycle: number | null
          client_id: string
          conversion_rate: number | null
          created_at: string
          first_order_profit_at_target_cac: number | null
          id: string
          inventory_days: number | null
          payout_delay_days: number | null
          repeat_cycle_months: number | null
          target_cac: number | null
          updated_at: string
        }
        Insert: {
          aov_new?: number | null
          aov_repeat?: number | null
          avg_order_value?: number | null
          avg_units_per_transaction?: number | null
          basket_cogs?: number | null
          basket_discount_allowance?: number | null
          basket_fulfillment_cost?: number | null
          basket_gross_margin_percent?: number | null
          basket_gross_profit?: number | null
          basket_name?: string | null
          basket_payment_processing_cost?: number | null
          basket_refund_allowance?: number | null
          basket_shipping_cost?: number | null
          break_even_cac?: number | null
          cac_new?: number | null
          cac_repeat?: number | null
          churn_per_cycle?: number | null
          client_id: string
          conversion_rate?: number | null
          created_at?: string
          first_order_profit_at_target_cac?: number | null
          id?: string
          inventory_days?: number | null
          payout_delay_days?: number | null
          repeat_cycle_months?: number | null
          target_cac?: number | null
          updated_at?: string
        }
        Update: {
          aov_new?: number | null
          aov_repeat?: number | null
          avg_order_value?: number | null
          avg_units_per_transaction?: number | null
          basket_cogs?: number | null
          basket_discount_allowance?: number | null
          basket_fulfillment_cost?: number | null
          basket_gross_margin_percent?: number | null
          basket_gross_profit?: number | null
          basket_name?: string | null
          basket_payment_processing_cost?: number | null
          basket_refund_allowance?: number | null
          basket_shipping_cost?: number | null
          break_even_cac?: number | null
          cac_new?: number | null
          cac_repeat?: number | null
          churn_per_cycle?: number | null
          client_id?: string
          conversion_rate?: number | null
          created_at?: string
          first_order_profit_at_target_cac?: number | null
          id?: string
          inventory_days?: number | null
          payout_delay_days?: number | null
          repeat_cycle_months?: number | null
          target_cac?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_basket_economics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_business_contexts: {
        Row: {
          business_constraints: string | null
          claims_legal_constraints: string | null
          client_id: string
          created_at: string
          goal_lock: string | null
          id: string
          known_risks: string | null
          north_star_kpi: string | null
          operational_constraints: string | null
          product_to_avoid: string | null
          product_to_push: string | null
          status: string
          success_definition: string | null
          target_market: string | null
          three_month_objective: string | null
          updated_at: string
        }
        Insert: {
          business_constraints?: string | null
          claims_legal_constraints?: string | null
          client_id: string
          created_at?: string
          goal_lock?: string | null
          id?: string
          known_risks?: string | null
          north_star_kpi?: string | null
          operational_constraints?: string | null
          product_to_avoid?: string | null
          product_to_push?: string | null
          status?: string
          success_definition?: string | null
          target_market?: string | null
          three_month_objective?: string | null
          updated_at?: string
        }
        Update: {
          business_constraints?: string | null
          claims_legal_constraints?: string | null
          client_id?: string
          created_at?: string
          goal_lock?: string | null
          id?: string
          known_risks?: string | null
          north_star_kpi?: string | null
          operational_constraints?: string | null
          product_to_avoid?: string | null
          product_to_push?: string | null
          status?: string
          success_definition?: string | null
          target_market?: string | null
          three_month_objective?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_business_contexts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_business_objectives: {
        Row: {
          client_id: string
          constraints_notes: string | null
          created_at: string
          created_by: string | null
          current_value: number | null
          id: string
          label: string
          objective_type: string
          primary_kpi: string
          priority: number
          rationale: string | null
          status: string
          target_value: number | null
          timeframe_end: string | null
          timeframe_start: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          constraints_notes?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          id?: string
          label: string
          objective_type: string
          primary_kpi: string
          priority?: number
          rationale?: string | null
          status?: string
          target_value?: number | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          constraints_notes?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          id?: string
          label?: string
          objective_type?: string
          primary_kpi?: string
          priority?: number
          rationale?: string | null
          status?: string
          target_value?: number | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_business_objectives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_buyer_decisions: {
        Row: {
          actual_cpa: number | null
          campaign_id: string
          client_id: string
          created_at: string
          created_by: string | null
          decision_date: string
          decision_type: string
          expected_impact: string | null
          id: string
          new_budget: number | null
          previous_budget: number | null
          reasoning: string | null
          target_cpa: number | null
        }
        Insert: {
          actual_cpa?: number | null
          campaign_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          decision_date?: string
          decision_type: string
          expected_impact?: string | null
          id?: string
          new_budget?: number | null
          previous_budget?: number | null
          reasoning?: string | null
          target_cpa?: number | null
        }
        Update: {
          actual_cpa?: number | null
          campaign_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          decision_date?: string
          decision_type?: string
          expected_impact?: string | null
          id?: string
          new_budget?: number | null
          previous_budget?: number | null
          reasoning?: string | null
          target_cpa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_buyer_decisions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "gos_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_buyer_decisions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_campaign_categories: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
          target_cpa: number | null
          target_daily_budget: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          sort_order?: number
          target_cpa?: number | null
          target_daily_budget?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          target_cpa?: number | null
          target_daily_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_campaign_categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_campaign_daily_perf: {
        Row: {
          campaign_id: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          leads: number
          notes: string | null
          orders: number
          perf_date: string
          revenue: number
          spend: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          leads?: number
          notes?: string | null
          orders?: number
          perf_date: string
          revenue?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          leads?: number
          notes?: string | null
          orders?: number
          perf_date?: string
          revenue?: number
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_campaign_daily_perf_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "gos_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_campaign_daily_perf_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_campaigns: {
        Row: {
          active: boolean
          category_id: string | null
          client_id: string
          created_at: string
          current_daily_budget: number | null
          external_id: string | null
          id: string
          name: string
          notes: string | null
          platform: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          client_id: string
          created_at?: string
          current_daily_budget?: number | null
          external_id?: string | null
          id?: string
          name: string
          notes?: string | null
          platform?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          client_id?: string
          created_at?: string
          current_daily_budget?: number | null
          external_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_campaigns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gos_campaign_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_capacity_snapshots: {
        Row: {
          capacity_risk: string | null
          client_id: string
          created_at: string
          current_booked_capacity: number | null
          id: string
          notes: string | null
          response_time_minutes: number | null
          safe_to_scale: boolean | null
          service_id: string | null
          team_availability: string | null
          weekly_capacity: number | null
        }
        Insert: {
          capacity_risk?: string | null
          client_id: string
          created_at?: string
          current_booked_capacity?: number | null
          id?: string
          notes?: string | null
          response_time_minutes?: number | null
          safe_to_scale?: boolean | null
          service_id?: string | null
          team_availability?: string | null
          weekly_capacity?: number | null
        }
        Update: {
          capacity_risk?: string | null
          client_id?: string
          created_at?: string
          current_booked_capacity?: number | null
          id?: string
          notes?: string | null
          response_time_minutes?: number | null
          safe_to_scale?: boolean | null
          service_id?: string | null
          team_availability?: string | null
          weekly_capacity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_capacity_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_capacity_snapshots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "gos_services"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_cashflow_snapshots: {
        Row: {
          cash_in: number
          cash_out_ads: number
          cash_out_cogs: number
          cash_out_opex: number
          cash_out_other: number
          cash_out_tax: number
          client_id: string
          closing_cash: number | null
          created_at: string
          created_by: string | null
          granularity: string
          id: string
          notes: string | null
          opening_cash: number
          period_end: string
          period_start: string
          runway_weeks: number | null
          updated_at: string
        }
        Insert: {
          cash_in?: number
          cash_out_ads?: number
          cash_out_cogs?: number
          cash_out_opex?: number
          cash_out_other?: number
          cash_out_tax?: number
          client_id: string
          closing_cash?: number | null
          created_at?: string
          created_by?: string | null
          granularity?: string
          id?: string
          notes?: string | null
          opening_cash?: number
          period_end: string
          period_start: string
          runway_weeks?: number | null
          updated_at?: string
        }
        Update: {
          cash_in?: number
          cash_out_ads?: number
          cash_out_cogs?: number
          cash_out_opex?: number
          cash_out_other?: number
          cash_out_tax?: number
          client_id?: string
          closing_cash?: number | null
          created_at?: string
          created_by?: string | null
          granularity?: string
          id?: string
          notes?: string | null
          opening_cash?: number
          period_end?: string
          period_start?: string
          runway_weeks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_cashflow_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_client_intelligence_snapshots: {
        Row: {
          active_cycle_id: string | null
          alerts: Json | null
          client_id: string
          computed_by: string | null
          created_at: string
          health_grade: string | null
          health_score: number | null
          id: string
          key_metrics: Json | null
          learning_count: number | null
          momentum: string | null
          recommendations: Json | null
          snapshot_date: string
          strengths: Json | null
          summary: string | null
          updated_at: string
          weaknesses: Json | null
        }
        Insert: {
          active_cycle_id?: string | null
          alerts?: Json | null
          client_id: string
          computed_by?: string | null
          created_at?: string
          health_grade?: string | null
          health_score?: number | null
          id?: string
          key_metrics?: Json | null
          learning_count?: number | null
          momentum?: string | null
          recommendations?: Json | null
          snapshot_date?: string
          strengths?: Json | null
          summary?: string | null
          updated_at?: string
          weaknesses?: Json | null
        }
        Update: {
          active_cycle_id?: string | null
          alerts?: Json | null
          client_id?: string
          computed_by?: string | null
          created_at?: string
          health_grade?: string | null
          health_score?: number | null
          id?: string
          key_metrics?: Json | null
          learning_count?: number | null
          momentum?: string | null
          recommendations?: Json | null
          snapshot_date?: string
          strengths?: Json | null
          summary?: string | null
          updated_at?: string
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_client_intelligence_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_client_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["client_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["client_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["client_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_client_workflow_statuses: {
        Row: {
          block_key: string
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          block_key: string
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          block_key?: string
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_client_workflow_statuses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_clients: {
        Row: {
          am_owner: string | null
          business_type: string
          clickup_client_task_url: string | null
          client_code: string
          closing_date: string | null
          company_name: string
          created_at: string
          current_phase: string
          data_mode: string
          data_mode_notes: string | null
          data_quality_score: number | null
          deal_value: number | null
          drive_folder_url: string | null
          hub_url: string | null
          id: string
          industry: string | null
          launch_target_date: string | null
          lead_source: string | null
          main_contact_email: string | null
          main_contact_name: string | null
          main_contact_phone: string | null
          monthly_retainer: number | null
          offer_sold: string | null
          platforms_managed: string | null
          risk_level: string
          slack_channel: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          am_owner?: string | null
          business_type?: string
          clickup_client_task_url?: string | null
          client_code: string
          closing_date?: string | null
          company_name: string
          created_at?: string
          current_phase?: string
          data_mode?: string
          data_mode_notes?: string | null
          data_quality_score?: number | null
          deal_value?: number | null
          drive_folder_url?: string | null
          hub_url?: string | null
          id?: string
          industry?: string | null
          launch_target_date?: string | null
          lead_source?: string | null
          main_contact_email?: string | null
          main_contact_name?: string | null
          main_contact_phone?: string | null
          monthly_retainer?: number | null
          offer_sold?: string | null
          platforms_managed?: string | null
          risk_level?: string
          slack_channel?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          am_owner?: string | null
          business_type?: string
          clickup_client_task_url?: string | null
          client_code?: string
          closing_date?: string | null
          company_name?: string
          created_at?: string
          current_phase?: string
          data_mode?: string
          data_mode_notes?: string | null
          data_quality_score?: number | null
          deal_value?: number | null
          drive_folder_url?: string | null
          hub_url?: string | null
          id?: string
          industry?: string | null
          launch_target_date?: string | null
          lead_source?: string | null
          main_contact_email?: string | null
          main_contact_name?: string | null
          main_contact_phone?: string | null
          monthly_retainer?: number | null
          offer_sold?: string | null
          platforms_managed?: string | null
          risk_level?: string
          slack_channel?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      gos_concept_log: {
        Row: {
          angle: string | null
          audience: string | null
          clicks: number | null
          client_id: string
          concept_name: string
          cpa: number | null
          created_at: string
          created_by: string | null
          ctr: number | null
          end_date: string | null
          format: string | null
          hypothesis: string | null
          id: string
          impressions: number | null
          launch_date: string | null
          learning: string | null
          next_action: string | null
          objective_id: string | null
          orders: number | null
          platform: string | null
          revenue: number | null
          spend: number | null
          status: string
          tags: string[] | null
          updated_at: string
          verdict: string | null
        }
        Insert: {
          angle?: string | null
          audience?: string | null
          clicks?: number | null
          client_id: string
          concept_name: string
          cpa?: number | null
          created_at?: string
          created_by?: string | null
          ctr?: number | null
          end_date?: string | null
          format?: string | null
          hypothesis?: string | null
          id?: string
          impressions?: number | null
          launch_date?: string | null
          learning?: string | null
          next_action?: string | null
          objective_id?: string | null
          orders?: number | null
          platform?: string | null
          revenue?: number | null
          spend?: number | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          verdict?: string | null
        }
        Update: {
          angle?: string | null
          audience?: string | null
          clicks?: number | null
          client_id?: string
          concept_name?: string
          cpa?: number | null
          created_at?: string
          created_by?: string | null
          ctr?: number | null
          end_date?: string | null
          format?: string | null
          hypothesis?: string | null
          id?: string
          impressions?: number | null
          launch_date?: string | null
          learning?: string | null
          next_action?: string | null
          objective_id?: string | null
          orders?: number | null
          platform?: string | null
          revenue?: number | null
          spend?: number | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_concept_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_concept_log_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "gos_business_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_creative_briefs: {
        Row: {
          audience_desires: string | null
          audience_pains: string | null
          big_idea: string | null
          brand_voice: string | null
          client_id: string
          core_promise: string | null
          created_at: string
          created_by: string | null
          deliverables_count: number | null
          do_not_use: string | null
          due_date: string | null
          formats: string[] | null
          generated_at: string | null
          generated_brief: string | null
          id: string
          mandatory_elements: string | null
          objective_id: string | null
          offer: string | null
          platforms: string[] | null
          proof_points: string | null
          reference_links: string | null
          reference_winners: string[] | null
          status: string
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_desires?: string | null
          audience_pains?: string | null
          big_idea?: string | null
          brand_voice?: string | null
          client_id: string
          core_promise?: string | null
          created_at?: string
          created_by?: string | null
          deliverables_count?: number | null
          do_not_use?: string | null
          due_date?: string | null
          formats?: string[] | null
          generated_at?: string | null
          generated_brief?: string | null
          id?: string
          mandatory_elements?: string | null
          objective_id?: string | null
          offer?: string | null
          platforms?: string[] | null
          proof_points?: string | null
          reference_links?: string | null
          reference_winners?: string[] | null
          status?: string
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_desires?: string | null
          audience_pains?: string | null
          big_idea?: string | null
          brand_voice?: string | null
          client_id?: string
          core_promise?: string | null
          created_at?: string
          created_by?: string | null
          deliverables_count?: number | null
          do_not_use?: string | null
          due_date?: string | null
          formats?: string[] | null
          generated_at?: string | null
          generated_brief?: string | null
          id?: string
          mandatory_elements?: string | null
          objective_id?: string | null
          offer?: string | null
          platforms?: string[] | null
          proof_points?: string | null
          reference_links?: string | null
          reference_winners?: string[] | null
          status?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_creative_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_creative_briefs_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "gos_business_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_creative_demand_runs: {
        Row: {
          assumptions: Json | null
          avg_cpm: number | null
          breakdown: Json | null
          client_id: string
          confidence: number | null
          created_at: string
          creatives_per_week_needed: number | null
          fatigue_threshold_impressions: number | null
          formula_used: string | null
          id: string
          notes: string | null
          period_label: string
          static_creatives_needed: number | null
          status: string | null
          target_ad_spend: number | null
          ugc_creatives_needed: number | null
          updated_at: string
          video_creatives_needed: number | null
        }
        Insert: {
          assumptions?: Json | null
          avg_cpm?: number | null
          breakdown?: Json | null
          client_id: string
          confidence?: number | null
          created_at?: string
          creatives_per_week_needed?: number | null
          fatigue_threshold_impressions?: number | null
          formula_used?: string | null
          id?: string
          notes?: string | null
          period_label: string
          static_creatives_needed?: number | null
          status?: string | null
          target_ad_spend?: number | null
          ugc_creatives_needed?: number | null
          updated_at?: string
          video_creatives_needed?: number | null
        }
        Update: {
          assumptions?: Json | null
          avg_cpm?: number | null
          breakdown?: Json | null
          client_id?: string
          confidence?: number | null
          created_at?: string
          creatives_per_week_needed?: number | null
          fatigue_threshold_impressions?: number | null
          formula_used?: string | null
          id?: string
          notes?: string | null
          period_label?: string
          static_creatives_needed?: number | null
          status?: string | null
          target_ad_spend?: number | null
          ugc_creatives_needed?: number | null
          updated_at?: string
          video_creatives_needed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_creative_demand_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_creative_testing_roadmap: {
        Row: {
          angle: string | null
          brief_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          effort_score: number | null
          expected_outcome: string | null
          format: string | null
          hypothesis: string | null
          id: string
          impact_score: number | null
          learnings_expected: string | null
          notes: string | null
          objective_id: string | null
          owner: string | null
          planned_budget: number | null
          planned_end_date: string | null
          planned_start_date: string | null
          platform: string | null
          priority: number
          resulting_concept_id: string | null
          status: string
          success_criteria: string | null
          tags: string[]
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          angle?: string | null
          brief_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          effort_score?: number | null
          expected_outcome?: string | null
          format?: string | null
          hypothesis?: string | null
          id?: string
          impact_score?: number | null
          learnings_expected?: string | null
          notes?: string | null
          objective_id?: string | null
          owner?: string | null
          planned_budget?: number | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          platform?: string | null
          priority?: number
          resulting_concept_id?: string | null
          status?: string
          success_criteria?: string | null
          tags?: string[]
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          angle?: string | null
          brief_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          effort_score?: number | null
          expected_outcome?: string | null
          format?: string | null
          hypothesis?: string | null
          id?: string
          impact_score?: number | null
          learnings_expected?: string | null
          notes?: string | null
          objective_id?: string | null
          owner?: string | null
          planned_budget?: number | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          platform?: string | null
          priority?: number
          resulting_concept_id?: string | null
          status?: string
          success_criteria?: string | null
          tags?: string[]
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_creative_testing_roadmap_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "gos_creative_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_creative_testing_roadmap_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_creative_testing_roadmap_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "gos_business_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_creative_testing_roadmap_resulting_concept_id_fkey"
            columns: ["resulting_concept_id"]
            isOneToOne: false
            referencedRelation: "gos_concept_log"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_customer_activity_snapshots: {
        Row: {
          active_customers: number | null
          backtest_error_percent: number | null
          client_id: string
          created_at: string
          id: string
          lapsed_customers: number | null
          net_active_customer_change: number | null
          new_customers: number | null
          notes: string | null
          quick_ratio: number | null
          reactivated_customers: number | null
          retention_quality: string | null
          snapshot_month: string
          updated_at: string
        }
        Insert: {
          active_customers?: number | null
          backtest_error_percent?: number | null
          client_id: string
          created_at?: string
          id?: string
          lapsed_customers?: number | null
          net_active_customer_change?: number | null
          new_customers?: number | null
          notes?: string | null
          quick_ratio?: number | null
          reactivated_customers?: number | null
          retention_quality?: string | null
          snapshot_month: string
          updated_at?: string
        }
        Update: {
          active_customers?: number | null
          backtest_error_percent?: number | null
          client_id?: string
          created_at?: string
          id?: string
          lapsed_customers?: number | null
          net_active_customer_change?: number | null
          new_customers?: number | null
          notes?: string | null
          quick_ratio?: number | null
          reactivated_customers?: number | null
          retention_quality?: string | null
          snapshot_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_customer_activity_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_daily_pnl_targets: {
        Row: {
          actual_ad_spend: number | null
          actual_leads: number | null
          actual_orders: number | null
          actual_revenue: number | null
          client_id: string
          created_at: string
          day_index: number
          day_of_week: number
          id: string
          notes: string | null
          pacing_weight: number
          parent_weekly_id: string | null
          projection_ad_spend: number | null
          projection_gross_profit: number | null
          projection_last_updated_at: string | null
          projection_last_updated_by: string | null
          projection_leads: number | null
          projection_orders: number | null
          projection_revenue: number | null
          status: string | null
          target_ad_spend: number | null
          target_date: string
          target_gross_profit: number | null
          target_leads: number | null
          target_locked_at: string | null
          target_locked_by: string | null
          target_orders: number | null
          target_revenue: number | null
          updated_at: string
          variance_pct: number | null
        }
        Insert: {
          actual_ad_spend?: number | null
          actual_leads?: number | null
          actual_orders?: number | null
          actual_revenue?: number | null
          client_id: string
          created_at?: string
          day_index: number
          day_of_week: number
          id?: string
          notes?: string | null
          pacing_weight?: number
          parent_weekly_id?: string | null
          projection_ad_spend?: number | null
          projection_gross_profit?: number | null
          projection_last_updated_at?: string | null
          projection_last_updated_by?: string | null
          projection_leads?: number | null
          projection_orders?: number | null
          projection_revenue?: number | null
          status?: string | null
          target_ad_spend?: number | null
          target_date: string
          target_gross_profit?: number | null
          target_leads?: number | null
          target_locked_at?: string | null
          target_locked_by?: string | null
          target_orders?: number | null
          target_revenue?: number | null
          updated_at?: string
          variance_pct?: number | null
        }
        Update: {
          actual_ad_spend?: number | null
          actual_leads?: number | null
          actual_orders?: number | null
          actual_revenue?: number | null
          client_id?: string
          created_at?: string
          day_index?: number
          day_of_week?: number
          id?: string
          notes?: string | null
          pacing_weight?: number
          parent_weekly_id?: string | null
          projection_ad_spend?: number | null
          projection_gross_profit?: number | null
          projection_last_updated_at?: string | null
          projection_last_updated_by?: string | null
          projection_leads?: number | null
          projection_orders?: number | null
          projection_revenue?: number | null
          status?: string | null
          target_ad_spend?: number | null
          target_date?: string
          target_gross_profit?: number | null
          target_leads?: number | null
          target_locked_at?: string | null
          target_locked_by?: string | null
          target_orders?: number | null
          target_revenue?: number | null
          updated_at?: string
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_daily_pnl_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_daily_pnl_targets_parent_weekly_id_fkey"
            columns: ["parent_weekly_id"]
            isOneToOne: false
            referencedRelation: "gos_weekly_pnl_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_data_sources: {
        Row: {
          client_id: string
          connection_mode: string
          connection_status: string
          created_at: string
          data_freshness_status: string
          feeds: string | null
          id: string
          last_sync_at: string | null
          notes: string | null
          reliability_score: number
          source_name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          connection_mode?: string
          connection_status?: string
          created_at?: string
          data_freshness_status?: string
          feeds?: string | null
          id?: string
          last_sync_at?: string | null
          notes?: string | null
          reliability_score?: number
          source_name: string
          source_type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          connection_mode?: string
          connection_status?: string
          created_at?: string
          data_freshness_status?: string
          feeds?: string | null
          id?: string
          last_sync_at?: string | null
          notes?: string | null
          reliability_score?: number
          source_name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_data_sources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_diagnoses: {
        Row: {
          bottleneck_details: Json | null
          client_id: string
          confidence_score: number | null
          contributing_factors: Json | null
          created_at: string
          id: string
          inputs_snapshot: Json | null
          notes: string | null
          primary_bottleneck: string | null
          problem_type: string | null
          recommended_focus: string | null
          severity: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          bottleneck_details?: Json | null
          client_id: string
          confidence_score?: number | null
          contributing_factors?: Json | null
          created_at?: string
          id?: string
          inputs_snapshot?: Json | null
          notes?: string | null
          primary_bottleneck?: string | null
          problem_type?: string | null
          recommended_focus?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          bottleneck_details?: Json | null
          client_id?: string
          confidence_score?: number | null
          contributing_factors?: Json | null
          created_at?: string
          id?: string
          inputs_snapshot?: Json | null
          notes?: string | null
          primary_bottleneck?: string | null
          problem_type?: string | null
          recommended_focus?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_diagnoses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_digest_recipients: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          email: string
          id: string
          role_label: string | null
          send_hour_utc: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          email: string
          id?: string
          role_label?: string | null
          send_hour_utc?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          role_label?: string | null
          send_hour_utc?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_digest_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_digest_sends: {
        Row: {
          client_id: string
          created_at: string
          digest_date: string
          email_id: string | null
          error: string | null
          id: string
          recipient_email: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          digest_date: string
          email_id?: string | null
          error?: string | null
          id?: string
          recipient_email: string
          status: string
        }
        Update: {
          client_id?: string
          created_at?: string
          digest_date?: string
          email_id?: string | null
          error?: string | null
          id?: string
          recipient_email?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_digest_sends_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_event_effects: {
        Row: {
          actual_lift_pct: number | null
          actual_revenue_delta: number | null
          assumptions: Json | null
          causal_lift_abs: number | null
          causal_lift_pct: number | null
          ci_high: number | null
          ci_low: number | null
          client_id: string
          confidence: string | null
          control_post_series: Json | null
          control_pre_series: Json | null
          counterfactual_mean: number | null
          created_at: string
          end_date: string | null
          engine_output: Json | null
          engine_version: string | null
          event_name: string
          event_type: string | null
          expected_lift_pct: number | null
          expected_revenue_delta: number | null
          id: string
          method: string | null
          metric: string | null
          notes: string | null
          p_value: number | null
          post_mean: number | null
          post_series: Json | null
          post_std: number | null
          post_window_days: number | null
          pre_mean: number | null
          pre_series: Json | null
          pre_std: number | null
          pre_window_days: number | null
          recommendation: string | null
          start_date: string | null
          status: string | null
          test_statistic: number | null
          updated_at: string
        }
        Insert: {
          actual_lift_pct?: number | null
          actual_revenue_delta?: number | null
          assumptions?: Json | null
          causal_lift_abs?: number | null
          causal_lift_pct?: number | null
          ci_high?: number | null
          ci_low?: number | null
          client_id: string
          confidence?: string | null
          control_post_series?: Json | null
          control_pre_series?: Json | null
          counterfactual_mean?: number | null
          created_at?: string
          end_date?: string | null
          engine_output?: Json | null
          engine_version?: string | null
          event_name: string
          event_type?: string | null
          expected_lift_pct?: number | null
          expected_revenue_delta?: number | null
          id?: string
          method?: string | null
          metric?: string | null
          notes?: string | null
          p_value?: number | null
          post_mean?: number | null
          post_series?: Json | null
          post_std?: number | null
          post_window_days?: number | null
          pre_mean?: number | null
          pre_series?: Json | null
          pre_std?: number | null
          pre_window_days?: number | null
          recommendation?: string | null
          start_date?: string | null
          status?: string | null
          test_statistic?: number | null
          updated_at?: string
        }
        Update: {
          actual_lift_pct?: number | null
          actual_revenue_delta?: number | null
          assumptions?: Json | null
          causal_lift_abs?: number | null
          causal_lift_pct?: number | null
          ci_high?: number | null
          ci_low?: number | null
          client_id?: string
          confidence?: string | null
          control_post_series?: Json | null
          control_pre_series?: Json | null
          counterfactual_mean?: number | null
          created_at?: string
          end_date?: string | null
          engine_output?: Json | null
          engine_version?: string | null
          event_name?: string
          event_type?: string | null
          expected_lift_pct?: number | null
          expected_revenue_delta?: number | null
          id?: string
          method?: string | null
          metric?: string | null
          notes?: string | null
          p_value?: number | null
          post_mean?: number | null
          post_series?: Json | null
          post_std?: number | null
          post_window_days?: number | null
          pre_mean?: number | null
          pre_series?: Json | null
          pre_std?: number | null
          pre_window_days?: number | null
          recommendation?: string | null
          start_date?: string | null
          status?: string | null
          test_statistic?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_event_effects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_financial_inputs: {
        Row: {
          aov: number | null
          avg_job_value: number | null
          business_type: string
          client_id: string
          cogs_per_order: number | null
          created_at: string
          desired_contribution_margin_percent: number | null
          fulfillment_cost_per_order: number | null
          gross_margin_percent: number | null
          id: string
          labor_cost: number | null
          material_cost: number | null
          payback_window_days: number | null
          payment_processing_percent: number | null
          refund_rate_percent: number | null
          shipping_cost_per_order: number | null
          status: string
          target_cac: number | null
          target_close_rate: number | null
          target_cost_per_booked_appointment: number | null
          target_cost_per_job: number | null
          target_cpl: number | null
          target_mer: number | null
          target_roas: number | null
          travel_cost: number | null
          updated_at: string
        }
        Insert: {
          aov?: number | null
          avg_job_value?: number | null
          business_type?: string
          client_id: string
          cogs_per_order?: number | null
          created_at?: string
          desired_contribution_margin_percent?: number | null
          fulfillment_cost_per_order?: number | null
          gross_margin_percent?: number | null
          id?: string
          labor_cost?: number | null
          material_cost?: number | null
          payback_window_days?: number | null
          payment_processing_percent?: number | null
          refund_rate_percent?: number | null
          shipping_cost_per_order?: number | null
          status?: string
          target_cac?: number | null
          target_close_rate?: number | null
          target_cost_per_booked_appointment?: number | null
          target_cost_per_job?: number | null
          target_cpl?: number | null
          target_mer?: number | null
          target_roas?: number | null
          travel_cost?: number | null
          updated_at?: string
        }
        Update: {
          aov?: number | null
          avg_job_value?: number | null
          business_type?: string
          client_id?: string
          cogs_per_order?: number | null
          created_at?: string
          desired_contribution_margin_percent?: number | null
          fulfillment_cost_per_order?: number | null
          gross_margin_percent?: number | null
          id?: string
          labor_cost?: number | null
          material_cost?: number | null
          payback_window_days?: number | null
          payment_processing_percent?: number | null
          refund_rate_percent?: number | null
          shipping_cost_per_order?: number | null
          status?: string
          target_cac?: number | null
          target_close_rate?: number | null
          target_cost_per_booked_appointment?: number | null
          target_cost_per_job?: number | null
          target_cpl?: number | null
          target_mer?: number | null
          target_roas?: number | null
          travel_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_financial_inputs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_forecast_updates: {
        Row: {
          assumptions: Json | null
          client_id: string
          created_at: string
          delta_revenue_pct: number | null
          delta_spend_pct: number | null
          drift_signal: string | null
          engine_output: Json | null
          engine_version: string | null
          id: string
          kalman_gain: number | null
          likelihood_mean: number | null
          likelihood_variance: number | null
          new_confidence: number | null
          notes: string | null
          parent_forecast_id: string | null
          posterior_ci_high: number | null
          posterior_ci_low: number | null
          posterior_mean: number | null
          posterior_variance: number | null
          previous_ad_spend: number | null
          previous_cac: number | null
          previous_revenue: number | null
          prior_mean: number | null
          prior_variance: number | null
          status: string | null
          triggered_by: string | null
          update_reason: string | null
          updated_ad_spend: number | null
          updated_at: string
          updated_cac: number | null
          updated_revenue: number | null
        }
        Insert: {
          assumptions?: Json | null
          client_id: string
          created_at?: string
          delta_revenue_pct?: number | null
          delta_spend_pct?: number | null
          drift_signal?: string | null
          engine_output?: Json | null
          engine_version?: string | null
          id?: string
          kalman_gain?: number | null
          likelihood_mean?: number | null
          likelihood_variance?: number | null
          new_confidence?: number | null
          notes?: string | null
          parent_forecast_id?: string | null
          posterior_ci_high?: number | null
          posterior_ci_low?: number | null
          posterior_mean?: number | null
          posterior_variance?: number | null
          previous_ad_spend?: number | null
          previous_cac?: number | null
          previous_revenue?: number | null
          prior_mean?: number | null
          prior_variance?: number | null
          status?: string | null
          triggered_by?: string | null
          update_reason?: string | null
          updated_ad_spend?: number | null
          updated_at?: string
          updated_cac?: number | null
          updated_revenue?: number | null
        }
        Update: {
          assumptions?: Json | null
          client_id?: string
          created_at?: string
          delta_revenue_pct?: number | null
          delta_spend_pct?: number | null
          drift_signal?: string | null
          engine_output?: Json | null
          engine_version?: string | null
          id?: string
          kalman_gain?: number | null
          likelihood_mean?: number | null
          likelihood_variance?: number | null
          new_confidence?: number | null
          notes?: string | null
          parent_forecast_id?: string | null
          posterior_ci_high?: number | null
          posterior_ci_low?: number | null
          posterior_mean?: number | null
          posterior_variance?: number | null
          previous_ad_spend?: number | null
          previous_cac?: number | null
          previous_revenue?: number | null
          prior_mean?: number | null
          prior_variance?: number | null
          status?: string | null
          triggered_by?: string | null
          update_reason?: string | null
          updated_ad_spend?: number | null
          updated_at?: string
          updated_cac?: number | null
          updated_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_forecast_updates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_forecast_updates_parent_forecast_id_fkey"
            columns: ["parent_forecast_id"]
            isOneToOne: false
            referencedRelation: "gos_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_forecasts: {
        Row: {
          assumptions: Json | null
          client_id: string
          confidence: number | null
          created_at: string
          formula_used: string | null
          horizon_days: number
          id: string
          inputs_snapshot: Json | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          projected_ad_spend: number | null
          projected_cac: number | null
          projected_gross_profit: number | null
          projected_leads: number | null
          projected_mer: number | null
          projected_orders: number | null
          projected_revenue: number | null
          projected_roas: number | null
          scenario: string
          status: string | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json | null
          client_id: string
          confidence?: number | null
          created_at?: string
          formula_used?: string | null
          horizon_days?: number
          id?: string
          inputs_snapshot?: Json | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          projected_ad_spend?: number | null
          projected_cac?: number | null
          projected_gross_profit?: number | null
          projected_leads?: number | null
          projected_mer?: number | null
          projected_orders?: number | null
          projected_revenue?: number | null
          projected_roas?: number | null
          scenario?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json | null
          client_id?: string
          confidence?: number | null
          created_at?: string
          formula_used?: string | null
          horizon_days?: number
          id?: string
          inputs_snapshot?: Json | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          projected_ad_spend?: number | null
          projected_cac?: number | null
          projected_gross_profit?: number | null
          projected_leads?: number | null
          projected_mer?: number | null
          projected_orders?: number | null
          projected_revenue?: number | null
          projected_roas?: number | null
          scenario?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_forecasts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_funnel_economics: {
        Row: {
          break_even_cac: number | null
          campaign_name: string | null
          client_id: string
          created_at: string
          expected_contribution_before_cac: number | null
          expected_gross_profit: number | null
          expected_order_type: string | null
          expected_order_value: number | null
          expected_product_mix_json: Json | null
          expected_units_per_order: number | null
          first_order_profit_at_target_cac: number | null
          funnel_name: string | null
          funnel_type: string | null
          id: string
          landing_page_url: string | null
          modal_order_value: number | null
          notes: string | null
          primary_product_id: string | null
          primary_sku: string | null
          status: string | null
          target_cac: number | null
          updated_at: string
        }
        Insert: {
          break_even_cac?: number | null
          campaign_name?: string | null
          client_id: string
          created_at?: string
          expected_contribution_before_cac?: number | null
          expected_gross_profit?: number | null
          expected_order_type?: string | null
          expected_order_value?: number | null
          expected_product_mix_json?: Json | null
          expected_units_per_order?: number | null
          first_order_profit_at_target_cac?: number | null
          funnel_name?: string | null
          funnel_type?: string | null
          id?: string
          landing_page_url?: string | null
          modal_order_value?: number | null
          notes?: string | null
          primary_product_id?: string | null
          primary_sku?: string | null
          status?: string | null
          target_cac?: number | null
          updated_at?: string
        }
        Update: {
          break_even_cac?: number | null
          campaign_name?: string | null
          client_id?: string
          created_at?: string
          expected_contribution_before_cac?: number | null
          expected_gross_profit?: number | null
          expected_order_type?: string | null
          expected_order_value?: number | null
          expected_product_mix_json?: Json | null
          expected_units_per_order?: number | null
          first_order_profit_at_target_cac?: number | null
          funnel_name?: string | null
          funnel_type?: string | null
          id?: string
          landing_page_url?: string | null
          modal_order_value?: number | null
          notes?: string | null
          primary_product_id?: string | null
          primary_sku?: string | null
          status?: string | null
          target_cac?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_funnel_economics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_funnel_economics_primary_product_id_fkey"
            columns: ["primary_product_id"]
            isOneToOne: false
            referencedRelation: "gos_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_gross_to_net_snapshots: {
        Row: {
          chargebacks: number | null
          client_id: string
          created_at: string
          discounts: number | null
          gross_revenue: number | null
          gross_to_net_gap_percent: number | null
          id: string
          net_revenue: number | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          refunds: number | null
          shipping_collected: number | null
          taxes_collected: number | null
        }
        Insert: {
          chargebacks?: number | null
          client_id: string
          created_at?: string
          discounts?: number | null
          gross_revenue?: number | null
          gross_to_net_gap_percent?: number | null
          id?: string
          net_revenue?: number | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          refunds?: number | null
          shipping_collected?: number | null
          taxes_collected?: number | null
        }
        Update: {
          chargebacks?: number | null
          client_id?: string
          created_at?: string
          discounts?: number | null
          gross_revenue?: number | null
          gross_to_net_gap_percent?: number | null
          id?: string
          net_revenue?: number | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          refunds?: number | null
          shipping_collected?: number | null
          taxes_collected?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_gross_to_net_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_growth_execution_items: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          estimated_impact: string | null
          hypothesis: string | null
          id: string
          item_type: string | null
          linked_test_id: string | null
          map_id: string
          notes: string | null
          owner: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          estimated_impact?: string | null
          hypothesis?: string | null
          id?: string
          item_type?: string | null
          linked_test_id?: string | null
          map_id: string
          notes?: string | null
          owner?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          estimated_impact?: string | null
          hypothesis?: string | null
          id?: string
          item_type?: string | null
          linked_test_id?: string | null
          map_id?: string
          notes?: string | null
          owner?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_growth_execution_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_growth_execution_items_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "gos_growth_execution_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_growth_execution_maps: {
        Row: {
          client_id: string
          created_at: string
          id: string
          linked_diagnosis_id: string | null
          linked_target_id: string | null
          notes: string | null
          owner: string | null
          period_end: string | null
          period_label: string
          period_start: string | null
          primary_focus: string | null
          status: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          linked_diagnosis_id?: string | null
          linked_target_id?: string | null
          notes?: string | null
          owner?: string | null
          period_end?: string | null
          period_label: string
          period_start?: string | null
          primary_focus?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          linked_diagnosis_id?: string | null
          linked_target_id?: string | null
          notes?: string | null
          owner?: string | null
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          primary_focus?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_growth_execution_maps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_growth_execution_maps_linked_diagnosis_id_fkey"
            columns: ["linked_diagnosis_id"]
            isOneToOne: false
            referencedRelation: "gos_diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_growth_execution_maps_linked_target_id_fkey"
            columns: ["linked_target_id"]
            isOneToOne: false
            referencedRelation: "gos_metric_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_integration_connections: {
        Row: {
          client_id: string
          config: Json
          created_at: string
          display_name: string | null
          id: string
          last_sync_at: string | null
          last_sync_status: string | null
          next_sync_at: string | null
          notes: string | null
          provider: string
          status: string
          sync_frequency_hours: number
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          client_id: string
          config?: Json
          created_at?: string
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          next_sync_at?: string | null
          notes?: string | null
          provider: string
          status?: string
          sync_frequency_hours?: number
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          client_id?: string
          config?: Json
          created_at?: string
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          next_sync_at?: string | null
          notes?: string | null
          provider?: string
          status?: string
          sync_frequency_hours?: number
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_integration_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_integration_sync_runs: {
        Row: {
          client_id: string
          connection_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json
          provider: string
          rows_ingested: number
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          client_id: string
          connection_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          provider: string
          rows_ingested?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          client_id?: string
          connection_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          provider?: string
          rows_ingested?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_integration_sync_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_integration_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gos_integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_inventory_grade_snapshots: {
        Row: {
          cash_locked_in_inventory: number | null
          client_id: string
          created_at: string
          daily_sales_velocity: number | null
          days_of_inventory_on_hand: number | null
          id: string
          inventory_grade: string | null
          inventory_units: number | null
          inventory_value_at_cost: number | null
          inventory_value_at_retail: number | null
          product_id: string | null
          recommended_media_strategy: string | null
          sku: string | null
        }
        Insert: {
          cash_locked_in_inventory?: number | null
          client_id: string
          created_at?: string
          daily_sales_velocity?: number | null
          days_of_inventory_on_hand?: number | null
          id?: string
          inventory_grade?: string | null
          inventory_units?: number | null
          inventory_value_at_cost?: number | null
          inventory_value_at_retail?: number | null
          product_id?: string | null
          recommended_media_strategy?: string | null
          sku?: string | null
        }
        Update: {
          cash_locked_in_inventory?: number | null
          client_id?: string
          created_at?: string
          daily_sales_velocity?: number | null
          days_of_inventory_on_hand?: number | null
          id?: string
          inventory_grade?: string | null
          inventory_units?: number | null
          inventory_value_at_cost?: number | null
          inventory_value_at_retail?: number | null
          product_id?: string | null
          recommended_media_strategy?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_inventory_grade_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_inventory_grade_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gos_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_inventory_snapshots: {
        Row: {
          available_stock: number | null
          client_id: string
          created_at: string
          daily_sales_velocity: number | null
          estimated_restock_date: string | null
          id: string
          inventory_risk: string | null
          notes: string | null
          product_id: string | null
          reserved_stock: number | null
          safe_to_scale: boolean | null
        }
        Insert: {
          available_stock?: number | null
          client_id: string
          created_at?: string
          daily_sales_velocity?: number | null
          estimated_restock_date?: string | null
          id?: string
          inventory_risk?: string | null
          notes?: string | null
          product_id?: string | null
          reserved_stock?: number | null
          safe_to_scale?: boolean | null
        }
        Update: {
          available_stock?: number | null
          client_id?: string
          created_at?: string
          daily_sales_velocity?: number | null
          estimated_restock_date?: string | null
          id?: string
          inventory_risk?: string | null
          notes?: string | null
          product_id?: string | null
          reserved_stock?: number | null
          safe_to_scale?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_inventory_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gos_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_learning_entries: {
        Row: {
          captured_by: string | null
          category: string
          client_id: string
          confidence: number | null
          created_at: string
          hypothesis: string | null
          id: string
          impact_level: string | null
          insight: string
          metadata: Json | null
          recommendation: string | null
          result: string | null
          source_ref_id: string | null
          source_type: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          captured_by?: string | null
          category?: string
          client_id: string
          confidence?: number | null
          created_at?: string
          hypothesis?: string | null
          id?: string
          impact_level?: string | null
          insight: string
          metadata?: Json | null
          recommendation?: string | null
          result?: string | null
          source_ref_id?: string | null
          source_type?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          captured_by?: string | null
          category?: string
          client_id?: string
          confidence?: number | null
          created_at?: string
          hypothesis?: string | null
          id?: string
          impact_level?: string | null
          insight?: string
          metadata?: Json | null
          recommendation?: string | null
          result?: string | null
          source_ref_id?: string | null
          source_type?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_learning_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_lifecycle_segments: {
        Row: {
          aov: number | null
          arpu: number | null
          churn_risk_pct: number | null
          client_id: string
          created_at: string
          created_by: string | null
          criteria: string | null
          customer_count: number
          frequency_days: number | null
          id: string
          priority: string
          recommended_action: string | null
          recommended_channel: string | null
          segment_name: string
          segment_type: string
          updated_at: string
        }
        Insert: {
          aov?: number | null
          arpu?: number | null
          churn_risk_pct?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          customer_count?: number
          frequency_days?: number | null
          id?: string
          priority?: string
          recommended_action?: string | null
          recommended_channel?: string | null
          segment_name: string
          segment_type?: string
          updated_at?: string
        }
        Update: {
          aov?: number | null
          arpu?: number | null
          churn_risk_pct?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          customer_count?: number
          frequency_days?: number | null
          id?: string
          priority?: string
          recommended_action?: string | null
          recommended_channel?: string | null
          segment_name?: string
          segment_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_lifecycle_segments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_live_optimization_reviews: {
        Row: {
          actions_taken: Json | null
          actual_ad_spend: number | null
          actual_cac: number | null
          actual_mer: number | null
          actual_revenue: number | null
          alerts: Json | null
          client_id: string
          created_at: string
          health_verdict: string | null
          id: string
          next_actions: Json | null
          notes: string | null
          period_label: string | null
          review_date: string
          reviewer: string | null
          status: string | null
          updated_at: string
          variance_vs_target_pct: number | null
        }
        Insert: {
          actions_taken?: Json | null
          actual_ad_spend?: number | null
          actual_cac?: number | null
          actual_mer?: number | null
          actual_revenue?: number | null
          alerts?: Json | null
          client_id: string
          created_at?: string
          health_verdict?: string | null
          id?: string
          next_actions?: Json | null
          notes?: string | null
          period_label?: string | null
          review_date: string
          reviewer?: string | null
          status?: string | null
          updated_at?: string
          variance_vs_target_pct?: number | null
        }
        Update: {
          actions_taken?: Json | null
          actual_ad_spend?: number | null
          actual_cac?: number | null
          actual_mer?: number | null
          actual_revenue?: number | null
          alerts?: Json | null
          client_id?: string
          created_at?: string
          health_verdict?: string | null
          id?: string
          next_actions?: Json | null
          notes?: string | null
          period_label?: string | null
          review_date?: string
          reviewer?: string | null
          status?: string | null
          updated_at?: string
          variance_vs_target_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_live_optimization_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_ltv_cac_predictions: {
        Row: {
          ad_spend: number | null
          avg_order_value: number | null
          cac: number | null
          channel: string | null
          churn_rate_pct: number | null
          client_id: string
          confidence_score: number | null
          contribution_margin: number | null
          created_at: string
          created_by: string | null
          gross_margin_pct: number | null
          horizon_months: number
          id: string
          ltv_cac_ratio: number | null
          model_notes: string | null
          new_customers: number | null
          payback_months: number | null
          predicted_ltv: number | null
          purchase_frequency: number | null
          repeat_rate_pct: number | null
          segment: string | null
          snapshot_date: string
          updated_at: string
        }
        Insert: {
          ad_spend?: number | null
          avg_order_value?: number | null
          cac?: number | null
          channel?: string | null
          churn_rate_pct?: number | null
          client_id: string
          confidence_score?: number | null
          contribution_margin?: number | null
          created_at?: string
          created_by?: string | null
          gross_margin_pct?: number | null
          horizon_months?: number
          id?: string
          ltv_cac_ratio?: number | null
          model_notes?: string | null
          new_customers?: number | null
          payback_months?: number | null
          predicted_ltv?: number | null
          purchase_frequency?: number | null
          repeat_rate_pct?: number | null
          segment?: string | null
          snapshot_date?: string
          updated_at?: string
        }
        Update: {
          ad_spend?: number | null
          avg_order_value?: number | null
          cac?: number | null
          channel?: string | null
          churn_rate_pct?: number | null
          client_id?: string
          confidence_score?: number | null
          contribution_margin?: number | null
          created_at?: string
          created_by?: string | null
          gross_margin_pct?: number | null
          horizon_months?: number
          id?: string
          ltv_cac_ratio?: number | null
          model_notes?: string | null
          new_customers?: number | null
          payback_months?: number | null
          predicted_ltv?: number | null
          purchase_frequency?: number | null
          repeat_rate_pct?: number | null
          segment?: string | null
          snapshot_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_ltv_cac_predictions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_map_notes: {
        Row: {
          author_id: string | null
          author_role: string
          client_id: string
          created_at: string
          id: string
          is_signal: boolean
          linked_projection_update_id: string | null
          note_date: string
          now_what: string | null
          scope_key: string | null
          scope_label: string | null
          scope_type: string
          so_what: string | null
          status: string
          updated_at: string
          what_happened: string
        }
        Insert: {
          author_id?: string | null
          author_role?: string
          client_id: string
          created_at?: string
          id?: string
          is_signal?: boolean
          linked_projection_update_id?: string | null
          note_date?: string
          now_what?: string | null
          scope_key?: string | null
          scope_label?: string | null
          scope_type?: string
          so_what?: string | null
          status?: string
          updated_at?: string
          what_happened: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          client_id?: string
          created_at?: string
          id?: string
          is_signal?: boolean
          linked_projection_update_id?: string | null
          note_date?: string
          now_what?: string | null
          scope_key?: string | null
          scope_label?: string | null
          scope_type?: string
          so_what?: string | null
          status?: string
          updated_at?: string
          what_happened?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_map_notes_linked_projection_update_id_fkey"
            columns: ["linked_projection_update_id"]
            isOneToOne: false
            referencedRelation: "gos_projection_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_measurement_snapshots: {
        Row: {
          actual_ad_spend: number | null
          actual_cac: number | null
          actual_close_rate: number | null
          actual_cpl: number | null
          actual_cvr: number | null
          actual_gross_profit: number | null
          actual_leads: number | null
          actual_mer: number | null
          actual_orders: number | null
          actual_revenue: number | null
          actual_roas: number | null
          alert_level: string | null
          client_id: string
          created_at: string
          id: string
          linked_target_id: string | null
          notes: string | null
          period_end: string | null
          period_label: string
          period_start: string | null
          updated_at: string
          variance_pct: Json | null
        }
        Insert: {
          actual_ad_spend?: number | null
          actual_cac?: number | null
          actual_close_rate?: number | null
          actual_cpl?: number | null
          actual_cvr?: number | null
          actual_gross_profit?: number | null
          actual_leads?: number | null
          actual_mer?: number | null
          actual_orders?: number | null
          actual_revenue?: number | null
          actual_roas?: number | null
          alert_level?: string | null
          client_id: string
          created_at?: string
          id?: string
          linked_target_id?: string | null
          notes?: string | null
          period_end?: string | null
          period_label: string
          period_start?: string | null
          updated_at?: string
          variance_pct?: Json | null
        }
        Update: {
          actual_ad_spend?: number | null
          actual_cac?: number | null
          actual_close_rate?: number | null
          actual_cpl?: number | null
          actual_cvr?: number | null
          actual_gross_profit?: number | null
          actual_leads?: number | null
          actual_mer?: number | null
          actual_orders?: number | null
          actual_revenue?: number | null
          actual_roas?: number | null
          alert_level?: string | null
          client_id?: string
          created_at?: string
          id?: string
          linked_target_id?: string | null
          notes?: string | null
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          updated_at?: string
          variance_pct?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_measurement_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_measurement_snapshots_linked_target_id_fkey"
            columns: ["linked_target_id"]
            isOneToOne: false
            referencedRelation: "gos_metric_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_measurement_tests: {
        Row: {
          ci_high: number | null
          ci_low: number | null
          client_id: string
          confidence: number | null
          control_conversions: number | null
          control_mean: number | null
          control_sample_size: number | null
          control_std: number | null
          created_at: string
          end_date: string | null
          engine_output: Json | null
          engine_version: string | null
          hypothesis: string | null
          id: string
          learning: string | null
          lift_pct: number | null
          mde_relative: number | null
          metric_type: string | null
          notes: string | null
          p_value: number | null
          primary_metric: string | null
          recommendation: string | null
          result: string | null
          significance_level: number | null
          standard_error: number | null
          start_date: string | null
          statistical_power: number | null
          status: string | null
          test_name: string
          test_statistic: number | null
          test_type: string | null
          updated_at: string
          variant_a: string | null
          variant_b: string | null
          variant_conversions: number | null
          variant_mean: number | null
          variant_sample_size: number | null
          variant_std: number | null
          winner: string | null
        }
        Insert: {
          ci_high?: number | null
          ci_low?: number | null
          client_id: string
          confidence?: number | null
          control_conversions?: number | null
          control_mean?: number | null
          control_sample_size?: number | null
          control_std?: number | null
          created_at?: string
          end_date?: string | null
          engine_output?: Json | null
          engine_version?: string | null
          hypothesis?: string | null
          id?: string
          learning?: string | null
          lift_pct?: number | null
          mde_relative?: number | null
          metric_type?: string | null
          notes?: string | null
          p_value?: number | null
          primary_metric?: string | null
          recommendation?: string | null
          result?: string | null
          significance_level?: number | null
          standard_error?: number | null
          start_date?: string | null
          statistical_power?: number | null
          status?: string | null
          test_name: string
          test_statistic?: number | null
          test_type?: string | null
          updated_at?: string
          variant_a?: string | null
          variant_b?: string | null
          variant_conversions?: number | null
          variant_mean?: number | null
          variant_sample_size?: number | null
          variant_std?: number | null
          winner?: string | null
        }
        Update: {
          ci_high?: number | null
          ci_low?: number | null
          client_id?: string
          confidence?: number | null
          control_conversions?: number | null
          control_mean?: number | null
          control_sample_size?: number | null
          control_std?: number | null
          created_at?: string
          end_date?: string | null
          engine_output?: Json | null
          engine_version?: string | null
          hypothesis?: string | null
          id?: string
          learning?: string | null
          lift_pct?: number | null
          mde_relative?: number | null
          metric_type?: string | null
          notes?: string | null
          p_value?: number | null
          primary_metric?: string | null
          recommendation?: string | null
          result?: string | null
          significance_level?: number | null
          standard_error?: number | null
          start_date?: string | null
          statistical_power?: number | null
          status?: string | null
          test_name?: string
          test_statistic?: number | null
          test_type?: string | null
          updated_at?: string
          variant_a?: string | null
          variant_b?: string | null
          variant_conversions?: number | null
          variant_mean?: number | null
          variant_sample_size?: number | null
          variant_std?: number | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_measurement_tests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_media_buying_actions: {
        Row: {
          action_type: string
          action_value: number | null
          applied_at: string | null
          applied_by: string | null
          client_id: string
          created_at: string
          id: string
          metric: string | null
          metric_value: number | null
          notes: string | null
          rule_id: string | null
          status: string
          target_name: string
          target_platform: string | null
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          action_type: string
          action_value?: number | null
          applied_at?: string | null
          applied_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          metric?: string | null
          metric_value?: number | null
          notes?: string | null
          rule_id?: string | null
          status?: string
          target_name: string
          target_platform?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          action_value?: number | null
          applied_at?: string | null
          applied_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          metric?: string | null
          metric_value?: number | null
          notes?: string | null
          rule_id?: string | null
          status?: string
          target_name?: string
          target_platform?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_media_buying_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_media_buying_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "gos_media_buying_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_media_buying_rules: {
        Row: {
          action_type: string
          action_value: number | null
          client_id: string
          cooldown_hours: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          lookback_days: number
          metric: string
          notes: string | null
          operator: string
          platform: string
          priority: string
          rule_name: string
          scope: string
          threshold_value: number
          updated_at: string
        }
        Insert: {
          action_type: string
          action_value?: number | null
          client_id: string
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lookback_days?: number
          metric: string
          notes?: string | null
          operator: string
          platform?: string
          priority?: string
          rule_name: string
          scope?: string
          threshold_value: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          action_value?: number | null
          client_id?: string
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lookback_days?: number
          metric?: string
          notes?: string | null
          operator?: string
          platform?: string
          priority?: string
          rule_name?: string
          scope?: string
          threshold_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_media_buying_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_metric_targets: {
        Row: {
          assumptions: Json | null
          client_id: string
          created_at: string
          derived_from_forecast_id: string | null
          id: string
          notes: string | null
          period_end: string | null
          period_label: string
          period_start: string | null
          status: string | null
          target_ad_spend: number | null
          target_aov: number | null
          target_cac: number | null
          target_close_rate: number | null
          target_cpl: number | null
          target_cvr: number | null
          target_gross_profit: number | null
          target_leads: number | null
          target_mer: number | null
          target_orders: number | null
          target_revenue: number | null
          target_roas: number | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json | null
          client_id: string
          created_at?: string
          derived_from_forecast_id?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_label: string
          period_start?: string | null
          status?: string | null
          target_ad_spend?: number | null
          target_aov?: number | null
          target_cac?: number | null
          target_close_rate?: number | null
          target_cpl?: number | null
          target_cvr?: number | null
          target_gross_profit?: number | null
          target_leads?: number | null
          target_mer?: number | null
          target_orders?: number | null
          target_revenue?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json | null
          client_id?: string
          created_at?: string
          derived_from_forecast_id?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          status?: string | null
          target_ad_spend?: number | null
          target_aov?: number | null
          target_cac?: number | null
          target_close_rate?: number | null
          target_cpl?: number | null
          target_cvr?: number | null
          target_gross_profit?: number | null
          target_leads?: number | null
          target_mer?: number | null
          target_orders?: number | null
          target_revenue?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_metric_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_metric_targets_derived_from_forecast_id_fkey"
            columns: ["derived_from_forecast_id"]
            isOneToOne: false
            referencedRelation: "gos_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_next_cycle_plans: {
        Row: {
          budget_allocation: Json | null
          client_id: string
          created_at: string
          created_by: string | null
          cycle_end: string | null
          cycle_name: string
          cycle_start: string | null
          dependencies: string | null
          id: string
          key_hypotheses: Json | null
          known_risks: Json | null
          linked_learning_ids: string[] | null
          north_star_goal: string | null
          notes: string | null
          planned_budget: number | null
          primary_objectives: Json | null
          status: string
          target_cac: number | null
          target_revenue: number | null
          target_roas: number | null
          updated_at: string
        }
        Insert: {
          budget_allocation?: Json | null
          client_id: string
          created_at?: string
          created_by?: string | null
          cycle_end?: string | null
          cycle_name: string
          cycle_start?: string | null
          dependencies?: string | null
          id?: string
          key_hypotheses?: Json | null
          known_risks?: Json | null
          linked_learning_ids?: string[] | null
          north_star_goal?: string | null
          notes?: string | null
          planned_budget?: number | null
          primary_objectives?: Json | null
          status?: string
          target_cac?: number | null
          target_revenue?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Update: {
          budget_allocation?: Json | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          cycle_end?: string | null
          cycle_name?: string
          cycle_start?: string | null
          dependencies?: string | null
          id?: string
          key_hypotheses?: Json | null
          known_risks?: Json | null
          linked_learning_ids?: string[] | null
          north_star_goal?: string | null
          notes?: string | null
          planned_budget?: number | null
          primary_objectives?: Json | null
          status?: string
          target_cac?: number | null
          target_revenue?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_next_cycle_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_offer_economics_runs: {
        Row: {
          base_price: number | null
          break_even_cac_after_offer: number | null
          break_even_roas_after_offer: number | null
          client_id: string
          cogs: number | null
          created_at: string
          discount_allowance: number | null
          discount_percent: number | null
          discounted_price: number | null
          fulfillment_cost: number | null
          gift_cost: number | null
          gross_margin_after_offer_percent: number | null
          gross_profit_after_offer: number | null
          id: string
          model_run_id: string | null
          offer_name: string | null
          offer_type: string | null
          offer_viability: string | null
          payment_processing_cost: number | null
          recommendation: string | null
          refund_allowance: number | null
          shipping_cost: number | null
        }
        Insert: {
          base_price?: number | null
          break_even_cac_after_offer?: number | null
          break_even_roas_after_offer?: number | null
          client_id: string
          cogs?: number | null
          created_at?: string
          discount_allowance?: number | null
          discount_percent?: number | null
          discounted_price?: number | null
          fulfillment_cost?: number | null
          gift_cost?: number | null
          gross_margin_after_offer_percent?: number | null
          gross_profit_after_offer?: number | null
          id?: string
          model_run_id?: string | null
          offer_name?: string | null
          offer_type?: string | null
          offer_viability?: string | null
          payment_processing_cost?: number | null
          recommendation?: string | null
          refund_allowance?: number | null
          shipping_cost?: number | null
        }
        Update: {
          base_price?: number | null
          break_even_cac_after_offer?: number | null
          break_even_roas_after_offer?: number | null
          client_id?: string
          cogs?: number | null
          created_at?: string
          discount_allowance?: number | null
          discount_percent?: number | null
          discounted_price?: number | null
          fulfillment_cost?: number | null
          gift_cost?: number | null
          gross_margin_after_offer_percent?: number | null
          gross_profit_after_offer?: number | null
          id?: string
          model_run_id?: string | null
          offer_name?: string | null
          offer_type?: string | null
          offer_viability?: string | null
          payment_processing_cost?: number | null
          recommendation?: string | null
          refund_allowance?: number | null
          shipping_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_offer_economics_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_offer_lab: {
        Row: {
          add_to_carts: number
          bonus: string | null
          channel: string | null
          client_id: string
          conversions: number
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_pct: number | null
          guarantee: string | null
          hook: string | null
          id: string
          landing_url: string | null
          learning: string | null
          objective_id: string | null
          offer_name: string
          offer_price: number | null
          offer_type: string
          reference_price: number | null
          refunds: number
          replay_hypothesis: string | null
          revenue: number
          spend: number
          status: string
          tags: string[]
          test_end: string | null
          test_start: string | null
          updated_at: string
          urgency: string | null
          verdict: string | null
          visitors: number
        }
        Insert: {
          add_to_carts?: number
          bonus?: string | null
          channel?: string | null
          client_id: string
          conversions?: number
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_pct?: number | null
          guarantee?: string | null
          hook?: string | null
          id?: string
          landing_url?: string | null
          learning?: string | null
          objective_id?: string | null
          offer_name: string
          offer_price?: number | null
          offer_type?: string
          reference_price?: number | null
          refunds?: number
          replay_hypothesis?: string | null
          revenue?: number
          spend?: number
          status?: string
          tags?: string[]
          test_end?: string | null
          test_start?: string | null
          updated_at?: string
          urgency?: string | null
          verdict?: string | null
          visitors?: number
        }
        Update: {
          add_to_carts?: number
          bonus?: string | null
          channel?: string | null
          client_id?: string
          conversions?: number
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_pct?: number | null
          guarantee?: string | null
          hook?: string | null
          id?: string
          landing_url?: string | null
          learning?: string | null
          objective_id?: string | null
          offer_name?: string
          offer_price?: number | null
          offer_type?: string
          reference_price?: number | null
          refunds?: number
          replay_hypothesis?: string | null
          revenue?: number
          spend?: number
          status?: string
          tags?: string[]
          test_end?: string | null
          test_start?: string | null
          updated_at?: string
          urgency?: string | null
          verdict?: string | null
          visitors?: number
        }
        Relationships: [
          {
            foreignKeyName: "gos_offer_lab_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_offer_lab_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "gos_business_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_opex_allocation_settings: {
        Row: {
          client_id: string
          conservative_bootstrap_mode: boolean
          created_at: string
          id: string
          notes: string | null
          opex_buffer_per_order: number | null
          opex_buffer_percent_of_revenue: number | null
          opex_buffer_type: string
          opex_fixed_monthly: number | null
          updated_at: string
          use_opex_buffer: boolean
        }
        Insert: {
          client_id: string
          conservative_bootstrap_mode?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          opex_buffer_per_order?: number | null
          opex_buffer_percent_of_revenue?: number | null
          opex_buffer_type?: string
          opex_fixed_monthly?: number | null
          updated_at?: string
          use_opex_buffer?: boolean
        }
        Update: {
          client_id?: string
          conservative_bootstrap_mode?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          opex_buffer_per_order?: number | null
          opex_buffer_percent_of_revenue?: number | null
          opex_buffer_type?: string
          opex_fixed_monthly?: number | null
          updated_at?: string
          use_opex_buffer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "gos_opex_allocation_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_order_value_distributions: {
        Row: {
          avg_order_value: number | null
          bucket_size: number | null
          buckets_json: Json | null
          business_type: string | null
          cac_target_risk: string | null
          client_id: string
          created_at: string
          id: string
          long_tail_risk: string | null
          max_order_value: number | null
          median_order_value: number | null
          min_order_value: number | null
          modal_order_value: number | null
          period_end: string | null
          period_start: string | null
          summary: string | null
          top_bucket_max: number | null
          top_bucket_min: number | null
          top_bucket_order_count: number | null
          top_bucket_order_percent: number | null
        }
        Insert: {
          avg_order_value?: number | null
          bucket_size?: number | null
          buckets_json?: Json | null
          business_type?: string | null
          cac_target_risk?: string | null
          client_id: string
          created_at?: string
          id?: string
          long_tail_risk?: string | null
          max_order_value?: number | null
          median_order_value?: number | null
          min_order_value?: number | null
          modal_order_value?: number | null
          period_end?: string | null
          period_start?: string | null
          summary?: string | null
          top_bucket_max?: number | null
          top_bucket_min?: number | null
          top_bucket_order_count?: number | null
          top_bucket_order_percent?: number | null
        }
        Update: {
          avg_order_value?: number | null
          bucket_size?: number | null
          buckets_json?: Json | null
          business_type?: string | null
          cac_target_risk?: string | null
          client_id?: string
          created_at?: string
          id?: string
          long_tail_risk?: string | null
          max_order_value?: number | null
          median_order_value?: number | null
          min_order_value?: number | null
          modal_order_value?: number | null
          period_end?: string | null
          period_start?: string | null
          summary?: string | null
          top_bucket_max?: number | null
          top_bucket_min?: number | null
          top_bucket_order_count?: number | null
          top_bucket_order_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_order_value_distributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_pnl_snapshots: {
        Row: {
          client_id: string
          contribution_margin: number | null
          contribution_margin_percent: number | null
          cost_of_delivery: number | null
          created_at: string
          ebitda: number | null
          gross_margin_percent: number | null
          gross_profit: number | null
          gross_revenue: number | null
          id: string
          interest_expense: number | null
          marketing_efficiency_ratio: number | null
          marketing_expense: number | null
          net_profit: number | null
          net_profit_percent: number | null
          net_revenue: number | null
          notes: string | null
          opex: number | null
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          client_id: string
          contribution_margin?: number | null
          contribution_margin_percent?: number | null
          cost_of_delivery?: number | null
          created_at?: string
          ebitda?: number | null
          gross_margin_percent?: number | null
          gross_profit?: number | null
          gross_revenue?: number | null
          id?: string
          interest_expense?: number | null
          marketing_efficiency_ratio?: number | null
          marketing_expense?: number | null
          net_profit?: number | null
          net_profit_percent?: number | null
          net_revenue?: number | null
          notes?: string | null
          opex?: number | null
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          client_id?: string
          contribution_margin?: number | null
          contribution_margin_percent?: number | null
          cost_of_delivery?: number | null
          created_at?: string
          ebitda?: number | null
          gross_margin_percent?: number | null
          gross_profit?: number | null
          gross_revenue?: number | null
          id?: string
          interest_expense?: number | null
          marketing_efficiency_ratio?: number | null
          marketing_expense?: number | null
          net_profit?: number | null
          net_profit_percent?: number | null
          net_revenue?: number | null
          notes?: string | null
          opex?: number | null
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gos_pnl_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_product_financial_profiles: {
        Row: {
          break_even_cac: number | null
          client_id: string
          contribution_before_cac: number | null
          created_at: string
          discount_allowance_percent: number | null
          duties_tariffs: number | null
          freight_cost: number | null
          id: string
          landed_cost: number | null
          notes: string | null
          payment_processing_percent: number | null
          pick_pack_cost: number | null
          price: number | null
          product_cost: number | null
          product_id: string | null
          product_margin_percent: number | null
          refund_allowance_percent: number | null
          shipping_cost_to_customer: number | null
          sku: string | null
          true_gross_margin_percent: number | null
          updated_at: string
        }
        Insert: {
          break_even_cac?: number | null
          client_id: string
          contribution_before_cac?: number | null
          created_at?: string
          discount_allowance_percent?: number | null
          duties_tariffs?: number | null
          freight_cost?: number | null
          id?: string
          landed_cost?: number | null
          notes?: string | null
          payment_processing_percent?: number | null
          pick_pack_cost?: number | null
          price?: number | null
          product_cost?: number | null
          product_id?: string | null
          product_margin_percent?: number | null
          refund_allowance_percent?: number | null
          shipping_cost_to_customer?: number | null
          sku?: string | null
          true_gross_margin_percent?: number | null
          updated_at?: string
        }
        Update: {
          break_even_cac?: number | null
          client_id?: string
          contribution_before_cac?: number | null
          created_at?: string
          discount_allowance_percent?: number | null
          duties_tariffs?: number | null
          freight_cost?: number | null
          id?: string
          landed_cost?: number | null
          notes?: string | null
          payment_processing_percent?: number | null
          pick_pack_cost?: number | null
          price?: number | null
          product_cost?: number | null
          product_id?: string | null
          product_margin_percent?: number | null
          refund_allowance_percent?: number | null
          shipping_cost_to_customer?: number | null
          sku?: string | null
          true_gross_margin_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_product_financial_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_product_financial_profiles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gos_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_products: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_avoid: boolean
          is_priority: boolean
          notes: string | null
          price: number | null
          product_name: string
          product_role: string | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_avoid?: boolean
          is_priority?: boolean
          notes?: string | null
          price?: number | null
          product_name: string
          product_role?: string | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_avoid?: boolean
          is_priority?: boolean
          notes?: string | null
          price?: number | null
          product_name?: string
          product_role?: string | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_projection_updates: {
        Row: {
          change_type: string
          client_id: string
          created_at: string
          id: string
          metric_name: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
          period_date: string | null
          period_end: string | null
          period_start: string | null
          scope: string
          target_row_id: string
          updated_by: string | null
        }
        Insert: {
          change_type?: string
          client_id: string
          created_at?: string
          id?: string
          metric_name: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          period_date?: string | null
          period_end?: string | null
          period_start?: string | null
          scope: string
          target_row_id: string
          updated_by?: string | null
        }
        Update: {
          change_type?: string
          client_id?: string
          created_at?: string
          id?: string
          metric_name?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          period_date?: string | null
          period_end?: string | null
          period_start?: string | null
          scope?: string
          target_row_id?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      gos_quantitative_baselines: {
        Row: {
          active_ads_count: number | null
          ad_spend_30d: number | null
          aov_30d: number | null
          atc_rate_30d: number | null
          avg_frequency: number | null
          avg_job_value: number | null
          booked_appointments_30d: number | null
          business_type: string
          cac_30d: number | null
          checkout_rate_30d: number | null
          client_id: string
          close_rate: number | null
          cost_per_booked_appointment: number | null
          cost_per_job: number | null
          cpl_30d: number | null
          created_at: string
          cvr_30d: number | null
          id: string
          jobs_closed_30d: number | null
          leads_30d: number | null
          mer_30d: number | null
          missed_call_rate: number | null
          new_creatives_last_30d: number | null
          new_customers_30d: number | null
          orders_30d: number | null
          qualified_leads_30d: number | null
          response_time_minutes: number | null
          returning_customers_30d: number | null
          returning_revenue_30d: number | null
          revenue_30d: number | null
          roas_30d: number | null
          show_rate: number | null
          status: string
          top3_ads_spend_share_percent: number | null
          updated_at: string
        }
        Insert: {
          active_ads_count?: number | null
          ad_spend_30d?: number | null
          aov_30d?: number | null
          atc_rate_30d?: number | null
          avg_frequency?: number | null
          avg_job_value?: number | null
          booked_appointments_30d?: number | null
          business_type?: string
          cac_30d?: number | null
          checkout_rate_30d?: number | null
          client_id: string
          close_rate?: number | null
          cost_per_booked_appointment?: number | null
          cost_per_job?: number | null
          cpl_30d?: number | null
          created_at?: string
          cvr_30d?: number | null
          id?: string
          jobs_closed_30d?: number | null
          leads_30d?: number | null
          mer_30d?: number | null
          missed_call_rate?: number | null
          new_creatives_last_30d?: number | null
          new_customers_30d?: number | null
          orders_30d?: number | null
          qualified_leads_30d?: number | null
          response_time_minutes?: number | null
          returning_customers_30d?: number | null
          returning_revenue_30d?: number | null
          revenue_30d?: number | null
          roas_30d?: number | null
          show_rate?: number | null
          status?: string
          top3_ads_spend_share_percent?: number | null
          updated_at?: string
        }
        Update: {
          active_ads_count?: number | null
          ad_spend_30d?: number | null
          aov_30d?: number | null
          atc_rate_30d?: number | null
          avg_frequency?: number | null
          avg_job_value?: number | null
          booked_appointments_30d?: number | null
          business_type?: string
          cac_30d?: number | null
          checkout_rate_30d?: number | null
          client_id?: string
          close_rate?: number | null
          cost_per_booked_appointment?: number | null
          cost_per_job?: number | null
          cpl_30d?: number | null
          created_at?: string
          cvr_30d?: number | null
          id?: string
          jobs_closed_30d?: number | null
          leads_30d?: number | null
          mer_30d?: number | null
          missed_call_rate?: number | null
          new_creatives_last_30d?: number | null
          new_customers_30d?: number | null
          orders_30d?: number | null
          qualified_leads_30d?: number | null
          response_time_minutes?: number | null
          returning_customers_30d?: number | null
          returning_revenue_30d?: number | null
          revenue_30d?: number | null
          roas_30d?: number | null
          show_rate?: number | null
          status?: string
          top3_ads_spend_share_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_quantitative_baselines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_retention_cohorts: {
        Row: {
          arpu_month: number | null
          client_id: string
          cohort_month: string
          cohort_size: number
          created_at: string
          created_by: string | null
          gross_margin_pct: number | null
          id: string
          ltv_actual: number | null
          ltv_predicted: number | null
          m1_retained: number | null
          m12_retained: number | null
          m2_retained: number | null
          m3_retained: number | null
          m6_retained: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          arpu_month?: number | null
          client_id: string
          cohort_month: string
          cohort_size?: number
          created_at?: string
          created_by?: string | null
          gross_margin_pct?: number | null
          id?: string
          ltv_actual?: number | null
          ltv_predicted?: number | null
          m1_retained?: number | null
          m12_retained?: number | null
          m2_retained?: number | null
          m3_retained?: number | null
          m6_retained?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          arpu_month?: number | null
          client_id?: string
          cohort_month?: string
          cohort_size?: number
          created_at?: string
          created_by?: string | null
          gross_margin_pct?: number | null
          id?: string
          ltv_actual?: number | null
          ltv_predicted?: number | null
          m1_retained?: number | null
          m12_retained?: number | null
          m2_retained?: number | null
          m3_retained?: number | null
          m6_retained?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_retention_cohorts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_retention_snapshots: {
        Row: {
          avg_orders_per_customer: number | null
          client_id: string
          cohort_data: Json | null
          created_at: string
          id: string
          ltv_30d: number | null
          ltv_365d: number | null
          ltv_60d: number | null
          ltv_90d: number | null
          new_customers: number | null
          notes: string | null
          period_end: string | null
          period_label: string | null
          period_start: string | null
          repeat_rate_pct: number | null
          returning_customers: number | null
          updated_at: string
        }
        Insert: {
          avg_orders_per_customer?: number | null
          client_id: string
          cohort_data?: Json | null
          created_at?: string
          id?: string
          ltv_30d?: number | null
          ltv_365d?: number | null
          ltv_60d?: number | null
          ltv_90d?: number | null
          new_customers?: number | null
          notes?: string | null
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          repeat_rate_pct?: number | null
          returning_customers?: number | null
          updated_at?: string
        }
        Update: {
          avg_orders_per_customer?: number | null
          client_id?: string
          cohort_data?: Json | null
          created_at?: string
          id?: string
          ltv_30d?: number | null
          ltv_365d?: number | null
          ltv_60d?: number | null
          ltv_90d?: number | null
          new_customers?: number | null
          notes?: string | null
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          repeat_rate_pct?: number | null
          returning_customers?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_retention_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_services: {
        Row: {
          avg_price: number | null
          client_id: string
          created_at: string
          id: string
          is_avoid: boolean
          is_priority: boolean
          notes: string | null
          service_name: string
          service_role: string | null
          updated_at: string
        }
        Insert: {
          avg_price?: number | null
          client_id: string
          created_at?: string
          id?: string
          is_avoid?: boolean
          is_priority?: boolean
          notes?: string | null
          service_name: string
          service_role?: string | null
          updated_at?: string
        }
        Update: {
          avg_price?: number | null
          client_id?: string
          created_at?: string
          id?: string
          is_avoid?: boolean
          is_priority?: boolean
          notes?: string | null
          service_name?: string
          service_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_sku_demand_plans: {
        Row: {
          available_inventory: number | null
          client_id: string
          created_at: string
          forecasted_gross_profit: number | null
          forecasted_revenue: number | null
          forecasted_units: number | null
          id: string
          inventory_risk: string | null
          marketing_priority: string | null
          notes: string | null
          paid_media_action: string | null
          plan_month: string | null
          product_id: string | null
          product_name: string | null
          projected_inventory_after_plan: number | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          available_inventory?: number | null
          client_id: string
          created_at?: string
          forecasted_gross_profit?: number | null
          forecasted_revenue?: number | null
          forecasted_units?: number | null
          id?: string
          inventory_risk?: string | null
          marketing_priority?: string | null
          notes?: string | null
          paid_media_action?: string | null
          plan_month?: string | null
          product_id?: string | null
          product_name?: string | null
          projected_inventory_after_plan?: number | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          available_inventory?: number | null
          client_id?: string
          created_at?: string
          forecasted_gross_profit?: number | null
          forecasted_revenue?: number | null
          forecasted_units?: number | null
          id?: string
          inventory_risk?: string | null
          marketing_priority?: string | null
          notes?: string | null
          paid_media_action?: string | null
          plan_month?: string | null
          product_id?: string | null
          product_name?: string | null
          projected_inventory_after_plan?: number | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_sku_demand_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_sku_demand_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gos_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_spending_power_snapshots: {
        Row: {
          assumptions: Json | null
          backtest_error_percent: number | null
          cash_available: number | null
          client_id: string
          conditions: Json | null
          created_at: string
          efficiency_risk: string | null
          fallback_reason: string | null
          gross_margin_pct: number | null
          id: string
          max_monthly_ad_spend: number | null
          model_type: string | null
          monthly_burn: number | null
          notes: string | null
          period_label: string | null
          planned_spend: number | null
          projected_cac_base: number | null
          projected_cac_high: number | null
          projected_cac_low: number | null
          projected_mer_base: number | null
          projected_mer_high: number | null
          projected_mer_low: number | null
          r_squared_cac: number | null
          r_squared_mer: number | null
          recommended_model_confidence: number | null
          recommended_monthly_ad_spend: number | null
          recommended_spend_base: number | null
          recommended_spend_high: number | null
          recommended_spend_low: number | null
          regression_intercept_cac: number | null
          regression_intercept_mer: number | null
          regression_slope_cac: number | null
          regression_slope_mer: number | null
          risks: Json | null
          runway_months: number | null
          sample_size: number | null
          spend_risk: string | null
          spending_history: Json | null
          summary: string | null
          target_roas: number | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json | null
          backtest_error_percent?: number | null
          cash_available?: number | null
          client_id: string
          conditions?: Json | null
          created_at?: string
          efficiency_risk?: string | null
          fallback_reason?: string | null
          gross_margin_pct?: number | null
          id?: string
          max_monthly_ad_spend?: number | null
          model_type?: string | null
          monthly_burn?: number | null
          notes?: string | null
          period_label?: string | null
          planned_spend?: number | null
          projected_cac_base?: number | null
          projected_cac_high?: number | null
          projected_cac_low?: number | null
          projected_mer_base?: number | null
          projected_mer_high?: number | null
          projected_mer_low?: number | null
          r_squared_cac?: number | null
          r_squared_mer?: number | null
          recommended_model_confidence?: number | null
          recommended_monthly_ad_spend?: number | null
          recommended_spend_base?: number | null
          recommended_spend_high?: number | null
          recommended_spend_low?: number | null
          regression_intercept_cac?: number | null
          regression_intercept_mer?: number | null
          regression_slope_cac?: number | null
          regression_slope_mer?: number | null
          risks?: Json | null
          runway_months?: number | null
          sample_size?: number | null
          spend_risk?: string | null
          spending_history?: Json | null
          summary?: string | null
          target_roas?: number | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json | null
          backtest_error_percent?: number | null
          cash_available?: number | null
          client_id?: string
          conditions?: Json | null
          created_at?: string
          efficiency_risk?: string | null
          fallback_reason?: string | null
          gross_margin_pct?: number | null
          id?: string
          max_monthly_ad_spend?: number | null
          model_type?: string | null
          monthly_burn?: number | null
          notes?: string | null
          period_label?: string | null
          planned_spend?: number | null
          projected_cac_base?: number | null
          projected_cac_high?: number | null
          projected_cac_low?: number | null
          projected_mer_base?: number | null
          projected_mer_high?: number | null
          projected_mer_low?: number | null
          r_squared_cac?: number | null
          r_squared_mer?: number | null
          recommended_model_confidence?: number | null
          recommended_monthly_ad_spend?: number | null
          recommended_spend_base?: number | null
          recommended_spend_high?: number | null
          recommended_spend_low?: number | null
          regression_intercept_cac?: number | null
          regression_intercept_mer?: number | null
          regression_slope_cac?: number | null
          regression_slope_mer?: number | null
          risks?: Json | null
          runway_months?: number | null
          sample_size?: number | null
          spend_risk?: string | null
          spending_history?: Json | null
          summary?: string | null
          target_roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_spending_power_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_wayfinder_sessions: {
        Row: {
          blockers: string | null
          client_id: string
          created_at: string
          created_by: string | null
          decisions: string | null
          facilitator: string | null
          id: string
          key_learnings: string | null
          loser_concept_ids: string[]
          next_actions: string | null
          next_session_date: string | null
          notes: string | null
          objective_ids: string[]
          participants: string[]
          performance_summary: string | null
          session_date: string
          status: string
          updated_at: string
          week_label: string | null
          winner_concept_ids: string[]
        }
        Insert: {
          blockers?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          facilitator?: string | null
          id?: string
          key_learnings?: string | null
          loser_concept_ids?: string[]
          next_actions?: string | null
          next_session_date?: string | null
          notes?: string | null
          objective_ids?: string[]
          participants?: string[]
          performance_summary?: string | null
          session_date?: string
          status?: string
          updated_at?: string
          week_label?: string | null
          winner_concept_ids?: string[]
        }
        Update: {
          blockers?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          facilitator?: string | null
          id?: string
          key_learnings?: string | null
          loser_concept_ids?: string[]
          next_actions?: string | null
          next_session_date?: string | null
          notes?: string | null
          objective_ids?: string[]
          participants?: string[]
          performance_summary?: string | null
          session_date?: string
          status?: string
          updated_at?: string
          week_label?: string | null
          winner_concept_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "gos_wayfinder_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_weekly_executive_reports: {
        Row: {
          asks_to_client: string | null
          blockers: string | null
          client_id: string
          created_at: string
          created_by: string | null
          executive_summary: string | null
          id: string
          key_challenges: string | null
          key_wins: string | null
          linked_test_ids: string[]
          loser_concept_ids: string[]
          metrics_snapshot: Json
          next_week_priorities: string | null
          notes: string | null
          performance_highlights: string | null
          recipients: string[]
          sent_at: string | null
          sent_by: string | null
          status: string
          title: string | null
          updated_at: string
          wayfinder_decisions: string | null
          week_end: string
          week_label: string | null
          week_start: string
          winner_concept_ids: string[]
        }
        Insert: {
          asks_to_client?: string | null
          blockers?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          executive_summary?: string | null
          id?: string
          key_challenges?: string | null
          key_wins?: string | null
          linked_test_ids?: string[]
          loser_concept_ids?: string[]
          metrics_snapshot?: Json
          next_week_priorities?: string | null
          notes?: string | null
          performance_highlights?: string | null
          recipients?: string[]
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          wayfinder_decisions?: string | null
          week_end: string
          week_label?: string | null
          week_start: string
          winner_concept_ids?: string[]
        }
        Update: {
          asks_to_client?: string | null
          blockers?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          executive_summary?: string | null
          id?: string
          key_challenges?: string | null
          key_wins?: string | null
          linked_test_ids?: string[]
          loser_concept_ids?: string[]
          metrics_snapshot?: Json
          next_week_priorities?: string | null
          notes?: string | null
          performance_highlights?: string | null
          recipients?: string[]
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          wayfinder_decisions?: string | null
          week_end?: string
          week_label?: string | null
          week_start?: string
          winner_concept_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "gos_weekly_executive_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gos_weekly_pnl_targets: {
        Row: {
          actual_ad_spend: number | null
          actual_gross_profit: number | null
          actual_leads: number | null
          actual_orders: number | null
          actual_revenue: number | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          parent_target_id: string | null
          projection_ad_spend: number | null
          projection_cac: number | null
          projection_gross_profit: number | null
          projection_last_updated_at: string | null
          projection_last_updated_by: string | null
          projection_leads: number | null
          projection_mer: number | null
          projection_orders: number | null
          projection_revenue: number | null
          status: string | null
          target_ad_spend: number | null
          target_cac: number | null
          target_gross_profit: number | null
          target_leads: number | null
          target_locked_at: string | null
          target_locked_by: string | null
          target_mer: number | null
          target_orders: number | null
          target_revenue: number | null
          updated_at: string
          variance_pct: number | null
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          actual_ad_spend?: number | null
          actual_gross_profit?: number | null
          actual_leads?: number | null
          actual_orders?: number | null
          actual_revenue?: number | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_target_id?: string | null
          projection_ad_spend?: number | null
          projection_cac?: number | null
          projection_gross_profit?: number | null
          projection_last_updated_at?: string | null
          projection_last_updated_by?: string | null
          projection_leads?: number | null
          projection_mer?: number | null
          projection_orders?: number | null
          projection_revenue?: number | null
          status?: string | null
          target_ad_spend?: number | null
          target_cac?: number | null
          target_gross_profit?: number | null
          target_leads?: number | null
          target_locked_at?: string | null
          target_locked_by?: string | null
          target_mer?: number | null
          target_orders?: number | null
          target_revenue?: number | null
          updated_at?: string
          variance_pct?: number | null
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          actual_ad_spend?: number | null
          actual_gross_profit?: number | null
          actual_leads?: number | null
          actual_orders?: number | null
          actual_revenue?: number | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_target_id?: string | null
          projection_ad_spend?: number | null
          projection_cac?: number | null
          projection_gross_profit?: number | null
          projection_last_updated_at?: string | null
          projection_last_updated_by?: string | null
          projection_leads?: number | null
          projection_mer?: number | null
          projection_orders?: number | null
          projection_revenue?: number | null
          status?: string | null
          target_ad_spend?: number | null
          target_cac?: number | null
          target_gross_profit?: number | null
          target_leads?: number | null
          target_locked_at?: string | null
          target_locked_by?: string | null
          target_mer?: number | null
          target_orders?: number | null
          target_revenue?: number | null
          updated_at?: string
          variance_pct?: number | null
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "gos_weekly_pnl_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gos_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gos_weekly_pnl_targets_parent_target_id_fkey"
            columns: ["parent_target_id"]
            isOneToOne: false
            referencedRelation: "gos_metric_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      model_runs: {
        Row: {
          am_approved: boolean | null
          am_override: boolean | null
          client_id: string | null
          formula_used: Json | null
          generated_at: string | null
          generated_by: string | null
          id: string
          input_json: Json
          model_name: string
          model_version: string
          output_json: Json
          override_reason: string | null
        }
        Insert: {
          am_approved?: boolean | null
          am_override?: boolean | null
          client_id?: string | null
          formula_used?: Json | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          input_json: Json
          model_name: string
          model_version: string
          output_json: Json
          override_reason?: string | null
        }
        Update: {
          am_approved?: boolean | null
          am_override?: boolean | null
          client_id?: string | null
          formula_used?: Json | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          input_json?: Json
          model_name?: string
          model_version?: string
          output_json?: Json
          override_reason?: string | null
        }
        Relationships: []
      }
      model_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          formula_json: Json | null
          id: string
          is_active: boolean | null
          model_name: string
          version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          formula_json?: Json | null
          id?: string
          is_active?: boolean | null
          model_name: string
          version: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          formula_json?: Json | null
          id?: string
          is_active?: boolean | null
          model_name?: string
          version?: string
        }
        Relationships: []
      }
      seasonal_email_sends: {
        Row: {
          client_code: string
          created_at: string
          email_id: string | null
          error: string | null
          id: string
          recipient_email: string
          status: string
          type: string
          year: number
        }
        Insert: {
          client_code: string
          created_at?: string
          email_id?: string | null
          error?: string | null
          id?: string
          recipient_email: string
          status: string
          type: string
          year: number
        }
        Update: {
          client_code?: string
          created_at?: string
          email_id?: string | null
          error?: string | null
          id?: string
          recipient_email?: string
          status?: string
          type?: string
          year?: number
        }
        Relationships: []
      }
      seasonal_slack_sends: {
        Row: {
          channel: string
          client_count: number | null
          created_at: string
          id: string
          type: string
          year: number
        }
        Insert: {
          channel: string
          client_count?: number | null
          created_at?: string
          id?: string
          type: string
          year: number
        }
        Update: {
          channel?: string
          client_count?: number | null
          created_at?: string
          id?: string
          type?: string
          year?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      exec_sql: { Args: { _sql: string }; Returns: undefined }
      exec_sql_json: { Args: { _sql: string }; Returns: Json }
      has_gos_client_role: {
        Args: {
          _client_id: string
          _min_role: Database["public"]["Enums"]["client_member_role"]
        }
        Returns: boolean
      }
      is_global_admin: { Args: never; Returns: boolean }
      is_gos_client_member: { Args: { _client_id: string }; Returns: boolean }
      vault_delete_secret: { Args: { _id: string }; Returns: undefined }
      vault_read_secret: { Args: { _id: string }; Returns: string }
      vault_store_secret: {
        Args: { _name: string; _value: string }
        Returns: string
      }
      vault_update_secret: {
        Args: { _id: string; _value: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "global_admin" | "admin" | "viewer"
      client_member_role: "owner" | "admin" | "analyst" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["global_admin", "admin", "viewer"],
      client_member_role: ["owner", "admin", "analyst", "viewer"],
    },
  },
} as const
