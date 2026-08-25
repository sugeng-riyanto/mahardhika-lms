import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../AuthProvider'

// Mock Supabase
vi.mock('@/api/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  isSupabaseConfigured: false,
}))

function TestComponent() {
  const { user, roles, isLoading, isAuthenticated } = useAuth()
  return (
    <div>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
      <span data-testid="user">{user?.email || 'none'}</span>
      <span data-testid="roles">{roles.join(',')}</span>
    </div>
  )
}

function renderWithAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides unauthenticated state by default (mock mode)', async () => {
    renderWithAuth()
    // Wait for loading to finish
    await vi.waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('provides mock user state when localStorage is set', async () => {
    localStorage.setItem('akademi_mock_user', 'owner@mahardhika.id')
    localStorage.setItem('akademi_access_token', 'mock-token-owner@mahardhika.id')
    renderWithAuth()
    await vi.waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('owner@mahardhika.id')
    expect(screen.getByTestId('roles').textContent).toBe('owner')
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(
        <MemoryRouter>
          <TestComponent />
        </MemoryRouter>
      )
    }).toThrow('useAuth must be used within an AuthProvider')
    consoleError.mockRestore()
  })
})
