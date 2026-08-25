import { useState } from 'react'
import { GraduationCap, Search, Plus, BookOpen, Edit, Archive } from 'lucide-react'
import { useProgrammes } from '@/api/hooks'

const LEVEL_META: Record<string, { label: string; color: string; gradient: string; icon: string }> = {
  jhs: { label: 'Junior High', color: 'text-blue-400', gradient: 'from-blue-500 to-blue-700', icon: '📚' },
  shs: { label: 'Senior High', color: 'text-purple-400', gradient: 'from-purple-500 to-purple-700', icon: '🎓' },
  pkbm: { label: 'PKBM', color: 'text-green-400', gradient: 'from-green-500 to-green-700', icon: '🏫' },
  academy: { label: 'Academy', color: 'text-cyan-400', gradient: 'from-cyan-500 to-cyan-700', icon: '🏛️' },
  steam: { label: 'STEAM', color: 'text-orange-400', gradient: 'from-orange-500 to-orange-700', icon: '🤖' },
  arts: { label: 'Arts', color: 'text-pink-400', gradient: 'from-pink-500 to-pink-700', icon: '🎨' },
  ielts: { label: 'IELTS', color: 'text-yellow-400', gradient: 'from-yellow-500 to-yellow-700', icon: '🌍' },
  teacher_dev: { label: 'Teacher Dev', color: 'text-teal-400', gradient: 'from-teal-500 to-teal-700', icon: '👨‍🏫' },
}

export function ProgrammeListPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: programmes, isLoading } = useProgrammes()

  const filteredProgrammes = programmes?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const activeCount = programmes?.filter(p => p.is_active).length || 0
  const totalCourses = programmes?.reduce((sum, p) => sum + p.course_count, 0) || 0

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-green-400" size={24} />
          <h1 className="page-title mb-0">Programmes</h1>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Create Programme
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{programmes?.length || 0}</p>
          <p className="text-sm text-navy-400">Total Programmes</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          <p className="text-sm text-navy-400">Active</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-cyan-400">{totalCourses}</p>
          <p className="text-sm text-navy-400">Total Courses</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-purple-400">{programmes?.length || 0}</p>
          <p className="text-sm text-navy-400">Levels</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" size={16} />
        <input
          type="text"
          placeholder="Search programmes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10 w-full"
        />
      </div>

      {/* Programme cards */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading programmes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProgrammes.map((programme) => {
            const meta = LEVEL_META[programme.level] || LEVEL_META.academy
            return (
              <div key={programme.id} className="card hover:border-green-700/50 transition-all cursor-pointer group">
                {/* Header gradient */}
                <div className={`h-24 bg-gradient-to-br ${meta.gradient} rounded-t-xl flex items-center justify-center relative`}>
                  <span className="text-3xl">{meta.icon}</span>
                  {!programme.is_active && (
                    <div className="absolute inset-0 bg-navy-900/60 rounded-t-xl flex items-center justify-center">
                      <span className="badge badge-neutral flex items-center gap-1">
                        <Archive size={10} />
                        Inactive
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <span className={`w-2 h-2 rounded-full ${programme.is_active ? 'bg-green-400' : 'bg-navy-600'}`} />
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-400 transition-colors">
                    {programme.name}
                  </h3>
                  <p className="text-sm text-navy-400 line-clamp-2 mb-4">
                    {programme.description || 'No description'}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-navy-500 mb-4">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {programme.course_count} courses
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1">
                      <BookOpen size={14} />
                      View Courses
                    </button>
                    <button className="btn-ghost text-sm px-3">
                      <Edit size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredProgrammes.length === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <GraduationCap className="mx-auto text-navy-600 mb-4" size={40} />
          <p className="text-navy-400">No programmes found.</p>
        </div>
      )}
    </div>
  )
}
