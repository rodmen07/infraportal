// ---------------------------------------------------------------------------
// Pure helpers for bulk row selection in the admin CRM tables.
//
// Selection is page-scoped: "select all" only ever targets the ids currently
// rendered (`pageIds`), never rows outside the visible page. Helpers never
// mutate the input set; they return a new set (or the same reference when
// nothing changed, so React state updates can bail out).
// ---------------------------------------------------------------------------

export function toggleRow(selected: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Header select-all semantics: if every page row is already selected,
 * deselect the page rows; otherwise select all page rows. Ids selected on
 * other pages are left untouched.
 */
export function toggleAll(selected: ReadonlySet<string>, pageIds: readonly string[]): ReadonlySet<string> {
  const next = new Set(selected)
  if (isAllSelected(selected, pageIds)) {
    for (const id of pageIds) next.delete(id)
  } else {
    for (const id of pageIds) next.add(id)
  }
  return next
}

export function clearSelection(): ReadonlySet<string> {
  return new Set()
}

/**
 * Drops ids that no longer exist in the list (after a refresh, delete, or
 * filter change). Returns the input set unchanged when nothing was pruned.
 */
export function pruneSelection(selected: ReadonlySet<string>, validIds: readonly string[]): ReadonlySet<string> {
  const valid = new Set(validIds)
  const next = new Set<string>()
  let changed = false
  for (const id of selected) {
    if (valid.has(id)) next.add(id)
    else changed = true
  }
  return changed ? next : selected
}

export function isAllSelected(selected: ReadonlySet<string>, pageIds: readonly string[]): boolean {
  return pageIds.length > 0 && pageIds.every(id => selected.has(id))
}

export function isSomeSelected(selected: ReadonlySet<string>, pageIds: readonly string[]): boolean {
  return pageIds.some(id => selected.has(id))
}
