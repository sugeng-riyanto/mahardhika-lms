import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search, Download, User, BookOpen, Settings, CreditCard, LogIn, LogOut, Edit, Eye, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { exportToCSV, type CSVColumn } from '@/utils/csvExport'
import type { AuditEvent } from '@/types'

const AUDIT_CSV_COLUMNS: CSVColumn<AuditEvent>[] = [
  { key: 'created_at', label: 'Timestamp' },
  { key: 'actor_email', label: 'Actor' },
  { key: 'action', label: 'Action' },
  { key: 'resource_type', label: 'Resource Type' },
  { key: 'resource_id', label: 'Resource ID' },
  { key: 'scope', label: 'Scope' },
  { key: 'details', label: 'Details', format: (v) => JSON.stringify(v ?? {}) },
  { key: 'ip_address', label: 'IP Address' },
]

const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  { id: 'ae1', actor_id: '1', actor_email: 'owner@mahardhika.id', action: 'user.login', resource_type: 'auth', resource_id: '0', scope: 'global', details: { method: 'email' }, ip_address: '192.168.1.100', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T10:00:00Z' },
  { id: 'ae2', actor_id: '2', actor_email: 'admin@mahardhika.id', action: 'user.create', resource_type: 'user', resource_id: '5', scope: 'org', details: { email: 'student@mahardhika.id' }, ip_address: '192.168.1.101', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T10:15:00Z' },
  { id: 'ae3', actor_id: '2', actor_email: 'admin@mahardhika.id', action: 'role.assign', resource_type: 'role_assignment', resource_id: 'ra1', scope: 'org', details: { role: 'student', user: 'student@mahardhika.id' }, ip_address: '192.168.1.101', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T10:16:00Z' },
  { id: 'ae4', actor_id: '4', actor_email: 'instructor@mahardhika.id', action: 'course.create', resource_type: 'course', resource_id: 'c1', scope: 'programme', details: { title: 'Mathematics 7A' }, ip_address: '192.168.1.102', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T11:00:00Z' },
  { id: 'ae5', actor_id: '4', actor_email: 'instructor@mahardhika.id', action: 'lesson.create', resource_type: 'lesson', resource_id: 'l1', scope: 'course', details: { title: 'Introduction to Algebra', course: 'Mathematics 7A' }, ip_address: '192.168.1.102', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T11:30:00Z' },
  { id: 'ae6', actor_id: '4', actor_email: 'instructor@mahardhika.id', action: 'course.publish', resource_type: 'course', resource_id: 'c1', scope: 'course', details: { title: 'Mathematics 7A' }, ip_address: '192.168.1.102', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T12:00:00Z' },
  { id: 'ae7', actor_id: '5', actor_email: 'student@mahardhika.id', action: 'enrolment.create', resource_type: 'enrolment', resource_id: 'e1', scope: 'course', details: { course: 'Mathematics 7A' }, ip_address: '192.168.1.103', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T13:00:00Z' },
  { id: 'ae8', actor_id: '5', actor_email: 'student@mahardhika.id', action: 'lesson.view', resource_type: 'lesson', resource_id: 'l1', scope: 'lesson', details: { title: 'Introduction to Algebra' }, ip_address: '192.168.1.103', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T13:05:00Z' },
  { id: 'ae9', actor_id: '6', actor_email: 'parent@mahardhika.id', action: 'consent.grant', resource_type: 'parent_child_link', resource_id: 'pcl1', scope: 'student', details: { student: 'student@mahardhika.id', type: 'parental_consent' }, ip_address: '192.168.1.104', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T14:00:00Z' },
  { id: 'ae10', actor_id: '2', actor_email: 'admin@mahardhika.id', action: 'settings.update', resource_type: 'organisation', resource_id: 'org1', scope: 'org', details: { field: 'name', old: 'Mahardhika Academy', new: 'Mahardhika Digital Campus' }, ip_address: '192.168.1.101', user_agent: 'Mozilla/5.0', created_at: '2026-08-24T15:00:00Z' },
]

const ACTION_META: Record<string, { label: string; icon: typeof User; color: string }> = {
  'user.login': { label: 'Login', icon: LogIn, color: 'text-green-400' },
  'user.logout': { label: 'Logout', icon: LogOut, color: 'text-navy-400' },
  'user.create': { label: 'Create User', icon: User, color: 'text-blue-400' },
  'role.assign': { label: 'Assign Role', icon: Shield, color: 'text-purple-400' },
  'course.create': { label: 'Create Course', icon: BookOpen, color: 'text-cyan-400' },
  'course.publish': { label: 'Publish Course', icon: BookOpen, color: 'text-green-400' },
  'lesson.create': { label: 'Create Lesson', icon: Edit, color: 'text-cyan-400' },
  'lesson.view': { label: 'View Lesson', icon: Eye, color: 'text-navy-400' },
  'enrolment.create': { label: 'Enrol', icon: BookOpen, color: 'text-blue-400' },
  'consent.grant': { label: 'Grant Consent', icon: Shield, color: 'text-yellow-400' },
  'settings.update': { label: 'Settings', icon: Settings, color: 'text-orange-400' },
  'resource.delete': { label: 'Delete', icon: Trash2, color: 'text-red-400' },
  'payment.create': { label: 'Payment', icon: CreditCard, color: 'text-green-400' },
}

async function fetchAuditEvents(): Promise<AuditEvent[]> {
  try {
    const data = await apiClient.list<AuditEvent>('/audit-events/')
    return data.results
  } catch {
    return MOCK_AUDIT_EVENTS
  }
}

export function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')

  const { data: events, isLoading } = useQuery({
    queryKey: ['audit-events'],
    queryFn: fetchAuditEvents,
  })

  const filteredEvents = events?.filter((e) => {
    const matchesSearch =
      e.actor_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.resource_type.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesAction = actionFilter === 'all' || e.action.startsWith(actionFilter)
    return matchesSearch && matchesAction
  }) || []

  const uniqueActions = [...new Set(events?.map((e) => e.action.split('.')[0]) || [])]

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="text-orange-400" size={24} />
          <h1 className="page-title mb-0">Audit Log</h1>
        </div>
        <button
          onClick={() => exportToCSV(filteredEvents, AUDIT_CSV_COLUMNS, 'audit-events')}
          className="btn-secondary flex items-center gap-2"
          disabled={filteredEvents.length === 0}
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{events?.length || 0}</p>
          <p className="text-sm text-navy-400">Total Events</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{events?.filter(e => e.action.includes('login')).length || 0}</p>
          <p className="text-sm text-navy-400">Logins</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-purple-400">{events?.filter(e => e.action.includes('create')).length || 0}</p>
          <p className="text-sm text-navy-400">Creations</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-orange-400">{events?.filter(e => e.action.includes('update') || e.action.includes('settings')).length || 0}</p>
          <p className="text-sm text-navy-400">Updates</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" size={16} />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input-field w-full sm:w-auto"
        >
          <option value="all">All Actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading audit events...</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Event</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Actor</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Resource</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">IP Address</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => {
                  const meta = ACTION_META[event.action] || { label: event.action, icon: Eye, color: 'text-navy-400' }
                  const Icon = meta.icon
                  return (
                    <tr key={event.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={meta.color} />
                          <span className="text-sm text-white font-medium">{meta.label}</span>
                          <span className="text-xs text-navy-500">{event.action}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-navy-300">{event.actor_email}</span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-sm">
                          <span className="text-navy-300">{event.resource_type}</span>
                          {event.details && (
                            <span className="text-navy-500 ml-1 text-xs">
                              {typeof event.details === 'object' && 'title' in event.details
                                ? `(${String((event.details as Record<string, unknown>).title)})`
                                : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-navy-500 font-mono">{event.ip_address || '—'}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-navy-400">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredEvents.length === 0 && (
            <div className="py-12 text-center">
              <Shield className="mx-auto text-navy-600 mb-4" size={32} />
              <p className="text-navy-400">
                {searchQuery || actionFilter !== 'all' ? 'No events match your filters.' : 'No audit events found.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
