import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BookOpen, ArrowLeft, ArrowRight, ChevronRight,
  Type, Video, PenTool, MessageSquare,
  CheckCircle, Clock, Menu, X,
  Play, FileText, Award
} from 'lucide-react'
import { VideoEmbed } from '@/components/VideoEmbed'
import { useLesson, useLessons, useActivities } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import type { Lesson } from '@/types'

const CONTENT_TYPE_CONFIG: Record<string, { icon: typeof Type; label: string; color: string; bg: string }> = {
  text: { icon: Type, label: 'Reading', color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-700/30' },
  video: { icon: Video, label: 'Video', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700/30' },
  activity: { icon: PenTool, label: 'Activity', color: 'text-green-400', bg: 'bg-green-900/30 border-green-700/30' },
  essay: { icon: MessageSquare, label: 'Essay', color: 'text-purple-400', bg: 'bg-purple-900/30 border-purple-700/30' },
}

function TextLessonContent({ lesson }: { lesson: Lesson }) {
  const body = (lesson.content_data as Record<string, unknown>)?.body as string || lesson.description || 'No content available.'
  const paragraphs = body.split('\n').filter(p => p.trim())

  return (
    <div className="prose prose-invert max-w-none">
      <div className="bg-navy-800/50 rounded-xl p-8 border border-navy-700">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-navy-700">
          <FileText className="text-blue-400" size={20} />
          <span className="text-sm font-medium text-blue-400">Reading Material</span>
        </div>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-navy-200 leading-relaxed mb-4 text-[15px]">
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}

function VideoLessonContent({ lesson }: { lesson: Lesson }) {
  const videoUrl = lesson.video_url || (lesson.content_data as Record<string, unknown>)?.video_url as string || ''

  return (
    <div className="space-y-6">
      {videoUrl ? (
        <div className="rounded-xl overflow-hidden border border-navy-700">
          <VideoEmbed url={videoUrl} title={lesson.title} />
        </div>
      ) : (
        <div className="bg-navy-800/50 rounded-xl border border-navy-700 overflow-hidden">
          <div className="aspect-video bg-gradient-to-br from-navy-800 to-navy-900 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-purple-600/5" />
            <div className="text-center relative z-10">
              <div className="w-20 h-20 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <Play className="text-red-400 ml-1" size={32} />
              </div>
              <p className="text-navy-300 font-medium">Video Player</p>
              <p className="text-sm text-navy-500 mt-1">No video URL set — add one in lesson settings</p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-navy-800/50 rounded-xl p-6 border border-navy-700">
        <p className="text-navy-300 text-sm">
          {(lesson.content_data as Record<string, unknown>)?.body as string || lesson.description || 'Video description not available.'}
        </p>
      </div>
    </div>
  )
}

function ActivityLessonContent({ lesson }: { lesson: Lesson }) {
  const { data: activities = [] } = useActivities(lesson.id)

  return (
    <div className="space-y-6">
      {activities.length > 0 ? (
        activities.map(activity => (
          <div key={activity.id} className="bg-navy-800/50 rounded-xl p-8 border border-navy-700 border-dashed">
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-green-900/30 border border-green-700/30 flex items-center justify-center mx-auto mb-4">
                <PenTool className="text-green-400" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{activity.title}</h3>
              <p className="text-navy-400 mb-2 max-w-md mx-auto">
                {activity.description || 'Complete this interactive activity to earn points.'}
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-navy-500 mb-6">
                <span>{activity.question_count} questions</span>
                <span>•</span>
                <span>{activity.total_points} points</span>
                {activity.time_limit_minutes && <><span>•</span><span>{activity.time_limit_minutes} min</span></>}
              </div>
              <Link
                to={`/activities/${activity.id}/play`}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-semibold transition-all"
              >
                <Play size={18} /> Start Activity
              </Link>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-navy-800/50 rounded-xl p-8 border border-navy-700 border-dashed">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-green-900/30 border border-green-700/30 flex items-center justify-center mx-auto mb-4">
              <PenTool className="text-green-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Interactive Activity</h3>
            <p className="text-navy-400 max-w-md mx-auto">
              No activities available for this lesson yet.
            </p>
          </div>
        </div>
      )}
      <div className="bg-navy-800/50 rounded-xl p-6 border border-navy-700">
        <p className="text-sm text-navy-300">
          {(lesson.content_data as Record<string, unknown>)?.body as string || lesson.description || 'Activity description not available.'}
        </p>
      </div>
    </div>
  )
}

function EssayLessonContent({ lesson }: { lesson: Lesson }) {
  return (
    <div className="space-y-6">
      <div className="bg-navy-800/50 rounded-xl p-8 border border-navy-700 border-dashed">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-purple-900/30 border border-purple-700/30 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="text-purple-400" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Essay Assessment</h3>
          <p className="text-navy-400 mb-6 max-w-md mx-auto">
            Write your response below. Use the Annotation Canvas for mathematical and physics problems.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/canvas" className="btn-primary px-6 flex items-center gap-2">
              <Award size={16} />
              Open Canvas
            </Link>
            <button className="btn-secondary px-6">
              Write Essay
            </button>
          </div>
        </div>
      </div>
      <div className="bg-navy-800/50 rounded-xl p-6 border border-navy-700">
        <p className="text-sm text-navy-300">
          {(lesson.content_data as Record<string, unknown>)?.body as string || lesson.description || 'Essay prompt not available.'}
        </p>
      </div>
    </div>
  )
}

const CONTENT_RENDERERS: Record<string, React.ComponentType<{ lesson: Lesson }>> = {
  text: TextLessonContent,
  video: VideoLessonContent,
  activity: ActivityLessonContent,
  essay: EssayLessonContent,
}

function LessonSidebar({
  lessons,
  currentLessonId,
  courseId,
  isOpen,
  onClose,
}: {
  lessons: Lesson[]
  currentLessonId: string
  courseId: string
  isOpen: boolean
  onClose: () => void
}) {
  const completedLessons = new Set<string>()

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-navy-900/80 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed top-0 left-0 h-full w-80 bg-navy-900 border-r border-navy-700 z-50
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
        flex flex-col
      `}>
        <div className="p-4 border-b border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/courses/${courseId}`} className="text-navy-400 hover:text-white shrink-0">
              <ArrowLeft size={18} />
            </Link>
            <h3 className="text-sm font-semibold text-white truncate">Course Lessons</h3>
          </div>
          <button onClick={onClose} className="lg:hidden text-navy-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {lessons.map((lesson, index) => {
            const isActive = lesson.id === currentLessonId
            const isCompleted = completedLessons.has(lesson.id)
            const config = CONTENT_TYPE_CONFIG[lesson.content_type] || CONTENT_TYPE_CONFIG.text
            const Icon = config.icon

            return (
              <Link
                key={lesson.id}
                to={`/courses/${courseId}/lessons/${lesson.id}`}
                onClick={onClose}
                className={`
                  flex items-center gap-3 p-3 rounded-lg mb-1 transition-all group
                  ${isActive
                    ? 'bg-cyan-600/20 border border-cyan-600/30'
                    : 'hover:bg-navy-800 border border-transparent'
                  }
                `}
              >
                <div className="shrink-0">
                  {isCompleted ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <span className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                      ${isActive ? 'bg-cyan-600 text-white' : 'bg-navy-700 text-navy-400 group-hover:bg-navy-600'}
                    `}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-cyan-400' : 'text-white'}`}>
                    {lesson.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon size={10} className={config.color} />
                    <span className="text-[10px] text-navy-500">{config.label}</span>
                  </div>
                </div>
                {isActive && <ChevronRight size={14} className="text-cyan-400 shrink-0" />}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-navy-700">
          <div className="flex items-center gap-2 text-xs text-navy-500">
            <Clock size={12} />
            <span>{lessons.length} lessons</span>
            <span className="mx-1">·</span>
            <span>{completedLessons.size} completed</span>
          </div>
        </div>
      </aside>
    </>
  )
}

export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { roles } = useAuth()
  const isInstructor = roles.includes('instructor')
  const isAdmin = roles.includes('admin') || roles.includes('owner')

  const { data: lesson, isLoading: lessonLoading } = useLesson(lessonId || '')
  const { data: lessons = [] } = useLessons(courseId || '')

  const currentIndex = lessons.findIndex(l => l.id === lessonId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  if (lessonLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="page-container">
        <div className="card p-8 text-center">
          <BookOpen className="mx-auto text-navy-600 mb-4" size={40} />
          <p className="text-navy-400 mb-4">Lesson not found.</p>
          <Link to={courseId ? `/courses/${courseId}` : '/courses'} className="btn-primary">
            Back to Course
          </Link>
        </div>
      </div>
    )
  }

  const config = CONTENT_TYPE_CONFIG[lesson.content_type] || CONTENT_TYPE_CONFIG.text
  const ContentRenderer = CONTENT_RENDERERS[lesson.content_type] || TextLessonContent

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <LessonSidebar
        lessons={lessons}
        currentLessonId={lessonId || ''}
        courseId={courseId || ''}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-navy-900/95 backdrop-blur border-b border-navy-700 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-navy-400 hover:text-white"
          >
            <Menu size={20} />
          </button>
          <Link
            to={`/courses/${courseId}`}
            className="text-navy-400 hover:text-white hidden lg:flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} />
            Course
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
            <p className="text-xs text-navy-500">
              Lesson {currentIndex + 1} of {lessons.length}
            </p>
          </div>
          <div className={`badge text-[10px] border ${config.bg}`}>
            <config.icon size={10} className={config.color} />
            <span className={config.color}>{config.label}</span>
          </div>
        </div>

        {/* Lesson content */}
        <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
          <h1 className="text-2xl font-bold text-white mb-2">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-navy-400 mb-8">{lesson.description}</p>
          )}

          <ContentRenderer lesson={lesson} />

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12 pt-6 border-t border-navy-700">
            {prevLesson ? (
              <Link
                to={`/courses/${courseId}/lessons/${prevLesson.id}`}
                className="btn-secondary flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                <div className="text-left">
                  <p className="text-[10px] text-navy-500">Previous</p>
                  <p className="text-sm font-medium">{prevLesson.title}</p>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {nextLesson ? (
              <Link
                to={`/courses/${courseId}/lessons/${nextLesson.id}`}
                className="btn-primary flex items-center gap-2"
              >
                <div className="text-right">
                  <p className="text-[10px] text-cyan-200/60">Next</p>
                  <p className="text-sm font-medium">{nextLesson.title}</p>
                </div>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link
                to={`/courses/${courseId}`}
                className="btn-primary flex items-center gap-2"
              >
                <div className="text-right">
                  <p className="text-[10px] text-cyan-200/60">All done!</p>
                  <p className="text-sm font-medium">Back to Course</p>
                </div>
                <CheckCircle size={16} />
              </Link>
            )}
          </div>
        </div>

        {/* Instructor footer */}
        {(isInstructor || isAdmin) && (
          <div className="border-t border-navy-700 px-6 py-3 bg-navy-800/50">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <span className="text-xs text-navy-500">Instructor view</span>
              <div className="flex gap-2">
                <button className="text-xs text-navy-400 hover:text-white px-3 py-1.5 rounded border border-navy-700 hover:border-navy-500 transition-colors">
                  Edit Lesson
                </button>
                <button className="text-xs text-green-400 hover:text-green-300 px-3 py-1.5 rounded border border-green-700/30 hover:border-green-500/50 transition-colors">
                  {lesson.is_published ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
