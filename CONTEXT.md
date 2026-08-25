# AKADEMI Digital Campus — Product Context

## Vision

AKADEMI Digital Campus is a custom LMS for JHS, SHS, PKBM/Academy, STEAM and Arts camps, IELTS/global pathways, teacher development, and sponsored programmes. It supports online, hybrid, and offline-supported learning through one identity, dashboard, content catalogue, gradebook, consent registry, and audit trail.

## Product principles

- One React application and one Django API.
- Supabase PostgreSQL is the authoritative operational database.
- Master content is versioned once and adapted into controlled programme/course versions.
- Interactive learning is native to AKADEMI through a governed activity engine.
- Coursera, Edpuzzle, H5P, Moodle, and Canvas LMS are design references only; AKADEMI implements approved ideas natively.
- Payment, email, and WhatsApp remain optional infrastructure adapters behind stable interfaces.
- Privacy, child safety, accessibility, and auditability are product requirements.

## Sixty-day release objective

The first release supports one school/organisation, up to three programmes, invited users, and controlled real learner data after privacy/security approval. It proves course delivery, assignments, attendance, six interactive activities, gradebook, progress, basic certificates, parent visibility, and sponsor-safe reporting. It is not an open public marketplace.

## Ninety-day completion objective

Month three expands production v1 into v2 with finance/payment workflows, communications, a Math–Physics Annotation Canvas, essay/rubric marking, richer native content, operational analytics, and installable PWA. It does not create a second frontend framework, native mobile codebase, external LMS dependency, public marketplace, or arbitrary plugin ecosystem.

## December completion objective

Feature-complete production v2 is targeted before December. The period from 23 November to 20 December 2026 is reserved for whole-school UAT, approved data migration, security/accessibility/privacy remediation, training, documentation, performance tuning, operational drills, and final handover. Finishing earlier is encouraged when all gates pass; scheduled dates never require artificial waiting.

## Users

Owner, Admin, Treasurer, Instructor, Student, Parent/Guardian, Sponsorship, and contracted Third Party.

## Core domains

1. Identity, MFA, profiles, role assignments, scopes, and parent-child links.
2. Programmes, courses, cohorts, enrolments, schedules, and attendance.
3. Content library, lessons, assignments, essays, annotation canvas, media, and native interactive activities.
4. Attempts, layered canvas submissions, rubrics, annotations, feedback, gradebook, attendance, progress, and certificates.
5. Consent, privacy requests, safeguarding reports, retention, audit, and incidents.
6. Sponsorship programmes, disclosure-controlled reporting, invoices, payments, and reconciliation.
7. Email/WhatsApp notifications, operational monitoring, analytics, export, and PWA.

## Interactive learning lifecycle

```text
Instructor creates draft
→ schema and media validation
→ pedagogical/accessibility/safeguarding review
→ immutable published version
→ student attempt
→ scoring and feedback
→ authoritative grade/completion
→ aggregate analytics
→ revision as a new version or archival
```

## Inspiration boundaries

- Coursera inspires course catalogue, learning paths, progress, and certificates.
- Edpuzzle inspires native interactive-video questions and completion tracking.
- H5P inspires reusable native activity definitions and renderers.
- Canvas LMS inspires assignments, rubrics, annotations, and teacher–student feedback.

No external learning provider is connected. Payment and messaging events are authenticated, validated, idempotent, reconciled, and audited. Learning continues safely when those infrastructure providers are unavailable.

## Non-functional requirements

- WCAG 2.2 AA; keyboard and screen-reader support.
- Bahasa Indonesia and English; Asia/Jakarta display with UTC storage.
- Responsive desktop/tablet/mobile and installable PWA where justified.
- Defined availability, performance budget, queue retry, backup, restore, RPO/RTO, monitoring, and incident response.
- Compliance design baseline: UU No. 27/2022, UU No. 35/2014, applicable electronic-system child-protection rules, and school policy; qualified legal review remains required.

## Success indicators

- Teacher authoring time, published-content quality, learner completion, grade reconciliation, accessibility defect rate, support tickets, integration failures, parent engagement, and privacy/security incidents.
- Metrics must not create advertising profiles or expose identifiable children to sponsorship or third parties.
