import { useState } from 'react'
import { Settings as SettingsIcon, Globe, Shield, Bell, Database, Save, CheckCircle } from 'lucide-react'

interface SettingSection {
  id: string
  label: string
  icon: React.ReactNode
}

const sections: SettingSection[] = [
  { id: 'general', label: 'General', icon: <Globe size={18} /> },
  { id: 'security', label: 'Security', icon: <Shield size={18} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { id: 'data', label: 'Data & Privacy', icon: <Database size={18} /> },
]

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">Settings</h1>
      </div>
      <p className="page-subtitle mb-6">System configuration and preferences</p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <nav aria-label="Settings sections" className="lg:col-span-1">
          <div className="card p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-purple-900/30 text-purple-400 font-medium'
                    : 'text-navy-300 hover:bg-navy-700/50 hover:text-white'
                }`}
                aria-current={activeSection === section.id ? 'page' : undefined}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeSection === 'general' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">General Settings</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="org-name" className="block text-sm font-medium text-navy-300 mb-2">Organisation Name</label>
                  <input
                    id="org-name"
                    type="text"
                    defaultValue="Mahardhika Academy"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label htmlFor="org-slug" className="block text-sm font-medium text-navy-300 mb-2">Organisation Slug</label>
                  <input
                    id="org-slug"
                    type="text"
                    defaultValue="mahardhika"
                    className="input-field w-full"
                    disabled
                  />
                  <p className="text-xs text-navy-500 mt-1">Slug cannot be changed after creation.</p>
                </div>
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-navy-300 mb-2">Default Language</label>
                  <select id="language" className="input-field w-full">
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-navy-300 mb-2">Timezone</label>
                  <select id="timezone" className="input-field w-full">
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Security Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">Enforce MFA for Admin Roles</p>
                    <p className="text-navy-400 text-xs">Require multi-factor authentication for owner and admin accounts.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" aria-label="Enforce MFA for admin roles" />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">Session Timeout</p>
                    <p className="text-navy-400 text-xs">Auto-logout after inactivity period.</p>
                  </div>
                  <select id="session-timeout" className="input-field w-40" aria-label="Session timeout duration">
                    <option value="30">30 minutes</option>
                    <option value="60" selected>1 hour</option>
                    <option value="240">4 hours</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">Third Party Access</p>
                    <p className="text-navy-400 text-xs">Allow third-party integration grants.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" aria-label="Allow third party access" />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Notification Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">Email Notifications</p>
                    <p className="text-navy-400 text-xs">Send email notifications for grades, assignments, and announcements.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" aria-label="Enable email notifications" />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">WhatsApp Notifications</p>
                    <p className="text-navy-400 text-xs">Send WhatsApp messages for urgent notifications.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" aria-label="Enable WhatsApp notifications" />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div>
                  <label htmlFor="quiet-hours-start" className="block text-sm font-medium text-navy-300 mb-2">Quiet Hours Start</label>
                  <input id="quiet-hours-start" type="time" defaultValue="22:00" className="input-field w-40" />
                </div>
                <div>
                  <label htmlFor="quiet-hours-end" className="block text-sm font-medium text-navy-300 mb-2">Quiet Hours End</label>
                  <input id="quiet-hours-end" type="time" defaultValue="07:00" className="input-field w-40" />
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'data' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Data & Privacy Settings</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="retention-period" className="block text-sm font-medium text-navy-300 mb-2">Grade Retention Period</label>
                  <select id="retention-period" className="input-field w-full">
                    <option value="365">1 year</option>
                    <option value="730">2 years</option>
                    <option value="1825" selected>5 years</option>
                    <option value="0">Indefinite</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="audit-retention" className="block text-sm font-medium text-navy-300 mb-2">Audit Log Retention</label>
                  <select id="audit-retention" className="input-field w-full">
                    <option value="365">1 year</option>
                    <option value="1095" selected>3 years</option>
                    <option value="1825">5 years</option>
                    <option value="0">Indefinite</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">Sponsor Data Threshold</p>
                    <p className="text-navy-400 text-xs">Minimum student count before aggregate data is shown to sponsors.</p>
                  </div>
                  <input
                    type="number"
                    defaultValue={10}
                    min={5}
                    className="input-field w-24 text-center"
                    aria-label="Minimum student count for sponsor data"
                  />
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium mb-1">UU PDP Compliance</p>
                  <p className="text-navy-400 text-xs">
                    Data minimisation, purpose limitation, and consent management are enforced at the API level.
                    Review the <a href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline">Privacy Notice</a> and <a href="/consent" className="text-cyan-400 hover:text-cyan-300 underline">Consent Management</a> pages for parent/student controls.
                  </p>
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
