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

// Regression: with maxCompleted=4 (Founder Scan just done), Step6 must be
// accessible without any guard redirect — otherwise Step6 → /step5 →
// <Navigate to="/step6" replace /> creates an infinite replaceState loop.
describe("Step6 access after Step4 completion", () => {
  it("treats step 6 as the next allowed step", () => {
    markStepCompleted(4);
    const max = getMaxCompleted();
    const maxIdx = STEP_FLOW.indexOf(max);
    const allowed = STEP_FLOW[Math.min(maxIdx + 1, STEP_FLOW.length - 1)];
    expect(allowed).toBe(6);
    // Step 6 is at index 4 which is <= allowedIdx (4) → no redirect.
    expect(STEP_FLOW.indexOf(6)).toBeLessThanOrEqual(maxIdx + 1);
  });
});
