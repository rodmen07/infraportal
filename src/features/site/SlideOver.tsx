// Styling note (v1.18.1 PR2): the panel is on semantic tokens because the
// `[data-theme="light"] nav, aside` override that used to repaint it in light
// mode is deleted.
//
// v1.18.2 PR1 (finding F11): Escape handling, a Tab focus trap, and
// focus-return-to-trigger are added via the shared useFocusTrap hook, and the
// dialog now carries an accessible name. The backdrop still closes on click.
import { useFocusTrap } from '../layout/useFocusTrap'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose)

  if (!open) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Details'}
    >
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
