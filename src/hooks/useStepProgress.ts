import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PROGRESS_KEY = "tdia_max_step_completed";
const STARTED_KEY = "tdia_onboarding_started_at";

export const ONBOARDING_DEADLINE_MS = 72 * 60 * 60 * 1000; // 72h

const stepRoute = (n: number) => (n <= 1 ? "/" : `/step${n}`);

export function getMaxCompleted(): number {
  const raw = sessionStorage.getItem(PROGRESS_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function markStepCompleted(step: number) {
  const current = getMaxCompleted();
  if (step > current) {
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
 * tries to skip ahead. A user can access step N if they have completed
 * step N-1 (or it's step 1).
 */
export function useStepGuard(step: number) {
  const navigate = useNavigate();
  useEffect(() => {
    const maxCompleted = getMaxCompleted();
    const allowed = maxCompleted + 1; // next step they can access
    if (step > allowed) {
      navigate(stepRoute(allowed), { replace: true });
    }
  }, [step, navigate]);
}
