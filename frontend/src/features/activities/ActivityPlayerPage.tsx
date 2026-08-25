import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useActivity, useActivityQuestions, useAttempts,
  useCreateAttempt, useSubmitAttempt, useCreateResponse,
} from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle,
  Trophy, Send, RotateCcw, AlertCircle,
} from 'lucide-react'
import { BranchingScenarioPlayer, type ScenarioGraph } from './BranchingScenarioPlayer'

export function ActivityPlayerPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const { roles } = useAuth()
  const isStudent = roles.includes('student')

  const { data: activity } = useActivity(activityId || '')
  const { data: questions = [] } = useActivityQuestions(activityId || '')
  const { data: attempts = [] } = useAttempts(activityId || '')
  const createAttempt = useCreateAttempt()
  const submitAttempt = useSubmitAttempt()
  const createResponse = useCreateResponse()

  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { selected: string | string[] }>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const isBranchingScenario = activity?.activity_type === 'branching_scenario'

  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)
  const currentQuestion = sortedQuestions[currentIdx]
  const totalPoints = sortedQuestions.reduce((s, q) => s + q.points, 0)
  const answeredCount = Object.keys(answers).length

  // Find existing submitted attempt
  const existingSubmitted = attempts.find(
    (a) => a.status === 'submitted' || a.status === 'graded'
  )

  // Timer
  useEffect(() => {
    if (!activity?.time_limit_minutes || submitted || existingSubmitted) return
    setTimeLeft(activity.time_limit_minutes * 60)
  }, [activity, submitted, existingSubmitted])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev !== null && prev <= 1) {
          handleAutoSubmit()
          return 0
        }
        return prev !== null ? prev - 1 : prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, submitted])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleStartAttempt = useCallback(async () => {
    if (!activityId) return
    try {
      const attempt = await createAttempt.mutateAsync({ activity: activityId })
      setCurrentAttemptId(attempt.id)
    } catch {
      // ignore
    }
  }, [activityId, createAttempt])

  const handleSelectAnswer = useCallback((questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { selected: value } }))
  }, [])

  const handleAutoSubmit = useCallback(async () => {
    if (!currentAttemptId || submitted) return
    // Save all pending responses
    for (const q of sortedQuestions) {
      const answer = answers[q.id]
      if (answer) {
        try {
          await createResponse.mutateAsync({
            attempt: currentAttemptId,
            question: q.id,
            answer_data: answer,
          })
        } catch {
          // ignore
        }
      }
    }
    try {
      const res = await submitAttempt.mutateAsync(currentAttemptId)
      setResult(res)
      setSubmitted(true)
    } catch {
      // ignore
    }
  }, [currentAttemptId, submitted, sortedQuestions, answers, createResponse, submitAttempt])

  const handleSubmit = useCallback(async () => {
    if (!currentAttemptId) return
    // Save all responses first
    for (const q of sortedQuestions) {
      const answer = answers[q.id]
      if (answer) {
        try {
          await createResponse.mutateAsync({
            attempt: currentAttemptId,
            question: q.id,
            answer_data: answer,
          })
        } catch {
          // ignore
        }
      }
    }
    try {
      const res = await submitAttempt.mutateAsync(currentAttemptId)
      setResult(res)
      setSubmitted(true)
    } catch {
      // ignore
    }
  }, [currentAttemptId, sortedQuestions, answers, createResponse, submitAttempt])

  // Branching Scenario player
  if (isBranchingScenario && activity) {
    const graph = activity.content as unknown as ScenarioGraph
    if (!graph || !graph.start_node || !graph.nodes) {
      return (
        <div className="max-w-3xl mx-auto text-center py-20">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Invalid Scenario</h2>
          <p className="text-navy-400">This branching scenario has no content graph configured.</p>
        </div>
      )
    }

    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={18} /> Back
        </button>
        <BranchingScenarioPlayer
          graph={graph}
          activityTitle={activity.title}
          onComplete={(result) => {
            setResult({
              attempt: {
                score: result.score,
                max_score: result.maxScore,
                percentage: result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0,
                letter_grade: result.outcome === 'success' ? 'A' : result.outcome === 'partial' ? 'C' : 'F',
                passed: result.outcome === 'success',
              },
              path: result.path,
            })
            setSubmitted(true)
          }}
        />
      </div>
    )
  }

  // Instructor view
  if (!isStudent) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-white mb-2">{activity?.title || 'Activity'}</h1>
          <p className="text-navy-400 mb-4">{activity?.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-navy-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-cyan-400">{activity?.question_count || sortedQuestions.length}</p>
              <p className="text-navy-400 text-sm">Questions</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{totalPoints}</p>
              <p className="text-navy-400 text-sm">Total Points</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{activity?.max_attempts || 1}</p>
              <p className="text-navy-400 text-sm">Max Attempts</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{activity?.pass_mark_percentage || 50}%</p>
              <p className="text-navy-400 text-sm">Pass Mark</p>
            </div>
          </div>
        </div>

        {/* Questions list for instructor */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Questions</h2>
          <div className="space-y-3">
            {sortedQuestions.map((q, i) => (
              <div key={q.id} className="bg-navy-900 border border-navy-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-cyan-400 uppercase">
                      Q{i + 1} • {q.question_type.replace('_', ' ')} • {q.points} pts
                    </span>
                    <p className="text-white mt-1">{q.prompt}</p>
                    <div className="mt-2 space-y-1">
                      {(q.options as unknown as { id: string; text: string }[])?.map((opt: { id: string; text: string }) => (
                        <div key={opt.id} className={`text-sm px-3 py-1.5 rounded flex items-center gap-2 ${
                          opt.id === q.correct_answer
                            ? 'bg-green-900/30 text-green-400 border border-green-800'
                            : 'bg-navy-800 text-navy-300'
                        }`}>
                          <span className="font-medium uppercase">{opt.id}</span> {opt.text}
                          {opt.id === q.correct_answer && <CheckCircle2 size={14} className="ml-auto" />}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="text-navy-400 text-sm mt-2 italic">💡 {q.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Student — Results view
  if (submitted && result) {
    const r = result as { attempt?: { score?: number; max_score?: number; percentage?: number; letter_grade?: string; passed?: boolean }; responses?: Array<{ is_correct?: boolean; score?: number; max_score?: number; question_prompt?: string; correct_answer?: unknown; explanation?: string }> }
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/courses')} className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Back to Courses
        </button>

        <div className="bg-navy-800 border border-navy-700 rounded-xl p-8 text-center">
          <Trophy size={48} className={`mx-auto mb-4 ${r.attempt?.passed ? 'text-yellow-400' : 'text-navy-500'}`} />
          <h1 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h1>
          <p className="text-navy-400 mb-6">{activity?.title}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-3xl font-bold text-cyan-400">{r.attempt?.score ?? 0}</p>
              <p className="text-navy-400 text-sm">Score</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-3xl font-bold text-purple-400">{r.attempt?.percentage ?? 0}%</p>
              <p className="text-navy-400 text-sm">Percentage</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4">
              <p className={`text-3xl font-bold ${r.attempt?.passed ? 'text-green-400' : 'text-red-400'}`}>
                {r.attempt?.letter_grade || '-'}
              </p>
              <p className="text-navy-400 text-sm">Grade</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4">
              <p className={`text-3xl font-bold ${r.attempt?.passed ? 'text-green-400' : 'text-red-400'}`}>
                {r.attempt?.passed ? 'PASSED' : 'FAILED'}
              </p>
              <p className="text-navy-400 text-sm">Result</p>
            </div>
          </div>
        </div>

        {/* Response details */}
        {r.responses && r.responses.length > 0 && (
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Review Answers</h2>
            <div className="space-y-3">
              {r.responses.map((resp, i) => (
                <div key={i} className={`border rounded-lg p-4 ${
                  resp.is_correct ? 'border-green-800 bg-green-900/10' : 'border-red-800 bg-red-900/10'
                }`}>
                  <div className="flex items-start gap-3">
                    {resp.is_correct ? (
                      <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-white font-medium">Q{i + 1}: {resp.question_prompt}</p>
                      <p className="text-sm text-navy-400 mt-1">
                        Score: {resp.score}/{resp.max_score}
                      </p>
                      {resp.correct_answer !== undefined && (
                        <p className="text-sm text-green-400 mt-1">
                          Correct answer: {String(resp.correct_answer)}
                        </p>
                      )}
                      {resp.explanation && (
                        <p className="text-sm text-navy-300 mt-1 italic">💡 {resp.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/courses')}
            className="flex-1 py-3 bg-navy-700 hover:bg-navy-600 text-white rounded-xl font-medium transition-colors"
          >
            Back to Courses
          </button>
          {!existingSubmitted && (
            <button
              onClick={() => { setSubmitted(false); setResult(null); setCurrentAttemptId(null); setAnswers({}); setCurrentIdx(0) }}
              className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} /> Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  // Student — Start screen
  if (!currentAttemptId && !existingSubmitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{activity?.title || 'Activity'}</h1>
          <p className="text-navy-400 mb-6">{activity?.description || 'Test your knowledge'}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-xl font-bold text-cyan-400">{sortedQuestions.length}</p>
              <p className="text-navy-400 text-sm">Questions</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-xl font-bold text-purple-400">{totalPoints} pts</p>
              <p className="text-navy-400 text-sm">Total Points</p>
            </div>
            {activity?.time_limit_minutes && (
              <div className="bg-navy-900 rounded-lg p-4">
                <p className="text-xl font-bold text-yellow-400">{activity.time_limit_minutes} min</p>
                <p className="text-navy-400 text-sm">Time Limit</p>
              </div>
            )}
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-xl font-bold text-green-400">{activity?.pass_mark_percentage || 50}%</p>
              <p className="text-navy-400 text-sm">Pass Mark</p>
            </div>
          </div>

          {attempts.length > 0 && (
            <div className="bg-navy-900 rounded-lg p-4 mb-6">
              <p className="text-navy-400 text-sm">Previous attempts: {attempts.length}</p>
            </div>
          )}

          <button
            onClick={handleStartAttempt}
            disabled={createAttempt.isPending}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50"
          >
            {createAttempt.isPending ? 'Starting...' : 'Start Quiz'}
          </button>
        </div>
      </div>
    )
  }

  // Student — Show submitted attempt
  if (existingSubmitted && !submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-8 text-center">
          <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Already Submitted</h1>
          <p className="text-navy-400 mb-2">You have already submitted this activity.</p>
          <div className="bg-navy-900 rounded-lg p-4 inline-block mt-4">
            <p className="text-sm text-navy-400">Your Score</p>
            <p className="text-3xl font-bold text-cyan-400">{existingSubmitted.score ?? '-'}/{existingSubmitted.max_score ?? '-'}</p>
            <p className="text-sm text-navy-400 mt-1">
              {existingSubmitted.percentage != null ? `${existingSubmitted.percentage}%` : ''} {existingSubmitted.letter_grade}
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={() => navigate('/courses')}
              className="py-3 px-6 bg-navy-700 hover:bg-navy-600 text-white rounded-xl font-medium transition-colors"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Student — Quiz in progress
  if (!currentQuestion) return null

  const progress = sortedQuestions.length > 0 ? ((currentIdx + 1) / sortedQuestions.length) * 100 : 0

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-navy-800 border border-navy-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-navy-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-white font-semibold text-sm">{activity?.title}</h1>
            <p className="text-navy-400 text-xs">{answeredCount}/{sortedQuestions.length} answered</p>
          </div>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            timeLeft < 60 ? 'bg-red-900/50 text-red-400' : 'bg-navy-700 text-white'
          }`}>
            <Clock size={16} />
            <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-1">
        <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium text-cyan-400 uppercase px-2 py-1 bg-cyan-900/30 rounded">
            Q{currentIdx + 1} of {sortedQuestions.length}
          </span>
          <span className="text-xs font-medium text-purple-400 uppercase px-2 py-1 bg-purple-900/30 rounded">
            {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
          </span>
          <span className="text-xs font-medium text-navy-400 uppercase px-2 py-1 bg-navy-700 rounded">
            {currentQuestion.question_type.replace('_', ' ')}
          </span>
        </div>

        <p className="text-white text-lg mb-6">{currentQuestion.prompt}</p>

        {/* Options */}
        <div className="space-y-3">
          {(currentQuestion.options as unknown as { id: string; text: string }[])?.map((opt: { id: string; text: string }) => {
            const selected = answers[currentQuestion.id]?.selected
            const isSelected = currentQuestion.question_type === 'multiple_select'
              ? Array.isArray(selected) && selected.includes(opt.id)
              : selected === opt.id

            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (currentQuestion.question_type === 'multiple_select') {
                    const current = Array.isArray(selected) ? [...selected] : []
                    if (current.includes(opt.id)) {
                      handleSelectAnswer(currentQuestion.id, current.filter((s) => s !== opt.id))
                    } else {
                      handleSelectAnswer(currentQuestion.id, [...current, opt.id])
                    }
                  } else {
                    handleSelectAnswer(currentQuestion.id, opt.id)
                  }
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-900/20 text-white'
                    : 'border-navy-600 bg-navy-900 text-navy-300 hover:border-navy-500 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 ${
                    isSelected ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400' : 'border-navy-600 text-navy-400'
                  }`}>
                    {isSelected ? '✓' : opt.id.toUpperCase()}
                  </span>
                  <span>{opt.text}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 border border-navy-700 text-white rounded-xl font-medium transition-colors hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={18} /> Previous
        </button>

        {/* Question dots */}
        <div className="flex gap-1.5">
          {sortedQuestions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === currentIdx
                  ? 'bg-cyan-400 scale-125'
                  : answers[q.id]
                    ? 'bg-green-500'
                    : 'bg-navy-600 hover:bg-navy-500'
              }`}
              title={`Question ${i + 1}`}
            />
          ))}
        </div>

        {currentIdx < sortedQuestions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx((i) => i + 1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 border border-navy-700 text-white rounded-xl font-medium transition-colors hover:bg-navy-700"
          >
            Next <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitAttempt.isPending || answeredCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
          >
            <Send size={18} />
            {submitAttempt.isPending ? 'Submitting...' : 'Submit'}
          </button>
        )}
      </div>

      {/* Unanswered warning */}
      {answeredCount < sortedQuestions.length && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-800 rounded-xl px-4 py-3">
          <AlertCircle size={16} />
          You have {sortedQuestions.length - answeredCount} unanswered question(s).
        </div>
      )}
    </div>
  )
}
