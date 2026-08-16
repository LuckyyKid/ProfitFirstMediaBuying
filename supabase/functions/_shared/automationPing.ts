// Fire-and-forget ping to the automation-watchdog dead-man's-switch endpoint.
//
// Usage at the end of a cron edge function:
//   await pingAutomation({ workflow_id: "ad_anomaly_check", status: "success", items_count: 42 });
//
// - Never throws. A ping failure must not break the cron itself.
// - Silent no-op if AUTOMATION_PING_TOKEN or SUPABASE_URL is missing (avoids
//   dev-time noise in functions that run outside prod).
// - See supabase/functions/automation-ping/index.ts for the endpoint contract.

export interface AutomationPingArgs {
  workflow_id: string;
  status: "success" | "failure";
  error_message?: string | null;
  items_count?: number | null;
  run_url?: string | null;
}

export async function pingAutomation(args: AutomationPingArgs): Promise<void> {
  const base = Deno.env.get("SUPABASE_URL");
  const token = Deno.env.get("AUTOMATION_PING_TOKEN");
  if (!base || !token) return;

  try {
    await fetch(`${base}/functions/v1/automation-ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Automation-Token": token,
      },
      body: JSON.stringify({
        workflow_id: args.workflow_id,
        status: args.status,
        error_message: args.error_message ?? null,
        items_count: args.items_count ?? null,
        run_url: args.run_url ?? null,
      }),
    });
  } catch {
    // Swallow — the watchdog will catch a persistent absence of pings anyway.
  }
}
