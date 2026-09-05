import { useState } from 'react'
import { Bell, CheckCheck, Filter, Search, Eye, Mail, MessageSquare, Download } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/api/hooks'
import { t } from '@/i18n/translations'
import { exportToCSV, formatDate, type CSVColumn } from '@/utils/csvExport'

const NOTIF_CSV_COLUMNS: CSVColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'message', label: 'Message' },
  { key: 'channel', label: 'Channel' },
  { key: 'is_read', label: 'Read', format: (v) => v ? 'Yes' : 'No' },
  { key: 'created_at', label: 'Date', format: formatDate },
]

const channelIcons: Record<string, React.ReactNode> = {
  in_app: <Bell size={14} className="text-cyan-400" />,
  email: <Mail size={14} className="text-green-400" />,
  whatsapp: <MessageSquare size={14} className="text-green-500" />,
}

const channelLabels: Record<string, string> = {
  in_app: 'In-App',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

export function NotificationsPage() {
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const params: Record<string, string> = {}
  if (channelFilter !== 'all') params.channel = channelFilter
  if (readFilter === 'unread') params.is_read = 'false'
  if (readFilter === 'read') params.is_read = 'true'

  const { data: notifications = [], isLoading } = useNotifications(params)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const filtered = notifications.filter(n => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    }
    return true
  })

  const unreadCount = filtered.filter(n => !n.is_read).length

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="text-cyan-400" size={24} />
          <h1 className="page-title mb-0">{t('notif.title')}</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
              {unreadCount} {t('notif.unread')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(filtered, NOTIF_CSV_COLUMNS, 'notifications')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            Export
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <CheckCheck size={16} />
              {t('notif.markAllRead')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('notif.search.placeholder')}
              className="input-field w-full pl-10"
              aria-label="Search notifications"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="input-field pl-9 pr-4"
                aria-label="Filter by channel"
              >
                <option value="all">{t('notif.allChannels')}</option>
                <option value="in_app">In-App</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as 'all' | 'unread' | 'read')}
              className="input-field"
              aria-label="Filter by read status"
            >
              <option value="all">{t('notif.all')}</option>
              <option value="unread">{t('notif.unreadFilter')}</option>
              <option value="read">{t('notif.read')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-navy-400 mt-3">{t('notif.loading')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="mx-auto text-navy-600 mb-4" size={48} />
          <h2 className="text-lg font-semibold text-white mb-2">{t('notif.noNotifications')}</h2>
          <p className="text-navy-400 text-sm">
            {searchQuery ? t('notif.noNotifications.search') : t('notif.noNotifications.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => (
            <div
              key={notification.id}
              className={`card transition-all hover:border-navy-600 ${
                !notification.is_read ? 'border-l-4 border-l-cyan-500 bg-navy-800/50' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {channelIcons[notification.channel] || <Bell size={14} className="text-navy-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-medium ${!notification.is_read ? 'text-white' : 'text-navy-300'}`}>
                      {notification.title}
                    </h3>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-cyan-400 rounded-full shrink-0" aria-label="Unread" />
                    )}
                    <span className="text-xs text-navy-500 shrink-0">
                      {channelLabels[notification.channel] || notification.channel}
                    </span>
                  </div>
                  <p className="text-navy-400 text-sm line-clamp-2">{notification.message}</p>
                  <p className="text-navy-500 text-xs mt-2">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!notification.is_read && (
                    <button
                      onClick={() => markRead.mutate(notification.id)}
                      disabled={markRead.isPending}
                      className="p-2 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white transition-colors"
                      aria-label="Mark as read"
                      title={t('notif.markRead')}
                    >
                      <Eye size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
