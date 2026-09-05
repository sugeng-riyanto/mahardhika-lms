import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'
import {
  getRoleLabel,
  getRoleBadgeClass,
} from '@/auth/roles'
import type { UserRole } from '@/types'
import { apiClient } from '@/api/client'
import {
  BookOpen,
  Users,
  GraduationCap,
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Calendar,
  FileText,
  BarChart3,
  Shield,
  CreditCard,
  MessageSquare,
  ChevronDown,
  Award,
  Sun,
  Moon,
} from 'lucide-react'
import { NotificationPanel } from '@/components/NotificationPanel'
import { ConnectionStatus } from '@/components/ConnectionStatus'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['owner', 'admin', 'treasurer', 'instructor', 'student', 'parent', 'sponsorship', 'third_party'] },
  { label: 'Courses', path: '/courses', icon: <BookOpen size={20} />, roles: ['admin', 'instructor', 'student'] },
  { label: 'Users', path: '/users', icon: <Users size={20} />, roles: ['owner', 'admin'] },
  { label: 'Programmes', path: '/programmes', icon: <GraduationCap size={20} />, roles: ['owner', 'admin'] },
  { label: 'Assignments', path: '/assignments', icon: <ClipboardList size={20} />, roles: ['instructor', 'student'] },
  { label: 'Gradebook', path: '/gradebook', icon: <BarChart3 size={20} />, roles: ['instructor', 'student', 'parent'] },
  { label: 'Calendar', path: '/calendar', icon: <Calendar size={20} />, roles: ['instructor', 'student', 'parent'] },
  { label: 'Attendance', path: '/attendance', icon: <Users size={20} />, roles: ['owner', 'admin', 'instructor', 'student', 'parent'] },
  { label: 'Content Library', path: '/content', icon: <FileText size={20} />, roles: ['admin', 'instructor'] },
  { label: 'Finance', path: '/finance', icon: <CreditCard size={20} />, roles: ['owner', 'treasurer'] },
  { label: 'Reports', path: '/reports', icon: <BarChart3 size={20} />, roles: ['owner', 'admin', 'sponsorship'] },
  { label: 'Notifications', path: '/notifications', icon: <MessageSquare size={20} />, roles: ['owner', 'admin', 'instructor', 'student', 'parent'] },
  { label: 'Certificates', path: '/certificates', icon: <Award size={20} />, roles: ['student', 'parent', 'instructor', 'admin', 'owner'] },
  { label: 'Audit Log', path: '/audit', icon: <Shield size={20} />, roles: ['owner', 'admin'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={20} />, roles: ['owner', 'admin'] },
  { label: 'Privacy Notice', path: '/privacy', icon: <Shield size={20} />, roles: ['owner', 'admin', 'treasurer', 'instructor', 'student', 'parent', 'sponsorship', 'third_party'] },
  { label: 'Consent', path: '/consent', icon: <Shield size={20} />, roles: ['owner', 'admin', 'parent', 'student'] },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, roles, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Close profile dropdown on Escape key (WCAG 2.1.1)
  useEffect(() => {
    if (!profileOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [profileOpen])

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.roles.some((role) => roles.includes(role))
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getBreadcrumbs = () => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)
    return parts.map((part, index) => ({
      label: part.charAt(0).toUpperCase() + part.slice(1),
      path: '/' + parts.slice(0, index + 1).join('/'),
      isLast: index === parts.length - 1,
    }))
  }

  const [breadcrumbLabels, setBreadcrumbLabels] = useState<Record<string, string>>({})
  const breadcrumbs = getBreadcrumbs()

  // Resolve UUIDs in breadcrumbs to human-readable names
  useEffect(() => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const unresolved = breadcrumbs.filter(b => uuidPattern.test(b.label) && !breadcrumbLabels[b.label])
    if (unresolved.length === 0) return

    let cancelled = false
    const resolve = async () => {
      const updates: Record<string, string> = {}
      for (const crumb of unresolved) {
        const prevSegment = breadcrumbs[breadcrumbs.indexOf(crumb) - 1]?.label.toLowerCase()
        try {
          if (prevSegment === 'courses') {
            const res = await apiClient.get<Record<string, unknown>>(`/courses/${crumb.label}/`)
            if (!cancelled) updates[crumb.label] = (res.title as string) || crumb.label
          } else if (prevSegment === 'lessons') {
            const res = await apiClient.get<Record<string, unknown>>(`/lessons/${crumb.label}/`)
            if (!cancelled) updates[crumb.label] = (res.title as string) || crumb.label
          } else if (prevSegment === 'users') {
            const res = await apiClient.get<Record<string, unknown>>(`/users/${crumb.label}/`)
            if (!cancelled) updates[crumb.label] = (res.full_name as string) || (res.email as string) || crumb.label
          }
        } catch {
          // Keep UUID as label on failure
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setBreadcrumbLabels(prev => ({ ...prev, ...updates }))
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [breadcrumbs, breadcrumbLabels])

  // Apply resolved labels
  const resolvedBreadcrumbs = breadcrumbs.map(b => ({
    ...b,
    label: breadcrumbLabels[b.label] || b.label,
  }))

  return (
    <div className="min-h-screen flex bg-navy-950 dark:bg-navy-950 light:bg-gray-50">
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-cyan-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
      >
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 dark:bg-navy-900 light:bg-white border-r border-navy-700 light:border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-navy-700">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-white text-lg">AKADEMI</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-navy-400 light:text-gray-500 hover:text-white light:hover:text-gray-900"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-1" aria-label="Main navigation">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-900/30 text-cyan-400 light:bg-cyan-50 light:text-cyan-700'
                    : 'text-navy-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-navy-800 light:hover:bg-gray-100'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 bg-navy-900/80 dark:bg-navy-900/80 light:bg-white/80 backdrop-blur-sm border-b border-navy-700 light:border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-navy-400 light:text-gray-500 hover:text-white light:hover:text-gray-900"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="hidden sm:block">
              <ol className="flex items-center gap-2 text-sm">
                {resolvedBreadcrumbs.map((crumb) => (
                  <li key={crumb.path} className="flex items-center gap-2">
                    {crumb !== resolvedBreadcrumbs[0] && (
                      <span className="text-navy-600">/</span>
                    )}
                    {crumb.isLast ? (
                      <span className="text-navy-300 light:text-gray-500">{crumb.label}</span>
                    ) : (
                      <Link
                        to={crumb.path}
                        className="text-navy-400 light:text-gray-500 hover:text-white light:hover:text-gray-900"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-navy-400 light:text-gray-500 hover:text-white light:hover:text-gray-900 hover:bg-navy-800 light:hover:bg-gray-100 transition-colors"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Connection status */}
            <ConnectionStatus />

            {/* Notifications */}
            <NotificationPanel />

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 text-navy-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 p-1 rounded-lg hover:bg-navy-800 light:hover:bg-gray-100"
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-purple-700 rounded-full flex items-center justify-center text-sm font-medium">
                  {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <ChevronDown size={16} />
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-navy-800 light:bg-white border border-navy-700 light:border-gray-200 rounded-xl shadow-xl z-50 py-2">
                    <div className="px-4 py-3 border-b border-navy-700 light:border-gray-200">
                      <p className="text-sm font-medium text-white">{user?.full_name}</p>
                      <p className="text-xs text-navy-400">{user?.email}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {roles.map((role) => (
                          <span
                            key={role}
                            className={`badge text-[10px] ${getRoleBadgeClass(role)}`}
                          >
                            {getRoleLabel(role)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-2 text-sm text-navy-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-navy-700 light:hover:bg-gray-100"
                      >
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-2 text-sm text-navy-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-navy-700 light:hover:bg-gray-100"
                      >
                        Settings
                      </Link>
                    </div>
                    <div className="border-t border-navy-700 light:border-gray-200 pt-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 light:text-red-600 hover:text-red-300 light:hover:text-red-700 hover:bg-navy-700 light:hover:bg-gray-100"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 p-4 lg:p-6" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
