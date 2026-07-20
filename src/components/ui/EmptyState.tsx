// ---------------------------------------------------------------------------
// EmptyState (v1.18.4 PR1): the "no results yet" block ConsultationsPage and
// SupportQueuePage each hand-rolled identically
// (`rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/40
// px-5 py-10 text-center text-sm text-zinc-400`), migrated onto tokens here
// alongside DataTable's own row-shaped `DataTableEmptyState`.
// ---------------------------------------------------------------------------
import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-hover px-5 py-10 text-center text-sm text-text-muted">
      {children}
    </div>
  )
}
