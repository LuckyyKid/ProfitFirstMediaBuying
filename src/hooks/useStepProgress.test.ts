import { beforeEach, describe, expect, it } from "vitest";
import {
  STEP_FLOW,
  getMaxCompleted,
  markStepCompleted,
} from "./useStepProgress";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
}

const PROGRESS_KEY = "tdia_max_step_completed";

beforeEach(() => {
  (globalThis as any).sessionStorage = new MemoryStorage();
});

describe("STEP_FLOW", () => {
  it("skips the removed step 5", () => {
    expect(STEP_FLOW).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
    expect(STEP_FLOW.includes(5)).toBe(false);
  });
});

describe("getMaxCompleted", () => {
  it("returns 0 when nothing stored", () => {
    expect(getMaxCompleted()).toBe(0);
  });

  it("returns the raw value when it matches a flow step", () => {
    sessionStorage.setItem(PROGRESS_KEY, "4");
    expect(getMaxCompleted()).toBe(4);
  });

  it("normalises legacy step 5 down to the previous flow step (4)", () => {
    // Prior to the fix, this returned 5 and the guard treated (5+1)=6 as the
    // next-allowed step. Step 6 then guarded to /step5 which redirected to
    // /step6 → history.replaceState() ran in a tight loop.
    sessionStorage.setItem(PROGRESS_KEY, "5");
    expect(getMaxCompleted()).toBe(4);
  });

  it("normalises unknown values above the flow down to the highest flow step", () => {
    sessionStorage.setItem(PROGRESS_KEY, "42");
    expect(getMaxCompleted()).toBe(9);
  });
});

describe("markStepCompleted", () => {
  it("advances the stored value when the new step comes later in the flow", () => {
    markStepCompleted(4);
    expect(getMaxCompleted()).toBe(4);
    markStepCompleted(6);
    expect(getMaxCompleted()).toBe(6);
  });

  it("never regresses to an earlier flow step", () => {
    markStepCompleted(7);
    markStepCompleted(3);
    expect(getMaxCompleted()).toBe(7);
  });

  it("ignores steps outside the canonical flow", () => {
    markStepCompleted(4);
    markStepCompleted(5); // removed step — should not advance
    expect(getMaxCompleted()).toBe(4);
  });
});

// The same computation the runtime hook performs. Returning `null` means the
// user is allowed to stay on `step`; a string means the hook would call
// navigate(target, { replace: true }) — which is what mints history entries.
function computeGuardTarget(step: number, currentPath: string): string | null {
  const stepIdx = STEP_FLOW.indexOf(step);
  if (stepIdx < 0) return null;
  const maxIdx = STEP_FLOW.indexOf(getMaxCompleted());
  const allowedIdx = Math.min(maxIdx + 1, STEP_FLOW.length - 1);
  if (stepIdx <= allowedIdx) return null;
  const targetStep = STEP_FLOW[allowedIdx];
  const target = targetStep <= 1 ? "/" : `/step${targetStep}`;
  if (target === currentPath) return null;
  return target;
}

// Regression: with maxCompleted=4 (Founder Scan just done), Step6 must be
// accessible without any guard redirect — otherwise Step6 → /step5 →
// <Navigate to="/step6" replace /> creates an infinite replaceState loop.
describe("Step6 access after Step4 completion (payment loop regression)", () => {
  it("does not redirect the user away from /step6", () => {
    markStepCompleted(4);
    expect(computeGuardTarget(6, "/step6")).toBeNull();
  });

  it("does not redirect even if session storage still holds the removed step 5", () => {
    sessionStorage.setItem(PROGRESS_KEY, "5");
    expect(computeGuardTarget(6, "/step6")).toBeNull();
  });

  it("never re-navigates to the current path (self-redirect loop protection)", () => {
    // Simulate a stale sessionStorage that would otherwise want to send us
    // back to the same URL we're already on.
    sessionStorage.setItem(PROGRESS_KEY, "0");
    expect(computeGuardTarget(1, "/")).toBeNull();
  });
});

describe("Full onboarding progression does not stall or loop", () => {
  it("walks Step2 → Step3 → Step4 → Step6 → Step7 → Step8 → Step9 cleanly", () => {
    // Start of onboarding: nothing completed, user on landing.
    expect(computeGuardTarget(2, "/step2")).toBe("/"); // must complete step 1 first
    markStepCompleted(1);
    expect(computeGuardTarget(2, "/step2")).toBeNull();

    markStepCompleted(2);
    expect(computeGuardTarget(3, "/step3")).toBeNull();

    markStepCompleted(3);
    expect(computeGuardTarget(4, "/step4")).toBeNull();

    markStepCompleted(4);
    // The bug that motivated the fix — Step6 must be reachable directly.
    expect(computeGuardTarget(6, "/step6")).toBeNull();
    // Skipping ahead to Step7/Step8/Step9 must NOT be allowed yet.
    expect(computeGuardTarget(7, "/step7")).toBe("/step6");
    expect(computeGuardTarget(8, "/step8")).toBe("/step6");

    markStepCompleted(6);
    expect(computeGuardTarget(7, "/step7")).toBeNull();
    expect(computeGuardTarget(8, "/step8")).toBe("/step7");

    markStepCompleted(7);
    expect(computeGuardTarget(8, "/step8")).toBeNull();

    markStepCompleted(8);
    expect(computeGuardTarget(9, "/step9")).toBeNull();
  });

  it("guard target is stable when re-evaluated at the redirect target (no ping-pong)", () => {
    // If Step7 kicks us to Step6, remounting Step6 must NOT kick us anywhere.
    markStepCompleted(3);
    const target = computeGuardTarget(7, "/step7");
    expect(target).toBe("/step4");
    // Re-run the guard as if we've now landed at /step4:
    expect(computeGuardTarget(4, "/step4")).toBeNull();
  });
});
