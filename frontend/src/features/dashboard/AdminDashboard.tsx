import { Settings, Users, BookOpen, GraduationCap, ClipboardList, AlertCircle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUsers, useCourses, useProgrammes } from '@/api/hooks'
import { t } from '@/i18n/translations'

export function AdminDashboard() {
  const { data: users = [] } = useUsers()
  const { data: courses = [] } = useCourses()
  const { data: programmes = [] } = useProgrammes()

  const activeUsers = users.filter(u => u.is_active).length
  const publishedCourses = courses.filter(c => c.is_published).length

  const stats = [
    { label: 'Active Users', value: activeUsers, icon: <Users size={20} />, color: 'text-purple-400', bg: 'bg-purple-900/30', link: '/users' },
    { label: 'Courses', value: courses.length, icon: <BookOpen size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-900/30', link: '/courses' },
    { label: 'Programmes', value: programmes.length, icon: <GraduationCap size={20} />, color: 'text-green-400', bg: 'bg-green-900/30', link: '/programmes' },
    { label: 'Published', value: publishedCourses, icon: <ClipboardList size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30', link: '/courses' },
  ]

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="text-purple-400" size={24} />
          <h1 className="page-title mb-0">{t('dash.admin.title')}</h1>
        </div>
        <Link to="/users" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add User
        </Link>
      </div>

      <p className="page-subtitle">{t('dash.admin.subtitle')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.link} className="card hover:border-cyan-700/50 transition-colors" role="group" aria-label={`${stat.label}: ${stat.value}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`} aria-hidden="true">
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-navy-400">{stat.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">User Management</h2>
          <div className="space-y-2">
            <Link to="/users" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              View & Manage Users ({users.length})
            </Link>
            <Link to="/users" className="flex items-center gap-2 p-3 rounded-lg bg-cyan-900/20 hover:bg-cyan-900/30 transition-colors text-sm text-cyan-400">
              <Plus size={14} />
              Add New User
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Programmes & Courses</h2>
          <div className="space-y-2">
            <Link to="/programmes" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              Manage Programmes ({programmes.length})
            </Link>
            <Link to="/courses" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              Manage Courses ({courses.length})
            </Link>
            <Link to="/content" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              Content Library
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/users" className="flex items-center gap-2 p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              <Users size={14} className="text-purple-400" />
              User & Role Management
            </Link>
            <Link to="/audit" className="flex items-center gap-2 p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              <AlertCircle size={14} className="text-yellow-400" />
              Audit Log
            </Link>
            <Link to="/settings" className="flex items-center gap-2 p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              <Settings size={14} className="text-cyan-400" />
              System Settings
            </Link>
            <Link to="/finance" className="flex items-center gap-2 p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              <ClipboardList size={14} className="text-green-400" />
              Finance Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
