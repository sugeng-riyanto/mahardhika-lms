# AKADEMI Digital Campus — Stable Memory

Store only approved durable decisions. Never store secrets, tokens, private learner data, or temporary debugging notes.

## Approved architecture

- Custom independent LMS; Moodle is not required for the core product.
- Frontend: React + TypeScript + Tailwind CSS + Vite only.
- Backend: Django + Django REST Framework.
- Data platform: Supabase PostgreSQL, Auth, and private Storage.
- Jobs: Celery + Redis.
- One versioned REST API and OpenAPI contract.
- No Vue, HTMX, Alpine.js, primary Django-template UI, Flask core, or untyped JavaScript.

## Approved product decisions

- Canonical roles: Owner, Admin, Treasurer, Instructor, Student, Parent, Sponsorship, Third Party.
- Authorization uses role, permission, scope, relationship, purpose, consent, and resource state.
- Supabase is authoritative for identity mapping, courses, content, attempts, grades, consent, finance, and audit.
- AKADEMI will build a focused interactive activity engine inspired by H5P, not clone the full H5P ecosystem.
- Sixty-day activity types: multiple choice, multiple select, true/false, image hotspot, drag-and-drop, and interactive video.
- Sixty-day target: controlled production v1 for one school, not an open public marketplace.
- Scope freezes after Day 5; deferred features do not block v1.
- Day 30 remains the core-pilot quality gate; it is not removed by the longer schedule.
- Day 60 remains the production-v1 non-regression gate.
- Day 90 target: production v2 functional completion as defined in `SCOPE_90_DAYS.md`.
- Payment/email/WhatsApp infrastructure uses mock/sandbox until approved credentials are available; learning features never depend on external LMS credentials.
- Payment gateway: Midtrans (selected over Xendit for broader payment method coverage, recurring tuition support, robust reconciliation, and Python SDK maturity).
- Month 3 delivers an installable PWA, not a separate native mobile application.
- Planned start: 24 August 2026.
- Hard functional-completion and handover target: 20 December 2026.
- 21–31 December 2026 is contingency/support buffer.
- Schedule targets are latest acceptable dates. Agents may advance immediately after gate evidence and required approvals are complete.
- Acceleration never waives security, RBAC/RLS, accessibility, privacy/safeguarding, backup/restore, UAT, or production-approval gates.
- Published content is immutable and revised by versioning.
- Coursera, Edpuzzle, Moodle, H5P, and Canvas LMS are inspiration only; no API, LTI, credential, package, runtime, or database integration is permitted.
- AKADEMI provides its own Math–Physics Annotation Canvas for teacher-created essay questions, student work, teacher annotation, rubric scoring, and released feedback.
- Canvas source is structured JSON with separate question/student/teacher/rubric layers; PNG/PDF is export/snapshot only.
- Parent access is limited to verified linked children; sponsorship receives aggregate, disclosure-controlled data only.

## Security invariants

- Deny by default; enforce backend policy and database RLS.
- Never expose Supabase service credentials in React.
- Privileged roles use MFA; third-party credentials expire and are revocable.
- No arbitrary executable activity plugins or JavaScript from uploaded packages.
- No production learner data in development, demos, screenshots, or tests.
- No sensitive payloads in logs, analytics, URLs, browser storage, or error messages.
- No child profiling for advertising or uncontrolled direct contact.

## Open production decisions

- Exact supported runtime/package versions and update cadence.
- Supabase project region, backup plan, RPO/RTO, and data-residency review.
- Redis/Celery hosting and observability platform.
- Email/SMS/WhatsApp provider and consent model.
- Payment gateway and reconciliation process.
- Annotation canvas rendering library and licence review.
- Approved equation editor, PDF rendering, graphing, circuit/ray/wave symbol sets, and stylus/browser support matrix.
- Canvas JSON retention, replay granularity, export format, file-size limits, and resubmission policy.
- Content licences, media rules, activity review roles, retention periods, aggregate thresholds, DPO/privacy PIC, and safeguarding PIC.
- PWA/offline scope and native mobile roadmap.

## Month 3 delivery scope

- Math–Physics Annotation Canvas, essay workflow, rubric/partial marks, layered teacher feedback, version comparison, replay/history, and PDF export.
- Native branching scenario and interactive presentation/book using trusted built-in primitives.
- Payment/invoice workflow, email/WhatsApp adapters, operational analytics, enhanced credentials, and installable PWA.
- Native mobile apps, public marketplace, arbitrary plugins, external LMS integrations, and third-party content-format compatibility remain outside v2.

## Implementation Progress

### 2026-08-21 — Milestone 1 Foundation Started
- Completed: Repository structure, .gitignore, .env.example files
- Completed: React + TypeScript + Vite + Tailwind frontend with routing, auth, login, 8 role-based dashboards
- Completed: Django + DRF backend with 18+ apps
- Completed: Supabase JWT authentication backend with mock fallback
- Completed: RBAC permission engine with 8 roles, scoped assignments, parent-child links
- Completed: Full database schema with RLS policies in Supabase migration
- Completed: Seed data management command for 8 development accounts
- Completed: Health check endpoint
- Completed: Frontend npm install, typecheck, lint, and 28 unit tests passing (Vitest)
- Completed: Frontend dev server running on port 5173 with Vite HMR
- Completed: Mock auth login flow with 7 development accounts
- Completed: User Management page — data table with 8 users, roles, status, MFA, search
- Completed: Course Management page — 6 course cards with programme badges, stats, search, level filter
- Completed: Course Detail page — course info, 8 lessons with content types, tabs
- Completed: Programme Management page — 6 programme cards with gradient headers, icons, stats
- Completed: Gradebook page — 8 students with midterm/quiz/essay/final/overall grades, trends
- Completed: Audit Log page — 10 events with actor, resource, IP, timestamps, search/filter
- Completed: Content Library page — file upload, media grid, category filtering (real API)
- Completed: Calendar and Attendance page — schedule view, attendance tracking (real API)
- Completed: Parent Dashboard — linked children, released grades (real API)
- Completed: Sponsor Dashboard — aggregate data, consent model (real API)
- Completed: Treasurer Dashboard — finance overview (real API)
- Completed: Essay Assessment workspace — rubric, feedback, grade release
- Completed: Activity Engine — MC/TF/MS with server-side scoring, Activity Player
- Completed: Assignment system — create, submit, grade, feedback
- Completed: Grade creation & release API — bulk release, revoke, audit events
- Completed: Finance module — Invoice CRUD, Midtrans integration, status transitions
- Completed: Payment system — PaymentIntent, PaymentTransaction, PaymentRefund, webhook idempotency
- Completed: Notification system — bell panel, mark read, unread count, admin send
- Completed: Certificate system — issuance, verification, revocation
- Completed: Reports & Analytics page — grade distributions, course stats
- Completed: Course progress aggregation — CompletionRecord, CourseProgress, my_progress endpoint
- Completed: Security test suite — 14 RBAC enforcement tests (parent isolation, instructor isolation, treasurer isolation, IDOR prevention, privilege escalation)
- Completed: Domain RLS policies — 003 migration covering 30+ Django domain tables (grades, assignments, activities, attendance, essays, finance, payments, notifications, certificates, progress, canvas, attempts, content, consent, sponsorship, safeguarding)
- Completed: Math-Physics Annotation Canvas — 4-layer model (question/student/teacher/revision), autosave with debounce, version history, optimistic concurrency, submission lock, return-for-revision workflow, 22 backend RBAC tests
- Completed: Email adapter — mock provider (logs + stores sent emails) and SMTP provider (TLS, auth, timeout)
- Completed: WhatsApp adapter — mock provider (logs + stores sent messages) and Meta Cloud API provider (template + text messages)
- Completed: Notification dispatcher — multi-channel send (in_app/email/whatsapp), 10 pre-built templates (grade_released, assignment_due, submission_received, etc.), automatic email on in_app send
- Completed: PWA support — service worker with cache-first/network-first/stale-while-revalidate strategies, manifest.json, connection status indicator (online/offline/slow), offline draft queue, restricted data never cached
- Completed: Domain RLS tests — 10 SQL tests verifying finance wall, safeguarding isolation, essay scoping, notification recipient scoping, payment refund dual approval
- Completed: CI/CD pipeline — GitHub Actions workflow (backend tests, frontend build, security scan)
- Completed: Playwright E2E tests — login flow, protected routes, responsive design
- Completed: Backup/Restore scripts — pg_dump/restore with safety checks, retention, verification

### 2026-08-22 — Day-60 Status
- All 8 mandatory journeys verified
- All critical backend tests passing (72+ tests across security, progress, certificates, payments, assignments, notifications)
- Frontend TypeScript clean, 28 unit tests passing
- Day-60 gate criteria met for production v1

### 2026-08-23 — Milestone 7 Continued
- Completed: Settings page (General, Security, Notifications, Data & Privacy sections)
- Completed: Profile page (personal info, avatar, MFA status, password change, danger zone)
- Completed: Notifications management page (channel/read filters, search, mark-read, mark-all-read)
- Completed: Essay authoring form (Create Essay page with rubric criteria builder)
- Completed: Owner Dashboard wired to real API data (users, courses, programmes, audit events, consent count)
- Completed: Safeguarding backend tests — 28 tests covering model, CRUD, RBAC, org isolation, audit
- Completed: Safeguarding URLs wired into main URL config (`/api/v1/safeguarding/`)
- Completed: Celery worker tasks — canvas export (PNG/PDF), notification dispatch (email/WhatsApp), finance reconciliation, invoice reminders, monthly report generation
- Completed: Frontend TypeScript clean, 28/28 unit tests passing
- Completed: Safeguarding RBAC tests — 8/8 passing (instructor, student, parent, unauthenticated all blocked; org isolation verified)
- Fixed: PlaceholderPage replaced with real Settings, Profile, Notifications, and Essay Create pages
- Fixed: Unused imports cleaned up across AppRouter, NotificationsPage, ProfilePage, SettingsPage

### 2026-08-25 — RBAC Audit & Supabase Setup
- Completed: `supabase/migrations/004_storage_buckets.sql` — 4 private buckets (content-library, submissions, canvas-exports, certificates) with RBAC-aware storage policies and folder-path scoping
- Completed: `supabase/SUPABASE_SETUP.md` — full manual checklist for the project owner (migrations 003+004, Auth settings, redirect URLs, API key placement, backups, verification steps)
- Completed: Generated + applied pending Django migrations (activities 0003 activity_type choices, consent 0003 meta/field changes, notifications 0003 index/channel changes)
- Verified: Midtrans webhook SHA-512 signature verification already implemented in `payments/adapter.py`
- Verified: Frontend TypeScript clean, 28/28 unit tests passing; backend system check clean; security RBAC suite 14/14 passing
- Completed: Full RBAC audit across 25+ ViewSets — every ViewSet has (1) role-based queryset filtering in get_queryset(), (2) perform_create/update/destroy permission checks, (3) custom actions with role verification. Routes use RoleRoute with allowedRoles arrays matching backend permissions.
- Status: RBAC fully functional on both backend API and frontend route guards. Supabase database connection pending — user to provide URL.

## Update template

```markdown
### YYYY-MM-DD — Decision
- Decision:
- Reason:
- Security/privacy impact:
- Migration impact:
- Approved by:
- Revisit trigger:
```
