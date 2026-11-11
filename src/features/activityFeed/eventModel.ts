// Pure model for the live activity feed. The feed subscribes to the
// event-stream-service SSE hub (GET {stream}/events/stream), which emits
// unnamed `data:` messages whose body is one JSON Event. All parsing,
// buffering, and display formatting live here so the behaviour is unit-testable
// without a browser EventSource; the React component is a thin wiring shell.
//
// Contract, verified against event-stream-service/main.go (2026-07-23):
//   { id, source, type, payload?, timestamp, traceparent? }
// The hub replays recent history on connect, so a fresh subscriber is not cold.

export interface StreamEvent {
  id: string
  source: string
  type: string
  timestamp?: string
  payload?: unknown
}

/**
 * Parse one SSE message body into a {@link StreamEvent}, or return `null` when
 * it is not a valid event. Defensive so a malformed frame, a keep-alive comment
 * decoded as JSON, or a future field change can never throw inside the message
 * handler and tear down the stream.
 */
export function parseEvent(raw: unknown): StreamEvent | null {
  let value: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    try {
      value = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const e = value as Record<string, unknown>
  if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.type !== 'string') {
    return null
  }
  const event: StreamEvent = { id: e.id, source: e.source, type: e.type }
  if (typeof e.timestamp === 'string') event.timestamp = e.timestamp
  if ('payload' in e) event.payload = e.payload
  return event
}

/**
 * Prepend `event` to `buffer` (newest first), drop any earlier entry with the
 * same id (the hub's replay can overlap a live event), and cap the length at
 * `max`. Returns a new array; never mutates the input.
 */
export function pushBounded(buffer: readonly StreamEvent[], event: StreamEvent, max: number): StreamEvent[] {
  const deduped = buffer.filter((e) => e.id !== event.id)
  return [event, ...deduped].slice(0, Math.max(0, max))
}

/** A readable one-line label for an event: "source · type". */
export function formatEventLabel(event: StreamEvent): string {
  return `${event.source} · ${event.type}`
}

/**
 * A compact relative-time string for an event timestamp given a reference
 * "now" (both ISO strings / epoch ms). Returns '' when the timestamp is missing
 * or unparseable, so the UI simply omits the time rather than showing "NaN".
 * `now` is injected (not read from the clock) so the function stays pure and
 * testable.
 */
export function relativeTime(timestamp: string | undefined, nowMs: number): string {
  if (!timestamp) return ''
  const then = Date.parse(timestamp)
  if (Number.isNaN(then)) return ''
  const deltaSec = Math.max(0, Math.round((nowMs - then) / 1000))
  if (deltaSec < 5) return 'just now'
  if (deltaSec < 60) return `${deltaSec}s ago`
  const min = Math.floor(deltaSec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

/** A short human label for the connection state. */
export function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connecting':
      return 'Connecting…'
    case 'live':
      return 'Live'
    case 'reconnecting':
      return 'Reconnecting…'
    case 'offline':
      return 'Offline'
  }
}

/**
 * The SSE hub base URL from build config, or '' when there is none. The Pages
 * deploy exports an unset repo variable as '', so missing and empty both mean
 * "no stream". There is deliberately no hardcoded fallback host: the old one
 * named a Fly app destroyed on 2026-11-11, and a released app name can be
 * claimed by anyone, who would then be feeding this public panel.
 */
export function resolveStreamUrl(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\/+$/, '')
}
