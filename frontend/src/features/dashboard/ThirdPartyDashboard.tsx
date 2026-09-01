import { Lock, ShieldOff, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { useThirdPartyGrants } from '@/api/hooks'
import type { ThirdPartyGrant } from '@/api/hooks'

function GrantCard({ grant }: { grant: ThirdPartyGrant }) {
  const isActive = grant.is_active && (!grant.expires_at || new Date(grant.expires_at) > new Date())
  const daysLeft = grant.expires_at
    ? Math.max(0, Math.ceil((new Date(grant.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-green-900/30' : 'bg-navy-800'}`}>
            {isActive ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : (
              <Lock size={18} className="text-navy-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{grant.purpose || 'Technical Support'}</h3>
            <p className="text-xs text-navy-400">Grant ID: {grant.id.slice(0, 8)}</p>
          </div>
        </div>
        <span className={`badge text-[10px] ${isActive ? 'bg-green-900/30 text-green-400' : 'bg-navy-800 text-navy-400'}`}>
          {isActive ? 'Active' : 'Expired'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-navy-800/50 rounded-lg p-2 text-center">
          <p className="text-xs text-navy-500 mb-1">Access Scope</p>
          <p className="text-sm font-medium text-white">{grant.scope || 'Read-only'}</p>
        </div>
        <div className="bg-navy-800/50 rounded-lg p-2 text-center">
          <p className="text-xs text-navy-500 mb-1">Expires</p>
          <p className={`text-sm font-medium ${daysLeft !== null && daysLeft < 7 ? 'text-red-400' : 'text-white'}`}>
            {daysLeft !== null ? `${daysLeft}d remaining` : 'No expiry'}
          </p>
        </div>
      </div>

      {grant.created_at && (
        <p className="text-[10px] text-navy-500">
          Created: {new Date(grant.created_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

export function ThirdPartyDashboard() {
  const { data: grants = [], isLoading } = useThirdPartyGrants()

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="text-navy-400" size={24} />
          <h1 className="page-title mb-0">Third Party Access</h1>
        </div>
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading access grants...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Lock className="text-navy-400" size={24} />
        <h1 className="page-title mb-0">Third Party Access</h1>
      </div>

      <p className="page-subtitle mb-6">
        Time-bound, purpose-bound, and tenant-bound access grants
      </p>

      {/* Privacy notice */}
      <div className="card mb-6 bg-yellow-900/10 border border-yellow-700/30">
        <div className="flex items-start gap-3">
          <ShieldOff size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-yellow-300">
              <strong>Access Restrictions:</strong> Third party accounts have limited, time-bound access only.
              Individual learner data, canvas content, academic records, and safeguarding information
              are not accessible through this role.
            </p>
            <p className="text-xs text-yellow-400/60 mt-2">
              Per UU PDP and consent model: access requires explicit approval and a valid data processing agreement.
            </p>
          </div>
        </div>
      </div>

      {/* Active Grants */}
      {grants.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <FileText size={14} className="text-cyan-400" />
            Your Access Grants
            <span className="badge text-[10px] bg-navy-800 text-navy-400">{grants.length}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grants.map((grant) => (
              <GrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-12">
            <Lock className="mx-auto text-navy-600 mb-4" size={48} />
            <h2 className="text-lg font-semibold text-white mb-2">No Active Grants</h2>
            <p className="text-navy-400 max-w-md mx-auto">
              Your account does not currently have any active access grants.
              Contact the administrator who assigned your role to request access.
            </p>
            <div className="mt-6 p-4 bg-navy-800/30 rounded-lg border border-navy-700 max-w-md mx-auto">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-medium text-yellow-400 mb-1">Available integrations:</p>
                  <ul className="text-[10px] text-navy-400 space-y-1">
                    <li>• Payment processor integration</li>
                    <li>• Messaging infrastructure</li>
                    <li>• Statistical analytics (aggregate only)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
