import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, CheckCheck, X, ArrowRight } from 'lucide-react'
import {
  useNotifications, useUnreadNotificationCount,
  useMarkNotificationRead, useMarkAllNotificationsRead,
} from '@/api/hooks'
import type { Notification } from '@/api/hooks'

function timeAgo(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function NotificationItem({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead()
  const isUnread = !notification.is_read

  const handleClick = () => {
    if (isUnread) {
      markRead.mutate(notification.id)
    }
  }

  return (
    <div
      className={`px-4 py-3 border-b border-navy-700 last:border-0 cursor-pointer transition-colors ${
        isUnread ? 'bg-cyan-900/10 hover:bg-cyan-900/20' : 'hover:bg-navy-800/50'
      }`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      role="button"
      tabIndex={0}
      aria-label={`${isUnread ? 'Unread: ' : ''}${notification.title}. ${notification.message}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isUnread ? 'bg-cyan-400' : 'bg-transparent'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isUnread ? 'text-white font-medium' : 'text-navy-300'}`}>
            {notification.title}
          </p>
          <p className="text-xs text-navy-400 mt-0.5 line-clamp-2">{notification.message}</p>
          <p className="text-xs text-navy-500 mt-1">{timeAgo(notification.created_at)}</p>
        </div>
        {isUnread && (
          <button
            onClick={(e) => { e.stopPropagation(); markRead.mutate(notification.id) }}
            className="text-navy-400 hover:text-cyan-400 shrink-0 mt-0.5"
            title="Mark as read"
          >
            <Check size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { data: unreadCount = 0 } = useUnreadNotificationCount()
  const { data: notifications = [] } = useNotifications(isOpen ? {} : undefined)
  const markAllRead = useMarkAllNotificationsRead()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const displayNotifications = notifications.slice(0, 20)

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative p-2 rounded-lg hover:bg-navy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-navy-900"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <Bell size={20} className="text-navy-300" aria-hidden="true" />
            {/* Real-time pulse dot when there are unread items */}
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-2.5 w-2.5" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
            {unreadCount > 0 && (
              <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border-2 border-navy-900" aria-hidden="true">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-navy-900 border border-navy-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700">
            <h3 className="text-white font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-navy-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                aria-label="Close notifications"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="mx-auto text-navy-600 mb-2" size={32} />
                <p className="text-navy-400 text-sm">No notifications yet</p>
              </div>
            ) : (
              displayNotifications.map((n: Notification) => (
                <NotificationItem key={n.id} notification={n} />
              ))
            )}
          </div>

          {/* Footer */}
          {displayNotifications.length > 0 && (
            <div className="px-4 py-2 border-t border-navy-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-navy-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </span>
                <Link
                  to="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  View all <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
