import { useEffect } from 'react'
import type { RegisteredShortcut } from '../../types'

interface ShortcutsHelpProps {
  shortcuts: RegisteredShortcut[]
  onClose: () => void
}

export function ShortcutsHelp({ shortcuts, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Group shortcuts by scope
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.scope]) {
        acc[shortcut.scope] = []
      }
      acc[shortcut.scope].push(shortcut)
      return acc
    },
    {} as Record<string, RegisteredShortcut[]>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Help overlay modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {/* Header */}
          <div className="sticky top-0 border-b border-zinc-700 bg-zinc-900/95 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-100">Keyboard Shortcuts</h2>
              <button
                onClick={onClose}
                className="rounded p-1 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label="Close shortcuts"
              >
                <span className="text-2xl text-zinc-400">×</span>
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-400">Press <kbd className="rounded bg-zinc-800 px-2 py-1 text-xs font-semibold">?</kbd> to toggle this help</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {Object.entries(groupedShortcuts).length === 0 ? (
              <p className="text-zinc-400">No shortcuts registered</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedShortcuts).map(([scope, scopeShortcuts]) => (
                  <div key={scope}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                      {scope}
                    </h3>
                    <div className="space-y-2">
                      {scopeShortcuts.map((shortcut, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-zinc-300">{shortcut.description}</span>
                          <div className="flex gap-1">
                            {shortcut.keys.split('+').map((key, kidx) => (
                              <span key={kidx}>
                                {kidx > 0 && <span className="mx-1 text-zinc-500">+</span>}
                                <kbd className="rounded bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200">
                                  {key}
                                </kbd>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-zinc-700 bg-zinc-900/50 px-6 py-3 text-center text-xs text-zinc-500">
            Press <kbd className="rounded bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300">Esc</kbd> to close
          </div>
        </div>
      </div>
    </>
  )
}
