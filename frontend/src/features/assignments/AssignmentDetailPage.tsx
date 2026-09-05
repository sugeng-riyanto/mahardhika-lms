import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ClipboardList, Clock, FileText, Users, CheckCircle, Send,
  ArrowLeft, Star, MessageSquare, AlertCircle, Upload, X, Loader2,
} from 'lucide-react'
import { useAssignment, useAssignmentSubmissions } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { apiClient } from '@/api/client'
import type { AssignmentSubmission } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-800 text-gray-400',
  published: 'bg-green-900/30 text-green-400',
  archived: 'bg-navy-800 text-navy-400',
  submitted: 'bg-cyan-900/30 text-cyan-400',
  graded: 'bg-purple-900/30 text-purple-400',
  returned: 'bg-yellow-900/30 text-yellow-400',
}

function SubmissionCard({ sub }: { sub: AssignmentSubmission }) {
  const statusCls = STATUS_BADGE[sub.status] || 'bg-navy-800 text-navy-400'

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-white font-medium">Attempt #{sub.attempt_number}</p>
          <p className="text-navy-400 text-sm">
            {sub.student_email} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Not submitted'}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusCls}`}>
          {sub.status}
        </span>
      </div>

      {sub.content_data && Object.keys(sub.content_data).length > 0 && (
        <div className="mt-2 p-3 bg-navy-800/50 rounded-lg">
          <p className="text-navy-300 text-sm whitespace-pre-wrap">
            {typeof sub.content_data.response === 'string'
              ? sub.content_data.response
              : JSON.stringify(sub.content_data, null, 2)}
          </p>
        </div>
      )}

      {sub.score !== null && sub.score !== undefined && (
        <div className="mt-3 flex items-center gap-4">
          <span className="text-white font-semibold flex items-center gap-1">
            <Star size={14} className="text-yellow-400" />
            Score: {sub.score}
          </span>
          {sub.feedback && (
            <span className="text-navy-300 text-sm flex items-center gap-1">
              <MessageSquare size={14} />
              {sub.feedback}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function SubmitForm({ assignmentId, attemptNumber }: { assignmentId: string; attemptNumber: number }) {
  const [response, setResponse] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!response.trim() && !file) {
      setError('Write your response or attach a file')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      // Create the draft submission first so a file can be attached to it
      const sub = await apiClient.post<AssignmentSubmission>('/assignments/submissions/', {
        assignment: assignmentId,
        content_data: { response },
      })
      if (file) {
        // 1. Request a signed upload URL
        const req = await apiClient.post<{ upload_url: string; file_path: string }>('/assignments/submissions/upload/request/', {
          assignment_id: assignmentId,
          filename: file.name,
          file_size: file.size,
          content_type: file.type || 'application/octet-stream',
        })
        // 2. PUT the bytes directly to Supabase Storage (skip mock URLs offline)
        if (!req.upload_url.includes('mock-storage')) {
          const up = await fetch(req.upload_url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
          })
          if (!up.ok) throw new Error(`Upload to storage failed (HTTP ${up.status})`)
        }
        // 3. Confirm — attaches the file record to the draft submission
        await apiClient.post('/assignments/submissions/upload/confirm/', {
          submission_id: sub.id,
          file_path: req.file_path,
          original_filename: file.name,
          file_size: file.size,
          content_type: file.type || 'application/octet-stream',
        })
      }
      // Submit it
      await apiClient.post(`/assignments/submissions/${sub.id}/submit/`, {})
      setSubmitted(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card bg-green-900/20 border-green-500/30">
        <div className="flex items-center gap-3 text-green-400">
          <CheckCircle size={24} />
          <div>
            <p className="font-semibold">Submission successful!</p>
            <p className="text-sm text-navy-300 mt-1">
              Your response has been submitted (attempt #{attemptNumber}).
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-white font-semibold mb-3">Your Submission (Attempt #{attemptNumber})</h3>
      <textarea
        className="input w-full min-h-[200px] resize-y"
        placeholder="Write your answer here..."
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <div className="mt-3">
        {file ? (
          <div className="flex items-center gap-2 text-sm bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 max-w-md">
            <FileText size={14} className="text-cyan-400 shrink-0" />
            <span className="text-navy-200 truncate flex-1">{file.name}</span>
            <button onClick={() => setFile(null)} aria-label="Remove file" className="text-navy-400 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Upload size={14} />
            Attach File (PDF, DOCX, images…)
          </button>
        )}
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      <div className="flex justify-end mt-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary flex items-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Submitting...' : 'Submit Assignment'}
        </button>
      </div>
    </div>
  )
}

export function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()

  const { data: assignment, isLoading } = useAssignment(assignmentId || '')


  const { data: submissions = [], isLoading: loadingSubmissions } = useAssignmentSubmissions(
    assignmentId ? { assignment: assignmentId } : undefined
  )

  const { roles } = useAuth()
  const isStudent = roles.includes('student')
  const isInstructor = roles.includes('instructor')
  const isAdmin = roles.includes('admin') || roles.includes('owner')

  if (isLoading) {
    return (
      <div className="page-container text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
        <p className="text-navy-400 mt-3">Loading assignment...</p>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="page-container text-center py-12">
        <AlertCircle className="mx-auto text-red-400 mb-3" size={48} />
        <h3 className="text-white text-lg">Assignment not found</h3>
        <Link to="/assignments" className="text-cyan-400 text-sm mt-2 inline-block">← Back to assignments</Link>
      </div>
    )
  }

  const statusCls = STATUS_BADGE[assignment.status] || 'bg-navy-800 text-navy-400'
  const dueText = assignment.due_date
    ? new Date(assignment.due_date).toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="page-container max-w-4xl mx-auto">
      <Link to="/assignments" className="inline-flex items-center gap-1 text-navy-400 hover:text-navy-200 text-sm mb-4">
        <ArrowLeft size={14} /> Back to assignments
      </Link>

      {/* Assignment Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <ClipboardList className="text-cyan-400" size={24} />
              <h1 className="text-2xl font-bold text-white">{assignment.title}</h1>
            </div>
            <p className="text-navy-400">
              {assignment.course_title}
              {assignment.created_by_email && ` · Created by ${assignment.created_by_email}`}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusCls}`}>
            {assignment.status}
          </span>
        </div>

        {assignment.description && (
          <p className="text-navy-200 mb-4 whitespace-pre-wrap">{assignment.description}</p>
        )}

        {assignment.instructions && (
          <div className="p-4 bg-navy-800/50 rounded-lg mb-4">
            <h4 className="text-white font-medium mb-2">Instructions</h4>
            <p className="text-navy-300 text-sm whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-6 text-sm text-navy-400">
          <span className="flex items-center gap-1.5">
            <FileText size={16} className="text-cyan-400" />
            Max score: <span className="text-white">{assignment.max_score}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={16} className="text-cyan-400" />
            Due: <span className="text-white">{dueText || 'No deadline'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={16} className="text-cyan-400" />
            {assignment.submission_count} submission{assignment.submission_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle size={16} className="text-cyan-400" />
            {assignment.graded_count} graded
          </span>
        </div>

        {assignment.max_attempts > 1 && (
          <p className="text-xs text-navy-500 mt-3">
            Max attempts: {assignment.max_attempts}
            {assignment.allow_late && ` · Late penalty: ${assignment.late_penalty_percent}%`}
          </p>
        )}
      </div>

      {/* Student submission form */}
      {isStudent && assignment.status === 'published' && (
        <SubmitForm assignmentId={assignment.id} attemptNumber={1} />
      )}

      {/* Instructor/Admin: view submissions */}
      {(isInstructor || isAdmin) && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={20} className="text-cyan-400" />
            Submissions ({submissions.length})
          </h2>
          {loadingSubmissions ? (
            <p className="text-navy-400">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p className="text-navy-500 text-sm">No submissions yet.</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub: AssignmentSubmission) => (
                <SubmissionCard key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
