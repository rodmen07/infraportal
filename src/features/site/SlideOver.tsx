// Styling note (v1.18.1 PR2): the panel is on semantic tokens because the
// `[data-theme="light"] nav, aside` override that used to repaint it in light
// mode is deleted in this PR. Escape handling and a focus trap for this
// overlay are finding F11, scheduled for v1.18.2.
import React from 'react'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 overlay-fade" onClick={onClose} />
      <aside className="relative ml-auto w-full max-w-md transform bg-surface-2 p-6 shadow-2xl backdrop-blur-md slide-over-enter">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 rounded px-2 py-1 text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 text-sm text-text-secondary">{children}</div>
      </aside>
    </div>
  )
}
