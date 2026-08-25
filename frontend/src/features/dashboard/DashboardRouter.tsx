import { useAuth } from '@/auth/AuthProvider'
import { getDefaultDashboard } from '@/auth/roles'
import { Navigate } from 'react-router-dom'
import { LoadingScreen } from '@/components/LoadingScreen'

export function DashboardRouter() {
  const { roles, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const defaultPath = getDefaultDashboard(roles)
  return <Navigate to={defaultPath} replace />
}
