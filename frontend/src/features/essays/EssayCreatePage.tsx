import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenTool, Plus, Trash2, Save, ArrowLeft, AlertCircle } from 'lucide-react'
import { apiClient } from '@/api/client'
import { useCourses } from '@/api/hooks'
import { VideoEmbed } from '@/components/VideoEmbed'
import { parseVideoUrl } from '@/utils/videoEmbed'

interface RubricCriterionInput {
  name: string
  description: string
  max_score: number
}

export function EssayCreatePage() {
  const navigate = useNavigate()
  const { data: courses = [] } = useCourses()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [marks, setMarks] = useState(100)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [expectedAnswer, setExpectedAnswer] = useState('')
  const [learningObjectives, setLearningObjectives] = useState('')
  const [maxTimeMinutes, setMaxTimeMinutes] = useState<number | ''>('')
  const [allowCanvas, setAllowCanvas] = useState(true)
  const [allowTyped, setAllowTyped] = useState(true)
  const [allowFileUpload, setAllowFileUpload] = useState(false)
  const [lateAllowed, setLateAllowed] = useState(true)
  const [latePenalty, setLatePenalty] = useState(10)
  const [videoUrl, setVideoUrl] = useState('')

  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterionInput[]>([
    { name: '', description: '', max_score: 10 },
  ])

  const addCriterion = () => {
    setRubricCriteria([...rubricCriteria, { name: '', description: '', max_score: 10 }])
  }

  const removeCriterion = (index: number) => {
    if (rubricCriteria.length <= 1) return
    setRubricCriteria(rubricCriteria.filter((_, i) => i !== index))
  }

  const updateCriterion = (index: number, field: keyof RubricCriterionInput, value: string | number) => {
    const updated = [...rubricCriteria]
    updated[index] = { ...updated[index], [field]: value }
    setRubricCriteria(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const data = {
        title,
        description,
        course: courseId || null,
        marks,
        difficulty,
        expected_answer: expectedAnswer,
        learning_objectives: learningObjectives.split('\n').filter(Boolean),
        max_time_minutes: maxTimeMinutes || null,
        allow_canvas_response: allowCanvas,
        allow_typed_response: allowTyped,
        allow_file_upload: allowFileUpload,
        late_submission_allowed: lateAllowed,
        late_penalty_percent: latePenalty,
        video_url: videoUrl.trim(),
        status: 'draft',
        content_data: {
          rubric_criteria: rubricCriteria.filter(c => c.name.trim()),
        },
      }

      await apiClient.post('/essays/questions/', data)
      navigate('/essays')
    } catch (err: unknown) {
      const error = err as { detail?: string }
      setError(error.detail || 'Failed to create essay question')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/essays')}
          className="p-2 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white transition-colors"
          aria-label="Back to essays"
        >
          <ArrowLeft size={20} />
        </button>
        <PenTool className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">Create Essay Question</h1>
      </div>
      <p className="page-subtitle mb-6">Author a new essay assessment with rubric criteria</p>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700/30 rounded-lg flex items-center gap-2" role="alert">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Question Details</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="essay-title" className="block text-sm font-medium text-navy-300 mb-2">Title *</label>
              <input
                id="essay-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="input-field w-full"
                placeholder="e.g., Newton's Laws Application Problem"
              />
            </div>
            <div>
              <label htmlFor="essay-description" className="block text-sm font-medium text-navy-300 mb-2">Description / Question Text *</label>
              <textarea
                id="essay-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={5}
                className="input-field w-full"
                placeholder="Describe the essay question, problem statement, or scenario..."
              />
            </div>
            <div>
              <label htmlFor="essay-video-url" className="block text-sm font-medium text-navy-300 mb-2">Video Prompt (optional)</label>
              <input
                id="essay-video-url"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="input-field w-full"
                placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/file/d/.../view"
              />
              <p className="text-xs text-navy-500 mt-1">Attach a YouTube or Google Drive video that students watch before answering.</p>
              {videoUrl.trim() && (
                parseVideoUrl(videoUrl)
                  ? <div className="mt-3"><VideoEmbed url={videoUrl} title={title || 'Video prompt'} /></div>
                  : <p className="text-xs text-red-400 mt-2">Not a valid YouTube or Google Drive link.</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="essay-course" className="block text-sm font-medium text-navy-300 mb-2">Course</label>
                <select
                  id="essay-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">No course (standalone)</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="essay-marks" className="block text-sm font-medium text-navy-300 mb-2">Max Marks</label>
                <input
                  id="essay-marks"
                  type="number"
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  min={1}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label htmlFor="essay-difficulty" className="block text-sm font-medium text-navy-300 mb-2">Difficulty</label>
                <select
                  id="essay-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  className="input-field w-full"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Objectives & Expected Answer */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Assessment Guide</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="learning-objectives" className="block text-sm font-medium text-navy-300 mb-2">Learning Objectives (one per line)</label>
              <textarea
                id="learning-objectives"
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
                rows={3}
                className="input-field w-full"
                placeholder="Apply Newton's second law to solve real-world problems&#10;Identify forces acting on an object&#10;Draw and interpret free-body diagrams"
              />
            </div>
            <div>
              <label htmlFor="expected-answer" className="block text-sm font-medium text-navy-300 mb-2">Expected Answer / Marking Guide</label>
              <textarea
                id="expected-answer"
                value={expectedAnswer}
                onChange={(e) => setExpectedAnswer(e.target.value)}
                rows={4}
                className="input-field w-full"
                placeholder="Describe what a good answer should include..."
              />
            </div>
          </div>
        </div>

        {/* Rubric Criteria */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Rubric Criteria</h2>
            <button
              type="button"
              onClick={addCriterion}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Plus size={14} /> Add Criterion
            </button>
          </div>
          <div className="space-y-4">
            {rubricCriteria.map((criterion, index) => (
              <div key={index} className="p-4 bg-navy-800/50 rounded-lg border border-navy-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-navy-400">Criterion {index + 1}</span>
                  {rubricCriteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(index)}
                      className="p-1 text-navy-500 hover:text-red-400 transition-colors"
                      aria-label={`Remove criterion ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`criterion-name-${index}`} className="sr-only">Criterion name</label>
                    <input
                      id={`criterion-name-${index}`}
                      type="text"
                      value={criterion.name}
                      onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                      className="input-field w-full"
                      placeholder="e.g., Mathematical Reasoning"
                    />
                  </div>
                  <div>
                    <label htmlFor={`criterion-score-${index}`} className="sr-only">Max score</label>
                    <input
                      id={`criterion-score-${index}`}
                      type="number"
                      value={criterion.max_score}
                      onChange={(e) => updateCriterion(index, 'max_score', Number(e.target.value))}
                      min={1}
                      className="input-field w-full"
                      placeholder="Max score"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label htmlFor={`criterion-desc-${index}`} className="sr-only">Description</label>
                  <textarea
                    id={`criterion-desc-${index}`}
                    value={criterion.description}
                    onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                    rows={2}
                    className="input-field w-full"
                    placeholder="What this criterion evaluates..."
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-navy-500 mt-3">
            Total rubric max: {rubricCriteria.reduce((sum, c) => sum + c.max_score, 0)} marks
          </p>
        </div>

        {/* Submission Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Submission Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="allow-canvas"
                  checked={allowCanvas}
                  onChange={(e) => setAllowCanvas(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-navy-700 border-navy-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="allow-canvas" className="text-sm text-navy-300">Canvas Drawing</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="allow-typed"
                  checked={allowTyped}
                  onChange={(e) => setAllowTyped(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-navy-700 border-navy-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="allow-typed" className="text-sm text-navy-300">Typed Response</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="allow-file"
                  checked={allowFileUpload}
                  onChange={(e) => setAllowFileUpload(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-navy-700 border-navy-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="allow-file" className="text-sm text-navy-300">File Upload</label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="max-time" className="block text-sm font-medium text-navy-300 mb-2">Time Limit (minutes, optional)</label>
                <input
                  id="max-time"
                  type="number"
                  value={maxTimeMinutes}
                  onChange={(e) => setMaxTimeMinutes(e.target.value ? Number(e.target.value) : '')}
                  min={1}
                  className="input-field w-full"
                  placeholder="No limit"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="late-allowed"
                    checked={lateAllowed}
                    onChange={(e) => setLateAllowed(e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-navy-700 border-navy-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="late-allowed" className="text-sm text-navy-300">Allow Late Submissions</label>
                </div>
                {lateAllowed && (
                  <div>
                    <label htmlFor="late-penalty" className="block text-sm text-navy-400 mb-1">Late Penalty (% per day)</label>
                    <input
                      id="late-penalty"
                      type="number"
                      value={latePenalty}
                      onChange={(e) => setLatePenalty(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="input-field w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/essays')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !description.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  )
}
