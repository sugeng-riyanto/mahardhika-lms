import { BarChart3, BookOpen, Users, TrendingUp, GraduationCap, Calendar } from 'lucide-react'
import { useCourses, useGrades, useAssignments } from '@/api/hooks'


function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-navy-400">{label}</p>
        </div>
      </div>
    </div>
  )
}

function GradeDistribution({ grades }: { grades: Array<{ score: string; max_score: string; released: boolean }> }) {
  const released = grades.filter(g => g.released)
  if (released.length === 0) return <p className="text-navy-500 text-sm">No released grades yet.</p>

  const ranges = [
    { label: 'A (90-100%)', min: 90, count: 0, color: 'bg-green-500' },
    { label: 'B (80-89%)', min: 80, count: 0, color: 'bg-cyan-500' },
    { label: 'C (70-79%)', min: 70, count: 0, color: 'bg-yellow-500' },
    { label: 'D (60-69%)', min: 60, count: 0, color: 'bg-orange-500' },
    { label: 'F (<60%)', min: 0, count: 0, color: 'bg-red-500' },
  ]

  released.forEach(g => {
    const pct = (parseFloat(g.score) / parseFloat(g.max_score)) * 100
    if (pct >= 90) ranges[0].count++
    else if (pct >= 80) ranges[1].count++
    else if (pct >= 70) ranges[2].count++
    else if (pct >= 60) ranges[3].count++
    else ranges[4].count++
  })

  const maxCount = Math.max(...ranges.map(r => r.count), 1)

  return (
    <div className="space-y-3">
      {ranges.map(r => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="text-navy-300 text-sm w-24 shrink-0">{r.label}</span>
          <div className="flex-1 bg-navy-800 rounded-full h-6 overflow-hidden">
            <div
              className={`${r.color} h-full rounded-full transition-all duration-500`}
              style={{ width: `${(r.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-white text-sm font-medium w-8 text-right">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

export function ReportsPage() {
  const { data: courses = [], isLoading: loadingCourses } = useCourses()
  const { data: grades = [], isLoading: loadingGrades } = useGrades()
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments()
  const isLoading = loadingCourses || loadingGrades || loadingAssignments

  const totalCourses = courses.length
  const totalGrades = grades.length
  const releasedGrades = grades.filter(g => g.released)
  const avgScore = releasedGrades.length > 0
    ? (releasedGrades.reduce((sum, g) => sum + (Number(g.score) / Number(g.max_score)) * 100, 0) / releasedGrades.length).toFixed(1)
    : '—'
  const passRate = releasedGrades.length > 0
    ? ((releasedGrades.filter(g => (Number(g.score) / Number(g.max_score)) * 100 >= 60).length / releasedGrades.length) * 100).toFixed(0)
    : '—'

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">Reports & Analytics</h1>
      </div>
      <p className="page-subtitle">Grade distributions, course completion, and performance analytics</p>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-navy-400 mt-3">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<BookOpen size={20} className="text-cyan-400" />} label="Total Courses" value={totalCourses} color="bg-cyan-900/30" />
            <StatCard icon={<GraduationCap size={20} className="text-green-400" />} label="Total Grades" value={totalGrades} color="bg-green-900/30" />
            <StatCard icon={<TrendingUp size={20} className="text-purple-400" />} label="Average Score" value={`${avgScore}%`} color="bg-purple-900/30" />
            <StatCard icon={<Calendar size={20} className="text-yellow-400" />} label="Pass Rate" value={`${passRate}%`} color="bg-yellow-900/30" />
          </div>

          {/* Grade Distribution */}
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-purple-400" />
              Grade Distribution
            </h2>
            <GradeDistribution grades={grades} />
          </div>

          {/* Course Performance */}
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-cyan-400" />
              Course Performance
            </h2>
            {courses.length === 0 ? (
              <p className="text-navy-500 text-sm">No courses available.</p>
            ) : (
              <div className="space-y-3">
                {courses.map(course => {
                  const courseGrades = releasedGrades.filter(g => g.activity === course.id)
                  const courseAvg = courseGrades.length > 0
                    ? (courseGrades.reduce((s, g) => s + (Number(g.score) / Number(g.max_score)) * 100, 0) / courseGrades.length).toFixed(0)
                    : '—'
                  return (
                    <div key={course.id} className="flex items-center justify-between py-2 border-b border-navy-700 last:border-0">
                      <div>
                        <p className="text-white text-sm">{course.title}</p>
                        <p className="text-navy-400 text-xs">{courseGrades.length} graded activities</p>
                      </div>
                      <span className="text-cyan-400 font-medium">{courseAvg}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Assignment Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users size={20} className="text-green-400" />
              Assignment Summary
            </h2>
            {assignments.length === 0 ? (
              <p className="text-navy-500 text-sm">No assignments yet.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-navy-700 last:border-0">
                    <div>
                      <p className="text-white text-sm">{a.title}</p>
                      <p className="text-navy-400 text-xs">{a.course_title}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-navy-300">{a.submission_count} submitted</span>
                      <span className="text-green-400">{a.graded_count} graded</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
