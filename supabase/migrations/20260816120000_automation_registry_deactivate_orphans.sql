-- ─────────────────────────────────────────────────────────────────────────────
-- AUTOMATION REGISTRY — deactivate workflows that are event-driven or not yet
-- implemented as a cron.
-- ─────────────────────────────────────────────────────────────────────────────
-- The seed in 20260814130000_automation_monitoring.sql declared 12 workflows,
-- but only 3 have an actual cron edge function that has been instrumented
-- with pingAutomation() so far:
--
--   • ad_anomaly_check         → supabase/functions/check-ad-anomalies
--   • follow_up_stuck_clients  → supabase/functions/follow-up-stuck-clients
--   • internal_notifications   → supabase/functions/gos-daily-digest
--
-- The remaining 9 are either webhook/event-triggered (no cadence to guard) or
-- have no cron implementation yet. Keeping them active spams the watchdog
-- with false "cadence missed" alerts. Deactivate them until they either get
-- a real cron with pingAutomation() OR get re-modeled as event workflows.
--
-- To re-activate a workflow after wiring its ping:
--   UPDATE public.automation_registry SET active = TRUE WHERE workflow_id = 'X';
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.automation_registry
   SET active = FALSE,
       updated_at = NOW()
 WHERE workflow_id IN (
   'lead_routing',
   'closed_won',
   'client_onboarding',
   'task_creation',
   'deadline_reminders',
   'creative_approval',
   'client_health_check',
   'payment_invoice',
   'reporting_weekly'
 );
