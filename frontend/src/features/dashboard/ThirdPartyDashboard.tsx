import { Lock, ShieldOff } from 'lucide-react'

export function ThirdPartyDashboard() {
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Lock className="text-navy-400" size={24} />
        <h1 className="page-title mb-0">Third Party Access</h1>
      </div>

      <div className="card">
        <div className="text-center py-8">
          <ShieldOff className="mx-auto text-navy-600 mb-4" size={48} />
          <h2 className="text-lg font-semibold text-white mb-2">Limited Access</h2>
          <p className="text-navy-400 max-w-md mx-auto">
            Third party accounts have time-bound, purpose-bound, and tenant-bound access only.
            Your current grant does not provide access to this area. If you need access,
            please contact the administrator who assigned your role.
          </p>
        </div>
      </div>
    </div>
  )
}
