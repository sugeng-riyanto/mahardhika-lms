import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, BookOpen, BarChart3, Users, ChevronRight, AlertCircle, Shield } from 'lucide-react'
import { useParentChildren, useChildGrades, useChildCourses } from '@/api/hooks'
import type { ParentChildLink, ChildGrade, ChildCourse } from '@/api/hooks'

function ChildSelector({
  links,
  selectedId,
  onSelect,
}: {
  links: ParentChildLink[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (links.length <= 1) return null
  return (
    <div className="flex gap-2 mb-6">
      {links.map((link) => (
        <button
          key={link.student_user}
          onClick={() => onSelect(link.student_user)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedId === link.student_user
              ? 'bg-cyan-600 text-white'
              : 'bg-navy-800 text-navy-300 hover:bg-navy-700 border border-navy-700'
          }`}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            selectedId === link.student_user ? 'bg-cyan-500' : 'bg-navy-600'
          }`}>
            {link.student_email?.charAt(0).toUpperCase() || '?'}
          </div>
          {link.student_email?.split('@')[0] || 'Child'}
        </button>
      ))}
    </div>
  )
}

function ChildStatsCard({
  link,
  grades,
  courses,
}: {
  link: ParentChildLink
  grades: ChildGrade[]
  courses: ChildCourse[]
}) {
  const releasedGrades = grades.filter(g => g.released)
  const avgGrade = releasedGrades.length > 0
    ? Math.round(
        releasedGrades.reduce((sum, g) => sum + (parseFloat(g.score) / parseFloat(g.max_score)) * 100, 0)
        / releasedGrades.length
      )
    : 0
  const letterGrade = avgGrade >= 90 ? 'A' : avgGrade >= 80 ? 'A-' : avgGrade >= 70 ? 'B+' : avgGrade >= 60 ? 'B' : 'C'

  return (
    <div className="card mb-8">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0">
          {link.student_email?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-white">{link.student_email?.split('@')[0] || 'Student'}</h2>
          <p className="text-navy-400 text-sm">{link.student_email}</p>
          <div className="flex items-center gap-2 mt-1">
            {link.is_verified ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-400">
                <Shield size={10} /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                <AlertCircle size={10} /> Pending verification
              </span>
            )}
            <span className="text-navy-600">|</span>
            {link.consent_given ? (
              <span className="text-xs text-green-400">Consent granted</span>
            ) : (
              <span className="text-xs text-yellow-400">Consent pending</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-navy-700">
        <div>
          <p className="text-2xl font-bold text-white">{courses.length}</p>
          <p className="text-sm text-navy-400">Active Courses</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{releasedGrades.length}</p>
          <p className="text-sm text-navy-400">Graded Activities</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">{avgGrade}%</p>
          <p className="text-sm text-navy-400">Average Grade</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{letterGrade}</p>
          <p className="text-sm text-navy-400">Overall Letter</p>
        </div>
      </div>
    </div>
  )
}

function GradesPanel({ grades }: { grades: ChildGrade[] }) {
  const releasedGrades = grades.filter(g => g.released)

  if (releasedGrades.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Released Grades</h2>
        <div className="text-center py-8">
          <BarChart3 className="mx-auto text-navy-600 mb-3" size={32} />
          <p className="text-navy-400 text-sm">No grades have been released yet.</p>
          <p className="text-navy-500 text-xs mt-1">Only released grades are visible to parents.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">
        Released Grades
        <span className="ml-2 text-sm text-navy-400 font-normal">({releasedGrades.length})</span>
      </h2>
      <div className="space-y-3">
        {releasedGrades.map((grade) => {
          const pct = Math.round((parseFloat(grade.score) / parseFloat(grade.max_score)) * 100)
          const letter = pct >= 90 ? 'A' : pct >= 80 ? 'A-' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D'
          const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          return (
            <div key={grade.id} className="py-3 border-b border-navy-700 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-navy-200">Activity {grade.activity.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{grade.score}/{grade.max_score}</span>
                  <span className={`badge text-xs ${
                    pct >= 80 ? 'badge-success' : pct >= 60 ? 'badge-warning' : 'badge-danger'
                  }`}>{letter}</span>
                </div>
              </div>
              <div className="w-full bg-navy-800 rounded-full h-1.5">
                <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              {grade.released_at && (
                <p className="text-[10px] text-navy-500 mt-1">
                  Released {new Date(grade.released_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CoursesPanel({ courses }: { courses: ChildCourse[] }) {
  if (courses.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Enrolled Courses</h2>
        <div className="text-center py-8">
          <BookOpen className="mx-auto text-navy-600 mb-3" size={32} />
          <p className="text-navy-400 text-sm">No active courses found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">
        Enrolled Courses
        <span className="ml-2 text-sm text-navy-400 font-normal">({courses.length})</span>
      </h2>
      <div className="space-y-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-navy-800 transition-colors group border border-transparent hover:border-navy-700"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white group-hover:text-cyan-400 truncate">{course.title}</p>
              <p className="text-xs text-navy-500 mt-0.5">{course.programme_name}</p>
            </div>
            <ChevronRight size={14} className="text-navy-500 group-hover:text-cyan-400 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function ConsentStatus({ links }: { links: ParentChildLink[] }) {
  const pendingVerification = links.filter(l => !l.is_verified)
  const pendingConsent = links.filter(l => !l.consent_given)

  if (pendingVerification.length === 0 && pendingConsent.length === 0) {
    return null
  }

  return (
    <div className="card border-yellow-600/30 bg-yellow-900/10 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-yellow-400 shrink-0 mt-0.5" size={18} />
        <div>
          <h3 className="text-sm font-medium text-yellow-400">Action Required</h3>
          <ul className="text-xs text-yellow-300/80 mt-1 space-y-1">
            {pendingVerification.length > 0 && (
              <li>{pendingVerification.length} child link(s) pending verification by school admin.</li>
            )}
            {pendingConsent.length > 0 && (
              <li>{pendingConsent.length} link(s) pending data processing consent.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function ParentDashboard() {
  const { data: links = [], isLoading: linksLoading } = useParentChildren()
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)

  // Auto-select first child if only one
  const activeChildId = selectedChildId || links[0]?.student_user || null

  const { data: grades = [], isLoading: gradesLoading } = useChildGrades(activeChildId || '')
  const { data: coursesMap, isLoading: coursesLoading } = useChildCourses(
    links.map(l => l.student_user)
  )

  const activeCourses = coursesMap?.get(activeChildId || '') || []
  const activeLink = links.find(l => l.student_user === activeChildId)

  if (linksLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center gap-3 mb-6">
          <Heart className="text-orange-400" size={24} />
          <h1 className="page-title mb-0">Parent Dashboard</h1>
        </div>
        <div className="card p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading your children's data...</p>
        </div>
      </div>
    )
  }

  if (links.length === 0) {
    return (
      <div className="page-container">
        <div className="flex items-center gap-3 mb-6">
          <Heart className="text-orange-400" size={24} />
          <h1 className="page-title mb-0">Parent Dashboard</h1>
        </div>
        <div className="card p-12 text-center">
          <Users className="mx-auto text-navy-600 mb-4" size={40} />
          <p className="text-navy-400 mb-2">No linked children found.</p>
          <p className="text-navy-500 text-sm">
            Contact the school administrator to link your account to your child's profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="text-orange-400" size={24} />
        <h1 className="page-title mb-0">Parent Dashboard</h1>
      </div>

      <p className="page-subtitle">
        {links.length === 1
          ? `Overview of ${activeLink?.student_email?.split('@')[0] || "your child"}'s progress`
          : `Overview of your ${links.length} linked children's progress`
        }
      </p>

      <ChildSelector links={links} selectedId={activeChildId} onSelect={setSelectedChildId} />

      <ConsentStatus links={links} />

      {activeLink && (
        <ChildStatsCard
          link={activeLink}
          grades={grades}
          courses={activeCourses}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {gradesLoading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-navy-400 text-sm">Loading grades...</p>
          </div>
        ) : (
          <GradesPanel grades={grades} />
        )}

        {coursesLoading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-navy-400 text-sm">Loading courses...</p>
          </div>
        ) : (
          <CoursesPanel courses={activeCourses} />
        )}
      </div>

      {/* Information notice */}
      <div className="mt-8 p-4 bg-navy-800/30 rounded-lg border border-navy-700">
        <p className="text-xs text-navy-500 text-center">
          Only released grades and verified information are displayed. For additional details, please contact the school administration.
          Data access follows the consent and verification model as per UU PDP requirements.
        </p>
      </div>
    </div>
  )
}
