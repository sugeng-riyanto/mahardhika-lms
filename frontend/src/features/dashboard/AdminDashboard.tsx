import { Settings, Users, BookOpen, GraduationCap, ClipboardList, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const stats = [
  { label: 'Active Users', value: '24', icon: <Users size={20} />, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  { label: 'Courses', value: '8', icon: <BookOpen size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
  { label: 'Programmes', value: '3', icon: <GraduationCap size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
  { label: 'Pending Enrolments', value: '5', icon: <ClipboardList size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
]

export function AdminDashboard() {
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">Admin Dashboard</h1>
      </div>

      <p className="page-subtitle">Operational management and user administration</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card" role="group" aria-label={`${stat.label}: ${stat.value}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`} aria-hidden="true">
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white" aria-hidden="true">{stat.value}</p>
                <p className="text-sm text-navy-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4" id="user-mgmt-heading">User Management</h2>
          <div className="space-y-2">
            <Link to="/users" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              View all users →
            </Link>
            <div className="p-3 bg-navy-700/30 rounded-lg">
              <p className="text-sm text-navy-300" id="invite-label">Quick invite</p>
              <div className="flex gap-2 mt-2">
                <input
                  type="email"
                  placeholder="Email address"
                  className="input-field flex-1 text-sm py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-labelledby="invite-label"
                  aria-label="Email address for quick invite"
                />
                <button className="btn-primary text-sm py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400">Invite</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4" id="programmes-heading">Programmes & Courses</h2>
          <div className="space-y-2">
            <Link to="/programmes" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              Manage programmes →
            </Link>
            <Link to="/courses" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
              Manage courses →
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4" id="system-health-heading">System Health</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-navy-300">API Status</span>
              <span className="badge-success">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-navy-300">Database</span>
              <span className="badge-success">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-navy-300">Storage</span>
              <span className="badge-success">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-navy-300">Workers</span>
              <span className="badge-warning">Starting</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} />
              <span className="text-xs">2 pending role approvals need attention</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
