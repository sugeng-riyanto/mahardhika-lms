import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ProtectedRoute, GuestRoute, RoleRoute } from '@/auth/RouteGuard'
import { Layout } from '@/components/Layout'
import { NotFound } from '@/components/NotFound'
import { AccessDenied } from '@/components/AccessDenied'

// Auth pages
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'

// Dashboards
import { DashboardRouter } from '@/features/dashboard/DashboardRouter'
import { OwnerDashboard } from '@/features/dashboard/OwnerDashboard'
import { AdminDashboard } from '@/features/dashboard/AdminDashboard'
import { InstructorDashboard } from '@/features/dashboard/InstructorDashboard'
import { StudentDashboard } from '@/features/dashboard/StudentDashboard'
import { ParentDashboard } from '@/features/dashboard/ParentDashboard'
import { TreasurerDashboard } from '@/features/dashboard/TreasurerDashboard'
import { SponsorDashboard } from '@/features/dashboard/SponsorDashboard'
import { ThirdPartyDashboard } from '@/features/dashboard/ThirdPartyDashboard'

// Feature pages
import { SettingsPage } from '@/features/settings/SettingsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { EssayCreatePage } from '@/features/essays/EssayCreatePage'
import { UserListPage } from '@/features/users/UserListPage'
import { CourseListPage } from '@/features/courses/CourseListPage'
import { CourseDetailPage } from '@/features/courses/CourseDetailPage'
import { ProgrammeListPage } from '@/features/programmes/ProgrammeListPage'
import { GradebookPage } from '@/features/gradebook/GradebookPage'
import { AuditLogPage } from '@/features/audit/AuditLogPage'
import { ContentLibraryPage } from '@/features/content/ContentLibraryPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { CanvasPage } from '@/features/canvas/CanvasPage'
import { LessonPlayerPage } from '@/features/lessons/LessonPlayerPage'
import { EssayListPage } from '@/features/essays/EssayListPage'
import { AttendancePage } from '@/features/attendance/AttendancePage'
import { ActivityPlayerPage } from '@/features/activities/ActivityPlayerPage'
import { EssayWorkspacePage } from '@/features/essays/EssayWorkspacePage'
import { EssayGradingPage } from '@/features/essays/EssayGradingPage'
import { AssignmentListPage } from '@/features/assignments/AssignmentListPage'
import { AssignmentDetailPage } from '@/features/assignments/AssignmentDetailPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { FinancePage } from '@/features/finance/FinancePage'
import { CertificatePage } from '@/features/certificates/CertificatePage'
import { PrivacyNoticePage } from '@/features/privacy/PrivacyNoticePage'
import { ConsentManagementPage } from '@/features/privacy/ConsentManagementPage'

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Layout><Outlet /></Layout></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard routing */}
        <Route path="dashboard" element={<DashboardRouter />} />
        <Route path="dashboard/owner" element={<RoleRoute allowedRoles={['owner']}><OwnerDashboard /></RoleRoute>} />
        <Route path="dashboard/admin" element={<RoleRoute allowedRoles={['admin']}><AdminDashboard /></RoleRoute>} />
        <Route path="dashboard/instructor" element={<RoleRoute allowedRoles={['instructor']}><InstructorDashboard /></RoleRoute>} />
        <Route path="dashboard/student" element={<RoleRoute allowedRoles={['student']}><StudentDashboard /></RoleRoute>} />
        <Route path="dashboard/parent" element={<RoleRoute allowedRoles={['parent']}><ParentDashboard /></RoleRoute>} />
        <Route path="dashboard/treasurer" element={<RoleRoute allowedRoles={['treasurer']}><TreasurerDashboard /></RoleRoute>} />
        <Route path="dashboard/sponsor" element={<RoleRoute allowedRoles={['sponsorship']}><SponsorDashboard /></RoleRoute>} />
        <Route path="dashboard/third-party" element={<RoleRoute allowedRoles={['third_party']}><ThirdPartyDashboard /></RoleRoute>} />

        {/* Feature routes */}
        <Route path="courses" element={<CourseListPage />} />
        <Route path="courses/:courseId" element={<CourseDetailPage />} />
        <Route path="courses/:courseId/lessons/:lessonId" element={<LessonPlayerPage />} />
        <Route path="users" element={<RoleRoute allowedRoles={['owner', 'admin']}><UserListPage /></RoleRoute>} />
        <Route path="programmes" element={<RoleRoute allowedRoles={['owner', 'admin']}><ProgrammeListPage /></RoleRoute>} />
        <Route path="assignments" element={<AssignmentListPage />} />
        <Route path="assignments/:assignmentId" element={<AssignmentDetailPage />} />
        <Route path="essays" element={<EssayListPage />} />
        <Route path="essays/new" element={<RoleRoute allowedRoles={['owner', 'admin', 'instructor']}><EssayCreatePage /></RoleRoute>} />
        <Route path="essays/:questionId" element={<RoleRoute allowedRoles={['student']}><EssayWorkspacePage /></RoleRoute>} />
        <Route path="essays/responses/:responseId" element={<RoleRoute allowedRoles={['owner', 'admin', 'instructor']}><EssayGradingPage /></RoleRoute>} />
        <Route path="canvas" element={<CanvasPage />} />
        <Route path="gradebook" element={<GradebookPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="activities/:activityId/play" element={<ActivityPlayerPage />} />
        <Route path="content" element={<RoleRoute allowedRoles={['admin', 'instructor']}><ContentLibraryPage /></RoleRoute>} />
        <Route path="finance" element={<RoleRoute allowedRoles={['owner', 'treasurer']}><FinancePage /></RoleRoute>} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit" element={<RoleRoute allowedRoles={['owner', 'admin']}><AuditLogPage /></RoleRoute>} />
        <Route path="certificates" element={<CertificatePage />} />
        <Route path="settings" element={<RoleRoute allowedRoles={['owner', 'admin']}><SettingsPage /></RoleRoute>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="privacy" element={<PrivacyNoticePage />} />
        <Route path="consent" element={<ConsentManagementPage />} />

        {/* Error routes */}
        <Route path="access-denied" element={<AccessDenied />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}


