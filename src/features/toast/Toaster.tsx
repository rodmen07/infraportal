import { useState, useRef } from 'react'
import type { Toast } from '../../types'

interface ToasterProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

const variantStyles = {
  success: 'bg-green-900/80 border-green-700 text-green-100',
  error: 'bg-red-900/80 border-red-700 text-red-100',
  info: 'bg-blue-900/80 border-blue-700 text-blue-100',
  warning: 'bg-amber-900/80 border-amber-700 text-amber-100',
}

const variantIcons = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})

  const visibleToasts = toasts.slice(-3)
  const hiddenCount = toasts.length - visibleToasts.length

  const handleMouseEnter = (id: string) => {
    setHoveredId(id)
    if (hoverTimeoutsRef.current[id]) {
      clearTimeout(hoverTimeoutsRef.current[id])
    }
  }

  const handleMouseLeave = (id: string) => {
    setHoveredId(null)
  }

  return (
    <>
      {/* Desktop: bottom-right */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm hidden sm:flex">
        {visibleToasts.map((toast, idx) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-in slide-in-from-right fade-in duration-300"
            onMouseEnter={() => handleMouseEnter(toast.id)}
            onMouseLeave={() => handleMouseLeave(toast.id)}
          >
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm ${variantStyles[toast.variant]} transition-all duration-300`}
            >
              <div className="flex-shrink-0 text-lg font-bold mt-0.5">
                {variantIcons[toast.variant]}
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium break-words">{toast.message}</p>
                {toast.action && (
                  <button
                    onClick={toast.action.onClick}
                    className="mt-2 text-xs font-semibold underline hover:opacity-80 transition-opacity"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              {!toast.isLoading && toast.duration !== Infinity && (
                <button
                  onClick={() => onDismiss(toast.id)}
                  className="flex-shrink-0 text-lg hover:opacity-60 transition-opacity mt-0.5"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
              {toast.isLoading && (
                <div className="flex-shrink-0 animate-spin">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        ))}

        {hiddenCount > 0 && (
          <div className="pointer-events-auto text-center text-xs text-zinc-400 py-2">
            +{hiddenCount} more
          </div>
        )}
      </div>

      {/* Mobile: top-center */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-50 flex flex-col gap-2 p-4 sm:hidden max-h-screen overflow-y-auto">
        {visibleToasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-in slide-in-from-top fade-in duration-300"
            onMouseEnter={() => handleMouseEnter(toast.id)}
            onMouseLeave={() => handleMouseLeave(toast.id)}
          >
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm ${variantStyles[toast.variant]} transition-all duration-300 w-full`}
            >
              <div className="flex-shrink-0 text-lg font-bold mt-0.5">
                {variantIcons[toast.variant]}
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium break-words">{toast.message}</p>
                {toast.action && (
                  <button
                    onClick={toast.action.onClick}
                    className="mt-2 text-xs font-semibold underline hover:opacity-80 transition-opacity"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              {!toast.isLoading && toast.duration !== Infinity && (
                <button
                  onClick={() => onDismiss(toast.id)}
                  className="flex-shrink-0 text-lg hover:opacity-60 transition-opacity mt-0.5"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
              {toast.isLoading && (
                <div className="flex-shrink-0 animate-spin">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
