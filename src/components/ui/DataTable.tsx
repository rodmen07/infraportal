// ---------------------------------------------------------------------------
// DataTable (v1.18.4 PR1): a shell for the header/row-hover/empty-state
// chrome three different list surfaces (the API Docs rate-limit table,
// ConsultationsPage's request list, SupportQueuePage's request list) each
// hand-rolled with their own `border-zinc-700/40`, `bg-zinc-800/40`,
// `hover:bg-zinc-800/20`-style classes. Column content stays entirely with
// the caller (a shell, not a data-grid abstraction): this only standardizes
// the wrapping border, the header band, the row divider/hover, and the
// empty-state row.
// ---------------------------------------------------------------------------
import type { ReactNode } from 'react'

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-border-soft ${className}`.trim()}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border-soft bg-surface-hover text-left text-scale-xs text-text-muted">
      {children}
    </thead>
  )
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border-soft">{children}</tbody>
}

export function DataTableRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`transition-colors hover:bg-surface-hover ${className}`.trim()}>{children}</tr>
}

/** A single full-width row for "no results yet" states, so every adopting
 * list renders the same empty message instead of three slightly different
 * ad hoc ones. `colSpan` must match the table's real column count or the
 * cell will not span the full width. */
export function DataTableEmptyState({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-scale-xs text-text-muted">
        {children}
      </td>
    </tr>
  )
}
