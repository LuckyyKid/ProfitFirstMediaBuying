import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const PROGRESS_KEY = "tdia_max_step_completed";
const STARTED_KEY = "tdia_onboarding_started_at";

export const ONBOARDING_DEADLINE_MS = 72 * 60 * 60 * 1000; // 72h

// Canonical onboarding file-step order. Step 5 was removed from the flow
// (Step4 → Step6). Keep this in sync with the flow shown in ProgressBar.
export const STEP_FLOW: readonly number[] = [1, 2, 3, 4, 6, 7, 8, 9];

const stepRoute = (n: number) => (n <= 1 ? "/" : `/step${n}`);

const flowIndex = (step: number) => STEP_FLOW.indexOf(step);

export function getMaxCompleted(): number {
  const raw = sessionStorage.getItem(PROGRESS_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Normalise legacy values (e.g. removed step 5) down to the nearest known flow step.
  for (let i = STEP_FLOW.length - 1; i >= 0; i--) {
    if (STEP_FLOW[i] <= n) return STEP_FLOW[i];
  }
  return 0;
}

export function markStepCompleted(step: number) {
  const current = getMaxCompleted();
  if (flowIndex(step) > flowIndex(current)) {
    sessionStorage.setItem(PROGRESS_KEY, String(step));
  }
}

export function startOnboardingTimer() {
  if (!sessionStorage.getItem(STARTED_KEY)) {
    sessionStorage.setItem(STARTED_KEY, String(Date.now()));
  }
}

export function getOnboardingStartedAt(): number | null {
  const raw = sessionStorage.getItem(STARTED_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Guard a step page: redirects to the highest allowed step if the user
 * tries to skip ahead. Positions are computed against STEP_FLOW so that
 * removed steps (e.g. legacy step 5) don't create redirect loops.
 */
export function useStepGuard(step: number) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const stepIdx = flowIndex(step);
    if (stepIdx < 0) return; // unknown step — skip guard rather than loop

    const maxIdx = flowIndex(getMaxCompleted());
    const allowedIdx = Math.min(maxIdx + 1, STEP_FLOW.length - 1);

    if (stepIdx <= allowedIdx) return;

    const target = stepRoute(STEP_FLOW[allowedIdx]);
    if (target === location.pathname) return; // already there — never re-navigate
    navigate(target, { replace: true });
  }, [step, navigate, location.pathname]);
}
