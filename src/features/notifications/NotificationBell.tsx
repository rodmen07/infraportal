import { useEffect, useRef, useState } from 'react'
import { useNotifications } from './NotificationContext'

const SOURCE_COLORS: Record<string, string> = {
  accounts: 'bg-blue-500/20 text-blue-300',
  contacts: 'bg-green-500/20 text-green-300',
  opportunities: 'bg-amber-500/20 text-amber-300',
  activities: 'bg-purple-500/20 text-purple-300',
  automation: 'bg-orange-500/20 text-orange-300',
  integrations: 'bg-cyan-500/20 text-cyan-300',
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [now, setNow] = useState(() => Date.now())

  // Update relative timestamps every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(interval)
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (!open) markAllRead()
    setOpen((prev) => !prev)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `${unreadCount} new notifications` : 'Notifications'}
        className="relative rounded-lg border border-zinc-600/40 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-zinc-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-zinc-700/60 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-700/50 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-300">Live Events</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => notifications.forEach((n) => dismiss(n.id))}
                className="text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto [scrollbar-width:thin]">
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">No events yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2 border-b border-zinc-800/60 px-3 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[n.type.split('.')[0]] ?? 'bg-zinc-700/60 text-zinc-300'}`}>
                        {n.type}
                      </span>
                      <span className="text-[10px] text-zinc-500">{formatAge(now - n.receivedAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                      {Object.entries(n.payload)
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(n.id)}
                    aria-label="Dismiss notification"
                    className="mt-0.5 shrink-0 text-zinc-600 hover:text-zinc-400"
                  >
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                      <path d="M6.707 6l2.647-2.646a.5.5 0 0 0-.708-.708L6 5.293 3.354 2.646a.5.5 0 1 0-.708.708L5.293 6 2.646 8.646a.5.5 0 1 0 .708.708L6 6.707l2.646 2.647a.5.5 0 0 0 .708-.708L6.707 6z" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
