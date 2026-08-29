import { useState } from 'react'
import {
  PenTool, Clock, CheckCircle, AlertTriangle, Star,
  Users, FileText, Plus, Send, Edit, Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEssayQuestions, useEssayResponses } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { CrudModal, type CrudField } from '@/components/CrudModal'
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

const SUBMIT_ESSAY_FIELDS: CrudField[] = [
  { name: 'response_text', label: 'Your Essay', type: 'textarea', required: true, placeholder: 'Write your essay here...' },
]

const ESSAY_FIELDS: CrudField[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Essay question title' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Essay prompt...' },
  { name: 'marks', label: 'Max Marks', type: 'number', required: true, placeholder: '100' },
  { name: 'difficulty', label: 'Difficulty', type: 'select', options: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ]},
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ]},
]

interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'submit' | 'view'
  data: Record<string, unknown>
}

export function EssayListPage() {
  const { roles } = useAuth()
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'create', data: {} })
  const { data: questions, isLoading: questionsLoading, refetch: refetchQ } = useEssayQuestions()
  const { data: responses, isLoading: responsesLoading, refetch: refetchR } = useEssayResponses()

  const isInstructor = roles.some((r) => ['owner', 'admin', 'instructor'].includes(r))
  const isStudent = roles.includes('student')

  const isLoading = questionsLoading || responsesLoading

  const openSubmit = (q: EssayQuestion) => setModal({
    isOpen: true, mode: 'submit',
    data: { question_id: q.id, question_title: q.title, response_text: '' },
  })

  const openCreateEssay = () => setModal({
    isOpen: true, mode: 'create',
    data: { title: '', description: '', marks: 100, difficulty: 'medium', status: 'draft' },
  })

  const openEditEssay = (q: EssayQuestion) => setModal({
    isOpen: true, mode: 'edit',
    data: { id: q.id, title: q.title, description: q.description || '', marks: q.marks, difficulty: q.difficulty || 'medium', status: q.status },
  })

  const openDeleteEssay = (q: EssayQuestion) => setModal({
    isOpen: true, mode: 'delete',
    data: { id: q.id, title: q.title },
  })

  const handleSave = async (data: Record<string, unknown>) => {
    if (modal.mode === 'submit' && data.question_id) {
      await apiClient.post('/essays/responses/', {
        question: data.question_id,
        typed_answer: data.response_text,
      })
      await refetchR()
    } else if (modal.mode === 'create') {
      await apiClient.post('/essays/', data)
      await refetchQ()
    } else if (modal.mode === 'edit' && data.id) {
      await apiClient.patch(`/essays/${data.id}/`, data)
      await refetchQ()
    }
    setModal({ isOpen: false, mode: 'create', data: {} })
  }

  const handleDelete = async () => {
    if (modal.data.id) {
      await apiClient.delete(`/essays/${modal.data.id}/`)
      await refetchQ()
      setModal({ isOpen: false, mode: 'create', data: {} })
    }
  }

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
          <button onClick={openCreateEssay} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} />
            New Essay
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions */}
        {(
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
                  <div key={q.id} className="relative">
                    <QuestionCard question={q} />
                    <div className="absolute top-4 right-4 flex items-center gap-1">
                      {isStudent && (
                        <button
                          onClick={() => openSubmit(q)}
                          className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"
                        >
                          <Send size={12} />
                          Submit
                        </button>
                      )}
                      {isInstructor && (
                        <>
                          <button
                            onClick={() => openEditEssay(q)}
                            className="p-1.5 text-navy-400 hover:text-yellow-400 transition-colors"
                            title="Edit essay"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => openDeleteEssay(q)}
                            className="p-1.5 text-navy-400 hover:text-red-400 transition-colors"
                            title="Delete essay"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
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

      {/* CRUD Modal */}
      <CrudModal
        isOpen={modal.isOpen}
        mode={modal.mode === 'submit' ? 'create' : modal.mode}
        title={
          modal.mode === 'submit' ? `Submit Essay: ${modal.data.question_title || ''}` :
          modal.mode === 'delete' ? `Delete Essay: ${modal.data.title || ''}` :
          'Essay Question'
        }
        fields={modal.mode === 'submit' ? SUBMIT_ESSAY_FIELDS : ESSAY_FIELDS}
        data={modal.data}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModal({ isOpen: false, mode: 'create', data: {} })}
      />
    </div>
  )
}
