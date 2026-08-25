/**
 * PWA registration and offline support utilities.
 *
 * - Registers the service worker
 * - Provides connection status
 * - Handles service worker updates
 */

// ─── SERVICE WORKER REGISTRATION ────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('PWA: Service workers not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('PWA: Service worker registered', registration.scope)

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          console.log('PWA: New service worker activated')
          // Dispatch event so UI can show update available
          window.dispatchEvent(new CustomEvent('sw-updated'))
        }
      })
    })

    return registration
  } catch (error) {
    console.error('PWA: Registration failed', error)
    return null
  }
}

export async function skipWaiting(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }
}

export async function clearAllCaches(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration?.active) {
    registration.active.postMessage({ type: 'CLEAR_CACHE' })
  }
}

// ─── CONNECTION STATUS ──────────────────────────────────────────

type ConnectionStatus = 'online' | 'offline' | 'slow'

let currentStatus: ConnectionStatus = navigator.onLine ? 'online' : 'offline'
const listeners: Array<(status: ConnectionStatus) => void> = []

function updateStatus(status: ConnectionStatus) {
  if (status !== currentStatus) {
    currentStatus = status
    listeners.forEach((fn) => fn(status))
  }
}

// Listen for online/offline events
window.addEventListener('online', () => updateStatus('online'))
window.addEventListener('offline', () => updateStatus('offline'))

// Detect slow connections via Network Information API
if ('connection' in navigator) {
  const conn = (navigator as unknown as { connection: { effectiveType: string; addEventListener: (e: string, fn: () => void) => void } }).connection
  if (conn) {
    const checkSlow = () => {
      if (!navigator.onLine) {
        updateStatus('offline')
      } else if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        updateStatus('slow')
      } else {
        updateStatus('online')
      }
    }
    checkSlow()
    conn.addEventListener('change', checkSlow)
  }
}

export function getConnectionStatus(): ConnectionStatus {
  return currentStatus
}

export function onConnectionChange(fn: (status: ConnectionStatus) => void): () => void {
  listeners.push(fn)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

// ─── OFFLINE DRAFT QUEUE ────────────────────────────────────────

const DRAFT_KEY = 'akademi_offline_drafts'

interface OfflineDraft {
  id: string
  type: string
  data: unknown
  timestamp: number
  synced: boolean
}

export function saveOfflineDraft(type: string, data: unknown): string {
  const drafts = getOfflineDrafts()
  const id = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  drafts.push({ id, type, data, timestamp: Date.now(), synced: false })
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
  return id
}

export function getOfflineDrafts(): OfflineDraft[] {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]')
  } catch {
    return []
  }
}

export function markDraftSynced(id: string): void {
  const drafts = getOfflineDrafts()
  const draft = drafts.find((d) => d.id === id)
  if (draft) {
    draft.synced = true
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
  }
}

export function clearSyncedDrafts(): void {
  const drafts = getOfflineDrafts().filter((d) => !d.synced)
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

export function getUnsyncedDraftCount(): number {
  return getOfflineDrafts().filter((d) => !d.synced).length
}
