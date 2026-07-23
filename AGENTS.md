## Project Context

Before making architectural, backend, GOS, or Profit System changes, read:

1. `docs/system-design-best-practices.md` - system design, MVC, storage, security, scaling, transcript-derived rules, and ecommerce cohort invariants.
2. `docs/profit-system-modeling.md` - deterministic TypeScript models vs Python/R statistical layer.
3. `Six-File+Context+Methodology/README.md` - spec-driven AI workflow and context-file methodology.

## Design System — Premium Dark

For any UI work (new page, redesign, tweak, component), the visual language and UX rules are non-negotiable and defined in `.lovable/design-system.md`. Read it before touching styles. The doc covers:

- Ambient palette, typography (Inter / JetBrains Mono / Instrument Serif) and CSS tokens.
- Component recipes (cards, hero, buttons, badges, KPI columns, tables, timelines, progress, "lecture du système" insets, blocking alerts).
- SOP-guided UX rules — 10 mandatory rules including one-and-only-one hero next-action, numbered steps with exit criteria, locked future steps, hybrid sidebar + ⌘K palette pattern.
- Anti-slop interdicts (no emoji except 🔒, no glassmorphism, no opaque grey borders, no bold ≥ 700, no pure white body text).

Reference screens live under `docs/design-references/` (screens 2a, 2b, 3a, 3b). Reproduce those, don't improvise.

## Admin CRM Reference

For any work inside `src/pages/admin/crm/*` (and `src/crm/*` when it backs the admin CRM), use `twenty-main/twenty-main/` as the canonical CRM reference:

- `twenty-main/twenty-main/packages/twenty-front/` - React CRM front-end: page structure, module folder layout (`src/modules/[feature]/{components,graphql,hooks,states,types,utils,constants}`), Jotai atoms, Apollo/GraphQL access patterns.
- `twenty-main/twenty-main/packages/twenty-ui/` - shared UI primitives (buttons, inputs, cards, modals, layouts) - prefer reusing/mirroring these over reinventing components.
- `twenty-main/twenty-main/packages/twenty-shared/` - cross-package types, constants, utils reusable in the admin CRM.
- `twenty-main/twenty-main/packages/twenty-claude-skills/` and `twenty-main/twenty-main/CLAUDE.md` - agent guidance specific to the Twenty codebase; consult before proposing a divergent pattern.

Rule: when a new admin CRM page/component is needed, first look for the equivalent in `twenty-front` / `twenty-ui`. Deviate only when the local domain (GOS, Profit System) requires it, and document the deviation.

## Code Standards Sources

For code norms and workflow discipline, combine:

1. `Six-File+Context+Methodology/README.md` - spec-driven workflow, six context files, unit/spec pattern.
2. `skills-main/skills-main/skills/engineering/` - reusable engineering skills. Consult before the matching activity:
   - `implement/` - implementing a scoped unit.
   - `code-review/` - reviewing a diff or PR.
   - `codebase-design/` - shaping module boundaries and folder layout.
   - `domain-modeling/` - designing types/models for GOS or Profit System.
   - `tdd/` - adding tests around changed behavior.
   - `diagnosing-bugs/` - investigating a regression before patching.
   - `improve-codebase-architecture/` - larger structural refactors.

## Working Rules

- Keep GOS / Profit System logic MVC-aligned.
- Before starting an implementation plan, do an architecture check: identify the model, controller, view, storage owner, and verification path.
- Work step by step. For each step, define the expected result, implement only that scope, then verify the observed result before moving to the next step.
- Put formulas and domain models in `src/gos/*`.
- Keep React pages focused on input collection, orchestration, rendering, and user feedback.
- Use controllers for Supabase access when a workflow would otherwise leak persistence details into a page.
- Store durable architecture rules in `docs/system-design-best-practices.md`; store current-state architecture findings in `docs/architecture-mvc-audit.md`.
- Do not touch onboarding unless the task explicitly requires it or a small change is necessary to preserve MVC boundaries.
- For cohorts, use normalized transaction data from integrations or account-manager entry; do not require spreadsheets.
- Validate changed model behavior with tests and run a targeted lint/build before closing work.
