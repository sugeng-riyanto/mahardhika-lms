import { useState, useEffect, useCallback } from 'react'
import {
  PenTool, Clock, Send, ArrowLeft, Save, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, FileText,
  MessageSquare, Layers, RotateCcw, Star,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEssayQuestion, useEssayResponses } from '@/api/hooks'
import type { EssayResponse } from '@/types'
import { useAuth } from '@/auth/AuthProvider'
import { MelanyAssistant } from '@/components/ai/MelanyAssistant'
import { apiClient } from '@/api/client'
import { VideoEmbed } from '@/components/VideoEmbed'
import { AnnotationCanvas } from '@/features/canvas/AnnotationCanvas'

export function EssayWorkspacePage() {
  const { questionId } = useParams<{ questionId: string }>()
  const { user } = useAuth()
  const { data: question, isLoading: questionLoading } = useEssayQuestion(questionId || '')
  const { data: responses, refetch: refetchResponses } = useEssayResponses(questionId)

  // Find student's current response. The API already scopes the list to the
  // requesting student, so match by status only — comparing against user.id
  // breaks under mock auth (fake UUIDs).
  const myResponse = responses?.find(
    (r) => r.status !== 'finalised',
  ) || responses?.[0]

  const [typedAnswer, setTypedAnswer] = useState(myResponse?.typed_answer || '')

  // Students answer fresh questions from this workspace; if no response exists
  // yet, create the draft on first save/submit instead of silently doing nothing.
  // If a concurrent autosave beat us to it, reuse that draft (unique_together
  // on question+student+version would otherwise 500).
  const ensureResponse = useCallback(async () => {
    if (myResponse) return myResponse
    try {
      const res = await apiClient.post<EssayResponse>('/essays/responses/', {
        question: questionId,
        typed_answer: typedAnswer,
      })
      await refetchResponses()
      return res
    } catch {
      const data = await apiClient.get<{ results: EssayResponse[] }>(`/essays/responses/?question=${questionId}`)
      const existing = data.results.find((r) => r.status === 'draft')
      if (existing) {
        await refetchResponses()
        return existing
      }
      throw new Error('Could not create essay response')
    }
  }, [myResponse, questionId, typedAnswer, refetchResponses, user?.id])
  const [showCanvas, setShowCanvas] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [submitting, setSubmitting] = useState(false)
  const [showRubric, setShowRubric] = useState(true)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // Load existing typed answer
  useEffect(() => {
    if (myResponse?.typed_answer) {
      setTypedAnswer(myResponse.typed_answer)
    }
  }, [myResponse?.typed_answer])

  // Countdown timer
  useEffect(() => {
    if (!question?.max_time_minutes || !myResponse?.submitted_at) return
    const deadline = new Date(new Date(myResponse.submitted_at).getTime() + question.max_time_minutes * 60000)
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = deadline.getTime() - now
      if (remaining <= 0) {
        setTimeLeft('Time expired')
        clearInterval(interval)
        return
      }
      const h = Math.floor(remaining / 3600000)
      const m = Math.floor((remaining % 3600000) / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
    }, 1000)
    return () => clearInterval(interval)
  }, [question?.max_time_minutes, myResponse?.submitted_at])

  // Autosave
  const saveDraft = useCallback(async () => {
    if (!questionId) return
    setSaving(true)
    setSaveStatus('saving')
    try {
      const resp = await ensureResponse()
      await apiClient.patch(`/essays/responses/${resp.id}/`, {
        typed_answer: typedAnswer,
      })
      setSaveStatus('saved')
    } catch {
      setSaveStatus('unsaved')
    } finally {
      setSaving(false)
    }
  }, [ensureResponse, typedAnswer, questionId])

  // Autosave on content change (also before a draft exists)
  useEffect(() => {
    if (myResponse && myResponse.status !== 'draft') return
    setSaveStatus('unsaved')
    const timer = setTimeout(saveDraft, 2000)
    return () => clearTimeout(timer)
  }, [typedAnswer, myResponse, saveDraft])

  const handleSubmit = async () => {
    if (!questionId) return
    setSubmitting(true)
    try {
      const resp = await ensureResponse()
      await apiClient.post(`/essays/responses/${resp.id}/submit/`)
      await refetchResponses()
    } catch {
      // Handle error
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitted = myResponse?.status === 'submitted' || myResponse?.status === 'finalised' || myResponse?.status === 'grading'
  const isReturned = myResponse?.status === 'returned'
  const isLocked = isSubmitted && !isReturned
  const showReleasedFeedback = myResponse?.feedback_released && myResponse?.status === 'finalised'

  if (questionLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="page-container">
        <div className="card p-8 text-center">
          <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Essay Not Found</h2>
          <p className="text-sm text-navy-400 mb-4">This essay question could not be loaded.</p>
          <Link to="/courses" className="btn-primary">Back to Courses</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Back link */}
      <Link to={question.course ? `/courses/${question.course}` : '/courses'} className="inline-flex items-center gap-1 text-sm text-navy-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={14} />
        Back to {question.course_title || 'Course'}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PenTool className="text-purple-400" size={24} />
          <div>
            <h1 className="page-title mb-0">{question.title}</h1>
            <p className="text-sm text-navy-400">
              {question.marks} marks
              {question.difficulty && (
                <span className={`ml-2 badge text-[10px] ${
                  question.difficulty === 'hard' ? 'bg-red-900/30 text-red-400' :
                  question.difficulty === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-green-900/30 text-green-400'
                }`}>
                  {question.difficulty}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {timeLeft && (
            <span className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${
              timeLeft === 'Time expired'
                ? 'bg-red-900/30 text-red-400 border-red-700/50'
                : 'bg-navy-800 text-navy-300 border-navy-700'
            }`}>
              <Clock size={12} />
              {timeLeft}
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${
            saveStatus === 'saved'
              ? 'bg-green-900/30 text-green-400 border-green-700/50'
              : saveStatus === 'saving'
              ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50'
              : 'bg-navy-800 text-navy-300 border-navy-700'
          }`}>
            {saveStatus === 'saved' ? <CheckCircle size={12} /> : saveStatus === 'saving' ? <Save size={12} className="animate-spin" /> : <Save size={12} />}
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
          {isSubmitted && (
            <span className="badge badge-success text-[10px] flex items-center gap-1">
              <CheckCircle size={10} />
              {myResponse?.status === 'finalised' ? 'Graded' : 'Submitted'}
            </span>
          )}
          {isReturned && (
            <span className="badge bg-orange-900/30 text-orange-400 text-[10px] flex items-center gap-1">
              <RotateCcw size={10} />
              Returned for Revision
            </span>
          )}
        </div>
      </div>

      {/* Return reason */}
      {isReturned && myResponse?.return_reason && (
        <div className="card p-4 mb-4 bg-orange-900/10 border border-orange-700/30">
          <div className="flex items-start gap-2">
            <RotateCcw size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-400 mb-1">Return Reason</p>
              <p className="text-sm text-navy-300">{myResponse.return_reason}</p>
              {myResponse.overall_feedback && (
                <p className="text-sm text-navy-400 mt-2 italic">{myResponse.overall_feedback}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Main content area (3/4) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Question card */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Question</h3>
            </div>
            <div className="bg-navy-800/50 rounded-lg p-4 mb-3">
              <p className="text-sm text-navy-200 whitespace-pre-wrap">{question.description}</p>
              {question.video_url && (
                <div className="mt-4">
                  <VideoEmbed url={question.video_url} title={question.title} />
                </div>
              )}
              {question.content_data && Object.keys(question.content_data).length > 0 && (
                <div className="mt-3 p-3 bg-navy-900/50 rounded border border-navy-700">
                  <p className="text-xs text-navy-400">Content Data:</p>
                  <p className="text-sm text-navy-300 mt-1">
                    {JSON.stringify(question.content_data, null, 2).slice(0, 200)}
                  </p>
                </div>
              )}
            </div>
            {question.learning_objectives && question.learning_objectives.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-navy-400 mb-1">Learning Objectives:</p>
                <div className="flex flex-wrap gap-1">
                  {question.learning_objectives.map((obj, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 bg-cyan-900/20 text-cyan-400 rounded-full border border-cyan-700/30">
                      {obj}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Answer area */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-green-400" />
                <h3 className="text-sm font-semibold text-white">Your Answer</h3>
                {myResponse && (
                  <span className="text-[10px] text-navy-500">Version {myResponse.version}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {question.allow_typed_response && (
                  <button
                    onClick={() => setShowCanvas(false)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      !showCanvas
                        ? 'bg-green-900/30 text-green-400 border-green-700/50'
                        : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                    }`}
                  >
                    <FileText size={12} className="inline mr-1" />
                    Text
                  </button>
                )}
                {question.allow_canvas_response && (
                  <button
                    onClick={() => setShowCanvas(true)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      showCanvas
                        ? 'bg-green-900/30 text-green-400 border-green-700/50'
                        : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                    }`}
                  >
                    <Layers size={12} className="inline mr-1" />
                    Canvas
                  </button>
                )}
              </div>
            </div>

            {!showCanvas ? (
              <textarea
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={isLocked}
                placeholder={isLocked ? 'Answer is locked after submission...' : 'Write your answer here...'}
                className="w-full min-h-[300px] bg-navy-800/50 border border-navy-700 rounded-lg p-4 text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-cyan-700 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
              />
            ) : (
              <div className="bg-navy-800/50 border border-navy-700 rounded-lg p-2">
                <AnnotationCanvas isTeacher={false} isLocked={isLocked} />
              </div>
            )}
          </div>

          {/* Teacher feedback (released) */}
          {showReleasedFeedback && myResponse.overall_feedback && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Teacher Feedback</h3>
              </div>
              <div className="bg-purple-900/10 border border-purple-700/30 rounded-lg p-4">
                <p className="text-sm text-navy-200 whitespace-pre-wrap">{myResponse.overall_feedback}</p>
              </div>
              {myResponse.inline_feedbacks && myResponse.inline_feedbacks.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-navy-400">Inline Comments:</p>
                  {myResponse.inline_feedbacks.map((fb) => (
                    <div key={fb.id} className="bg-navy-800/50 rounded p-2 border-l-2 border-purple-500">
                      {fb.selected_text && (
                        <p className="text-[10px] text-purple-400 italic mb-1">"{fb.selected_text}"</p>
                      )}
                      <p className="text-xs text-navy-300">{fb.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar (1/4) */}
        <div className="xl:col-span-1 space-y-4">
          {/* Score summary (if graded) */}
          {showReleasedFeedback && myResponse.total_score != null && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-white">Score</h3>
              </div>
              <div className="text-center mb-3">
                <p className="text-3xl font-bold text-white">
                  {myResponse.total_score}
                  <span className="text-lg text-navy-500">/{question.marks}</span>
                </p>
                <p className={`text-lg font-semibold ${
                  (myResponse.percentage || 0) >= 80 ? 'text-green-400' :
                  (myResponse.percentage || 0) >= 60 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {myResponse.percentage}%
                </p>
                {myResponse.letter_grade && (
                  <span className={`badge text-sm ${
                    myResponse.letter_grade.startsWith('A') ? 'bg-green-900/30 text-green-400' :
                    myResponse.letter_grade.startsWith('B') ? 'bg-cyan-900/30 text-cyan-400' :
                    myResponse.letter_grade.startsWith('C') ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {myResponse.letter_grade}
                  </span>
                )}
              </div>
              {/* Rubric scores */}
              {myResponse.rubric_scores && myResponse.rubric_scores.length > 0 && (
                <div className="space-y-2">
                  {myResponse.rubric_scores.map((rs) => (
                    <div key={rs.id} className="bg-navy-800/50 rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white">{rs.criterion_name}</span>
                        <span className="text-xs text-navy-400">{rs.score}/{rs.criterion_max_score}</span>
                      </div>
                      {rs.comment && (
                        <p className="text-[10px] text-navy-400 mt-1">{rs.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rubric reference (always visible) */}
          {question.rubric_criteria && question.rubric_criteria.length > 0 && (
            <div className="card">
              <button
                onClick={() => setShowRubric(!showRubric)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-yellow-400" />
                  <span className="text-sm font-semibold text-white">Rubric</span>
                </div>
                {showRubric ? <ChevronUp size={14} className="text-navy-400" /> : <ChevronDown size={14} className="text-navy-400" />}
              </button>
              {showRubric && (
                <div className="px-4 pb-4 space-y-2 border-t border-navy-700 pt-3">
                  {question.rubric_criteria.map((criterion) => (
                    <div key={criterion.id} className="bg-navy-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-white">{criterion.name}</p>
                        <span className="text-xs text-navy-400">{criterion.max_score} pts</span>
                      </div>
                      <p className="text-[10px] text-navy-500 mb-2">{criterion.description}</p>
                      {criterion.levels && criterion.levels.length > 0 && (
                        <div className="space-y-1">
                          {criterion.levels.map((level) => (
                            <div key={level.id} className="text-[9px] text-navy-400 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-navy-600" />
                              <span className="text-navy-300">{level.label}</span>
                              <span className="text-navy-500">({level.score}pts)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit / Actions */}
          <div className="card p-4 space-y-3">
            {isLocked && !showReleasedFeedback ? (
              <div className="text-center">
                <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm text-navy-300">Answer submitted</p>
                <p className="text-[10px] text-navy-500">Waiting for teacher feedback</p>
              </div>
            ) : isReturned ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  {submitting ? 'Submitting...' : 'Resubmit'}
                </button>
                <p className="text-[10px] text-navy-500 text-center">
                  Revise your answer and resubmit
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={saveDraft}
                  disabled={saving || isLocked}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || isLocked}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  {submitting ? 'Submitting...' : 'Submit Final'}
                </button>
              </>
            )}
          </div>

          {/* Expected time */}
          {question.max_time_minutes && (
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-navy-400" />
                <span className="text-xs text-navy-400">Expected time: {question.max_time_minutes} minutes</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Melany AI Assistant */}
      {questionId && (
        <MelanyAssistant
          activityId={questionId}
          contextType="essay"
        />
      )}
    </div>
  )
}
