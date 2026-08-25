import { useState } from 'react'
import { User as UserIcon, Mail, Phone, Calendar, Globe, Shield, Save, CheckCircle, Camera } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'

export function ProfilePage() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState('en')

  const handleSave = async () => {
    // In a real implementation, this would call the API
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!user) return null

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserIcon className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">My Profile</h1>
      </div>
      <p className="page-subtitle mb-6">Manage your account information and preferences</p>

      {/* Avatar Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
              {user.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <button
              className="absolute bottom-0 right-0 w-8 h-8 bg-navy-800 border-2 border-navy-600 rounded-full flex items-center justify-center text-navy-400 hover:text-white hover:border-purple-500 transition-colors"
              aria-label="Change avatar"
            >
              <Camera size={14} />
            </button>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{user.full_name || 'No name set'}</h2>
            <p className="text-navy-400 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {user.mfa_enabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 text-xs rounded-full">
                  <Shield size={12} /> MFA Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/30 text-yellow-400 text-xs rounded-full">
                  <Shield size={12} /> MFA Not Enabled
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Personal Information</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-navy-300 mb-2">
              <UserIcon size={14} className="inline mr-2" />
              Full Name
            </label>
            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field w-full"
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy-300 mb-2">
              <Mail size={14} className="inline mr-2" />
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="input-field w-full opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-navy-500 mt-1">Email cannot be changed from here. Contact your administrator.</p>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-navy-300 mb-2">
              <Phone size={14} className="inline mr-2" />
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field w-full"
              placeholder="+62 xxx xxx xxx"
            />
          </div>
          <div>
            <label htmlFor="profile-language" className="block text-sm font-medium text-navy-300 mb-2">
              <Globe size={14} className="inline mr-2" />
              Preferred Language
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
          <div>
            <label htmlFor="account-created" className="block text-sm font-medium text-navy-300 mb-2">
              <Calendar size={14} className="inline mr-2" />
              Account Created
            </label>
            <input
              id="account-created"
              type="text"
              value={new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              disabled
              className="input-field w-full opacity-50 cursor-not-allowed"
            />
          </div>
        </div>
        <div className="mt-6">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Security</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-navy-700">
            <div>
              <p className="text-white text-sm font-medium">Multi-Factor Authentication</p>
              <p className="text-navy-400 text-xs">
                {user.mfa_enabled ? 'MFA is currently enabled for your account.' : 'Add an extra layer of security to your account.'}
              </p>
            </div>
            <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              user.mfa_enabled
                ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}>
              {user.mfa_enabled ? 'Manage MFA' : 'Enable MFA'}
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white text-sm font-medium">Change Password</p>
              <p className="text-navy-400 text-xs">Update your password regularly to keep your account secure.</p>
            </div>
            <button className="px-4 py-2 rounded-lg text-sm font-medium bg-navy-700 text-navy-200 hover:bg-navy-600 transition-colors">
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border border-red-700/30">
        <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Delete Account</p>
            <p className="text-navy-400 text-xs">Permanently delete your account and all associated data. This action cannot be undone.</p>
          </div>
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-red-900/30 text-red-400 border border-red-700/30 hover:bg-red-900/50 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}
