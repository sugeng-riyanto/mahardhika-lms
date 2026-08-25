/**
 * Privacy Notice — UU PDP (Undang-Undang Pelindungan Data Pribadi) Compliance
 *
 * Public page accessible without authentication.
 * Displays data controller info, legal basis, data categories, user rights,
 * child protection measures, and contact information.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import {
  Shield, Eye, Download, Trash2, Edit3, Ban, Lock, UserCheck,
  Baby, Mail, FileText, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'

interface PrivacyNotice {
  title: string
  version: string
  effective_date: string
  last_updated: string
  data_controller: { name: string; email: string; address: string }
  data_protection_officer: { name: string; email: string }
  legal_basis: Array<{ basis: string; description: string }>
  data_collected: Array<{
    category: string; examples: string; purpose: string; retention: string
  }>
  your_rights: Array<{ right: string; description: string }>
  child_protection: {
    description: string
    parental_consent_required: boolean
    minimum_age_without_consent: number
    enhanced_safeguards: string[]
  }
  data_security: { measures: string[] }
  contact: Record<string, string>
}

const RIGHT_ICONS: Record<string, React.ReactNode> = {
  'Right to Information': <Eye size={18} />,
  'Right to Access': <FileText size={18} />,
  'Right to Correction': <Edit3 size={18} />,
  'Right to Deletion': <Trash2 size={18} />,
  'Right to Restrict': <Ban size={18} />,
  'Right to Data Portability': <Download size={18} />,
  'Right to Withdraw': <Lock size={18} />,
  'Right to Object': <Ban size={18} />,
}

function getRightIcon(right: string): React.ReactNode {
  for (const [key, icon] of Object.entries(RIGHT_ICONS)) {
    if (right.includes(key)) return icon
  }
  return <Shield size={18} />
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-navy-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-navy-800/50 hover:bg-navy-800 transition-colors text-left"
      >
        <span className="text-cyan-400">{icon}</span>
        <span className="font-semibold text-white flex-1">{title}</span>
        {open ? <ChevronDown size={20} className="text-navy-400" /> : <ChevronRight size={20} className="text-navy-400" />}
      </button>
      {open && <div className="px-5 py-4 bg-navy-900/50">{children}</div>}
    </div>
  )
}

export function PrivacyNoticePage() {
  const { data: notice, isLoading, error } = useQuery<PrivacyNotice>({
    queryKey: ['privacyNotice'],
    queryFn: async () => {
      try {
        return await apiClient.get<PrivacyNotice>('/consent/privacy-notice/')
      } catch {
        return null as unknown as PrivacyNotice
      }
    },
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-navy-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !notice) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <Shield size={48} className="mx-auto text-navy-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Privacy Notice Unavailable</h2>
        <p className="text-navy-400">Unable to load privacy notice. Please try again later.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl mb-4">
          <Shield size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{notice.title}</h1>
        <div className="flex items-center justify-center gap-4 text-sm text-navy-400">
          <span>Version {notice.version}</span>
          <span>•</span>
          <span>Effective: {new Date(notice.effective_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span>•</span>
          <span>Last updated: {new Date(notice.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Data Controller */}
      <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 border border-cyan-700/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Data Controller</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-navy-400">Organization</p>
            <p className="text-white font-medium">{notice.data_controller.name}</p>
          </div>
          <div>
            <p className="text-navy-400">Email</p>
            <p className="text-cyan-400">{notice.data_controller.email}</p>
          </div>
          <div>
            <p className="text-navy-400">Address</p>
            <p className="text-white">{notice.data_controller.address}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Legal Basis */}
        <CollapsibleSection title="Legal Basis for Processing" icon={<Shield size={18} />} defaultOpen>
          <div className="space-y-3">
            {notice.legal_basis.map((b, i) => (
              <div key={i} className="bg-navy-800/50 rounded-lg p-3">
                <p className="text-cyan-400 font-medium text-sm">{b.basis}</p>
                <p className="text-navy-300 text-sm mt-1">{b.description}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Data Collected */}
        <CollapsibleSection title="Personal Data We Collect" icon={<Eye size={18} />}>
          <div className="space-y-3">
            {notice.data_collected.map((d, i) => (
              <div key={i} className="bg-navy-800/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white font-medium">{d.category}</h4>
                  <span className="text-xs bg-navy-700 text-navy-300 px-2 py-1 rounded">
                    Retention: {d.retention}
                  </span>
                </div>
                <p className="text-sm text-navy-300"><span className="text-navy-400">Examples:</span> {d.examples}</p>
                <p className="text-sm text-navy-300 mt-1"><span className="text-navy-400">Purpose:</span> {d.purpose}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Your Rights */}
        <CollapsibleSection title="Your Rights (UU PDP Article 21)" icon={<UserCheck size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notice.your_rights.map((r, i) => (
              <div key={i} className="flex gap-3 bg-navy-800/50 rounded-lg p-3">
                <span className="text-cyan-400 mt-0.5 shrink-0">{getRightIcon(r.right)}</span>
                <div>
                  <p className="text-white font-medium text-sm">{r.right}</p>
                  <p className="text-navy-300 text-xs mt-1">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Child Protection */}
        <CollapsibleSection title="Child Data Protection" icon={<Baby size={18} />}>
          <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4 mb-3">
            <p className="text-purple-300 text-sm">{notice.child_protection.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
            <div>
              <p className="text-navy-400">Parental Consent Required</p>
              <p className="text-white font-medium">
                {notice.child_protection.parental_consent_required ? 'Yes ✓' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-navy-400">Minimum Age (without consent)</p>
              <p className="text-white font-medium">{notice.child_protection.minimum_age_without_consent} years</p>
            </div>
          </div>
          <h4 className="text-white font-medium text-sm mb-2">Enhanced Safeguards</h4>
          <ul className="space-y-2">
            {notice.child_protection.enhanced_safeguards.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-navy-300">
                <span className="text-green-400 mt-0.5">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Data Security */}
        <CollapsibleSection title="Data Security Measures" icon={<Lock size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {notice.data_security.measures.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-navy-300 bg-navy-800/50 rounded-lg px-3 py-2">
                <Lock size={14} className="text-green-400 shrink-0" />
                {m}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Contact */}
        <CollapsibleSection title="Contact & Complaints" icon={<Mail size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {Object.entries(notice.contact).map(([key, value]) => (
              <div key={key}>
                <p className="text-navy-400 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-cyan-400 flex items-center gap-1">
                  {value}
                  {value.includes('@') && <ExternalLink size={12} />}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-sm text-navy-500">
        <p>This privacy notice is provided in compliance with</p>
        <p className="font-medium text-navy-400 mt-1">
          Undang-Undang Pelindungan Data Pribadi (UU PDP) No. 27 of 2022
        </p>
      </div>
    </div>
  )
}
