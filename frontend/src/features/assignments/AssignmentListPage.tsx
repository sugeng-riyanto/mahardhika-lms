import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Clock, CheckCircle, FileText, Users, Search, Plus, Send, Edit, Trash2, Video, FileDown, Upload, Loader2 } from 'lucide-react'
import { exportToCSV, type CSVColumn } from '@/utils/csvExport'
import { VideoEmbed } from '@/components/VideoEmbed'
import { videoEmbedUrl } from '@/utils/videoEmbed'
import { useAssignments } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { CrudModal, type CrudField } from '@/components/CrudModal'
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

const ASSIGNMENT_CSV_COLUMNS: CSVColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'course_title', label: 'Course' },
  { key: 'max_score', label: 'Max Score' },
  { key: 'due_date', label: 'Due Date', format: (v) => v ? String(v).split('T')[0] : '' },
  { key: 'video_url', label: 'Video URL' },
  { key: 'status', label: 'Status' },
  { key: 'submission_count', label: 'Submissions' },
  { key: 'graded_count', label: 'Graded' },
]

const ASSIGNMENT_FIELDS: CrudField[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Assignment title' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Assignment description...' },
  { name: 'course', label: 'Course ID', type: 'text', required: true, placeholder: 'Course UUID' },
  { name: 'max_score', label: 'Max Score', type: 'number', required: true, placeholder: '100' },
  { name: 'due_date', label: 'Due Date', type: 'text', placeholder: 'YYYY-MM-DD' },
  { name: 'video_url', label: 'Video Brief (YouTube / Google Drive)', type: 'text', placeholder: 'https://youtube.com/watch?v=... or https://drive.google.com/file/d/.../preview' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ]},
]

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes } else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = '' } else { current += ch }
    }
    values.push(current.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

const SUBMIT_FIELDS: CrudField[] = [
  { name: 'content', label: 'Your Submission', type: 'textarea', required: true, placeholder: 'Write your answer here...' },
]

interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'submit' | 'view'
  data: Record<string, unknown>
}

function AssignmentCard({
  assignment,
  isStudent,
  isInstructor,
  isAdmin,
  onSubmit,
  onEdit,
  onDelete,
}: {
  assignment: Assignment
  isStudent: boolean
  isInstructor: boolean
  isAdmin: boolean
  onSubmit: (a: Assignment) => void
  onEdit: (a: Assignment) => void
  onDelete: (a: Assignment) => void
}) {
  const statusCfg = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.draft
  const dueText = formatDueDate(assignment.due_date)
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date()

  return (
    <div className="card hover:border-cyan-500/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            {assignment.title}
            {assignment.video_url && <Video size={14} className="text-red-400 shrink-0" aria-label="Has video brief" />}
          </h3>
          <p className="text-navy-400 text-sm mt-1">{assignment.course_title}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {assignment.video_url && videoEmbedUrl(assignment.video_url) && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <VideoEmbed url={assignment.video_url} title={`${assignment.title} video brief`} />
        </div>
      )}

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

      <div className="flex items-center gap-2">
        <Link
          to={`/assignments/${assignment.id}`}
          className="flex-1 inline-block text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View details →
        </Link>
        {isStudent && (
          <button
            onClick={() => onSubmit(assignment)}
            className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"
          >
            <Send size={12} />
            Submit
          </button>
        )}
        {(isInstructor || isAdmin) && (
          <>
            <button onClick={() => onEdit(assignment)} className="p-1.5 text-navy-400 hover:text-yellow-400 transition-colors" title="Edit">
              <Edit size={14} />
            </button>
            <button onClick={() => onDelete(assignment)} className="p-1.5 text-navy-400 hover:text-red-400 transition-colors" title="Delete">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function AssignmentListPage() {
  const { roles } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'create', data: {} })

  const isStudent = roles.includes('student')
  const isInstructor = roles.includes('instructor')
  const isAdmin = roles.includes('admin') || roles.includes('owner')
  const canCreate = isInstructor || isAdmin

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter

  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const { data: assignments = [], isLoading, refetch } = useAssignments(params)

  const openCreate = () => setModal({
    isOpen: true, mode: 'create',
    data: { title: '', description: '', max_score: 100, due_date: '', video_url: '', status: 'draft' },
  })

  const openEdit = (a: Assignment) => setModal({
    isOpen: true, mode: 'edit',
    data: { id: a.id, title: a.title, description: a.description || '', max_score: a.max_score, due_date: a.due_date || '', video_url: a.video_url || '', status: a.status },
  })

  const openSubmit = (a: Assignment) => setModal({
    isOpen: true, mode: 'submit',
    data: { assignment_id: a.id, assignment_title: a.title, content: '' },
  })

  const openDelete = (a: Assignment) => setModal({
    isOpen: true, mode: 'delete',
    data: { id: a.id, title: a.title },
  })

  const handleSave = async (data: Record<string, unknown>) => {
    if (modal.mode === 'create') {
      await apiClient.post('/assignments/', data)
    } else if (modal.mode === 'edit' && data.id) {
      await apiClient.patch(`/assignments/${data.id}/`, data)
    } else if (modal.mode === 'submit') {
      await apiClient.post('/assignments/submissions/', {
        assignment: data.assignment_id,
        content_data: { text: data.content },
      })
    }
    await refetch()
  }

  const handleDelete = async () => {
    if (modal.data.id) {
      await apiClient.delete(`/assignments/${modal.data.id}/`)
      await refetch()
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      let created = 0
      for (const row of rows) {
        if (!row.title) continue
        await apiClient.post('/assignments/', {
          title: row.title,
          description: row.description || '',
          max_score: Number(row.max_score) || 100,
          due_date: row.due_date || null,
          video_url: row.video_url || '',
          status: row.status || 'draft',
          course: row.course_id || row.course || '',
        })
        created++
      }
      await refetch()
      setImportMsg(`Imported ${created} assignments`)
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Assignments</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(assignments, ASSIGNMENT_CSV_COLUMNS, 'assignments')} className="btn-secondary flex items-center gap-2">
            <FileDown size={16} />
            Export CSV
          </button>
          {canCreate && (
            <>
              <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                <Plus size={16} />
                Create Assignment
              </button>
              <button onClick={() => importRef.current?.click()} disabled={importing} className="btn-secondary flex items-center gap-2">
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Import CSV
              </button>
            </>
          )}
        </div>
      </div>
      <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      {importMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${importMsg.includes('Imported') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {importMsg}
        </div>
      )}

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
            {isStudent ? 'No assignments are available for your courses yet.' : 'Create your first assignment to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignments.map((a: Assignment) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              isStudent={isStudent}
              isInstructor={isInstructor}
              isAdmin={isAdmin}
              onSubmit={openSubmit}
              onEdit={openEdit}
              onDelete={openDelete}
            />
          ))}
        </div>
      )}

      {/* CRUD Modal */}
      <CrudModal
        isOpen={modal.isOpen}
        mode={modal.mode === 'submit' ? 'create' : modal.mode}
        title={modal.mode === 'submit' ? `Submit: ${modal.data.assignment_title || 'Assignment'}` : 'Assignment'}
        fields={modal.mode === 'submit' ? SUBMIT_FIELDS : ASSIGNMENT_FIELDS}
        data={modal.data}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModal({ isOpen: false, mode: 'create', data: {} })}
      />
    </div>
  )
}
