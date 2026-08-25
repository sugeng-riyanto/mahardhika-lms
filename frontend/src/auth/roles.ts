import type { UserRole } from '@/types'

// Route access per role
export const ROLE_ROUTES: Record<string, UserRole[]> = {
  '/dashboard/owner': ['owner'],
  '/dashboard/admin': ['admin'],
  '/dashboard/treasurer': ['treasurer'],
  '/dashboard/instructor': ['instructor'],
  '/dashboard/student': ['student'],
  '/dashboard/parent': ['parent'],
  '/dashboard/sponsor': ['sponsorship'],
  '/dashboard/third-party': ['third_party'],
}

// Default dashboard per role
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  owner: '/dashboard/owner',
  admin: '/dashboard/admin',
  treasurer: '/dashboard/treasurer',
  instructor: '/dashboard/instructor',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
  sponsorship: '/dashboard/sponsor',
  third_party: '/dashboard/third-party',
}

// Primary dashboard if user has multiple roles
export const ROLE_PRIORITY: UserRole[] = [
  'owner',
  'admin',
  'treasurer',
  'instructor',
  'student',
  'parent',
  'sponsorship',
  'third_party',
]

// Role display names
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  treasurer: 'Treasurer',
  instructor: 'Instructor',
  student: 'Student',
  parent: 'Parent/Guardian',
  sponsorship: 'Sponsor',
  third_party: 'Third Party',
}

// Role colors for UI
export const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-purple-900/50 text-purple-300 border-purple-700',
  admin: 'bg-purple-900/50 text-purple-300 border-purple-700',
  treasurer: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  instructor: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
  student: 'bg-green-900/50 text-green-300 border-green-700',
  parent: 'bg-orange-900/50 text-orange-300 border-orange-700',
  sponsorship: 'bg-blue-900/50 text-blue-300 border-blue-700',
  third_party: 'bg-navy-700/50 text-navy-300 border-navy-600',
}

export function hasRole(userRoles: UserRole[], required: UserRole[]): boolean {
  return required.some((r) => userRoles.includes(r))
}

export function hasAnyRole(userRoles: UserRole[], roles: UserRole[]): boolean {
  return roles.some((r) => userRoles.includes(r))
}

export function getDefaultDashboard(userRoles: UserRole[]): string {
  for (const role of ROLE_PRIORITY) {
    if (userRoles.includes(role)) {
      return ROLE_DASHBOARD[role]
    }
  }
  return '/dashboard/student'
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_DISPLAY_NAMES[role] || role
}

export function getRoleBadgeClass(role: UserRole): string {
  return ROLE_COLORS[role] || 'bg-navy-700 text-navy-300 border-navy-600'
}
