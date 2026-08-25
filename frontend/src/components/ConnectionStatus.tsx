import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Clock } from 'lucide-react'
import { getConnectionStatus, onConnectionChange, getUnsyncedDraftCount } from '@/lib/pwa'

type Status = 'online' | 'offline' | 'slow'

const STATUS_CONFIG: Record<Status, { icon: typeof Wifi; label: string; bg: string; text: string }> = {
  online: { icon: Wifi, label: 'Connected', bg: 'bg-green-900/50', text: 'text-green-400' },
  offline: { icon: WifiOff, label: 'Offline', bg: 'bg-red-900/50', text: 'text-red-400' },
  slow: { icon: Clock, label: 'Slow connection', bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>(getConnectionStatus())
  const [unsyncedCount, setUnsyncedCount] = useState(getUnsyncedDraftCount())
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const unsubscribe = onConnectionChange((newStatus) => {
      setStatus(newStatus)
      if (newStatus !== 'online') {
        setShowBanner(true)
      }
    })
    return unsubscribe
  }, [])

  // Auto-hide banner after reconnection
  useEffect(() => {
    if (status === 'online' && showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [status, showBanner])

  // Refresh unsynced count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setUnsyncedCount(getUnsyncedDraftCount())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  // Don't show anything when online and no unsynced drafts
  if (status === 'online' && unsyncedCount === 0 && !showBanner) {
    return null
  }

  return (
    <>
      {/* Floating banner for offline/slow */}
      {showBanner && status !== 'online' && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className={`${config.bg} border-b border-navy-700 px-4 py-2 flex items-center justify-center gap-2`}>
            <Icon size={14} className={config.text} />
            <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
            {unsyncedCount > 0 && (
              <span className="text-[10px] text-navy-400 ml-2">
                {unsyncedCount} draft{unsyncedCount !== 1 ? 's' : ''} pending sync
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status indicator in header */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg}`} role="status" aria-live="polite" aria-label={`Connection status: ${config.label}`}>
        <Icon size={12} className={config.text} aria-hidden="true" />
        <span className={`text-[10px] font-medium ${config.text}`}>
          {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Slow'}
        </span>
        {unsyncedCount > 0 && (
          <span className="text-[10px] bg-navy-800 text-navy-400 px-1.5 py-0.5 rounded-full">
            {unsyncedCount}
          </span>
        )}
      </div>
    </>
  )
}
