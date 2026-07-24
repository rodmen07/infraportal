import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../layout/usePrefersReducedMotion'
import { TOUR } from './tourSteps'
import { nextIndex, prevIndex, isFirst, isLast, progressLabel } from './tourNav'
import { TOUR_START_EVENT } from './tourEvents'

// The guided product tour: a persistent floating card that narrates a scripted
// path and deep-links to each real surface as the visitor advances. Mounted
// once, globally, so it survives the hash navigation between steps. Deliberately
// NOT a modal: it never traps focus and the page stays fully interactive, which
// is the point of a product tour. All stepping logic is in the tested pure
// modules (tourSteps.ts, tourNav.ts); this file is the overlay.

function goTo(index: number) {
  const href = TOUR[index]?.href
  if (href) window.location.hash = href
}

export function GuidedTour() {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)

  const stop = useCallback(() => setActive(false), [])

  const start = useCallback(() => {
    setIndex(0)
    setActive(true)
  }, [])

  const advance = useCallback((to: number) => {
    setIndex(to)
    goTo(to)
  }, [])

  // Start on request (the hero CTA dispatches this event).
  useEffect(() => {
    const onStart = () => start()
    window.addEventListener(TOUR_START_EVENT, onStart)
    return () => window.removeEventListener(TOUR_START_EVENT, onStart)
  }, [start])

  // Move focus to the card when the tour opens so keyboard users can drive it,
  // without trapping focus (the rest of the page stays reachable).
  useEffect(() => {
    if (active) cardRef.current?.focus()
  }, [active])

  // Esc exits; Arrow keys step, unless the visitor is typing in a field.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === 'Escape') {
        e.preventDefault()
        stop()
      } else if (!typing && e.key === 'ArrowRight') {
        e.preventDefault()
        advance(nextIndex(index, TOUR.length))
      } else if (!typing && e.key === 'ArrowLeft') {
        e.preventDefault()
        advance(prevIndex(index, TOUR.length))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, index, advance, stop])

  if (!active) return null

  const step = TOUR[index]
  const first = isFirst(index)
  const last = isLast(index, TOUR.length)

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[90] flex justify-center p-4 sm:bottom-4"
      role="dialog"
      aria-label="Guided product tour"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`forge-panel surface-card-strong w-full max-w-md p-5 shadow-2xl shadow-black/50 focus:outline-none ${
          reducedMotion ? '' : 'transition-transform'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-text">
            {progressLabel(index, TOUR.length)}
          </span>
          <button
            type="button"
            onClick={stop}
            className="rounded px-2 py-1 text-xs text-text-subtle transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Skip tour
          </button>
        </div>

        <h2 className="mt-2 text-base font-semibold text-text-primary">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {TOUR.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-accent' : 'w-1.5 bg-border-strong'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => advance(prevIndex(index, TOUR.length))}
            disabled={first}
            className="rounded-lg border border-border-soft bg-surface-control px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-50"
          >
            Back
          </button>
          {last ? (
            <button type="button" onClick={stop} className="btn-accent px-4 py-1.5 text-xs">
              Finish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => advance(nextIndex(index, TOUR.length))}
              className="btn-accent px-4 py-1.5 text-xs"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
