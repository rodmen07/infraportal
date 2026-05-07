import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { EVENT_STREAM_URL } from '../../config'

export interface Notification {
  id: string
  type: string
  payload: Record<string, unknown>
  receivedAt: number
}

interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => void
  dismiss: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const MAX_NOTIFICATIONS = 50
const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS = 30000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [readCount, setReadCount] = useState(0)
  const reconnectDelay = useRef(RECONNECT_BASE_MS)
  const esRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)
  const connectRef = useRef<() => void>(() => {})

  const connect = useCallback(() => {
    if (!EVENT_STREAM_URL || esRef.current) return

    const url = `${EVENT_STREAM_URL}/events/stream`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const raw = JSON.parse(e.data as string) as { type?: string; payload?: Record<string, unknown> }
        const notification: Notification = {
          id: `${Date.now()}-${Math.random()}`,
          type: raw.type ?? 'event',
          payload: raw.payload ?? (raw as Record<string, unknown>),
          receivedAt: Date.now(),
        }
        setNotifications((prev) => {
          const next = [notification, ...prev]
          return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next
        })
      } catch {
        // ignore malformed messages
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      if (!mountedRef.current) return
      const delay = reconnectDelay.current
      reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS)
      setTimeout(() => {
        if (mountedRef.current) connectRef.current()
      }, delay)
    }

    es.addEventListener('open', () => {
      reconnectDelay.current = RECONNECT_BASE_MS
    })
  }, [])

  connectRef.current = connect

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])

  const markAllRead = useCallback(() => {
    setReadCount((prev) => prev + (notifications.length - prev > 0 ? notifications.length - prev : 0))
    setReadCount(notifications.length)
  }, [notifications.length])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id)
      setReadCount((rc) => Math.min(rc, next.length))
      return next
    })
  }, [])

  const unreadCount = Math.max(0, notifications.length - readCount)

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, dismiss }}>
      {children}
    </NotificationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
