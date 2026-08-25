import { Link } from 'react-router-dom'
import { ShieldOff, Home } from 'lucide-react'

export function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="text-center">
        <ShieldOff className="mx-auto text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-navy-400 mb-6">
          You don&apos;t have permission to access this page. If you believe this is an error, please contact your administrator.
        </p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <Home size={16} />
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
