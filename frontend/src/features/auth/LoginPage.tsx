import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthProvider'
import { isSupabaseConfigured } from '@/api/supabase'
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setIsSubmitting(true)
    try {
      await signIn(data.email, data.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const mockAccounts = [
    { email: 'owner@mahardhika.id', role: 'Owner' },
    { email: 'admin@mahardhika.id', role: 'Admin' },
    { email: 'instructor@mahardhika.id', role: 'Instructor' },
    { email: 'student@mahardhika.id', role: 'Student' },
    { email: 'parent@mahardhika.id', role: 'Parent' },
    { email: 'treasurer@mahardhika.id', role: 'Treasurer' },
    { email: 'sponsor@mahardhika.id', role: 'Sponsor' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AKADEMI Digital Campus</h1>
          <p className="text-navy-400 mt-2">Sign in to your account</p>
        </div>

        {/* Login form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm" role="alert">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="input-field focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="text-red-400 text-sm mt-1" role="alert">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="input-field pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-red-400 text-sm mt-1" role="alert">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-sm text-navy-300">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-navy-900"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Mock mode info */}
        {!isSupabaseConfigured && (
          <div className="mt-6 card">
            <h3 className="text-sm font-medium text-navy-300 mb-3">
              🔧 Development Mode
            </h3>
            <p className="text-xs text-navy-400 mb-3">
              Supabase is not configured. Use any of these mock accounts with password: <code className="bg-navy-800 px-1 rounded">dev-password-2026</code>
            </p>
            <div className="space-y-1">
              {mockAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setValue('email', account.email, { shouldValidate: true, shouldDirty: true })
                    setValue('password', 'dev-password-2026', { shouldValidate: true, shouldDirty: true })
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-navy-300 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
                >
                  <span>{account.email}</span>
                  <span className="badge badge-purple">{account.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-navy-500 mt-6">
          © 2026 AKADEMI Digital Campus. All rights reserved.
        </p>
      </div>
    </div>
  )
}
