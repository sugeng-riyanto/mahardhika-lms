import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Clock, CheckCircle, FileText, Users, Search } from 'lucide-react'
import { useAssignments } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import type { Assignment } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-400', bg: 'bg-gray-800' },
  published: { label: 'Published', color: 'text-green-400', bg: 'bg-green-900/30' },
  archived: { label: 'Archived', color: 'text-navy-400', bg: 'bg-navy-800' },
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No deadline'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days}d`
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const statusCfg = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.draft
  const dueText = formatDueDate(assignment.due_date)
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date()

  return (
    <div className="card hover:border-cyan-500/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg">{assignment.title}</h3>
          <p className="text-navy-400 text-sm mt-1">{assignment.course_title}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {assignment.description && (
        <p className="text-navy-300 text-sm mb-3 line-clamp-2">{assignment.description}</p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-navy-400 mb-3">
        <span className="flex items-center gap-1">
          <FileText size={14} />
          Max score: {assignment.max_score}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={14} className={isOverdue ? 'text-red-400' : ''} />
          <span className={isOverdue ? 'text-red-400' : ''}>{dueText}</span>
        </span>
        <span className="flex items-center gap-1">
          <Users size={14} />
          {assignment.submission_count} submission{assignment.submission_count !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle size={14} />
          {assignment.graded_count} graded
        </span>
      </div>

      {assignment.max_attempts > 1 && (
        <p className="text-xs text-navy-500 mb-3">
          Max attempts: {assignment.max_attempts}
          {assignment.allow_late && ` · Late penalty: ${assignment.late_penalty_percent}%`}
        </p>
      )}

      <Link
        to={`/assignments/${assignment.id}`}
        className="inline-block text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        View details →
      </Link>
    </div>
  )
}

export function AssignmentListPage() {
  const { roles } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter

  const { data: assignments = [], isLoading } = useAssignments(params)

  const isStudent = roles.includes('student')

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Assignments</h1>
        </div>
      </div>

      <p className="page-subtitle">
        {isStudent ? 'View and submit your assignments' : 'Manage course assignments and submissions'}
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={16} />
          <input
            type="text"
            placeholder="Search assignments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-2">
          {['', 'published', 'draft', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === status
                  ? 'bg-cyan-600 text-white'
                  : 'bg-navy-800 text-navy-300 hover:bg-navy-700'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-navy-400 mt-3">Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="mx-auto text-navy-600 mb-3" size={48} />
          <h3 className="text-navy-400 text-lg">No assignments found</h3>
          <p className="text-navy-500 text-sm mt-1">
            {isStudent
              ? 'No assignments are available for your courses yet.'
              : 'Create your first assignment to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignments.map((a: Assignment) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  )
}
