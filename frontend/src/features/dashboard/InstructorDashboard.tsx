import { BookOpen, ClipboardList, Users, BarChart3, FileText, PenTool } from 'lucide-react'
import { Link } from 'react-router-dom'

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
        <h1 className="page-title mb-0">Instructor Dashboard</h1>
      </div>

      <p className="page-subtitle">Your courses, submissions, and grading overview</p>

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
            <h2 className="text-lg font-semibold text-white">Pending Submissions</h2>
            <Link to="/assignments" className="text-sm text-cyan-400 hover:text-cyan-300">View all →</Link>
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
            <Link to="/content" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <FileText size={18} className="text-purple-400" />
              <span className="text-sm text-navy-200">Content Library</span>
            </Link>
          </div>

          {/* Class summary */}
          <div className="mt-4 p-3 bg-navy-700/30 rounded-lg">
            <h3 className="text-sm font-medium text-navy-300 mb-2">Today&apos;s Schedule</h3>
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
