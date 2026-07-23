import { useEffect, useRef } from 'react'
import { CRM_STORE_BOUNDARY } from '../../lib/crmStore.mock'
import { isAllSelected, isSomeSelected } from '../../lib/rowSelection'

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------
export const INPUT_CLS = 'w-full rounded-xl border border-zinc-700 bg-surface-control px-3 py-2 text-sm text-text-primary placeholder-zinc-500 outline-none transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30'

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-text-muted">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  )
}

export const NO_TOKEN_MSG = 'No auth token — set VITE_ADMIN_JWT or log in via the portal.'

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isNoToken = message === NO_TOKEN_MSG
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
      <p className="text-sm font-medium text-danger-text">Error</p>
      <p className="mt-1 font-mono text-xs text-danger-text">{message}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onRetry} className="btn-neutral px-3 py-1.5 text-xs">Retry</button>
        {isNoToken && (
          <a href="#/portal/login" className="btn-accent px-3 py-1.5 text-xs">Log in via portal</a>
        )}
      </div>
    </div>
  )
}

// Generic List/Document icon
export const DocumentIcon = () => (
  <svg className="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375H12a.75.75 0 01-.75-.75V1.5M4.5 19.5h15" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v2.625c0 1.142-.444 2.207-1.237 3.001L15 22.5M4.5 19.5a2.25 2.25 0 01-2.25-2.25V7.5A2.25 2.25 0 014.5 5.25h9A2.25 2.25 0 0115.75 7.5v.75" />
  </svg>
);

// Lightning bolt icon for Live Feed
export const LightningBoltIcon = () => (
  <svg className="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

// Folder/Project icon for Projects
export const ProjectIcon = () => (
  <svg className="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-4.5-9v.75a2.25 2.25 0 01-2.25 2.25H9.75A2.25 2.25 0 017.5 12V3m-3.75 12V5.25A2.25 2.25 0 014.5 3h15.25a.75.75 0 01.75.75v12.75m-16.5-9H1.5m.75 12a1.5 1.5 0 001.5 1.5h15.75a1.5 1.5 0 001.5-1.5V16.5m-19.5 0V7.5m2.25 9V7.5m1.5 9V7.5m3 9V7.5" />
  </svg>
);

// Milestone / Flag icon
export const FlagIcon = () => (
  <svg className="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

// Collaborators / Users icon
export const UsersIcon = () => (
  <svg className="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.75c-.249 0-.472-.03-.692-.081A4.5 4.5 0 0112 15c-1.637 0-3.18-.545-4.308-1.428-.22-.05-.443-.081-.692-.081a2.25 2.25 0 00-2.25 2.25v2.25a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25V17.25a2.25 2.25 0 00-2.25-2.25zm-2.25-9a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);

interface CustomEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onRefresh?: () => void;
  ctaText?: string;
  onCtaClick?: () => void;
}

export function CustomEmptyState({ icon, title, description, onRefresh, ctaText, onCtaClick }: CustomEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon}
      <p className="text-sm font-medium text-text-muted">{title}</p>
      <p className="text-xs text-zinc-600 text-center">{description}</p>
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="mt-2 text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300">
          Refresh
        </button>
      )}
      {ctaText && onCtaClick && (
        <button type="button" onClick={onCtaClick} className="btn-accent px-3 py-1.5 text-xs">
          {ctaText}
        </button>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose} role="presentation">
      <div
        className="forge-panel surface-card-strong w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-black/60"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 id="modal-title" className="text-base font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-text-subtle hover:text-white transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      {children}
    </div>
  )
}

export function SaveError({ message }: { message: string }) {
  return <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 font-mono text-xs text-danger-text">{message}</p>
}

export function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-3 py-2">
      <div className="flex gap-1">
        <button type="button" onClick={onEdit} title="Edit" className="rounded px-1.5 py-0.5 text-xs text-text-muted hover:bg-zinc-700 hover:text-white transition-colors">✏</button>
        <button type="button" onClick={onDelete} title="Delete" className="rounded px-1.5 py-0.5 text-xs text-text-muted hover:bg-red-500/20 hover:text-red-300 transition-colors">✕</button>
      </div>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Bulk selection primitives (page-scoped: "select all" targets the rows
// currently rendered). Only shown in demo mode, where the tables render the
// in-memory mock store.
// ---------------------------------------------------------------------------
export function DemoDataBadge({ note = CRM_STORE_BOUNDARY }: { note?: string }) {
  return (
    <span
      title={note}
      className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30"
    >
      Demo data
    </span>
  )
}

export function SelectAllCheckbox({ pageIds, selected, onToggle }: {
  pageIds: string[]; selected: ReadonlySet<string>; onToggle: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const all = isAllSelected(selected, pageIds)
  const some = isSomeSelected(selected, pageIds)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !all && some
  }, [all, some])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="rounded"
      checked={all}
      onChange={onToggle}
      aria-label="Select all rows"
    />
  )
}

export function SelectionToolbar({ count, onBulkEdit, onClear }: {
  count: number; onBulkEdit: () => void; onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-amber-300">{count} selected</span>
      <button type="button" onClick={onBulkEdit} className="btn-accent px-3 py-1.5 text-xs">Bulk edit</button>
      <button type="button" onClick={onClear} className="text-xs text-text-muted hover:text-white">Clear</button>
    </div>
  )
}

export function DeleteModal({ label, onConfirm, onClose, saving, error }: {
  label: string; onConfirm: () => void; onClose: () => void; saving: boolean; error: string | null
}) {
  return (
    <Modal title="Confirm delete" onClose={onClose}>
      <p className="text-sm text-text-secondary">Delete <span className="font-semibold text-white">{label}</span>? This cannot be undone.</p>
      {error && <SaveError message={error} />}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={saving} className="rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2 text-sm font-medium text-danger-text transition hover:border-red-500/70 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Stage / status color maps
// ---------------------------------------------------------------------------
// eslint-disable-next-line react-refresh/only-export-components
export const LIFECYCLE_COLOR: Record<string, string> = {
  lead:       'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  prospect:   'bg-blue-500/15 text-info-text ring-blue-500/30',
  customer:   'bg-green-500/15 text-success-text ring-green-500/30',
  churned:    'bg-red-500/15 text-danger-text ring-red-500/30',
  evangelist: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
}
// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-500/15 text-success-text ring-green-500/30',
  inactive: 'bg-zinc-500/15 text-text-muted ring-zinc-500/30',
  churned:  'bg-red-500/15 text-danger-text ring-red-500/30',
}
// eslint-disable-next-line react-refresh/only-export-components
export const STAGE_COLOR: Record<string, string> = {
  qualification: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  proposal:      'bg-blue-500/15 text-info-text ring-blue-500/30',
  negotiation:   'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  'closed-won':  'bg-green-500/15 text-success-text ring-green-500/30',
  'closed-lost': 'bg-red-500/15 text-danger-text ring-red-500/30',
}
// eslint-disable-next-line react-refresh/only-export-components
export const ACTIVITY_COLOR: Record<string, string> = {
  email:   'bg-blue-500/15 text-info-text ring-blue-500/30',
  call:    'bg-green-500/15 text-success-text ring-green-500/30',
  meeting: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  task:    'bg-amber-500/15 text-amber-300 ring-amber-500/30',
}
export const FALLBACK_BADGE = 'bg-zinc-500/15 text-text-muted ring-zinc-500/30'

export function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${map[value] ?? FALLBACK_BADGE}`}>
      {value}
    </span>
  )
}
