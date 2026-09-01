import { GraduationCap, BookOpen, ClipboardList, BarChart3, Award, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCourses, useAssignments, useGrades } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { t } from '@/i18n/translations'

export function StudentDashboard() {
  const { data: courses = [] } = useCourses()
  const { data: assignments = [] } = useAssignments()
  const { data: grades = [] } = useGrades()
  const { user } = useAuth()

  const enrolledCourses = courses.length
  const pendingAssignments = assignments.filter(a => a.status === 'published').length
  const releasedGrades = grades.filter(g => g.released)
  const avgGrade = releasedGrades.length > 0
    ? Math.round(releasedGrades.reduce((sum, g) => sum + g.percentage, 0) / releasedGrades.length)
    : 0

  const stats = [
    { label: 'Enrolled Courses', value: enrolledCourses, icon: <BookOpen size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
    { label: 'Pending Assignments', value: pendingAssignments, icon: <ClipboardList size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    { label: 'Graded Activities', value: releasedGrades.length, icon: <Award size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Average Grade', value: `${avgGrade}%`, icon: <BarChart3 size={20} />, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  ]

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <GraduationCap className="text-green-400" size={24} />
        <h1 className="page-title mb-0">{t('dash.student.title')}</h1>
      </div>

      <p className="page-subtitle">
        Welcome back, {user?.full_name || 'Student'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-navy-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Courses */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">My Courses</h2>
            <Link to="/courses" className="text-sm text-cyan-400 hover:text-cyan-300">{t('dash.viewAll')}</Link>
          </div>
          <div className="space-y-3">
            {courses.slice(0, 4).map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="flex items-center justify-between py-3 border-b border-navy-700 last:border-0 hover:bg-navy-800/30 rounded-lg px-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BookOpen size={16} className="text-cyan-400" />
                  <div>
                    <p className="text-sm text-white">{course.title}</p>
                    <p className="text-xs text-navy-400">{course.programme_name}</p>
                  </div>
                </div>
                <span className="text-xs text-navy-400">{course.lesson_count} lessons</span>
              </Link>
            ))}
            {courses.length === 0 && (
              <p className="text-sm text-navy-400 text-center py-4">No courses yet</p>
            )}
          </div>
        </div>

        {/* My Grades */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">My Grades</h2>
            <Link to="/gradebook" className="text-sm text-cyan-400 hover:text-cyan-300">View All</Link>
          </div>
          <div className="space-y-3">
            {releasedGrades.slice(0, 4).map((grade) => (
              <div key={grade.id} className="flex items-center justify-between py-3 border-b border-navy-700 last:border-0">
                <div className="flex items-center gap-3">
                  <Award size={16} className={grade.percentage >= 80 ? 'text-green-400' : grade.percentage >= 60 ? 'text-yellow-400' : 'text-red-400'} />
                  <div>
                    <p className="text-sm text-white">{grade.activity_title}</p>
                    <p className="text-xs text-navy-400">{grade.activity_type?.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className={`text-sm font-mono font-bold ${grade.percentage >= 80 ? 'text-green-400' : grade.percentage >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {grade.score}/{grade.max_score}
                </span>
              </div>
            ))}
            {releasedGrades.length === 0 && (
              <p className="text-sm text-navy-400 text-center py-4">No grades released yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/assignments" className="card hover:border-cyan-500/30 transition-colors flex items-center gap-3">
          <ClipboardList size={20} className="text-yellow-400" />
          <div>
            <p className="text-sm font-medium text-white">Assignments</p>
            <p className="text-xs text-navy-400">Submit work & view feedback</p>
          </div>
        </Link>
        <Link to="/essays" className="card hover:border-cyan-500/30 transition-colors flex items-center gap-3">
          <Send size={20} className="text-purple-400" />
          <div>
            <p className="text-sm font-medium text-white">Essay Assessment</p>
            <p className="text-xs text-navy-400">Write & submit essays</p>
          </div>
        </Link>
        <Link to="/activities" className="card hover:border-cyan-500/30 transition-colors flex items-center gap-3">
          <Award size={20} className="text-green-400" />
          <div>
            <p className="text-sm font-medium text-white">Activities</p>
            <p className="text-xs text-navy-400">Take quizzes & exercises</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
