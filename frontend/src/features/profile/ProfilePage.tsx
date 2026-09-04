import { useEffect, useState } from 'react'
import { User as UserIcon, Mail, Phone, Calendar, Globe, Shield, Save, CheckCircle, AlertCircle, Loader, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { apiClient } from '@/api/client'
import { supabase, isSupabaseConfigured } from '@/api/supabase'
import { t } from '@/i18n/translations'

interface OwnProfile {
  id: string
  user: string
  user_email: string
  organisation: string | null
  full_name: string
  phone: string
  date_of_birth: string | null
  avatar_url: string
  preferred_language: 'en' | 'id'
}

function errorText(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'detail' in err) {
    return String((err as { detail: string }).detail)
  }
  return fallback
}

export function ProfilePage() {
  const { user, signOut, refreshMe } = useAuth()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState('en')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Security card state
  const [securityBusy, setSecurityBusy] = useState<string | null>(null)
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    setFullName(user?.full_name || '')
  }, [user?.full_name])

  useEffect(() => {
    let cancelled = false
    apiClient.get<OwnProfile>('/auth/profile/').then((p) => {
      if (cancelled) return
      setProfile(p)
      setPhone(p.phone || '')
      setLanguage(p.preferred_language || 'en')
    }).catch(() => { /* profile is optional; page still usable */ })
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const updated = await apiClient.put<OwnProfile>('/auth/profile/', {
        full_name: fullName,
        phone,
        preferred_language: language,
      })
      setProfile(updated)
      await refreshMe()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(errorText(err, 'Failed to save profile changes.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleMfa = async () => {
    if (!user) return
    setSecurityBusy('mfa')
    setSecurityError(null)
    setSecurityMessage(null)
    try {
      const res = await apiClient.post<{ mfa_enabled: boolean }>('/auth/mfa/', {
        enabled: !user.mfa_enabled,
      })
      setSecurityMessage(res.mfa_enabled
        ? 'Two-factor authentication enabled.'
        : 'Two-factor authentication disabled.')
      await refreshMe()
    } catch (err) {
      setSecurityError(errorText(err, 'Failed to update MFA setting.'))
    } finally {
      setSecurityBusy(null)
    }
  }

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('New password and confirmation do not match.')
      return
    }
    setSecurityBusy('password')
    setSecurityError(null)
    setSecurityMessage(null)
    try {
      // On a hosted deployment the real credential lives in Supabase Auth.
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw { detail: error.message }
      }
      await apiClient.post('/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setShowPasswordForm(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSecurityMessage('Password updated successfully.')
    } catch (err) {
      setSecurityError(errorText(err, 'Failed to change password.'))
    } finally {
      setSecurityBusy(null)
    }
  }

  const deleteAccount = async () => {
    if (!user || deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase()) return
    setSecurityBusy('delete')
    setSecurityError(null)
    setSecurityMessage(null)
    try {
      await apiClient.post('/auth/delete-account/', { confirm: user.email })
      await signOut()
      // ProtectedRoute redirects to /login once the session is cleared.
    } catch (err) {
      setSecurityError(errorText(err, 'Failed to delete the account.'))
      setSecurityBusy(null)
    }
  }

  if (!user) return null

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserIcon className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">{t('profile.title')}</h1>
      </div>
      <p className="page-subtitle mb-6">{t('profile.subtitle')}</p>

      {/* Avatar Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
              {user.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{user.full_name || t('profile.noName')}</h2>
            <p className="text-navy-400 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {user.mfa_enabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 text-xs rounded-full">
                  <Shield size={12} /> {t('profile.mfa.enabledBadge')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/30 text-yellow-400 text-xs rounded-full">
                  <Shield size={12} /> {t('profile.mfa.notEnabled')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('profile.personalInfo')}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-navy-300 mb-2">
              <UserIcon size={14} className="inline mr-2" />
              {t('profile.fullName')}
            </label>
            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field w-full"
              placeholder={t('profile.fullName.placeholder')}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy-300 mb-2">
              <Mail size={14} className="inline mr-2" />
              {t('profile.email')}
            </label>
            <input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="input-field w-full opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-navy-500 mt-1">{t('profile.email.note')}</p>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-navy-300 mb-2">
              <Phone size={14} className="inline mr-2" />
              {t('profile.phone')}
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field w-full"
              placeholder={t('profile.phone.placeholder')}
            />
          </div>
          <div>
            <label htmlFor="profile-language" className="block text-sm font-medium text-navy-300 mb-2">
              <Globe size={14} className="inline mr-2" />
              {t('profile.language')}
            </label>
            <select
              id="profile-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-field w-full"
            >
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </div>
          {profile?.date_of_birth && (
            <div>
              <label htmlFor="date-of-birth" className="block text-sm font-medium text-navy-300 mb-2">
                <Calendar size={14} className="inline mr-2" />
                Date of Birth
              </label>
              <input
                id="date-of-birth"
                type="date"
                value={profile.date_of_birth || ''}
                disabled
                className="input-field w-full opacity-50 cursor-not-allowed"
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
          {saveError && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={14} /> {saveError}
            </span>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('profile.security')}</h3>
        {(securityMessage || securityError) && (
          <div className={`mb-4 text-xs flex items-center gap-1 ${securityError ? 'text-red-400' : 'text-green-400'}`}>
            {securityError ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
            {securityError || securityMessage}
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-navy-700">
            <div>
              <p className="text-white text-sm font-medium">{t('profile.mfa.title')}</p>
              <p className="text-navy-400 text-xs">
                {user.mfa_enabled ? t('profile.mfa.enabled') : t('profile.mfa.disabled')}
              </p>
            </div>
            <button
              onClick={toggleMfa}
              disabled={securityBusy === 'mfa'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                user.mfa_enabled
                  ? 'bg-green-900/30 text-green-400 border border-green-700/30 hover:bg-green-900/50'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {securityBusy === 'mfa' ? 'Saving…' : user.mfa_enabled ? t('profile.mfa.manage') : t('profile.mfa.enable')}
            </button>
          </div>

          <div className="py-3 border-b border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{t('profile.password.title')}</p>
                <p className="text-navy-400 text-xs">{t('profile.password.desc')}</p>
              </div>
              <button
                onClick={() => setShowPasswordForm((v) => !v)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-navy-700 text-navy-200 hover:bg-navy-600 transition-colors"
              >
                {showPasswordForm ? 'Cancel' : t('profile.password.btn')}
              </button>
            </div>
            {showPasswordForm && (
              <div className="mt-4 grid gap-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="input-field w-full"
                  autoComplete="current-password"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 8 characters)"
                  className="input-field w-full"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="input-field w-full"
                  autoComplete="new-password"
                />
                <div>
                  <button
                    onClick={changePassword}
                    disabled={securityBusy === 'password'}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {securityBusy === 'password' ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border border-red-700/30">
        <h3 className="text-lg font-semibold text-red-400 mb-4">{t('profile.dangerZone')}</h3>
        <p className="text-white text-sm font-medium mb-1">{t('profile.delete.title')}</p>
        <p className="text-navy-400 text-xs mb-4">{t('profile.delete.desc')}</p>
        <div className="pt-4 border-t border-navy-700">
          <p className="text-xs text-navy-400 mb-2">
            Type <span className="text-white font-medium">{user.email}</span> to confirm permanent deactivation.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={user.email}
              className="input-field flex-1"
              autoComplete="off"
            />
            <button
              onClick={deleteAccount}
              disabled={deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase() || securityBusy === 'delete'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-700 text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {securityBusy === 'delete' ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {securityBusy === 'delete' ? 'Deleting…' : t('profile.delete.btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
