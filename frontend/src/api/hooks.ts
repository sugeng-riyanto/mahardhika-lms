/**
 * Shared API hooks for fetching data from the Django backend.
 *
 * Each hook:
 * 1. Tries the real API first
 * 2. Falls back to mock data if API is unavailable or user is not authenticated
 * 3. Uses TanStack Query for caching, refetching, and error handling
 */
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Course, Lesson, Programme, User, RoleAssignment, UserRole } from '@/types'

// ================================================
// Mock data (fallback when API is unavailable)
// ================================================

const MOCK_PROGRAMMES: Programme[] = [
  { id: 'p1', organisation_id: 'org1', name: 'JHS Mathematics', slug: 'jhs-math', description: 'Mathematics curriculum for Grades 5-8.', level: 'jhs', is_active: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'p2', organisation_id: 'org1', name: 'SHS Physics', slug: 'shs-physics', description: 'Physics curriculum for Grades 9-12.', level: 'shs', is_active: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'p3', organisation_id: 'org1', name: 'IELTS Preparation', slug: 'ielts-prep', description: 'IELTS preparation programme.', level: 'ielts', is_active: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'p4', organisation_id: 'org1', name: 'STEAM & Robotics', slug: 'steam-robotics', description: 'Hands-on STEAM education.', level: 'steam', is_active: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
]

const MOCK_COURSES: Course[] = [
  { id: 'c1', programme_id: 'p1', organisation_id: 'org1', title: 'Mathematics 7A', slug: 'math-7a', description: 'Algebra, geometry, and number theory.', instructor_id: null, is_published: true, thumbnail_url: null, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'c2', programme_id: 'p1', organisation_id: 'org1', title: 'Mathematics 7B', slug: 'math-7b', description: 'Statistics, probability, and transformations.', instructor_id: null, is_published: true, thumbnail_url: null, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'c3', programme_id: 'p2', organisation_id: 'org1', title: 'Physics 10 Mechanics', slug: 'phys-10', description: 'Kinematics, dynamics, and energy.', instructor_id: null, is_published: true, thumbnail_url: null, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
]

const MOCK_USERS: User[] = [
  { id: '1', email: 'owner@mahardhika.id', full_name: 'Owner Mahardhika', avatar_url: null, is_active: true, mfa_enabled: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: '2', email: 'admin@mahardhika.id', full_name: 'Admin Mahardhika', avatar_url: null, is_active: true, mfa_enabled: false, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: '3', email: 'instructor@mahardhika.id', full_name: 'Instructor Mahardhika', avatar_url: null, is_active: true, mfa_enabled: false, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: '4', email: 'student@mahardhika.id', full_name: 'Student Mahardhika', avatar_url: null, is_active: true, mfa_enabled: false, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
]

// ================================================
// Role assignment response from /api/v1/auth/me/
// ================================================

// ================================================
// Extended types with metadata
// ================================================

export interface CourseWithMeta extends Course {
  programme_name: string
  programme_level: string
  lesson_count: number
  student_count: number
  instructor_email: string | null
}

export interface UserWithRoles extends User {
  roles: UserRole[]
  role_display: string
}

export interface ProgrammeWithMeta extends Programme {
  course_count: number
}

// ================================================
// API fetch functions
// ================================================

async function fetchCourses(): Promise<CourseWithMeta[]> {
  try {
    const [coursesRes, programmesRes] = await Promise.all([
      apiClient.list<Course>('/courses/'),
      apiClient.list<Programme>('/programmes/'),
    ])

    const programmeMap = new Map(programmesRes.results.map(p => [p.id, p]))

    return coursesRes.results.map(c => {
      const prog = programmeMap.get(c.programme_id)
      return {
        ...c,
        programme_name: prog?.name || 'Unknown',
        programme_level: prog?.level || 'jhs',
        lesson_count: 0,
        student_count: 0,
        instructor_email: null,
      }
    })
  } catch {
    return MOCK_COURSES.map(c => ({
      ...c,
      programme_name: MOCK_PROGRAMMES.find(p => p.id === c.programme_id)?.name || '',
      programme_level: MOCK_PROGRAMMES.find(p => p.id === c.programme_id)?.level || '',
      lesson_count: 0,
      student_count: 0,
      instructor_email: null,
    }))
  }
}

async function fetchUsers(): Promise<UserWithRoles[]> {
  try {
    const [usersRes, rolesRes] = await Promise.all([
      apiClient.list<User>('/users/'),
      apiClient.get<{ results: RoleAssignment[] }>('/role-assignments/').catch(() => ({ results: [] })),
    ])

    // Build a map of user_id -> roles from role assignments
    const userRoles = new Map<string, UserRole[]>()
    const roleNames = new Map<string, string>()

    // First, get role definitions
    try {
      const roles = await apiClient.get<{ results: Array<{ id: string; name: UserRole; display_name: string }> }>('/roles/')
      for (const r of roles.results) {
        roleNames.set(r.id, r.name)
      }
    } catch {
      // Use role_name from assignments
    }

    for (const ra of rolesRes.results) {
      if (ra.status !== 'active') continue
      const roleName = roleNames.get(String(ra.role)) || (ra as unknown as { role_name?: string }).role_name || ''
      if (!roleName) continue
      const userId = (ra as unknown as { user?: string }).user || (ra as unknown as { user_id?: string }).user_id || ''
      if (!userId) continue
      const existing = userRoles.get(userId) || []
      if (!existing.includes(roleName as UserRole)) {
        existing.push(roleName as UserRole)
      }
      userRoles.set(userId, existing)
    }

    return usersRes.results.map(u => ({
      ...u,
      roles: userRoles.get(u.id) || [],
      role_display: (userRoles.get(u.id) || []).join(', ') || 'No Role',
    }))
  } catch {
    return MOCK_USERS.map(u => ({
      ...u,
      roles: [] as UserRole[],
      role_display: 'No Role',
    }))
  }
}

async function fetchProgrammes(): Promise<ProgrammeWithMeta[]> {
  try {
    const data = await apiClient.list<Programme>('/programmes/')
    return data.results.map(p => ({
      ...p,
      course_count: 0,
    }))
  } catch {
    return MOCK_PROGRAMMES.map(p => ({
      ...p,
      course_count: 0,
    }))
  }
}

// ================================================
// React Query hooks
// ================================================

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
    staleTime: 30_000,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 30_000,
  })
}

export function useProgrammes() {
  return useQuery({
    queryKey: ['programmes'],
    queryFn: fetchProgrammes,
    staleTime: 30_000,
  })
}

// ================================================
// Lesson hooks
// ================================================

const MOCK_LESSONS: Lesson[] = [
  { id: 'l1', course_id: 'c1', title: 'Algebraic Expressions', description: 'Introduction to variables, terms, and simplifying expressions.', order: 1, content_type: 'text', content_data: { body: 'An algebraic expression is a mathematical phrase that can contain ordinary numbers, variables (like x or y), and operators (like add, subtract, multiply, and divide). For example: 3x + 2y - 5. In this lesson, we will learn how to identify variables, constants, coefficients, and how to simplify expressions by combining like terms.' }, is_published: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'l2', course_id: 'c1', title: 'Linear Equations', description: 'Solving one-step and two-step linear equations.', order: 2, content_type: 'text', content_data: { body: 'A linear equation is an equation of the form ax + b = c, where a, b, and c are constants. To solve a linear equation, we isolate the variable on one side. One-step equations: x + 5 = 12, so x = 7. Two-step equations: 2x + 3 = 11, so 2x = 8, so x = 4.' }, is_published: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'l3', course_id: 'c1', title: 'Coordinate Geometry', description: 'Plotting points, lines, and finding gradients.', order: 3, content_type: 'text', content_data: { body: 'The coordinate plane has two axes: the x-axis (horizontal) and the y-axis (vertical). A point is written as (x, y). To plot a point, move x units along the x-axis and y units along the y-axis. The gradient (slope) of a line through two points (x1,y1) and (x2,y2) is: m = (y2 - y1) / (x2 - x1).' }, is_published: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
  { id: 'l4', course_id: 'c1', title: 'Inequalities', description: 'Understanding and solving inequalities on the number line.', order: 4, content_type: 'text', content_data: { body: 'An inequality compares two expressions using <, >, <=, or >=. To solve inequalities, follow the same steps as equations, but flip the inequality sign when multiplying or dividing by a negative number. For example: -2x > 6, so x < -3.' }, is_published: true, created_at: '2026-08-21T00:00:00Z', updated_at: '2026-08-21T00:00:00Z' },
]

async function fetchLessons(courseId: string): Promise<Lesson[]> {
  try {
    const data = await apiClient.list<Lesson>('/lessons/', { course: courseId })
    return data.results
  } catch {
    return MOCK_LESSONS.filter(l => l.course_id === courseId)
  }
}

async function fetchLesson(lessonId: string): Promise<Lesson | null> {
  try {
    return await apiClient.get<Lesson>(`/lessons/${lessonId}/`)
  } catch {
    return MOCK_LESSONS.find(l => l.id === lessonId) || null
  }
}

export function useLessons(courseId: string) {
  return useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => fetchLessons(courseId),
    staleTime: 30_000,
    enabled: !!courseId,
  })
}

export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchLesson(lessonId),
    staleTime: 30_000,
    enabled: !!lessonId,
  })
}

// ================================================
// Parent Dashboard hooks
// ================================================

export interface ParentChildLink {
  id: string
  parent_user: string
  parent_email: string
  student_user: string
  student_email: string
  relationship_type: string
  is_verified: boolean
  is_active: boolean
  consent_given: boolean
  consent_date: string | null
}

export interface ChildGrade {
  id: string
  student: string
  student_email: string
  activity: string
  score: string
  max_score: string
  released: boolean
  released_at: string | null
  created_at: string
}

export interface ChildCourse {
  id: string
  title: string
  slug: string
  programme_name: string
  programme_level: string
  description: string
  is_published: boolean
}

interface ParentChildLinkResponse {
  results: ParentChildLink[]
}

async function fetchParentChildren(): Promise<ParentChildLink[]> {
  try {
    const data = await apiClient.get<ParentChildLinkResponse>('/parent-child-links/')
    return Array.isArray(data) ? data : data.results || []
  } catch {
    return []
  }
}

async function fetchChildGrades(childId: string): Promise<ChildGrade[]> {
  try {
    const data = await apiClient.get<{ results: ChildGrade[] }>('/grades/', { student: childId })
    return data.results || []
  } catch {
    return []
  }
}

async function fetchChildCourses(childIds: string[]): Promise<Map<string, ChildCourse[]>> {
  if (childIds.length === 0) return new Map()
  try {
    const [coursesRes, programmesRes] = await Promise.all([
      apiClient.list<Course>('/courses/'),
      apiClient.list<Programme>('/programmes/'),
    ])
    const programmeMap = new Map(programmesRes.results.map(p => [p.id, p]))
    // The backend already filters by child's enrolments for parents
    const coursesByChild = new Map<string, ChildCourse[]>()
    const mapped = coursesRes.results.map(c => {
      const progId = (c as unknown as { programme?: string }).programme || c.programme_id || ''
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        programme_name: programmeMap.get(progId)?.name || 'Unknown',
        programme_level: programmeMap.get(progId)?.level || '',
        description: c.description || '',
        is_published: c.is_published,
      }
    })
    // Parent sees child-enrolled courses, assign to all children
    for (const cid of childIds) {
      coursesByChild.set(cid, mapped)
    }
    return coursesByChild
  } catch {
    return new Map()
  }
}

export function useParentChildren() {
  return useQuery({
    queryKey: ['parentChildren'],
    queryFn: fetchParentChildren,
    staleTime: 60_000,
  })
}

export function useChildGrades(childId: string) {
  return useQuery({
    queryKey: ['childGrades', childId],
    queryFn: () => fetchChildGrades(childId),
    staleTime: 30_000,
    enabled: !!childId,
  })
}

export function useChildCourses(childIds: string[]) {
  return useQuery({
    queryKey: ['childCourses', childIds],
    queryFn: () => fetchChildCourses(childIds),
    staleTime: 30_000,
    enabled: childIds.length > 0,
  })
}

// ================================================
// Gradebook hooks
// ================================================

export interface GradeEntry {
  id: string
  student: string
  student_email: string
  student_name: string
  activity: string
  activity_title: string
  activity_type: string
  score: string
  max_score: string
  percentage: number
  released: boolean
  released_at: string | null
  created_at: string
  updated_at: string
}

async function fetchGrades(): Promise<GradeEntry[]> {
  try {
    const data = await apiClient.get<{ results: GradeEntry[] }>('/grades/')
    return data.results || []
  } catch {
    return []
  }
}

export function useGrades() {
  return useQuery({
    queryKey: ['grades'],
    queryFn: fetchGrades,
    staleTime: 30_000,
  })
}

// ================================================
// Essay Assessment hooks
// ================================================

import type {
  EssayQuestion, EssayResponse, RubricCriterion,
  InlineFeedback,
} from '@/types'

async function fetchEssayQuestions(): Promise<EssayQuestion[]> {
  try {
    const data = await apiClient.get<{ results: EssayQuestion[] }>('/essays/questions/')
    return data.results || []
  } catch {
    return []
  }
}

export function useEssayQuestions() {
  return useQuery({
    queryKey: ['essayQuestions'],
    queryFn: fetchEssayQuestions,
    staleTime: 30_000,
  })
}

async function fetchEssayQuestion(id: string): Promise<EssayQuestion | null> {
  try {
    return await apiClient.get<EssayQuestion>(`/essays/questions/${id}/`)
  } catch {
    return null
  }
}

export function useEssayQuestion(id: string) {
  return useQuery({
    queryKey: ['essayQuestion', id],
    queryFn: () => fetchEssayQuestion(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

async function fetchEssayResponses(questionId?: string): Promise<EssayResponse[]> {
  try {
    const url = questionId ? `/essays/responses/?question=${questionId}` : '/essays/responses/'
    const data = await apiClient.get<{ results: EssayResponse[] }>(url)
    return data.results || []
  } catch {
    return []
  }
}

export function useEssayResponses(questionId?: string) {
  return useQuery({
    queryKey: ['essayResponses', questionId],
    queryFn: () => fetchEssayResponses(questionId),
    staleTime: 30_000,
    enabled: true,
  })
}

async function fetchEssayResponse(id: string): Promise<EssayResponse | null> {
  try {
    return await apiClient.get<EssayResponse>(`/essays/responses/${id}/`)
  } catch {
    return null
  }
}

export function useEssayResponse(id: string) {
  return useQuery({
    queryKey: ['essayResponse', id],
    queryFn: () => fetchEssayResponse(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

async function fetchRubricCriteria(questionId: string): Promise<RubricCriterion[]> {
  try {
    const data = await apiClient.get<{ results: RubricCriterion[] }>(
      `/essays/criteria/?question=${questionId}`
    )
    return data.results || []
  } catch {
    return []
  }
}

export function useRubricCriteria(questionId: string) {
  return useQuery({
    queryKey: ['rubricCriteria', questionId],
    queryFn: () => fetchRubricCriteria(questionId),
    staleTime: 30_000,
    enabled: !!questionId,
  })
}

async function fetchInlineFeedbacks(responseId: string): Promise<InlineFeedback[]> {
  try {
    const data = await apiClient.get<{ results: InlineFeedback[] }>(
      `/essays/feedback/?response=${responseId}`
    )
    return data.results || []
  } catch {
    return []
  }
}

export function useInlineFeedbacks(responseId: string) {
  return useQuery({
    queryKey: ['inlineFeedbacks', responseId],
    queryFn: () => fetchInlineFeedbacks(responseId),
    staleTime: 30_000,
    enabled: !!responseId,
  })
}

// ================================================
// Attendance hooks
// ================================================

import type { LessonSchedule, AttendanceRecord, AttendanceSummary } from '@/types'

async function fetchSchedules(): Promise<LessonSchedule[]> {
  try {
    const data = await apiClient.get<{ results: LessonSchedule[] }>('/attendance/schedules/')
    return data.results || []
  } catch {
    return []
  }
}

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
    staleTime: 30_000,
  })
}

async function fetchAttendanceRecords(): Promise<AttendanceRecord[]> {
  try {
    const data = await apiClient.get<{ results: AttendanceRecord[] }>('/attendance/records/')
    return data.results || []
  } catch {
    return []
  }
}

export function useAttendanceRecords() {
  return useQuery({
    queryKey: ['attendanceRecords'],
    queryFn: fetchAttendanceRecords,
    staleTime: 30_000,
  })
}

async function fetchAttendanceSummary(): Promise<AttendanceSummary> {
  try {
    return await apiClient.get<AttendanceSummary>('/attendance/records/summary/')
  } catch {
    return { total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: 0 }
  }
}

export function useAttendanceSummary() {
  return useQuery({
    queryKey: ['attendanceSummary'],
    queryFn: fetchAttendanceSummary,
    staleTime: 30_000,
  })
}

// ================================================
// Sponsorship hooks
// ================================================

export interface SponsorshipProgramme {
  id: string
  organisation: string
  organisation_name: string
  sponsor_user: string
  name: string
  fund_amount: number
  fund_utilised: number
  is_active: boolean
  total_students: number
  total_courses: number
  completion_rate: number
  average_grade: number
  fund_percentage: number
  created_at: string
  updated_at: string
}

export interface SponsorAggregate {
  programme_count: number
  total_students: number
  total_courses: number
  total_fund: number
  total_utilised: number
  fund_percentage: number
  consent_summary: Record<string, number>
}

async function fetchSponsorshipProgrammes(): Promise<SponsorshipProgramme[]> {
  try {
    const data = await apiClient.get<{ results: SponsorshipProgramme[] }>('/sponsorship-programmes/')
    return data.results || []
  } catch {
    return []
  }
}

export function useSponsorshipProgrammes() {
  return useQuery({
    queryKey: ['sponsorshipProgrammes'],
    queryFn: fetchSponsorshipProgrammes,
    staleTime: 30_000,
  })
}

async function fetchSponsorAggregate(): Promise<SponsorAggregate> {
  try {
    return await apiClient.get<SponsorAggregate>('/sponsorship-programmes/aggregate/')
  } catch {
    return { programme_count: 0, total_students: 0, total_courses: 0, total_fund: 0, total_utilised: 0, fund_percentage: 0, consent_summary: {} }
  }
}

export function useSponsorAggregate() {
  return useQuery({
    queryKey: ['sponsorAggregate'],
    queryFn: fetchSponsorAggregate,
    staleTime: 30_000,
  })
}

// ================================================
// Activity / Attempt hooks
// ================================================

import type { ActivityDefinition, Attempt, AttemptResponse, Assignment, AssignmentSubmission } from '@/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchActivities(lessonId?: string): Promise<ActivityDefinition[]> {
  try {
    const url = lessonId ? `/activities/definitions/?lesson=${lessonId}` : '/activities/definitions/'
    const data = await apiClient.get<{ results: ActivityDefinition[] }>(url)
    return data.results || []
  } catch {
    return []
  }
}

export function useActivities(lessonId?: string) {
  return useQuery({
    queryKey: ['activities', lessonId],
    queryFn: () => fetchActivities(lessonId),
    staleTime: 30_000,
    enabled: true,
  })
}

async function fetchActivity(id: string): Promise<ActivityDefinition | null> {
  try {
    return await apiClient.get<ActivityDefinition>(`/activities/definitions/${id}/`)
  } catch {
    return null
  }
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: () => fetchActivity(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

async function fetchActivityQuestions(activityId: string): Promise<import('@/types').ActivityQuestion[]> {
  try {
    const data = await apiClient.get<{ results: import('@/types').ActivityQuestion[] }>(`/activities/definitions/${activityId}/questions/`)
    return Array.isArray(data) ? (data as unknown as import('@/types').ActivityQuestion[]) : data.results || []
  } catch {
    return []
  }
}

export function useActivityQuestions(activityId: string) {
  return useQuery({
    queryKey: ['activityQuestions', activityId],
    queryFn: () => fetchActivityQuestions(activityId),
    staleTime: 30_000,
    enabled: !!activityId,
  })
}

async function fetchAttempts(activityId?: string): Promise<Attempt[]> {
  try {
    const url = activityId ? `/attempts/?activity=${activityId}` : '/attempts/'
    const data = await apiClient.get<{ results: Attempt[] }>(url)
    return data.results || []
  } catch {
    return []
  }
}

export function useAttempts(activityId?: string) {
  return useQuery({
    queryKey: ['attempts', activityId],
    queryFn: () => fetchAttempts(activityId),
    staleTime: 30_000,
  })
}

async function fetchAttempt(id: string): Promise<Attempt | null> {
  try {
    return await apiClient.get<Attempt>(`/attempts/${id}/`)
  } catch {
    return null
  }
}

export function useAttempt(id: string) {
  return useQuery({
    queryKey: ['attempt', id],
    queryFn: () => fetchAttempt(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

export function useCreateAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { activity: string }) =>
      apiClient.post<Attempt>('/attempts/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attempts'] }) },
  })
}

export function useSubmitAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attemptId: string) =>
      apiClient.post<Attempt>(`/attempts/${attemptId}/submit/`, {}),
    onSuccess: (_data, attemptId) => {
      qc.invalidateQueries({ queryKey: ['attempts'] })
      qc.invalidateQueries({ queryKey: ['attempt', attemptId] })
    },
  })
}

export function useCreateResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { attempt: string; question: string; answer_data: Record<string, unknown> }) =>
      apiClient.post<AttemptResponse>('/attempts/responses/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attempts'] }) },
  })
}

export function useSavePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ attemptId, path, score, maxScore, outcome }: {
      attemptId: string
      path: Array<{ node_id: string; choice_id?: string; timestamp: string }>
      score: number
      maxScore: number
      outcome: string
    }) => apiClient.post<Attempt>(`/attempts/${attemptId}/save-path/`, {
      path, score, max_score: maxScore, outcome,
    }),
    onSuccess: (_data, { attemptId }) => {
      qc.invalidateQueries({ queryKey: ['attempts'] })
      qc.invalidateQueries({ queryKey: ['attempt', attemptId] })
    },
  })
}

// --- Assignments ---

import type { PaginatedResponse } from '@/types'

async function fetchAssignments(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await apiClient.get<PaginatedResponse<Assignment>>(`/assignments/${qs}`)
  return res.results
}

async function fetchAssignment(id: string) {
  return apiClient.get<Assignment>(`/assignments/${id}/`)
}

async function fetchAssignmentSubmissions(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await apiClient.get<PaginatedResponse<AssignmentSubmission>>(`/assignments/submissions/${qs}`)
  return res.results
}

async function fetchAssignmentSubmission(id: string) {
  return apiClient.get<AssignmentSubmission>(`/assignments/submissions/${id}/`)
}

export function useAssignments(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['assignments', params],
    queryFn: () => fetchAssignments(params),
    staleTime: 30_000,
  })
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: ['assignment', id],
    queryFn: () => fetchAssignment(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

export function useAssignmentSubmissions(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['assignmentSubmissions', params],
    queryFn: () => fetchAssignmentSubmissions(params),
    staleTime: 30_000,
  })
}

export function useAssignmentSubmission(id: string) {
  return useQuery({
    queryKey: ['assignmentSubmission', id],
    queryFn: () => fetchAssignmentSubmission(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Assignment>) =>
      apiClient.post<Assignment>('/assignments/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }) },
  })
}

export function useSubmitAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (submissionId: string) =>
      apiClient.post<AssignmentSubmission>(`/assignments/submissions/${submissionId}/submit/`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignmentSubmissions'] }) },
  })
}

export function useGradeSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, score, feedback }: { id: string; score: number; feedback: string }) =>
      apiClient.post<AssignmentSubmission>(`/assignments/submissions/${id}/grade/`, { score, feedback }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignmentSubmissions'] }) },
  })
}

// --- Finance ---

interface FinanceSummary {
  total_amount: number
  paid_amount: number
  pending_amount: number
  overdue_amount: number
  draft_amount: number
  total_invoices: number
  status_counts: Record<string, number>
  recent_invoices: Invoice[]
}

export interface Invoice {
  id: string
  invoice_number: string
  user: string
  user_email: string
  user_name: string
  amount: string
  currency: string
  status: string
  due_date: string | null
  paid_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ['financeSummary'],
    queryFn: async () => {
      try {
        return await apiClient.get<FinanceSummary>('/finance/summary/')
      } catch {
        return null
      }
    },
    staleTime: 30_000,
  })
}

// --- Invoice CRUD ---

async function fetchInvoices(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await apiClient.get<PaginatedResponse<Invoice>>(`/finance/invoices/${qs}`)
  return res.results
}

async function fetchInvoice(id: string) {
  return apiClient.get<Invoice>(`/finance/invoices/${id}/`)
}

export function useInvoices(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => fetchInvoices(params),
    staleTime: 30_000,
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Invoice>) =>
      apiClient.post<Invoice>('/finance/invoices/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['financeSummary'] })
    },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Invoice> }) =>
      apiClient.patch<Invoice>(`/finance/invoices/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['financeSummary'] })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/finance/invoices/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['financeSummary'] })
    },
  })
}

export function useSendInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Invoice>(`/finance/invoices/${id}/send/`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['financeSummary'] })
    },
  })
}

export function useMarkPaidInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Invoice>(`/finance/invoices/${id}/mark_paid/`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['financeSummary'] })
    },
  })
}

export function useCancelInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.post<Invoice>(`/finance/invoices/${id}/cancel/`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['financeSummary'] })
    },
  })
}

// --- Notifications ---

export interface Notification {
  id: string
  recipient: string
  recipient_email: string
  channel: string
  title: string
  message: string
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

async function fetchNotifications(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await apiClient.get<PaginatedResponse<Notification>>(`/notifications/${qs}`)
  return res.results
}

async function fetchUnreadCount() {
  const res = await apiClient.get<{ count: number }>('/notifications/unread_count/')
  return res.count
}

export function useNotifications(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => fetchNotifications(params),
    staleTime: 15_000,
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['unreadNotificationCount'],
    queryFn: fetchUnreadCount,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Notification>(`/notifications/${id}/mark_read/`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unreadNotificationCount'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ marked_read: number }>('/notifications/mark_all_read/', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unreadNotificationCount'] })
    },
  })
}

// --- Certificates ---

export interface Certificate {
  id: string
  recipient: string
  recipient_email: string
  recipient_name: string
  course: string | null
  course_title: string | null
  programme: string | null
  programme_name: string | null
  certificate_number: string
  verification_code: string
  title: string
  description: string
  issued_date: string
  completion_date: string | null
  status: 'active' | 'revoked'
  revoked_at: string | null
  revoked_reason: string
  issued_by: string | null
  issued_by_email: string | null
  created_at: string
  updated_at: string
}

async function fetchCertificates(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await apiClient.get<PaginatedResponse<Certificate>>(`/certificates/${qs}`)
  return res.results
}

export function useCertificates(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['certificates', params],
    queryFn: () => fetchCertificates(params),
    staleTime: 30_000,
  })
}

export function useIssueCertificate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Certificate>) =>
      apiClient.post<Certificate>('/certificates/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }) },
  })
}

export function useRevokeCertificate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post<Certificate>(`/certificates/${id}/revoke/`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }) },
  })
}

// ================================================
// Third Party Grants
// ================================================

export interface ThirdPartyGrant {
  id: string
  third_party_user: string
  third_party_email: string
  purpose: string
  scope: string
  is_active: boolean
  expires_at: string | null
  created_at: string
}

async function fetchThirdPartyGrants(): Promise<ThirdPartyGrant[]> {
  try {
    const data = await apiClient.list<ThirdPartyGrant>('/third-party-grants/')
    return data.results
  } catch {
    return []
  }
}

export function useThirdPartyGrants() {
  return useQuery({
    queryKey: ['third-party-grants'],
    queryFn: fetchThirdPartyGrants,
    staleTime: 30_000,
  })
}
