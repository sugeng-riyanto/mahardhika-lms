import { useState } from 'react'
import { BarChart3, Search, Award, Eye, EyeOff, Plus, Edit, Trash2, CheckCircle } from 'lucide-react'
import { useGrades } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { CrudModal, type CrudField } from '@/components/CrudModal'
import type { GradeEntry } from '@/api/hooks'

function getGradeColor(pct: number): string {
  if (pct >= 90) return 'text-green-400'
  if (pct >= 80) return 'text-cyan-400'
  if (pct >= 70) return 'text-yellow-400'
  if (pct >= 60) return 'text-orange-400'
  return 'text-red-400'
}

function getLetterGrade(pct: number): string {
  if (pct >= 97) return 'A+'
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A-'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B-'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C-'
  if (pct >= 60) return 'D'
  return 'F'
}

function getGradeBadgeClass(pct: number): string {
  if (pct >= 80) return 'badge-success'
  if (pct >= 70) return 'bg-yellow-900/30 text-yellow-400'
  if (pct >= 60) return 'bg-orange-900/30 text-orange-400'
  return 'bg-red-900/30 text-red-400'
}

const GRADE_FIELDS: CrudField[] = [
  { name: 'student', label: 'Student ID', type: 'text', required: true, placeholder: 'Student UUID' },
  { name: 'activity', label: 'Activity ID', type: 'text', required: true, placeholder: 'Activity UUID' },
  { name: 'score', label: 'Score', type: 'number', required: true, placeholder: '85' },
  { name: 'max_score', label: 'Max Score', type: 'number', required: true, placeholder: '100' },
  { name: 'released', label: 'Released to Student', type: 'toggle' },
]

interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'view'
  data: Record<string, unknown>
}

function StatsCards({ grades }: { grades: GradeEntry[] }) {
  const released = grades.filter(g => g.released)
  const avgScore = released.length > 0
    ? Math.round(released.reduce((sum, g) => sum + g.percentage, 0) / released.length)
    : 0
  const aboveB = released.filter(g => g.percentage >= 80).length
  const atRisk = released.filter(g => g.percentage < 60).length
  const uniqueStudents = new Set(released.map(g => g.student)).size

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="card p-4">
        <p className="text-2xl font-bold text-white">{uniqueStudents}</p>
        <p className="text-sm text-navy-400">Students</p>
      </div>
      <div className="card p-4">
        <p className={`text-2xl font-bold ${getGradeColor(avgScore)}`}>{avgScore}%</p>
        <p className="text-sm text-navy-400">Class Average</p>
      </div>
      <div className="card p-4">
        <p className="text-2xl font-bold text-green-400">{aboveB}</p>
        <p className="text-sm text-navy-400">Above B</p>
      </div>
      <div className="card p-4">
        <p className="text-2xl font-bold text-red-400">{atRisk}</p>
        <p className="text-sm text-navy-400">At Risk</p>
      </div>
    </div>
  )
}

function StudentGradeSummary({ grades }: { grades: GradeEntry[] }) {
  const released = grades.filter(g => g.released)
  const avgScore = released.length > 0
    ? Math.round(released.reduce((sum, g) => sum + g.percentage, 0) / released.length)
    : 0

  if (released.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Award className="mx-auto text-navy-600 mb-4" size={40} />
        <p className="text-navy-400 mb-2">No grades released yet.</p>
        <p className="text-navy-500 text-sm">Your grades will appear here once your instructor releases them.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">My Grades</h2>
          <div className="text-right">
            <p className={`text-3xl font-bold ${getGradeColor(avgScore)}`}>{avgScore}%</p>
            <p className="text-xs text-navy-400">{getLetterGrade(avgScore)}</p>
          </div>
        </div>
        <div className="space-y-3">
          {released.map((grade) => (
            <div key={grade.id} className="flex items-center justify-between py-2 border-b border-navy-700 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{grade.activity_title}</p>
                <p className="text-xs text-navy-500">{grade.activity_type.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 bg-navy-800 rounded-full h-1.5" role="progressbar" aria-valuenow={grade.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${grade.activity_title}: ${grade.percentage}%`}>
                  <div className={`h-1.5 rounded-full ${grade.percentage >= 80 ? 'bg-green-500' : grade.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(grade.percentage, 100)}%` }} />
                </div>
                <span className={`text-sm font-mono font-medium ${getGradeColor(grade.percentage)}`}>
                  {grade.score}/{grade.max_score}
                </span>
                <span className={`badge text-[10px] ${getGradeBadgeClass(grade.percentage)}`}>
                  {getLetterGrade(grade.percentage)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GradebookPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showUnreleased, setShowUnreleased] = useState(false)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'create', data: {} })
  const { roles } = useAuth()
  const isStudent = roles.includes('student')
  const isParent = roles.includes('parent')
  const isInstructor = roles.includes('instructor')
  const isAdmin = roles.includes('admin') || roles.includes('owner')
  const canGrade = isInstructor || isAdmin

  const { data: grades = [], isLoading, refetch } = useGrades()

  // Student/parent view
  if (isStudent || isParent) {
    return (
      <div className="page-container">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Gradebook</h1>
        </div>
        {isLoading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-navy-400">Loading grades...</p>
          </div>
        ) : (
          <StudentGradeSummary grades={grades} />
        )}
      </div>
    )
  }

  // Instructor/Admin view
  const filteredGrades = grades.filter((g) => {
    const matchesSearch = !searchQuery ||
      g.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.student_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.activity_title?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRelease = showUnreleased || g.released
    return matchesSearch && matchesRelease
  })

  const openCreate = () => setModal({
    isOpen: true,
    mode: 'create',
    data: { student: '', activity: '', score: 0, max_score: 100, released: false },
  })

  const openEdit = (g: GradeEntry) => setModal({
    isOpen: true,
    mode: 'edit',
    data: { id: g.id, student: g.student, activity: g.activity, score: g.score, max_score: g.max_score, released: g.released },
  })

  const openDelete = (g: GradeEntry) => setModal({
    isOpen: true,
    mode: 'delete',
    data: { id: g.id, student_name: g.student_name || 'Unknown', activity_title: g.activity_title || 'Untitled' },
  })

  const handleSave = async (data: Record<string, unknown>) => {
    if (modal.mode === 'create') {
      await apiClient.post('/grades/', data)
    } else if (modal.mode === 'edit' && data.id) {
      await apiClient.patch(`/grades/${data.id}/`, data)
    }
    await refetch()
  }

  const handleDelete = async () => {
    if (modal.data.id) {
      await apiClient.delete(`/grades/${modal.data.id}/`)
      await refetch()
    }
  }

  const handleReleaseAll = async () => {
    const unreleased = grades.filter(g => !g.released)
    for (const g of unreleased) {
      await apiClient.patch(`/grades/${g.id}/`, { released: true })
    }
    await refetch()
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Gradebook</h1>
        </div>
        <div className="flex items-center gap-2">
          {canGrade && (
            <>
              <button onClick={handleReleaseAll} className="btn-secondary flex items-center gap-2 text-sm">
                <CheckCircle size={14} />
                Release All
              </button>
              <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={14} />
                Add Grade
              </button>
            </>
          )}
          <button className="btn-secondary flex items-center gap-2 text-sm">
            Export CSV
          </button>
        </div>
      </div>

      <StatsCards grades={grades} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="gradebook-search" className="sr-only">Search students or activities</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" size={16} aria-hidden="true" />
          <input
            id="gradebook-search"
            type="text"
            placeholder="Search students or activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          onClick={() => setShowUnreleased(!showUnreleased)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
            showUnreleased
              ? 'bg-cyan-600 text-white'
              : 'bg-navy-800 text-navy-300 hover:bg-navy-700 border border-navy-700'
          }`}
          aria-pressed={showUnreleased}
        >
          {showUnreleased ? <Eye size={14} /> : <EyeOff size={14} />}
          {showUnreleased ? 'Showing All' : 'Released Only'}
        </button>
      </div>

      {/* Grade table */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading grades...</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th scope="col" className="text-left px-4 py-3 text-sm font-medium text-navy-400">Student</th>
                  <th scope="col" className="text-left px-4 py-3 text-sm font-medium text-navy-400">Activity</th>
                  <th scope="col" className="text-center px-4 py-3 text-sm font-medium text-navy-400">Type</th>
                  <th scope="col" className="text-center px-4 py-3 text-sm font-medium text-navy-400">Score</th>
                  <th scope="col" className="text-center px-4 py-3 text-sm font-medium text-navy-400">Percentage</th>
                  <th scope="col" className="text-center px-4 py-3 text-sm font-medium text-navy-400">Grade</th>
                  <th scope="col" className="text-center px-4 py-3 text-sm font-medium text-navy-400">Status</th>
                  {canGrade && <th scope="col" className="text-right px-4 py-3 text-sm font-medium text-navy-400">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredGrades.map((grade) => (
                  <tr key={grade.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{grade.student_name || 'Unknown'}</p>
                        <p className="text-xs text-navy-500">{grade.student_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-navy-200">{grade.activity_title || 'Untitled'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-navy-400 capitalize">{grade.activity_type?.replace('_', ' ') || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-mono ${getGradeColor(grade.percentage)}`}>{grade.score}/{grade.max_score}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-navy-800 rounded-full h-1.5" role="progressbar" aria-valuenow={grade.percentage} aria-valuemin={0} aria-valuemax={100}>
                          <div className={`h-1.5 rounded-full ${grade.percentage >= 80 ? 'bg-green-500' : grade.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(grade.percentage, 100)}%` }} />
                        </div>
                        <span className={`text-sm font-bold font-mono ${getGradeColor(grade.percentage)}`}>{grade.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge text-[10px] ${getGradeBadgeClass(grade.percentage)}`}>{getLetterGrade(grade.percentage)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {grade.released ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400"><Eye size={10} /> Released</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-navy-500"><EyeOff size={10} /> Draft</span>
                      )}
                    </td>
                    {canGrade && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(grade)} className="p-1.5 text-navy-400 hover:text-yellow-400 transition-colors" title="Edit">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => openDelete(grade)} className="p-1.5 text-navy-400 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredGrades.length === 0 && (
            <div className="py-12 text-center">
              <BarChart3 className="mx-auto text-navy-600 mb-4" size={32} />
              <p className="text-navy-400">{searchQuery ? 'No grades match your search.' : 'No grades found.'}</p>
              <p className="text-navy-500 text-sm mt-1">Grades appear here once instructors create and release them.</p>
            </div>
          )}
        </div>
      )}

      {/* CRUD Modal */}
      <CrudModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        title="Grade"
        fields={GRADE_FIELDS}
        data={modal.data}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModal({ isOpen: false, mode: 'create', data: {} })}
      />
    </div>
  )
}
