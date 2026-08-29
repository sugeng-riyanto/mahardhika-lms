# Changelog — AKADEMI Digital Campus

> All notable changes to the AKADEMI LMS are documented here.
> Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [1.0.0] — October 2026

### 🎉 Initial Production Release

AKADEMI Digital Campus v1.0 — a complete Learning Management System built for
Mahardhika school with role-based access control, UU PDP compliance, and
multi-stakeholder support.

---

### ✨ Features

#### Authentication & Authorization
- **8 role-based access control (RBAC):** Owner, Admin, Treasurer, Instructor, Student, Parent, Sponsor, Third Party
- **Supabase Auth integration** with email/password login
- **Mock auth fallback** for local development without Supabase
- **JWT token verification** with JWKS endpoint
- **MFA support** via Supabase Auth TOTP

#### Core LMS
- **Course management** — create, publish, enrol students
- **Programme management** — organise courses into programmes
- **Lesson player** — structured content delivery with progress tracking
- **Assignment system** — create, submit, grade assignments with file uploads
- **Activity engine** — multiple choice, true/false, fill-in-blank, branching scenarios
- **Gradebook** — per-activity grades, bulk release, CSV export
- **Attendance** — lesson schedules, per-student attendance tracking
- **Calendar** — unified view of lessons, assignments, deadlines

#### Assessment
- **Essay assessment** — rubric-based scoring, inline feedback, grade release workflow
- **Annotation Canvas** — 4-layer drawing system (question, student-answer, teacher-feedback, revision) with coordinate axes, vectors, and version history
- **Branching scenarios** — interactive learning paths with decision nodes

#### Family & Governance
- **Parent dashboard** — view child's grades, progress, and released data
- **Sponsor dashboard** — aggregate programme statistics (min 10 student threshold)
- **Third party dashboard** — time-limited, read-only access
- **Consent management** — UU PDP-compliant grant/withdraw/expiry workflow
- **Data export/deletion requests** — right-to-erasure workflow with approval

#### Operations
- **Finance** — invoice management, Midtrans payment integration, webhook verification
- **Notifications** — in-app notifications with email/WhatsApp adapter support
- **Content lifecycle** — Draft → Review → Published → Archived workflow
- **Certificates** — issue, verify, revoke with unique verification URLs
- **Safeguarding** — incident reports with RBAC-protected access
- **Audit log** — all mutations tracked via AuditEventMixin

#### Privacy & Compliance (UU PDP)
- **Privacy notice** — full UU PDP Article 21 rights disclosure
- **Data minimization** — only necessary data collected per scope
- **Retention policy** — 5yr grades, 3yr audit logs
- **Child data protection** — no profiling, no direct contact, parent consent required
- **Data deletion workflow** — approve/deny with audit trail

#### Accessibility (WCAG 2.1 AA)
- Skip navigation link on all pages
- Keyboard navigation across all interactive elements
- ARIA labels, landmarks, and live regions
- Color contrast ratios ≥ 4.5:1
- Responsive design (320px–400% zoom)
- **Bahasa Indonesia** translations for critical UI strings

#### Developer Experience
- **254 E2E tests** (Playwright) across 6 spec files
- **450+ backend tests** (Django pytest) across 17 modules
- **69 RBAC comprehensive tests** covering all 8 roles + cross-role isolation
- **Vitest unit tests** for frontend components
- **k6 load testing** — 50 concurrent users, P95 latency 8ms

---

### 🔒 Security

- **142 Supabase RLS policies** across 59 tables
- **CSRF protection** enabled via Django middleware
- **XSS prevention** via React auto-escaping + CSP headers
- **SQL injection prevention** via Django ORM (no raw SQL)
- **Rate limiting** — 100/hr anonymous, 1000/hr authenticated
- **File upload validation** — MIME whitelist (20+ types), category size limits
- **Webhook signature verification** — Midtrans SHA-512
- **No secrets in source code** — all keys via environment variables
- **JWT session expiry** — `verify_exp: True` + `ExpiredSignatureError` handling

---

### 📊 Performance

| Metric | Result |
|--------|--------|
| Frontend bundle | 230KB gzipped (limit: 500KB) |
| Page load (avg) | 372ms |
| Page load (max) | 422ms |
| API P95 latency | 8ms |
| Concurrent users tested | 50 |
| Memory leak | 0.0% over 10 navigations |

---

### 🏗️ Infrastructure

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Django + Django REST Framework
- **Database:** Supabase PostgreSQL with connection pooling (port 6543)
- **Auth:** Supabase Auth with JWT verification
- **Storage:** Supabase Storage (4 private buckets)
- **CI/CD:** GitHub Actions + Vercel + Railway
- **Monitoring:** Sentry (error tracking) + UptimeRobot (uptime)

---

### 📋 Known Limitations

1. **Staging deployment** — requires Vercel + Railway accounts (Gate 6)
2. **External accessibility audit** — local axe-core audit passed, third-party review pending (Gate 10.10)
3. **File upload live test** — requires backend API running for full performance test (Gate 11.9)
4. **CDN** — static assets served via Vercel edge network, custom CDN not yet configured (Gate 11.10)
5. **UAT** — local E2E tests pass, school representative sign-off pending (Gate 12)

---

### 🙏 Acknowledgements

Built with ❤️ by the AKADEMI development team for Mahardhika school.
Special thanks to the school administration for UAT coordination.

---

*For detailed production readiness status, see [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)*
