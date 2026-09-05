import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Award, XCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { apiClient } from '@/api/client'

interface VerifyResult {
  valid: boolean
  certificate_number?: string
  recipient_name?: string
  title?: string
  course?: string | null
  programme?: string | null
  issued_date?: string
  status?: string
  error?: string
}

export function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>()
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) {
      setError('No verification code provided')
      setLoading(false)
      return
    }

    const verify = async () => {
      try {
        const res = await apiClient.get<VerifyResult>(`/certificates/verify/${code}/`)
        setResult(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to verify certificate')
      } finally {
        setLoading(false)
      }
    }

    void verify()
  }, [code])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={32} />
          <p className="text-navy-400">Verifying certificate...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center p-8">
          <XCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">Verification Error</h1>
          <p className="text-navy-400 mb-6">{error}</p>
          <Link to="/login" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  const isValid = result?.valid && result?.status === 'active'

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8">
        <div className="text-center mb-6">
          {isValid ? (
            <CheckCircle className="text-green-400 mx-auto mb-4" size={56} />
          ) : (
            <XCircle className="text-red-400 mx-auto mb-4" size={56} />
          )}
          <h1 className="text-2xl font-bold text-white mb-2">
            {isValid ? 'Certificate Verified ✓' : 'Certificate Invalid'}
          </h1>
          <p className="text-navy-400 text-sm">
            {isValid
              ? 'This certificate is genuine and has been issued by AKADEMI Digital Campus.'
              : result?.status === 'revoked'
                ? 'This certificate has been revoked.'
                : 'No certificate found with this verification code.'}
          </p>
        </div>

        {isValid && result && (
          <div className="space-y-4 mb-6">
            <div className="bg-navy-800/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">Certificate No.</span>
                <span className="text-white text-sm font-mono">{result.certificate_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">Recipient</span>
                <span className="text-white text-sm">{result.recipient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">Title</span>
                <span className="text-white text-sm">{result.title}</span>
              </div>
              {result.course && (
                <div className="flex justify-between">
                  <span className="text-navy-400 text-sm">Course</span>
                  <span className="text-white text-sm">{result.course}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">Issued</span>
                <span className="text-white text-sm">{result.issued_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">Status</span>
                <span className="text-green-400 text-sm font-medium capitalize">{result.status}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-navy-500">
            <Award size={16} />
            <span className="text-xs">AKADEMI Digital Campus</span>
          </div>
          <Link to="/login" className="btn-secondary inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={14} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
