/**
 * Consent Management — UU PDP Article 21 Right to Withdraw Consent
 *
 * Parents can manage consent for their linked children.
 * Students can manage their own consent.
 * Each consent purpose can be independently granted or withdrawn.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { apiClient } from '@/api/client'
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Clock,
  Send, Info, FileText, MessageSquare, Baby,
  BarChart3, ExternalLink,
} from 'lucide-react'

interface ConsentRecord {
  id: string
  user: string
  purpose: string
  status: string
  granted: boolean
  granted_at: string | null
  withdrawn_at: string | null
  withdrawal_reason: string
  expires_at: string | null
  data_categories: string[]
  processing_purpose: string
  lawful_basis: string
  is_active: boolean
  is_expired: boolean
  created_at: string
}

const PURPOSE_CONFIG: Record<string, {
  label: string; icon: React.ReactNode; color: string; description: string
}> = {
  learning: {
    label: 'Learning Data Processing',
    icon: <FileText size={20} />,
    color: 'cyan',
    description: 'Course enrolments, lesson progress, grades, assignments, essay responses, and canvas work.',
  },
  analytics: {
    label: 'Aggregate Analytics',
    icon: <BarChart3 size={20} />,
    color: 'purple',
    description: 'Anonymized learning analytics used to improve educational quality.',
  },
  communication: {
    label: 'Communication',
    icon: <MessageSquare size={20} />,
    color: 'green',
    description: 'Grade notifications, assignment reminders, parent updates, and system messages.',
  },
  third_party: {
    label: 'Third Party Sharing',
    icon: <ExternalLink size={20} />,
    color: 'orange',
    description: 'Sharing data with approved third-party services for educational purposes only.',
  },
  marketing: {
    label: 'Marketing & Promotions',
    icon: <Send size={20} />,
    color: 'yellow',
    description: 'Promotional emails, newsletters, and event announcements.',
  },
  child_data: {
    label: 'Child Personal Data Processing',
    icon: <Baby size={20} />,
    color: 'purple',
    description: 'Processing of child personal data for educational service delivery with enhanced protection.',
  },
  safeguarding: {
    label: 'Safeguarding & Welfare',
    icon: <Shield size={20} />,
    color: 'green',
    description: 'Data processing for child welfare, safeguarding reports, and welfare checks.',
  },
}

function StatusBadge({ consent }: { consent: ConsentRecord }) {
  if (consent.is_expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-700/30">
        <Clock size={12} /> Expired
      </span>
    )
  }
  if (consent.status === 'granted') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-700/30">
        <CheckCircle size={12} /> Granted
      </span>
    )
  }
  if (consent.status === 'withdrawn') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-700/30">
        <XCircle size={12} /> Withdrawn
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-700/30">
      <Clock size={12} /> {consent.status}
    </span>
  )
}

function WithdrawModal({ consent, onClose, onConfirm }: {
  consent: ConsentRecord; onClose: () => void; onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const config = PURPOSE_CONFIG[consent.purpose] || { label: consent.purpose, icon: <Shield size={20} />, color: 'cyan' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-800 border border-navy-700 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-900/30 rounded-xl flex items-center justify-center text-red-400">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Withdraw Consent</h3>
            <p className="text-sm text-navy-400">{config.label}</p>
          </div>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4 mb-4">
          <p className="text-yellow-300 text-sm">
            <strong>Important:</strong> Withdrawing consent does not affect the lawfulness of processing that occurred before the withdrawal. Some services may become unavailable or limited after withdrawal.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-navy-300 mb-2">
            Reason for withdrawal (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            rows={3}
            placeholder="Why are you withdrawing this consent?"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-navy-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Withdraw Consent
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConsentManagementPage() {
  const { roles } = useAuth()
  const qc = useQueryClient()
  const [withdrawTarget, setWithdrawTarget] = useState<ConsentRecord | null>(null)

  // Fetch consent records
  const { data: consents = [], isLoading } = useQuery<ConsentRecord[]>({
    queryKey: ['consentRecords'],
    queryFn: async () => {
      try {
        const data = await apiClient.get<{ results: ConsentRecord[] }>('/consent/records/')
        return data.results || []
      } catch {
        return []
      }
    },
    staleTime: 30_000,
  })

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiClient.post(`/consent/records/${id}/withdraw/`, { reason })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consentRecords'] })
      setWithdrawTarget(null)
    },
  })

  // Grant mutation
  const grantMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.post(`/consent/records/${id}/grant/`, {})
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consentRecords'] })
    },
  })

  const isParent = roles.includes('parent')

  // Group consents by status
  const activeConsents = consents.filter(c => c.status === 'granted')
  const withdrawnConsents = consents.filter(c => c.status === 'withdrawn')
  const pendingConsents = consents.filter(c => c.status === 'pending')

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-navy-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Consent Management</h1>
            <p className="text-sm text-navy-400">Manage your data processing preferences per UU PDP</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-xl p-4 flex gap-3">
        <Info size={20} className="text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-sm text-navy-300">
          <p>
            Under <strong className="text-white">UU PDP Article 21</strong>, you have the right to withdraw your consent at any time.
            Withdrawal does not affect the lawfulness of processing that occurred before the withdrawal.
          </p>
          {isParent && (
            <p className="mt-2 text-purple-300">
              As a parent/guardian, you can manage consent for your linked children.
            </p>
          )}
        </div>
      </div>

      {/* Active Consents */}
      {activeConsents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-400" />
            Active Consents
            <span className="text-sm font-normal text-navy-400">({activeConsents.length})</span>
          </h2>
          <div className="space-y-3">
            {activeConsents.map(consent => {
              const config = PURPOSE_CONFIG[consent.purpose] || {
                label: consent.purpose, icon: <Shield size={20} />, color: 'cyan', description: '',
              }
              return (
                <div key={consent.id} className="bg-navy-800/50 border border-navy-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 bg-${config.color}-900/30 rounded-xl flex items-center justify-center text-${config.color}-400 shrink-0`}>
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{config.label}</h3>
                        <p className="text-sm text-navy-400 mt-1">{config.description}</p>
                        {consent.data_categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {consent.data_categories.map(cat => (
                              <span key={cat} className="text-xs bg-navy-700 text-navy-300 px-2 py-0.5 rounded">
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-navy-500">
                          <span>Granted: {consent.granted_at ? new Date(consent.granted_at).toLocaleDateString() : 'N/A'}</span>
                          {consent.expires_at && (
                            <span>Expires: {new Date(consent.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge consent={consent} />
                      <button
                        onClick={() => setWithdrawTarget(consent)}
                        className="px-3 py-1.5 text-xs font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-700/30 rounded-lg transition-colors"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending Consents */}
      {pendingConsents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock size={18} className="text-yellow-400" />
            Pending Consents
            <span className="text-sm font-normal text-navy-400">({pendingConsents.length})</span>
          </h2>
          <div className="space-y-3">
            {pendingConsents.map(consent => {
              const config = PURPOSE_CONFIG[consent.purpose] || {
                label: consent.purpose, icon: <Shield size={20} />, color: 'cyan', description: '',
              }
              return (
                <div key={consent.id} className="bg-navy-800/50 border border-yellow-700/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 bg-yellow-900/30 rounded-xl flex items-center justify-center text-yellow-400 shrink-0`}>
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{config.label}</h3>
                        <p className="text-sm text-navy-400 mt-1">{config.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => grantMutation.mutate(consent.id)}
                      disabled={grantMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-700/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {grantMutation.isPending ? 'Granting...' : 'Grant'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Withdrawn Consents */}
      {withdrawnConsents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <XCircle size={18} className="text-red-400" />
            Withdrawn Consents
            <span className="text-sm font-normal text-navy-400">({withdrawnConsents.length})</span>
          </h2>
          <div className="space-y-3">
            {withdrawnConsents.map(consent => {
              const config = PURPOSE_CONFIG[consent.purpose] || {
                label: consent.purpose, icon: <Shield size={20} />, color: 'cyan', description: '',
              }
              return (
                <div key={consent.id} className="bg-navy-800/50 border border-navy-700 rounded-xl p-4 opacity-75">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-navy-700 rounded-xl flex items-center justify-center text-navy-400 shrink-0">
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{config.label}</h3>
                        {consent.withdrawal_reason && (
                          <p className="text-sm text-red-400 mt-1">Reason: {consent.withdrawal_reason}</p>
                        )}
                        <p className="text-xs text-navy-500 mt-1">
                          Withdrawn: {consent.withdrawn_at ? new Date(consent.withdrawn_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => grantMutation.mutate(consent.id)}
                      disabled={grantMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50 border border-cyan-700/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Re-grant
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {consents.length === 0 && (
        <div className="text-center py-16">
          <Shield size={48} className="mx-auto text-navy-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Consent Records</h3>
          <p className="text-navy-400 text-sm">
            No consent records found for your account. Consent records are created when you register and grant permissions.
          </p>
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawTarget && (
        <WithdrawModal
          consent={withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          onConfirm={(reason) => {
            withdrawMutation.mutate({ id: withdrawTarget.id, reason })
          }}
        />
      )}
    </div>
  )
}
