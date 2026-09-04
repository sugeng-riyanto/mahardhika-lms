# AKADEMI Digital Campus — Weekly Progress Report

**Week of:** 2026-09-04
**Git Commit:** e9e158e (2026-09-04 19:33:54 +0700)
**Commit Message:** docs: weekly report — roll-call flow screenshots (2026-09-04)

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| Screenshots Captured | 34/34 |
| Screenshot Failures | 0 |
| Git Commit | e9e158e |
| Report Generated | 2026-09-04 12:55:04 |

---

## 🌐 Access URLs

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Local development |
| not running | Public URL (ngrok tunnel) |

---

## 🖥️ Frontend Screenshots

### Login Page
![Login Page](01-login.png)
- Role: `public` | Size: 172KB

### Admin Dashboard
![Admin Dashboard](02-admin-dashboard.png)
- Role: `admin` | Size: 172KB

### Owner Dashboard
![Owner Dashboard](03-owner-dashboard.png)
- Role: `owner` | Size: 156KB

### Instructor Dashboard
![Instructor Dashboard](04-instructor-dashboard.png)
- Role: `instructor` | Size: 207KB

### Student Dashboard
![Student Dashboard](05-student-dashboard.png)
- Role: `student` | Size: 188KB

### Parent Dashboard
![Parent Dashboard](06-parent-dashboard.png)
- Role: `parent` | Size: 196KB

### Treasurer Dashboard
![Treasurer Dashboard](07-treasurer-dashboard.png)
- Role: `treasurer` | Size: 132KB

### Sponsor Dashboard
![Sponsor Dashboard](08-sponsor-dashboard.png)
- Role: `sponsorship` | Size: 191KB

### Third Party Dashboard
![Third Party Dashboard](09-thirdparty-dashboard.png)
- Role: `third_party` | Size: 132KB

### Course List
![Course List](10-courses.png)
- Role: `all` | Size: 417KB

### User Management
![User Management](11-users.png)
- Role: `admin` | Size: 209KB

### Programme Management
![Programme Management](12-programmes.png)
- Role: `admin` | Size: 288KB

### Gradebook
![Gradebook](13-gradebook.png)
- Role: `all` | Size: 149KB

### Essay List
![Essay List](14-essays.png)
- Role: `all` | Size: 131KB

### Annotation Canvas
![Annotation Canvas](15-canvas.png)
- Role: `all` | Size: 278KB

### Attendance
![Attendance](16-attendance.png)
- Role: `all` | Size: 159KB

### Calendar
![Calendar](17-calendar.png)
- Role: `all` | Size: 141KB

### Content Library
![Content Library](18-content-library.png)
- Role: `instructor` | Size: 186KB

### Assignments
![Assignments](19-assignments.png)
- Role: `all` | Size: 126KB

### Finance
![Finance](20-finance.png)
- Role: `treasurer` | Size: 94KB

### Notifications
![Notifications](21-notifications.png)
- Role: `all` | Size: 109KB

### Reports & Analytics
![Reports & Analytics](22-reports.png)
- Role: `admin` | Size: 167KB

### Audit Log
![Audit Log](23-audit-log.png)
- Role: `admin` | Size: 209KB

### Certificates
![Certificates](24-certificates.png)
- Role: `all` | Size: 107KB

### Settings
![Settings](25-settings.png)
- Role: `admin` | Size: 161KB

### Profile
![Profile](26-profile.png)
- Role: `all` | Size: 167KB

### Privacy Notice
![Privacy Notice](27-privacy.png)
- Role: `all` | Size: 98KB

### Consent Management
![Consent Management](28-consent.png)
- Role: `parent` | Size: 138KB

### Calendar — Take Roll ready
![Calendar — Take Roll ready](29-calendar-roll.png)
- Role: `instructor` | Size: 205KB

### Calendar — Take Roll modal
![Calendar — Take Roll modal](30-calendar-roll-modal.png)
- Role: `instructor` | Size: 353KB

### Attendance — Take Roll ready
![Attendance — Take Roll ready](31-attendance-roll.png)
- Role: `instructor` | Size: 240KB

### Attendance — Take Roll modal
![Attendance — Take Roll modal](32-attendance-roll-modal.png)
- Role: `instructor` | Size: 363KB

### Attendance Export — schedules CSV
![Attendance Export — schedules CSV](33-attendance-export-schedules.png)
- Role: `instructor` | Size: 170KB

### Attendance Export — records CSV
![Attendance Export — records CSV](34-attendance-export-records.png)
- Role: `instructor` | Size: 115KB

---

## 🔧 Backend Status

| Check | Status |
|-------|--------|
| Django System Check | ✅ (verified at commit time) |
| RBAC Enforcement | ✅ 14/14 tests |
| Admin RBAC (incl. invoices) | ✅ 6/6 tests |
| Consent Tests | ✅ 23/23 tests |
| Notifications Tests | ✅ 51/51 tests |
| Security Tests | ✅ Passed |
| Frontend TypeScript | ✅ 0 errors |
| Frontend Unit Tests | ✅ 39/39 |
| E2E Playwright Tests | ✅ 254/254 tests |

---

## 📈 Milestone Progress

| Milestone | Status | Target |
|-----------|--------|--------|
| 1. Foundation | ✅ Complete | Day 1-30 |
| 2. Core LMS | ✅ Complete | Day 30-60 |
| 3. Family & Governance | ✅ Complete | Day 60-75 |
| 4. Native Activities | ✅ Complete | Day 60-75 |
| 5. Essay & Canvas | ✅ Complete | Day 75-90 |
| 6. Operations | ✅ Complete | Day 90+ |
| 7. Release | 🟡 In Progress | Oct 2026 |

---

## 🔐 RBAC & Security

- **Tables with RLS:** 59
- **RLS Policies:** 142 (134 public + 8 storage)
- **Helper Functions:** 14
- **Auth Users:** 8
- **Roles:** Owner, Admin, Treasurer, Instructor, Student, Parent, Sponsor, Third Party
- **ViewSets with RBAC permissions:** 34/34 ✅

### RBAC Permission Classes

| Permission Class | ViewSets | Denied Roles |
|---|---|---|
| IsAcademicRole | content, attendance, canvas, courses, lessons, activities, attempts, progress, certificates | treasurer, sponsor, third_party |
| IsConsentRole | consent, data export, data deletion | instructor, treasurer, sponsor, third_party |
| IsSponsorshipRole | sponsorship | instructor, student, parent, treasurer, third_party |
| IsPaymentRole | payments, refunds | instructor, sponsor, third_party |
| IsFinanceRole | invoices (owner, admin, treasurer) | instructor, student, parent, sponsor, third_party |
| IsGradeRole | grades | treasurer, sponsor, third_party |
| IsEssayRole | essays | treasurer, sponsor, third_party |
| IsAssignmentRole | assignments | treasurer, sponsor, third_party |
| IsAdminOrOwner | audit, safeguarding, users, roles, orgs | all non-admin/owner |

---

## 📝 Notes

- All pages render correctly with real API data
- RBAC enforced on both frontend (route guards) and backend (queryset filtering)
- Database connected to Supabase PostgreSQL with full RLS
- IsFinanceRole fix: admin can now list invoices (was blocked before)
- Safeguarding RBAC fix: admin org isolation + audit mixin fire on create
- 254 E2E tests covering login, CRUD, RBAC, storage, accessibility, responsive

---

*Report generated automatically by AKADEMI Digital Campus*
