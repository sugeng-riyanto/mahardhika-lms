import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-navy-700 mb-4" aria-hidden="true">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-navy-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <Home size={16} />
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
