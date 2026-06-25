import { describe, expect, it, vi, afterEach } from 'vitest'
import { formatRelativeTime } from './time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for empty input', () => {
    expect(formatRelativeTime('')).toBe('')
  })

  it('returns empty string for invalid dates', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
  })

  it('returns just now for future timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    expect(formatRelativeTime('2026-01-01T00:00:10.000Z')).toBe('just now')
  })

  it('formats recent durations in seconds/minutes/hours/days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))

    expect(formatRelativeTime('2026-01-01T23:59:30.000Z')).toBe('30s ago')
    expect(formatRelativeTime('2026-01-01T23:45:00.000Z')).toBe('15m ago')
    expect(formatRelativeTime('2026-01-01T21:00:00.000Z')).toBe('3h ago')
    expect(formatRelativeTime('2025-12-30T00:00:00.000Z')).toBe('3d ago')
  })
})
