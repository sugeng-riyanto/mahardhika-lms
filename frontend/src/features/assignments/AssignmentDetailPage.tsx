import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ClipboardList, Clock, FileText, Users, CheckCircle, Send,
  ArrowLeft, Star, MessageSquare, AlertCircle, Upload, X, Loader2,
} from 'lucide-react'
import { VideoEmbed } from '@/components/VideoEmbed'
import { videoEmbedUrl } from '@/utils/videoEmbed'
import { useAssignment, useAssignmentSubmissions, useEssayResponses } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { apiClient } from '@/api/client'
import type { Assignment, AssignmentQuestion, AssignmentSubmission, EssayResponse } from '@/types'

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
          {Array.isArray(sub.content_data.mcq_results) ? (
            <div className="space-y-2">
              <p className="text-sm text-navy-300">
                MCQ score: {String(sub.content_data.mcq_score ?? '—')} / {String(sub.content_data.mcq_total ?? '—')}
              </p>
              {(sub.content_data.mcq_results as { prompt: string; correct: boolean; points: number }[]).map((r, idx) => (
                <p key={idx} className="text-xs">
                  <span className={r.correct ? 'text-green-400' : 'text-red-400'}>
                    {r.correct ? '✓' : '✗'}
                  </span>{' '}
                  <span className="text-navy-300">{r.prompt}</span>
                  <span className="text-navy-500 ml-1">({r.points} pt)</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-navy-300 text-sm whitespace-pre-wrap">
              {typeof sub.content_data.response === 'string'
                ? sub.content_data.response
                : JSON.stringify(sub.content_data, null, 2)}
            </p>
          )}
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

function McqQuizForm({ assignment, existing }: { assignment: Assignment; existing?: AssignmentSubmission | null }) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const questions: AssignmentQuestion[] = assignment.questions || []
  const results = (existing?.content_data?.mcq_results as
    | { question_id: string; prompt: string; answer: unknown; correct: boolean; points: number; explanation?: string }[]
    | undefined) || null

  if (existing && results) {
    const earned = (existing.content_data?.mcq_score as number) ?? 0
    const total = (existing.content_data?.mcq_total as number) ?? 0
    return (
      <div className="card border-green-500/30">
        <div className="flex items-center gap-3 text-green-400 mb-4">
          <CheckCircle size={24} />
          <div>
            <p className="font-semibold">Quiz graded automatically</p>
            <p className="text-sm text-navy-300">
              Score: {existing.score !== null && existing.score !== undefined ? existing.score : '—'}
              {' '}({earned}/{total} points)
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {questions.map((q: AssignmentQuestion, idx: number) => {
            const r = results.find((res) => res.question_id === q.id)
            return (
              <div key={q.id} className={`p-3 rounded-lg border ${r?.correct ? 'border-green-700/40 bg-green-900/10' : 'border-red-700/40 bg-red-900/10'}`}>
                <p className="text-white text-sm font-medium">
                  {idx + 1}. {q.prompt}
                  <span className="ml-2 text-xs text-navy-400">({q.points} pt{q.points !== 1 ? 's' : ''})</span>
                </p>
                <p className={`text-sm mt-1 ${r?.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {r?.correct ? '✓ Correct' : '✗ Incorrect'}
                </p>
                {r?.explanation && <p className="text-xs text-navy-300 mt-1">{r.explanation}</p>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const setAnswer = (qid: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  const handleSubmit = async () => {
    const missing = questions.filter((q) => {
      const a = answers[q.id]
      if (q.question_type === 'multiple_select') return !a || (a as string[]).length === 0
      return !a
    })
    if (missing.length > 0) {
      setError('Answer every question before submitting.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await apiClient.post('/assignments/submissions/', {
        assignment: assignment.id,
        content_data: { mcq_answers: answers },
      })
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h3 className="text-white font-semibold mb-4">Answer the questions</h3>
      <div className="space-y-5">
        {questions.map((q: AssignmentQuestion, idx: number) => {
          const isMultiple = q.question_type === 'multiple_select'
          const selected = answers[q.id]
          return (
            <div key={q.id} className="p-4 rounded-lg border border-navy-700 bg-navy-800/40">
              <p className="text-white text-sm font-medium mb-3">
                {idx + 1}. {q.prompt}
                <span className="ml-2 text-xs text-navy-400">({q.points} pt{q.points !== 1 ? 's' : ''})</span>
              </p>
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const optSelected = isMultiple
                    ? Array.isArray(selected) && selected.includes(opt.id)
                    : selected === opt.id
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        optSelected ? 'border-cyan-400 bg-cyan-900/20' : 'border-navy-700 hover:border-navy-500'
                      }`}
                    >
                      <input
                        type={isMultiple ? 'checkbox' : 'radio'}
                        name={`q-${q.id}`}
                        className="accent-cyan-500"
                        checked={optSelected}
                        onChange={() => {
                          if (isMultiple) {
                            const cur = Array.isArray(selected) ? (selected as string[]) : []
                            setAnswer(q.id, cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id])
                          } else {
                            setAnswer(q.id, opt.id)
                          }
                        }}
                      />
                      <span className="text-sm text-navy-200">{opt.id.toUpperCase()}. {opt.text}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <div className="flex justify-end mt-4">
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>
    </div>
  )
}

const ESSAY_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-navy-800 text-navy-400',
  submitted: 'bg-cyan-900/30 text-cyan-400',
  resubmitted: 'bg-cyan-900/30 text-cyan-400',
  locked: 'bg-yellow-900/30 text-yellow-400',
  grading: 'bg-yellow-900/30 text-yellow-400',
  returned: 'bg-yellow-900/30 text-yellow-400',
  finalised: 'bg-green-900/30 text-green-400',
}

function essayStatusLabel(r: EssayResponse | null): string {
  if (!r) return 'Not started'
  if (r.status === 'finalised') return r.feedback_released ? 'Graded · Released' : 'Graded'
  return r.status.charAt(0).toUpperCase() + r.status.slice(1)
}

function EssayStatus({ questionId, isStudent }: { questionId: string; isStudent: boolean }) {
  const { data: responses = [] } = useEssayResponses(questionId)

  if (isStudent) {
    const mine: EssayResponse | null = responses[0] || null
    const badgeCls = mine ? (ESSAY_STATUS_BADGE[mine.status] || 'bg-navy-800 text-navy-400') : 'bg-navy-800 text-navy-400'
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${badgeCls}`}>
        {essayStatusLabel(mine)}
        {mine?.status === 'finalised' && mine.total_score !== null && mine.total_score !== undefined && (
          <span className="ml-1">· {mine.total_score}/{mine.question_marks}</span>
        )}
      </span>
    )
  }

  // Instructor: aggregate progress across all student responses for this question
  const submitted = responses.filter((r) => r.status !== 'draft').length
  const graded = responses.filter((r) => r.status === 'finalised').length
  const released = responses.filter((r) => r.feedback_released).length
  const firstToGrade = responses.find((r) => r.status !== 'finalised' && r.status !== 'draft')
  return (
    <span className="text-xs text-navy-300 shrink-0 text-right">
      {responses.length === 0 ? (
        <span className="text-navy-500">No submissions</span>
      ) : (
        <>
          <span className="text-cyan-400">{submitted} submitted</span>
          <span className="mx-1 text-navy-500">·</span>
          <span className="text-purple-400">{graded} graded</span>
          <span className="mx-1 text-navy-500">·</span>
          <span className="text-green-400">{released} released</span>
        </>
      )}
      {firstToGrade && (
        <Link
          to={`/essays/responses/${firstToGrade.id}`}
          className="block text-sm text-cyan-400 hover:text-cyan-300 mt-1"
        >
          Grade next →
        </Link>
      )}
    </span>
  )
}

function EssayTaskSection({ assignment, isStudent }: { assignment: Assignment; isStudent: boolean }) {
  const essayLinks = assignment.essay_question_titles || []
  if (essayLinks.length === 0) {
    return (
      <div className="card">
        <p className="text-navy-400 text-sm">No essay questions attached to this task.</p>
      </div>
    )
  }
  return (
    <div className="card">
      <h3 className="text-white font-semibold mb-3">Essay Questions</h3>
      <div className="space-y-2">
        {essayLinks.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-navy-700 bg-navy-800/40">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{e.title}</p>
              <p className="text-xs text-navy-500">{e.marks} marks</p>
            </div>
            <EssayStatus questionId={e.id} isStudent={isStudent} />
            {isStudent ? (
              <Link to={`/essays/${e.id}`} className="text-sm text-cyan-400 hover:text-cyan-300 shrink-0">
                Answer →
              </Link>
            ) : (
              <Link to="/essays" className="text-sm text-cyan-400 hover:text-cyan-300 shrink-0">
                All essays →
              </Link>
            )}
          </div>
        ))}
      </div>
      {isStudent && (
        <p className="text-xs text-navy-500 mt-3">
          Your essay answers are submitted and graded in the Essays workspace.
        </p>
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
  const mySubmission = isStudent
    ? (submissions.find((s) => s.student_email && s.content_data) || null)
    : null

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

        {assignment.video_url && videoEmbedUrl(assignment.video_url) && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <VideoEmbed url={assignment.video_url} title={`${assignment.title} video brief`} />
          </div>
        )}

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

      {/* Student task view */}
      {isStudent && assignment.status === 'published' && (
        <div className="mt-6 space-y-4">
          {assignment.task_type === 'file' && <SubmitForm assignmentId={assignment.id} attemptNumber={1} />}
          {assignment.task_type === 'mcq' && (
            <McqQuizForm assignment={assignment} existing={mySubmission} />
          )}
          {assignment.task_type === 'essay' && <EssayTaskSection assignment={assignment} isStudent />}
          {assignment.task_type === 'combined' && (
            <>
              <McqQuizForm assignment={assignment} existing={mySubmission} />
              <EssayTaskSection assignment={assignment} isStudent />
            </>
          )}
        </div>
      )}

      {/* Instructor/Admin: essay part links */}
      {(isInstructor || isAdmin) && (assignment.task_type === 'essay' || assignment.task_type === 'combined') && (
        <div className="mt-6">
          <EssayTaskSection assignment={assignment} isStudent={false} />
        </div>
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
