// @vitest-environment jsdom
/**
 * Behaviour coverage for `useRowSelection`, the render-phase replacement for
 * the selection-prune effect the three selection-capable CRM tabs shipped
 * (v1.23.1).
 *
 * The defect class is the v1.23 theme: the effect version pruned AFTER the
 * commit, so the frame that painted refreshed rows still painted the stale
 * selection, and React re-rendered to correct it. The assertions here record
 * COMMITS (an effect with no dependency array fires once per commit), not
 * renders, because that is where the two shapes differ: the legacy effect
 * version commits a frame pairing the new rows with the not-yet-pruned
 * selection; the render-phase version never commits such a frame.
 *
 * Harness: the `react-dom/client` + `act` probe precedent from
 * `src/features/crm/useResource.test.ts`.
 */
import { act, createElement, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useRowSelection } from './useRowSelection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** One entry per COMMIT: what actually reached the DOM together. */
type Commit = { rowIds: string[]; selected: string[] }

type Row = { id: string }
const rowsOf = (...ids: string[]): Row[] => ids.map((id) => ({ id }))

function harness() {
  const commits: Commit[] = []
  let setSelected: Dispatch<SetStateAction<ReadonlySet<string>>> = () => {}
  const Probe = ({ rows }: { rows: Row[] }) => {
    const [selected, set] = useRowSelection(rows)
    setSelected = set
    useEffect(() => {
      commits.push({ rowIds: rows.map((r) => r.id), selected: [...selected].sort() })
    })
    return null
  }
  return {
    commits,
    Probe,
    select: (id: string) => act(() => setSelected((prev) => new Set([...prev, id]))),
    lastCommit: () => commits[commits.length - 1],
  }
}

describe('useRowSelection', () => {
  it('starts empty and holds explicit selections across re-renders of the same rows', async () => {
    const h = harness()
    const rows = rowsOf('a', 'b')
    await act(async () => root.render(createElement(h.Probe, { rows })))
    expect(h.lastCommit()).toEqual({ rowIds: ['a', 'b'], selected: [] })

    await h.select('a')
    await act(async () => root.render(createElement(h.Probe, { rows })))
    expect(h.lastCommit()).toEqual({ rowIds: ['a', 'b'], selected: ['a'] })
  })

  it('prunes ids that left the list, in the SAME commit that first shows the new rows', async () => {
    const h = harness()
    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('a', 'b') })))
    await h.select('a')
    await h.select('b')
    expect(h.lastCommit().selected).toEqual(['a', 'b'])

    // The row set shrinks (refresh / delete / filter change): `a` is gone.
    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('b') })))

    expect(h.lastCommit()).toEqual({ rowIds: ['b'], selected: ['b'] })
    // The class this hook exists to close: no committed frame may pair the
    // new rows with the stale selection. The effect version commits exactly
    // that frame (prune runs post-commit), which is what reddens here when
    // the hook body is swapped back to `useEffect(... pruneSelection ...)`.
    const stale = h.commits.filter(
      (c) => c.rowIds.join() === 'b' && c.selected.includes('a'),
    )
    expect(stale).toEqual([])
  })

  it('an id that leaves and later returns stays dropped (the effect semantics, preserved)', async () => {
    const h = harness()
    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('a', 'b') })))
    await h.select('a')

    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('b') })))
    expect(h.lastCommit().selected).toEqual([])

    // `a` re-appears (edited back into the filtered stage, re-import): it was
    // pruned when it left, so it must come back UNSELECTED.
    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('a', 'b') })))
    expect(h.lastCommit()).toEqual({ rowIds: ['a', 'b'], selected: [] })
  })

  it('bails out when nothing was pruned: no extra commit for an unrelated rows refresh', async () => {
    const h = harness()
    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('a', 'b') })))
    await h.select('a')
    const before = h.commits.length

    // Same ids, new array identity -- the common "refresh returned the same
    // list" case. pruneSelection returns the same reference, the render-phase
    // set bails out, and exactly one commit (the re-render itself) lands.
    await act(async () => root.render(createElement(h.Probe, { rows: rowsOf('a', 'b') })))
    expect(h.commits.length).toBe(before + 1)
    expect(h.lastCommit().selected).toEqual(['a'])
  })
})
