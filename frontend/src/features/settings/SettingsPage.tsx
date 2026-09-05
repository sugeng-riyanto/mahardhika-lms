import { useState, useEffect, useRef } from 'react'
import { Settings as SettingsIcon, Globe, Shield, Bell, Database, Save, CheckCircle, Upload, Image } from 'lucide-react'
import { t, setLocale, getLocale } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')
  const [saved, setSaved] = useState(false)
  const [lang, setLang] = useState<Locale>(getLocale())
  const [, forceRender] = useState(0)

  // Re-render when language changes
  useEffect(() => {
    const handler = () => forceRender((n) => n + 1)
    window.addEventListener('languageChanged', handler)
    return () => window.removeEventListener('languageChanged', handler)
  }, [])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const [orgLogo, setOrgLogo] = useState(() => {
    try { return localStorage.getItem('org_logo') || '' } catch { return '' }
  })
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLanguageChange = (newLang: Locale) => {
    setLang(newLang)
    setLocale(newLang)
    window.dispatchEvent(new Event('languageChanged'))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setOrgLogo(dataUrl)
      localStorage.setItem('org_logo', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleLogoRemove = () => {
    setOrgLogo('')
    localStorage.removeItem('org_logo')
  }

  const sections = [
    { id: 'general', label: t('settings.general'), icon: <Globe size={18} /> },
    { id: 'security', label: t('settings.security'), icon: <Shield size={18} /> },
    { id: 'notifications', label: t('settings.notifications'), icon: <Bell size={18} /> },
    { id: 'data', label: t('settings.data'), icon: <Database size={18} /> },
  ]

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="text-purple-400" size={24} />
        <h1 className="page-title mb-0">{t('settings.title')}</h1>
      </div>
      <p className="page-subtitle mb-6">{t('settings.subtitle')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <nav aria-label={t('settings.title')} className="lg:col-span-1">
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
              <h2 className="text-lg font-semibold text-white mb-4">{t('settings.general.title')}</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="org-name" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.orgName')}</label>
                  <input
                    id="org-name"
                    type="text"
                    defaultValue="Mahardhika Academy"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-300 mb-2">Organization Logo (QR Code Center)</label>
                  <p className="text-xs text-navy-500 mb-2">Upload a logo to display in the center of certificate QR codes.</p>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center overflow-hidden">
                      {orgLogo ? (
                        <img src={orgLogo} alt="Org logo" className="w-full h-full object-contain" />
                      ) : (
                        <Image size={24} className="text-navy-600" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => logoInputRef.current?.click()} className="btn-secondary text-xs flex items-center gap-1">
                        <Upload size={12} />
                        {orgLogo ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      {orgLogo && (
                        <button onClick={handleLogoRemove} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                      )}
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>
                <div>
                  <label htmlFor="org-slug" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.orgSlug')}</label>
                  <input
                    id="org-slug"
                    type="text"
                    defaultValue="mahardhika"
                    className="input-field w-full"
                    disabled
                  />
                  <p className="text-xs text-navy-500 mt-1">{t('settings.orgSlug.hint')}</p>
                </div>
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.language')}</label>
                  <select
                    id="language"
                    className="input-field w-full"
                    value={lang}
                    onChange={(e) => handleLanguageChange(e.target.value as Locale)}
                  >
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.timezone')}</label>
                  <select id="timezone" className="input-field w-full">
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? t('common.saved') : t('common.save')}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">{t('settings.security.title')}</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">{t('settings.mfa')}</p>
                    <p className="text-navy-400 text-xs">{t('settings.mfa.desc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" aria-label={t('settings.mfa')} />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">{t('settings.sessionTimeout')}</p>
                    <p className="text-navy-400 text-xs">{t('settings.sessionTimeout.desc')}</p>
                  </div>
                  <select id="session-timeout" className="input-field w-40" aria-label={t('settings.sessionTimeout')}>
                    <option value="30">30 minutes</option>
                    <option value="60" defaultValue="60">1 hour</option>
                    <option value="240">4 hours</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">{t('settings.thirdParty')}</p>
                    <p className="text-navy-400 text-xs">{t('settings.thirdParty.desc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" aria-label={t('settings.thirdParty')} />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? t('common.saved') : t('common.save')}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">{t('settings.notifications.title')}</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">{t('settings.emailNotifications')}</p>
                    <p className="text-navy-400 text-xs">{t('settings.emailNotifications.desc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" aria-label={t('settings.emailNotifications')} />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">{t('settings.whatsappNotifications')}</p>
                    <p className="text-navy-400 text-xs">{t('settings.whatsappNotifications.desc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" aria-label={t('settings.whatsappNotifications')} />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div>
                  <label htmlFor="quiet-hours-start" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.quietHoursStart')}</label>
                  <input id="quiet-hours-start" type="time" defaultValue="22:00" className="input-field w-40" />
                </div>
                <div>
                  <label htmlFor="quiet-hours-end" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.quietHoursEnd')}</label>
                  <input id="quiet-hours-end" type="time" defaultValue="07:00" className="input-field w-40" />
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? t('common.saved') : t('common.save')}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'data' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">{t('settings.data.title')}</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="retention-period" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.gradeRetention')}</label>
                  <select id="retention-period" className="input-field w-full">
                    <option value="365">1 year</option>
                    <option value="730">2 years</option>
                    <option value="1825" defaultValue="1825">5 years</option>
                    <option value="0">Indefinite</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="audit-retention" className="block text-sm font-medium text-navy-300 mb-2">{t('settings.auditRetention')}</label>
                  <select id="audit-retention" className="input-field w-full">
                    <option value="365">1 year</option>
                    <option value="1095" defaultValue="1095">3 years</option>
                    <option value="1825">5 years</option>
                    <option value="0">Indefinite</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-navy-700">
                  <div>
                    <p className="text-white text-sm font-medium">{t('settings.sponsorThreshold')}</p>
                    <p className="text-navy-400 text-xs">{t('settings.sponsorThreshold.desc')}</p>
                  </div>
                  <input
                    type="number"
                    defaultValue={10}
                    min={5}
                    className="input-field w-24 text-center"
                    aria-label={t('settings.sponsorThreshold')}
                  />
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium mb-1">{t('settings.uuPdp')}</p>
                  <p className="text-navy-400 text-xs">
                    {t('settings.uuPdp.desc')}{' '}
                    <a href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline">{t('settings.uuPdp.privacyNotice')}</a>{' '}
                    {t('settings.uuPdp.and')}{' '}
                    <a href="/consent" className="text-cyan-400 hover:text-cyan-300 underline">{t('settings.uuPdp.consentMgmt')}</a>{' '}
                    {t('settings.uuPdp.pagesFor')}
                  </p>
                </div>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saved ? t('common.saved') : t('common.save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
