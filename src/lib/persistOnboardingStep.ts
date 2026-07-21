import { supabase } from "@/integrations/supabase/client";

type StepFlag =
  | "welcome_completed_at"
  | "platforms_completed_at"
  | "business_deep_dive_completed_at"
  | "payment_completed_at"
  | "contract_completed_at"
  | "kickoff_completed_at";

const STEP_CONFIG: Record<
  StepFlag,
  {
    currentStep: number;
    eventType: string;
    extraUpdates?: Record<string, unknown>;
  }
> = {
  welcome_completed_at: {
    currentStep: 2,
    eventType: "welcome_completed",
    extraUpdates: { video_watched: true },
  },
  platforms_completed_at: {
    currentStep: 3,
    eventType: "platforms_completed",
    extraUpdates: { video_watched: true },
  },
  business_deep_dive_completed_at: {
    currentStep: 6,
    eventType: "business_deep_dive_completed",
    extraUpdates: { business_deep_dive_submitted: true },
  },
  payment_completed_at: {
    currentStep: 7,
    eventType: "manual_step_completion",
    extraUpdates: { paid: true },
  },
  contract_completed_at: {
    currentStep: 8,
    eventType: "contract_signed",
    extraUpdates: { contract_signed: true },
  },
  kickoff_completed_at: {
    currentStep: 9,
    eventType: "kickoff_completed",
    extraUpdates: { kickoff_scheduled: true },
  },
};

interface PersistStepOptions {
  at?: string;
  currentStep?: number;
  eventType?: string;
  source?: string;
  details?: Record<string, unknown>;
  updates?: Record<string, unknown>;
}

export async function persistOnboardingStepCompletion(
  clientCode: string | null | undefined,
  flag: StepFlag,
  options: PersistStepOptions = {},
) {
  if (!clientCode) return;

  const config = STEP_CONFIG[flag];
  const now = options.at ?? new Date().toISOString();
  const updates: Record<string, unknown> = {
    [flag]: now,
    last_activity_at: now,
    updated_at: now,
    current_step: options.currentStep ?? config.currentStep,
    ...(config.extraUpdates ?? {}),
    ...(options.updates ?? {}),
  };

  if (flag === "kickoff_completed_at" && !("kickoff_scheduled_at" in updates)) {
    updates.kickoff_scheduled_at = now;
  }

  const { error: updateError } = await supabase
    .from("client_progress")
    .update(updates)
    .eq("client_code", clientCode);

  if (updateError) throw updateError;

  const { error: logError } = await supabase.functions.invoke("log-activity", {
    body: {
      client_code: clientCode,
      event_type: options.eventType ?? config.eventType,
      status: "ok",
      details: {
        flag,
        source: options.source ?? "client_onboarding",
        ...(options.details ?? {}),
      },
    },
  });

  if (logError) throw logError;
}