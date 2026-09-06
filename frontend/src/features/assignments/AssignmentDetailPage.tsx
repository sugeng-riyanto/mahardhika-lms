import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ClipboardList, Clock, FileText, Users, CheckCircle, Send,
  ArrowLeft, Star, MessageSquare, AlertCircle, Upload, X, Loader2,
  ZoomIn, ZoomOut, Printer,
} from 'lucide-react'
import { VideoEmbed } from '@/components/VideoEmbed'
import { videoEmbedUrl } from '@/utils/videoEmbed'
import { PrintSheetModal } from './PrintSheetModal'
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

function SubmissionCard({ sub, assignment }: { sub: AssignmentSubmission; assignment: Assignment }) {
  const statusCls = STATUS_BADGE[sub.status] || 'bg-navy-800 text-navy-400'
  const [printOpen, setPrintOpen] = useState(false)
  const hasMcqResults = Array.isArray(sub.content_data?.mcq_results)

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-white font-medium">Attempt #{sub.attempt_number}</p>
          <p className="text-navy-400 text-sm">
            {sub.student_email} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Not submitted'}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {hasMcqResults && (
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="p-1.5 rounded-md border border-navy-700 text-navy-300 hover:text-cyan-400 hover:border-cyan-500 transition-colors"
              title="Print answer sheet"
              aria-label="Print answer sheet"
            >
              <Printer size={14} />
            </button>
          )}
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusCls}`}>
            {sub.status}
          </span>
        </span>
      </div>
      {hasMcqResults && (
        <PrintSheetModal
          assignment={assignment}
          submission={sub}
          isOpen={printOpen}
          onClose={() => setPrintOpen(false)}
        />
      )}

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

function ExamAnswerSheet({ assignment, existing, isStudent }: {
  assignment: Assignment
  existing?: AssignmentSubmission | null
  isStudent: boolean
}) {
  const questions: AssignmentQuestion[] = assignment.questions || []
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [printOpen, setPrintOpen] = useState(false)

  const results = (existing?.content_data?.mcq_results as
    | { question_id: string; correct: boolean }[]
    | undefined) || null
  const finished = Boolean(isStudent && existing && results)

  const letters = (q: AssignmentQuestion): string[] => (q.options || []).map((o) => o.id)
  const isMultiple = (q: AssignmentQuestion): boolean => q.question_type === 'multiple_select'

  const isMarked = (q: AssignmentQuestion, letter: string): boolean => {
    if (finished) {
      const r = results!.find((res) => res.question_id === q.id)
      if (!r) return false
      // Show the student's own answer (green if right, red if wrong)
      const answersMap = (existing!.content_data.mcq_answers ?? {}) as Record<string, string | string[]>
      const mine = answersMap[q.id]
      if (Array.isArray(mine)) return mine.includes(letter)
      return mine === letter
    }
    if (!isStudent) {
      // Instructor: highlight the correct key
      return Array.isArray(q.correct_answer) && q.correct_answer.includes(letter)
    }
    const sel = answers[q.id]
    if (Array.isArray(sel)) return sel.includes(letter)
    return sel === letter
  }

  const bubbleClass = (q: AssignmentQuestion, letter: string): string => {
    const marked = isMarked(q, letter)
    if (finished) {
      const r = results!.find((res) => res.question_id === q.id)
      const correct = r?.correct && marked
      const wrong = r && !r.correct && marked
      if (correct) return 'bg-green-600 border-green-500 text-white'
      if (wrong) return 'bg-red-600 border-red-500 text-white'
      return 'border-navy-600 text-navy-500'
    }
    if (!isStudent) {
      return marked ? 'bg-green-600 border-green-500 text-white' : 'border-navy-600 text-navy-500'
    }
    return marked ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-navy-600 text-navy-400 hover:border-cyan-500'
  }

  const toggle = (q: AssignmentQuestion, letter: string) => {
    if (isMultiple(q)) {
      const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
      setAnswers((prev) => ({
        ...prev,
        [q.id]: cur.includes(letter) ? cur.filter((x) => x !== letter) : [...cur, letter],
      }))
    } else {
      setAnswers((prev) => ({ ...prev, [q.id]: letter }))
    }
  }

  const handleSubmit = async () => {
    const missing = questions.filter((q) => {
      const a = answers[q.id]
      if (isMultiple(q)) return !a || (a as string[]).length === 0
      return !a
    })
    if (missing.length > 0) {
      setError('Answer every question on the sheet before submitting.')
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Answer Sheet</h3>
        {!isStudent && (
          <span className="text-xs text-navy-400">Green = correct answer (key)</span>
        )}
      </div>
      <div className="space-y-1.5">
        {questions.map((q, idx) => (
          <div key={q.id} className="flex items-center gap-2 py-1 border-b border-navy-800 last:border-0">
            <span className="w-8 shrink-0 text-sm text-navy-300 font-medium">{idx + 1}.</span>
            <div className="flex flex-wrap gap-1.5">
              {letters(q).map((letter) => (
                <button
                  key={letter}
                  type="button"
                  disabled={finished || !isStudent}
                  onClick={() => toggle(q, letter)}
                  className={`w-9 h-9 rounded-full border text-sm font-semibold flex items-center justify-center transition-colors ${
                    bubbleClass(q, letter)
                  } ${isStudent && !finished ? 'cursor-pointer' : 'cursor-default'}`}
                  aria-label={`Question ${idx + 1} option ${letter.toUpperCase()}`}
                >
                  {letter.toUpperCase()}
                </button>
              ))}
              {isMultiple(q) && <span className="text-[10px] text-navy-500 self-center">multi</span>}
            </div>
          </div>
        ))}
      </div>
      {isStudent && !finished && (
        <div className="mt-3">
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      )}
      {finished && existing && (
        <div className="mt-3 p-3 rounded-lg bg-green-900/20 border border-green-700/30 flex flex-wrap items-center gap-3">
          <p className="text-sm text-green-400 font-medium flex items-center gap-2">
            <CheckCircle size={16} />
            Score: {existing.score} ({String(existing.content_data.mcq_score)}/{String(existing.content_data.mcq_total)} points)
          </p>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-green-700/50 text-green-400 text-sm hover:bg-green-900/30 transition-colors"
          >
            <Printer size={14} /> Print answer sheet
          </button>
        </div>
      )}
      {finished && existing && (
        <PrintSheetModal
          assignment={assignment}
          submission={existing}
          isOpen={printOpen}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  )
}

function ExamPaper({ assignment, isStudent, existing }: {
  assignment: Assignment
  isStudent: boolean
  existing?: AssignmentSubmission | null
}) {
  const pages = assignment.exam_pages || []
  const [scale, setScale] = useState(1) // multiplier on top of the base mode
  const [mode, setMode] = useState<'fit' | 'actual'>('fit')

  const zoomIn = () => setScale((s) => Math.min(3, Math.round(s * 1.25 * 100) / 100))
  const zoomOut = () => setScale((s) => Math.max(0.5, Math.round(s * 0.8 * 100) / 100))

  const toolbarBtn =
    'p-1.5 rounded-md border transition-colors ' +
    'border-navy-700 light:border-gray-300 text-navy-300 light:text-gray-600 ' +
    'hover:bg-navy-700 light:hover:bg-gray-100 disabled:opacity-40'
  const modeBtn = (active: boolean) =>
    `px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${active
      ? 'border-cyan-500/60 bg-cyan-600/15 text-cyan-400 light:text-cyan-700'
      : 'border-navy-700 light:border-gray-300 text-navy-300 light:text-gray-600 hover:bg-navy-700 light:hover:bg-gray-100'}`

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-white light:text-gray-900 font-semibold">Exam Paper</h3>
          <span className="text-xs text-navy-400 light:text-gray-500">
            {assignment.exam_pdf_name || 'PDF'} · {pages.length} page{pages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Zoom toolbar — responsive, wraps on small screens */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Zoom controls">
          <button type="button" onClick={zoomOut} disabled={scale <= 0.5} className={toolbarBtn} aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium text-navy-300 light:text-gray-600 w-12 text-center">
            {mode === 'actual' ? '1:1' : `${Math.round(scale * 100)}%`}
          </span>
          <button type="button" onClick={zoomIn} disabled={scale >= 3} className={toolbarBtn} aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <span className="w-px h-5 bg-navy-700 light:bg-gray-300 hidden sm:block" />
          <button
            type="button"
            onClick={() => { setMode('fit'); setScale(1) }}
            className={modeBtn(mode === 'fit' && scale === 1)}
          >
            Fit width
          </button>
          <button
            type="button"
            onClick={() => { setMode('actual'); setScale(1) }}
            className={modeBtn(mode === 'actual')}
          >
            Actual size
          </button>
        </div>
      </div>

      {pages.length === 0 ? (
        <p className="text-navy-500 light:text-gray-500 text-sm">No exam pages available.</p>
      ) : (
        <div className={mode === 'actual' ? 'overflow-x-auto' : ''}>
          <div className={`space-y-4 ${mode === 'actual' ? 'min-w-max' : ''}`}>
            {pages.map((page, i) => (
              <div key={i} className="space-y-2">
                <ExamPageImage
                  src={page}
                  pageNumber={i + 1}
                  scale={scale}
                  mode={mode}
                />
                {isStudent && existing && (
                  <PageReview
                    pageNumber={i + 1}
                    questions={assignment.questions || []}
                    existing={existing}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(assignment.essay_question_titles?.length ?? 0) > 0 && (
        <div className="pt-2 border-t border-navy-700 light:border-gray-200">
          <EssayTaskSection assignment={assignment} isStudent={isStudent} />
        </div>
      )}
    </div>
  )
}

function ExamPageImage({ src, pageNumber, scale, mode }: {
  src: string
  pageNumber: number
  scale: number
  mode: 'fit' | 'actual'
}) {
  const [naturalW, setNaturalW] = useState<number | null>(null)
  const width = mode === 'actual' && naturalW ? Math.round(naturalW * scale) : undefined
  return (
    <figure className="rounded-lg overflow-hidden border border-navy-700 light:border-gray-300 bg-navy-950 light:bg-gray-100">
      <div className="overflow-x-auto">
        <img
          src={src}
          alt={`Exam page ${pageNumber}`}
          className="h-auto mx-auto"
          style={{
            width: width !== undefined ? `${width}px` : `${scale * 100}%`,
            maxWidth: width !== undefined ? 'none' : undefined,
          }}
          onLoad={(e) => {
            const nw = e.currentTarget.naturalWidth
            if (nw) setNaturalW(nw)
          }}
        />
      </div>      <figcaption className="text-center text-xs text-navy-500 light:text-gray-500 py-1">Page {pageNumber}</figcaption>
    </figure>
  )
}

interface McqResult {
  question_id: string
  prompt?: string
  answer?: string | string[]
  correct: boolean
  key?: string[]
  points?: number
  explanation?: string
}

/**
 * Post-submission review for students: the bubbles they marked on this PDF
 * page, coloured against the key (green = right, red = wrong, ring = the
 * correct answer they missed).
 */
function PageReview({ pageNumber, questions, existing }: {
  pageNumber: number
  questions: AssignmentQuestion[]
  existing: AssignmentSubmission
}) {
  const results = (existing.content_data?.mcq_results as McqResult[] | undefined) || []
  const answers = (existing.content_data?.mcq_answers ?? {}) as Record<string, string | string[]>
  const onPage = questions.filter((q) => (q.page || 1) === pageNumber)
  if (onPage.length === 0) return null

  return (
    <div className="rounded-lg border border-navy-700 light:border-gray-300 bg-navy-900/70 light:bg-gray-50 p-3">
      <p className="text-xs font-medium text-navy-300 light:text-gray-600 mb-2">
        Review — your marks on this page
      </p>
      <div className="space-y-2">
        {onPage.map((q) => {
          const r = results.find((res) => res.question_id === q.id)
          const mine = answers[q.id]
          const mineArr = Array.isArray(mine) ? mine : mine ? [mine] : []
          const key = r?.key || []
          const bubble = (letter: string) => {
            const marked = mineArr.includes(letter)
            if (marked) return r?.correct
              ? 'bg-green-600 border-green-500 text-white'
              : 'bg-red-600 border-red-500 text-white'
            if (key.includes(letter)) return 'border-cyan-500 ring-2 ring-cyan-500/40 text-cyan-400 light:text-cyan-700'
            return 'border-navy-600 text-navy-500'
          }
          return (
            <div key={q.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-navy-300 light:text-gray-600 font-medium">
                {r?.correct ? '✓' : '✗'}
              </span>
              <span className="w-7 shrink-0 text-xs text-navy-400">Q{q.order + 1}</span>
              <div className="flex flex-wrap gap-1">
                {(q.options || []).map((o) => (
                  <span
                    key={o.id}
                    className={`w-7 h-7 rounded-full border text-xs font-semibold flex items-center justify-center ${bubble(o.id)}`}
                  >
                    {o.id.toUpperCase()}
                  </span>
                ))}
              </div>
              <span className="text-xs text-navy-400 light:text-gray-500">
                {r ? `${r.points ?? q.points} pt` : `${q.points} pt`}
              </span>
              {r?.explanation && (
                <span className="text-xs text-navy-500 light:text-gray-500 w-full">
                  {r.explanation}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-navy-500 light:text-gray-500 mt-2">
        Green/red = your answer · cyan ring = correct answer
      </p>
    </div>
  )
}


function ExamView({ assignment, isStudent, existing }: {
  assignment: Assignment
  isStudent: boolean
  existing?: AssignmentSubmission | null
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
      {/* Left sidebar: answer sheet */}
      <aside className="lg:sticky lg:top-20">
        <ExamAnswerSheet assignment={assignment} existing={existing} isStudent={isStudent} />
      </aside>

      {/* Main: the exam paper pages */}
      <ExamPaper assignment={assignment} isStudent={isStudent} existing={existing} />
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
          {assignment.task_type === 'exam' && (
            <ExamView assignment={assignment} isStudent existing={mySubmission} />
          )}
        </div>
      )}

      {/* Instructor/Admin: exam paper + answer key, essay part links */}
      {(isInstructor || isAdmin) && assignment.task_type === 'exam' && (
        <div className="mt-6">
          <ExamView assignment={assignment} isStudent={false} existing={null} />
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
                <SubmissionCard key={sub.id} sub={sub} assignment={assignment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
