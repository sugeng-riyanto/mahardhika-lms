import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Search, Upload, Grid, List, Image, Package,
  Download, Trash2, Eye, Clock, HardDrive,
  X, Film, Headphones, Layers, Edit, FileDown, Loader2, ExternalLink
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { CrudModal, type CrudField } from '@/components/CrudModal'
import { VideoEmbed } from '@/components/VideoEmbed'
import { DrivePdfEmbed } from '@/components/DrivePdfEmbed'
import { parseVideoUrl, videoEmbedUrl, isGoogleDriveUrl } from '@/utils/videoEmbed'
import { exportToCSV, formatDate, type CSVColumn } from '@/utils/csvExport'

const CONTENT_CSV_COLUMNS: CSVColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'content_type', label: 'Type' },
  { key: 'course_title', label: 'Course' },
  { key: 'file_size', label: 'Size', format: (v) => { const b = Number(v); if (!b) return '0 B'; const k = 1024; const s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(k)); return (b/Math.pow(k,i)).toFixed(1)+' '+s[i]; } },
  { key: 'tags', label: 'Tags', format: (v) => (v as string[] || []).join('; ') },
  { key: 'uploaded_by_email', label: 'Uploaded By' },
  { key: 'created_at', label: 'Created', format: formatDate },
]

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
  { id: 'ci2', title: "Newton's Laws Animation", description: "Interactive animation showing Newton's three laws of motion", content_type: 'video', file_url: '/files/newton-laws.mp4', mime_type: 'video/mp4', file_size: 15728640, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['physics', 'newton', 'forces'], course: null, course_title: 'Physics 10', created_at: '2026-08-24T11:00:00Z', updated_at: '2026-08-24T11:00:00Z' },
  { id: 'ci3', title: 'Periodic Table Reference', description: 'High-resolution periodic table with element details', content_type: 'image', file_url: '/files/periodic-table.png', mime_type: 'image/png', file_size: 1048576, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['chemistry', 'reference'], course: null, course_title: 'Science 7', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' },
  { id: 'ci4', title: 'Geometry Formula Sheet', description: 'Comprehensive formula reference for geometry', content_type: 'document', file_url: '/files/geometry-formulas.pdf', mime_type: 'application/pdf', file_size: 307200, uploaded_by: '4', uploaded_by_email: 'Instructor Mahardhika', tags: ['math', 'geometry', 'reference'], course_title: 'Mathematics 7A', created_at: '2026-08-24T17:00:00Z', updated_at: '2026-08-24T17:00:00Z' },
]

const TYPE_META: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  document: { label: 'Document', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-900/30' },
  video: { label: 'Video', icon: Film, color: 'text-red-400', bg: 'bg-red-900/30' },
  image: { label: 'Image', icon: Image, color: 'text-green-400', bg: 'bg-green-900/30' },
  audio: { label: 'Audio', icon: Headphones, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  interactive: { label: 'Interactive', icon: Layers, color: 'text-orange-400', bg: 'bg-orange-900/30' },
  other: { label: 'Other', icon: Package, color: 'text-navy-400', bg: 'bg-navy-800' },
}

const VIDEO_FIELDS: CrudField[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Video title' },
  { name: 'video_url', label: 'YouTube / Google Drive Link', type: 'text', required: true, placeholder: 'https://www.youtube.com/watch?v=... or https://drive.google.com/file/d/.../view' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Description...' },
  { name: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'physics, lecture' },
]

const CONTENT_FIELDS: CrudField[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Content title' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Description...' },
  { name: 'content_type', label: 'Type', type: 'select', required: true, options: [
    { value: 'document', label: 'Document' },
    { value: 'video', label: 'Video' },
    { value: 'image', label: 'Image' },
    { value: 'audio', label: 'Audio' },
    { value: 'interactive', label: 'Interactive' },
  ]},
  { name: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'math, physics, reference' },
]

const PDF_FIELDS: CrudField[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'PDF title' },
  { name: 'drive_url', label: 'Google Drive Link', type: 'text', required: true, placeholder: 'https://drive.google.com/file/d/.../view' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Description...' },
  { name: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'math, physics, reference' },
]

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const ACCEPT_TYPES = '.pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mov,.mp3,.wav,.ogg,.m4a,.zip,.json,.xml,.py,.js'

function detectMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', rtf: 'application/rtf',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    zip: 'application/zip', json: 'application/json', xml: 'application/xml',
    py: 'text/x-python', js: 'text/javascript',
  }
  return map[ext] || 'application/octet-stream'
}

async function fetchContent(): Promise<ContentItem[]> {
  try {
    const data = await apiClient.list<ContentItem>('/content/')
    return data.results
  } catch {
    return MOCK_CONTENT
  }
}

interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'view'
  data: Record<string, unknown>
}

export function ContentLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'create', data: {} })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { roles } = useAuth()
  const canEdit = roles.includes('admin') || roles.includes('owner') || roles.includes('instructor')

  const { data: content, isLoading, refetch } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
  })

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    setUploadMessage('')
    try {
      for (const file of files) {
        const mime = file.type || detectMime(file.name)
        const req = await apiClient.post<{ upload_url: string; file_path: string }>('/content/upload/request/', {
          filename: file.name,
          file_size: file.size,
          content_type: mime,
        })
        // PUT the bytes directly to the Supabase signed upload URL.
        // Mock-mode URLs (local dev without Supabase) are skipped — the
        // confirm step still records the item so the flow works offline.
        if (!req.upload_url.includes('mock-storage')) {
          const up = await fetch(req.upload_url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': mime, 'x-upsert': 'true' },
          })
          if (!up.ok) throw new Error(`Upload to storage failed (HTTP ${up.status})`)
        }
        await apiClient.post('/content/upload/confirm/', {
          file_path: req.file_path,
          original_filename: file.name,
          file_size: file.size,
          content_type: mime,
          title: file.name,
        })
      }
      await refetch()
      setUploadMessage(files.length > 1 ? `${files.length} files uploaded` : `Uploaded ${files[0].name}`)
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [refetch])

  const handleDownload = useCallback(async (item: ContentItem) => {
    try {
      const res = await apiClient.get<{ url: string }>(`/content/${item.id}/download/`)
      window.open(res.url, '_blank')
    } catch {
      window.open(item.file_url, '_blank')
    }
  }, [])

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
    if (e.dataTransfer.files?.length) {
      void uploadFiles(Array.from(e.dataTransfer.files))
    }
  }, [uploadFiles])

  const openCreateVideo = () => setModal({
    isOpen: true,
    mode: 'create',
    data: { title: '', video_url: '', description: '', tags: '', content_type: 'video' },
  })

  const openCreatePdf = () => setModal({
    isOpen: true,
    mode: 'create',
    data: { title: '', drive_url: '', description: '', tags: '', content_type: 'document' },
  })

  const openEdit = (item: ContentItem) => setModal({
    isOpen: true,
    mode: 'edit',
    data: { id: item.id, title: item.title, description: item.description, content_type: item.content_type, tags: item.tags.join(', ') },
  })

  const openDelete = (item: ContentItem) => setModal({
    isOpen: true,
    mode: 'delete',
    data: { id: item.id, title: item.title },
  })

  const handleSave = async (data: Record<string, unknown>) => {
    const payload = { ...data }
    if (typeof payload.tags === 'string') {
      payload.tags = (payload.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
    }
    if (modal.mode === 'create') {
      if (modal.data.content_type === 'video' && data.video_url) {
        const url = String(data.video_url).trim()
        const parsed = parseVideoUrl(url)
        await apiClient.post('/content/', {
          title: data.title,
          description: data.description || '',
          content_type: 'video',
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          file_url: url,
          mime_type: parsed ? `video/${parsed.provider}` : 'video/url',
          metadata: parsed ? { provider: parsed.provider, file_id: parsed.file_id } : {},
        })
      } else if (modal.data.content_type === 'document' && data.drive_url) {
        const url = String(data.drive_url).trim()
        const parsed = parseVideoUrl(url)
        await apiClient.post('/content/', {
          title: data.title,
          description: data.description || '',
          content_type: 'document',
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          file_url: url,
          mime_type: 'application/pdf',
          file_size: 0,
          metadata: parsed ? { provider: 'gdrive', file_id: parsed.file_id } : {},
        })
      } else {
        await apiClient.post('/content/', payload)
      }
    } else if (modal.mode === 'edit' && payload.id) {
      await apiClient.patch(`/content/${payload.id}/`, payload)
    }
    await refetch()
    setModal({ isOpen: false, mode: 'create', data: {} })
  }

  const handleDelete = async () => {
    if (modal.data.id) {
      await apiClient.delete(`/content/${modal.data.id}/`)
      await refetch()
      setModal({ isOpen: false, mode: 'create', data: {} })
    }
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">Content Library</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filteredContent, CONTENT_CSV_COLUMNS, 'content-library')} className="btn-secondary flex items-center gap-2">
            <FileDown size={16} />
            Export CSV
          </button>
          {canEdit && (
            <>
              <button onClick={openCreateVideo} className="btn-primary flex items-center gap-2">
                <Film size={16} />
                Add Video
              </button>
              <button onClick={openCreatePdf} className="btn-primary flex items-center gap-2">
                <FileText size={16} />
                Add PDF (Drive)
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary flex items-center gap-2">
                <Upload size={16} />
                Upload File
              </button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_TYPES}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />

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
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          aria-label="Upload files"
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
          {uploading && (
            <p className="mt-3 text-sm text-cyan-400 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Uploading…
            </p>
          )}
          {uploadMessage && !uploading && (
            <p className={`mt-3 text-sm ${uploadMessage.startsWith('Uploaded') || uploadMessage.endsWith('uploaded') ? 'text-green-400' : 'text-red-400'}`}>
              {uploadMessage}
            </p>
          )}
        </div>
      )}

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
                          {canEdit && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); openEdit(item) }} className="p-1 text-navy-400 hover:text-yellow-400 transition-colors" aria-label="Edit">
                                <Edit size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); openDelete(item) }} className="p-1 text-navy-400 hover:text-red-400 transition-colors" aria-label="Delete">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
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

              {selectedItem.content_type === 'video' && videoEmbedUrl(selectedItem.file_url) && (
                <VideoEmbed url={selectedItem.file_url} title={selectedItem.title} />
              )}
              {selectedItem.content_type === 'document' && isGoogleDriveUrl(selectedItem.file_url) && (
                <DrivePdfEmbed url={selectedItem.file_url} title={selectedItem.title} />
              )}

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
              {selectedItem.content_type === 'video' && videoEmbedUrl(selectedItem.file_url) ? (
                <a href={selectedItem.file_url} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <ExternalLink size={14} />
                  Open Video
                </a>
              ) : selectedItem.content_type === 'document' && isGoogleDriveUrl(selectedItem.file_url) ? (
                <a href={selectedItem.file_url} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <ExternalLink size={14} />
                  Open PDF
                </a>
              ) : (
                <button onClick={() => void handleDownload(selectedItem)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Download size={14} />
                  Download
                </button>
              )}
              {canEdit && (
                <>
                  <button onClick={() => { setSelectedItem(null); openEdit(selectedItem) }} className="btn-secondary flex items-center gap-2">
                    <Edit size={14} />
                    Edit
                  </button>
                  <button onClick={() => { setSelectedItem(null); openDelete(selectedItem) }} className="btn-ghost text-red-400 flex items-center gap-2 px-3">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CRUD Modal */}
      <CrudModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        title={modal.data.content_type === 'video' ? 'Video' : 'Content'}
        fields={modal.data.content_type === 'video' ? VIDEO_FIELDS : (modal.mode === 'create' && modal.data.content_type === 'document' && modal.data.drive_url !== undefined ? PDF_FIELDS : CONTENT_FIELDS)}
        data={modal.data}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModal({ isOpen: false, mode: 'create', data: {} })}
      />
    </div>
  )
}
