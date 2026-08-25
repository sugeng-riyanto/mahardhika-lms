# AKADEMI Digital Campus — 60-Day Production v1 Scope

## Release definition

Day 60 delivers an **invitation-only production v1** for one school with controlled learner data after privacy, safeguarding, security, and operational approval. It is not an open marketplace, nationwide launch, or guarantee of legal compliance.

## Capacity boundary

- One organisation, up to three programmes and ten courses.
- Up to ten instructors, one hundred students, and verified invited parents.
- Internal Owner/Admin/Treasurer/Sponsorship test users.
- Third Party disabled by default except an approved, expiring technical-support scope.
- Scale above these limits requires load evidence and approval.

## Mandatory journeys

1. Admin invites users, assigns/revokes scoped roles, manages course enrolment, and audits actions.
2. Instructor builds lessons, native activities, essay/canvas questions, assignment, attendance, rubric grading, annotation feedback, and completion.
3. Student accesses only enrolled courses, completes activities, writes/draws an essay response on the canvas, submits work, sees released results/progress, and obtains an eligible certificate.
4. Parent sees only released information for a verified linked child.
5. Sponsorship sees only minimum-threshold, disclosure-controlled programme aggregates.
6. Treasurer sees approved budget/licence summaries but no academic, attempt, response, or safeguarding records.
7. Owner sees governance aggregates and audit summaries without routine learner browsing.
8. Third Party is denied unless an explicit, purpose-bound, expiring support grant exists.

## Included functions

- Supabase Auth, session lifecycle, privileged MFA, eight roles, scoped assignments, RLS, parent link, consent, revocation, and audit.
- Programme, course, cohort, enrolment, lesson, content library, assignment/file submission, essay question, basic annotation canvas, attendance, gradebook, progress, and basic certificate.
- Draft/review/publish/version/archive lifecycle.
- Multiple choice, multiple select, true/false, image hotspot, drag-and-drop, and interactive video.
- Attempt/resume, server scoring, idempotent submission, feedback release, completion, and regrade audit.
- Private image/document/video storage, video processing, captions/transcripts, signed delivery, quotas, and cleanup.
- Canvas question/student/teacher/rubric layers, autosave, submit lock, pen/highlighter/eraser/text/shapes, image/PDF background, basic equation input, anchored feedback, partial marks, and PNG/PDF snapshot.
- Parent summary, sponsor aggregates, responsive bilingual essentials, WCAG 2.2 AA baseline, monitoring, backup/restore, runbooks, and rollback.

## Excluded functions

- Public self-registration, public marketplace, multi-tenant commercial onboarding, and bulk historical migration.
- Coursera, Edpuzzle, Moodle, H5P, and Canvas LMS integrations; payment gateway and WhatsApp automation.
- Branching scenarios, interactive books/presentations, arbitrary plugins, advanced proctoring, complex analytics, AI recommendations, offline/PWA, and native mobile apps.

## Non-negotiable exit criteria

- CI build, lint, strict TypeScript, backend tests, migrations, contract tests, critical Playwright journeys, and security checks pass.
- All eight roles pass allowed/denied tests at API, database RLS, storage, export, search, and notification boundaries.
- Parent A cannot access Child B; instructor cannot access another course; sponsor cannot obtain identifiable rows; Treasurer cannot access academic/safeguarding data.
- Service credentials, answer keys, unreleased grades, and private object paths never reach an unauthorised browser.
- Duplicate submissions, retries, and worker events cannot duplicate grades, attendance, certificates, or audit-sensitive effects.
- Published content/activities remain reproducible after revision; attempts retain the original version.
- Revoked roles, links, grants, and consent block subsequent protected processing.
- Upload validation and signed access prevent cross-user/course media leakage.
- Interactive video has captions/transcript and keyboard-accessible alternative interaction.
- Submitted canvas work is immutable, teacher annotation is separate, autosave conflict recovery passes, and unauthorised roles cannot retrieve any individual layer or export.
- Backup restore, migration rollback, worker failure recovery, and certificate revocation are demonstrated in staging.
- Monitoring detects authentication failures, authorization denials, integration/worker failures, storage errors, grade mismatches, privileged changes, and exports.
- No unresolved critical/high security, privacy, safeguarding, accessibility-blocking, or data-loss defect.
- Product Owner, technical lead, privacy/safeguarding PIC, and school pilot representative sign off.

## Automatic stop conditions

Do not launch or suspend production if authentication/RLS/storage authorization can be bypassed, cross-child/course data is exposed, grades or attendance corrupt, videos expose private objects, backups cannot restore, secrets leak, or a child-safety/privacy incident lacks containment and escalation.
