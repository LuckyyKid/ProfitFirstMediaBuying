# Architecture MVC Audit

Date: 2026-07-15

## Scope Checked

- Root agent instructions in `AGENTS.md`.
- System rules in `docs/system-design-best-practices.md`.
- Profit modeling guidance in `docs/profit-system-modeling.md`.
- Six-File methodology under `Six-File+Context+Methodology/`.
- GOS model/controller/test structure under `src/gos/*`.
- GOS admin pages under `src/pages/admin/gos/*`.

## Current Conclusion

The core Profit System direction is MVC-aligned:

- Deterministic formulas and domain models live mostly in `src/gos/*`.
- Controller modules exist for the main operating workflows, including spending power, spend frontier, campaign configuration, daily budget planning, buyer workspace, budget gates, media-buying rules, projection audit, retention, data analyst layers, and weekly/daily P&L.
- The same layers have focused Vitest coverage through colocated `*.test.ts` files.
- Recent critical workflows such as Spending Power, Daily Budget Planner, Buyer Workspace, Campaign Configuration, Retention, and budget guards generally follow the model/controller/page split.

## Architecture Debt To Respect

Many legacy GOS admin pages still import Supabase directly from `@/integrations/supabase/client`. That is not automatically a bug, but it is an MVC risk when the page owns business math, persistence mapping, authorization assumptions, or mutation side effects.

Rule for future work: if a touched page contains meaningful Profit System logic or sensitive persistence, extract the model and/or controller first, then wire the page to it.

## MVC Hardening Completed

2026-07-15:

- `BusinessObjectives` now uses `src/gos/businessObjectivesController.ts` for objective reads, creates, updates, deletes, row normalization, and payload mapping.
- `MapNotes` now uses `src/gos/mapNotesController.ts` for filtered note reads, note creation with current Supabase user identity, deletion, row normalization, and payload mapping.
- `WayfinderWednesday` now uses `src/gos/wayfinderWednesdayController.ts` for session/objective/concept reads, session mutations, date/week helpers, row normalization, and payload mapping.
- Focused tests were added for all three controllers so persistence mappings can be verified without calling the cloud backend.

## Enforcement Rules

1. New Profit System behavior starts in `src/gos/*` as a deterministic model or controller.
2. React pages collect inputs, call models/controllers, render outputs, and show user feedback.
3. Supabase reads/writes for multi-step workflows belong in controllers.
4. Budget mutations must continue through Budget Change Gate and Budget Application Guard.
5. Cohort work must use normalized transaction rows, not spreadsheet-only inputs.
6. Missing financial values must stay explicit; do not coerce missing data to zero when zero changes the decision.
7. Python/R stays batch/service-only for statistical work and writes outputs back to Supabase/model runs.
8. Each implementation step must define the expected result and run targeted verification before the next step.

## How To Use This Audit

Before changing a GOS workflow, compare the target files against this audit:

- If the page already uses a controller and model, keep the change in that pattern.
- If the page uses Supabase directly and the task is business-critical, plan a small controller extraction as part of the unit.
- If the task is UI-only, do not refactor persistence just for cleanup.
