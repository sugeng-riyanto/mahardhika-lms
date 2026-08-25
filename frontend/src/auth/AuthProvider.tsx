import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/api/supabase'
import type { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  roles: UserRole[]
  organisation_id: string | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

// Mock user data for development without Supabase
const MOCK_USERS: Record<string, { user: User; roles: UserRole[] }> = {
  'owner@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'owner@mahardhika.id',
      full_name: 'Owner Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: true,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['owner'],
  },
  'admin@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'admin@mahardhika.id',
      full_name: 'Admin Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['admin'],
  },
  'treasurer@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'treasurer@mahardhika.id',
      full_name: 'Treasurer Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['treasurer'],
  },
  'instructor@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'instructor@mahardhika.id',
      full_name: 'Instructor Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['instructor'],
  },
  'student@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000005',
      email: 'student@mahardhika.id',
      full_name: 'Student Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['student'],
  },
  'parent@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000006',
      email: 'parent@mahardhika.id',
      full_name: 'Parent Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['parent'],
  },
  'sponsor@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000007',
      email: 'sponsor@mahardhika.id',
      full_name: 'Sponsor Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['sponsorship'],
  },
  'thirdparty@mahardhika.id': {
    user: {
      id: '00000000-0000-0000-0000-000000000008',
      email: 'thirdparty@mahardhika.id',
      full_name: 'Third Party Mahardhika',
      avatar_url: null,
      is_active: true,
      mfa_enabled: false,
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    },
    roles: ['third_party'],
  },
}

const MOCK_ORG_ID = '00000000-0000-0000-0000-000000000099'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [organisationId, setOrganisationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSession = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const supabaseUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email || '',
            avatar_url: session.user.user_metadata?.avatar_url || null,
            is_active: true,
            mfa_enabled: false,
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          }
          setUser(supabaseUser)

          // Store token in localStorage for apiClient
          localStorage.setItem('akademi_access_token', session.access_token)

          // Fetch roles from Django backend
          try {
            const token = session.access_token
            const response = await fetch('/api/v1/auth/me/', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (response.ok) {
              const data = await response.json()
              setRoles(data.roles || [])
              setOrganisationId(data.organisation_id || null)
            }
          } catch {
            // Backend not available, use empty roles
            setRoles([])
          }
        } else {
          // Supabase configured but no session — fall back to mock if available
          const storedEmail = localStorage.getItem('akademi_mock_user')
          if (storedEmail && MOCK_USERS[storedEmail]) {
            const mock = MOCK_USERS[storedEmail]
            setUser(mock.user)
            setRoles(mock.roles)
            setOrganisationId(MOCK_ORG_ID)
            localStorage.setItem('akademi_access_token', `mock-token-${storedEmail}`)
          }
        }
      } else {
        // Mock mode: check localStorage
        const storedEmail = localStorage.getItem('akademi_mock_user')
        if (storedEmail && MOCK_USERS[storedEmail]) {
          const mock = MOCK_USERS[storedEmail]
          setUser(mock.user)
          setRoles(mock.roles)
          setOrganisationId(MOCK_ORG_ID)
          localStorage.setItem('akademi_access_token', `mock-token-${storedEmail}`)
        }
      }
    } catch {
      console.error('Failed to load session')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession()

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            await loadSession()
          } else {
            setUser(null)
            setRoles([])
            setOrganisationId(null)
            localStorage.removeItem('akademi_access_token')
          }
        }
      )
      return () => subscription.unsubscribe()
    }
  }, [loadSession])

  const signIn = async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      await loadSession()
    } else {
      // Mock authentication
      const mockUser = MOCK_USERS[email]
      if (!mockUser) {
        throw new Error('Invalid credentials')
      }
      if (password !== 'dev-password-2026') {
        throw new Error('Invalid credentials')
      }
      localStorage.setItem('akademi_mock_user', email)
      localStorage.setItem('akademi_access_token', `mock-token-${email}`)
      setUser(mockUser.user)
      setRoles(mockUser.roles)
      setOrganisationId(MOCK_ORG_ID)
    }
  }

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setRoles([])
    setOrganisationId(null)
    localStorage.removeItem('akademi_mock_user')
    localStorage.removeItem('akademi_access_token')
  }

  const getToken = async (): Promise<string | null> => {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    }
    return localStorage.getItem('akademi_access_token')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        organisation_id: organisationId,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
