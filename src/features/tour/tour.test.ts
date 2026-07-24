import { describe, it, expect } from 'vitest'
import { TOUR } from './tourSteps'
import { clampIndex, nextIndex, prevIndex, isFirst, isLast, progressLabel } from './tourNav'

describe('tour steps', () => {
  it('has at least an intro and a finish', () => {
    expect(TOUR.length).toBeGreaterThanOrEqual(3)
    expect(TOUR[0].id).toBe('intro')
    expect(TOUR[TOUR.length - 1].id).toBe('finish')
  })

  it('every step has a non-empty id, title, and body', () => {
    for (const step of TOUR) {
      expect(step.id).toBeTruthy()
      expect(step.title).toBeTruthy()
      expect(step.body).toBeTruthy()
    }
  })

  it('ids are unique', () => {
    const ids = TOUR.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every href is a hash route', () => {
    for (const step of TOUR) {
      if (step.href !== undefined) expect(step.href.startsWith('#/')).toBe(true)
    }
  })

  it('routes only through surfaces viewable without a login (no auth-gated portal)', () => {
    const hrefs = TOUR.map((s) => s.href).filter(Boolean)
    expect(hrefs).toEqual(expect.arrayContaining(['#/status', '#/api-docs', '#/crm/admin']))
    // The client portal shows a login gate, not the product, so the tour must
    // not drop a first-time visitor there.
    expect(hrefs).not.toContain('#/portal')
  })
})

describe('tourNav', () => {
  const LEN = TOUR.length

  it('clampIndex keeps the index in range', () => {
    expect(clampIndex(-5, LEN)).toBe(0)
    expect(clampIndex(0, LEN)).toBe(0)
    expect(clampIndex(LEN - 1, LEN)).toBe(LEN - 1)
    expect(clampIndex(999, LEN)).toBe(LEN - 1)
  })

  it('clampIndex handles an empty tour without going negative', () => {
    expect(clampIndex(3, 0)).toBe(0)
  })

  it('next advances but never past the last step', () => {
    expect(nextIndex(0, LEN)).toBe(1)
    expect(nextIndex(LEN - 1, LEN)).toBe(LEN - 1)
  })

  it('prev goes back but never before the first step', () => {
    expect(prevIndex(2, LEN)).toBe(1)
    expect(prevIndex(0, LEN)).toBe(0)
  })

  it('isFirst / isLast identify the ends', () => {
    expect(isFirst(0)).toBe(true)
    expect(isFirst(1)).toBe(false)
    expect(isLast(LEN - 1, LEN)).toBe(true)
    expect(isLast(0, LEN)).toBe(false)
  })

  it('progressLabel is 1-based and clamped', () => {
    expect(progressLabel(0, LEN)).toBe(`Step 1 of ${LEN}`)
    expect(progressLabel(LEN - 1, LEN)).toBe(`Step ${LEN} of ${LEN}`)
    expect(progressLabel(999, LEN)).toBe(`Step ${LEN} of ${LEN}`)
  })
})
