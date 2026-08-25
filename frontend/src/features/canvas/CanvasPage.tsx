import { useState } from 'react'
import {
  PenTool, Clock, CheckCircle, Send, ArrowLeft, Download, History,
  Star, ChevronDown, ChevronUp, RefreshCw, AlertTriangle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnnotationCanvas } from './AnnotationCanvas'
import type { RubricCriterion, CanvasStroke, LayerType } from './types'

// Rubric template for Math-Physics
const DEFAULT_RUBRIC: RubricCriterion[] = [
  {
    id: 'rc1', name: 'Mathematical Reasoning', description: 'Demonstrates clear logical reasoning throughout the solution',
    max_score: 20, score: null,
    levels: [
      { label: 'Excellent', description: 'Clear, logical, complete reasoning', score: 20 },
      { label: 'Good', description: 'Mostly clear with minor gaps', score: 16 },
      { label: 'Satisfactory', description: 'Basic reasoning present', score: 12 },
      { label: 'Needs Work', description: 'Incomplete or unclear reasoning', score: 8 },
    ],
  },
  {
    id: 'rc2', name: 'Formula Selection', description: 'Correctly identifies and applies the appropriate formula',
    max_score: 20, score: null,
    levels: [
      { label: 'Excellent', description: 'Perfect formula choice and application', score: 20 },
      { label: 'Good', description: 'Correct formula, minor application error', score: 16 },
      { label: 'Satisfactory', description: 'Approximately correct formula', score: 12 },
      { label: 'Needs Work', description: 'Incorrect or missing formula', score: 8 },
    ],
  },
  {
    id: 'rc3', name: 'Calculation', description: 'Performs calculations accurately',
    max_score: 20, score: null,
    levels: [
      { label: 'Excellent', description: 'All calculations correct', score: 20 },
      { label: 'Good', description: 'One minor arithmetic error', score: 16 },
      { label: 'Satisfactory', description: 'Method correct, some errors', score: 12 },
      { label: 'Needs Work', description: 'Significant calculation errors', score: 8 },
    ],
  },
  {
    id: 'rc4', name: 'Units', description: 'Includes correct units in the final answer',
    max_score: 10, score: null,
    levels: [
      { label: 'Excellent', description: 'Correct units throughout', score: 10 },
      { label: 'Good', description: 'Units present but inconsistent', score: 8 },
      { label: 'Satisfactory', description: 'Units in final answer only', score: 5 },
      { label: 'Needs Work', description: 'No units or incorrect', score: 2 },
    ],
  },
  {
    id: 'rc5', name: 'Diagram', description: 'Includes a clear and relevant diagram or visual',
    max_score: 15, score: null,
    levels: [
      { label: 'Excellent', description: 'Clear, labelled, accurate diagram', score: 15 },
      { label: 'Good', description: 'Good diagram, minor labelling gaps', score: 12 },
      { label: 'Satisfactory', description: 'Basic diagram present', score: 9 },
      { label: 'Needs Work', description: 'Missing or unclear diagram', score: 5 },
    ],
  },
  {
    id: 'rc6', name: 'Explanation Quality', description: 'Provides clear explanation of the solution process',
    max_score: 15, score: null,
    levels: [
      { label: 'Excellent', description: 'Thorough, clear explanation', score: 15 },
      { label: 'Good', description: 'Good explanation, some detail missing', score: 12 },
      { label: 'Satisfactory', description: 'Basic explanation', score: 9 },
      { label: 'Needs Work', description: 'Minimal or unclear explanation', score: 5 },
    ],
  },
]

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Draft', color: 'text-navy-400 bg-navy-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-yellow-400 bg-yellow-900/30', icon: Clock },
  submitted: { label: 'Submitted', color: 'text-green-400 bg-green-900/30', icon: CheckCircle },
  under_review: { label: 'Under Review', color: 'text-cyan-400 bg-cyan-900/30', icon: RefreshCw },
  returned: { label: 'Returned', color: 'text-orange-400 bg-orange-900/30', icon: ArrowLeft },
  finalised: { label: 'Finalised', color: 'text-green-400 bg-green-900/30', icon: CheckCircle },
}

interface VersionHistoryEntry {
  id: string
  version_number: number
  author_email: string
  description: string
  created_at: string
}

export function CanvasPage() {
  const [isTeacher, setIsTeacher] = useState(true)
  const [showRubric, setShowRubric] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [rubric, setRubric] = useState(DEFAULT_RUBRIC)
  const [documentVersion, setDocumentVersion] = useState(1)
  const [canvasStatus, setCanvasStatus] = useState('in_progress')
  const [versions, setVersions] = useState<VersionHistoryEntry[]>([
    { id: 'v1', version_number: 1, author_email: 'student@mahardhika.id', description: 'Draft autosaved', created_at: '2026-08-25T14:02:00Z' },
  ])
  const [overallFeedback, setOverallFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  // Toggle role for demo
  const toggleRole = () => setIsTeacher((prev) => !prev)

  const totalScore = rubric.reduce((sum, c) => sum + (c.score || 0), 0)
  const maxTotal = rubric.reduce((sum, c) => sum + c.max_score, 0)
  const percentage = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0

  const handleScoreChange = (criterionId: string, score: number) => {
    setRubric((prev) => prev.map((c) => c.id === criterionId ? { ...c, score } : c))
  }

  const handleSave = (_layeredStrokes: Record<LayerType, CanvasStroke[]>) => {
    setDocumentVersion((v) => v + 1)
    // In production: POST /api/v1/canvas/{id}/autosave/
    const newVersion: VersionHistoryEntry = {
      id: `v${documentVersion + 1}`,
      version_number: documentVersion + 1,
      author_email: isTeacher ? 'instructor@mahardhika.id' : 'student@mahardhika.id',
      description: `${isTeacher ? 'Teacher' : 'Student'} autosave`,
      created_at: new Date().toISOString(),
    }
    setVersions((prev) => [newVersion, ...prev])
  }

  const handleSubmit = () => {
    setCanvasStatus('submitted')
    const newVersion: VersionHistoryEntry = {
      id: `v${documentVersion + 1}`,
      version_number: documentVersion + 1,
      author_email: 'student@mahardhika.id',
      description: 'Final submission',
      created_at: new Date().toISOString(),
    }
    setVersions((prev) => [newVersion, ...prev])
    setDocumentVersion((v) => v + 1)
  }

  const handleReturnRevision = () => {
    setCanvasStatus('returned')
    const newVersion: VersionHistoryEntry = {
      id: `v${documentVersion + 1}`,
      version_number: documentVersion + 1,
      author_email: 'instructor@mahardhika.id',
      description: 'Returned for revision',
      created_at: new Date().toISOString(),
    }
    setVersions((prev) => [newVersion, ...prev])
    setDocumentVersion((v) => v + 1)
  }

  const statusMeta = STATUS_META[canvasStatus] || STATUS_META.draft
  const StatusIcon = statusMeta.icon

  return (
    <div className="page-container">
      {/* Back link */}
      <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-navy-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={14} />
        Back to Courses
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PenTool className="text-purple-400" size={24} />
          <div>
            <h1 className="page-title mb-0">Annotation Canvas</h1>
            <p className="text-sm text-navy-400">Q1: Newton&apos;s Second Law — Physics 10</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleRole} className="text-[10px] px-2 py-1 rounded border border-navy-700 text-navy-400 hover:text-white hover:bg-navy-800 transition-colors">
            Role: {isTeacher ? 'Instructor' : 'Student'}
          </button>
          <span className="flex items-center gap-1 text-xs text-navy-400">
            <Clock size={12} />
            {canvasStatus === 'submitted' ? 'Submitted' : 'Auto-saved'}
          </span>
          <span className={`badge text-[10px] flex items-center gap-1 ${statusMeta.color}`}>
            <StatusIcon size={10} />
            {statusMeta.label}
          </span>
          <button className="btn-secondary text-sm flex items-center gap-1">
            <Download size={14} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Student info bar */}
      <div className="card p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-cyan-600 flex items-center justify-center text-xs font-medium text-white">
            S
          </div>
          <div>
            <p className="text-sm font-medium text-white">Student Mahardhika</p>
            <p className="text-[10px] text-navy-500">student@mahardhika.id — v{documentVersion}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-navy-400">Score</p>
            <p className="text-lg font-bold text-green-400">{totalScore}<span className="text-sm text-navy-500">/{maxTotal}</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-navy-400">Grade</p>
            <p className={`text-lg font-bold ${percentage >= 80 ? 'text-green-400' : percentage >= 60 ? 'text-yellow-400' : percentage > 0 ? 'text-red-400' : 'text-navy-500'}`}>
              {percentage > 0 ? `${percentage}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Canvas (3/4 width) */}
        <div className="xl:col-span-3">
          <div className="card p-4">
            <AnnotationCanvas
              isTeacher={isTeacher}
              isLocked={canvasStatus === 'submitted' || canvasStatus === 'finalised'}
              onSave={handleSave}
              documentVersion={documentVersion}
            />
          </div>
        </div>

        {/* Sidebar (1/4 width) */}
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
                {totalScore > 0 && <span className="badge text-[10px] bg-navy-800 text-navy-400">{totalScore}/{maxTotal}</span>}
              </div>
              {showRubric ? <ChevronUp size={14} className="text-navy-400" /> : <ChevronDown size={14} className="text-navy-400" />}
            </button>

            {showRubric && (
              <div className="px-4 pb-4 space-y-3 border-t border-navy-700 pt-3">
                {/* Score bar */}
                {totalScore > 0 && (
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
                )}

                {rubric.map((criterion) => (
                  <div key={criterion.id} className="bg-navy-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-white">{criterion.name}</p>
                      <span className="text-xs text-navy-400">{criterion.score ?? '—'}/{criterion.max_score}</span>
                    </div>
                    <p className="text-[10px] text-navy-500 mb-2">{criterion.description}</p>

                    {/* Level buttons */}
                    <div className="grid grid-cols-2 gap-1">
                      {criterion.levels.map((level) => (
                        <button
                          key={level.label}
                          onClick={() => isTeacher && handleScoreChange(criterion.id, level.score)}
                          className={`text-[9px] px-2 py-1.5 rounded border text-left transition-colors ${
                            criterion.score === level.score
                              ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
                              : 'bg-navy-900 text-navy-400 border-navy-700 hover:text-white'
                          } ${!isTeacher ? 'cursor-default' : ''}`}
                        >
                          <span className="font-medium">{level.label}</span>
                          <span className="block text-navy-500">{level.score}pts</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version History */}
          <div className="card">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <History size={16} className="text-cyan-400" />
                <span className="text-sm font-semibold text-white">Version History</span>
                <span className="badge text-[10px] bg-navy-800 text-navy-400">{versions.length}</span>
              </div>
              {showHistory ? <ChevronUp size={14} className="text-navy-400" /> : <ChevronDown size={14} className="text-navy-400" />}
            </button>

            {showHistory && (
              <div className="px-4 pb-4 border-t border-navy-700 pt-3 space-y-2 max-h-64 overflow-y-auto">
                {versions.map((version, idx) => (
                  <div key={version.id} className={`p-2 rounded-lg text-xs ${idx === 0 ? 'bg-navy-800/80 border border-navy-600' : 'bg-navy-800/30'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">v{version.version_number}</span>
                      <span className="text-[10px] text-navy-500">
                        {new Date(version.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-navy-400 mt-0.5">{version.description}</p>
                    <p className="text-[10px] text-navy-500">{version.author_email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Feedback */}
          {isTeacher && (
            <div className="card">
              <button
                onClick={() => setShowFeedback(!showFeedback)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-purple-400" />
                  <span className="text-sm font-semibold text-white">Overall Feedback</span>
                </div>
                {showFeedback ? <ChevronUp size={14} className="text-navy-400" /> : <ChevronDown size={14} className="text-navy-400" />}
              </button>

              {showFeedback && (
                <div className="px-4 pb-4 border-t border-navy-700 pt-3">
                  <textarea
                    value={overallFeedback}
                    onChange={(e) => setOverallFeedback(e.target.value)}
                    placeholder="Write overall feedback for the student..."
                    className="w-full h-24 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit / Feedback */}
          <div className="card p-4 space-y-3">
            {isTeacher ? (
              <>
                <button className="btn-primary w-full flex items-center justify-center gap-2">
                  <Send size={14} />
                  Release Grade
                </button>
                <button
                  onClick={handleReturnRevision}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} />
                  Return for Revision
                </button>
              </>
            ) : (
              <>
                {canvasStatus === 'returned' && (
                  <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-900/20 rounded-lg p-2">
                    <AlertTriangle size={12} />
                    Returned by instructor — revise and resubmit
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={canvasStatus === 'submitted' || canvasStatus === 'finalised'}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={14} />
                  {canvasStatus === 'submitted' ? 'Submitted' : canvasStatus === 'finalised' ? 'Finalised' : 'Submit Final'}
                </button>
              </>
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
    </div>
  )
}
