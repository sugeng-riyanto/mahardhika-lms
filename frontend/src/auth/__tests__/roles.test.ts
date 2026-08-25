import { describe, it, expect } from 'vitest'
import {
  hasRole,
  hasAnyRole,
  getDefaultDashboard,
  getRoleLabel,
  getRoleBadgeClass,
  ROLE_DASHBOARD,
  ROLE_DISPLAY_NAMES,
} from '../roles'
import type { UserRole } from '@/types'

describe('hasRole', () => {
  it('returns true when user has one of the required roles', () => {
    expect(hasRole(['admin', 'instructor'], ['admin'])).toBe(true)
  })

  it('returns false when user has none of the required roles', () => {
    expect(hasRole(['student'], ['admin', 'instructor'])).toBe(false)
  })

  it('returns false for empty user roles', () => {
    expect(hasRole([], ['admin'])).toBe(false)
  })
})

describe('hasAnyRole', () => {
  it('returns true when user has at least one matching role', () => {
    expect(hasAnyRole(['student'], ['student', 'parent'])).toBe(true)
  })

  it('returns false when no roles match', () => {
    expect(hasAnyRole(['student'], ['admin', 'instructor'])).toBe(false)
  })
})

describe('getDefaultDashboard', () => {
  it('returns owner dashboard for owner role', () => {
    expect(getDefaultDashboard(['owner'])).toBe('/dashboard/owner')
  })

  it('returns admin dashboard for admin role', () => {
    expect(getDefaultDashboard(['admin'])).toBe('/dashboard/admin')
  })

  it('returns instructor dashboard for instructor role', () => {
    expect(getDefaultDashboard(['instructor'])).toBe('/dashboard/instructor')
  })

  it('returns student dashboard for student role', () => {
    expect(getDefaultDashboard(['student'])).toBe('/dashboard/student')
  })

  it('returns parent dashboard for parent role', () => {
    expect(getDefaultDashboard(['parent'])).toBe('/dashboard/parent')
  })

  it('returns treasurer dashboard for treasurer role', () => {
    expect(getDefaultDashboard(['treasurer'])).toBe('/dashboard/treasurer')
  })

  it('returns sponsor dashboard for sponsorship role', () => {
    expect(getDefaultDashboard(['sponsorship'])).toBe('/dashboard/sponsor')
  })

  it('returns third-party dashboard for third_party role', () => {
    expect(getDefaultDashboard(['third_party'])).toBe('/dashboard/third-party')
  })

  it('returns owner dashboard when user has multiple roles (owner priority)', () => {
    expect(getDefaultDashboard(['admin', 'owner'])).toBe('/dashboard/owner')
  })

  it('returns admin dashboard when user has admin and instructor', () => {
    expect(getDefaultDashboard(['instructor', 'admin'])).toBe('/dashboard/admin')
  })

  it('returns student dashboard for empty roles', () => {
    expect(getDefaultDashboard([])).toBe('/dashboard/student')
  })
})

describe('getRoleLabel', () => {
  it('returns correct display names', () => {
    expect(getRoleLabel('owner')).toBe('Owner')
    expect(getRoleLabel('admin')).toBe('Administrator')
    expect(getRoleLabel('treasurer')).toBe('Treasurer')
    expect(getRoleLabel('instructor')).toBe('Instructor')
    expect(getRoleLabel('student')).toBe('Student')
    expect(getRoleLabel('parent')).toBe('Parent/Guardian')
    expect(getRoleLabel('sponsorship')).toBe('Sponsor')
    expect(getRoleLabel('third_party')).toBe('Third Party')
  })
})

describe('getRoleBadgeClass', () => {
  it('returns a non-empty string for all roles', () => {
    const roles: UserRole[] = [
      'owner', 'admin', 'treasurer', 'instructor',
      'student', 'parent', 'sponsorship', 'third_party',
    ]
    roles.forEach((role) => {
      const badgeClass = getRoleBadgeClass(role)
      expect(typeof badgeClass).toBe('string')
      expect(badgeClass.length).toBeGreaterThan(0)
    })
  })
})

describe('ROLE_DASHBOARD mapping', () => {
  it('has entries for all 8 roles', () => {
    const roles: UserRole[] = [
      'owner', 'admin', 'treasurer', 'instructor',
      'student', 'parent', 'sponsorship', 'third_party',
    ]
    roles.forEach((role) => {
      expect(ROLE_DASHBOARD[role]).toBeDefined()
      expect(ROLE_DASHBOARD[role]).toMatch(/^\/dashboard\//)
    })
  })
})

describe('ROLE_DISPLAY_NAMES', () => {
  it('has entries for all 8 roles', () => {
    const roles: UserRole[] = [
      'owner', 'admin', 'treasurer', 'instructor',
      'student', 'parent', 'sponsorship', 'third_party',
    ]
    roles.forEach((role) => {
      expect(ROLE_DISPLAY_NAMES[role]).toBeDefined()
      expect(ROLE_DISPLAY_NAMES[role].length).toBeGreaterThan(0)
    })
  })
})
