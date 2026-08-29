import { useState } from 'react'
import { BookOpen, Search, Plus, Users, FileText, Eye, Edit, Trash2, GraduationCap } from 'lucide-react'
import { useCourses } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { CrudModal, type CrudField } from '@/components/CrudModal'

const LEVEL_COLORS: Record<string, string> = {
  jhs: 'bg-blue-900/30 text-blue-400 border-blue-700/30',
  shs: 'bg-purple-900/30 text-purple-400 border-purple-700/30',
  pkbm: 'bg-green-900/30 text-green-400 border-green-700/30',
  academy: 'bg-cyan-900/30 text-cyan-400 border-cyan-700/30',
  steam: 'bg-orange-900/30 text-orange-400 border-orange-700/30',
  arts: 'bg-pink-900/30 text-pink-400 border-pink-700/30',
  ielts: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30',
  teacher_dev: 'bg-teal-900/30 text-teal-400 border-teal-700/30',
}

const COURSE_FIELDS: CrudField[] = [
  { name: 'title', label: 'Course Title', type: 'text', required: true, placeholder: 'Mathematics 7A' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Course description...' },
  { name: 'programme_id', label: 'Programme', type: 'select', required: true, options: [
    { value: '9489972e-78eb-4e73-a039-accef1bc2fa8', label: 'JHS Mathematics' },
    { value: 'c27bec66-b395-4d9d-8aaa-41e7e1b11dfc', label: 'SHS Physics' },
    { value: '23f48cdc-f327-498d-ab78-c667e98121bf', label: 'IELTS Preparation' },
    { value: 'ee6bd9f2-c8bc-4ffe-a7da-1c1cd7c7f258', label: 'STEAM & Robotics' },
  ]},
  { name: 'is_published', label: 'Published', type: 'toggle' },
]

interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'view'
  data: Record<string, unknown>
}

export function CourseListPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'create', data: {} })
  const { roles } = useAuth()
  const isInstructor = roles.includes('instructor')
  const isAdmin = roles.includes('admin') || roles.includes('owner')

  const { data: courses, isLoading, error, refetch } = useCourses()

  const filteredCourses = courses?.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = levelFilter === 'all' || c.programme_level === levelFilter
    return matchesSearch && matchesLevel
  }) || []

  const publishedCount = courses?.filter(c => c.is_published).length || 0
  const draftCount = courses?.filter(c => !c.is_published).length || 0

  const openCreate = () => setModal({
    isOpen: true,
    mode: 'create',
    data: { title: '', description: '', programme_id: '', is_published: false },
  })

  const openEdit = (c: typeof filteredCourses[0]) => setModal({
    isOpen: true,
    mode: 'edit',
    data: { id: c.id, title: c.title, description: c.description || '', programme_id: c.programme_id, is_published: c.is_published },
  })

  const openView = (c: typeof filteredCourses[0]) => setModal({
    isOpen: true,
    mode: 'view',
    data: { ...c, programme_name: c.programme_name || 'Unknown', instructor_email: c.instructor_email || 'Unassigned' },
  })

  const openDelete = (c: typeof filteredCourses[0]) => setModal({
    isOpen: true,
    mode: 'delete',
    data: { id: c.id, title: c.title },
  })

  const handleSave = async (data: Record<string, unknown>) => {
    // Map frontend field names to backend field names
    const payload: Record<string, unknown> = { ...data }
    if (payload.programme_id) {
      payload.programme = payload.programme_id
      delete payload.programme_id
    }
    if (modal.mode === 'create') {
      await apiClient.post('/courses/', payload)
    } else if (modal.mode === 'edit' && payload.id) {
      await apiClient.patch(`/courses/${payload.id}/`, payload)
    }
    await refetch()
  }

  const handleDelete = async () => {
    if (modal.data.id) {
      await apiClient.delete(`/courses/${modal.data.id}/`)
      await refetch()
    }
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Courses</h1>
        </div>
        {(isAdmin || isInstructor) && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Create Course
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{courses?.length || 0}</p>
          <p className="text-sm text-navy-400">Total Courses</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{publishedCount}</p>
          <p className="text-sm text-navy-400">Published</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-yellow-400">{draftCount}</p>
          <p className="text-sm text-navy-400">Draft</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-cyan-400">{courses?.length || 0}</p>
          <p className="text-sm text-navy-400">Programmes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="course-search" className="sr-only">Search courses</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" size={16} aria-hidden="true" />
          <input
            id="course-search"
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <label htmlFor="level-filter" className="sr-only">Filter by level</label>
        <select
          id="level-filter"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="input-field w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="all">All Levels</option>
          <option value="jhs">Junior High (JHS)</option>
          <option value="shs">Senior High (SHS)</option>
          <option value="pkbm">PKBM</option>
          <option value="academy">Academy</option>
          <option value="steam">STEAM Camp</option>
          <option value="arts">Arts Camp</option>
          <option value="ielts">IELTS</option>
          <option value="teacher_dev">Teacher Development</option>
        </select>
      </div>

      {/* Course cards */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading courses...</p>
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-red-300">Failed to load courses</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} className="card hover:border-cyan-700/50 transition-all cursor-pointer group">
              <div className="h-36 bg-gradient-to-br from-navy-800 to-navy-900 rounded-t-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 to-purple-600/10" />
                <BookOpen className="text-cyan-500/30 relative z-10" size={40} />
                {course.is_published ? (
                  <span className="absolute top-3 right-3 badge badge-success text-[10px]">Published</span>
                ) : (
                  <span className="absolute top-3 right-3 badge badge-warning text-[10px]">Draft</span>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge text-[10px] border ${LEVEL_COLORS[course.programme_level] || 'bg-navy-800 text-navy-400'}`}>
                    {course.programme_name}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                  {course.title}
                </h3>
                <p className="text-sm text-navy-400 line-clamp-2 mb-4">
                  {course.description || 'No description'}
                </p>

                <div className="flex items-center gap-4 text-xs text-navy-500 mb-4">
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    {course.lesson_count} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {course.student_count} students
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openView(course)}
                    className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  {(isAdmin || isInstructor) && (
                    <>
                      <button
                        onClick={() => openEdit(course)}
                        className="btn-ghost text-sm flex items-center gap-1 px-3"
                        aria-label={`Edit ${course.title}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => openDelete(course)}
                        className="btn-ghost text-sm flex items-center gap-1 px-3 text-red-400 hover:text-red-300"
                        aria-label={`Delete ${course.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredCourses.length === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <GraduationCap className="mx-auto text-navy-600 mb-4" size={40} />
          <p className="text-navy-400 mb-4">
            {searchQuery || levelFilter !== 'all' ? 'No courses match your filters.' : 'No courses yet. Create your first course!'}
          </p>
        </div>
      )}

      {/* CRUD Modal */}
      <CrudModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        title="Course"
        fields={COURSE_FIELDS}
        data={modal.data}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModal({ isOpen: false, mode: 'create', data: {} })}
      />
    </div>
  )
}
