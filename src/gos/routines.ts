// src/gos/routines.ts
//
// Design system rule #10 (task 4) — routine indexing for the "ÉTAPE X/N"
// banner. When a page belongs to a known routine, the banner shows the
// step number and offers to open the routine in Mode Guidé, regardless of
// whether the user arrived via the guided flow, the sidebar library, or ⌘K.
//
// Keep this catalog aligned with the RailStepper definitions embedded in
// each Mode Guidé page (e.g. Walkdown.tsx).

export type RoutineKey = "routine-du-jour";

export type RoutineStep = {
  /** pageLibrary key for the page rendering this step. */
  pageKey: string;
  /** Short label displayed inside the banner (mirrors the RailStepper hint). */
  label: string;
};

export type RoutineDef = {
  key: RoutineKey;
  label: string;
  /** Where clicking "Ouvrir en Mode Guidé" lands — the first non-locked step. */
  entryPageKey: string;
  steps: RoutineStep[];
};

export const ROUTINES: RoutineDef[] = [
  {
    key: "routine-du-jour",
    label: "Routine du jour",
    entryPageKey: "walkdown",
    steps: [
      { pageKey: "daily-digest",         label: "Digest 7h" },
      { pageKey: "walkdown",             label: "Walkdown métriques" },
      { pageKey: "buyer-workspace",      label: "Buyer Workspace" },
      { pageKey: "concept-log",          label: "Créa & Offres" },
      { pageKey: "daily-budget-planner", label: "Budget & Décisions" },
      { pageKey: "map-notes",            label: "Debrief 18h" },
    ],
  },
];

export type RoutineMatch = {
  routine: RoutineDef;
  stepIndex: number;   // 1-based
  total: number;
  step: RoutineStep;
};

export function findRoutineForPage(pageKey: string): RoutineMatch | null {
  for (const routine of ROUTINES) {
    const idx = routine.steps.findIndex((s) => s.pageKey === pageKey);
    if (idx >= 0) {
      return {
        routine,
        stepIndex: idx + 1,
        total: routine.steps.length,
        step: routine.steps[idx],
      };
    }
  }
  return null;
}
