# AKADEMI Digital Campus — Implementation Skills

## 1. Repository discovery

Map React features, Django apps, API routes, Supabase schemas/RLS/storage policies, workers, integrations, tests, deployment, data ownership, and privacy flows before editing.

## 2. React and TypeScript frontend

- Use feature-based modules, strict TypeScript, typed API clients, React Router, and server-state tooling chosen by ADR.
- Build reusable Tailwind design tokens and accessible primitives.
- Never trust client-side role checks; use them only to improve UX.
- Test loading, empty, success, validation, forbidden, conflict, offline, and retry states.
- Use React Testing Library for behaviour and Playwright for critical journeys.

## 3. Django API engineering

- Organise by bounded Django apps and services; keep views thin.
- Use serializers for input/output validation and policy classes for authorization.
- Apply transactions, constraints, idempotency, pagination, filtering allowlists, rate limits, and structured audit events.
- Generate and validate OpenAPI; prohibit undocumented production endpoints.

## 4. Supabase data security

- Use migrations for tables, functions, views, indexes, grants, and RLS.
- Enable RLS on every exposed table and storage object; test as anon, authenticated, each role, and service worker.
- Keep restricted tables in non-exposed schemas when direct browser access is unnecessary.
- Use private buckets, safe object paths, signed URLs, file validation, quotas, and lifecycle deletion.

## 5. RBAC and relationship authorization

For every UI action, endpoint, job, query, report, export, and webhook define role, permission, scope, relationship, purpose, consent, state, and audit level. Test cross-user, cross-child, cross-course, cross-programme, expired grant, revoked role, and identifier substitution.

## 6. Interactive activity engine

- Define JSON Schema per activity type and a central TypeScript renderer registry.
- Pair each frontend renderer with a backend validator/scoring strategy.
- Implement draft, review, approve, publish, attempt, submit, grade, regrade, archive, and version workflows.
- Use immutable activity versions and snapshot the version on every attempt.
- Validate media, answer logic, scoring ranges, attempt state transitions, and duplicate submissions.
- Never execute uploaded code. See `H5P.md`.
- During the 60-day release, implement only the six activity types named in `SCOPE_60_DAYS.md`.

## 7. Privacy, child safety, and accessibility

Classify fields, document purpose/lawful basis, minimise data, evaluate age/consent, define retention/deletion, and update privacy/safeguarding assessments. Test keyboard, screen reader, focus, captions, alternatives, contrast, reflow, and Bahasa Indonesia/English.

## 8. Annotation canvas and essay assessment

- Define separate schemas for question background, student objects/strokes, teacher annotations, anchored comments, rubric decisions, and exports.
- Implement autosave, optimistic concurrency, attempt locking, version/resubmission, undo/redo, zoom/pan, stylus/touch/mouse, recovery, and audit.
- Build accessible alternatives for drawing-dependent questions and keyboard paths for essential tools.
- Test LaTeX, graphs, vectors, free-body diagrams, circuits, rays, waves, tables, units, uncertainties, gradients, and best-fit lines.
- Follow `ANNOTATION_CANVAS.md` and `ESSAY_ASSESSMENT.md`.

## 9. Infrastructure adapters

Place payment, email, and WhatsApp behind adapters. Authenticate events, minimise attributes, use timeouts/circuit breakers/idempotency, reconcile states, and provide safe degraded modes. Coursera, Edpuzzle, Moodle, H5P, and Canvas LMS are not adapters; they are inspiration only.

## 10. Security testing

Run dependency/secret scans; authorization, IDOR, CSRF, XSS, injection, SSRF, upload, JWT, MFA, RLS, rate-limit, webhook replay, audit-redaction, backup/restore, and vendor-outage tests. Never run destructive tests on production without explicit authorization.

## 11. Delivery and operations

Use development, test, staging, and production; CI gates for lint/type/test/security/migrations; feature flags; synthetic data; backups; rollback; metrics; tracing; queue monitoring; restore drills; quarterly privileged-access reviews.

## 12. Safe acceleration

- Decompose the next gate into vertical slices with explicit owners and dependencies.
- Parallelise frontend, backend, database/RLS, and QA/documentation only where interfaces are agreed.
- Integrate and run the shared test suite daily; do not accumulate long-lived branches.
- Measure gate completion by evidence, not elapsed days or percentage estimates.
- Pull work forward only from the approved scope and protect the current rollback release.
- If early completion creates spare capacity, prioritise security tests, accessibility, migration rehearsals, performance, documentation, and user training before optional features.

## Definition of done

- [ ] Requirement, owner, data purpose, and authoritative record documented.
- [ ] React UI, API, policy, database constraint, RLS, audit, and tests form one complete slice.
- [ ] All eight roles have positive and negative tests.
- [ ] Activity schema/version/scoring/accessibility rules pass.
- [ ] Secrets, sensitive logs, and unsafe uploads are absent.
- [ ] OpenAPI, migrations, monitoring, rollback, and runbook are current.
- [ ] Every mandatory 60-day exit criterion passes; deferred features remain feature-flagged or absent.
- [ ] Every mandatory 90-day criterion passes; payment/messaging provider activation may remain honestly sandbox-blocked without weakening native learning features.
