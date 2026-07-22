import { useState, useEffect, useRef } from 'react'
import type { StreamEvent } from './types'
import { STREAM_URL } from './api'
import { CustomEmptyState, LightningBoltIcon, FALLBACK_BADGE } from './ui'

// ---------------------------------------------------------------------------
// LiveFeedTab
// ---------------------------------------------------------------------------
type FeedStatus = 'no-url' | 'connecting' | 'connected' | 'error'

export function LiveFeedTab() {
  const [events, setEvents] = useState<StreamEvent[]>([])
  // Initialize status based on STREAM_URL directly
  const [status, setStatus] = useState<FeedStatus>(() => STREAM_URL ? 'connecting' : 'no-url')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // If STREAM_URL is not configured, the initial state 'no-url' is already set.
    // We should not proceed to create EventSource if URL is missing.
    if (!STREAM_URL) {
      return // Exit early, status is already 'no-url'
    }

    // The status is already 'connecting' from the initial useState call if STREAM_URL is present.
    // No need to setStatus('connecting') again.

    const es = new EventSource(`${STREAM_URL}/events/stream`)
    esRef.current = es

    es.onopen = () => setStatus('connected')
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent
        setEvents(prev => [event, ...prev].slice(0, 50))
      } catch { /* ignore malformed */ }
    }
    es.onerror = () => setStatus('error')

    return () => { es.close(); esRef.current = null }
  }, []) // Empty dependency array as STREAM_URL is a constant.

  const SOURCE_COLORS: Record<string, string> = {
    'accounts-service':     'bg-blue-500/15 text-info-text ring-blue-500/30',
    'contacts-service':     'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    'opportunities-service':'bg-green-500/15 text-success-text ring-green-500/30',
    'activities-service':   'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  }

  return (
    <div>
      {/* Status bar */}
      <div className="mb-4 flex items-center gap-2">
        {status === 'connected' && <><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs text-success-text">Connected</span></>}
        {status === 'connecting' && <><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /><span className="text-xs text-amber-400">Connecting…</span></>}
        {status === 'error'  && <><span className="h-2 w-2 rounded-full bg-red-400" /><span className="text-xs text-danger-text">Connection error</span></>}
        {status === 'no-url' && <><span className="h-2 w-2 rounded-full bg-zinc-600" /><span className="text-xs text-text-subtle">VITE_EVENT_STREAM_URL not configured</span></>}
        {events.length > 0 && <span className="ml-auto text-xs text-text-subtle">{events.length} event{events.length !== 1 ? 's' : ''}</span>}
      </div>

      {status === 'no-url' && (
        <CustomEmptyState
          icon={<LightningBoltIcon />}
          title="Event stream URL not configured"
          description="Set VITE_EVENT_STREAM_URL to enable the live feed."
        />
      )}

      {(status === 'connecting' || status === 'connected') && events.length === 0 && (
        <CustomEmptyState
          icon={<LightningBoltIcon />}
          title="Waiting for events…"
          description="New events will appear here as services record activity."
        />
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-zinc-700/30 bg-zinc-800/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${SOURCE_COLORS[ev.source] ?? FALLBACK_BADGE}`}>
                  {ev.source}
                </span>
                <span className="text-xs font-medium text-zinc-200">{ev.type}</span>
                <span className="ml-auto font-mono text-[11px] text-text-subtle">{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
              {Boolean(ev.payload) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-text-subtle hover:text-text-secondary">payload</summary>
                  <pre className="code-surface mt-1 overflow-x-auto rounded-lg bg-zinc-900/60 p-2 text-[11px] text-text-secondary">{JSON.stringify(ev.payload, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
