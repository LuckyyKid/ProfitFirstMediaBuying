import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the last supabase call so each test can assert against it.
const updateCalls: Array<{ table: string; values: Record<string, unknown>; filter: [string, string] }> = [];
const invokeCalls: Array<{ fn: string; body: unknown }> = [];

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => ({
    update: (values: Record<string, unknown>) => ({
      eq: async (col: string, val: string) => {
        updateCalls.push({ table, values, filter: [col, val] });
        return { error: null };
      },
    }),
  });
  const functions = {
    invoke: async (fn: string, opts: { body: unknown }) => {
      invokeCalls.push({ fn, body: opts.body });
      return { error: null };
    },
  };
  return { supabase: { from, functions } };
});

import { persistOnboardingStepCompletion } from "./persistOnboardingStep";

beforeEach(() => {
  updateCalls.length = 0;
  invokeCalls.length = 0;
});

describe("persistOnboardingStepCompletion", () => {
  it("is a no-op when no clientCode is provided", async () => {
    await persistOnboardingStepCompletion(null, "contract_completed_at");
    await persistOnboardingStepCompletion(undefined, "kickoff_completed_at");
    await persistOnboardingStepCompletion("", "contract_completed_at");
    expect(updateCalls).toHaveLength(0);
    expect(invokeCalls).toHaveLength(0);
  });

  it("writes contract_completed_at with contract_signed=true and current_step=8", async () => {
    await persistOnboardingStepCompletion("CLI-TEST", "contract_completed_at", {
      at: "2026-01-01T00:00:00.000Z",
      source: "unit-test",
    });
    expect(updateCalls).toHaveLength(1);
    const call = updateCalls[0];
    expect(call.table).toBe("client_progress");
    expect(call.filter).toEqual(["client_code", "CLI-TEST"]);
    expect(call.values).toMatchObject({
      contract_completed_at: "2026-01-01T00:00:00.000Z",
      contract_signed: true,
      current_step: 8,
      last_activity_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0].fn).toBe("log-activity");
    expect((invokeCalls[0].body as any).event_type).toBe("contract_signed");
    expect((invokeCalls[0].body as any).details.source).toBe("unit-test");
  });

  it("writes kickoff_completed_at with kickoff_scheduled=true and derives kickoff_scheduled_at", async () => {
    await persistOnboardingStepCompletion("CLI-BOOK", "kickoff_completed_at", {
      at: "2026-02-02T12:00:00.000Z",
    });
    const call = updateCalls[0];
    expect(call.values).toMatchObject({
      kickoff_completed_at: "2026-02-02T12:00:00.000Z",
      kickoff_scheduled: true,
      kickoff_scheduled_at: "2026-02-02T12:00:00.000Z",
      current_step: 9,
    });
    expect(invokeCalls[0].fn).toBe("log-activity");
    expect((invokeCalls[0].body as any).event_type).toBe("kickoff_completed");
  });

  it("lets caller override kickoff_scheduled_at when they already booked a slot", async () => {
    await persistOnboardingStepCompletion("CLI-BOOK", "kickoff_completed_at", {
      at: "2026-02-02T12:00:00.000Z",
      updates: { kickoff_scheduled_at: "2026-03-15T14:00:00.000Z" },
    });
    expect(updateCalls[0].values.kickoff_scheduled_at).toBe("2026-03-15T14:00:00.000Z");
    expect(updateCalls[0].values.kickoff_completed_at).toBe("2026-02-02T12:00:00.000Z");
  });

  it("payment step updates paid=true and current_step=7", async () => {
    await persistOnboardingStepCompletion("CLI-PAY", "payment_completed_at");
    expect(updateCalls[0].values).toMatchObject({
      paid: true,
      current_step: 7,
    });
    expect(invokeCalls[0].fn).toBe("log-activity");
  });
});
