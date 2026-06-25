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
      <aside className="relative ml-auto w-full max-w-md transform bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-md slide-over-enter">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800/40"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 text-sm text-zinc-300">{children}</div>
      </aside>
    </div>
  )
}
