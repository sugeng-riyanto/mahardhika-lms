import { useState, useCallback } from 'react'
import {
  PenTool, Send, ArrowLeft, CheckCircle, Star, MessageSquare,
  ChevronDown, ChevronUp, AlertTriangle,
  RotateCcw, Eye, Layers,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEssayResponse, useEssayResponses } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { AnnotationCanvas } from '@/features/canvas/AnnotationCanvas'

export function EssayGradingPage() {
  const { responseId } = useParams<{ responseId: string }>()
  const { data: response, isLoading: responseLoading, refetch } = useEssayResponse(responseId || '')
  const { data: allResponses } = useEssayResponses(response?.question)

  // Navigate between responses
  const currentIndex = allResponses?.findIndex((r) => r.id === responseId) ?? -1
  const nextResponse = allResponses && currentIndex < allResponses.length - 1 ? allResponses[currentIndex + 1] : null
  const prevResponse = currentIndex > 0 ? allResponses?.[currentIndex - 1] : null

  const [feedbackText, setFeedbackText] = useState(response?.overall_feedback || '')
  const [returnReason, setReturnReason] = useState('')
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showCanvas, setShowCanvas] = useState(true)
  const [showRubric, setShowRubric] = useState(true)
  const [showInlineFeedbacks, setShowInlineFeedbacks] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local rubric scores state
  const [rubricScores, setRubricScores] = useState<Record<string, number>>(() => {
    const scores: Record<string, number> = {}
    response?.rubric_scores?.forEach((rs) => {
      scores[rs.criterion] = rs.score
    })
    return scores
  })
  const [rubricComments, setRubricComments] = useState<Record<string, string>>(() => {
    const comments: Record<string, string> = {}
    response?.rubric_scores?.forEach((rs) => {
      comments[rs.criterion] = rs.comment
    })
    return comments
  })

  const question = response?.question ? {
    title: response.question_title,
    marks: response.question_marks,
  } : null

  // Total score
  const totalScore = Object.values(rubricScores).reduce((a, b) => a + b, 0)
  const maxTotal = question?.marks || 100
  const percentage = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0

  const handleScoreChange = useCallback(async (criterionId: string, score: number) => {
    setRubricScores((prev) => ({ ...prev, [criterionId]: score }))

    if (!responseId) return
    try {
      // Check if score already exists
      const existing = response?.rubric_scores?.find((rs) => rs.criterion === criterionId)
      if (existing) {
        await apiClient.patch(`/essays/scores/${existing.id}/`, { score })
      } else {
        await apiClient.post('/essays/scores/', {
          response: responseId,
          criterion: criterionId,
          score,
          comment: rubricComments[criterionId] || '',
        })
      }
    } catch {
      // Handle silently
    }
  }, [responseId, response, rubricComments])

  const handleCommentChange = useCallback((criterionId: string, comment: string) => {
    setRubricComments((prev) => ({ ...prev, [criterionId]: comment }))
  }, [])

  const handleStartGrading = async () => {
    if (!responseId) return
    setSaving(true)
    try {
      await apiClient.post(`/essays/responses/${responseId}/start-grading/`)
      refetch()
    } catch {
      // Handle error
    } finally {
      setSaving(false)
    }
  }

  const handleReleaseGrade = async () => {
    if (!responseId) return
    setSaving(true)
    try {
      // Save all rubric scores first
      for (const [criterionId, score] of Object.entries(rubricScores)) {
        const existing = response?.rubric_scores?.find((rs) => rs.criterion === criterionId)
        if (existing) {
          await apiClient.patch(`/essays/scores/${existing.id}/`, { score, comment: rubricComments[criterionId] || '' })
        } else {
          await apiClient.post('/essays/scores/', {
            response: responseId,
            criterion: criterionId,
            score,
            comment: rubricComments[criterionId] || '',
          })
        }
      }
      // Save overall feedback
      if (feedbackText) {
        await apiClient.patch(`/essays/responses/${responseId}/`, {
          overall_feedback: feedbackText,
        })
      }
      // Release grade
      await apiClient.post(`/essays/responses/${responseId}/release-grade/`)
      refetch()
    } catch {
      // Handle error
    } finally {
      setSaving(false)
    }
  }

  const handleReturnForRevision = async () => {
    if (!responseId) return
    setSaving(true)
    try {
      await apiClient.post(`/essays/responses/${responseId}/return-for-revision/`, {
        reason: returnReason,
        overall_feedback: feedbackText,
      })
      setShowReturnModal(false)
      setReturnReason('')
      refetch()
    } catch {
      // Handle error
    } finally {
      setSaving(false)
    }
  }

  const handleSaveInlineFeedback = async (comment: string, anchorType: string = 'general') => {
    if (!responseId || !comment.trim()) return
    try {
      await apiClient.post('/essays/feedback/', {
        response: responseId,
        anchor_type: anchorType,
        comment: comment.trim(),
        is_visible_to_student: true,
      })
      refetch()
    } catch {
      // Handle error
    }
  }

  if (responseLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="page-container">
        <div className="card p-8 text-center">
          <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Response Not Found</h2>
          <p className="text-sm text-navy-400 mb-4">This essay response could not be loaded.</p>
          <Link to="/essays" className="btn-primary">Back to Essays</Link>
        </div>
      </div>
    )
  }



  return (
    <div className="page-container">
      {/* Back link */}
      <Link to="/essays" className="inline-flex items-center gap-1 text-sm text-navy-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={14} />
        Back to Essays
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PenTool className="text-purple-400" size={24} />
          <div>
            <h1 className="page-title mb-0">{response.question_title}</h1>
            <p className="text-sm text-navy-400">
              Grading: {response.student_name || response.student_email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Navigation */}
          {prevResponse && (
            <Link to={`/essays/responses/${prevResponse.id}`} className="btn-secondary text-xs px-2 py-1">
              <ArrowLeft size={12} />
            </Link>
          )}
          {allResponses && (
            <span className="text-xs text-navy-400">
              {currentIndex + 1} / {allResponses.length}
            </span>
          )}
          {nextResponse && (
            <Link to={`/essays/responses/${nextResponse.id}`} className="btn-secondary text-xs px-2 py-1">
              Next
            </Link>
          )}
          <div className="text-right">
            <p className="text-[10px] text-navy-400">Score</p>
            <p className="text-lg font-bold text-white">{totalScore}<span className="text-sm text-navy-500">/{maxTotal}</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-navy-400">Grade</p>
            <p className={`text-lg font-bold ${percentage >= 80 ? 'text-green-400' : percentage >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {percentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Student info bar */}
      <div className="card p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-cyan-600 flex items-center justify-center text-xs font-medium text-white">
            {response.student_name?.[0] || 'S'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{response.student_name || response.student_email}</p>
            <p className="text-[10px] text-navy-500">
              Submitted {response.submitted_at ? new Date(response.submitted_at).toLocaleDateString() : 'Not yet'}
              {response.is_late && <span className="text-red-400 ml-1">(Late)</span>}
              {response.version > 1 && <span className="text-yellow-400 ml-1">v{response.version}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge text-[10px] ${
            response.status === 'finalised' ? 'badge-success' :
            response.status === 'returned' ? 'bg-orange-900/30 text-orange-400' :
            response.status === 'grading' ? 'bg-purple-900/30 text-purple-400' :
            response.status === 'submitted' ? 'bg-cyan-900/30 text-cyan-400' :
            'bg-navy-800 text-navy-400'
          }`}>
            {response.status}
          </span>
          {response.marked_by_email && (
            <span className="text-[10px] text-navy-500">
              Graded by {response.marked_by_email}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Canvas/Answer area (3/4) */}
        <div className="xl:col-span-3">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Student Work</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCanvas(!showCanvas)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    showCanvas
                      ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
                      : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                  }`}
                >
                  {showCanvas ? <Eye size={12} className="inline mr-1" /> : <Layers size={12} className="inline mr-1" />}
                  {showCanvas ? 'Hide Canvas' : 'Show Canvas'}
                </button>
              </div>
            </div>

            {showCanvas ? (
              <div className="bg-navy-800/50 border border-navy-700 rounded-lg p-2">
                <AnnotationCanvas isTeacher={true} isLocked={false} />
              </div>
            ) : (
              <div className="bg-navy-800/50 border border-navy-700 rounded-lg p-4">
                <p className="text-xs text-navy-400 mb-2">Typed Answer:</p>
                <p className="text-sm text-navy-200 whitespace-pre-wrap">{response.typed_answer || 'No typed answer provided.'}</p>
              </div>
            )}
          </div>

          {/* Inline feedback area */}
          <div className="card p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Inline Feedback</h3>
              </div>
              <button
                onClick={() => setShowInlineFeedbacks(!showInlineFeedbacks)}
                className="text-navy-400 hover:text-white"
              >
                {showInlineFeedbacks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {showInlineFeedbacks && (
              <>
                {/* Existing feedbacks */}
                {response.inline_feedbacks && response.inline_feedbacks.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {response.inline_feedbacks.map((fb) => (
                      <div key={fb.id} className="bg-navy-800/50 rounded p-3 border-l-2 border-purple-500">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-purple-400">{fb.anchor_type} feedback</span>
                          <span className="text-[10px] text-navy-500">
                            {new Date(fb.created_at).toLocaleString()}
                          </span>
                        </div>
                        {fb.selected_text && (
                          <p className="text-[10px] text-navy-400 italic mb-1">"{fb.selected_text}"</p>
                        )}
                        <p className="text-xs text-navy-200">{fb.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-navy-500 mb-3">No inline feedback yet.</p>
                )}

                {/* Add new feedback */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    className="flex-1 bg-navy-800/50 border border-navy-700 rounded-lg px-3 py-2 text-xs text-navy-200 placeholder-navy-500 focus:outline-none focus:border-cyan-700"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        handleSaveInlineFeedback(e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar (1/4) */}
        <div className="xl:col-span-1 space-y-4">
          {/* Rubric Panel */}
          <div className="card">
            <button
              onClick={() => setShowRubric(!showRubric)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-400" />
                <span className="text-sm font-semibold text-white">Rubric</span>
                <span className="badge text-[10px] bg-navy-800 text-navy-400">{totalScore}/{maxTotal}</span>
              </div>
              {showRubric ? <ChevronUp size={14} className="text-navy-400" /> : <ChevronDown size={14} className="text-navy-400" />}
            </button>

            {showRubric && response.rubric_scores && (
              <div className="px-4 pb-4 space-y-3 border-t border-navy-700 pt-3">
                {/* Score bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-navy-400">Overall Score</span>
                    <span className={`font-medium ${percentage >= 80 ? 'text-green-400' : percentage >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {response.rubric_scores.map((rs) => (
                  <div key={rs.id} className="bg-navy-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-white">{rs.criterion_name}</p>
                      <span className="text-xs text-navy-400">
                        <input
                          type="number"
                          value={rubricScores[rs.criterion] ?? rs.score ?? 0}
                          onChange={(e) => handleScoreChange(rs.criterion, parseFloat(e.target.value) || 0)}
                          className="w-12 bg-navy-900 border border-navy-700 rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none focus:border-cyan-700"
                          min={0}
                          max={rs.criterion_max_score}
                          step={0.5}
                        />
                        /{rs.criterion_max_score}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={rubricComments[rs.criterion] ?? rs.comment ?? ''}
                      onChange={(e) => handleCommentChange(rs.criterion, e.target.value)}
                      placeholder="Add criterion comment..."
                      className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1 text-[10px] text-navy-300 placeholder-navy-600 focus:outline-none focus:border-cyan-700 mt-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overall Feedback */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-purple-400" />
              <span className="text-xs font-semibold text-white">Overall Feedback</span>
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Write overall feedback for the student..."
              className="w-full min-h-[80px] bg-navy-800/50 border border-navy-700 rounded-lg p-3 text-xs text-navy-200 placeholder-navy-500 focus:outline-none focus:border-cyan-700 resize-y"
            />
          </div>

          {/* Actions */}
          <div className="card p-4 space-y-3">
            {response.status === 'submitted' && !response.feedback_released && (
              <button
                onClick={handleStartGrading}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <PenTool size={14} />
                {saving ? 'Starting...' : 'Start Grading'}
              </button>
            )}

            {(response.status === 'grading' || response.status === 'submitted') && (
              <>
                <button
                  onClick={handleReleaseGrade}
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  {saving ? 'Releasing...' : 'Release Grade'}
                </button>
                <button
                  onClick={() => setShowReturnModal(true)}
                  disabled={saving}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} />
                  Return for Revision
                </button>
              </>
            )}

            {response.status === 'finalised' && (
              <div className="text-center">
                <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm text-navy-300">Grade released</p>
                <p className="text-[10px] text-navy-500">
                  {response.feedback_released_at
                    ? `Released ${new Date(response.feedback_released_at).toLocaleDateString()}`
                    : 'Grade has been finalised'}
                </p>
              </div>
            )}

            {response.status === 'returned' && (
              <div className="text-center">
                <RotateCcw size={24} className="text-orange-400 mx-auto mb-2" />
                <p className="text-sm text-navy-300">Returned for revision</p>
                {response.return_reason && (
                  <p className="text-[10px] text-navy-500 mt-1">{response.return_reason}</p>
                )}
              </div>
            )}
          </div>

          {/* Layer Legend */}
          <div className="card p-4">
            <p className="text-xs font-medium text-white mb-2">Layer Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-navy-300">Question (read-only)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-navy-300">Student Work</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-navy-300">Teacher Feedback</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-navy-300">Student Revision</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return for Revision Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Return for Revision</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-navy-400 mb-1 block">Reason (visible to student)</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g., Please add more detail in step 3..."
                  className="w-full bg-navy-800/50 border border-navy-700 rounded-lg px-3 py-2 text-sm text-navy-200 placeholder-navy-500 focus:outline-none focus:border-cyan-700"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnForRevision}
                  disabled={saving || !returnReason.trim()}
                  className="btn-primary text-sm"
                >
                  {saving ? 'Returning...' : 'Return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
