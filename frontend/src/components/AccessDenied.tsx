import { Link } from 'react-router-dom'
import { ShieldOff, Home } from 'lucide-react'
import { t } from '@/i18n/translations'

export function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="text-center">
        <ShieldOff className="mx-auto text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-white mb-2">{t('error.403')}</h1>
        <p className="text-navy-400 mb-6">
          {t('error.403.message')}
        </p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <Home size={16} />
          {t('nav.dashboard')}
        </Link>
      </div>
    </div>
  )
}
