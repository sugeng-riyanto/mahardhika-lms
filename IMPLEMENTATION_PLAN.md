# AKADEMI Digital Campus — 90-Day Master Implementation Plan

Calendar baseline: start 24 August 2026. Dates are latest targets. A gate may close earlier and the next phase may begin immediately when all evidence and required approvals are complete.

## Delivery rules

- One accountable technical lead with agentic AI support and mandatory human review.
- Release scope freezes on Day 5.
- Staging deploys by Day 7; the core pilot gate completes by Day 30.
- Days 31–50 add only approved v1 learning functions.
- Days 51–60 are reserved for security, UAT, controlled rollout, and critical fixes.

## Week 1 — Foundation

- Confirm scope, pilot users, privacy/safeguarding owners, acceptance evidence, and rollback authority.
- Bootstrap React/TypeScript/Tailwind/Vite, Django/DRF, Supabase development/staging, CI, OpenAPI, secrets, migrations, private storage, audit, and synthetic fixtures.
- Implement identity/profile, organisation, role, permission, scope, and session foundations.
- Deploy staging by Day 7.

**Gate:** green build; staging login/logout; initial audit and migration rollback work.

## Week 2 — RBAC and course foundation

- Supabase Auth verification, privileged MFA, backend policy engine, RLS, all eight roles, scoped dashboards, parent-child links, and consent.
- Programme, course, cohort, enrolment, lesson, and basic content library.
- Cross-role, cross-child, cross-course, revoked, and expired-scope tests.

**Gate:** identity and scope tests pass at API and RLS layers.

## Week 3 — Assessment engine core

- Activity definition/version/review/publish lifecycle.
- Multiple choice, multiple select, true/false, and image hotspot.
- Attempt/resume, idempotent submission, server scoring, feedback, completion, and gradebook.
- Private image uploads and accessibility alternatives.

**Gate:** instructor-to-student-to-grade vertical slice works exactly once and is audited.

## Week 4 — All-role pilot

- Parent released summary, sponsor threshold-protected aggregate, Admin controls, Owner governance summary, Treasurer restricted dashboard, Third Party deny-by-default scope.
- Consent withdrawal, role/link revocation, content archive, basic bilingual/responsive/accessibility checks.
- Backup/restore rehearsal and first end-to-end authorization suite.

**Day-30 Gate:** original controlled core pilot passes with no critical security/privacy/data-loss defect.

## Week 5 — Assignments, attendance, and richer interactions

- Assignment creation, private student file submission, instructor feedback, release controls, upload validation, and audit.
- Basic essay question authoring, analytic rubric, typed/LaTeX response, and question/student/teacher layer foundation.
- Basic canvas with pen, highlighter, eraser, text, shapes, image/PDF question background, autosave, submit lock, teacher annotation, and released snapshot.
- Attendance session and instructor marking with correction history.
- Drag-and-drop editor, renderer, scorer, keyboard alternative, and tests.
- Course progress aggregation.

**Gate:** assignments, basic essay/canvas, attendance, and drag-and-drop work within course scope without layer or storage leakage.

## Week 6 — Interactive video and certificates

- Video upload workflow, validation, asynchronous processing, progress/status, thumbnails, captions/transcripts, and signed playback.
- Interactive-video timeline markers, questions, resume, scoring, and transcript-based alternative.
- Basic completion certificate with verification code/URL and revocation status.
- Canvas conflict recovery, immutable submission, resubmission version, rubric partial marks, and basic PNG/PDF export.
- Worker retry/idempotency, quota, failure, and cleanup tests.

**Gate:** video, certificate, essay, and basic canvas workflows are recoverable, accessible, versioned, and authorised.

## Week 7 — Hardening and operational readiness

- Full unit, integration, contract, RLS, and Playwright suites.
- IDOR, XSS, CSRF, SSRF, JWT/MFA, upload, webhook/replay where applicable, rate limit, answer-key, log-redaction, and privilege escalation testing.
- WCAG review; Indonesian/English review; mobile/responsive and performance baselines.
- Monitoring, alerts, queue dashboards, backup/restore, migration/rollback, retention jobs, incident and safeguarding runbooks.

**Gate:** release candidate has no unresolved critical/high security, privacy, safeguarding, or data-loss issue.

## Week 8 — UAT and controlled production rollout

- UAT with Admin, Instructor, Student, Parent, Owner, Treasurer, Sponsorship, and Third Party test personas.
- Teacher/admin training, support workflow, privacy notice, acceptable-use policy, release notes, and known limitations.
- Production deployment behind invitation-only access and feature flags.
- Pilot with up to three programmes, ten instructors, one hundred students, verified invited parents, and internal sponsor tester.
- Fix critical/high issues only; collect sign-off evidence and decide continue, restrict, or roll back.

**Day-60 Gate:** every criterion in `SCOPE_60_DAYS.md` passes and required human owners sign off.

## Week 9 — Finance and communications (Days 61–67)

- Freeze v2 scope; preserve Day-60 rollback release.
- Invoice, payment intent/status, receipt, refund status where supported, and reconciliation workflow.
- Payment webhook signature, timestamp, replay, idempotency, amount/currency, and state-transition validation.
- Email and WhatsApp notification templates, consent/preferences, queue, delivery status, retry, and audit.

**Gate:** finance is isolated from academics; duplicate webhooks cannot duplicate payments; messaging respects consent and contains no unnecessary child data.

## Week 10 — Math–Physics Annotation Canvas (Days 68–74)

- Harden the Day-60 basic canvas into layered question/student/teacher/rubric documents.
- Add LaTeX/equation input, coordinate grids, graph axes, rulers/protractors, vectors, free-body diagrams, circuits, ray/wave tools, tables, units, uncertainties, gradient/tangent, and best-fit line tools.
- Add autosave recovery, optimistic concurrency, replay/history, version comparison, resubmission, anchored comments, rubric partial marks, and controlled feedback release.
- Add asynchronous PNG/PDF export with signed access and audit.

**Gate:** teacher and student layers remain isolated and reproducible; math/physics tool output, scoring, replay, versioning, accessibility alternatives, and exports pass.

## Week 11 — Rich native content, analytics, and PWA (Days 75–81)

- Branching scenario and interactive presentation/book composition from trusted activity primitives.
- Advanced operational and learning aggregates with role/scope/privacy controls.
- Enhanced certificate/badge rules and verification/revocation.
- Installable PWA shell, asset caching, network status, retry-safe drafts where approved, and explicit no-cache rules for restricted data.

**Gate:** rich content remains versioned/accessibile; analytics cannot identify sponsored learners; offline behaviour does not leak protected data.

## Week 12 — Integrated hardening and migration rehearsal (Days 82–87)

- Full cross-module E2E, authorization/RLS/storage, canvas/essay, payment, webhook, retry, recovery, migration, and rollback tests.
- Load and queue tests; backup/restore; disaster and incident exercises.
- Accessibility, privacy, safeguarding, finance, legal/contract, and operational review.
- Production migration rehearsal using synthetic or approved minimised data.

**Gate:** no unresolved critical/high defect and the Day-60 v1 journeys remain green.

## Final release (Days 88–90)

- Production v2 deployment behind module and infrastructure-provider feature flags.
- Controlled migration, reconciliation, user/admin training, runbooks, and release notes.
- Verify payment/email/WhatsApp adapters where credentials exist; native learning and canvas features must be fully operational without external LMS credentials.
- Obtain sign-off or roll back to the preserved Day-60 release.

**Day-90 Gate:** `SCOPE_60_DAYS.md` remains green and all applicable criteria in `SCOPE_90_DAYS.md` have evidence.

## December stabilisation and completion window

### 23–30 November — Whole-system release candidate

- Freeze features, close canvas/essay and infrastructure gaps, reconcile data, verify provider modes, run full regression/load/security/accessibility suites, and publish release-candidate documentation.

### 1–7 December — School UAT and training

- Conduct role-based UAT, teacher/admin/finance training, parent/sponsor journey verification, support rehearsals, and remediation of accepted defects.

### 8–14 December — Production migration and operational drills

- Execute approved migration, reconcile counts/grades/payments, test restore/rollback, incident/safeguarding exercises, monitoring/alert verification, and final privacy/security review.

### 15–20 December — Handover

- Final production release, sign-off, administrator handover, source/configuration documentation, credentials ownership verification, known-limitations register, support plan, and warranty/maintenance backlog.

### 21–31 December — Contingency buffer

- Critical fixes, rollback/support, and evidence completion only. No planned new functionality.

If any December gate finishes early, move forward immediately. Do not wait for the listed date; do not skip the next gate.

## Outside Day-90 product boundary

Separate native iOS/Android apps, public marketplace, nationwide multi-tenant commercial onboarding, external LMS integrations, arbitrary activity plugins, third-party content-format compatibility, advanced AI tutoring/proctoring, and unlimited-scale claims.
