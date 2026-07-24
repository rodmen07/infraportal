import { describe, it, expect } from 'vitest'
import {
  parseEvent,
  pushBounded,
  formatEventLabel,
  relativeTime,
  connectionLabel,
  type StreamEvent,
} from './eventModel'

// The exact shape event-stream-service emits (main.go Event struct).
const LIVE = {
  id: 'e1',
  source: 'accounts-service',
  type: 'account.created',
  timestamp: '2026-07-23T12:00:00Z',
  payload: { accountId: 'a1' },
}

describe('parseEvent', () => {
  it('parses an object event', () => {
    expect(parseEvent(LIVE)).toEqual({
      id: 'e1',
      source: 'accounts-service',
      type: 'account.created',
      timestamp: '2026-07-23T12:00:00Z',
      payload: { accountId: 'a1' },
    })
  })

  it('parses a JSON string body (the raw SSE data line)', () => {
    expect(parseEvent(JSON.stringify(LIVE))?.id).toBe('e1')
  })

  it('keeps an event with no timestamp or payload', () => {
    const e = parseEvent({ id: 'x', source: 's', type: 't' })
    expect(e).toEqual({ id: 'x', source: 's', type: 't' })
    expect(e?.timestamp).toBeUndefined()
  })

  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['a keep-alive-ish non-JSON string', ': keep-alive'],
    ['null', null],
    ['a number', 7],
    ['object missing id', { source: 's', type: 't' }],
    ['object missing source', { id: 'x', type: 't' }],
    ['object missing type', { id: 'x', source: 's' }],
    ['id not a string', { id: 1, source: 's', type: 't' }],
  ])('returns null for %s', (_label, raw) => {
    expect(parseEvent(raw)).toBeNull()
  })
})

describe('pushBounded', () => {
  const mk = (id: string): StreamEvent => ({ id, source: 's', type: 't' })

  it('prepends newest first', () => {
    let buf: StreamEvent[] = []
    buf = pushBounded(buf, mk('a'), 5)
    buf = pushBounded(buf, mk('b'), 5)
    expect(buf.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('caps the length, dropping the oldest', () => {
    let buf: StreamEvent[] = []
    for (const id of ['a', 'b', 'c', 'd']) buf = pushBounded(buf, mk(id), 3)
    expect(buf.map((e) => e.id)).toEqual(['d', 'c', 'b'])
  })

  it('dedupes by id (replay overlapping a live event does not double-list)', () => {
    let buf = [mk('a'), mk('b')]
    buf = pushBounded(buf, mk('a'), 5)
    expect(buf.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input buffer', () => {
    const original = [mk('a')]
    const snapshot = [...original]
    pushBounded(original, mk('b'), 5)
    expect(original).toEqual(snapshot)
  })

  it('a max of 0 yields an empty buffer', () => {
    expect(pushBounded([mk('a')], mk('b'), 0)).toEqual([])
  })
})

describe('formatEventLabel', () => {
  it('joins source and type', () => {
    expect(formatEventLabel(LIVE as StreamEvent)).toBe('accounts-service · account.created')
  })
})

describe('relativeTime', () => {
  const base = Date.parse('2026-07-23T12:00:00Z')
  it('returns just now under 5s', () => {
    expect(relativeTime('2026-07-23T12:00:00Z', base + 2000)).toBe('just now')
  })
  it('returns seconds, minutes, hours, days', () => {
    expect(relativeTime('2026-07-23T12:00:00Z', base + 30_000)).toBe('30s ago')
    expect(relativeTime('2026-07-23T12:00:00Z', base + 5 * 60_000)).toBe('5m ago')
    expect(relativeTime('2026-07-23T12:00:00Z', base + 3 * 3_600_000)).toBe('3h ago')
    expect(relativeTime('2026-07-23T12:00:00Z', base + 2 * 86_400_000)).toBe('2d ago')
  })
  it('clamps a future timestamp to just now rather than negative', () => {
    expect(relativeTime('2026-07-23T12:00:10Z', base)).toBe('just now')
  })
  it('returns empty for a missing or unparseable timestamp', () => {
    expect(relativeTime(undefined, base)).toBe('')
    expect(relativeTime('not a date', base)).toBe('')
  })
})

describe('connectionLabel', () => {
  it('covers every state', () => {
    expect(connectionLabel('connecting')).toBe('Connecting…')
    expect(connectionLabel('live')).toBe('Live')
    expect(connectionLabel('reconnecting')).toBe('Reconnecting…')
  })
})
