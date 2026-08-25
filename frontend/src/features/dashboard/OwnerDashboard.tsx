import { LayoutDashboard, Users, BookOpen, Shield, TrendingUp, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUsers, useCourses, useProgrammes } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'

interface AuditEvent {
  id: string
  action: string
  resource_type: string
  actor_email: string
  created_at: string
}

function useRecentAuditEvents() {
  return useQuery({
    queryKey: ['auditEvents', 'recent'],
    queryFn: async () => {
      try {
        const data = await apiClient.get<{ results: AuditEvent[] }>('/audit/events/')
        return (data.results || []).slice(0, 10)
      } catch {
        return []
      }
    },
    staleTime: 30_000,
  })
}

function usePendingConsentCount() {
  return useQuery({
    queryKey: ['pendingConsent'],
    queryFn: async () => {
      try {
        const data = await apiClient.get<{ results: Array<{ status: string }> }>('/consent/')
        return data.results?.filter((c) => c.status === 'pending').length || 0
      } catch {
        return 0
      }
    },
    staleTime: 30_000,
  })
}

function getSeverityFromAction(action: string): 'success' | 'warning' | 'info' {
  if (action.includes('create') || action.includes('publish') || action.includes('issue')) return 'success'
  if (action.includes('revoke') || action.includes('delete') || action.includes('escalat')) return 'warning'
  return 'info'
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function OwnerDashboard() {
  const { data: users = [], isLoading: loadingUsers } = useUsers()
  const { data: courses = [], isLoading: loadingCourses } = useCourses()
  const { data: programmes = [], isLoading: loadingProgrammes } = useProgrammes()
  const { data: auditEvents = [] } = useRecentAuditEvents()
  const { data: pendingConsent = 0 } = usePendingConsentCount()

  const isLoading = loadingUsers || loadingCourses || loadingProgrammes

  const stats = [
    { label: 'Total Users', value: users.length, icon: <Users size={20} />, color: 'text-purple-400', bg: 'bg-purple-900/30' },
    { label: 'Active Programmes', value: programmes.length, icon: <BookOpen size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Active Courses', value: courses.length, icon: <TrendingUp size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
    { label: 'Recent Audit Events', value: auditEvents.length, icon: <Shield size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  ]

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">Owner Dashboard</h1>
      </div>

      <p className="page-subtitle">Governance overview and system health</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-10 bg-navy-700 rounded w-20 mb-2" />
              <div className="h-4 bg-navy-700 rounded w-32" />
            </div>
          ))
        ) : (
          stats.map((stat) => (
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
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent audit events */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Audit Events</h2>
          {auditEvents.length === 0 ? (
            <p className="text-navy-500 text-sm py-4 text-center">No audit events yet.</p>
          ) : (
            <div className="space-y-3">
              {auditEvents.map((event) => {
                const severity = getSeverityFromAction(event.action)
                return (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b border-navy-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        severity === 'success' ? 'bg-green-500' :
                        severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <div>
                        <span className="text-sm text-navy-200">{event.action}</span>
                        <span className="text-xs text-navy-500 ml-2">({event.resource_type})</span>
                      </div>
                    </div>
                    <span className="text-xs text-navy-500">{timeAgo(event.created_at)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <Link to="/audit" className="block mt-4 text-sm text-cyan-400 hover:text-cyan-300">
            View all audit events →
          </Link>
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/users" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <Users size={18} className="text-purple-400" />
              <span className="text-sm text-navy-200">Manage Users & Roles</span>
            </Link>
            <Link to="/programmes" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <BookOpen size={18} className="text-green-400" />
              <span className="text-sm text-navy-200">Manage Programmes</span>
            </Link>
            <Link to="/audit" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <Shield size={18} className="text-yellow-400" />
              <span className="text-sm text-navy-200">Review Audit Log</span>
            </Link>
            <Link to="/reports" className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700 transition-colors">
              <TrendingUp size={18} className="text-cyan-400" />
              <span className="text-sm text-navy-200">View Reports</span>
            </Link>
          </div>

          {/* Alerts */}
          {(pendingConsent > 0) && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
                <AlertTriangle size={14} />
                <span className="font-medium">Pending Reviews</span>
              </div>
              <p className="text-xs text-navy-400">
                {pendingConsent} parent consent request{pendingConsent !== 1 ? 's' : ''} need approval.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
