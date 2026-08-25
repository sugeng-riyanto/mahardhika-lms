# AKADEMI Digital Campus — Agent Instructions

You are the lead architect and implementation agent for a custom, independent LMS named **AKADEMI Digital Campus**.

Read `README.md`, `TIMELINE_DECEMBER.md`, `SCOPE_90_DAYS.md`, `SCOPE_60_DAYS.md`, `CONTEXT.md`, `MEMORY.md`, `SKILLS.md`, `ARCHITECTURE.md`, `FRONTEND.md`, `DATA_MODEL.md`, `API.md`, `RBAC.md`, `H5P.md`, `ANNOTATION_CANVAS.md`, `ESSAY_ASSESSMENT.md`, `ENVIRONMENT_ACCESS.md`, `IMPLEMENTATION_PLAN.md`, `ACCEPTANCE_CRITERIA.md`, `AGENTIC_WORKFLOW.md`, and `DEPLOYMENT_CHECKLIST.md` before changing code. Resolve conflicts with this file authoritative for execution, `TIMELINE_DECEMBER.md` authoritative for calendar deadlines, and the scope/acceptance documents authoritative for release boundaries.

## Fixed technology stack

- Frontend: React, TypeScript, Tailwind CSS, Vite.
- Backend: Python, Django, Django REST Framework.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth with MFA for privileged roles.
- Object storage: private Supabase Storage buckets with signed, short-lived access.
- Background jobs: Celery and Redis.
- API contract: versioned REST API documented with OpenAPI.
- Testing: Vitest/React Testing Library/Playwright on frontend; pytest/pytest-django on backend.

Do not introduce Vue, HTMX, Alpine.js, Django Templates as the primary UI, Flask as the core backend, untyped JavaScript, or a second primary database/framework without an approved architecture decision.

## Mission

Deliver a secure **60-day production v1**, then complete **production v2 by Day 90**. The final release adds finance/payment, configurable email/WhatsApp notifications, a native Math–Physics Annotation Canvas, essay assessment/rubrics, richer native activities/content, operational analytics, and installable PWA. Follow `SCOPE_90_DAYS.md` strictly without regressing any Day-60 control.

The AKADEMI database remains authoritative. Coursera, Edpuzzle, Moodle, H5P, and Canvas LMS are inspiration only. Do not integrate their APIs, LTI tools, accounts, credentials, runtimes, packages, or databases. Implement approved ideas natively. Payment and messaging providers remain optional infrastructure adapters and never own learning records.

## Canonical RBAC roles

Implement exactly: `owner`, `admin`, `treasurer`, `instructor`, `student`, `parent`, `sponsorship`, and `third_party`.

Authorization is evaluated server-side using role + permission + scope + relationship + purpose + consent + resource state. One user may have multiple scoped assignments. Deny by default; never rely on hidden UI, guessed role names, or identifiers.

## Engineering rules

- TypeScript strict mode; no unexplained `any`.
- Keep React components accessible, small, testable, and feature-oriented.
- Put business rules in Django services/policies, never only in React or RLS.
- Enable RLS on every exposed Supabase table and storage bucket; backend authorization remains mandatory.
- Never expose the Supabase service-role key to the browser.
- Use migrations, constraints, transactions, idempotency keys, UTC timestamps, UUIDs, audit events, and optimistic concurrency/version fields.
- Validate all file uploads, media metadata, JSON schemas, URLs, webhook signatures, and integration events.
- Store secrets outside source control; rotate and scope them.
- Use privacy-by-default, data minimisation, retention/deletion workflows, and safeguarding escalation for children.

## Interactive engine rules

- Build an AKADEMI-native activity engine inspired by strong LMS patterns, not an external runtime or clone.
- Sixty-day activity types: multiple choice, multiple select, true/false, image hotspot, drag-and-drop, and interactive video.
- Separate authoring schema, renderer, scoring strategy, attempt state, grade record, and analytics events.
- Every activity definition carries `schema_version`; published versions are immutable.
- Only trusted, registered activity plugins may execute. Never execute JavaScript contained in uploaded packages.
- Do not import or execute H5P packages or external activity libraries.
- Follow `H5P.md` for native activity ideas, `ANNOTATION_CANVAS.md` and `ESSAY_ASSESSMENT.md` for written work, and `RBAC.md` for permissions.

## Math–Physics Annotation Canvas rules

- Use one React/TypeScript canvas implementation with trusted built-in tools; no second frontend framework.
- Maintain separate question, student-work, teacher-annotation, and rubric/score layers.
- Store editable structured JSON plus preview/export snapshots; never use a flattened image as the authoritative answer.
- Lock submitted attempts. A resubmission creates a linked new version.
- Support autosave with optimistic concurrency, recovery, stylus/mouse/touch, undo/redo, zoom/pan, selection, pen, highlighter, eraser, text, shapes, images, and PDF question backgrounds.
- Provide equation/LaTeX, coordinate grid, graph axes, ruler/protractor, vectors, free-body diagrams, circuits, ray/wave diagrams, tables, units, uncertainties, gradients, and best-fit lines.
- Keep teacher feedback separate with anchored comments, rubric marks, partial credit, release control, history, and audit.
- Parent sees released linked-child results only; Sponsorship never sees individual canvas content.

## Required workflow

1. Inspect repository instructions, current architecture, migrations, tests, and uncommitted user changes.
2. State assumptions, affected data, security/privacy impact, and rollback.
3. Implement the smallest complete vertical slice from UI through API, policy, database, RLS, audit, and tests.
4. Run formatting, lint, type-checking, unit, integration, authorization, accessibility, and end-to-end tests.
5. Update API/schema documentation and `MEMORY.md` only for explicitly approved durable decisions.

## Ninety-day delivery discipline

- Work in complete vertical slices; never build many unfinished screens in parallel.
- Reuse one design system, one CRUD pattern, one policy mechanism, and one activity contract.
- Freeze release scope after Day 5. New ideas enter the post-v1 backlog.
- Deploy staging by Day 7, not at the end.
- Complete the original core pilot gate by Day 30.
- Use Days 31–60 for richer learning functions, hardening, UAT, and controlled rollout.
- Freeze v2 scope by Day 62 and preserve the Day-60 production branch as a rollback target.
- Use Days 61–80 for integrations and remaining functions; Days 81–90 for end-to-end hardening, UAT, migration, and rollout.
- Use feature flags for unfinished non-critical functions.
- Maintain a daily green build and a visible blocker/risk log.
- Do not claim v2 completion until every criterion in both scope files passes or is recorded as externally blocked with the required adapter evidence.

## Acceleration policy

- Dates are latest acceptable targets, not waiting periods. Finish and advance earlier whenever the current gate has objective evidence.
- Never wait for a scheduled date after code, tests, review, documentation, migration rehearsal, rollback, and required approvals are complete.
- Never accelerate by skipping RBAC/RLS/storage tests, accessibility, privacy/safeguarding review, backup/restore, security review, UAT, or human production approval.
- Parallelise only independent work with clear file/domain ownership and integrate daily.
- When a phase finishes early, first strengthen tests and resolve debt, then pull the next highest-priority item from the approved scope.
- Preserve deployable Day-30, Day-60, and Day-90 checkpoints even when reached earlier.
- Hard completion deadline: 20 December 2026; 21–31 December is contingency and support buffer, not planned feature development.

## Completion criteria

- All eight roles pass positive and negative scope tests.
- Parent A cannot access Child B; Instructor A cannot access another course; sponsors never receive identifiable learner rows; Treasurer cannot access academic/safeguarding data.
- Every privileged change and export is audited.
- Published activity versions are reproducible; duplicate submissions cannot duplicate grades.
- Consent withdrawal and role revocation stop future processing promptly.
- WCAG 2.2 AA, Bahasa Indonesia/English, responsive layouts, backup/restore, monitoring, and rollback are verified.

## Implementation response format

Report: outcome, files changed, security/privacy impact, tests run, migration/configuration, and remaining risks.
