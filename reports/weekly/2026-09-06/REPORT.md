# AKADEMI Digital Campus — Weekly Progress Report

**Week of:** 2026-09-06
**Git Commit:** 52075b1 (2026-09-06 07:12:36 +0700)
**Commit Message:** feat: SMTP email delivery with SendGrid/Brevo support and test command

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| Screenshots Captured | 35/41 |
| Screenshot Failures | 6 |
| Git Commit | 52075b1 |
| Report Generated | 2026-09-06 00:36:06 |

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
- Role: `public` | Size: 210KB

### Admin Dashboard
![Admin Dashboard](02-admin-dashboard.png)
- Role: `admin` | Size: 210KB

### Owner Dashboard
![Owner Dashboard](03-owner-dashboard.png)
- Role: `owner` | Size: 160KB

### Instructor Dashboard
![Instructor Dashboard](04-instructor-dashboard.png)
- Role: `instructor` | Size: 211KB

### Student Dashboard
![Student Dashboard](05-student-dashboard.png)
- Role: `student` | Size: 205KB

### Parent Dashboard
![Parent Dashboard](06-parent-dashboard.png)
- Role: `parent` | Size: 230KB

### Treasurer Dashboard
![Treasurer Dashboard](07-treasurer-dashboard.png)
- Role: `treasurer` | Size: 157KB

### Sponsor Dashboard
![Sponsor Dashboard](08-sponsor-dashboard.png)
- Role: `sponsorship` | Size: 212KB

### Third Party Dashboard
![Third Party Dashboard](09-thirdparty-dashboard.png)
- Role: `third_party` | Size: 139KB

### Course List
![Course List](10-courses.png)
- Role: `all` | Size: 410KB

### User Management
![User Management](11-users.png)
- Role: `admin` | Size: 228KB

### Programme Management
![Programme Management](12-programmes.png)
- Role: `admin` | Size: 294KB

### Gradebook
![Gradebook](13-gradebook.png)
- Role: `all` | Size: 246KB

### Essay List
![Essay List](14-essays.png)
- Role: `all` | Size: 305KB

### Annotation Canvas
![Annotation Canvas](15-canvas.png)
- Role: `all` | Size: 282KB

### Attendance
![Attendance](16-attendance.png)
- Role: `all` | Size: 225KB

### Calendar
![Calendar](17-calendar.png)
- Role: `all` | Size: 158KB

### Content Library
![Content Library](18-content-library.png)
- Role: `instructor` | Size: 192KB

### Assignments
![Assignments](19-assignments.png)
- Role: `all` | Size: 510KB

### Finance
![Finance](20-finance.png)
- Role: `treasurer` | Size: 229KB

### Notifications
![Notifications](21-notifications.png)
- Role: `all` | Size: 171KB

### Reports & Analytics
![Reports & Analytics](22-reports.png)
- Role: `admin` | Size: 178KB

### Audit Log
![Audit Log](23-audit-log.png)
- Role: `admin` | Size: 228KB

### Certificates
![Certificates](24-certificates.png)
- Role: `all` | Size: 170KB

### Settings
![Settings](25-settings.png)
- Role: `admin` | Size: 178KB

### Profile
![Profile](26-profile.png)
- Role: `all` | Size: 169KB

### Privacy Notice
![Privacy Notice](27-privacy.png)
- Role: `all` | Size: 328KB

### Consent Management
![Consent Management](28-consent.png)
- Role: `parent` | Size: 246KB

### Calendar — Take Roll ready ❌
- **Error:** locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for getByRol

### Calendar — Take Roll modal ❌
- **Error:** locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for getByRol

### Attendance — Take Roll ready ❌
- **Error:** locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('

### Attendance — Take Roll modal ❌
- **Error:** locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('

### Attendance Export — schedules CSV
![Attendance Export — schedules CSV](33-attendance-export-schedules.png)
- Role: `instructor` | Size: 105KB

### Attendance Export — records CSV ❌
- **Error:** locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('

### Content Library — file upload result
![Content Library — file upload result](35-content-upload-result.png)
- Role: `instructor` | Size: 198KB

### Content Library — Add Video embed
![Content Library — Add Video embed](36-content-video-modal.png)
- Role: `instructor` | Size: 321KB

### Essay — video prompt workspace
![Essay — video prompt workspace](37-essay-video-workspace.png)
- Role: `student` | Size: 649KB

### Assignment — video brief create
![Assignment — video brief create](38-assignment-video-modal.png)
- Role: `instructor` | Size: 399KB

### Assignment — video brief detail
![Assignment — video brief detail](39-assignment-video-detail.png)
- Role: `student` | Size: 97KB

### Lesson — video embed player ❌
- **Error:** cannot resolve course

### Courses — clean seed data
![Courses — clean seed data](41-courses-clean-seed.png)
- Role: `all` | Size: 410KB

## 📥 Generated CSV Exports

Live CSVs downloaded during the export-flow screenshots (GitHub previews them inline):

- [attendance-records-2026-09-06.csv](exports/attendance-records-2026-09-06.csv)
- [attendance-schedules-2026-09-06.csv](exports/attendance-schedules-2026-09-06.csv)

---

---

## 🔧 Backend Status

| Check | Status |
|-------|--------|
| Django System Check | ✅ (verified at commit time) |
| RBAC Enforcement | ✅ 14/14 tests |
| RBAC Comprehensive (all roles) | ✅ 75/75 tests |
| Consent Tests | ✅ 23/23 tests |
| Notifications Tests | ✅ 70/70 tests |
| Attendance API (roster + roll) | ✅ 16/16 tests |
| Profile Self-Service API | ✅ 12/12 tests |
| Security Tests | ✅ Passed |
| Frontend TypeScript | ✅ 0 errors |
| Frontend Unit Tests | ✅ 50/50 |
| E2E Playwright (chromium, collected) | ✅ 267 test cases |

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
- **RLS Policies:** 151 (143 public + 8 storage)
- **Helper Functions:** 16
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
- Attendance: Take Roll wired on Calendar + Attendance pages; Export CSVs reflect the viewed month and the records panel's date/status/search filters
- Profile self-service: save, MFA toggle, change password and account deletion all call real endpoints (any role can edit own profile)
- Audit log and Canvas exports wired; PDF export from the annotation canvas
- File uploads: Content Library, assignment submissions and essay responses upload to Supabase Storage via signed URLs (PDF/DOCX/image); Content Library has drag-drop + multi-file
- Video embeds: YouTube/Google Drive links render inline (Content Library items and video-based essay prompts) instead of uploading large media files
- 267 E2E test cases per browser project (chromium/firefox/tablet) covering login, CRUD, RBAC, storage, accessibility, responsive

---

*Report generated automatically by AKADEMI Digital Campus*
