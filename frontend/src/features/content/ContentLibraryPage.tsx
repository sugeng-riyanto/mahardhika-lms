import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Search, Upload, Grid, List, Image, Package,
  Download, Trash2, Eye, Clock, HardDrive,
  X, Film, Headphones, Layers
} from 'lucide-react'
import { apiClient } from '@/api/client'

interface ContentItem {
  id: string
  title: string
  description: string
  content_type: 'document' | 'video' | 'image' | 'audio' | 'interactive' | 'other'
  file_url: string
  mime_type: string
  file_size: number
  uploaded_by: string
  uploaded_by_email: string
  tags: string[]
  course?: string | null
  course_title: string | null
  created_at: string
  updated_at: string
}

const MOCK_CONTENT: ContentItem[] = [
  { id: 'ci1', title: 'Algebra Fundamentals slides', description: 'Lecture slides for algebra introduction', content_type: 'document', file_url: '/files/algebra-intro.pdf', mime_type: 'application/pdf', file_size: 2457600, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['math', 'algebra', 'jhs'], course: null, course_title: 'Mathematics 7A', created_at: '2026-08-24T10:00:00Z', updated_at: '2026-08-24T10:00:00Z' },
  { id: 'ci2', title: 'Newton\'s Laws Animation', description: 'Interactive animation showing Newton\'s three laws of motion', content_type: 'video', file_url: '/files/newton-laws.mp4', mime_type: 'video/mp4', file_size: 15728640, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['physics', 'newton', 'forces'], course: null, course_title: 'Physics 10', created_at: '2026-08-24T11:00:00Z', updated_at: '2026-08-24T11:00:00Z' },
  { id: 'ci3', title: 'Periodic Table Reference', description: 'High-resolution periodic table with element details', content_type: 'image', file_url: '/files/periodic-table.png', mime_type: 'image/png', file_size: 1048576, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['chemistry', 'reference'], course: null, course_title: 'Science 7', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' },
  { id: 'ci4', title: 'Cell Division Timelapse', description: 'Video showing mitosis and cell division stages', content_type: 'video', file_url: '/files/cell-division.mp4', mime_type: 'video/mp4', file_size: 31457280, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['biology', 'cell', 'division'], course_title: 'Science 7', created_at: '2026-08-24T13:00:00Z', updated_at: '2026-08-24T13:00:00Z' },
  { id: 'ci5', title: 'English Grammar Exercises', description: 'Interactive grammar worksheet with answers', content_type: 'document', file_url: '/files/grammar-exercises.pdf', mime_type: 'application/pdf', file_size: 524288, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['english', 'grammar', 'exercises'], course_title: null, created_at: '2026-08-24T14:00:00Z', updated_at: '2026-08-24T14:00:00Z' },
  { id: 'ci6', title: 'Wave Interference Demo', description: 'Simulation of wave interference patterns', content_type: 'interactive', file_url: '/files/wave-sim', mime_type: 'text/html', file_size: 819200, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['physics', 'waves', 'simulation'], course_title: 'Physics 10', created_at: '2026-08-24T15:00:00Z', updated_at: '2026-08-24T15:00:00Z' },
  { id: 'ci7', title: 'IELTS Speaking Practice Audio', description: 'Sample speaking responses for IELTS preparation', content_type: 'audio', file_url: '/files/ielts-speaking.mp3', mime_type: 'audio/mpeg', file_size: 4194304, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['ielts', 'speaking', 'practice'], course_title: 'IELTS Academic Writing', created_at: '2026-08-24T16:00:00Z', updated_at: '2026-08-24T16:00:00Z' },
  { id: 'ci8', title: 'Geometry Formula Sheet', description: 'Comprehensive formula reference for geometry', content_type: 'document', file_url: '/files/geometry-formulas.pdf', mime_type: 'application/pdf', file_size: 307200, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['math', 'geometry', 'reference'], course_title: 'Mathematics 7A', created_at: '2026-08-24T17:00:00Z', updated_at: '2026-08-24T17:00:00Z' },
  { id: 'ci9', title: 'Robotics Kit Assembly Guide', description: 'Step-by-step guide for assembling the robotics kit', content_type: 'image', file_url: '/files/robotics-guide.png', mime_type: 'image/png', file_size: 5242880, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['robotics', 'guide', 'steam'], course_title: 'Robotics Workshop', created_at: '2026-08-24T18:00:00Z', updated_at: '2026-08-24T18:00:00Z' },
  { id: 'ci10', title: 'Calculus Video Lecture 1', description: 'Introduction to limits and derivatives', content_type: 'video', file_url: '/files/calc-lecture-1.mp4', mime_type: 'video/mp4', file_size: 104857600, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['math', 'calculus', 'video'], course_title: 'Advanced Mathematics', created_at: '2026-08-24T19:00:00Z', updated_at: '2026-08-24T19:00:00Z' },
  { id: 'ci11', title: 'Thermodynamics Lab Recording', description: 'Audio recording of thermodynamics lab procedure', content_type: 'audio', file_url: '/files/thermo-lab.mp3', mime_type: 'audio/mpeg', file_size: 8388608, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['physics', 'lab', 'thermodynamics'], course_title: 'Physics 10', created_at: '2026-08-25T10:00:00Z', updated_at: '2026-08-25T10:00:00Z' },
  { id: 'ci12', title: 'History Timeline Poster', description: 'Visual timeline of major historical events', content_type: 'image', file_url: '/files/history-timeline.jpg', mime_type: 'image/jpeg', file_size: 3145728, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['history', 'poster', 'reference'], course_title: null, created_at: '2026-08-25T11:00:00Z', updated_at: '2026-08-25T11:00:00Z' },
]

const TYPE_META: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  document: { label: 'Document', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-900/30' },
  video: { label: 'Video', icon: Film, color: 'text-red-400', bg: 'bg-red-900/30' },
  image: { label: 'Image', icon: Image, color: 'text-green-400', bg: 'bg-green-900/30' },
  audio: { label: 'Audio', icon: Headphones, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  interactive: { label: 'Interactive', icon: Layers, color: 'text-orange-400', bg: 'bg-orange-900/30' },
  other: { label: 'Other', icon: Package, color: 'text-navy-400', bg: 'bg-navy-800' },
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

async function fetchContent(): Promise<ContentItem[]> {
  try {
    const data = await apiClient.list<ContentItem>('/content/')
    return data.results
  } catch {
    return MOCK_CONTENT
  }
}

export function ContentLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [dragOver, setDragOver] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  const { data: content, isLoading } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
  })

  const filteredContent = content?.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = typeFilter === 'all' || item.content_type === typeFilter
    return matchesSearch && matchesType
  }) || []

  const typeCounts = content?.reduce((acc, item) => {
    acc[item.content_type] = (acc[item.content_type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const totalSize = content?.reduce((sum, item) => sum + item.file_size, 0) || 0

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    // In a real app, this would upload the files
  }, [])

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Content Library</h1>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Upload size={16} />
          Upload File
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{content?.length || 0}</p>
          <p className="text-sm text-navy-400">Total Files</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-400">{typeCounts.document || 0}</p>
          <p className="text-sm text-navy-400">Documents</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-red-400">{typeCounts.video || 0}</p>
          <p className="text-sm text-navy-400">Videos</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-cyan-400">{formatFileSize(totalSize)}</p>
          <p className="text-sm text-navy-400">Total Size</p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-cyan-400 bg-cyan-900/10'
            : 'border-navy-700 hover:border-navy-500 bg-navy-900/30'
        }`}
      >
        <Upload className={`mx-auto mb-3 ${dragOver ? 'text-cyan-400' : 'text-navy-500'}`} size={32} />
        <p className={`text-sm font-medium mb-1 ${dragOver ? 'text-cyan-300' : 'text-navy-300'}`}>
          {dragOver ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
        </p>
        <p className="text-xs text-navy-500">
          Supports PDF, DOCX, MP4, PNG, JPG, MP3, HTML — Max 100 MB
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" size={16} />
          <input
            type="text"
            placeholder="Search files, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              typeFilter === 'all'
                ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
                : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
            }`}
          >
            All ({content?.length || 0})
          </button>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                typeFilter === key
                  ? `${meta.bg} ${meta.color} border-current/20`
                  : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
              }`}
            >
              <meta.icon size={12} />
              {meta.label} ({typeCounts[key] || 0})
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-navy-700 text-white' : 'text-navy-400 hover:text-white'
            }`}
            aria-label="Grid view"
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-navy-700 text-white' : 'text-navy-400 hover:text-white'
            }`}
            aria-label="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading content...</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredContent.map((item) => {
            const meta = TYPE_META[item.content_type] || TYPE_META.other
            const Icon = meta.icon
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="card hover:border-cyan-700/50 transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className={`h-32 ${meta.bg} rounded-t-xl flex items-center justify-center relative`}>
                  <Icon className={`${meta.color} opacity-40`} size={40} />
                  <span className={`absolute top-2 left-2 badge text-[10px] ${meta.color} ${meta.bg}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors truncate mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-navy-500 line-clamp-2 mb-3">
                    {item.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="badge text-[9px] bg-navy-800 text-navy-400">
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="badge text-[9px] bg-navy-800 text-navy-500">
                        +{item.tags.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-[10px] text-navy-500">
                    <span className="flex items-center gap-1">
                      <HardDrive size={10} />
                      {formatFileSize(item.file_size)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">File</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Type</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Tags</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Size</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Course</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Uploaded</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-navy-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContent.map((item) => {
                  const meta = TYPE_META[item.content_type] || TYPE_META.other
                  const Icon = meta.icon
                  return (
                    <tr key={item.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition-colors cursor-pointer" onClick={() => setSelectedItem(item)}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg}`}>
                            <Icon size={16} className={meta.color} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white truncate max-w-xs">{item.title}</p>
                            <p className="text-xs text-navy-500 truncate max-w-xs">{item.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`badge text-[10px] ${meta.color} ${meta.bg}`}>{meta.label}</span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="badge text-[9px] bg-navy-800 text-navy-400">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-navy-400">{formatFileSize(item.file_size)}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-navy-400">{item.course_title || '—'}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-navy-400">{new Date(item.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1 text-navy-400 hover:text-white transition-colors" aria-label="View">
                            <Eye size={14} />
                          </button>
                          <button className="p-1 text-navy-400 hover:text-white transition-colors" aria-label="Download">
                            <Download size={14} />
                          </button>
                          <button className="p-1 text-navy-400 hover:text-red-400 transition-colors" aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredContent.length === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <FileText className="mx-auto text-navy-600 mb-4" size={40} />
          <p className="text-navy-400 mb-4">
            {searchQuery || typeFilter !== 'all' ? 'No files match your filters.' : 'No content yet. Upload your first file!'}
          </p>
        </div>
      )}

      {/* File detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-navy-700">
              <h2 className="text-lg font-semibold text-white truncate">{selectedItem.title}</h2>
              <button onClick={() => setSelectedItem(null)} className="text-navy-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-navy-300">{selectedItem.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-navy-500 mb-1">Type</p>
                  <span className={`badge text-xs ${TYPE_META[selectedItem.content_type]?.color} ${TYPE_META[selectedItem.content_type]?.bg}`}>
                    {TYPE_META[selectedItem.content_type]?.label}
                  </span>
                </div>
                <div>
                  <p className="text-navy-500 mb-1">Size</p>
                  <p className="text-white">{formatFileSize(selectedItem.file_size)}</p>
                </div>
                <div>
                  <p className="text-navy-500 mb-1">Uploaded by</p>
                  <p className="text-white">{selectedItem.uploaded_by_email}</p>
                </div>
                <div>
                  <p className="text-navy-500 mb-1">Course</p>
                  <p className="text-white">{selectedItem.course_title || 'Unlinked'}</p>
                </div>
                <div>
                  <p className="text-navy-500 mb-1">MIME Type</p>
                  <p className="text-white font-mono text-xs">{selectedItem.mime_type}</p>
                </div>
                <div>
                  <p className="text-navy-500 mb-1">Created</p>
                  <p className="text-white">{new Date(selectedItem.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <p className="text-navy-500 text-sm mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedItem.tags.map((tag) => (
                    <span key={tag} className="badge text-[10px] bg-navy-800 text-navy-300">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-5 border-t border-navy-700">
              <button className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Download size={14} />
                Download
              </button>
              <button className="btn-secondary flex items-center gap-2">
                <Eye size={14} />
                Preview
              </button>
              <button className="btn-ghost text-red-400 flex items-center gap-2 px-3">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
