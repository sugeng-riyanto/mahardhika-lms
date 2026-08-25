# AKADEMI Digital Campus — Final Acceptance Criteria

The system is complete only when evidence exists for every applicable item.

## Product journeys

- Admin can invite, scope, revoke, and audit users and enrolments.
- Instructor can create/review/publish content, manage assigned courses, build math/physics essays and canvas questions, annotate immutable student submissions, apply rubrics, and release feedback.
- Student can access only enrolled learning, write/draw canvas solutions, submit immutable versions, complete activities, see released annotations/rubrics/results, and verify certificates.
- Parent can see only the released information of a verified linked child.
- Treasurer can manage finance within scope and cannot access academic/safeguarding records.
- Sponsorship can view only disclosure-controlled aggregates without drill-down.
- Owner receives governance oversight without routine learner browsing.
- Third Party can use only contracted, expiring, purpose-bound integration scope.

## Security and authorization

- All eight roles pass positive and negative API, RLS, storage, export, search, notification, worker, and analytics tests.
- MFA, session expiry/revocation, rate limits, IDOR, CSRF, XSS, SSRF, injection, upload, webhook replay, and privilege escalation controls pass.
- Service credentials, answer keys, unreleased grades, sensitive logs, and private storage paths never reach unauthorised clients.
- Every sensitive mutation/export is auditable with actor, scope, purpose, target, result, timestamp, and correlation ID.

## Learning integrity

- Published activity/content versions are immutable and reproducible.
- Attempts reference their original version.
- Question, student-work, teacher-annotation, and rubric/score layers remain independently authorised and versioned.
- Submitted student canvas work is immutable; resubmission creates a linked new version.
- Autosave/recovery, replay/history, version comparison, rubric totals, partial marks, moderation, release, and PNG/PDF export behave correctly.
- Retry/duplicate events cannot duplicate grades, attendance, payments, certificates, or notifications.
- Server-side scoring, feedback release, regrading, completion, and certificate revocation behave correctly.

## Privacy, child protection, and accessibility

- Parent links and consent/revocation workflows are verified.
- Sponsorship thresholds prevent small-group identification.
- Retention, deletion/restriction, incident, and safeguarding workflows are documented and tested.
- Critical journeys meet the WCAG 2.2 AA baseline with keyboard, focus, labels, contrast, reflow, captions/transcripts, and alternatives.
- Bahasa Indonesia and English critical strings are reviewed.

## Operations

- Production migration and reconciliation pass.
- Backup restore, rollback, canvas/export worker, payment/messaging provider outage, and incident drills pass.
- Monitoring/alerts cover authentication, authorization, storage, queue, canvas autosave/export, grade, payment, messaging, and privileged-change failures.
- Runbooks, architecture, API/OpenAPI, data model, release notes, known limitations, training, and support ownership are current.

## External dependencies

- Native learning, interactive activities, essays, annotation canvas, rubrics, progress, and certificates require no external LMS provider.
- Payment/email/WhatsApp providers use approved credentials and end-to-end evidence before live activation; otherwise their adapters remain safely sandboxed/disabled.

## Sign-off

Required: Product Owner, technical lead, school representative, privacy/safeguarding PIC, and finance owner for payment scope. No unresolved critical/high security, privacy, safeguarding, finance-integrity, accessibility-blocking, or data-loss defect may remain.
