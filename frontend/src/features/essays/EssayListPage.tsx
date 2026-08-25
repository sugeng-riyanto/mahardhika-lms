import {
  PenTool, Clock, CheckCircle, AlertTriangle, Star,
  Users, FileText, Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEssayQuestions, useEssayResponses } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import type { EssayQuestion, EssayResponse } from '@/types'

function QuestionCard({ question }: { question: EssayQuestion }) {
  const statusColors = {
    draft: 'bg-navy-800 text-navy-400',
    published: 'bg-green-900/30 text-green-400',
    archived: 'bg-red-900/30 text-red-400',
  }
  const difficultyColors = {
    easy: 'bg-green-900/30 text-green-400',
    medium: 'bg-yellow-900/30 text-yellow-400',
    hard: 'bg-red-900/30 text-red-400',
  }

  return (
    <Link to={`/essays/${question.id}`} className="card p-4 hover:border-cyan-700/50 transition-colors block">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{question.title}</h3>
        <span className={`badge text-[10px] ${statusColors[question.status]}`}>
          {question.status}
        </span>
      </div>
      {question.description && (
        <p className="text-xs text-navy-400 mb-3 line-clamp-2">{question.description}</p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-navy-500">
        <span className="flex items-center gap-1">
          <Star size={10} className="text-yellow-400" />
          {question.marks} marks
        </span>
        {question.difficulty && (
          <span className={`badge text-[9px] ${difficultyColors[question.difficulty]}`}>
            {question.difficulty}
          </span>
        )}
        {question.course_title && (
          <span className="flex items-center gap-1">
            <FileText size={10} />
            {question.course_title}
          </span>
        )}
        {question.max_time_minutes && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {question.max_time_minutes}min
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users size={10} />
          {question.response_count || 0} responses
        </span>
      </div>
    </Link>
  )
}

function ResponseCard({ response }: { response: EssayResponse }) {
  const statusColors = {
    draft: 'bg-navy-800 text-navy-400',
    submitted: 'bg-cyan-900/30 text-cyan-400',
    locked: 'bg-navy-800 text-navy-400',
    grading: 'bg-purple-900/30 text-purple-400',
    returned: 'bg-orange-900/30 text-orange-400',
    resubmitted: 'bg-cyan-900/30 text-cyan-400',
    finalised: 'badge-success',
  }

  return (
    <Link to={`/essays/responses/${response.id}`} className="card p-4 hover:border-cyan-700/50 transition-colors block">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{response.question_title}</h3>
          <p className="text-xs text-navy-400">
            {response.student_name || response.student_email}
          </p>
        </div>
        <span className={`badge text-[10px] ${statusColors[response.status]}`}>
          {response.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-navy-500">
        {response.submitted_at && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {new Date(response.submitted_at).toLocaleDateString()}
          </span>
        )}
        {response.is_late && (
          <span className="text-red-400">Late</span>
        )}
        {response.version > 1 && (
          <span>v{response.version}</span>
        )}
        {response.total_score != null && (
          <span className="flex items-center gap-1">
            <Star size={10} className="text-yellow-400" />
            {response.total_score}/{response.question_marks}
          </span>
        )}
        {response.feedback_released && (
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle size={10} />
            Released
          </span>
        )}
      </div>
    </Link>
  )
}

export function EssayListPage() {
  const { roles } = useAuth()
  const { data: questions, isLoading: questionsLoading } = useEssayQuestions()
  const { data: responses, isLoading: responsesLoading } = useEssayResponses()

  const isInstructor = roles.some((r) => ['owner', 'admin', 'instructor'].includes(r))

  const isLoading = questionsLoading || responsesLoading

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PenTool className="text-purple-400" size={24} />
          <div>
            <h1 className="page-title mb-0">Essay Assessment</h1>
            <p className="text-sm text-navy-400">
              {isInstructor ? 'Manage essay questions and grade submissions' : 'Complete essay assignments and view feedback'}
            </p>
          </div>
        </div>
        {isInstructor && (
          <Link to="/essays/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} />
            New Essay
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions (Instructor view) */}
        {isInstructor && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FileText size={14} className="text-cyan-400" />
              Essay Questions
              {questions && (
                <span className="badge text-[10px] bg-navy-800 text-navy-400">{questions.length}</span>
              )}
            </h2>
            {questions && questions.length > 0 ? (
              <div className="space-y-3">
                {questions.map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
              </div>
            ) : (
              <div className="card p-6 text-center">
                <PenTool size={32} className="text-navy-600 mx-auto mb-3" />
                <p className="text-sm text-navy-400">No essay questions yet</p>
                <p className="text-xs text-navy-500 mt-1">Create your first essay question to get started</p>
              </div>
            )}
          </div>
        )}

        {/* Responses */}
        <div className={isInstructor ? '' : 'lg:col-span-2'}>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Users size={14} className="text-green-400" />
            {isInstructor ? 'Student Responses' : 'My Responses'}
            {responses && (
              <span className="badge text-[10px] bg-navy-800 text-navy-400">{responses.length}</span>
            )}
          </h2>
          {responses && responses.length > 0 ? (
            <div className="space-y-3">
              {responses.map((r) => (
                <ResponseCard key={r.id} response={r} />
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <AlertTriangle size={32} className="text-navy-600 mx-auto mb-3" />
              <p className="text-sm text-navy-400">
                {isInstructor ? 'No responses yet' : 'No essay assignments yet'}
              </p>
              <p className="text-xs text-navy-500 mt-1">
                {isInstructor
                  ? 'Responses will appear here when students submit their essays'
                  : 'Essay assignments will appear here when teachers publish them'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
