import { useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2, Plus, Trash2, HelpCircle, FileText, ListChecks, PenLine } from 'lucide-react'
import { apiClient } from '@/api/client'
import { useCourses, useEssayQuestions } from '@/api/hooks'
import type { Assignment, AssignmentQuestion } from '@/types'

export type TaskType = 'file' | 'mcq' | 'essay' | 'combined'

const TASK_TYPE_OPTIONS: { value: TaskType; label: string; hint: string }[] = [
  { value: 'file', label: 'File / Text', hint: 'Students write an answer or upload a file' },
  { value: 'mcq', label: 'Multiple Choice Quiz', hint: 'Auto-graded quiz with MCQ / True-False questions' },
  { value: 'essay', label: 'Essay Task', hint: 'Students answer an essay question with a rubric' },
  { value: 'combined', label: 'Combined (MCQ + Essay)', hint: 'Quiz part auto-graded, essay part graded manually' },
]

interface DraftQuestion {
  question_type: AssignmentQuestion['question_type']
  prompt: string
  optionTexts: string[]
  correct: string[]
  points: number
}

interface AssignmentTaskModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  assignment: Assignment | null
  onClose: () => void
  onSaved: () => void
}

const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

function emptyQuestion(): DraftQuestion {
  return { question_type: 'multiple_choice', prompt: '', optionTexts: ['', '', '', ''], correct: [], points: 1 }
}

function toDraftQuestions(questions?: AssignmentQuestion[]): DraftQuestion[] {
  if (!questions || questions.length === 0) return []
  return questions.map((q) => ({
    question_type: q.question_type,
    prompt: q.prompt,
    optionTexts: OPTION_LETTERS.map((l) => {
      const opt = (q.options || []).find((o) => o.id === l)
      return opt ? opt.text : ''
    }),
    correct: Array.isArray(q.correct_answer) ? q.correct_answer : [],
    points: q.points,
  }))
}

export function AssignmentTaskModal({ isOpen, mode, assignment, onClose, onSaved }: AssignmentTaskModalProps) {
  const { data: courses = [] } = useCourses()
  const { data: essayData } = useEssayQuestions()
  const essayQuestions = useMemo(
    () => (essayData || []).filter((q) => q.status === 'published'),
    [essayData]
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [course, setCourse] = useState('')
  const [maxScore, setMaxScore] = useState(100)
  const [dueDate, setDueDate] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [status, setStatus] = useState('draft')
  const [taskType, setTaskType] = useState<TaskType>('file')
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [essayIds, setEssayIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setTitle(assignment?.title || '')
    setDescription(assignment?.description || '')
    setCourse(assignment?.course || '')
    setMaxScore(assignment?.max_score ?? 100)
    setDueDate(assignment?.due_date ? String(assignment.due_date).slice(0, 10) : '')
    setVideoUrl(assignment?.video_url || '')
    setStatus(assignment?.status || 'draft')
    setTaskType((assignment?.task_type as TaskType) || 'file')
    setQuestions(toDraftQuestions(assignment?.questions))
    setEssayIds(assignment?.essay_questions || [])
    setError('')
  }, [isOpen, assignment])

  if (!isOpen) return null

  const showMcq = taskType === 'mcq' || taskType === 'combined'
  const showEssay = taskType === 'essay' || taskType === 'combined'

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const updateOption = (qIdx: number, optIdx: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q
      return { ...q, optionTexts: q.optionTexts.map((t, oi) => (oi === optIdx ? text : t)) }
    }))
  }

  const toggleCorrect = (qIdx: number, letter: string, isMultiple: boolean) => {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q
      if (isMultiple) {
        const correct = q.correct.includes(letter)
          ? q.correct.filter((c) => c !== letter)
          : [...q.correct, letter]
        return { ...q, correct }
      }
      return { ...q, correct: [letter] }
    }))
  }

  const validate = (): string => {
    if (!title.trim()) return 'Title is required'
    if (!course) return 'Course is required'
    if (showMcq) {
      if (questions.length === 0) return 'Add at least one question for this task'
      for (const q of questions) {
        if (!q.prompt.trim()) return 'Every question needs a prompt'
        const filled = q.optionTexts.filter((t) => t.trim()).length
        if (filled < 2) return 'Every question needs at least 2 options'
        if (q.correct.length === 0) return 'Mark the correct answer for every question'
        if (q.question_type !== 'multiple_select' && q.correct.length > 1) return 'MCQ / True-False allows exactly one correct answer'
      }
    }
    if (showEssay && essayIds.length === 0) return 'Select at least one essay question'
    return ''
  }

  const handleSave = async () => {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description,
        course,
        max_score: Number(maxScore) || 100,
        due_date: dueDate || null,
        video_url: videoUrl,
        status,
        task_type: taskType,
      }
      if (showMcq) {
        payload.questions = questions.map((q) => ({
          question_type: q.question_type,
          prompt: q.prompt.trim(),
          options: OPTION_LETTERS.slice(0, q.optionTexts.length)
            .map((l, i) => ({ id: l, text: q.optionTexts[i]?.trim() || '' }))
            .filter((o) => o.text),
          correct_answer: q.correct,
          points: Number(q.points) || 1,
        }))
      }
      if (showEssay) payload.essay_questions = essayIds

      if (mode === 'edit' && assignment) {
        await apiClient.patch(`/assignments/${assignment.id}/`, payload)
      } else {
        await apiClient.post('/assignments/', payload)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700 sticky top-0 bg-navy-900 z-10">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'create' ? 'Create Assignment' : 'Edit Assignment'}
          </h2>
          <button onClick={onClose} className="p-1 text-navy-400 hover:text-white transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Task type */}
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">Task Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TASK_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTaskType(opt.value)
                    if (opt.value === 'mcq' && questions.length === 0) setQuestions([emptyQuestion()])
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    taskType === opt.value
                      ? 'border-cyan-400 bg-cyan-900/20'
                      : 'border-navy-700 bg-navy-800 hover:border-navy-500'
                  }`}
                >
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    {opt.value === 'file' && <FileText size={14} className="text-navy-400" />}
                    {opt.value === 'mcq' && <ListChecks size={14} className="text-cyan-400" />}
                    {opt.value === 'essay' && <PenLine size={14} className="text-purple-400" />}
                    {opt.value === 'combined' && <HelpCircle size={14} className="text-teal-400" />}
                    {opt.label}
                  </p>
                  <p className="text-xs text-navy-500 mt-1">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-navy-300 mb-1">Title *</label>
              <input className="input-field w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-navy-300 mb-1">Description</label>
              <textarea className="input-field w-full min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should students do?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Course *</label>
              <select className="input-field w-full" value={course} onChange={(e) => setCourse(e.target.value)}>
                <option value="">Select course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Max Score</label>
              <input type="number" className="input-field w-full" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Due Date</label>
              <input type="date" className="input-field w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Status</label>
              <select className="input-field w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-navy-300 mb-1">Video Brief (YouTube / Google Drive)</label>
              <input className="input-field w-full" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... or https://drive.google.com/file/d/.../preview" />
            </div>
          </div>

          {/* MCQ question builder */}
          {showMcq && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">Questions ({questions.length})</h3>
                <button
                  type="button"
                  onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
                  className="btn-secondary text-xs flex items-center gap-1 px-2 py-1"
                >
                  <Plus size={14} /> Add Question
                </button>
              </div>
              {questions.length === 0 && (
                <p className="text-xs text-navy-500 mb-2">Add at least one question to build the quiz.</p>
              )}
              <div className="space-y-4">
                {questions.map((q, qIdx) => {
                  const isMultiple = q.question_type === 'multiple_select'
                  return (
                    <div key={qIdx} className="p-3 rounded-lg border border-navy-700 bg-navy-800/60">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1">
                          <input
                            className="input-field w-full text-sm"
                            value={q.prompt}
                            onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                            placeholder={`Question ${qIdx + 1} prompt`}
                          />
                        </div>
                        <select
                          className="input-field text-sm w-36"
                          value={q.question_type}
                          onChange={(e) => updateQuestion(qIdx, {
                            question_type: e.target.value as DraftQuestion['question_type'],
                            correct: [],
                          })}
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                          <option value="multiple_select">Multiple Select</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="input-field text-sm w-16"
                            value={q.points}
                            onChange={(e) => updateQuestion(qIdx, { points: Number(e.target.value) })}
                            title="Points"
                          />
                          <button
                            type="button"
                            onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                            className="p-1.5 text-navy-400 hover:text-red-400 transition-colors"
                            aria-label="Remove question"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {q.optionTexts.map((optText, optIdx) => {
                          const letter = OPTION_LETTERS[optIdx]
                          const isCorrect = q.correct.includes(letter)
                          return (
                            <div key={optIdx} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleCorrect(qIdx, letter, isMultiple)}
                                className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  isCorrect ? 'bg-green-600 border-green-500' : 'border-navy-600 hover:border-navy-400'
                                }`}
                                title={isMultiple ? 'Toggle correct' : 'Mark correct'}
                              >
                                {isCorrect && <span className="text-white text-xs">✓</span>}
                              </button>
                              <span className="text-xs text-navy-400 w-3">{letter.toUpperCase()}.</span>
                              <input
                                className="input-field w-full text-sm"
                                value={optText}
                                onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                                placeholder={`Option ${letter.toUpperCase()}`}
                              />
                              {optIdx === q.optionTexts.length - 1 && q.optionTexts.length < 6 && (
                                <button
                                  type="button"
                                  onClick={() => updateQuestion(qIdx, { optionTexts: [...q.optionTexts, ''] })}
                                  className="p-1 text-navy-400 hover:text-cyan-400"
                                  title="Add option"
                                >
                                  <Plus size={14} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-navy-500 mt-2">
                        {isMultiple
                          ? 'Tick every correct option (multiple select)'
                          : 'Tick the correct option (✓ = correct answer)'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Essay picker */}
          {showEssay && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Essay Questions ({essayIds.length} selected)
              </h3>
              {essayQuestions.length === 0 ? (
                <p className="text-xs text-navy-500">
                  No published essay questions yet — create one first in the Essays page.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {essayQuestions.map((q) => {
                    const checked = essayIds.includes(q.id)
                    return (
                      <label
                        key={q.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          checked ? 'border-cyan-400 bg-cyan-900/20' : 'border-navy-700 bg-navy-800 hover:border-navy-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-cyan-500"
                          checked={checked}
                          onChange={() => setEssayIds((prev) =>
                            checked ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{q.title}</p>
                          <p className="text-xs text-navy-500 truncate">{q.course_title || 'No course'} · {q.marks} marks</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-navy-700 sticky bottom-0 bg-navy-900">
          <button onClick={onClose} className="px-4 py-2 text-sm text-navy-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {mode === 'create' ? 'Create' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}