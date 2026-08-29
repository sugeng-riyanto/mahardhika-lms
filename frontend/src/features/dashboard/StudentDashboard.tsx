import { GraduationCap, BookOpen, ClipboardList, BarChart3, Award, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { t } from '@/i18n/translations'

const stats = [
  { label: 'Enrolled Courses', value: '4', icon: <BookOpen size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
  { label: 'Pending Assignments', value: '3', icon: <ClipboardList size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  { label: 'Completed Activities', value: '24', icon: <Award size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
  { label: 'Average Grade', value: '85%', icon: <BarChart3 size={20} />, color: 'text-purple-400', bg: 'bg-purple-900/30' },
]

const upcomingAssignments = [
  { title: 'Essay: Thermodynamics', course: 'Physics 101', due: 'Tomorrow', urgent: true },
  { title: 'Quiz: Quadratic Equations', course: 'Mathematics', due: 'In 3 days', urgent: false },
  { title: 'Canvas: Free Body Diagram', course: 'Physics 101', due: 'In 5 days', urgent: false },
]

export function StudentDashboard() {
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <GraduationCap className="text-green-400" size={24} />
        <h1 className="page-title mb-0">{t('dash.student.title')}</h1>
      </div>

      <p className="page-subtitle">{t('dash.student.subtitle')}</p>

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
        {/* Upcoming assignments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t('dash.upcomingAssignments')}</h2>
            <Link to="/assignments" className="text-sm text-cyan-400 hover:text-cyan-300">{t('dash.viewAll')}</Link>
          </div>
          <div className="space-y-3">
            {upcomingAssignments.map((assignment, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-navy-700 last:border-0">
                <div className="flex items-center gap-3">
                  <Clock size={16} className={assignment.urgent ? 'text-red-400' : 'text-navy-400'} />
                  <div>
                    <p className="text-sm text-white">{assignment.title}</p>
                    <p className="text-xs text-navy-400">{assignment.course}</p>
                  </div>
                </div>
                <span className={`badge ${assignment.urgent ? 'badge-danger' : 'badge-info'}`}>
                  {assignment.due}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Course progress */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">{t('dash.courseProgress')}</h2>
          <div className="space-y-4">
            {[
              { name: 'Physics 101', progress: 72, color: 'bg-cyan-500' },
              { name: 'Mathematics', progress: 85, color: 'bg-green-500' },
              { name: 'English Literature', progress: 45, color: 'bg-purple-500' },
              { name: 'Computer Science', progress: 90, color: 'bg-yellow-500' },
            ].map((course) => (
              <div key={course.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-navy-200">{course.name}</span>
                  <span className="text-sm text-navy-400">{course.progress}%</span>
                </div>
                <div className="w-full bg-navy-700 rounded-full h-2">
                  <div
                    className={`${course.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link to="/courses" className="block mt-4 text-sm text-cyan-400 hover:text-cyan-300">
            {t('dash.viewAll')}
          </Link>
        </div>
      </div>
    </div>
  )
}
