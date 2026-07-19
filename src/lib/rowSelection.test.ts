import { describe, expect, it } from 'vitest'
import {
  clearSelection,
  isAllSelected,
  isSomeSelected,
  pruneSelection,
  toggleAll,
  toggleRow,
} from './rowSelection'

const PAGE = ['a', 'b', 'c']

describe('toggleRow', () => {
  it('adds an unselected id and removes a selected id', () => {
    const one = toggleRow(new Set(), 'a')
    expect([...one]).toEqual(['a'])
    const none = toggleRow(one, 'a')
    expect(none.size).toBe(0)
  })

  it('does not mutate the input set', () => {
    const input = new Set(['a'])
    toggleRow(input, 'b')
    expect([...input]).toEqual(['a'])
  })
})

describe('toggleAll', () => {
  it('selects every page id when none are selected', () => {
    expect([...toggleAll(new Set(), PAGE)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('selects the remaining page ids when only some are selected', () => {
    expect([...toggleAll(new Set(['b']), PAGE)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('deselects the page when every page id is selected', () => {
    expect(toggleAll(new Set(PAGE), PAGE).size).toBe(0)
  })

  it('leaves ids from other pages untouched in both directions', () => {
    const withOffPage = toggleAll(new Set(['z']), PAGE)
    expect([...withOffPage].sort()).toEqual(['a', 'b', 'c', 'z'])
    const deselected = toggleAll(new Set(['a', 'b', 'c', 'z']), PAGE)
    expect([...deselected]).toEqual(['z'])
  })
})

describe('clearSelection', () => {
  it('returns an empty set', () => {
    expect(clearSelection().size).toBe(0)
  })
})

describe('pruneSelection', () => {
  it('drops ids that are no longer in the list', () => {
    const pruned = pruneSelection(new Set(['a', 'gone']), PAGE)
    expect([...pruned]).toEqual(['a'])
  })

  it('returns the same reference when nothing changed (state bail-out)', () => {
    const selected = new Set(['a', 'b'])
    expect(pruneSelection(selected, PAGE)).toBe(selected)
  })
})

describe('isAllSelected / isSomeSelected', () => {
  it('reports all, some, and none correctly', () => {
    expect(isAllSelected(new Set(PAGE), PAGE)).toBe(true)
    expect(isAllSelected(new Set(['a']), PAGE)).toBe(false)
    expect(isSomeSelected(new Set(['a']), PAGE)).toBe(true)
    expect(isSomeSelected(new Set(), PAGE)).toBe(false)
  })

  it('never reports all-selected for an empty page', () => {
    expect(isAllSelected(new Set(['a']), [])).toBe(false)
    expect(isSomeSelected(new Set(['a']), [])).toBe(false)
  })
})
