# AKADEMI Digital Campus — 90-Day Production v2 Scope

## Release contract

Day 90 completes production v2 on top of the accepted Day-60 release. All Day-60 RBAC, RLS, privacy, safeguarding, accessibility, integrity, backup, and rollback criteria remain mandatory.

Coursera, Edpuzzle, Moodle, H5P, and Canvas LMS are inspiration only. Production v2 does not connect to their APIs, LTI tools, credentials, accounts, runtimes, packages, or databases.

## Month 3 mandatory scope

### Math–Physics Annotation Canvas

- Four-layer model: immutable question, student work, teacher annotation, rubric/score.
- Blank, safe image, and rendered PDF question backgrounds.
- Pen, highlighter, eraser, text, selection, shapes, undo/redo, zoom/pan, stylus/mouse/touch, autosave, recovery, and optimistic concurrency.
- Equation/LaTeX input, coordinate grids, graph axes, ruler, protractor, vectors, free-body diagrams, circuit symbols, ray diagrams, wave diagrams, tables, units, uncertainty, gradient/tangent, and best-fit lines.
- Attempt locking, resubmission as a new linked version, replay/history, version comparison, anchored comments, teacher feedback release, and audited override.
- Structured JSON as authoritative data; PNG/PDF snapshots and exports as derived artifacts.
- Keyboard-accessible paths and equivalent alternative response modes where drawing tools cannot be fully accessible.

### Essay assessment and rubric

- Essay authoring with text, LaTeX, images/PDF, canvas areas, learning objectives, expected evidence, marking guidance, and versioning.
- Analytic and holistic rubrics, weighted criteria, partial marks, comments, moderation, second marking where configured, grade release, regrade, and appeal trail.
- Physics-specific marking for principle, equation, substitution, calculation, units/significant figures, diagram/graph, and explanation.
- Student original work remains immutable after submission; teacher feedback never overwrites it.

### Native rich learning

- Branching scenario and interactive presentation/book composition using trusted AKADEMI activity primitives.
- Course catalogue, learning path, progress, certificate/badge, and interactive-video experiences implemented natively.
- No arbitrary uploaded code or external activity libraries.

### Finance and communications

- Invoice lifecycle, payment intent/reference, status, receipt, overdue state, refund status where supported, and reconciliation.
- Treasurer-scoped dashboard without academic/canvas/safeguarding access.
- Email and WhatsApp adapters with templates, preferences/consent, queue, delivery status, retry limits, quiet hours, and audit.
- Signed, replay-protected, idempotent payment/messaging webhooks.

### Analytics and PWA

- Role-scoped operational dashboards and approved learning aggregates.
- Sponsor disclosure thresholds and no identifiable drill-down.
- Installable React PWA shell, safe update strategy, connection status, retry-safe approved drafts, and strict no-cache treatment for restricted records/canvas layers.

## Explicit exclusions

- Coursera, Edpuzzle, Moodle, H5P, or Canvas LMS integration.
- H5P package import/export or full compatibility with third-party content formats.
- Separate native iOS/Android codebase.
- Public marketplace, nationwide multi-tenant commercial onboarding, or arbitrary plugins.
- Advanced AI tutor, automated high-stakes marking, facial recognition, behavioural advertising, and remote proctoring.
- Unlimited-scale or legal-compliance guarantees.

## Day-90 exit criteria

- Every Day-60 journey and authorization test remains green.
- Question, student, teacher, and rubric layers have correct independent permissions and immutable submitted versions.
- Autosave conflict, reconnect, browser refresh, crash recovery, submit lock, duplicate submit, and resubmission tests pass.
- Teacher cannot alter the original student layer; Student cannot alter question/teacher/rubric layers; Parent sees released linked-child output only; Sponsor/Treasurer/Third Party cannot retrieve individual canvas data.
- Math/physics tools produce consistent structured output and retain meaning in PNG/PDF exports.
- Rubric totals, weighting, partial marks, moderation, regrade, release, and audit are correct.
- Canvas replay/history and version comparison cannot expose deleted/restricted or another learner's data.
- PWA caching cannot expose restricted records or canvas layers across users/device sessions.
- Finance state transitions and reconciliation are correct; messaging honours consent and avoids sensitive payloads.
- Full E2E, API, RLS, storage, canvas, export, worker, webhook, backup/restore, accessibility, load, and rollback suites pass.
- No unresolved critical/high security, privacy, safeguarding, finance-integrity, accessibility-blocking, or data-loss defect.
- Product Owner, technical lead, academic/assessment lead, finance owner, privacy/safeguarding PIC, and school representative sign off.

## Automatic stop conditions

Do not release or disable the affected feature if authentication/RLS/storage authorization can be bypassed, submitted student work can be altered, layers leak across roles/learners, autosave loses work, exports expose private data, payment cannot reconcile, messages expose sensitive child data, PWA caches protected content unsafely, or any Day-60 guarantee regresses.
