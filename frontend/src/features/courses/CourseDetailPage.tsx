import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BookOpen, Users, FileText, Edit,
  Plus, GripVertical, Video, Type, PenTool, MessageSquare,
  ArrowLeft, Play
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { useLessons } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import type { Course } from '@/types'

const CONTENT_TYPE_ICONS: Record<string, typeof BookOpen> = {
  text: Type,
  video: Video,
  activity: PenTool,
  essay: MessageSquare,
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  text: 'text-blue-400 bg-blue-900/30',
  video: 'text-red-400 bg-red-900/30',
  activity: 'text-green-400 bg-green-900/30',
  essay: 'text-purple-400 bg-purple-900/30',
}

async function fetchCourse(courseId: string): Promise<Course | null> {
  try {
    return await apiClient.get<Course>(`/courses/${courseId}/`)
  } catch {
    return null
  }
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [activeTab, setActiveTab] = useState<'lessons' | 'students' | 'settings'>('lessons')
  const { roles } = useAuth()
  const isInstructor = roles.includes('instructor')
  const isAdmin = roles.includes('admin') || roles.includes('owner')

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourse(courseId || ''),
    enabled: !!courseId,
  })

  const { data: lessons, isLoading: lessonsLoading } = useLessons(courseId || '')

  if (courseLoading) {
    return (
      <div className="page-container">
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading course...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="page-container">
        <div className="card p-8 text-center">
          <BookOpen className="mx-auto text-navy-600 mb-4" size={40} />
          <p className="text-navy-400 mb-4">Course not found.</p>
          <Link to="/courses" className="btn-primary">Back to Courses</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Back link */}
      <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-navy-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={14} />
        Back to Courses
      </Link>

      {/* Course header */}
      <div className="card mb-6 overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-cyan-600/20 to-purple-600/20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900/80 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-success text-[10px]">
                {course.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{course.title}</h1>
              <p className="text-navy-400">{course.description}</p>
            </div>
            {(isAdmin || isInstructor) && (
              <button className="btn-secondary flex items-center gap-1">
                <Edit size={14} />
                Edit
              </button>
            )}
          </div>

          <div className="flex items-center gap-6 text-sm text-navy-400">
            <span className="flex items-center gap-1">
              <BookOpen size={14} />
              {lessons?.length || 0} lessons
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} />
              Enrolled students
            </span>
            <span className="flex items-center gap-1">
              <FileText size={14} />
              Created {new Date(course.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-navy-700">
        {(['lessons', 'students', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-navy-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'lessons' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Lessons</h2>
            {(isAdmin || isInstructor) && (
              <button className="btn-primary text-sm flex items-center gap-1">
                <Plus size={14} />
                Add Lesson
              </button>
            )}
          </div>

          {lessonsLoading ? (
            <div className="card p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-navy-400">Loading lessons...</p>
            </div>
          ) : lessons && lessons.length > 0 ? (
            <div className="space-y-2">
              {lessons.map((lesson) => {
                const Icon = CONTENT_TYPE_ICONS[lesson.content_type] || FileText
                const colorClass = CONTENT_TYPE_COLORS[lesson.content_type] || 'text-navy-400 bg-navy-800'
                return (
                  <Link
                    key={lesson.id}
                    to={`/courses/${courseId}/lessons/${lesson.id}`}
                    className="card p-4 flex items-center gap-4 hover:border-cyan-700/50 transition-all cursor-pointer group"
                  >
                    <GripVertical className="text-navy-600 group-hover:text-navy-400 cursor-grab" size={16} />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors truncate">
                        {lesson.title}
                      </p>
                      <p className="text-xs text-navy-500 truncate">{lesson.description}</p>
                    </div>
                    <span className={`badge text-[10px] ${lesson.is_published ? 'badge-success' : 'badge-neutral'}`}>
                      {lesson.is_published ? 'Published' : 'Draft'}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 text-cyan-400 transition-all flex items-center gap-1 text-xs">
                      <Play size={12} />
                      Play
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <BookOpen className="mx-auto text-navy-600 mb-4" size={32} />
              <p className="text-navy-400 mb-4">No lessons yet. Add your first lesson!</p>
              {(isAdmin || isInstructor) && (
                <button className="btn-primary text-sm">Add First Lesson</button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="card p-8 text-center">
          <Users className="mx-auto text-navy-600 mb-4" size={32} />
          <p className="text-navy-400">Student enrollment management coming soon.</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card p-8 text-center">
          <Edit className="mx-auto text-navy-600 mb-4" size={32} />
          <p className="text-navy-400">Course settings coming soon.</p>
        </div>
      )}
    </div>
  )
}
