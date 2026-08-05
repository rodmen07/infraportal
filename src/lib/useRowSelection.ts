import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { pruneSelection } from './rowSelection'

/**
 * Bulk-selection state for the CRM tables, pruned against the rows currently
 * on screen.
 *
 * The three selection-capable tabs used to prune with an effect:
 *
 *     useEffect(() => {
 *       setSelected(prev => pruneSelection(prev, rows.map(r => r.id)))
 *     }, [rows])
 *
 * which is a `react-hooks/set-state-in-effect` violation sitting on the same
 * defect class as the loader effects (v1.23): an effect runs AFTER the commit,
 * so the frame that painted the refreshed rows still painted the STALE
 * selection (count, header checkbox, row checkboxes), and React re-rendered to
 * correct it.
 *
 * This hook is the React-documented "adjust state while rendering" form of the
 * same rule: when the rows identity changes, the prune is applied during the
 * render that first sees the new rows, so the corrected selection and the new
 * rows land in the SAME paint. React re-invokes the component immediately
 * after a render-phase set, before touching the DOM.
 *
 * Semantics are unchanged from the effect version: an id that leaves the list
 * (refresh, delete, filter change) is dropped permanently, and `pruneSelection`
 * returns the same reference when nothing changed so the render-phase set
 * bails out.
 */
export function useRowSelection(
  rows: ReadonlyArray<{ id: string }>,
): [ReadonlySet<string>, Dispatch<SetStateAction<ReadonlySet<string>>>] {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [prevRows, setPrevRows] = useState(rows)
  if (prevRows !== rows) {
    setPrevRows(rows)
    setSelected(prev => pruneSelection(prev, rows.map(r => r.id)))
  }
  return [selected, setSelected]
}
