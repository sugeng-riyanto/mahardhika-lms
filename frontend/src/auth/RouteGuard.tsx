import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { UserRole } from '@/types'
import { getDefaultDashboard } from './roles'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

interface RoleRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const { roles, isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const hasAccess = allowedRoles.some((role) => roles.includes(role))

  if (!hasAccess) {
    const redirectPath = getDefaultDashboard(roles)
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, roles, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    const redirectPath = getDefaultDashboard(roles)
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950" role="status" aria-live="polite">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" aria-hidden="true" />
        <p className="text-navy-300 text-sm">Loading AKADEMI...</p>
      </div>
    </div>
  )
}
