import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../layout/usePrefersReducedMotion'
import {
  parseEvent,
  pushBounded,
  formatEventLabel,
  relativeTime,
  connectionLabel,
  type StreamEvent,
  type ConnectionState,
} from './eventModel'

// Live activity feed over the event-stream-service SSE hub. The pure model
// (eventModel.ts) owns parsing/buffering/formatting; this component owns the
// EventSource lifecycle and rendering. Placed on the public status page because
// it is a platform-liveness signal, not client-private data.
//
// Honesty note: the hub emits events only when a platform service publishes one
// (CRM mutations, etc.). With no live production traffic the stream is usually
// quiet, so the feed leads with its CONNECTION state (a connected SSE stream is
// itself the live signal) and shows a calm empty state rather than pretending
// there is activity. Events render the moment any flow.

const STREAM_URL = (import.meta.env.VITE_EVENT_STREAM_URL ?? 'https://event-stream-service.fly.dev').replace(/\/$/, '')
const MAX_EVENTS = 20

const DOT: Record<ConnectionState, string> = {
  connecting: 'bg-text-subtle',
  live: 'bg-success',
  reconnecting: 'bg-warning',
}

export function ActivityFeed() {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [now, setNow] = useState(() => Date.now())
  const reducedMotion = usePrefersReducedMotion()
  const sawOpen = useRef(false)

  // Subscribe to the SSE stream. EventSource reconnects on its own after a drop;
  // we surface that as the "reconnecting" state and flip back to "live" on open.
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const source = new EventSource(`${STREAM_URL}/events/stream`)

    source.onopen = () => {
      sawOpen.current = true
      setConnection('live')
    }
    source.onmessage = (msg: MessageEvent) => {
      const event = parseEvent(msg.data)
      if (event) setEvents((prev) => pushBounded(prev, event, MAX_EVENTS))
    }
    source.onerror = () => {
      // EventSource retries automatically; reflect the gap without tearing down.
      setConnection(sawOpen.current ? 'reconnecting' : 'connecting')
    }

    return () => source.close()
  }, [])

  // Keep relative times fresh without re-rendering per second: tick every 30s.
  // (No reduced-motion guard needed here: updating a timestamp is not motion.)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="forge-panel surface-card-strong flex flex-col gap-3 p-5" aria-label="Live platform activity">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT[connection]} ${
            connection === 'live' && !reducedMotion ? 'animate-pulse' : ''
          }`}
          aria-hidden
        />
        <h2 className="text-sm font-semibold text-text-primary">Live activity</h2>
        <span className="text-xs text-text-subtle">{connectionLabel(connection)} · SSE</span>
      </div>

      {events.length === 0 ? (
        <p className="max-w-prose text-sm text-text-secondary">
          {connection === 'live'
            ? 'Connected to the platform event stream. It is quiet right now; new service events will appear here in real time as they happen.'
            : 'Connecting to the platform event stream…'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft" aria-live="polite">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-text-secondary">{formatEventLabel(event)}</span>
              <span className="flex-shrink-0 text-xs text-text-subtle">{relativeTime(event.timestamp, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
