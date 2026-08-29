import { BookOpen, ClipboardList, Users, BarChart3, FileText, PenTool, Plus, Edit, Award } from 'lucide-react'
import { Link } from 'react-router-dom'
import { t } from '@/i18n/translations'

const stats = [
  { label: 'Assigned Courses', value: '3', icon: <BookOpen size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
  { label: 'Pending Submissions', value: '12', icon: <ClipboardList size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  { label: 'Total Students', value: '45', icon: <Users size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
  { label: 'Published Activities', value: '18', icon: <FileText size={20} />, color: 'text-purple-400', bg: 'bg-purple-900/30' },
]

const recentSubmissions = [
  { student: 'Ahmad Rizky', course: 'Physics 101', activity: 'Essay: Newton\'s Laws', time: '30 min ago' },
  { student: 'Siti Nurhaliza', course: 'Mathematics', activity: 'Canvas: Calculus Problem', time: '1 hour ago' },
  { student: 'Budi Santoso', course: 'Physics 101', activity: 'Quiz: Forces & Motion', time: '2 hours ago' },
  { student: 'Dewi Lestari', course: 'Mathematics', activity: 'Assignment #3', time: '3 hours ago' },
]

export function InstructorDashboard() {
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <PenTool className="text-cyan-400" size={24} />
        <h1 className="page-title mb-0">{t('dash.instructor.title')}</h1>
      </div>

      <p className="page-subtitle">{t('dash.instructor.subtitle')}</p>

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
        {/* Pending submissions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t('dash.pendingSubmissions')}</h2>
            <Link to="/assignments" className="text-sm text-cyan-400 hover:text-cyan-300">{t('dash.viewAll')}</Link>
          </div>
          <div className="space-y-3">
            {recentSubmissions.map((sub, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-navy-700 last:border-0">
                <div>
                  <p className="text-sm text-white">{sub.student}</p>
                  <p className="text-xs text-navy-400">{sub.activity} • {sub.course}</p>
                </div>
                <span className="text-xs text-navy-500">{sub.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Link to="/courses" className="flex items-center gap-2 p-3 rounded-lg bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-700/30 transition-colors">
              <Plus size={16} className="text-cyan-400" />
              <span className="text-sm text-cyan-300">Create Course</span>
            </Link>
            <Link to="/assignments" className="flex items-center gap-2 p-3 rounded-lg bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-700/30 transition-colors">
              <Plus size={16} className="text-yellow-400" />
              <span className="text-sm text-yellow-300">Create Assignment</span>
            </Link>
            <Link to="/essays/new" className="flex items-center gap-2 p-3 rounded-lg bg-purple-900/20 hover:bg-purple-900/40 border border-purple-700/30 transition-colors">
              <Plus size={16} className="text-purple-400" />
              <span className="text-sm text-purple-300">Create Essay</span>
            </Link>
            <Link to="/content" className="flex items-center gap-2 p-3 rounded-lg bg-green-900/20 hover:bg-green-900/40 border border-green-700/30 transition-colors">
              <Plus size={16} className="text-green-400" />
              <span className="text-sm text-green-300">Upload Content</span>
            </Link>
          </div>
          <div className="space-y-2">
            <Link to="/courses" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <BookOpen size={18} className="text-cyan-400" />
              <span className="text-sm text-navy-200">Manage Courses</span>
            </Link>
            <Link to="/assignments" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <ClipboardList size={18} className="text-yellow-400" />
              <span className="text-sm text-navy-200">Grade Submissions</span>
            </Link>
            <Link to="/gradebook" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <BarChart3 size={18} className="text-green-400" />
              <span className="text-sm text-navy-200">View Gradebook</span>
            </Link>
            <Link to="/essays" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <Award size={18} className="text-purple-400" />
              <span className="text-sm text-navy-200">Essay Assessment</span>
            </Link>
          </div>

          {/* Class summary */}
          <div className="mt-4 p-3 bg-navy-700/30 rounded-lg">
            <h3 className="text-sm font-medium text-navy-300 mb-2">{t('dash.todaysSchedule')}</h3>
            <div className="space-y-1">
              <p className="text-xs text-navy-400">09:00 - Physics 101 (Grade 10)</p>
              <p className="text-xs text-navy-400">11:00 - Mathematics (Grade 9)</p>
              <p className="text-xs text-navy-400">14:00 - Physics Lab Session</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
