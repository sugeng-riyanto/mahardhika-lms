import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { XCircle, Loader2, ShieldCheck, FileCheck2 } from 'lucide-react'
import { apiClient } from '@/api/client'

interface VerifyResult {
  valid: boolean
  verify_hash?: string
  assignment_title?: string
  course_title?: string
  organisation?: string
  student_email?: string
  student_name?: string
  status?: string
  score?: number | null
  attempt_number?: number
  submitted_at?: string | null
  graded_at?: string | null
  task_type?: string
  detail?: string
}

function formatDate(v?: string | null): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function VerifySubmissionPage() {
  const { hash } = useParams<{ hash: string }>()
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hash) {
      setError('No verification code provided')
      setLoading(false)
      return
    }
    const verify = async () => {
      try {
        const res = await apiClient.get<VerifyResult>(`/assignments/submissions/verify/${hash}/`)
        setResult(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to verify this record')
      } finally {
        setLoading(false)
      }
    }
    void verify()
  }, [hash])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={32} />
          <p className="text-navy-400">Verifying submission record...</p>
        </div>
      </div>
    )
  }

  if (error || !result?.valid) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
        <div className="bg-navy-900 border border-red-700/40 rounded-2xl p-8 max-w-md w-full text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Record not verified</h1>
          <p className="text-navy-400 text-sm mb-6">
            {error || result?.detail || 'No submission record matches this code.'}
          </p>
          <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="bg-navy-900 border border-green-700/40 rounded-2xl p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck size={28} className="text-green-400" />
          <h1 className="text-xl font-bold text-white">Submission verified</h1>
        </div>
        <p className="text-navy-400 text-sm mb-6">
          This record matches an official submission in the {result.organisation || 'academy'} system.
        </p>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Assignment</span>
            <span className="text-white font-medium text-right">{result.assignment_title}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Course</span>
            <span className="text-white font-medium text-right">{result.course_title}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Student</span>
            <span className="text-white font-medium text-right">
              {result.student_name || result.student_email}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Status</span>
            <span className="text-white font-medium capitalize">{result.status}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Score</span>
            <span className="text-white font-medium">
              {result.score !== null && result.score !== undefined ? result.score : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Attempt</span>
            <span className="text-white font-medium">{result.attempt_number ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-navy-800 pb-2">
            <span className="text-navy-400">Submitted</span>
            <span className="text-white font-medium">{formatDate(result.submitted_at)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-navy-400">Graded</span>
            <span className="text-white font-medium">{formatDate(result.graded_at)}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-navy-800 flex items-center justify-between">
          <span className="text-navy-500 text-xs font-mono truncate pr-3">
            {result.verify_hash}
          </span>
          <FileCheck2 size={18} className="text-green-400 shrink-0" />
        </div>
        <Link
          to="/"
          className="mt-6 inline-block text-cyan-400 hover:text-cyan-300 text-sm underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}