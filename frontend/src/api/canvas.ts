import { apiClient } from './client'

// ============================================
// Canvas API
// ============================================

export interface CanvasDocument {
  id: string
  student: string
  student_email: string
  course: string | null
  essay_response: string | null
  question_data: Record<string, unknown>
  student_answer_data: Record<string, unknown>
  teacher_feedback_data: Record<string, unknown>
  student_revision_data: Record<string, unknown>
  page_width: number
  page_height: number
  status: string
  is_locked: boolean
  submitted_version: number | null
  document_version: number
  checksum: string
  version_count: number
  created_at: string
  updated_at: string
}

export interface CanvasVersion {
  id: string
  version_number: number
  author: string
  author_email: string
  question_data: Record<string, unknown>
  student_answer_data: Record<string, unknown>
  teacher_feedback_data: Record<string, unknown>
  student_revision_data: Record<string, unknown>
  description: string
  checksum: string
  created_at: string
}

export async function fetchCanvasDocuments(params?: { course?: string; student?: string }): Promise<CanvasDocument[]> {
  const searchParams = new URLSearchParams()
  if (params?.course) searchParams.set('course', params.course)
  if (params?.student) searchParams.set('student', params.student)
  const qs = searchParams.toString()
  const res = await apiClient.get<{ results: CanvasDocument[] } | CanvasDocument[]>(`/canvas-documents/${qs ? `?${qs}` : ''}`)
  return Array.isArray(res) ? res : res.results ?? []
}

export async function fetchCanvasDocument(id: string): Promise<CanvasDocument> {
  return await apiClient.get<CanvasDocument>(`/canvas-documents/${id}/`)
}

export async function createCanvasDocument(data: {
  course?: string
  essay_response?: string
  question_data?: Record<string, unknown>
  student_answer_data?: Record<string, unknown>
}): Promise<CanvasDocument> {
  return await apiClient.post<CanvasDocument>('/canvas-documents/', data)
}

export async function autosaveCanvas(
  id: string,
  layer: string,
  data: Record<string, unknown>,
  expectedVersion: number,
): Promise<{ version: number; checksum: string; saved_at: string }> {
  return await apiClient.post<{ version: number; checksum: string; saved_at: string }>(
    `/canvas-documents/${id}/autosave/`,
    { layer, data, expected_version: expectedVersion },
  )
}

export async function submitCanvas(id: string): Promise<{ status: string; version: number }> {
  return await apiClient.post<{ status: string; version: number }>(`/canvas-documents/${id}/submit/`)
}

export async function returnCanvasForRevision(id: string, reason?: string): Promise<{ status: string }> {
  return await apiClient.post<{ status: string }>(`/canvas-documents/${id}/return-for-revision/`, { reason })
}

export async function fetchCanvasVersions(id: string): Promise<CanvasVersion[]> {
  return await apiClient.get<CanvasVersion[]>(`/canvas-documents/${id}/versions/`)
}

export async function fetchCanvasVersion(id: string, versionNumber: number): Promise<CanvasVersion> {
  return await apiClient.get<CanvasVersion>(`/canvas-documents/${id}/versions/${versionNumber}/`)
}
