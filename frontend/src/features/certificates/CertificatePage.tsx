import { Award, ExternalLink, XCircle, Copy, Download } from 'lucide-react'
import { useCertificates } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { CertificateQR } from '@/components/CertificateQR'
import { exportToCSV, formatDate, type CSVColumn } from '@/utils/csvExport'
import type { Certificate } from '@/api/hooks'

const CERT_CSV_COLUMNS: CSVColumn[] = [
  { key: 'certificate_number', label: 'Certificate No' },
  { key: 'title', label: 'Title' },
  { key: 'recipient_name', label: 'Recipient' },
  { key: 'recipient_email', label: 'Email' },
  { key: 'course_title', label: 'Course' },
  { key: 'status', label: 'Status' },
  { key: 'issued_date', label: 'Issued', format: formatDate },
  { key: 'verification_code', label: 'Verification Code' },
]

function CertificateCard({ cert }: { cert: Certificate }) {
  const isRevoked = cert.status === 'revoked'
  const verifyUrl = `${window.location.origin}/verify-certificate/${cert.verification_code}`

  const copyVerificationCode = () => {
    navigator.clipboard.writeText(cert.verification_code)
  }

  return (
    <div className={`card ${isRevoked ? 'opacity-60 border-red-500/30' : 'border-green-500/20'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isRevoked ? 'bg-red-900/30' : 'bg-green-900/30'}`}>
            {isRevoked ? (
              <XCircle size={20} className="text-red-400" />
            ) : (
              <Award size={20} className="text-green-400" />
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold">{cert.title}</h3>
            <p className="text-navy-400 text-sm">{cert.certificate_number}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          isRevoked ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
        }`}>
          {isRevoked ? 'Revoked' : 'Active'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <p className="text-navy-400">Course</p>
          <p className="text-white">{cert.course_title || '—'}</p>
        </div>
        <div>
          <p className="text-navy-400">Programme</p>
          <p className="text-white">{cert.programme_name || '—'}</p>
        </div>
        <div>
          <p className="text-navy-400">Issued</p>
          <p className="text-white">{new Date(cert.issued_date).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-navy-400">Issued By</p>
          <p className="text-white">{cert.issued_by_email || '—'}</p>
        </div>
      </div>

      {cert.revoked_reason && (
        <div className="p-2 bg-red-900/20 rounded mb-3">
          <p className="text-red-400 text-xs">Revoked: {cert.revoked_reason}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-navy-700">
        <button
          onClick={copyVerificationCode}
          className="flex items-center gap-1 text-xs text-navy-400 hover:text-cyan-400"
        >
          <Copy size={12} />
          Copy Code
        </button>
        <span className="text-navy-600">|</span>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <ExternalLink size={12} />
          Verify Online
        </a>
      </div>

      <div className="mt-4 pt-3 border-t border-navy-700 flex justify-center">
        <CertificateQR verificationCode={cert.verification_code} certificateNumber={cert.certificate_number} size={120} />
      </div>
    </div>
  )
}

export function CertificatePage() {
  const { roles } = useAuth()
  const { data: certificates = [], isLoading } = useCertificates()

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Award className="text-green-400" size={24} />
        <h1 className="page-title mb-0">Certificates</h1>
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-subtitle mb-0">
          {roles.includes('student')
            ? 'Your course completion certificates'
            : 'Issued certificates and verification'}
        </p>
        {(roles.includes('admin') || roles.includes('owner') || roles.includes('instructor')) && certificates.length > 0 && (
          <button
            onClick={() => exportToCSV(certificates, CERT_CSV_COLUMNS, 'certificates')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            Export
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-navy-400 mt-3">Loading certificates...</p>
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-12">
          <Award className="mx-auto text-navy-600 mb-3" size={48} />
          <h3 className="text-navy-400 text-lg">No certificates yet</h3>
          <p className="text-navy-500 text-sm mt-1">
            Complete a course to earn your certificate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.map((cert: Certificate) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  )
}
